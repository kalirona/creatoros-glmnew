import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maskApiKey, invalidateRouteCache } from '@/lib/ai-engine'
import { PROVIDER_REGISTRY } from '@/lib/provider-gateway'
export const dynamic = 'force-dynamic'

// ─── Helpers ────────────────────────────────────────────────────────────────
function safeJsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

const ALLOWED_AUTH_TYPES = ['bearer', 'x-api-key', 'custom-header', 'query-param']

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
        // New gateway fields
        authType: p.authType,
        headers: safeJsonParse<Record<string, string>>(p.headers, {}),
        logoUrl: p.logoUrl,
        providerVersion: p.providerVersion,
        lastSyncAt: p.lastSyncAt,
        quotaRemaining: p.quotaRemaining,
        latencyMs: p.latencyMs,
        defaultStrategy: p.defaultStrategy,
        baseUrl: p.baseUrl,
        timeout: p.timeout,
        retries: p.retries,
        concurrency: p.concurrency,
        fallbackProviderId: p.fallbackProviderId,
        webhookSecret: p.webhookSecret,
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
          contextWindow: m.contextWindow,
          isActive: m.isActive,
          // New capability flags
          supportsVision: m.supportsVision,
          supportsImage: m.supportsImage,
          supportsAudio: m.supportsAudio,
          supportsVideo: m.supportsVideo,
          supportsEmbeddings: m.supportsEmbeddings,
          supportsStreaming: m.supportsStreaming,
          supportsJson: m.supportsJson,
          supportsToolCalling: m.supportsToolCalling,
          supportsReasoning: m.supportsReasoning,
          providerTags: safeJsonParse<string[]>(m.providerTags, []),
          isCustomPricing: m.isCustomPricing,
          lastSyncedAt: m.lastSyncedAt,
        })),
      }
    })

    return NextResponse.json({ providers: result })
  } catch (e) {
    console.error('[admin/providers GET]', e)
    return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 })
  }
}

// ─── POST — create a new provider (for "Add Custom Provider" flow) ──────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      slug, name, baseUrl, authType, headers, capabilities, description,
    } = body as Record<string, unknown>

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'slug required' }, { status: 400 })
    }
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }

    // Look up default metadata for known slugs
    const meta = PROVIDER_REGISTRY.find((p) => p.slug === slug)
    const finalName = name || meta?.name || slug
    const finalBaseUrl = typeof baseUrl === 'string' && baseUrl
      ? baseUrl
      : (meta?.defaultBaseUrl || '')
    const finalAuthType = typeof authType === 'string' && ALLOWED_AUTH_TYPES.includes(authType)
      ? authType
      : (meta?.authType || 'bearer')
    const finalCapabilities = typeof capabilities === 'string' && capabilities
      ? capabilities
      : (meta?.capabilities?.join(',') || 'TEXT')
    const finalDescription = typeof description === 'string' && description
      ? description
      : (meta?.description || '')
    const finalDocsUrl = meta?.docsUrl || ''
    const finalLogoUrl = meta?.logoUrl || ''

    // Headers — accept object or JSON string; stored as JSON string in DB
    let headersStr = '{}'
    if (headers) {
      if (typeof headers === 'string') {
        // Validate JSON
        try { JSON.parse(headers); headersStr = headers } catch {
          return NextResponse.json({ error: 'headers must be valid JSON' }, { status: 400 })
        }
      } else if (typeof headers === 'object') {
        headersStr = JSON.stringify(headers)
      }
    }

    // Uniqueness checks
    const existingByName = await db.aiProvider.findUnique({ where: { name: finalName } })
    if (existingByName) {
      return NextResponse.json({ error: `Provider with name '${finalName}' already exists` }, { status: 400 })
    }
    const existingBySlug = await db.aiProvider.findUnique({ where: { slug } })
    if (existingBySlug) {
      return NextResponse.json({ error: `Provider with slug '${slug}' already exists` }, { status: 400 })
    }

    // Determine priority — append to end
    const maxPriority = await db.aiProvider.aggregate({ _max: { priority: true } })
    const priority = (maxPriority._max.priority || 10) + 1

    const provider = await db.aiProvider.create({
      data: {
        slug,
        name: finalName,
        baseUrl: finalBaseUrl,
        authType: finalAuthType,
        headers: headersStr,
        capabilities: finalCapabilities,
        description: finalDescription,
        docsUrl: finalDocsUrl,
        logoUrl: finalLogoUrl,
        defaultStrategy: 'balanced',
        priority,
        isActive: true,
      },
    })

    invalidateRouteCache()

    return NextResponse.json({
      success: true,
      provider: { ...provider, maskedApiKey: maskApiKey(provider.apiKey) },
    })
  } catch (e) {
    console.error('[admin/providers POST]', e)
    return NextResponse.json({ error: 'Failed to create provider' }, { status: 500 })
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
      // New gateway fields
      'authType', 'headers', 'logoUrl', 'defaultStrategy',
    ]

    const data: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in updates) data[k] = updates[k]
    }

    // Validate authType
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


