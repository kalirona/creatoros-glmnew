import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, sendNotification } from '@/lib/community'

export const dynamic = 'force-dynamic'

const VALID_REACTIONS = ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'] as const
type ReactionType = (typeof VALID_REACTIONS)[number]

type ReactionsMap = Record<string, { count: number; users: string[] }>

// ─── POST /api/community/posts/[postId]/react ──────────────────────────────
// Body: { type: 'LIKE'|'LOVE'|'HAHA'|'WOW'|'SAD'|'ANGRY' }
// Toggles the user's reaction of the given type. If user had a different
// reaction, it is replaced (removed first, then the new one added).
// Reactions stored in `reactions` JSON as { TYPE: { count, users: [userId,...] } }.
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

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const type = typeof b.type === 'string' ? b.type : ''
    if (!VALID_REACTIONS.includes(type as ReactionType)) {
      return NextResponse.json(
        { error: 'Invalid reaction type' },
        { status: 400 }
      )
    }
    const reactionType = type as ReactionType

    const post = await db.communityPost.findFirst({
      where: { id: postId, workspaceId: ctx.workspaceId },
      select: { id: true, userId: true, reactions: true },
    })
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Parse current reactions map.
    let reactions: ReactionsMap = {}
    try {
      reactions = post.reactions ? (JSON.parse(post.reactions) as ReactionsMap) : {}
    } catch {
      reactions = {}
    }

    // Remove any prior reaction by this user across all types.
    for (const t of Object.keys(reactions)) {
      const entry = reactions[t]
      if (!entry) continue
      const idx = entry.users.indexOf(ctx.user.id)
      if (idx >= 0) {
        entry.users.splice(idx, 1)
        entry.count = entry.users.length
        if (entry.count === 0) delete reactions[t]
        if (t === reactionType) {
          // User toggled OFF this exact reaction — stop here.
          await db.communityPost.update({
            where: { id: postId },
            data: { reactions: JSON.stringify(reactions) },
          })
          return NextResponse.json({ success: true, reactions, reacted: false })
        }
      }
    }

    // Add the new reaction.
    const entry = reactions[reactionType] || { count: 0, users: [] }
    if (!entry.users.includes(ctx.user.id)) {
      entry.users.push(ctx.user.id)
      entry.count = entry.users.length
    }
    reactions[reactionType] = entry

    await db.communityPost.update({
      where: { id: postId },
      data: { reactions: JSON.stringify(reactions) },
    })

    // Notify post author (skip if self-reacted).
    if (post.userId && post.userId !== ctx.user.id) {
      await sendNotification(
        post.userId,
        ctx.workspaceId,
        'REACTION',
        'New reaction on your post',
        `${ctx.user.name} reacted with ${reactionType} to your post`,
        ctx.user.id,
        postId,
        'CommunityPost'
      )
    }

    return NextResponse.json({ success: true, reactions, reacted: true })
  } catch (e) {
    console.error('[community/posts/[postId]/react POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
