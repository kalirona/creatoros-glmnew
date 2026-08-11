import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateRouteCache } from '@/lib/ai-engine'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

const ALLOWED_CATEGORIES = [
  'WRITING', 'MARKETING', 'COURSE', 'WEBSITE', 'SEO', 'EMAIL',
  'BLOG', 'CRM', 'AUTOMATION', 'IMAGE', 'VIDEO', 'VOICE', 'STT', 'EMBEDDING',
]

const ALLOWED_STRATEGIES = ['smart', 'cost', 'quality', 'round_robin']

// ─── GET — list all routes with provider + fallback provider names ────────
export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const routes = await db.aiRoute.findMany({
      include: {
        provider: { select: { id: true, name: true, slug: true, isActive: true } },
        fallbackProvider: { select: { id: true, name: true, slug: true, isActive: true } },
      },
      orderBy: { toolCategory: 'asc' },
    })

    // Fetch the model display name for any modelId overrides
    const modelIds = routes.map((r) => r.modelId).filter(Boolean) as string[]
    const models = modelIds.length
      ? await db.aiModel.findMany({
          where: { id: { in: modelIds } },
          select: { id: true, name: true, displayName: true, modality: true },
        })
      : []
    const modelMap = new Map(models.map((m) => [m.id, m]))

    const result = routes.map((r) => ({
      ...r,
      model: r.modelId ? modelMap.get(r.modelId) || null : null,
    }))

    return NextResponse.json({ routes: result })
  } catch (e) {
    console.error('[admin/routing GET]', e)
    return NextResponse.json({ error: 'Failed to load routes' }, { status: 500 })
  }
}

// ─── PUT — update a route ──────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const {
      id, providerId, fallbackProviderId, modelId, strategy, weight, isActive,
    } = body as Record<string, unknown>

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const existing = await db.aiRoute.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Route not found' }, { status: 404 })

    if (strategy !== undefined && !ALLOWED_STRATEGIES.includes(String(strategy))) {
      return NextResponse.json(
        { error: `strategy must be one of: ${ALLOWED_STRATEGIES.join(', ')}` },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}
    if (providerId !== undefined) data.providerId = providerId
    if (fallbackProviderId !== undefined) data.fallbackProviderId = fallbackProviderId || null
    if (modelId !== undefined) data.modelId = modelId || null
    if (strategy !== undefined) data.strategy = strategy
    if (weight !== undefined) data.weight = Number(weight)
    if (isActive !== undefined) data.isActive = !!isActive

    const route = await db.aiRoute.update({
      where: { id },
      data,
      include: {
        provider: { select: { id: true, name: true, slug: true } },
        fallbackProvider: { select: { id: true, name: true, slug: true } },
      },
    })

    invalidateRouteCache()

    return NextResponse.json({ success: true, route })
  } catch (e) {
    console.error('[admin/routing PUT]', e)
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 })
  }
}

// ─── POST — create a new route ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const toolCategory = typeof body?.toolCategory === 'string' ? body.toolCategory : ''
    const providerId = typeof body?.providerId === 'string' ? body.providerId : ''
    const fallbackProviderId =
      typeof body?.fallbackProviderId === 'string' && body.fallbackProviderId
        ? body.fallbackProviderId
        : null
    const modelId =
      typeof body?.modelId === 'string' && body.modelId ? body.modelId : null
    const strategy =
      typeof body?.strategy === 'string' && body.strategy ? body.strategy : 'smart'
    const weight = body?.weight !== undefined ? Number(body.weight) : 100
    const isActive = body?.isActive !== undefined ? !!body.isActive : true

    if (!toolCategory) {
      return NextResponse.json({ error: 'toolCategory required' }, { status: 400 })
    }
    if (!ALLOWED_CATEGORIES.includes(toolCategory)) {
      return NextResponse.json(
        { error: `toolCategory must be one of: ${ALLOWED_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }
    if (!providerId) {
      return NextResponse.json({ error: 'providerId required' }, { status: 400 })
    }
    if (!ALLOWED_STRATEGIES.includes(strategy)) {
      return NextResponse.json(
        { error: `strategy must be one of: ${ALLOWED_STRATEGIES.join(', ')}` },
        { status: 400 }
      )
    }

    const provider = await db.aiProvider.findUnique({ where: { id: providerId } })
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

    if (fallbackProviderId) {
      const fb = await db.aiProvider.findUnique({ where: { id: fallbackProviderId } })
      if (!fb) return NextResponse.json({ error: 'Fallback provider not found' }, { status: 400 })
    }

    // Enforce uniqueness on toolCategory
    const existing = await db.aiRoute.findUnique({ where: { toolCategory } })
    if (existing) {
      return NextResponse.json(
        { error: `Route for category '${toolCategory}' already exists` },
        { status: 400 }
      )
    }

    const route = await db.aiRoute.create({
      data: {
        toolCategory,
        providerId,
        fallbackProviderId,
        modelId,
        strategy,
        weight,
        isActive,
      },
      include: {
        provider: { select: { id: true, name: true, slug: true } },
        fallbackProvider: { select: { id: true, name: true, slug: true } },
      },
    })

    invalidateRouteCache()

    return NextResponse.json({ success: true, route })
  } catch (e) {
    console.error('[admin/routing POST]', e)
    return NextResponse.json({ error: 'Failed to create route' }, { status: 500 })
  }
}
