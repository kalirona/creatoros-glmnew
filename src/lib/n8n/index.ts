// ============================================================================
// N8N Integration — Public API barrel
// ----------------------------------------------------------------------------
// Server-side only. Never import from client components.
// ============================================================================

export * from './types'
export * from './schemas'
export * from './workflows'
export * from './config'
export { n8nClient, isN8nConfigured } from './client'
export { checkN8nHealth, isN8nHealthy } from './health'
export { isN8nEnabled, isN8nEnabledAsync, invalidateN8nFlagCache, ensureN8nFeatureFlag } from './feature-flag'
export { logN8nOperation, getRecentN8nOperations } from './logging'
