import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, writeAuditLog, canModerate } from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── POST /api/community/posts/[postId]/archive ────────────────────────────
// Toggles isArchived. Moderator-only. Writes POST_ARCHIVE / POST_RESTORE audit.
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
      select: { id: true, isArchived: true, title: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const next = !existing.isArchived
    await db.communityPost.update({
      where: { id: postId },
      data: { isArchived: next },
    })

    await writeAuditLog(
      ctx,
      next ? 'POST_ARCHIVE' : 'POST_RESTORE',
      'CommunityPost',
      postId,
      { title: existing.title, isArchived: next }
    )

    return NextResponse.json({ success: true, isArchived: next })
  } catch (e) {
    console.error('[community/posts/[postId]/archive POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
