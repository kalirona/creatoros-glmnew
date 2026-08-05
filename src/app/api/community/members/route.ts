import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  sendNotification,
  canManageMembers,
  canActOnMember,
  paginate,
  safeJsonParse,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

// Serializes a member row (with user included) into the API shape.
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

// ─── GET /api/community/members ────────────────────────────────────────────
// Query: ?page=1&pageSize=20&search=&role=&status=&sort=joinedAt&order=desc
// Returns: { members, total, page, pageSize, totalPages }
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? '1') || 1
    const pageSize = Number(searchParams.get('pageSize') ?? '20') || 20
    const search = searchParams.get('search')?.trim() || undefined
    const role = searchParams.get('role')?.trim() || undefined
    const status = searchParams.get('status')?.trim() || undefined
    const sortRaw = searchParams.get('sort') || 'joinedAt'
    const orderRaw = (searchParams.get('order') || 'desc').toUpperCase() === 'ASC' ? 'asc' : 'desc'

    type Where = {
      workspaceId: string
      role?: string
      memberStatus?: string
      user?: { OR: Array<{ name: { contains: string } } | { email: { contains: string } }> }
    }
    const where: Where = { workspaceId: ctx.workspaceId }
    if (role) where.role = role
    if (status) where.memberStatus = status
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      }
    }

    let orderBy:
      | { joinedAt: 'asc' | 'desc' }
      | { lastSeenAt: 'asc' | 'desc' }
      | { postsCount: 'asc' | 'desc' }
      | { commentsCount: 'asc' | 'desc' }
      | { user: { name: 'asc' | 'desc' } }
    switch (sortRaw) {
      case 'lastSeenAt':
        orderBy = { lastSeenAt: orderRaw }
        break
      case 'postsCount':
        orderBy = { postsCount: orderRaw }
        break
      case 'commentsCount':
        orderBy = { commentsCount: orderRaw }
        break
      case 'name':
        orderBy = { user: { name: orderRaw } }
        break
      case 'joinedAt':
      default:
        orderBy = { joinedAt: orderRaw }
        break
    }

    const total = await db.workspaceMember.count({ where })
    const { skip, take, page: safePage, pageSize: safeSize, totalPages } = paginate(
      page,
      pageSize,
      total
    )

    const members = await db.workspaceMember.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { user: true },
    })

    return NextResponse.json({
      members: members.map(serializeMember),
      total,
      page: safePage,
      pageSize: safeSize,
      totalPages,
    })
  } catch (e) {
    console.error('[community/members GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── DELETE /api/community/members?id={memberId} ───────────────────────────
// Removes a member from the workspace. OWNER cannot be removed.
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageMembers(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('id')
    if (!memberId) {
      return NextResponse.json({ error: 'Member id is required' }, { status: 400 })
    }

    const target = await db.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: ctx.workspaceId },
      include: { user: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (target.role === 'OWNER') {
      return NextResponse.json({ error: 'Cannot remove the workspace owner' }, { status: 403 })
    }

    const check = canActOnMember(ctx.workspaceRole, target.role, 'remove')
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason || 'Forbidden' }, { status: 403 })
    }

    await db.workspaceMember.delete({ where: { id: target.id } })

    await writeAuditLog(ctx, 'MEMBER_REMOVE', 'WorkspaceMember', target.id, {
      userId: target.userId,
      name: target.user.name,
      email: target.user.email,
      role: target.role,
    })

    await sendNotification(
      target.userId,
      ctx.workspaceId,
      'SYSTEM',
      'You have been removed from the workspace',
      `Your membership was removed by ${ctx.user.name}.`,
      ctx.user.id,
      target.id,
      'WorkspaceMember'
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[community/members DELETE] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
