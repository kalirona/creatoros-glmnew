import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext } from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── GET /api/community/notifications/unread-count ──────────────────────────
// Returns: { count } for this user in this workspace.
export async function GET(_req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const count = await db.notification.count({
      where: {
        userId: ctx.user.id,
        workspaceId: ctx.workspaceId,
        read: false,
      },
    })

    return NextResponse.json({ count })
  } catch (e) {
    console.error('[community/notifications/unread-count GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
