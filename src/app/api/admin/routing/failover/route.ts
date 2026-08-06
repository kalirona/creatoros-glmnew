import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { type ProviderSlug } from '@/lib/provider-gateway'
import { DEFAULT_FAILOVER_CHAINS, getFailoverChain, updateRouteFailover } from '@/lib/provider-gateway/failover'

export const dynamic = 'force-dynamic'

// ─── GET — return all failover chains (enriched with provider names) ───────
// Returns one chain per route category, listing all providers in priority order
// with their isActive/isHealthy status.
export async function GET() {
  try {
    const providers = await db.aiProvider.findMany({
      select: { id: true, slug: true, name: true, isActive: true, isHealthy: true },
    })
    const providerMap = new Map(providers.map((p) => [p.slug, p]))

    const categories = Object.keys(DEFAULT_FAILOVER_CHAINS)
    const chains = categories.map((routeCategory) => {
      const slugs = DEFAULT_FAILOVER_CHAINS[routeCategory] || []
      const chain = slugs.map((slug) => {
        const provider = providerMap.get(slug)
        return {
          slug,
          name: provider?.name || slug,
          isActive: provider?.isActive ?? false,
          isHealthy: provider?.isHealthy ?? false,
        }
      })
      return { routeCategory, chain }
    })

    return NextResponse.json({ chains })
  } catch (e) {
    console.error('[admin/routing/failover GET]', e)
    return NextResponse.json({ error: 'Failed to load failover chains' }, { status: 500 })
  }
}

// ─── POST — update the failover chain for a category ───────────────────────
// Body: { category, chain: string[] }  (array of provider slugs in priority order)
// For now we update the primary + first fallback via updateRouteFailover. The
// rest of the chain uses DEFAULT_FAILOVER_CHAINS.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { category, chain } = body as { category?: string; chain?: string[] }

    if (!category || typeof category !== 'string') {
      return NextResponse.json({ error: 'category required' }, { status: 400 })
    }
    if (!Array.isArray(chain) || chain.length === 0) {
      return NextResponse.json(
        { error: 'chain must be a non-empty array of provider slugs' },
        { status: 400 }
      )
    }

    // Validate all slugs exist as providers
    const providers = await db.aiProvider.findMany({
      where: { slug: { in: chain } },
      select: { slug: true },
    })
    const existingSlugs = new Set(providers.map((p) => p.slug))
    const missing = chain.filter((s) => !existingSlugs.has(s))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Providers not found: ${missing.join(', ')}` },
        { status: 404 }
      )
    }

    const primarySlug = chain[0] as ProviderSlug
    const fallbackSlug = chain[1] ? (chain[1] as ProviderSlug) : undefined

    await updateRouteFailover(category, primarySlug, fallbackSlug)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[admin/routing/failover POST]', e)
    return NextResponse.json({ error: 'Failed to update failover chain' }, { status: 500 })
  }
}
