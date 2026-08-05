import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  canManageMembers,
  paginate,
  sanitizeString,
  isValidEmail,
  generateToken,
  roleLevel,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

const VALID_INVITE_ROLES = [
  'ADMIN',
  'MANAGER',
  'INSTRUCTOR',
  'MODERATOR',
  'MEMBER',
  'STUDENT',
  'AFFILIATE',
  'GUEST',
]

function serializeInvitation(inv: {
  id: string
  workspaceId: string
  invitedBy: string
  email: string | null
  username: string | null
  token: string
  role: string
  status: string
  message: string
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}) {
  return {
    id: inv.id,
    email: inv.email,
    username: inv.username,
    role: inv.role,
    status: inv.status,
    message: inv.message,
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
    acceptedAt: inv.acceptedAt,
    revokedAt: inv.revokedAt,
    token: inv.token,
  }
}

// ─── GET /api/community/invitations ────────────────────────────────────────
// Query: ?status=PENDING&page=1&pageSize=20
// Returns: { invitations, total, page, pageSize, totalPages }
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageMembers(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? '1') || 1
    const pageSize = Number(searchParams.get('pageSize') ?? '20') || 20
    const status = searchParams.get('status')?.trim().toUpperCase() || undefined

    type Where = { workspaceId: string; status?: string }
    const where: Where = { workspaceId: ctx.workspaceId }
    if (status) where.status = status

    const total = await db.invitation.count({ where })
    const { skip, take, page: safePage, pageSize: safeSize, totalPages } = paginate(
      page,
      pageSize,
      total
    )

    const invitations = await db.invitation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    })

    // Resolve inviter user info (name + email) for each invitation.
    const inviterIds = Array.from(new Set(invitations.map((i) => i.invitedBy)))
    const inviters = inviterIds.length
      ? await db.user.findMany({
          where: { id: { in: inviterIds } },
          select: { id: true, name: true, email: true },
        })
      : []
    const inviterMap = new Map(inviters.map((u) => [u.id, u]))

    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        ...serializeInvitation(inv),
        inviter: inviterMap.get(inv.invitedBy)
          ? {
              name: inviterMap.get(inv.invitedBy)!.name,
              email: inviterMap.get(inv.invitedBy)!.email,
            }
          : null,
      })),
      total,
      page: safePage,
      pageSize: safeSize,
      totalPages,
    })
  } catch (e) {
    console.error('[community/invitations GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── POST /api/community/invitations ───────────────────────────────────────
// Body: { email?, username?, role, message?, expiresInHours? }
export async function POST(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageMembers(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const email =
      typeof b.email === 'string' && b.email.trim() ? b.email.trim().toLowerCase() : null
    const username =
      typeof b.username === 'string' && b.username.trim()
        ? sanitizeString(b.username, 100)
        : null

    if (!email && !username) {
      return NextResponse.json({ error: 'At least one of email or username is required' }, { status: 400 })
    }
    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const role =
      typeof b.role === 'string' ? b.role.toUpperCase() : ''
    if (!VALID_INVITE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role for invitation' }, { status: 400 })
    }

    // Cannot invite someone at or above your own level (e.g. ADMIN inviting ADMIN).
    // Owner (8) > ADMIN (7) so only owner can invite ADMIN.
    if (roleLevel(role) >= roleLevel(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Cannot invite a member at or above your own role' }, { status: 403 })
    }

    const message = sanitizeString(typeof b.message === 'string' ? b.message : '', 2000)

    const expiresInHoursRaw = Number(b.expiresInHours)
    const expiresInHours =
      Number.isFinite(expiresInHoursRaw) && expiresInHoursRaw > 0
        ? Math.min(expiresInHoursRaw, 24 * 365)
        : 168 // 7 days default

    // Check for existing PENDING invitation with same email in workspace → 409.
    if (email) {
      const existing = await db.invitation.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          email,
          status: 'PENDING',
        },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'A pending invitation for this email already exists in this workspace' },
          { status: 409 }
        )
      }
    }

    const token = generateToken()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000)

    const invitation = await db.invitation.create({
      data: {
        workspaceId: ctx.workspaceId,
        invitedBy: ctx.user.id,
        email,
        username,
        token,
        role,
        status: 'PENDING',
        message,
        expiresAt,
      },
    })

    await writeAuditLog(ctx, 'MEMBER_INVITE', 'Invitation', invitation.id, {
      email,
      username,
      role,
      expiresInHours,
      token,
    })

    return NextResponse.json({ success: true, invitation: serializeInvitation(invitation) })
  } catch (e) {
    console.error('[community/invitations POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── DELETE /api/community/invitations?id={invitationId} ───────────────────
// Revokes a PENDING invitation.
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
    const invitationId = searchParams.get('id')
    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation id is required' }, { status: 400 })
    }

    const invitation = await db.invitation.findFirst({
      where: { id: invitationId, workspaceId: ctx.workspaceId },
    })
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }
    if (invitation.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending invitations can be revoked' }, { status: 400 })
    }

    const now = new Date()
    await db.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'REVOKED',
        revokedAt: now,
        revokedBy: ctx.user.id,
      },
    })

    await writeAuditLog(ctx, 'INVITATION_REVOKE', 'Invitation', invitation.id, {
      email: invitation.email,
      username: invitation.username,
      role: invitation.role,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[community/invitations DELETE] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
