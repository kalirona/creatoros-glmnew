import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  sendNotification,
  canManageMembers,
  canActOnMember,
  sanitizeString,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'WARNING', 'HIGH', 'CRITICAL']

// ─── POST /api/community/members/[memberId]/warn ───────────────────────────
// Body: { reason, severity? }
export async function POST(
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
      return NextResponse.json({ error: 'Cannot warn the workspace owner' }, { status: 403 })
    }

    const check = canActOnMember(ctx.workspaceRole, target.role, 'warn')
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason || 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const reason = sanitizeString(typeof b.reason === 'string' ? b.reason : '', 1000)
    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    }

    const severity =
      typeof b.severity === 'string' && VALID_SEVERITIES.includes(b.severity.toUpperCase())
        ? b.severity.toUpperCase()
        : 'WARNING'

    const warning = await db.memberWarning.create({
      data: {
        memberId: target.id,
        workspaceId: ctx.workspaceId,
        issuedBy: ctx.user.id,
        reason,
        severity,
      },
    })

    await sendNotification(
      target.userId,
      ctx.workspaceId,
      'WARNING',
      `You have received a ${severity} warning`,
      `Reason: ${reason}`,
      ctx.user.id,
      warning.id,
      'MemberWarning'
    )

    await writeAuditLog(ctx, 'MEMBER_WARN', 'WorkspaceMember', target.id, {
      warningId: warning.id,
      reason,
      severity,
      userId: target.userId,
    })

    return NextResponse.json({
      success: true,
      warning: {
        id: warning.id,
        memberId: warning.memberId,
        reason: warning.reason,
        severity: warning.severity,
        acknowledged: warning.acknowledged,
        createdAt: warning.createdAt,
      },
    })
  } catch (e) {
    console.error('[community/members/[memberId]/warn POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
