import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

// ─── GET — cost analytics ─────────────────────────────────────────────────
export async function GET() {
  try {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const start30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [todayAgg, monthAgg, dailyCosts, perProviderTodayCosts, providers] = await Promise.all([
      // Today's total cost
      db.aiCost.aggregate({
        where: { day: startOfToday },
        _sum: { totalCostUsd: true, requests: true, failures: true },
      }),
      // This month's total cost
      db.aiCost.aggregate({
        where: { day: { gte: startOfMonth } },
        _sum: { totalCostUsd: true, requests: true, failures: true },
      }),
      // Last 30 days daily series (sorted asc)
      db.aiCost.findMany({
        where: { day: { gte: start30DaysAgo } },
        orderBy: { day: 'asc' },
        select: {
          day: true,
          totalCostUsd: true,
          requests: true,
          failures: true,
        },
      }),
      // Per-provider breakdown for today
      db.aiCost.groupBy({
        by: ['providerId'],
        where: { day: startOfToday },
        _sum: { totalCostUsd: true, requests: true, failures: true },
      }),
      // All providers (for budget threshold check)
      db.aiProvider.findMany({
        select: {
          id: true, name: true, slug: true,
          dailyBudget: true, isActive: true, isHealthy: true,
        },
      }),
    ])

    // Aggregate daily series: there can be multiple provider rows per day, so group them
    const dayMap = new Map<string, { day: string; totalCostUsd: number; requests: number; failures: number }>()
    for (const d of dailyCosts) {
      const dayKey = d.day.toISOString().slice(0, 10)
      const existing = dayMap.get(dayKey) || {
        day: dayKey,
        totalCostUsd: 0,
        requests: 0,
        failures: 0,
      }
      existing.totalCostUsd += d.totalCostUsd
      existing.requests += d.requests
      existing.failures += d.failures
      dayMap.set(dayKey, existing)
    }
    const dailySeries = [...dayMap.values()].sort((a, b) =>
      a.day < b.day ? -1 : a.day > b.day ? 1 : 0
    )

    // Per-provider breakdown — enrich with provider names
    const providerMap = new Map(providers.map((p) => [p.id, p]))
    const perProviderBreakdown = perProviderTodayCosts.map((s) => {
      const p = providerMap.get(s.providerId)
      const todayCost = s._sum.totalCostUsd || 0
      const dailyBudget = p?.dailyBudget || 0
      return {
        providerId: s.providerId,
        name: p?.name || 'Unknown',
        slug: p?.slug || 'unknown',
        todayCost,
        todayRequests: s._sum.requests || 0,
        todayFailures: s._sum.failures || 0,
        dailyBudget,
        budgetExceeded: dailyBudget > 0 && todayCost >= dailyBudget,
      }
    })

    // Budget alerts — include providers with no today's cost but with dailyBudget set
    const budgetAlerts: Array<{
      providerId: string
      name: string
      slug: string
      level: 'warning' | 'critical'
      todayCost: number
      dailyBudget: number
      message: string
    }> = []

    // For critical alerts, also fetch auto-disabled flag from today's AiCost rows
    const todayCostRows = await db.aiCost.findMany({
      where: { day: startOfToday },
      select: { providerId: true, autoDisabled: true, budgetExceeded: true },
    })
    const todayCostRowMap = new Map(todayCostRows.map((r) => [r.providerId, r]))

    for (const p of providers) {
      const todayCost = perProviderBreakdown.find((x) => x.providerId === p.id)?.todayCost || 0
      const costRow = todayCostRowMap.get(p.id)

      if (costRow?.autoDisabled) {
        budgetAlerts.push({
          providerId: p.id,
          name: p.name,
          slug: p.slug,
          level: 'critical',
          todayCost,
          dailyBudget: p.dailyBudget,
          message: 'Provider auto-disabled due to budget exceed',
        })
      } else if (p.dailyBudget > 0 && todayCost >= p.dailyBudget * 0.8) {
        budgetAlerts.push({
          providerId: p.id,
          name: p.name,
          slug: p.slug,
          level: 'warning',
          todayCost,
          dailyBudget: p.dailyBudget,
          message: `Daily budget ${todayCost >= p.dailyBudget ? 'exceeded' : '80% consumed'} (${Math.round((todayCost / p.dailyBudget) * 100)}%)`,
        })
      }
    }

    return NextResponse.json({
      today: {
        totalCostUsd: todayAgg._sum.totalCostUsd || 0,
        requests: todayAgg._sum.requests || 0,
        failures: todayAgg._sum.failures || 0,
      },
      thisMonth: {
        totalCostUsd: monthAgg._sum.totalCostUsd || 0,
        requests: monthAgg._sum.requests || 0,
        failures: monthAgg._sum.failures || 0,
      },
      dailySeries,
      perProviderBreakdown,
      budgetAlerts,
    })
  } catch (e) {
    console.error('[admin/costs GET]', e)
    return NextResponse.json({ error: 'Failed to load cost analytics' }, { status: 500 })
  }
}
