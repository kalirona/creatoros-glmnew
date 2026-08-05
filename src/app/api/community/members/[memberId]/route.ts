import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  sendNotification,
  canManageMembers,
  canActOnMember,
  roleLevel,
  sanitizeString,
  safeJsonParse,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'INSTRUCTOR', 'MODERATOR', 'MEMBER', 'STUDENT', 'AFFILIATE', 'GUEST']
const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED', 'MUTED']

function serializeMember(m: {
  id: string
  userId: string
  role: string
  memberStatus: string
  mutedUntil: Date | null
  suspendedUntil: Date | null
  bannedUntil: Date | null
  banReason: string | null
  lastSeenAt: Date
  joinedAt: Date
  postsCount: number
  commentsCount: number
  likesReceived: number
  badges: string
  user: { id: string; name: string; email: string; avatarUrl: string | null; bio: string | null }
}) {
  return {
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
    bio: m.user.bio,
    role: m.role,
    memberStatus: m.memberStatus,
    joinedAt: m.joinedAt,
    lastSeenAt: m.lastSeenAt,
    postsCount: m.postsCount,
    commentsCount: m.commentsCount,
    likesReceived: m.likesReceived,
    badges: safeJsonParse<unknown[]>(m.badges, []),
    mutedUntil: m.mutedUntil,
    suspendedUntil: m.suspendedUntil,
    bannedUntil: m.bannedUntil,
    banReason: m.banReason,
  }
}

