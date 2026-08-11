import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

// ─── GET — list AiJobs with pagination + filter + queue stats ─────────────
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '20')))
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type

    const [jobs, total, stats] = await Promise.all([
      db.aiJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          provider: { select: { id: true, name: true, slug: true } },
        },
      }),
      db.aiJob.count({ where }),
      // Queue stats — for today
      (async () => {
        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        const grouped = await db.aiJob.groupBy({
          by: ['status'],
          where: { createdAt: { gte: startOfToday } },
          _count: true,
        })
        const map: Record<string, number> = {}
        for (const g of grouped) map[g.status] = g._count
        return {
          queued: map['QUEUED'] || 0,
          rendering: map['RENDERING'] || 0,
          processing: map['PROCESSING'] || 0,
          completed: map['COMPLETED'] || 0,
          failed: map['FAILED'] || 0,
          cancelled: map['CANCELLED'] || 0,
          totalToday: Object.values(map).reduce((s, n) => s + n, 0),
        }
      })(),
    ])

    // Batch-fetch users for these jobs
    const userIds = [...new Set(jobs.map((j) => j.userId))]
    const users = userIds.length
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))

    const jobsWithUser = jobs.map((j) => ({
      ...j,
      user: userMap.get(j.userId) || null,
    }))

    return NextResponse.json({
      jobs: jobsWithUser,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats,
    })
  } catch (e) {
    console.error('[admin/jobs GET]', e)
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 })
  }
}
