import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  canManageMembers,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── GET /api/community/invitations/[invitationId]/link ────────────────────
// Returns invite link metadata for sharing. Requires canManageMembers.
export async function GET(
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
      select: {
        id: true,
        token: true,
        role: true,
        status: true,
        expiresAt: true,
        workspace: { select: { name: true, slug: true } },
      },
    })
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    return NextResponse.json({
      inviteUrl: `/invite/${invitation.token}`,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      role: invitation.role,
      status: invitation.status,
      workspace: {
        name: invitation.workspace.name,
        slug: invitation.workspace.slug,
      },
    })
  } catch (e) {
    console.error('[community/invitations/[invitationId]/link GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
