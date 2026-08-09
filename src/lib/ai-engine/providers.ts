// ============================================================================
// AI Engine — Provider Adapters
// ----------------------------------------------------------------------------
// Each adapter wraps a single provider's API. All adapters implement the same
// interface so the engine can swap providers without touching the creator UI.
//
// Currently we use z-ai-web-dev-sdk as the underlying engine for TEXT and
// IMAGE generation (it's the only SDK available in this sandbox). The adapter
// layer means future providers (OpenRouter, Fal AI, ElevenLabs, etc.) just
// need a new adapter file — no creator-facing changes required.
// ============================================================================

import ZAI from 'z-ai-web-dev-sdk'
import type { Modality, ProviderSlug } from './types'
import { n8nClient } from '@/lib/n8n/client'
import { N8nTextGenerationDataSchema } from '@/lib/n8n/schemas'
import { N8nError } from '@/lib/n8n/types'
import type {
  N8nContext,
  N8nTextGenerationPayload,
  N8nTextGenerationData,
} from '@/lib/n8n/types'

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface TextCompletionResult {
  text: string
  inputTokens: number
  outputTokens: number
  durationMs: number
}

export interface ImageResult {
  url: string
  width: number
  height: number
  durationMs: number
}

// ---- Adapter interface ----------------------------------------------------

export interface ProviderAdapter {
  slug: ProviderSlug
  modalities: Modality[]
  generateText(
    messages: ChatMessage[],
    opts: { temperature: number; maxTokens: number; systemPrompt: string }
  ): Promise<TextCompletionResult>
  generateImage(
    prompt: string,
    opts: { width: number; height: number; style?: string }
  ): Promise<ImageResult>
}

// ---- z.ai adapter (default — powers WRITING / IMAGE / VIDEO routes) -------
// This adapter uses the z-ai-web-dev-sdk. It is the only concrete adapter
// wired up in this sandbox, but the adapter interface means we can swap in
// real OpenRouter / Fal AI / ElevenLabs adapters later without changing
// the creator-facing code.

class ZaiAdapter implements ProviderAdapter {
  slug: ProviderSlug = 'zai'
  modalities: Modality[] = ['TEXT', 'IMAGE']

  async generateText(
    messages: ChatMessage[],
    opts: { temperature: number; maxTokens: number; systemPrompt: string }
  ): Promise<TextCompletionResult> {
    const start = Date.now()
    const zai = await ZAI.create()
    // Prepend system prompt as assistant message (z-ai style)
    const fullMessages = [
      { role: 'assistant' as const, content: opts.systemPrompt },
      ...messages.filter((m) => m.role !== 'system'),
    ]
    const completion = await zai.chat.completions.create({
      messages: fullMessages,
      thinking: { type: 'disabled' },
    })
    const text = completion.choices[0]?.message?.content || ''
    const durationMs = Date.now() - start
    // Rough token estimate (4 chars ≈ 1 token)
    const inputTokens = Math.ceil(fullMessages.reduce((s, m) => s + m.content.length, 0) / 4)
    const outputTokens = Math.ceil(text.length / 4)
    return { text, inputTokens, outputTokens, durationMs }
  }

  async generateImage(
    prompt: string,
    opts: { width: number; height: number; style?: string }
  ): Promise<ImageResult> {
    const start = Date.now()
    const zai = await ZAI.create()
    // z-ai-web-dev-sdk supports several sizes; pick the closest to the requested aspect.
    // Available: '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440'
    const size = pickSize(opts.width, opts.height)
    const fullPrompt = opts.style ? `${opts.style} style. ${prompt}` : prompt
    const result = await zai.images.generations.create({
      prompt: fullPrompt,
      size,
    })
    // SDK returns { created, data: [{ base64: "..." }] } — no URL field.
    // Convert base64 to a data URL so the rest of the pipeline can use it as a URL.
    const b64 = result.data?.[0]?.base64 || ''
    if (!b64) throw new Error('Image generation returned no data')
    const url = `data:image/png;base64,${b64}`
    const durationMs = Date.now() - start
    return { url, width: opts.width, height: opts.height, durationMs }
  }
}

// Pick the closest supported size for the requested aspect ratio.
function pickSize(w: number, h: number): '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440' {
  const ratio = w / h
  // Map aspect → SDK size (1:1 square, >1 landscape, <1 portrait)
  if (Math.abs(ratio - 1) < 0.1) return '1024x1024'           // 1:1
  if (ratio > 1.7) return '1440x720'                            // 16:9 banner
  if (ratio > 1.4) return '1344x768'                            // 3:2 landscape
  if (ratio > 1.1) return '1152x864'                            // 4:3-ish
  if (ratio < 0.6) return '720x1440'                            // 9:16 story
  if (ratio < 0.75) return '768x1344'                           // 2:3 portrait
  return '864x1152'                                              // default portrait-ish
}

