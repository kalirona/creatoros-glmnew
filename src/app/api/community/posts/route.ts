import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  sanitizeString,
  paginate,
  safeJsonParse,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

// Serializes a raw post row (with user + space included) into the API shape.
function serializePost(p: {
  id: string
  workspaceId: string
  spaceId: string | null
  userId: string
  category: string
  postType: string
  title: string
  content: string
  likesCount: number
  commentsCount: number
  isPinned: boolean
  isLocked: boolean
  isArchived: boolean
  isEdited: boolean
  editCount: number
  hashtags: string
  mentions: string
  pollOptions: string
  attachments: string
  reactions: string
  createdAt: Date
  updatedAt: Date
  user?: { id: string; name: string; avatarUrl: string | null } | null
  space?: { id: string; name: string } | null
}) {
  return {
    id: p.id,
    workspaceId: p.workspaceId,
    spaceId: p.spaceId,
    userId: p.userId,
    category: p.category,
    postType: p.postType,
    title: p.title,
    content: p.content,
    likesCount: p.likesCount,
    commentsCount: p.commentsCount,
    isPinned: p.isPinned,
    isLocked: p.isLocked,
    isArchived: p.isArchived,
    isEdited: p.isEdited,
    editCount: p.editCount,
    hashtags: safeJsonParse<string[]>(p.hashtags, []),
    mentions: safeJsonParse<string[]>(p.mentions, []),
    pollOptions: safeJsonParse<unknown[]>(p.pollOptions, []),
    attachments: safeJsonParse<unknown[]>(p.attachments, []),
    reactions: safeJsonParse<Record<string, { count: number; users: string[] }>>(p.reactions, {}),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    author: p.user
      ? { id: p.user.id, name: p.user.name, avatarUrl: p.user.avatarUrl }
      : null,
    space: p.space ? { id: p.space.id, name: p.space.name } : null,
  }
}

// ─── GET /api/community/posts ──────────────────────────────────────────────
// Query: ?page=&pageSize=&spaceId=&category=&postType=&search=&sort=recent|top|pinned
//        &includeArchived=true
// Returns: { posts, total, page, pageSize, totalPages }
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? '1') || 1
    const pageSize = Number(searchParams.get('pageSize') ?? '20') || 20
    const spaceId = searchParams.get('spaceId') || undefined
    const category = searchParams.get('category') || undefined
    const postType = searchParams.get('postType') || undefined
    const search = searchParams.get('search')?.trim() || undefined
    const sort = searchParams.get('sort') || 'recent'
    const includeArchived = searchParams.get('includeArchived') === 'true'

    const where: {
      workspaceId: string
      isArchived?: boolean
      spaceId?: string
      category?: string
      postType?: string
      OR?: Array<{ title: { contains: string } } | { content: { contains: string } }>
    } = { workspaceId: ctx.workspaceId }
    if (!includeArchived) where.isArchived = false
    if (spaceId) where.spaceId = spaceId
    if (category) where.category = category
    if (postType) where.postType = postType
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ]
    }

    let orderBy:
      | { createdAt: 'desc' }
      | { likesCount: 'desc' }
      | Array<{ isPinned: 'desc' } | { createdAt: 'desc' }>
    if (sort === 'top') {
      orderBy = { likesCount: 'desc' }
    } else if (sort === 'pinned') {
      orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }]
    } else {
      orderBy = { createdAt: 'desc' }
    }

    const total = await db.communityPost.count({ where })
    const { skip, take, page: safePage, pageSize: safeSize, totalPages } = paginate(
      page,
      pageSize,
      total
    )

    const posts = await db.communityPost.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        user: true,
        space: true,
      },
    })

    return NextResponse.json({
      posts: posts.map(serializePost),
      total,
      page: safePage,
      pageSize: safeSize,
      totalPages,
    })
  } catch (e) {
    console.error('[community/posts GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── POST /api/community/posts ─────────────────────────────────────────────
// Body: { title, content, category?, postType?, spaceId?, attachments?,
//         pollOptions?, mentions?, hashtags? }
export async function POST(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const title = sanitizeString(typeof b.title === 'string' ? b.title : '', 200)
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be 200 characters or less' },
        { status: 400 }
      )
    }

    const content = sanitizeString(typeof b.content === 'string' ? b.content : '', 50000)
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const category =
      sanitizeString(typeof b.category === 'string' ? b.category : '', 50) ||
      'General'

    const postType = ['POST', 'ANNOUNCEMENT', 'QUESTION', 'POLL', 'MEDIA'].includes(
      typeof b.postType === 'string' ? b.postType : ''
    )
      ? (b.postType as string)
      : 'POST'

    // Validate spaceId belongs to the workspace
    let spaceId: string | null = null
    if (b.spaceId && typeof b.spaceId === 'string') {
      const space = await db.communitySpace.findFirst({
        where: {
          id: b.spaceId,
          workspaceId: ctx.workspaceId,
          status: 'ACTIVE',
        },
        select: { id: true },
      })
      if (!space) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 })
      }
      spaceId = space.id
    }

    // Auto-extract hashtags from content (#word) + merge user-provided ones.
    const autoTags = Array.from(
      new Set(
        (content.match(/#(\w+)/g) || []).map((t) => t.slice(1).toLowerCase())
      )
    )
    const userTags = Array.isArray(b.hashtags)
      ? b.hashtags
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.toLowerCase())
      : []
    const hashtags = Array.from(new Set([...userTags, ...autoTags]))

    const mentions = Array.isArray(b.mentions)
      ? b.mentions.filter((m): m is string => typeof m === 'string')
      : []
    const attachments = Array.isArray(b.attachments) ? b.attachments : []
    const pollOptions = Array.isArray(b.pollOptions) ? b.pollOptions : []

    const post = await db.communityPost.create({
      data: {
        workspaceId: ctx.workspaceId,
        spaceId,
        userId: ctx.user.id,
        category,
        postType,
        title,
        content,
        hashtags: JSON.stringify(hashtags),
        mentions: JSON.stringify(mentions),
        pollOptions: JSON.stringify(pollOptions),
        attachments: JSON.stringify(attachments),
        reactions: JSON.stringify({}),
      },
    })

    // Increment author's postsCount + (optionally) space.postCount.
    await db.$transaction([
      db.workspaceMember.update({
        where: { id: ctx.memberId },
        data: { postsCount: { increment: 1 } },
      }),
      ...(spaceId
        ? [
            db.communitySpace.update({
              where: { id: spaceId },
              data: { postCount: { increment: 1 } },
            }),
          ]
        : []),
    ])

    await writeAuditLog(ctx, 'POST_CREATE', 'CommunityPost', post.id, {
      title: post.title,
      category: post.category,
      postType: post.postType,
      spaceId: post.spaceId,
    })

    return NextResponse.json({ success: true, post: { id: post.id } })
  } catch (e) {
    console.error('[community/posts POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
