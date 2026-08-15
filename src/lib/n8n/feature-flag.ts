// ============================================================================
// N8N Integration — Feature Flag
// ----------------------------------------------------------------------------
// Controls whether n8n integration is active.
//
// Two layers:
//   1. N8N_AI_ENABLED env var — deployment-level master switch (needs restart)
//   2. FeatureFlag DB row (key='n8n_ai_enabled') — admin runtime toggle
//
// n8n is enabled only if BOTH are truthy. Either can disable it.
//
// Phase 1: defaults to DISABLED. Existing AI engine is completely unaffected.
// ============================================================================

import { db } from '@/lib/db'

// Cache the DB lookup result for 60s to avoid querying on every request
let cachedFlag: boolean | null = null
let cacheExpiresAt = 0
const CACHE_TTL_MS = 60_000

/**
 * Check if n8n integration is enabled.
 *
 * - If N8N_AI_ENABLED env var is not set or 'false' → returns false (no DB query)
 * - If env var is 'true' → checks FeatureFlag DB row (cached 60s)
 * - If both are truthy → returns true
 *
 * This ensures n8n can be completely disabled at the deployment level,
 * and admins can toggle it at runtime without a restart.
 */
export async function isN8nEnabledAsync(): Promise<boolean> {
  // 1. Env var master switch (deployment-level)
  const envFlag = process.env.N8N_AI_ENABLED?.toLowerCase()
  if (envFlag !== 'true' && envFlag !== '1') {
    return false
  }

  // 2. Check cache
  if (cachedFlag !== null && Date.now() < cacheExpiresAt) {
    return cachedFlag
  }

  // 3. Check FeatureFlag DB row
  try {
    const flag = await db.featureFlag.findUnique({ where: { key: 'n8n_ai_enabled' } })
    const enabled = flag?.enabled ?? false
    cachedFlag = enabled
    cacheExpiresAt = Date.now() + CACHE_TTL_MS
    return enabled
  } catch {
    // DB error — fail safe (disabled)
    return false
  }
}

/**
 * Synchronous version — only checks env var, not DB.
 * Use this for quick checks where DB access isn't available.
 * For full check, use isN8nEnabledAsync().
 */
export function isN8nEnabled(): boolean {
  const envFlag = process.env.N8N_AI_ENABLED?.toLowerCase()
  return envFlag === 'true' || envFlag === '1'
}

/**
 * Set the cached flag (for admin "enable now" actions).
 * The next request will pick up the new value without waiting for cache expiry.
 */
export function invalidateN8nFlagCache(): void {
  cachedFlag = null
  cacheExpiresAt = 0
}

/**
 * Ensure the n8n feature flag exists in the DB.
 * Called during server startup or admin init.
 * Safe to call multiple times — creates if missing, does nothing if exists.
 */
export async function ensureN8nFeatureFlag(): Promise<void> {
  try {
    const existing = await db.featureFlag.findUnique({ where: { key: 'n8n_ai_enabled' } })
    if (!existing) {
      await db.featureFlag.create({
        data: {
          key: 'n8n_ai_enabled',
          name: 'n8n AI Integration',
          description: 'Enable n8n as the AI/automation orchestration layer. When OFF, CreatorOS uses the built-in AI engine. When ON, migrated workflows route through n8n.',
          enabled: false, // Phase 1: disabled by default
        },
      })
    }
  } catch {
    // Non-fatal — feature flag check will fail safe (disabled)
  }
}