// ---- Stub adapters for providers that need real API keys ------------------
// These exist so the admin UI can show their health/state, but actual
// generation falls back to z.ai until the Super Admin provisions real keys
// and we wire up the real HTTP calls.

abstract class StubAdapter implements ProviderAdapter {
  abstract slug: ProviderSlug
  abstract modalities: Modality[]
  protected abstract label: string

  async generateText(): Promise<TextCompletionResult> {
    throw new Error(`${this.label} text generation requires a real API key. Falling back to default engine.`)
  }
  async generateImage(): Promise<ImageResult> {
    throw new Error(`${this.label} image generation requires a real API key. Falling back to default engine.`)
  }
}

class OpenRouterAdapter extends StubAdapter {
  slug = 'openrouter' as const
  modalities: Modality[] = ['TEXT']
  protected label = 'OpenRouter'
}

class FalAiAdapter extends StubAdapter {
  slug = 'fal-ai' as const
  modalities: Modality[] = ['IMAGE', 'VIDEO']
  protected label = 'Fal AI'
}

class ElevenLabsAdapter extends StubAdapter {
  slug = 'elevenlabs' as const
  modalities: Modality[] = ['TTS']
  protected label = 'ElevenLabs'
}

class DeepgramAdapter extends StubAdapter {
  slug = 'deepgram' as const
  modalities: Modality[] = ['STT']
  protected label = 'Deepgram'
}

class OpenAIEmbeddingsAdapter extends StubAdapter {
  slug = 'openai' as const
  modalities: Modality[] = ['EMBEDDING', 'TEXT', 'IMAGE']
  protected label = 'OpenAI'
}

// ---- n8n adapter (Phase 2.2 — TEXT generation via n8n → OpenRouter) -------
// This adapter routes text generation through a self-hosted n8n instance.
// It is NOT registered in the static `adapters` map below because it requires
// per-request context (userId, workspaceId, provider, model) that the singleton
// adapters don't have. Instead, engine.ts instantiates it on-demand when the
// n8n feature flag is enabled and the resolved provider should use n8n.
//
// CRITICAL: This adapter enforces EXPLICIT MODEL VERIFICATION. The caller
// specifies the exact provider + model; n8n must return the same provider +
// model in its response. If they don't match, the adapter throws MODEL_MISMATCH
// — no silent substitution, no fallback. This prevents the bug where a
// different model was silently used instead of the requested one.
//
// This adapter does NOT:
//   - deduct credits (engine.ts does that)
//   - save conversations (engine.ts does that)
//   - implement fallback (engine.ts failover loop handles that)
//   - implement image generation (Phase 3)
//   - hardcode any API keys, model IDs, or fake responses

/**
 * Context required to instantiate an N8nAdapter.
 * Resolved from the authenticated CreatorOS session — never trusted from the client.
 */
export interface N8nAdapterContext {
  /** The authenticated user ID. */
  userId: string
  /** The user's role (e.g. 'SUPER_ADMIN', 'MEMBER'). */
  userRole: string
  /** The workspace ID. */
  workspaceId: string
  /** The workspace plan (e.g. 'PRO'). */
  workspacePlan: string
  /** The provider n8n should call (e.g. 'openrouter'). */
  provider: string
  /** The EXACT model ID n8n must use (e.g. 'google/gemini-2.5-pro-preview'). */
  model: string
  /** Optional locale for the n8n request context. */
  locale?: string
  /** Optional timezone for the n8n request context. */
  timezone?: string
}

export class N8nAdapter implements ProviderAdapter {
  slug: ProviderSlug = 'custom' // uses 'custom' since 'n8n' is not a ProviderSlug (no schema change)
  modalities: Modality[] = ['TEXT']

  constructor(private readonly ctx: N8nAdapterContext) {}

