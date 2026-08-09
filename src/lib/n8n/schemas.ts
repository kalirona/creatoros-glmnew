// ============================================================================
// N8N Integration — Zod Validation Schemas
// ----------------------------------------------------------------------------
// Validates that n8n responses conform to the standard contract.
// Never trusts arbitrary n8n output.
// ============================================================================

import { z } from 'zod'

/** Schema for a successful n8n response. */
export const N8nSuccessSchema = z.object({
  success: z.literal(true),
  requestId: z.string().min(1),
  data: z.unknown(),
})

/** Schema for a failure n8n response. */
export const N8nFailureSchema = z.object({
  success: z.literal(false),
  requestId: z.string().min(1),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
})

/** Schema for any n8n response (success or failure). */
export const N8nResponseSchema = z.discriminatedUnion('success', [
  N8nSuccessSchema,
  N8nFailureSchema,
])

/** Schema for the health-test workflow's data payload. */
export const N8nHealthTestDataSchema = z.object({
  service: z.string().optional(),
  status: z.string().optional(),
})

/**
 * Schema for the TEXT_GENERATION workflow's data payload.
 *
 * Validates that n8n returned:
 *   - text: non-empty string (the generated content)
 *   - provider: non-empty string (the provider that served the request)
 *   - model: non-empty string (the model that served the request)
 *   - inputTokens: optional number
 *   - outputTokens: optional number
 *
 * If any field is missing or the wrong type, safeParse() returns failure
 * and the caller throws INVALID_RESPONSE.
 */
export const N8nTextGenerationDataSchema = z.object({
  text: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
})

/** Type guard: is this a successful response? */
export function isN8nSuccess<T>(r: { success: boolean }): r is { success: true; requestId: string; data: T } {
  return r.success === true
}

/** Type guard: is this a failure response? */
export function isN8nFailure(r: { success: boolean }): r is { success: false; requestId: string; error: { code: string; message: string } } {
  return r.success === false
}
