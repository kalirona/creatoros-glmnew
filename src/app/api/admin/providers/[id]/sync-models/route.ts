import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateRouteCache } from '@/lib/ai-engine'
import { syncProviderModels } from '@/lib/provider-gateway/discovery'
import { requireSuperAdmin } from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'

// ─── POST — sync (refresh) models from the provider ────────────────────────
// Calls syncProviderModels(providerId) which:
//   - looks up the model catalog for the provider's slug
//   - diffs against existing models in DB
//   - inserts/updates/removes accordingly
//   - writes a sync history record
// Returns: { success, status, modelsFound, modelsAdded, modelsUpdated,
//            modelsRemoved, modelsKept, durationMs, error? }
export async function POST(
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

    const result = await syncProviderModels(id)

    // If sync succeeded (status !== 'failed'), bust route cache so the engine
    // picks up any newly added or removed models.
    if (result.status !== 'failed') {
      invalidateRouteCache()
    }

    return NextResponse.json({
      success: result.status !== 'failed',
      status: result.status,
      modelsFound: result.modelsFound,
      modelsAdded: result.modelsAdded,
      modelsUpdated: result.modelsUpdated,
      modelsRemoved: result.modelsRemoved,
      modelsKept: result.modelsKept,
      modelsUnavailable: result.modelsUnavailable,
      modelsEnabled: result.modelsEnabled,
      modelsDisabled: result.modelsDisabled,
      durationMs: result.durationMs,
      error: result.error,
    })
  } catch (e) {
    console.error('[admin/providers/[id]/sync-models POST]', e)
    return NextResponse.json({ error: 'Failed to sync models' }, { status: 500 })
  }
}
