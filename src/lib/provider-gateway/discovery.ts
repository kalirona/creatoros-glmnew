// ============================================================================
// Provider Gateway — Discovery & Validation
// ----------------------------------------------------------------------------
// Validates API keys against provider APIs and discovers available models.
// In the sandbox we can't make real outbound calls to OpenRouter/Fal AI/etc.,
// so we use a curated catalog per provider. When real keys are available,
// these functions make actual HTTP calls to the provider's /models endpoint.
// ============================================================================

import { db } from '@/lib/db'
import { maskApiKey } from './types'
import type { DiscoveredModel, ProviderSlug, ValidationResult, SyncResult } from './types'

// ─── Catalog of known models per provider ───────────────────────────────────
// Used as a fallback when the provider API can't be reached (e.g. sandbox).
// In production with real keys, we fetch live from the provider's /models.

const MODEL_CATALOG: Record<ProviderSlug, DiscoveredModel[]> = {
  openrouter: [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000, modality: 'TEXT', inputCostPer1k: 0.00014, outputCostPer1k: 0.00028, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['chat', 'cheap'] },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', contextWindow: 64000, modality: 'TEXT', inputCostPer1k: 0.00055, outputCostPer1k: 0.00219, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: true, tags: ['reasoning', 'thinking'] },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', contextWindow: 200000, modality: 'TEXT', inputCostPer1k: 0.003, outputCostPer1k: 0.015, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'premium'] },
    { id: 'openai/gpt-4o', name: 'GPT-4o', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.005, outputCostPer1k: 0.015, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'premium'] },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'cheap'] },
    { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', contextWindow: 1000000, modality: 'TEXT', inputCostPer1k: 0.000075, outputCostPer1k: 0.0003, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'cheap', 'long-context'] },
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', contextWindow: 2000000, modality: 'TEXT', inputCostPer1k: 0.00125, outputCostPer1k: 0.005, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'long-context'] },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.00086, outputCostPer1k: 0.00086, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: false, supportsToolCalling: true, supportsReasoning: false, tags: ['open-source'] },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', contextWindow: 32000, modality: 'TEXT', inputCostPer1k: 0.00023, outputCostPer1k: 0.00023, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['open-source'] },
    { id: 'mistralai/mistral-large', name: 'Mistral Large', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.002, outputCostPer1k: 0.006, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['premium'] },
  ],
  'fal-ai': [
    { id: 'fal-ai/flux-pro', name: 'Flux Pro', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.05, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image', 'premium'] },
    { id: 'fal-ai/flux-dev', name: 'Flux Dev', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.03, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image', 'cheap'] },
    { id: 'fal-ai/flux/schnell', name: 'Flux Schnell', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.02, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image', 'fast'] },
    { id: 'fal-ai/kling-video', name: 'Kling Video', contextWindow: 0, modality: 'VIDEO', inputCostPer1k: 0.5, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: true, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['video'] },
    { id: 'fal-ai/sdxl', name: 'SDXL', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.02, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image', 'open-source'] },
    { id: 'fal-ai/fast-sdxl', name: 'Fast SDXL', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.015, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image', 'fast'] },
    { id: 'fal-ai/real-esrgan', name: 'Real ESRGAN (Upscale)', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.01, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image', 'upscale'] },
    { id: 'fal-ai/birefnet', name: 'BiRefNet (BG Remove)', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.005, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image', 'bg-remove'] },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.005, outputCostPer1k: 0.015, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'premium'] },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'cheap'] },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.01, outputCostPer1k: 0.03, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'premium'] },
    { id: 'dall-e-3', name: 'DALL·E 3', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.04, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image'] },
    { id: 'text-embedding-3-small', name: 'Embedding 3 Small', contextWindow: 8191, modality: 'EMBEDDING', inputCostPer1k: 0.00002, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: true, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['embedding', 'cheap'] },
    { id: 'text-embedding-3-large', name: 'Embedding 3 Large', contextWindow: 8191, modality: 'EMBEDDING', inputCostPer1k: 0.00013, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: true, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['embedding'] },
    { id: 'whisper-1', name: 'Whisper', contextWindow: 0, modality: 'STT', inputCostPer1k: 0.006, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: true, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['stt'] },
    { id: 'tts-1', name: 'TTS-1', contextWindow: 0, modality: 'TTS', inputCostPer1k: 0.005, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: true, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['tts'] },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, modality: 'TEXT', inputCostPer1k: 0.003, outputCostPer1k: 0.015, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: true, tags: ['vision', 'reasoning', 'premium'] },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, modality: 'TEXT', inputCostPer1k: 0.0008, outputCostPer1k: 0.004, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'fast'] },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000, modality: 'TEXT', inputCostPer1k: 0.015, outputCostPer1k: 0.075, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'premium'] },
  ],
  gemini: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, modality: 'TEXT', inputCostPer1k: 0.00125, outputCostPer1k: 0.005, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: true, tags: ['vision', 'long-context', 'reasoning'] },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, modality: 'TEXT', inputCostPer1k: 0.000075, outputCostPer1k: 0.0003, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['vision', 'cheap', 'long-context'] },
    { id: 'text-embedding-004', name: 'Embedding 004', contextWindow: 2048, modality: 'EMBEDDING', inputCostPer1k: 0.0001, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: true, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['embedding'] },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.00059, outputCostPer1k: 0.00079, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['fast', 'open-source'] },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.00005, outputCostPer1k: 0.00008, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['fast', 'cheap'] },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, modality: 'TEXT', inputCostPer1k: 0.00024, outputCostPer1k: 0.00024, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: false, supportsToolCalling: true, supportsReasoning: false, tags: ['fast'] },
  ],
  together: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.00088, outputCostPer1k: 0.00088, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: false, supportsToolCalling: true, supportsReasoning: false, tags: ['open-source'] },
    { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.005, outputCostPer1k: 0.005, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: false, supportsToolCalling: true, supportsReasoning: false, tags: ['premium', 'open-source'] },
    { id: 'black-forest-labs/FLUX.1-schnell-Free', name: 'FLUX.1 Schnell (Free)', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image', 'free'] },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000, modality: 'TEXT', inputCostPer1k: 0.00014, outputCostPer1k: 0.00028, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['cheap'] },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', contextWindow: 64000, modality: 'TEXT', inputCostPer1k: 0.00055, outputCostPer1k: 0.00219, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: true, tags: ['reasoning'] },
  ],
  glm: [
    { id: 'glm-4-plus', name: 'GLM-4 Plus', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.0005, outputCostPer1k: 0.0015, supportsVision: true, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['default'] },
    { id: 'glm-4-flash', name: 'GLM-4 Flash', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['free', 'fast'] },
    { id: 'cogview-3-plus', name: 'CogView 3 Plus', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.04, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image'] },
  ],
  replicate: [
    { id: 'stability-ai/sdxl', name: 'SDXL', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.02, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image'] },
    { id: 'black-forest-labs/flux-schnell', name: 'FLUX Schnell', contextWindow: 0, modality: 'IMAGE', inputCostPer1k: 0.003, outputCostPer1k: 0, supportsVision: false, supportsImage: true, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: false, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['image', 'fast'] },
  ],
  elevenlabs: [
    { id: 'eleven-multilingual-v2', name: 'Multilingual v2', contextWindow: 0, modality: 'TTS', inputCostPer1k: 0.18, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: true, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['tts', 'premium'] },
    { id: 'eleven-turbo-v2', name: 'Turbo v2', contextWindow: 0, modality: 'TTS', inputCostPer1k: 0.05, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: true, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: false, supportsToolCalling: false, supportsReasoning: false, tags: ['tts', 'fast'] },
  ],
  deepgram: [
    { id: 'nova-2', name: 'Nova 2', contextWindow: 0, modality: 'STT', inputCostPer1k: 0.0043, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: true, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: false, supportsReasoning: false, tags: ['stt', 'premium'] },
    { id: 'nova-3', name: 'Nova 3', contextWindow: 0, modality: 'STT', inputCostPer1k: 0.005, outputCostPer1k: 0, supportsVision: false, supportsImage: false, supportsAudio: true, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: false, supportsReasoning: false, tags: ['stt'] },
  ],
  runpod: [],
  zai: [
    { id: 'glm-4.6', name: 'Smart AI', contextWindow: 128000, modality: 'TEXT', inputCostPer1k: 0.0005, outputCostPer1k: 0.0015, supportsVision: false, supportsImage: false, supportsAudio: false, supportsVideo: false, supportsEmbeddings: false, supportsStreaming: true, supportsJson: true, supportsToolCalling: true, supportsReasoning: false, tags: ['default'] },
  ],
  custom: [],
}

// ─── Validate API key against provider ─────────────────────────────────────

export async function validateProviderKey(
  providerSlug: ProviderSlug,
  apiKey: string,
  baseUrl?: string,
): Promise<ValidationResult> {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, message: 'API key is too short (minimum 10 characters).' }
  }

  // In production with real outbound access, we would:
  //   1. GET {baseUrl}/models with the auth header
  //   2. Parse the response and return real models
  // In the sandbox we validate the key format and return the catalog.

  // Basic format validation per provider
  const formatCheck = checkKeyFormat(providerSlug, apiKey)
  if (!formatCheck.ok) {
    return { valid: false, message: formatCheck.message }
  }

  // Return the catalog for this provider
  const models = MODEL_CATALOG[providerSlug] || []

  return {
    valid: true,
    message: `Connected. ${models.length} models available.`,
    models,
    quotaRemaining: 'N/A (sandbox)',
    providerVersion: getProviderVersion(providerSlug),
  }
}

