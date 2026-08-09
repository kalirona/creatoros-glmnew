// ============================================================================
// N8N Integration — Core Client
// ----------------------------------------------------------------------------
// Server-side only. Never imported by client components.
//
// Responsibilities:
//   - Build authenticated, signed requests to n8n webhooks
//   - Apply request timeout
//   - Generate request/correlation IDs
//   - Send structured payload (standard request contract)
//   - Validate response with Zod
//   - Handle HTTP / timeout / network / validation errors
//   - Log failures safely (no secrets)
//   - Never expose n8n credentials to the browser
// ============================================================================

import crypto from 'crypto'
import { requireWorkflow } from './workflows'
import { N8nResponseSchema, N8nHealthTestDataSchema } from './schemas'
import { logN8nOperation } from './logging'
import { isN8nEnabled } from './feature-flag'
import { getBaseUrl, getApiKey, getWebhookSecret, getTimeoutMs } from './config'
import type {
  N8nContext,
  N8nRequest,
  N8nResponse,
  N8nErrorCode,
  N8nError,
} from './types'
import { N8nError as N8nErrorClass } from './types'

// ─── Environment configuration (imported from config.ts) ─────────────────────

/** Check if n8n is configured (all required env vars present). */
export function isN8nConfigured(): boolean {
  return !!(getBaseUrl() && getApiKey() && getWebhookSecret())
}

// ─── HMAC Signature ─────────────────────────────────────────────────────────

/**
 * Compute HMAC-SHA256 signature for the request.
 *
 * Signature input: `${requestId}:${timestamp}:${body}`
 * This lets n8n verify:
 *   1. The request came from CreatorOS (knows the shared secret)
 *   2. The request hasn't been tampered with (body is part of the signature)
 *   3. The request isn't a replay (timestamp is part of the signature)
 *
 * n8n should reject requests where the timestamp is >5 minutes old.
 */
function computeSignature(requestId: string, timestamp: string, body: string): string {
  const hmac = crypto.createHmac('sha256', getWebhookSecret())
  hmac.update(`${requestId}:${timestamp}:${body}`)
  return hmac.digest('hex')
}

// ─── N8nClient ──────────────────────────────────────────────────────────────

/**
 * Server-side n8n client. Singleton — use `n8nClient` export.
 *
 * Usage:
 *   const result = await n8nClient.execute('HEALTH_TEST', { foo: 'bar' }, context)
 *
 * The client:
 *   - Checks if n8n is configured + enabled
 *   - Looks up the workflow in the registry
 *   - Builds the standard request contract
 *   - Signs the request with HMAC
 *   - Sends to n8n via fetch with timeout
 *   - Validates the response with Zod
 *   - Logs the operation to AuditLog
 *   - Throws N8nError on any failure
 */
