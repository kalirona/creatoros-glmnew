import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProviderUsage } from '@/lib/provider-gateway/health'
import { requireSuperAdmin } from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'

// ─── GET — return usage stats for a provider ───────────────────────────────
// Aggregates today's requests, success rate, avg latency, daily/monthly cost,
// credits used, failures, top models, and most used features (route categories).
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
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const stats = await getProviderUsage(id)

    return NextResponse.json(stats)
  } catch (e) {
    console.error('[admin/providers/[id]/usage GET]', e)
    return NextResponse.json({ error: 'Failed to load provider usage' }, { status: 500 })
  }
}
