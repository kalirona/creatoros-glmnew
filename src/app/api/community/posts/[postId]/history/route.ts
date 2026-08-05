import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext } from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── GET /api/community/posts/[postId]/history ─────────────────────────────
// Returns the edit history (PostHistory rows, newest first) with editor info.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params

    // Verify post belongs to the workspace.
    const post = await db.communityPost.findFirst({
      where: { id: postId, workspaceId: ctx.workspaceId },
      select: { id: true },
    })
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const history = await db.postHistory.findMany({
      where: { postId },
      orderBy: { createdAt: 'desc' },
    })

    // Resolve editor info (PostHistory has no FK relation to User).
    const editorIds = Array.from(new Set(history.map((h) => h.editedBy)))
    const editors = editorIds.length
      ? await db.user.findMany({
          where: { id: { in: editorIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : []
    const editorMap = new Map(editors.map((u) => [u.id, u]))

    return NextResponse.json({
      history: history.map((h) => ({
        id: h.id,
        postId: h.postId,
        title: h.title,
        content: h.content,
        version: h.version,
        createdAt: h.createdAt,
        editor: editorMap.get(h.editedBy) || null,
      })),
    })
  } catch (e) {
    console.error('[community/posts/[postId]/history GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
