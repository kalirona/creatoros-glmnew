// ============================================================================
// N8N Integration — Health Check
// ----------------------------------------------------------------------------
// Server-side health check for the n8n service.
// Determines: configured, reachable, latency, status.
// Does NOT expose credentials.
// ============================================================================

import { isN8nConfigured } from './client'
import { isN8nEnabled } from './feature-flag'
import { getBaseUrl, getApiKey } from './config'
import type { N8nHealthStatus } from './types'

/**
 * Check n8n health by pinging its /healthz endpoint.
 *
 * This is a lightweight check that doesn't require the health-test workflow
 * to be deployed. It just verifies n8n is reachable.
 *
 * For a full end-to-end test (including auth + signature), use the
 * /api/n8n/test endpoint which calls the health-test workflow.
 */
export async function checkN8nHealth(): Promise<N8nHealthStatus> {
  const now = new Date().toISOString()
  const configured = isN8nConfigured()
  const enabled = isN8nEnabled()

  // Not configured — can't check
  if (!configured) {
    return {
      configured: false,
      enabled,
      reachable: false,
      latencyMs: null,
      status: 'not_configured',
      lastCheckedAt: now,
      error: 'Missing N8N_BASE_URL, N8N_API_KEY, or N8N_WEBHOOK_SECRET',
    }
  }

  // Configured but disabled via feature flag
  if (!enabled) {
    return {
      configured: true,
      enabled: false,
      reachable: false,
      latencyMs: null,
      status: 'disabled',
      lastCheckedAt: now,
      error: 'Feature flag n8n_ai_enabled is off',
    }
  }

  // Ping n8n's built-in health endpoint
  const baseUrl = getBaseUrl()
  const healthUrl = `${baseUrl}/healthz`
  const start = Date.now()

  try {
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), 5_000)

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'X-N8N-API-Key': getApiKey(),
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutHandle)

    const latencyMs = Date.now() - start

    if (response.ok) {
      return {
        configured: true,
        enabled: true,
        reachable: true,
        latencyMs,
        status: 'healthy',
        lastCheckedAt: now,
      }
    }

    // Non-2xx — n8n is reachable but unhealthy
    return {
      configured: true,
      enabled: true,
      reachable: true,
      latencyMs,
      status: 'degraded',
      lastCheckedAt: now,
      error: `n8n /healthz returned HTTP ${response.status}`,
    }
  } catch (err) {
    const latencyMs = Date.now() - start
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    return {
      configured: true,
      enabled: true,
      reachable: false,
      latencyMs,
      status: 'unhealthy',
      lastCheckedAt: now,
      error: isTimeout
        ? 'Health check timed out (5s)'
        : `Cannot reach n8n: ${err instanceof Error ? err.message : 'unknown error'}`,
    }
  }
}

/**
 * Quick boolean check — is n8n healthy and ready to receive requests?
 */
export async function isN8nHealthy(): Promise<boolean> {
  const health = await checkN8nHealth()
  return health.status === 'healthy'
}
