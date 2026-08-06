import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─── GET — return sync history for a provider (last 10 syncs) ──────────────
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    const provider = await db.aiProvider.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const history = await db.aiProviderSyncHistory.findMany({
      where: { providerId: id },
      orderBy: { syncedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      history: history.map((h) => ({
        id: h.id,
        status: h.status,
        modelsFound: h.modelsFound,
        modelsAdded: h.modelsAdded,
        modelsUpdated: h.modelsUpdated,
        modelsRemoved: h.modelsRemoved,
        modelsKept: h.modelsKept,
        durationMs: h.durationMs,
        errorMessage: h.errorMessage,
        syncedAt: h.syncedAt,
      })),
    })
  } catch (e) {
    console.error('[admin/providers/[id]/sync-history GET]', e)
    return NextResponse.json({ error: 'Failed to load sync history' }, { status: 500 })
  }
}
