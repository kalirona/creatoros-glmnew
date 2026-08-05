import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  sendNotification,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── POST /api/community/transfer-ownership ────────────────────────────────
// Body: { targetMemberId }
// Atomically: demote current owner to ADMIN, promote target to OWNER.
export async function POST(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (ctx.workspaceRole !== 'OWNER') {
      return NextResponse.json({ error: 'Only the workspace owner can transfer ownership' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const targetMemberId =
      typeof b.targetMemberId === 'string' ? b.targetMemberId.trim() : ''
    if (!targetMemberId) {
      return NextResponse.json({ error: 'targetMemberId is required' }, { status: 400 })
    }

    if (targetMemberId === ctx.memberId) {
      return NextResponse.json({ error: 'Cannot transfer ownership to yourself' }, { status: 400 })
    }

    const target = await db.workspaceMember.findFirst({
      where: { id: targetMemberId, workspaceId: ctx.workspaceId },
      include: { user: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'Target member not found' }, { status: 404 })
    }

    if (target.role === 'OWNER') {
      return NextResponse.json({ error: 'Target is already the owner' }, { status: 400 })
    }

    // Atomically demote current owner → ADMIN, promote target → OWNER.
    // If the target wasn't ADMIN, they are promoted directly to OWNER.
    await db.$transaction([
      db.workspaceMember.update({
        where: { id: ctx.memberId },
        data: { role: 'ADMIN' },
      }),
      db.workspaceMember.update({
        where: { id: target.id },
        data: { role: 'OWNER' },
      }),
    ])

    await writeAuditLog(ctx, 'OWNERSHIP_TRANSFER', 'WorkspaceMember', target.id, {
      fromOwnerId: ctx.user.id,
      fromOwnerMemberId: ctx.memberId,
      toOwnerId: target.userId,
      toOwnerMemberId: target.id,
      previousTargetRole: target.role,
    })

    // Notify both parties + all workspace members.
    await sendNotification(
      ctx.user.id,
      ctx.workspaceId,
      'SYSTEM',
      'You are no longer the workspace owner',
      `Workspace ownership has been transferred to ${target.user.name}. You are now an ADMIN.`,
      ctx.user.id,
      target.id,
      'WorkspaceMember'
    )
    await sendNotification(
      target.userId,
      ctx.workspaceId,
      'SYSTEM',
      'You are now the workspace owner',
      `You have been granted ownership of this workspace by ${ctx.user.name}.`,
      ctx.user.id,
      target.id,
      'WorkspaceMember'
    )

    const allMembers = await db.workspaceMember.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        userId: { notIn: [ctx.user.id, target.userId] },
      },
      select: { userId: true },
    })
    await Promise.all(
      allMembers.map((m) =>
        sendNotification(
          m.userId,
          ctx.workspaceId,
          'SYSTEM',
          'Workspace ownership has changed',
          `${target.user.name} is now the owner of this workspace.`,
          ctx.user.id,
          target.id,
          'WorkspaceMember'
        )
      )
    )

    return NextResponse.json({
      success: true,
      newOwnerId: target.userId,
      newOwnerMemberId: target.id,
    })
  } catch (e) {
    console.error('[community/transfer-ownership POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