  async generateText(
    messages: ChatMessage[],
    opts: { temperature: number; maxTokens: number; systemPrompt: string }
  ): Promise<TextCompletionResult> {
    const start = Date.now()

    // 1. Build the n8n context (from authenticated session, not client)
    const n8nContext: N8nContext = {
      userId: this.ctx.userId,
      userRole: this.ctx.userRole,
      workspaceId: this.ctx.workspaceId,
      workspacePlan: this.ctx.workspacePlan,
      locale: this.ctx.locale || 'en',
      timezone: this.ctx.timezone || 'UTC',
    }

    // 2. Build the payload — EXPLICIT provider + model
    // Prepend the system prompt as a system message (standard chat format)
    const payloadMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = []
    if (opts.systemPrompt) {
      payloadMessages.push({ role: 'system', content: opts.systemPrompt })
    }
    for (const m of messages) {
      // Skip any system messages from the input (we already added the systemPrompt above)
      if (m.role === 'system') continue
      payloadMessages.push({ role: m.role, content: m.content })
    }

    const payload: N8nTextGenerationPayload = {
      provider: this.ctx.provider,
      model: this.ctx.model,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      messages: payloadMessages,
    }

    // 3. Call the n8n TEXT_GENERATION workflow
    // n8nClient.execute() handles: feature-flag check, config check, HMAC signing,
    // timeout, Zod response validation, and audit logging.
    const response = await n8nClient.execute<N8nTextGenerationData>(
      'TEXT_GENERATION',
      payload as unknown as Record<string, unknown>,
      n8nContext,
    )

    // 4. Handle n8n-level failure (success: false from the workflow)
    if (!response.success) {
      throw new N8nError(
        'HTTP_ERROR', // reuse HTTP_ERROR for workflow-level failures
        `n8n TEXT_GENERATION workflow failed: ${response.error.message}`,
        {
          statusCode: 502,
          requestId: response.requestId,
          workflow: 'TEXT_GENERATION',
        },
      )
    }

    // 5. Validate the data payload with Zod (never trust arbitrary output)
    const dataResult = N8nTextGenerationDataSchema.safeParse(response.data)
    if (!dataResult.success) {
      const issues = dataResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
      throw new N8nError(
        'INVALID_RESPONSE',
        `n8n TEXT_GENERATION response data failed validation: ${issues}`,
        {
          statusCode: 502,
          requestId: response.requestId,
          workflow: 'TEXT_GENERATION',
        },
      )
    }

    const data = dataResult.data

    // 6. EXPLICIT MODEL VERIFICATION — the critical invariant
    // n8n must return the SAME provider + model it was asked to use.
    // If they don't match, this is a security issue (n8n may have substituted
    // a different model). Hard-fail — do NOT silently accept the wrong model.
    if (data.provider !== this.ctx.provider) {
      throw new N8nError(
        'MODEL_MISMATCH',
        `Provider mismatch: requested "${this.ctx.provider}" but n8n returned "${data.provider}". Refusing to use a different provider.`,
        {
          statusCode: 502,
          requestId: response.requestId,
          workflow: 'TEXT_GENERATION',
        },
      )
    }
    if (data.model !== this.ctx.model) {
      throw new N8nError(
        'MODEL_MISMATCH',
        `Model mismatch: requested "${this.ctx.model}" but n8n returned "${data.model}". Refusing to use a different model.`,
        {
          statusCode: 502,
          requestId: response.requestId,
          workflow: 'TEXT_GENERATION',
        },
      )
    }

    // 7. Build the result
    const durationMs = Date.now() - start
    // Use actual token counts if n8n provided them; otherwise estimate (4 chars ≈ 1 token)
    const inputTokens = data.inputTokens ?? Math.ceil(payloadMessages.reduce((s, m) => s + m.content.length, 0) / 4)
    const outputTokens = data.outputTokens ?? Math.ceil(data.text.length / 4)

    return {
      text: data.text,
      inputTokens,
      outputTokens,
      durationMs,
    }
  }

  async generateImage(): Promise<ImageResult> {
    throw new Error('N8nAdapter does not support image generation in Phase 2. Use the existing ZaiAdapter for images.')
  }
}

// ---- Registry -------------------------------------------------------------

const adapters: Record<ProviderSlug, ProviderAdapter> = {
  zai: new ZaiAdapter(),
  openrouter: new OpenRouterAdapter(),
  'fal-ai': new FalAiAdapter(),
  elevenlabs: new ElevenLabsAdapter(),
  deepgram: new DeepgramAdapter(),
  openai: new OpenAIEmbeddingsAdapter(),
  anthropic: new ZaiAdapter(), // alias to z.ai for now
  gemini: new ZaiAdapter(),
  deepseek: new ZaiAdapter(),
  glm: new ZaiAdapter(),
  replicate: new ZaiAdapter(),
  together: new ZaiAdapter(),
  runpod: new ZaiAdapter(),
  custom: new ZaiAdapter(),
}

// Get the adapter for a provider slug.
// Falls back to z.ai adapter if the requested provider throws (e.g. no key).
export function getAdapter(slug: ProviderSlug): ProviderAdapter {
  return adapters[slug] || adapters.zai
}

// Try a provider; on failure, fall back to z.ai so the creator still gets a result.
export async function withFallback<T>(
  primarySlug: ProviderSlug,
  fallbackSlug: ProviderSlug,
  fn: (adapter: ProviderAdapter) => Promise<T>,
  onFallback?: (used: ProviderSlug) => void,
): Promise<{ result: T; usedSlug: ProviderSlug }> {
  try {
    const primary = getAdapter(primarySlug)
    const result = await fn(primary)
    return { result, usedSlug: primary.slug }
  } catch (err) {
    if (fallbackSlug && fallbackSlug !== primarySlug) {
      const fallback = getAdapter(fallbackSlug)
      const result = await fn(fallback)
      onFallback?.(fallback.slug)
      return { result, usedSlug: fallback.slug }
    }
    throw err
  }
}
