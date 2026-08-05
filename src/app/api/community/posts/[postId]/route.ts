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

// Serializes a comment row (with nested replies + user) into the API shape.
// `replies` is included recursively when present.
type CommentRow = {
  id: string
  postId: string
  parentId: string | null
  userId: string
  content: string
  likesCount: number
  isEdited: boolean
  mentions: string
  attachments: string
  createdAt: Date
  updatedAt: Date
  user: { id: string; name: string; avatarUrl: string | null }
  replies?: CommentRow[]
}

function serializeComment(c: CommentRow) {
  return {
    id: c.id,
    postId: c.postId,
    parentId: c.parentId,
    userId: c.userId,
    content: c.content,
    likesCount: c.likesCount,
    isEdited: c.isEdited,
    mentions: safeJsonParse<string[]>(c.mentions, []),
    attachments: safeJsonParse<unknown[]>(c.attachments, []),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    author: c.user
      ? { id: c.user.id, name: c.user.name, avatarUrl: c.user.avatarUrl }
      : null,
    replies: (c.replies || []).map(serializeComment),
  }
}

// ─── GET /api/community/posts/[postId] ─────────────────────────────────────
// Returns full post + top-level comments (parentId=null) with nested replies
// up to 3 levels deep, plus author info.
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

    const post = await db.communityPost.findFirst({
      where: { id: postId, workspaceId: ctx.workspaceId },
      include: {
        user: true,
        space: true,
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            user: true,
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: true,
                replies: {
                  orderBy: { createdAt: 'asc' },
                  include: {
                    user: true,
                    replies: {
                      orderBy: { createdAt: 'asc' },
                      include: { user: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const serialized: Record<string, unknown> = {
      id: post.id,
      workspaceId: post.workspaceId,
      spaceId: post.spaceId,
      userId: post.userId,
      category: post.category,
      postType: post.postType,
      title: post.title,
      content: post.content,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      isArchived: post.isArchived,
      isEdited: post.isEdited,
      editCount: post.editCount,
      hashtags: safeJsonParse<string[]>(post.hashtags, []),
      mentions: safeJsonParse<string[]>(post.mentions, []),
      pollOptions: safeJsonParse<unknown[]>(post.pollOptions, []),
      attachments: safeJsonParse<unknown[]>(post.attachments, []),
      reactions: safeJsonParse<Record<string, { count: number; users: string[] }>>(
        post.reactions,
        {}
      ),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.user
        ? {
            id: post.user.id,
            name: post.user.name,
            avatarUrl: post.user.avatarUrl,
          }
        : null,
      space: post.space ? { id: post.space.id, name: post.space.name } : null,
      comments: post.comments.map((c) => serializeComment(c as CommentRow)),
    }

    return NextResponse.json({ post: serialized })
  } catch (e) {
    console.error('[community/posts/[postId] GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── PATCH /api/community/posts/[postId] ───────────────────────────────────
// Body: { title?, content?, category?, attachments? } — author or moderator only.
// Saves the CURRENT state to PostHistory BEFORE updating.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params

    const existing = await db.communityPost.findFirst({
      where: { id: postId, workspaceId: ctx.workspaceId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const isAuthor = existing.userId === ctx.user.id
    const moderator = canModerate(ctx.workspaceRole)
    if (!isAuthor && !moderator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const data: {
      title?: string
      content?: string
      category?: string
      attachments?: string
    } = {}

    if (typeof b.title === 'string') {
      const title = sanitizeString(b.title, 200)
      if (!title) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      data.title = title
    }
    if (typeof b.content === 'string') {
      const content = sanitizeString(b.content, 50000)
      if (!content) {
        return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 })
      }
      data.content = content
    }
    if (typeof b.category === 'string') {
      data.category = sanitizeString(b.category, 50) || existing.category
    }
    if (Array.isArray(b.attachments)) {
      data.attachments = JSON.stringify(b.attachments)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Snapshot current state to PostHistory BEFORE applying changes.
    await db.postHistory.create({
      data: {
        postId: existing.id,
        editedBy: ctx.user.id,
        title: existing.title,
        content: existing.content,
        version: existing.editCount + 1,
      },
    })

    const updated = await db.communityPost.update({
      where: { id: postId },
      data: {
        ...data,
        isEdited: true,
        editCount: { increment: 1 },
      },
    })

    await writeAuditLog(ctx, 'POST_EDIT', 'CommunityPost', postId, {
      before: { title: existing.title, content: existing.content, category: existing.category },
      after: { title: updated.title, content: updated.content, category: updated.category },
      version: existing.editCount + 1,
    })

    return NextResponse.json({
      success: true,
      post: {
        id: updated.id,
        title: updated.title,
        content: updated.content,
        category: updated.category,
        attachments: safeJsonParse<unknown[]>(updated.attachments, []),
        isEdited: updated.isEdited,
        editCount: updated.editCount,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (e) {
    console.error('[community/posts/[postId] PATCH] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── DELETE /api/community/posts/[postId] ──────────────────────────────────
// Author or moderator. Comments + history cascade-deleted via schema.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await params

    const existing = await db.communityPost.findFirst({
      where: { id: postId, workspaceId: ctx.workspaceId },
      select: { id: true, userId: true, spaceId: true, title: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const isAuthor = existing.userId === ctx.user.id
    const moderator = canModerate(ctx.workspaceRole)
    if (!isAuthor && !moderator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cascade delete (comments + history) is handled by Prisma onDelete: Cascade.
    await db.communityPost.delete({ where: { id: postId } })

    // Decrement author's postsCount + space.postCount (if applicable).
    await db.$transaction([
      db.workspaceMember.updateMany({
        where: { userId: existing.userId, workspaceId: ctx.workspaceId },
        data: { postsCount: { decrement: 1 } },
      }),
      ...(existing.spaceId
        ? [
            db.communitySpace.update({
              where: { id: existing.spaceId },
              data: { postCount: { decrement: 1 } },
            }),
          ]
        : []),
    ])

    await writeAuditLog(ctx, 'POST_DELETE', 'CommunityPost', postId, {
      title: existing.title,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[community/posts/[postId] DELETE] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
