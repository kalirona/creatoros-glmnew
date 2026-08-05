import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  canManageMembers,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── POST /api/community/invitations/[invitationId]/resend ─────────────────
// Only PENDING. Refreshes expiresAt to now + 7 days.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageMembers(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { invitationId } = await params

    const invitation = await db.invitation.findFirst({
      where: { id: invitationId, workspaceId: ctx.workspaceId },
    })
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }
    if (invitation.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending invitations can be resent' }, { status: 400 })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    await db.invitation.update({
      where: { id: invitation.id },
      data: { expiresAt },
    })

    await writeAuditLog(ctx, 'INVITATION_RESEND', 'Invitation', invitation.id, {
      email: invitation.email,
      username: invitation.username,
      role: invitation.role,
      expiresAt,
    })

    return NextResponse.json({ success: true, expiresAt })
  } catch (e) {
    console.error('[community/invitations/[invitationId]/resend POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
