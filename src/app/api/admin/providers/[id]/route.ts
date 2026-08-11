import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maskApiKey, invalidateRouteCache } from '@/lib/ai-engine'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

const ALLOWED_AUTH_TYPES = ['bearer', 'x-api-key', 'custom-header', 'query-param']

// ─── Helpers ────────────────────────────────────────────────────────────────
function safeJsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

// ─── GET — single provider detail (with models, masked keys, routes, logs) ─
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { id } = await ctx.params

    const provider = await db.aiProvider.findUnique({
      where: { id },
      include: {
        models: { orderBy: { modality: 'asc' } },
        keys: { orderBy: { createdAt: 'desc' } },
        routes: { include: { provider: { select: { id: true, name: true } } } },
        fallbackRoutes: { include: { provider: { select: { id: true, name: true } } } },
      },
    })

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

    const [todayCostAgg, recentLogs] = await Promise.all([
      db.aiCost.aggregate({
        where: { providerId: id, day: startOfToday },
        _sum: { totalCostUsd: true, requests: true, failures: true },
        _count: true,
      }),
      db.aiLog.findMany({
        where: { providerId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          requestType: true,
          toolSlug: true,
          durationMs: true,
          costUsd: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
    ])

    return NextResponse.json({
      provider: {
        ...provider,
        apiKey: undefined, // never expose plain text
        maskedApiKey: maskApiKey(provider.apiKey),
        // Parsed JSON fields
        headers: safeJsonParse<Record<string, string>>(provider.headers, {}),
        // New gateway fields are already on the provider object (authType, logoUrl,
        // providerVersion, lastSyncAt, quotaRemaining, latencyMs, defaultStrategy)
        keys: provider.keys.map((k) => ({
          ...k,
          keyValue: undefined, // never expose plain text
          maskedValue: k.maskedValue || maskApiKey(k.keyValue),
        })),
        models: provider.models.map((m) => ({
          ...m,
          providerTags: safeJsonParse<string[]>(m.providerTags, []),
        })),
        todayCost: todayCostAgg._sum.totalCostUsd || 0,
        todayRequests: todayCostAgg._sum.requests || 0,
        todayFailures: todayCostAgg._sum.failures || 0,
        recentLogs,
      },
    })
  } catch (e) {
    console.error('[admin/providers/[id] GET]', e)
    return NextResponse.json({ error: 'Failed to load provider' }, { status: 500 })
  }
}

// ─── PATCH — update provider (path-param version of PUT) ───────────────────
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { id } = await ctx.params
    const updates = await req.json()

    const allowed = [
      'name', 'apiKey', 'baseUrl', 'webhookSecret',
      'isActive', 'isHealthy', 'priority', 'capabilities',
      'dailyBudget', 'monthlyBudget', 'dailyRequests', 'monthlyRequests',
      'timeout', 'retries', 'concurrency', 'fallbackProviderId',
      'description', 'docsUrl',
      // New gateway fields
      'authType', 'headers', 'logoUrl', 'defaultStrategy',
      'providerVersion', 'quotaRemaining', 'latencyMs', 'lastSyncAt', 'lastHealthCheck',
    ]

    const data: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in updates) data[k] = updates[k]
    }

    if (data.authType !== undefined && !ALLOWED_AUTH_TYPES.includes(String(data.authType))) {
      return NextResponse.json(
        { error: `authType must be one of: ${ALLOWED_AUTH_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Coerce headers (object → JSON string) for storage
    if (data.headers !== undefined) {
      if (typeof data.headers === 'string') {
        try { JSON.parse(data.headers) } catch {
          return NextResponse.json({ error: 'headers must be valid JSON' }, { status: 400 })
        }
      } else if (typeof data.headers === 'object' && data.headers !== null) {
        data.headers = JSON.stringify(data.headers)
      } else if (data.headers === null) {
        data.headers = '{}'
      }
    }

    const numericInt = ['priority', 'dailyRequests', 'monthlyRequests', 'timeout', 'retries', 'concurrency', 'latencyMs']
    const numericFloat = ['dailyBudget', 'monthlyBudget']
    for (const k of numericInt) if (k in data) data[k] = Number(data[k])
    for (const k of numericFloat) if (k in data) data[k] = Number(data[k])

    // Make sure provider exists
    const existing = await db.aiProvider.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

    const provider = await db.aiProvider.update({ where: { id }, data })

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
    console.error('[admin/providers/[id] PATCH]', e)
    return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 })
  }
}

// ─── DELETE — soft delete (set isActive=false) ─────────────────────────────
// Refuses to disable the last active provider for any capability it serves.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { id } = await ctx.params

    const provider = await db.aiProvider.findUnique({ where: { id } })
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

    if (provider.isActive) {
      const caps = provider.capabilities
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)

      // For each capability, count other active providers that also have it.
      for (const cap of caps) {
        const otherActive = await db.aiProvider.count({
          where: {
            isActive: true,
            id: { not: id },
            capabilities: { contains: cap },
          },
        })
        if (otherActive === 0) {
          return NextResponse.json(
            { error: `Cannot disable — this is the last active provider with the ${cap} capability` },
            { status: 400 }
          )
        }
      }
    }

    const updated = await db.aiProvider.update({
      where: { id },
      data: { isActive: false },
    })

    invalidateRouteCache()

    return NextResponse.json({
      success: true,
      provider: { ...updated, maskedApiKey: maskApiKey(updated.apiKey) },
    })
  } catch (e) {
    console.error('[admin/providers/[id] DELETE]', e)
    return NextResponse.json({ error: 'Failed to disable provider' }, { status: 500 })
  }
}
