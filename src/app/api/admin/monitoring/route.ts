import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

function toNum(b: bigint | null | undefined): number {
  if (b === null || b === undefined) return 0
  return Number(b.toString())
}

// ─── GET — real-time system metrics for Super Admin monitoring dashboard ──
export async function GET() {
  try {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Run all read queries in parallel
    const [
      activeProvidersCount,
      totalProvidersCount,
      todayLogCount,
      todaySuccessCount,
      todayCostAgg,
      todayLatencyAgg,
      perProviderHealthRaw,
      topFailingTools,
      rateLimitedLastHour,
      storageAggRaw,
    ] = await Promise.all([
      db.aiProvider.count({ where: { isActive: true } }),
      db.aiProvider.count(),
      db.aiLog.count({ where: { createdAt: { gte: startOfToday } } }),
      db.aiLog.count({ where: { createdAt: { gte: startOfToday }, status: 'OK' } }),
      db.aiCost.aggregate({
        where: { day: startOfToday },
        _sum: { totalCostUsd: true },
      }),
      db.aiLog.aggregate({
        where: { createdAt: { gte: startOfToday }, durationMs: { gt: 0 } },
        _avg: { durationMs: true },
      }),
      // Per-provider health + today stats
      db.aiProvider.findMany({
        select: {
          id: true, name: true, slug: true, isHealthy: true, lastHealthCheck: true,
        },
        orderBy: { priority: 'asc' },
      }),
      // Top 5 failing tools (status != OK) today
      db.aiLog.groupBy({
        by: ['toolSlug'],
        where: { createdAt: { gte: startOfToday }, status: { not: 'OK' } },
        _count: true,
        orderBy: { _count: { toolSlug: 'desc' } },
        take: 5,
      }),
      // Rate-limited requests in the last hour
      db.aiLog.count({
        where: { status: 'RATE_LIMITED', createdAt: { gte: oneHourAgo } },
      }),
      // Total storage bytes (BigInt) across all workspaces
      db.aiStorage.aggregate({
        _sum: { totalBytes: true },
        _count: true,
      }),
    ])

    // Per-provider today stats (today's cost + requests + failures)
    const todayProviderStats = await db.aiCost.groupBy({
      by: ['providerId'],
      where: { day: startOfToday },
      _sum: { totalCostUsd: true, requests: true, failures: true },
    })
    const providerStatsMap = new Map(
      todayProviderStats.map((s) => [
        s.providerId,
        {
          todayCost: s._sum.totalCostUsd || 0,
          todayRequests: s._sum.requests || 0,
          todayFailures: s._sum.failures || 0,
        },
      ])
    )

    const perProviderHealth = perProviderHealthRaw.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      isHealthy: p.isHealthy,
      lastHealthCheck: p.lastHealthCheck,
      todayCost: providerStatsMap.get(p.id)?.todayCost || 0,
      todayRequests: providerStatsMap.get(p.id)?.todayRequests || 0,
      todayFailures: providerStatsMap.get(p.id)?.todayFailures || 0,
    }))

    const successRate =
      todayLogCount > 0 ? (todaySuccessCount / todayLogCount) * 100 : 100

    return NextResponse.json({
      timestamp: now,
      providers: {
        active: activeProvidersCount,
        total: totalProvidersCount,
      },
      today: {
        requests: todayLogCount,
        successRate: Math.round(successRate * 100) / 100,
        costUsd: todayCostAgg._sum.totalCostUsd || 0,
        avgLatencyMs: todayLatencyAgg._avg.durationMs || 0,
      },
      perProviderHealth,
      topFailingTools: topFailingTools.map((t) => ({
        toolSlug: t.toolSlug,
        count: t._count,
      })),
      rateLimitedLastHour,
      storage: {
        totalBytes: toNum(storageAggRaw._sum.totalBytes),
        workspaceCount: storageAggRaw._count,
      },
    })
  } catch (e) {
    console.error('[admin/monitoring GET]', e)
    return NextResponse.json({ error: 'Failed to load monitoring metrics' }, { status: 500 })
  }
}
