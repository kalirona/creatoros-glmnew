import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

// ─── GET — paginated AiLog list with filters ──────────────────────────────
// Filters: ?page=&pageSize=&providerId=&status=&toolSlug=&routeCategory=
//          &requestType=&from=&to=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '50')))
    const providerId = searchParams.get('providerId') || undefined
    const status = searchParams.get('status') || undefined
    const toolSlug = searchParams.get('toolSlug') || undefined
    const routeCategory = searchParams.get('routeCategory') || undefined
    const requestType = searchParams.get('requestType') || undefined
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Record<string, unknown> = {}
    if (providerId) where.providerId = providerId
    if (status) where.status = status
    if (toolSlug) where.toolSlug = toolSlug
    if (routeCategory) where.routeCategory = routeCategory
    if (requestType) where.requestType = requestType

    const createdAt: Record<string, Date> = {}
    if (from) {
      const fd = new Date(from)
      if (!isNaN(fd.getTime())) createdAt.gte = fd
    }
    if (to) {
      const td = new Date(to)
      if (!isNaN(td.getTime())) createdAt.lte = td
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt

    const [logs, total] = await Promise.all([
      db.aiLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          provider: { select: { id: true, name: true, slug: true } },
        },
      }),
      db.aiLog.count({ where }),
    ])

    // Batch-fetch users for these logs
    const userIds = [...new Set(logs.map((l) => l.userId))]
    const users = userIds.length
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))

    const logsWithUser = logs.map((l) => ({
      ...l,
      user: userMap.get(l.userId) || null,
    }))

    return NextResponse.json({
      logs: logsWithUser,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e) {
    console.error('[admin/logs GET]', e)
    return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 })
  }
}