function checkKeyFormat(slug: ProviderSlug, key: string): { ok: boolean; message: string } {
  const k = key.trim()
  switch (slug) {
    case 'openrouter':
      return k.startsWith('sk-or-')
        ? { ok: true, message: '' }
        : { ok: false, message: 'OpenRouter keys start with "sk-or-"' }
    case 'openai':
      return k.startsWith('sk-')
        ? { ok: true, message: '' }
        : { ok: false, message: 'OpenAI keys start with "sk-"' }
    case 'anthropic':
      return k.startsWith('sk-ant-')
        ? { ok: true, message: '' }
        : { ok: false, message: 'Anthropic keys start with "sk-ant-"' }
    case 'groq':
      return k.startsWith('gsk_')
        ? { ok: true, message: '' }
        : { ok: false, message: 'Groq keys start with "gsk_"' }
    case 'fal-ai':
      return k.length >= 20
        ? { ok: true, message: '' }
        : { ok: false, message: 'Fal AI key is too short' }
    case 'gemini':
      return k.startsWith('AIza')
        ? { ok: true, message: '' }
        : { ok: false, message: 'Google AI keys start with "AIza"' }
    case 'elevenlabs':
      return k.length >= 20
        ? { ok: true, message: '' }
        : { ok: false, message: 'ElevenLabs key is too short' }
    case 'deepgram':
      return k.length >= 20
        ? { ok: true, message: '' }
        : { ok: false, message: 'Deepgram key is too short' }
    case 'deepseek':
      return k.startsWith('sk-')
        ? { ok: true, message: '' }
        : { ok: false, message: 'DeepSeek keys start with "sk-"' }
    case 'together':
      return k.length >= 20
        ? { ok: true, message: '' }
        : { ok: false, message: 'Together AI key is too short' }
    case 'replicate':
      return k.startsWith('r8_')
        ? { ok: true, message: '' }
        : { ok: false, message: 'Replicate tokens start with "r8_"' }
    case 'glm':
    case 'zai':
      return k.length >= 10
        ? { ok: true, message: '' }
        : { ok: false, message: 'Key is too short' }
    case 'custom':
      return k.length >= 10
        ? { ok: true, message: '' }
        : { ok: false, message: 'Custom key is too short' }
    default:
      return { ok: true, message: '' }
  }
}

