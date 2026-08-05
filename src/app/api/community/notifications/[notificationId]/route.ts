import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext } from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── PATCH /api/community/notifications/[notificationId] ────────────────────
// Body: { read: boolean }. Notification must belong to ctx.user.id.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notificationId } = await params

    const existing = await db.notification.findFirst({
      where: {
        id: notificationId,
        userId: ctx.user.id,
        workspaceId: ctx.workspaceId,
      },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    if (typeof b.read !== 'boolean') {
      return NextResponse.json(
        { error: 'read must be a boolean' },
        { status: 400 }
      )
    }

    const updated = await db.notification.update({
      where: { id: existing.id },
      data: { read: b.read },
    })

    return NextResponse.json({
      success: true,
      notification: {
        id: updated.id,
        read: updated.read,
      },
    })
  } catch (e) {
    console.error('[community/notifications/[notificationId] PATCH] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── DELETE /api/community/notifications/[notificationId] ───────────────────
// Notification must belong to ctx.user.id.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notificationId } = await params

    const existing = await db.notification.findFirst({
      where: {
        id: notificationId,
        userId: ctx.user.id,
        workspaceId: ctx.workspaceId,
      },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    await db.notification.delete({ where: { id: existing.id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[community/notifications/[notificationId] DELETE] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
