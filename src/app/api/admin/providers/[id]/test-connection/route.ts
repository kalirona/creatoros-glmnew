import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runHealthCheck } from '@/lib/provider-gateway/health'

export const dynamic = 'force-dynamic'

// ─── POST — run a full health check (health + prompt + streaming + tool) ───
// Calls runHealthCheck(providerId) which:
//   - For GLM/Z.ai: makes a real API call via z-ai-web-dev-sdk
//   - For other providers: checks whether an API key is configured
//   - Writes an AiProviderHealth record + updates provider.isHealthy, latencyMs
// Returns: { status, latencyMs, testsRun, testsPassed, providerVersion,
//            quotaRemaining, modelCount, error? }
export async function POST(
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

    const result = await runHealthCheck(id)

    return NextResponse.json({
      status: result.status,
      latencyMs: result.latencyMs,
      testsRun: result.testsRun,
      testsPassed: result.testsPassed,
      providerVersion: result.providerVersion,
      quotaRemaining: result.quotaRemaining,
      modelCount: result.modelCount,
      error: result.error,
    })
  } catch (e) {
    console.error('[admin/providers/[id]/test-connection POST]', e)
    return NextResponse.json({ error: 'Failed to run health check' }, { status: 500 })
  }
}
