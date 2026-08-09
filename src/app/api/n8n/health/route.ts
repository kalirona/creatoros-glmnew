// ============================================================================
// GET /api/n8n/health — n8n health check (Super Admin only)
// ----------------------------------------------------------------------------
// Returns the health status of the n8n integration.
// Does NOT expose credentials, URLs, or secrets.
// ============================================================================

import { NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/creator-ai'
import { checkN8nHealth, listWorkflows, getRecentN8nOperations } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Authenticate
    const user = await getDemoUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    // 2. Authorize — SUPER_ADMIN only
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 })
    }

    // 3. Run health check
    const health = await checkN8nHealth()

    // 4. Get workflow registry + recent operations (for admin display)
    const [workflows, recentOps] = await Promise.all([
      listWorkflows(),
      getRecentN8nOperations(10),
    ])

    // 5. Return safe response — no secrets exposed
    return NextResponse.json({
      health: {
        configured: health.configured,
        enabled: health.enabled,
        reachable: health.reachable,
        latencyMs: health.latencyMs,
        status: health.status,
        lastCheckedAt: health.lastCheckedAt,
        error: health.error || undefined,
      },
      workflows: workflows.map((w) => ({
        name: w.name,
        webhookId: w.webhookId,
        description: w.description,
        enabled: w.enabled,
        timeoutMs: w.timeoutMs,
        responseType: w.responseType,
      })),
      recentOperations: recentOps,
    })
  } catch (err) {
    console.error('[n8n/health] error:', err)
    return NextResponse.json({
      error: 'Failed to check n8n health.',
    }, { status: 500 })
  }
}
