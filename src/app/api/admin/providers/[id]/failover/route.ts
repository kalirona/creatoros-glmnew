import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─── GET — return the failover chain for this provider ─────────────────────
// Returns route categories where this provider is the primary OR fallback.
// Each chain entry shows: routeCategory, primarySlug, fallbackSlug, strategy, isActive
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    const provider = await db.aiProvider.findUnique({
      where: { id },
      select: { id: true, slug: true },
    })
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    // Query AiRoute where this provider is primary OR fallback
    const routes = await db.aiRoute.findMany({
      where: {
        OR: [{ providerId: id }, { fallbackProviderId: id }],
      },
      include: {
        provider: { select: { slug: true } },
        fallbackProvider: { select: { slug: true } },
      },
      orderBy: { toolCategory: 'asc' },
    })

    const chains = routes.map((r) => ({
      routeCategory: r.toolCategory,
      primarySlug: r.provider.slug,
      fallbackSlug: r.fallbackProvider?.slug || null,
      strategy: r.strategy,
      isActive: r.isActive,
    }))

    return NextResponse.json({ chains })
  } catch (e) {
    console.error('[admin/providers/[id]/failover GET]', e)
    return NextResponse.json({ error: 'Failed to load failover chain' }, { status: 500 })
  }
}
