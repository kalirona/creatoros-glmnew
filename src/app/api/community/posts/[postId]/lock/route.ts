import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, writeAuditLog, canModerate } from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── POST /api/community/posts/[postId]/lock ───────────────────────────────
// Toggles isLocked. Moderator-only. Writes POST_LOCK / POST_UNLOCK audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canModerate(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { postId } = await params

    const existing = await db.communityPost.findFirst({
      where: { id: postId, workspaceId: ctx.workspaceId },
      select: { id: true, isLocked: true, title: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const next = !existing.isLocked
    await db.communityPost.update({
      where: { id: postId },
      data: { isLocked: next },
    })

    await writeAuditLog(
      ctx,
      next ? 'POST_LOCK' : 'POST_UNLOCK',
      'CommunityPost',
      postId,
      { title: existing.title, isLocked: next }
    )

    return NextResponse.json({ success: true, isLocked: next })
  } catch (e) {
    console.error('[community/posts/[postId]/lock POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
