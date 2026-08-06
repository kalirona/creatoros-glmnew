// ============================================================================
// Provider Gateway — Client-safe exports (NO server-only imports)
// ----------------------------------------------------------------------------
// This barrel exports only types and the provider registry — safe to import
// from client components. Server-only modules (discovery, health, failover)
// are imported directly from their files in API routes, never from here.
// ============================================================================

export * from './types'
