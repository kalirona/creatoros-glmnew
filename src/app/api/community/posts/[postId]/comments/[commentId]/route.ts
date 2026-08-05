import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  sanitizeString,
  canModerate,
  safeJsonParse,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

// Recursively count a comment's descendants (BFS via parentId) within the post.
async function countDescendants(commentId: string, postId: string): Promise<number> {
  let count = 0
  let currentLevel: string[] = [commentId]
  while (currentLevel.length > 0) {
    const replies = await db.communityComment.findMany({
      where: { postId, parentId: { in: currentLevel } },
      select: { id: true },
    })
    count += replies.length
    currentLevel = replies.map((r) => r.id)
  }
  return count
}

// ─── PATCH /api/community/posts/[postId]/comments/[commentId] ──────────────
// Body: { content } — author only. Sets isEdited=true. Returns updated comment.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, commentId } = await params

    const existing = await db.communityComment.findFirst({
      where: { id: commentId, postId },
      include: { post: { select: { workspaceId: true } } },
    })
    if (!existing || existing.post.workspaceId !== ctx.workspaceId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    if (existing.userId !== ctx.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const content = sanitizeString(
      typeof b.content === 'string' ? b.content : '',
      10000
    )
    if (!content) {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 })
    }

    const updated = await db.communityComment.update({
      where: { id: commentId },
      data: { content, isEdited: true },
    })

    await writeAuditLog(ctx, 'COMMENT_EDIT', 'CommunityComment', commentId, {
      postId,
    })

    return NextResponse.json({
      success: true,
      comment: {
        id: updated.id,
        postId: updated.postId,
        parentId: updated.parentId,
        content: updated.content,
        isEdited: updated.isEdited,
        mentions: safeJsonParse<string[]>(updated.mentions, []),
        attachments: safeJsonParse<unknown[]>(updated.attachments, []),
        updatedAt: updated.updatedAt,
      },
    })
  } catch (e) {
    console.error('[community/posts/[postId]/comments/[commentId] PATCH] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── DELETE /api/community/posts/[postId]/comments/[commentId] ─────────────
// Author or moderator. Cascade-deletes replies. Decrements post.commentsCount
// by (1 + descendant count).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, commentId } = await params

    const existing = await db.communityComment.findFirst({
      where: { id: commentId, postId },
      include: { post: { select: { workspaceId: true } } },
    })
    if (!existing || existing.post.workspaceId !== ctx.workspaceId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const isAuthor = existing.userId === ctx.user.id
    const moderator = canModerate(ctx.workspaceRole)
    if (!isAuthor && !moderator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const descendantCount = await countDescendants(commentId, postId)
    const removedTotal = descendantCount + 1

    // Cascade delete (replies handled via onDelete: Cascade).
    await db.communityComment.delete({ where: { id: commentId } })

    // Decrement post.commentsCount + author's commentsCount.
    await db.$transaction([
      db.communityPost.update({
        where: { id: postId },
        data: { commentsCount: { decrement: removedTotal } },
      }),
      db.workspaceMember.updateMany({
        where: { userId: existing.userId, workspaceId: ctx.workspaceId },
        data: { commentsCount: { decrement: 1 } },
      }),
    ])

    await writeAuditLog(ctx, 'COMMENT_DELETE', 'CommunityComment', commentId, {
      postId,
      removedTotal,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[community/posts/[postId]/comments/[commentId] DELETE] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
