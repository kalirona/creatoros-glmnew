import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  canModerate,
  writeAuditLog,
  sanitizeString,
  paginate,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

const VALID_TARGET_TYPES = ['POST', 'COMMENT', 'USER', 'EVENT']
const VALID_REASONS = ['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'VIOLENCE', 'NSFW', 'OTHER']

// ─── Target fetcher ─────────────────────────────────────────────────────────
// Returns a small preview object for the report target, or null if not found.
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
    return {
      title: post.title,
      content: post.content,
      preview: post.content.slice(0, 200),
    }
  }
  if (targetType === 'COMMENT') {
    const comment = await db.communityComment.findFirst({
      where: { id: targetId, post: { workspaceId } },
      select: { id: true, content: true },
    })
    if (!comment) return null
    return {
      content: comment.content,
      preview: comment.content.slice(0, 200),
    }
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
    // Target may be a memberId or a userId — match either within the workspace.
    const member = await db.workspaceMember.findFirst({
      where: {
        workspaceId,
        OR: [{ id: targetId }, { userId: targetId }],
      },
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

// Serializes a raw report row into the API shape.
function serializeReport(r: {
  id: string
  targetType: string
  targetId: string
  reason: string
  description: string
  status: string
  resolution: string | null
  createdAt: Date
  resolvedAt: Date | null
  reporterId: string
  resolvedBy: string | null
  reporter?: { id: string; name: string; avatarUrl: string | null } | null
  resolver?: { id: string; name: string; avatarUrl: string | null } | null
}) {
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
    reporter: r.reporter
      ? { id: r.reporter.id, name: r.reporter.name, avatarUrl: r.reporter.avatarUrl }
      : null,
    resolver: r.resolver
      ? { id: r.resolver.id, name: r.resolver.name, avatarUrl: r.resolver.avatarUrl }
      : null,
  }
}

// ─── GET /api/community/moderation/reports ──────────────────────────────────
// Query: ?page=1&pageSize=20&status=PENDING&targetType=&reason=
// Requires: canModerate. Returns paginated reports + target previews.
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canModerate(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? '1') || 1
    const pageSize = Number(searchParams.get('pageSize') ?? '20') || 20
    const status = searchParams.get('status') || undefined
    const targetType = searchParams.get('targetType') || undefined
    const reason = searchParams.get('reason') || undefined

    const where: {
      workspaceId: string
      status?: string
      targetType?: string
      reason?: string
    } = { workspaceId: ctx.workspaceId }
    if (status) where.status = status
    if (targetType) where.targetType = targetType
    if (reason) where.reason = reason

    const total = await db.moderationReport.count({ where })
    const { skip, take, page: safePage, pageSize: safeSize, totalPages } = paginate(
      page,
      pageSize,
      total
    )

    const reports = await db.moderationReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    })

    // Resolve reporter + resolver users in parallel (no relation fields on the model).
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

    const out = reports.map((r, i) => ({
      ...serializeReport({
        ...r,
        reporter: reporterMap.get(r.reporterId) ?? null,
        resolver: r.resolvedBy ? resolverMap.get(r.resolvedBy) ?? null : null,
      }),
      target: targetsWithPreviews[i],
    }))

    return NextResponse.json({
      reports: out,
      total,
      page: safePage,
      pageSize: safeSize,
      totalPages,
    })
  } catch (e) {
    console.error('[community/moderation/reports GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── POST /api/community/moderation/reports ─────────────────────────────────
// Body: { targetType: 'POST'|'COMMENT'|'USER'|'EVENT', targetId, reason, description? }
// Any workspace member can report. Duplicate (same reporter+target+open status) → 409.
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

    const targetType = typeof b.targetType === 'string' ? b.targetType : ''
    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return NextResponse.json(
        { error: 'Invalid targetType; must be one of POST|COMMENT|USER|EVENT' },
        { status: 400 }
      )
    }

    const targetId = sanitizeString(typeof b.targetId === 'string' ? b.targetId : '', 100)
    if (!targetId) {
      return NextResponse.json({ error: 'targetId is required' }, { status: 400 })
    }

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

    // Validate target exists within the workspace.
    const target = await fetchTargetPreview(ctx.workspaceId, targetType, targetId)
    if (!target) {
      return NextResponse.json({ error: 'Target not found in workspace' }, { status: 404 })
    }

    // Duplicate-report guard: same reporter + same target + open status.
    const existing = await db.moderationReport.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        reporterId: ctx.user.id,
        targetType,
        targetId,
        status: { in: ['PENDING', 'REVIEWING'] },
      },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'You have already reported this target and the report is still open' },
        { status: 409 }
      )
    }

    const report = await db.moderationReport.create({
      data: {
        workspaceId: ctx.workspaceId,
        reporterId: ctx.user.id,
        targetType,
        targetId,
        reason,
        description,
        status: 'PENDING',
      },
    })

    await writeAuditLog(ctx, 'REPORT_CREATE', targetType, targetId, {
      reportId: report.id,
      reason,
      description,
    })

    return NextResponse.json({ success: true, report: { id: report.id } })
  } catch (e) {
    console.error('[community/moderation/reports POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
