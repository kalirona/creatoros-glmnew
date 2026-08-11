import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/creator-ai'

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

// ─── GET — return health history for a provider (last 20 checks) ───────────
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

    const history = await db.aiProviderHealth.findMany({
      where: { providerId: id },
      orderBy: { checkedAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      history: history.map((h) => ({
        id: h.id,
        status: h.status,
        latencyMs: h.latencyMs,
        testsRun: safeJsonParse<string[]>(h.testsRun, []),
        testsPassed: safeJsonParse<string[]>(h.testsPassed, []),
        providerVersion: h.providerVersion,
        modelCount: h.modelCount,
        errorMessage: h.errorMessage,
        checkedAt: h.checkedAt,
      })),
    })
  } catch (e) {
    console.error('[admin/providers/[id]/health GET]', e)
    return NextResponse.json({ error: 'Failed to load health history' }, { status: 500 })
  }
}
