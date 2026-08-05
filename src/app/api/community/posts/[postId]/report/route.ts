import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, writeAuditLog, sanitizeString } from '@/lib/community'

export const dynamic = 'force-dynamic'

const VALID_REASONS = ['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'VIOLENCE', 'NSFW', 'OTHER']

// ─── POST /api/community/posts/[postId]/report ─────────────────────────────
// Body: { reason, description? } — creates a ModerationReport.
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
      select: { id: true, title: true },
    })
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const reason = typeof b.reason === 'string' ? b.reason : ''
    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid reason; must be one of SPAM|HARASSMENT|HATE_SPEECH|VIOLENCE|NSFW|OTHER' },
        { status: 400 }
      )
    }

    const description = sanitizeString(
      typeof b.description === 'string' ? b.description : '',
      2000
    )

    const report = await db.moderationReport.create({
      data: {
        workspaceId: ctx.workspaceId,
        reporterId: ctx.user.id,
        targetType: 'POST',
        targetId: postId,
        reason,
        description,
        status: 'PENDING',
      },
    })

    await writeAuditLog(ctx, 'POST_REPORT', 'CommunityPost', postId, {
      reportId: report.id,
      reason,
      description,
    })

    return NextResponse.json({ success: true, report: { id: report.id } })
  } catch (e) {
    console.error('[community/posts/[postId]/report POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
