import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { getContext } from '@/lib/community'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const ctx = await getContext()
    if (!ctx) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

    const [posts, spaces, events, members] = await Promise.all([
      db.communityPost.findMany({
        where: { workspaceId: ctx.workspaceId, isArchived: false },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          space: { select: { id: true, name: true } },
        },
      }),
      db.communitySpace.findMany({
        where: { workspaceId: ctx.workspaceId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      }),
      db.communityEvent.findMany({
        where: { workspaceId: ctx.workspaceId, status: { not: 'CANCELLED' } },
        orderBy: { startTime: 'asc' },
        include: {
          _count: { select: { rsvps: true } },
          rsvps: { where: { userId: ctx.user.id }, select: { status: true } },
        },
      }),
      db.workspaceMember.count({ where: { workspaceId: ctx.workspaceId } }),
    ])

    return NextResponse.json({
      stats: {
        totalPosts: posts.length,
        totalSpaces: spaces.length,
        totalEvents: events.length,
        totalMembers: members,
      },
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        category: p.category,
        postType: p.postType,
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
        isPinned: p.isPinned,
        isLocked: p.isLocked,
        isArchived: p.isArchived,
        isEdited: p.isEdited,
        createdAt: p.createdAt,
        author: p.user.name,
        authorId: p.user.id,
        authorAvatar: p.user.avatarUrl,
        space: p.space ? { id: p.space.id, name: p.space.name } : null,
        hashtags: JSON.parse(p.hashtags || '[]'),
        mentions: JSON.parse(p.mentions || '[]'),
        attachments: JSON.parse(p.attachments || '[]'),
        reactions: JSON.parse(p.reactions || '{}'),
      })),
      spaces: spaces.map((s) => ({
        id: s.id, name: s.name, slug: s.slug, description: s.description,
        memberCount: s.memberCount, postCount: s.postCount, visibility: s.visibility,
      })),
      events: events.map((e) => ({
        id: e.id, title: e.title, description: e.description, type: e.type,
        location: e.location, meetingUrl: e.meetingUrl,
        startTime: e.startTime, endTime: e.endTime, status: e.status,
        attendeeCount: e._count.rsvps, userRsvp: e.rsvps[0]?.status || null,
      })),
    })
  } catch (e) {
    console.error('Community error:', e)
    return NextResponse.json({ error: 'Failed to load community data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const ctx = await getContext()
    if (!ctx) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

    const body = await req.json()
    const { title, content, category, spaceId } = body
    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

    // Extract hashtags
    const hashtags = Array.from(new Set((content.match(/#(\w+)/g) || []).map((h) => h.slice(1).toLowerCase()))).slice(0, 30)

    const post = await db.communityPost.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.user.id,
        spaceId: spaceId || null,
        title: title.trim(),
        content: content.trim(),
        category: category || 'General',
        hashtags: JSON.stringify(hashtags),
      },
      include: { user: { select: { name: true, avatarUrl: true } } },
    })

    // Increment author's post count
    await db.workspaceMember.update({
      where: { id: ctx.memberId },
      data: { postsCount: { increment: 1 } },
    })

    // Increment space post count if applicable
    if (spaceId) {
      await db.communitySpace.update({
        where: { id: spaceId },
        data: { postCount: { increment: 1 } },
      })
    }

    return NextResponse.json({
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category,
      likesCount: 0,
      commentsCount: 0,
      isPinned: false,
      createdAt: post.createdAt,
      author: post.user.name,
      authorAvatar: post.user.avatarUrl,
    })
  } catch (e) {
    console.error('Community create error:', e)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
