// ============================================================================
// N8N Integration — Environment Config Helpers
// ----------------------------------------------------------------------------
// Centralizes env var access so it can be mocked/tested.
// Server-side only.
// ============================================================================

/** Get n8n base URL (trailing slash stripped). */
export function getBaseUrl(): string {
  return (process.env.N8N_BASE_URL || '').replace(/\/+$/, '')
}

/** Get n8n API key (sent as X-N8N-API-Key header). */
export function getApiKey(): string {
  return process.env.N8N_API_KEY || ''
}

/** Get shared secret for HMAC signing. */
export function getWebhookSecret(): string {
  return process.env.N8N_WEBHOOK_SECRET || ''
}

/** Get request timeout in milliseconds (default 30s). */
export function getTimeoutMs(): number {
  const raw = Number(process.env.N8N_TIMEOUT_MS)
  return raw > 0 ? raw : 30_000
}
