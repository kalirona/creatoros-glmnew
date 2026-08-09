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

/** Type guard: is this a successful response? */
export function isN8nSuccess<T>(r: { success: boolean }): r is { success: true; requestId: string; data: T } {
  return r.success === true
}

/** Type guard: is this a failure response? */
export function isN8nFailure(r: { success: boolean }): r is { success: false; requestId: string; error: { code: string; message: string } } {
  return r.success === false
}
