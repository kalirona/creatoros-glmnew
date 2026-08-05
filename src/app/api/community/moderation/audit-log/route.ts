import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, canManageMembers, paginate, safeJsonParse } from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── GET /api/community/moderation/audit-log ────────────────────────────────
// Query: ?page=1&pageSize=50&action=&actorId=
// Requires: canManageMembers (OWNER/ADMIN only). Returns paginated audit logs.
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canManageMembers(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? '1') || 1
    const pageSize = Number(searchParams.get('pageSize') ?? '50') || 50
    const action = searchParams.get('action') || undefined
    const actorId = searchParams.get('actorId') || undefined

    const where: {
      workspaceId: string
      action?: string
      actorId?: string
    } = { workspaceId: ctx.workspaceId }
    if (action) where.action = action
    if (actorId) where.actorId = actorId

    const total = await db.auditLog.count({ where })
    const { skip, take, page: safePage, pageSize: safeSize, totalPages } = paginate(
      page,
      pageSize,
      total
    )

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    })

    // Resolve actor users in a single batch.
    const actorIds = Array.from(new Set(logs.map((l) => l.actorId)))
    const actors =
      actorIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, avatarUrl: true, role: true },
          })
        : []
    const actorMap = new Map(actors.map((u) => [u.id, u]))

    const out = logs.map((l) => {
      const actor = actorMap.get(l.actorId)
      return {
        id: l.id,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        metadata: safeJsonParse<unknown>(l.metadata, {}),
        ip: l.ip,
        createdAt: l.createdAt,
        actor: actor
          ? {
              id: actor.id,
              name: actor.name,
              avatarUrl: actor.avatarUrl,
              role: actor.role,
            }
          : null,
      }
    })

    return NextResponse.json({
      logs: out,
      total,
      page: safePage,
      pageSize: safeSize,
      totalPages,
    })
  } catch (e) {
    console.error('[community/moderation/audit-log GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
