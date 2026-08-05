import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  sanitizeString,
  paginate,
  canModerate,
  sendNotification,
  safeJsonParse,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

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

// Recursively serialize a comment + its replies.
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

// Prisma include chain for 3 levels of nested replies (top-level + 3 deep).
const NESTED_REPLIES_INCLUDE = {
  user: true,
  replies: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      user: true,
      replies: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          user: true,
          replies: {
            orderBy: { createdAt: 'asc' as const },
            include: { user: true },
          },
        },
      },
    },
  },
}

// ─── GET /api/community/posts/[postId]/comments ────────────────────────────
// Query: ?page=1&pageSize=50
// Returns top-level comments (parentId=null) paginated, each with replies up
// to 3 levels nested, all with author info.
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
      select: { id: true, commentsCount: true },
    })
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? '1') || 1
    const pageSize = Number(searchParams.get('pageSize') ?? '50') || 50

    const where = { postId, parentId: null }
    const total = await db.communityComment.count({ where })
    const { skip, take, page: safePage, pageSize: safeSize, totalPages } = paginate(
      page,
      pageSize,
      total
    )

    const comments = await db.communityComment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip,
      take,
      // Prisma include chain (3 levels of nested replies).
      include: NESTED_REPLIES_INCLUDE,
    })

    return NextResponse.json({
      comments: comments.map((c) => serializeComment(c as CommentRow)),
      total,
      page: safePage,
      pageSize: safeSize,
      totalPages,
    })
  } catch (e) {
    console.error('[community/posts/[postId]/comments GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── POST /api/community/posts/[postId]/comments ───────────────────────────
// Body: { content, parentId?, attachments?, mentions? }
// - If parentId, validate parent belongs to the same post.
// - If post is locked, only moderators can comment.
// - Increments post.commentsCount + author's WorkspaceMember.commentsCount.
// - Sends COMMENT notification to post author (if not self) and REPLY
//   notification to parent comment author (if parentId and not self).
export async function POST(
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
      select: { id: true, userId: true, isLocked: true, isArchived: true, title: true },
    })
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    if (post.isArchived) {
      return NextResponse.json(
        { error: 'Cannot comment on an archived post' },
        { status: 400 }
      )
    }
    if (post.isLocked && !canModerate(ctx.workspaceRole)) {
      return NextResponse.json(
        { error: 'Post is locked; only moderators can comment' },
        { status: 403 }
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const content = sanitizeString(typeof b.content === 'string' ? b.content : '', 10000)
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    let parentId: string | null = null
    let parentAuthorId: string | null = null
    if (b.parentId && typeof b.parentId === 'string') {
      const parent = await db.communityComment.findFirst({
        where: { id: b.parentId, postId },
        select: { id: true, userId: true },
      })
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent comment not found in this post' },
          { status: 404 }
        )
      }
      parentId = parent.id
      parentAuthorId = parent.userId
    }

    const mentions = Array.isArray(b.mentions)
      ? b.mentions.filter((m): m is string => typeof m === 'string')
      : []
    const attachments = Array.isArray(b.attachments) ? b.attachments : []

    const comment = await db.communityComment.create({
      data: {
        postId,
        parentId,
        userId: ctx.user.id,
        content,
        mentions: JSON.stringify(mentions),
        attachments: JSON.stringify(attachments),
      },
    })

    // Increment post.commentsCount + author's commentsCount atomically.
    await db.$transaction([
      db.communityPost.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      }),
      db.workspaceMember.update({
        where: { id: ctx.memberId },
        data: { commentsCount: { increment: 1 } },
      }),
    ])

    await writeAuditLog(ctx, 'COMMENT_CREATE', 'CommunityComment', comment.id, {
      postId,
      parentId,
    })

    // Notify post author (skip if self-commenting).
    if (post.userId && post.userId !== ctx.user.id) {
      await sendNotification(
        post.userId,
        ctx.workspaceId,
        'COMMENT',
        'New comment on your post',
        `${ctx.user.name} commented on "${post.title}"`,
        ctx.user.id,
        comment.id,
        'CommunityComment'
      )
    }

    // Notify parent comment author (skip if self-replying).
    if (parentAuthorId && parentAuthorId !== ctx.user.id) {
      await sendNotification(
        parentAuthorId,
        ctx.workspaceId,
        'REPLY',
        'New reply to your comment',
        `${ctx.user.name} replied to your comment`,
        ctx.user.id,
        comment.id,
        'CommunityComment'
      )
    }

    return NextResponse.json({ success: true, comment: { id: comment.id } })
  } catch (e) {
    console.error('[community/posts/[postId]/comments POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
