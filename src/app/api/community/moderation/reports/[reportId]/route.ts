import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  canModerate,
  writeAuditLog,
  sendNotification,
  sanitizeString,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── Target fetcher ─────────────────────────────────────────────────────────
async function fetchTargetFull(
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
    return { title: post.title, content: post.content, preview: post.content.slice(0, 280) }
  }
  if (targetType === 'COMMENT') {
    const comment = await db.communityComment.findFirst({
      where: { id: targetId, post: { workspaceId } },
      select: { id: true, content: true },
    })
    if (!comment) return null
    return { content: comment.content, preview: comment.content.slice(0, 280) }
  }
  if (targetType === 'EVENT') {
    const event = await db.communityEvent.findFirst({
      where: { id: targetId, workspaceId },
      select: { id: true, title: true, description: true },
    })
    if (!event) return null
    return { title: event.title, content: event.description, preview: event.description.slice(0, 280) }
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

// ─── GET /api/community/moderation/reports/[reportId] ───────────────────────
// Requires: canModerate. Returns full report with target + reporter + resolver.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canModerate(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { reportId } = await params

    const report = await db.moderationReport.findFirst({
      where: { id: reportId, workspaceId: ctx.workspaceId },
    })
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Resolve reporter + resolver users (no relation fields on the model).
    const [reporter, resolver] = await Promise.all([
      db.user.findUnique({
        where: { id: report.reporterId },
        select: { id: true, name: true, avatarUrl: true },
      }),
      report.resolvedBy
        ? db.user.findUnique({
            where: { id: report.resolvedBy },
            select: { id: true, name: true, avatarUrl: true },
          })
        : Promise.resolve(null),
    ])

    const target = await fetchTargetFull(ctx.workspaceId, report.targetType, report.targetId)

    return NextResponse.json({
      report: {
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        description: report.description,
        status: report.status,
        resolution: report.resolution,
        createdAt: report.createdAt,
        resolvedAt: report.resolvedAt,
        reporter: reporter
          ? { id: reporter.id, name: reporter.name, avatarUrl: reporter.avatarUrl }
          : null,
        resolver: resolver
          ? { id: resolver.id, name: resolver.name, avatarUrl: resolver.avatarUrl }
          : null,
        target,
      },
    })
  } catch (e) {
    console.error('[community/moderation/reports/[reportId] GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── PATCH /api/community/moderation/reports/[reportId] ─────────────────────
// Body: { status: 'RESOLVED'|'DISMISSED', resolution? }
// Requires: canModerate. If RESOLVED, resolution required.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canModerate(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { reportId } = await params

    const report = await db.moderationReport.findFirst({
      where: { id: reportId, workspaceId: ctx.workspaceId },
    })
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const status = typeof b.status === 'string' ? b.status : ''
    if (!['RESOLVED', 'DISMISSED'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be RESOLVED or DISMISSED' },
        { status: 400 }
      )
    }

    const resolution = sanitizeString(
      typeof b.resolution === 'string' ? b.resolution : '',
      2000
    )
    if (status === 'RESOLVED' && !resolution) {
      return NextResponse.json(
        { error: 'resolution is required when status is RESOLVED' },
        { status: 400 }
      )
    }

    const updated = await db.moderationReport.update({
      where: { id: report.id },
      data: {
        status,
        resolution: resolution || null,
        resolvedBy: ctx.user.id,
        resolvedAt: new Date(),
      },
    })

    const auditAction = status === 'RESOLVED' ? 'REPORT_RESOLVE' : 'REPORT_DISMISS'
    await writeAuditLog(ctx, auditAction, report.targetType, report.targetId, {
      reportId: report.id,
      reason: report.reason,
      resolution: updated.resolution,
    })

    // Notify the reporter.
    await sendNotification(
      report.reporterId,
      ctx.workspaceId,
      'SYSTEM',
      status === 'RESOLVED'
        ? 'Your report has been resolved'
        : 'Your report has been dismissed',
      status === 'RESOLVED'
        ? `A moderator resolved your report (${report.reason}). Resolution: ${resolution}`
        : `A moderator dismissed your report (${report.reason}).`,
      ctx.user.id,
      report.id,
      'ModerationReport'
    )

    return NextResponse.json({
      success: true,
      report: {
        id: updated.id,
        status: updated.status,
        resolution: updated.resolution,
        resolvedBy: updated.resolvedBy,
        resolvedAt: updated.resolvedAt,
      },
    })
  } catch (e) {
    console.error('[community/moderation/reports/[reportId] PATCH] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
