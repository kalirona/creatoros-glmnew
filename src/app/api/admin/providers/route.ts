import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maskApiKey, invalidateRouteCache } from '@/lib/ai-engine'
export const dynamic = 'force-dynamic'

// ─── GET — list all providers with masked keys, models, and today's stats ──
export async function GET() {
  try {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

    const providers = await db.aiProvider.findMany({
      include: { models: true, keys: true },
      orderBy: { priority: 'asc' },
    })

    // Fetch today's cost/request/failure aggregations per provider in a single groupBy
    const todayStats = await db.aiCost.groupBy({
      by: ['providerId'],
      where: { day: startOfToday },
      _sum: { totalCostUsd: true, requests: true, failures: true },
    })
    const statsMap = new Map<string, { cost: number; requests: number; failures: number }>()
    for (const s of todayStats) {
      statsMap.set(s.providerId, {
        cost: s._sum.totalCostUsd || 0,
        requests: s._sum.requests || 0,
        failures: s._sum.failures || 0,
      })
    }

    const result = providers.map((p) => {
      const stats = statsMap.get(p.id) || { cost: 0, requests: 0, failures: 0 }
      const activeKeys = p.keys.filter((k) => k.isActive)
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        capabilities: p.capabilities,
        isActive: p.isActive,
        isHealthy: p.isHealthy,
        priority: p.priority,
        dailyBudget: p.dailyBudget,
        monthlyBudget: p.monthlyBudget,
        dailyRequests: p.dailyRequests,
        monthlyRequests: p.monthlyRequests,
        lastHealthCheck: p.lastHealthCheck,
        description: p.description,
        docsUrl: p.docsUrl,
        maskedApiKey: maskApiKey(p.apiKey),
        modelsCount: p.models.length,
        keysCount: p.keys.length,
        activeKeysCount: activeKeys.length,
        // Aggregated today stats
        todayCost: stats.cost,
        todayRequests: stats.requests,
        todayFailures: stats.failures,
        // Models (admin-only — creators never see this)
        models: p.models.map((m) => ({
          id: m.id,
          name: m.name,
          displayName: m.displayName,
          modality: m.modality,
          isDefault: m.isDefault,
          costMultiplier: m.costMultiplier,
          inputCostPer1k: m.inputCostPer1k,
          outputCostPer1k: m.outputCostPer1k,
          isActive: m.isActive,
        })),
      }
    })

    return NextResponse.json({ providers: result })
  } catch (e) {
    console.error('[admin/providers GET]', e)
    return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 })
  }
}

// ─── PUT — update a provider (extended field set + cache bust) ──────────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const allowed = [
      'name', 'apiKey', 'baseUrl', 'webhookSecret',
      'isActive', 'isHealthy', 'priority', 'capabilities',
      'dailyBudget', 'monthlyBudget', 'dailyRequests', 'monthlyRequests',
      'timeout', 'retries', 'concurrency', 'fallbackProviderId',
      'description', 'docsUrl',
    ]

    const data: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in updates) data[k] = updates[k]
    }

    // Coerce numeric fields (SQLite is strict about Int vs Float)
    const numericInt = ['priority', 'dailyRequests', 'monthlyRequests', 'timeout', 'retries', 'concurrency']
    const numericFloat = ['dailyBudget', 'monthlyBudget']
    for (const k of numericInt) if (k in data) data[k] = Number(data[k])
    for (const k of numericFloat) if (k in data) data[k] = Number(data[k])

    const provider = await db.aiProvider.update({ where: { id }, data })

    // If apiKey changed, sync the active AiProviderKey too
    if (typeof updates.apiKey === 'string' && updates.apiKey) {
      const activeKey = await db.aiProviderKey.findFirst({
        where: { providerId: id, isActive: true },
        orderBy: { updatedAt: 'desc' },
      })
      if (activeKey) {
        await db.aiProviderKey.update({
          where: { id: activeKey.id },
          data: { keyValue: updates.apiKey, maskedValue: maskApiKey(updates.apiKey) },
        })
      } else {
        await db.aiProviderKey.create({
          data: {
            providerId: id,
            keyValue: updates.apiKey,
            maskedValue: maskApiKey(updates.apiKey),
            label: 'Primary',
            isActive: true,
          },
        })
      }
    }

    invalidateRouteCache()

    return NextResponse.json({
      success: true,
      provider: { ...provider, maskedApiKey: maskApiKey(provider.apiKey) },
    })
  } catch (e) {
    console.error('[admin/providers PUT]', e)
    return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 })
  }
}