class N8nClient {
  /**
   * Execute an n8n workflow.
   *
   * @param workflowName - Internal workflow name (e.g. 'HEALTH_TEST')
   * @param payload - Workflow-specific input data
   * @param context - Authenticated CreatorOS context (userId, workspaceId, etc.)
   * @returns Validated n8n response
   * @throws N8nError on any failure
   */
  async execute<T = unknown>(
    workflowName: string,
    payload: Record<string, unknown>,
    context: N8nContext,
  ): Promise<N8nResponse<T>> {
    const workflow = requireWorkflow(workflowName)
    const requestId = crypto.randomUUID()
    const startedAt = Date.now()

    // 1. Check feature flag
    if (!isN8nEnabled()) {
      throw this.makeError('DISABLED', 'n8n integration is disabled (feature flag off).', 503, requestId, workflowName)
    }

    // 2. Check configured
    if (!isN8nConfigured()) {
      throw this.makeError('NOT_CONFIGURED', 'n8n is not configured (missing N8N_BASE_URL, N8N_API_KEY, or N8N_WEBHOOK_SECRET).', 503, requestId, workflowName)
    }

    // 3. Check workflow enabled
    if (!workflow.enabled) {
      throw this.makeError('WORKFLOW_NOT_FOUND', `Workflow "${workflowName}" is not enabled.`, 404, requestId, workflowName)
    }

    // 4. Build standard request contract
    const timestamp = new Date().toISOString()
    const requestBody: N8nRequest = {
      requestId,
      timestamp,
      workflow: workflow.name,
      user: {
        id: context.userId,
        role: context.userRole,
      },
      workspace: {
        id: context.workspaceId,
        plan: context.workspacePlan,
      },
      locale: context.locale || 'en',
      timezone: context.timezone || 'UTC',
      payload,
    }

    const bodyJson = JSON.stringify(requestBody)
    const url = `${getBaseUrl()}/webhook/${workflow.webhookId}`
    const signature = computeSignature(requestId, timestamp, bodyJson)
    const timeoutMs = workflow.timeoutMs || getTimeoutMs()

    // 5. Call n8n with timeout
    let response: Response
    try {
      const controller = new AbortController()
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-Key': getApiKey(),
          'X-CreatorOS-Signature': signature,
          'X-CreatorOS-Request-ID': requestId,
          'X-CreatorOS-Timestamp': timestamp,
        },
        body: bodyJson,
        signal: controller.signal,
      })
      clearTimeout(timeoutHandle)
    } catch (err) {
      // Distinguish timeout from network error
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      const code: N8nErrorCode = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR'
      const message = isTimeout
        ? `n8n request timed out after ${timeoutMs}ms`
        : `Failed to reach n8n: ${err instanceof Error ? err.message : 'network error'}`
      const error = this.makeError(code, message, isTimeout ? 504 : 502, requestId, workflowName)
      await this.safeLog(requestId, workflowName, context, startedAt, false, code, message)
      throw error
    }

    // 6. Check HTTP status
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      const message = `n8n returned HTTP ${response.status}`
      const error = this.makeError('HTTP_ERROR', `${message}${errorBody ? `: ${errorBody.slice(0, 200)}` : ''}`, response.status >= 400 && response.status < 500 ? response.status : 502, requestId, workflowName)
      await this.safeLog(requestId, workflowName, context, startedAt, false, 'HTTP_ERROR', message)
      throw error
    }

    // 7. Parse JSON
    let jsonBody: unknown
    try {
      jsonBody = await response.json()
    } catch {
      const message = 'n8n returned non-JSON response'
      const error = this.makeError('INVALID_RESPONSE', message, 502, requestId, workflowName)
      await this.safeLog(requestId, workflowName, context, startedAt, false, 'INVALID_RESPONSE', message)
      throw error
    }

    // 8. Validate with Zod
    const parseResult = N8nResponseSchema.safeParse(jsonBody)
    if (!parseResult.success) {
      const message = `n8n response failed validation: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
      const error = this.makeError('INVALID_RESPONSE', message, 502, requestId, workflowName)
      await this.safeLog(requestId, workflowName, context, startedAt, false, 'INVALID_RESPONSE', message)
      throw error
    }

    // 9. Log success
    const success = parseResult.data.success
    await this.safeLog(
      requestId,
      workflowName,
      context,
      startedAt,
      success,
      success ? undefined : parseResult.data.error.code,
      success ? undefined : parseResult.data.error.message,
    )

    // 10. Return validated response
    return parseResult.data as N8nResponse<T>
  }

  /**
   * Execute the health-test workflow and validate the response data.
   * Used by the health check and test endpoint.
   */
  async executeHealthTest(context: N8nContext): Promise<{
    requestId: string
    service: string | undefined
    status: string | undefined
  }> {
    const response = await this.execute('HEALTH_TEST', {}, context)
    if (!response.success) {
      throw this.makeError(
        response.error.code as N8nErrorCode,
        response.error.message,
        502,
        response.requestId,
        'HEALTH_TEST',
      )
    }
    // Validate the health-test data payload
    const dataResult = N8nHealthTestDataSchema.safeParse(response.data)
    if (!dataResult.success) {
      throw this.makeError(
        'INVALID_RESPONSE',
        'Health-test response data failed validation',
        502,
        response.requestId,
        'HEALTH_TEST',
      )
    }
    return {
      requestId: response.requestId,
      service: dataResult.data.service,
      status: dataResult.data.status,
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private makeError(
    code: N8nErrorCode,
    message: string,
    statusCode: number,
    requestId: string | null,
    workflow: string,
  ): N8nError {
    return new N8nErrorClass(code, message, { statusCode, requestId, workflow })
  }

  /** Log to AuditLog — swallows errors (logging must never break the request). */
  private async safeLog(
    requestId: string,
    workflow: string,
    context: N8nContext,
    startedAt: number,
    success: boolean,
    errorCode?: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await logN8nOperation({
        requestId,
        workflow,
        userId: context.userId,
        workspaceId: context.workspaceId,
        startedAt: new Date(startedAt).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        success,
        errorCode,
        errorMessage,
      })
    } catch (logErr) {
      // Logging failure must not propagate — just console.error
      console.error('[n8n] failed to log operation:', logErr instanceof Error ? logErr.message : logErr)
    }
  }
}

/** Singleton n8n client instance. */
export const n8nClient = new N8nClient()
