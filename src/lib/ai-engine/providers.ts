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
