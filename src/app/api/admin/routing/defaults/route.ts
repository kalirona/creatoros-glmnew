import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ROUTE_CATEGORIES, type ProviderSlug } from '@/lib/provider-gateway'
import { updateRouteFailover } from '@/lib/provider-gateway/failover'

export const dynamic = 'force-dynamic'

// ─── GET — return all default routing rules (one per route category) ───────
// For each category in ROUTE_CATEGORIES, look up the AiRoute (if exists) and
// return primary/fallback provider info + strategy + isActive.
export async function GET() {
  try {
    const categories = ROUTE_CATEGORIES

    // Fetch all routes in one query
    const routes = await db.aiRoute.findMany({
      include: {
        provider: { select: { id: true, slug: true, name: true } },
        fallbackProvider: { select: { id: true, slug: true, name: true } },
      },
    })
    const routeMap = new Map(routes.map((r) => [r.toolCategory, r]))

    const result = categories.map((cat) => {
      const route = routeMap.get(cat.id)
      return {
        category: cat.id,
        label: cat.label,
        description: cat.description,
        modality: cat.modality,
        primaryProviderId: route?.provider?.id || null,
        primaryProviderSlug: route?.provider?.slug || null,
        primaryProviderName: route?.provider?.name || null,
        fallbackProviderId: route?.fallbackProvider?.id || null,
        fallbackProviderSlug: route?.fallbackProvider?.slug || null,
        fallbackProviderName: route?.fallbackProvider?.name || null,
        strategy: route?.strategy || 'smart',
        isActive: route?.isActive ?? false,
      }
    })

    return NextResponse.json({ defaults: result })
  } catch (e) {
    console.error('[admin/routing/defaults GET]', e)
    return NextResponse.json({ error: 'Failed to load default routes' }, { status: 500 })
  }
}

// ─── POST — update the default provider for a route category ───────────────
// Body: { category, primaryProviderSlug, fallbackProviderSlug? }
// Calls updateRouteFailover(category, primarySlug, fallbackSlug) which:
//   - Upserts the AiRoute record
//   - Invalidates the route cache
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { category, primaryProviderSlug, fallbackProviderSlug } = body as {
      category?: string
      primaryProviderSlug?: string
      fallbackProviderSlug?: string
    }

    if (!category || typeof category !== 'string') {
      return NextResponse.json({ error: 'category required' }, { status: 400 })
    }
    if (!primaryProviderSlug || typeof primaryProviderSlug !== 'string') {
      return NextResponse.json({ error: 'primaryProviderSlug required' }, { status: 400 })
    }

    // Validate category is in the registry
    const validCategory = ROUTE_CATEGORIES.find((c) => c.id === category)
    if (!validCategory) {
      return NextResponse.json(
        { error: `Unknown category: ${category}` },
        { status: 400 }
      )
    }

    // Validate primary provider exists
    const primary = await db.aiProvider.findUnique({
      where: { slug: primaryProviderSlug },
      select: { id: true, slug: true },
    })
    if (!primary) {
      return NextResponse.json(
        { error: `Provider '${primaryProviderSlug}' not found` },
        { status: 404 }
      )
    }

    // Validate fallback provider if provided
    if (fallbackProviderSlug && fallbackProviderSlug !== primaryProviderSlug) {
      const fallback = await db.aiProvider.findUnique({
        where: { slug: fallbackProviderSlug },
        select: { id: true },
      })
      if (!fallback) {
        return NextResponse.json(
          { error: `Fallback provider '${fallbackProviderSlug}' not found` },
          { status: 404 }
        )
      }
    }

    await updateRouteFailover(
      category,
      primaryProviderSlug as ProviderSlug,
      fallbackProviderSlug ? (fallbackProviderSlug as ProviderSlug) : undefined,
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[admin/routing/defaults POST]', e)
    return NextResponse.json({ error: 'Failed to update default route' }, { status: 500 })
  }
}
