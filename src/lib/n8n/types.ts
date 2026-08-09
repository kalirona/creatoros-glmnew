// ============================================================================
// N8N Integration — Type Definitions
// ----------------------------------------------------------------------------
// Standard request and response contracts for CreatorOS ↔ n8n communication.
// Server-side only. Never imported by client components.
// ============================================================================

/** Context resolved from the authenticated CreatorOS session. */
export interface N8nContext {
  userId: string
  userRole: string // 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'INSTRUCTOR' | 'MEMBER' | 'CUSTOMER'
  workspaceId: string
  workspacePlan: string // 'FREE' | 'PRO' | 'SCALE' | 'ENTERPRISE'
  locale?: string
  timezone?: string
}

/** The standard request body sent to n8n webhooks. */
export interface N8nRequest {
  requestId: string
  timestamp: string // ISO 8601
  workflow: string
  user: {
    id: string
    role: string
  }
  workspace: {
    id: string
    plan: string
  }
  locale: string
  timezone: string
  payload: Record<string, unknown>
}

/** Successful response from n8n. */
export interface N8nSuccessResponse<T = unknown> {
  success: true
  requestId: string
  data: T
}

/** Failure response from n8n. */
export interface N8nFailureResponse {
  success: false
  requestId: string
  error: {
    code: string
    message: string
  }
}

/** Union response type. */
export type N8nResponse<T = unknown> = N8nSuccessResponse<T> | N8nFailureResponse

/** Error codes the n8n client can produce. */
export type N8nErrorCode =
  | 'NOT_CONFIGURED'      // n8n env vars missing
  | 'DISABLED'            // feature flag off
  | 'WORKFLOW_NOT_FOUND'  // workflow not in registry or disabled
  | 'TIMEOUT'             // request exceeded timeout
  | 'HTTP_ERROR'          // n8n returned non-2xx
  | 'INVALID_RESPONSE'    // response failed Zod validation
  | 'NETWORK_ERROR'       // fetch threw (DNS, connection refused, etc.)
  | 'MODEL_MISMATCH'      // n8n returned a different model than the one requested
  | 'UNKNOWN'

/** Structured error thrown by the n8n client. */
export class N8nError extends Error {
  readonly code: N8nErrorCode
  readonly statusCode: number
  readonly requestId: string | null
  readonly workflow: string

  constructor(code: N8nErrorCode, message: string, opts: {
    statusCode?: number
    requestId?: string | null
    workflow: string
  }) {
    super(message)
    this.name = 'N8nError'
    this.code = code
    this.statusCode = opts.statusCode ?? 502
    this.requestId = opts.requestId ?? null
    this.workflow = opts.workflow
  }
}

/** Health check result. */
export interface N8nHealthStatus {
  configured: boolean
  enabled: boolean
  reachable: boolean
  latencyMs: number | null
  status: 'healthy' | 'degraded' | 'unhealthy' | 'not_configured' | 'disabled'
  lastCheckedAt: string | null
  error?: string
}

/** Workflow definition in the registry. */
export interface WorkflowDef {
  /** Internal name used in code (e.g. 'HEALTH_TEST'). */
  name: string
  /** n8n webhook path (appended to N8N_BASE_URL/webhook/). */
  webhookId: string
  /** Human-readable description. */
  description: string
  /** Whether this workflow is enabled for calling. */
  enabled: boolean
  /** Request timeout in milliseconds. */
  timeoutMs: number
  /** Expected response type from the workflow. */
  responseType: 'json' | 'text' | 'binary'
}

/** Log entry for n8n operations (written to AuditLog). */
export interface N8nLogEntry {
  requestId: string
  workflow: string
  userId: string
  workspaceId: string
  startedAt: string
  completedAt: string
  durationMs: number
  success: boolean
  errorCode?: string
  errorMessage?: string
}

// ─── TEXT_GENERATION workflow contracts ─────────────────────────────────────
// Phase 2.2 — Chat → n8n → OpenRouter with explicit-model verification.
// These types define the payload CreatorOS sends to the n8n TEXT_GENERATION
// workflow and the data the workflow must return.

/**
 * A single chat message in the text-generation payload.
 * Matches the existing ChatMessage shape from ai-engine/providers.ts.
 */
export interface N8nChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * The payload sent to the n8n TEXT_GENERATION workflow.
 *
 * The `provider` and `model` fields are EXPLICIT — n8n must call exactly
 * this provider with exactly this model. The workflow must NOT substitute
 * a different model. If it does, CreatorOS will detect the mismatch via
 * the response verification and throw MODEL_MISMATCH.
 *
 * Example:
 *   {
 *     provider: 'openrouter',
 *     model: 'google/gemini-2.5-pro-preview',
 *     temperature: 0.7,
 *     maxTokens: 2000,
 *     messages: [
 *       { role: 'system', content: 'You are a helpful assistant.' },
 *       { role: 'user', content: 'Hello!' }
 *     ]
 *   }
 */
export interface N8nTextGenerationPayload {
  /** The provider n8n should call (e.g. 'openrouter'). */
  provider: string
  /** The EXACT model ID n8n must use (e.g. 'google/gemini-2.5-pro-preview'). */
  model: string
  /** Sampling temperature (0-2). Optional — n8n workflow can use its default. */
  temperature?: number
  /** Max output tokens. Optional. */
  maxTokens?: number
  /** Full conversation including the system message. */
  messages: N8nChatMessage[]
}

/**
 * The data the n8n TEXT_GENERATION workflow must return on success.
 *
 * The `provider` and `model` fields let CreatorOS verify that n8n actually
 * used the requested provider+model — not a silently substituted one.
 *
 * `inputTokens` and `outputTokens` are optional because not all providers
 * return token counts. If absent, CreatorOS estimates (4 chars ≈ 1 token).
 */
export interface N8nTextGenerationData {
  /** The generated text. */
  text: string
  /** The provider that actually served the request (must match requested). */
  provider: string
  /** The model that actually served the request (must match requested). */
  model: string
  /** Actual input token count from the provider, if available. */
  inputTokens?: number
  /** Actual output token count from the provider, if available. */
  outputTokens?: number
}