// ─── GET /api/community/members/[memberId] ─────────────────────────────────
// Returns full profile + recent posts (10) + recent comments (10).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { memberId } = await params

    const member = await db.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: ctx.workspaceId },
      include: { user: true },
    })
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const [recentPosts, recentComments] = await Promise.all([
      db.communityPost.findMany({
        where: { workspaceId: ctx.workspaceId, userId: member.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          category: true,
          postType: true,
          likesCount: true,
          commentsCount: true,
          isPinned: true,
          isLocked: true,
          isArchived: true,
          createdAt: true,
        },
      }),
      db.communityComment.findMany({
        where: { post: { workspaceId: ctx.workspaceId }, userId: member.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          postId: true,
          content: true,
          likesCount: true,
          createdAt: true,
          post: { select: { id: true, title: true } },
        },
      }),
    ])

    return NextResponse.json({
      member: serializeMember(member),
      recentPosts,
      recentComments: recentComments.map((c) => ({
        id: c.id,
        postId: c.postId,
        postTitle: c.post?.title || null,
        content: c.content,
        likesCount: c.likesCount,
        createdAt: c.createdAt,
      })),
    })
  } catch (e) {
    console.error('[community/members/[memberId] GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── PATCH /api/community/members/[memberId] ───────────────────────────────
// Body: { role?, memberStatus?, until?, reason? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageMembers(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { memberId } = await params

    const target = await db.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: ctx.workspaceId },
      include: { user: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (target.role === 'OWNER') {
      return NextResponse.json({ error: 'Cannot modify the workspace owner via this endpoint' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const data: {
      role?: string
      memberStatus?: string
      mutedUntil?: Date | null
      suspendedUntil?: Date | null
      bannedUntil?: Date | null
      banReason?: string | null
    } = {}

    // ── Role change ───────────────────────────────────────────────────────
    if (typeof b.role === 'string' && b.role !== target.role) {
      const newRole = b.role.toUpperCase()
      if (!VALID_ROLES.includes(newRole)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      if (newRole === 'OWNER') {
        return NextResponse.json({ error: 'Cannot promote to OWNER via this endpoint; use transfer-ownership' }, { status: 400 })
      }

      const direction = roleLevel(newRole) > roleLevel(target.role) ? 'promote' : 'demote'
      const check = canActOnMember(ctx.workspaceRole, target.role, direction)
      if (!check.allowed) {
        return NextResponse.json({ error: check.reason || 'Forbidden' }, { status: 403 })
      }
      // Extra guard: cannot promote to actor's own level or above.
      if (direction === 'promote' && roleLevel(newRole) >= roleLevel(ctx.workspaceRole)) {
        return NextResponse.json({ error: 'Cannot promote to your own level or above' }, { status: 403 })
      }

      data.role = newRole

      await writeAuditLog(
        ctx,
        direction === 'promote' ? 'MEMBER_PROMOTE' : 'MEMBER_DEMOTE',
        'WorkspaceMember',
        target.id,
        { from: target.role, to: newRole, userId: target.userId }
      )
    }

    // ── memberStatus change ───────────────────────────────────────────────
    if (typeof b.memberStatus === 'string' && b.memberStatus !== target.memberStatus) {
      const newStatus = b.memberStatus.toUpperCase()
      if (!VALID_STATUSES.includes(newStatus)) {
        return NextResponse.json({ error: 'Invalid memberStatus' }, { status: 400 })
      }

      const reason =
        typeof b.reason === 'string' ? sanitizeString(b.reason, 1000) : null
      const untilRaw = typeof b.until === 'string' ? b.until : null
      let until: Date | null = null
      if (untilRaw) {
        const parsed = new Date(untilRaw)
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: 'Invalid until date' }, { status: 400 })
        }
        until = parsed
      }

      if (newStatus === 'ACTIVE') {
        if (!canManageMembers(ctx.workspaceRole)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        data.memberStatus = 'ACTIVE'
        data.mutedUntil = null
        data.suspendedUntil = null
        data.bannedUntil = null
        data.banReason = null
        await writeAuditLog(ctx, 'MEMBER_REACTIVATE', 'WorkspaceMember', target.id, {
          from: target.memberStatus,
          userId: target.userId,
        })
      } else if (newStatus === 'MUTED') {
        const check = canActOnMember(ctx.workspaceRole, target.role, 'mute')
        if (!check.allowed) {
          return NextResponse.json({ error: check.reason || 'Forbidden' }, { status: 403 })
        }
        data.memberStatus = 'MUTED'
        data.mutedUntil = until
        data.suspendedUntil = null
        data.bannedUntil = null
        data.banReason = null
        await writeAuditLog(ctx, 'MEMBER_MUTE', 'WorkspaceMember', target.id, {
          until,
          reason,
          userId: target.userId,
        })
      } else if (newStatus === 'SUSPENDED') {
        const check = canActOnMember(ctx.workspaceRole, target.role, 'suspend')
        if (!check.allowed) {
          return NextResponse.json({ error: check.reason || 'Forbidden' }, { status: 403 })
        }
        data.memberStatus = 'SUSPENDED'
        data.suspendedUntil = until
        data.mutedUntil = null
        data.bannedUntil = null
        data.banReason = null
        await writeAuditLog(ctx, 'MEMBER_SUSPEND', 'WorkspaceMember', target.id, {
          until,
          reason,
          userId: target.userId,
        })
      } else if (newStatus === 'BANNED') {
        const check = canActOnMember(ctx.workspaceRole, target.role, 'ban')
        if (!check.allowed) {
          return NextResponse.json({ error: check.reason || 'Forbidden' }, { status: 403 })
        }
        data.memberStatus = 'BANNED'
        data.bannedUntil = until
        data.banReason = reason
        data.mutedUntil = null
        data.suspendedUntil = null
        await writeAuditLog(ctx, 'MEMBER_BAN', 'WorkspaceMember', target.id, {
          until,
          reason,
          userId: target.userId,
        })
      }

      // Notify the affected member.
      await sendNotification(
        target.userId,
        ctx.workspaceId,
        'WARNING',
        `Your account status is now ${newStatus}`,
        reason
          ? `Reason: ${reason}${until ? ` until ${until.toISOString()}` : ''}`
          : `Status changed by ${ctx.user.name}${until ? ` until ${until.toISOString()}` : ''}.`,
        ctx.user.id,
        target.id,
        'WorkspaceMember'
      )
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const updated = await db.workspaceMember.update({
      where: { id: target.id },
      data,
      include: { user: true },
    })

    return NextResponse.json({ success: true, member: serializeMember(updated) })
  } catch (e) {
    console.error('[community/members/[memberId] PATCH] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
