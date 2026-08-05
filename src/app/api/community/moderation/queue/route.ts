import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, canModerate } from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── Target fetcher (preview only) ──────────────────────────────────────────
async function fetchTargetPreview(
  workspaceId: string,
  targetType: string,
  targetId: string
): Promise<{ title?: string; content?: string; preview?: string } | null> {
  if (targetType === 'POST') {
    const post = await db.communityPost.findFirst({
      where: { id: targetId, workspaceId },
      select: { id: true, title: true, content: true },
    })
    if (!post) return null
    return { title: post.title, content: post.content, preview: post.content.slice(0, 200) }
  }
  if (targetType === 'COMMENT') {
    const comment = await db.communityComment.findFirst({
      where: { id: targetId, post: { workspaceId } },
      select: { id: true, content: true },
    })
    if (!comment) return null
    return { content: comment.content, preview: comment.content.slice(0, 200) }
  }
  if (targetType === 'EVENT') {
    const event = await db.communityEvent.findFirst({
      where: { id: targetId, workspaceId },
      select: { id: true, title: true, description: true },
    })
    if (!event) return null
    return {
      title: event.title,
      content: event.description,
      preview: event.description.slice(0, 200),
    }
  }
  if (targetType === 'USER') {
    const member = await db.workspaceMember.findFirst({
      where: { workspaceId, OR: [{ id: targetId }, { userId: targetId }] },
      include: { user: { select: { id: true, name: true } } },
    })
    if (!member) return null
    return {
      title: member.user.name,
      preview: `Member: ${member.user.name} (${member.role})`,
    }
  }
  return null
}

// ─── GET /api/community/moderation/queue ────────────────────────────────────
// Returns: { pending, reviewing, resolvedToday, dismissedToday, items: [...] }
// `items` = reports with status PENDING, limit 20, same shape as reports list.
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canModerate(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Allow optional targetType/reason filters on the queue items list (ignored for counts).
    const { searchParams } = new URL(req.url)
    const targetType = searchParams.get('targetType') || undefined
    const reason = searchParams.get('reason') || undefined

    // Compute "today" boundary once.
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [pending, reviewing, resolvedToday, dismissedToday] = await Promise.all([
      db.moderationReport.count({
        where: { workspaceId: ctx.workspaceId, status: 'PENDING' },
      }),
      db.moderationReport.count({
        where: { workspaceId: ctx.workspaceId, status: 'REVIEWING' },
      }),
      db.moderationReport.count({
        where: {
          workspaceId: ctx.workspaceId,
          status: 'RESOLVED',
          resolvedAt: { gte: startOfDay },
        },
      }),
      db.moderationReport.count({
        where: {
          workspaceId: ctx.workspaceId,
          status: 'DISMISSED',
          resolvedAt: { gte: startOfDay },
        },
      }),
    ])

    // Top 20 pending items, newest first.
    const itemsWhere: {
      workspaceId: string
      status: string
      targetType?: string
      reason?: string
    } = { workspaceId: ctx.workspaceId, status: 'PENDING' }
    if (targetType) itemsWhere.targetType = targetType
    if (reason) itemsWhere.reason = reason

    const reports = await db.moderationReport.findMany({
      where: itemsWhere,
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Resolve reporter + resolver users in a single batch (no relation fields on the model).
    // Prisma findMany with `in: []` returns [] — no need for the conditional fallback.
    const reporterIds = Array.from(new Set(reports.map((r) => r.reporterId)))
    const resolverIds = Array.from(
      new Set(reports.map((r) => r.resolvedBy).filter((x): x is string => !!x))
    )
    const [reporters, resolvers] = await Promise.all([
      db.user.findMany({
        where: { id: { in: reporterIds } },
        select: { id: true, name: true, avatarUrl: true },
      }),
      db.user.findMany({
        where: { id: { in: resolverIds } },
        select: { id: true, name: true, avatarUrl: true },
      }),
    ])
    const reporterMap = new Map(reporters.map((u) => [u.id, u]))
    const resolverMap = new Map(resolvers.map((u) => [u.id, u]))

    const targetsWithPreviews = await Promise.all(
      reports.map((r) => fetchTargetPreview(ctx.workspaceId, r.targetType, r.targetId))
    )

    const items = reports.map((r, i) => {
      const reporter = reporterMap.get(r.reporterId) ?? null
      return {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        description: r.description,
        status: r.status,
        resolution: r.resolution,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        reporter: reporter
          ? { id: reporter.id, name: reporter.name, avatarUrl: reporter.avatarUrl }
          : null,
        resolver: r.resolvedBy
          ? (resolverMap.get(r.resolvedBy) ?? null)
          : null,
        target: targetsWithPreviews[i],
      }
    })

    return NextResponse.json({
      pending,
      reviewing,
      resolvedToday,
      dismissedToday,
      items,
    })
  } catch (e) {
    console.error('[community/moderation/queue GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