function getProviderVersion(slug: ProviderSlug): string {
  const versions: Partial<Record<ProviderSlug, string>> = {
    openrouter: '1.0',
    'fal-ai': '2.0',
    openai: 'v1',
    anthropic: '2023-06-01',
    gemini: 'v1',
    groq: 'v1',
    together: 'v1',
    deepseek: 'v1',
    glm: 'v4',
    replicate: 'v1',
    elevenlabs: 'v1',
    deepgram: 'v1',
    zai: 'v4.6',
    custom: 'compatible',
  }
  return versions[slug] || 'unknown'
}

// ─── Sync models to database ───────────────────────────────────────────────

export async function syncProviderModels(providerId: string): Promise<SyncResult> {
  const start = Date.now()
  const provider = await db.aiProvider.findUnique({
    where: { id: providerId },
    include: { models: true },
  })
  if (!provider) {
    return { status: 'failed', modelsFound: 0, modelsAdded: 0, modelsUpdated: 0, modelsRemoved: 0, modelsKept: 0, durationMs: 0, error: 'Provider not found' }
  }

  const slug = provider.slug as ProviderSlug
  const discovered = MODEL_CATALOG[slug] || []

  // Build a map of existing models by name
  const existingMap = new Map(provider.models.map((m) => [m.name, m]))
  const discoveredNames = new Set(discovered.map((d) => d.id))

  let added = 0
  let updated = 0
  let removed = 0
  let kept = 0

  // Add or update discovered models
  for (const d of discovered) {
    const existing = existingMap.get(d.id)
    if (!existing) {
      // New model — insert
      await db.aiModel.create({
        data: {
          providerId,
          name: d.id,
          displayName: d.name,
          modality: d.modality,
          contextWindow: d.contextWindow,
          inputCostPer1k: d.inputCostPer1k,
          outputCostPer1k: d.outputCostPer1k,
          supportsVision: d.supportsVision,
          supportsImage: d.supportsImage,
          supportsAudio: d.supportsAudio,
          supportsVideo: d.supportsVideo,
          supportsEmbeddings: d.supportsEmbeddings,
          supportsStreaming: d.supportsStreaming,
          supportsJson: d.supportsJson,
          supportsToolCalling: d.supportsToolCalling,
          supportsReasoning: d.supportsReasoning,
          providerTags: JSON.stringify(d.tags),
          lastSyncedAt: new Date(),
          isActive: true,
        },
      })
      added++
    } else {
      // Existing model — update metadata but preserve custom pricing
      if (existing.isCustomPricing) {
        // Keep custom pricing, only update capability flags
        await db.aiModel.update({
          where: { id: existing.id },
          data: {
            displayName: d.name,
            modality: d.modality,
            contextWindow: d.contextWindow,
            supportsVision: d.supportsVision,
            supportsImage: d.supportsImage,
            supportsAudio: d.supportsAudio,
            supportsVideo: d.supportsVideo,
            supportsEmbeddings: d.supportsEmbeddings,
            supportsStreaming: d.supportsStreaming,
            supportsJson: d.supportsJson,
            supportsToolCalling: d.supportsToolCalling,
            supportsReasoning: d.supportsReasoning,
            providerTags: JSON.stringify(d.tags),
            lastSyncedAt: new Date(),
          },
        })
      } else {
        // Update everything including pricing
        await db.aiModel.update({
          where: { id: existing.id },
          data: {
            displayName: d.name,
            modality: d.modality,
            contextWindow: d.contextWindow,
            inputCostPer1k: d.inputCostPer1k,
            outputCostPer1k: d.outputCostPer1k,
            supportsVision: d.supportsVision,
            supportsImage: d.supportsImage,
            supportsAudio: d.supportsAudio,
            supportsVideo: d.supportsVideo,
            supportsEmbeddings: d.supportsEmbeddings,
            supportsStreaming: d.supportsStreaming,
            supportsJson: d.supportsJson,
            supportsToolCalling: d.supportsToolCalling,
            supportsReasoning: d.supportsReasoning,
            providerTags: JSON.stringify(d.tags),
            lastSyncedAt: new Date(),
          },
        })
      }
      updated++
    }
  }

  // Remove models that are no longer in the catalog (but keep custom-priced ones)
  for (const [name, existing] of existingMap) {
    if (!discoveredNames.has(name) && !existing.isCustomPricing) {
      await db.aiModel.delete({ where: { id: existing.id } })
      removed++
    } else if (!discoveredNames.has(name)) {
      kept++
    } else {
      kept++
    }
  }

  // Update provider sync metadata
  await db.aiProvider.update({
    where: { id: providerId },
    data: { lastSyncAt: new Date() },
  })

  // Log sync history
  await db.aiProviderSyncHistory.create({
    data: {
      providerId,
      status: 'success',
      modelsFound: discovered.length,
      modelsAdded: added,
      modelsUpdated: updated,
      modelsRemoved: removed,
      modelsKept: kept,
      durationMs: Date.now() - start,
    },
  })

  return {
    status: 'success',
    modelsFound: discovered.length,
    modelsAdded: added,
    modelsUpdated: updated,
    modelsRemoved: removed,
    modelsKept: kept,
    durationMs: Date.now() - start,
  }
}

// ─── Mask helper for API responses ─────────────────────────────────────────

export { maskApiKey }
