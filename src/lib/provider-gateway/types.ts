// ============================================================================
// Provider Gateway — Types
// ----------------------------------------------------------------------------
// Central type definitions for the enterprise AI gateway.
// Creators never see provider names or model IDs — they pick a strategy
// (Fast | Balanced | Best | Creative | Reasoning) and the gateway routes.
// ============================================================================

export type ProviderSlug =
  | 'openrouter' | 'fal-ai' | 'openai' | 'anthropic' | 'gemini'
  | 'groq' | 'together' | 'deepseek' | 'glm' | 'replicate'
  | 'runpod' | 'elevenlabs' | 'deepgram' | 'custom' | 'zai'

export type AuthType = 'bearer' | 'x-api-key' | 'custom-header' | 'query-param'

export type CreatorStrategy = 'fast' | 'balanced' | 'best' | 'creative' | 'reasoning'

export type Modality =
  | 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'EMBEDDING'
  | 'STT' | 'TTS' | 'VISION' | 'OCR' | 'RERANKER' | 'MODERATION'

export type HealthStatus = 'healthy' | 'degraded' | 'down'

export interface DiscoveredModel {
  id: string                // provider's model id (e.g. "deepseek/deepseek-chat")
  name: string              // display name
  contextWindow: number
  modality: Modality
  inputCostPer1k: number
  outputCostPer1k: number
  supportsVision: boolean
  supportsImage: boolean
  supportsAudio: boolean
  supportsVideo: boolean
  supportsEmbeddings: boolean
  supportsStreaming: boolean
  supportsJson: boolean
  supportsToolCalling: boolean
  supportsReasoning: boolean
  tags: string[]
}

export interface ValidationResult {
  valid: boolean
  message: string
  models?: DiscoveredModel[]
  quotaRemaining?: string
  providerVersion?: string
}

export interface HealthCheckResult {
  status: HealthStatus
  latencyMs: number
  testsRun: string[]
  testsPassed: string[]
  providerVersion: string
  quotaRemaining: string
  modelCount: number
  error?: string
}

export interface TestPromptResult {
  success: boolean
  response: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
  error?: string
}

export interface SyncResult {
  status: 'success' | 'partial' | 'failed'
  modelsFound: number
  modelsAdded: number
  modelsUpdated: number
  modelsRemoved: number
  modelsKept: number
  durationMs: number
  error?: string
}

export interface FailoverChain {
  primarySlug: ProviderSlug
  fallbackSlugs: ProviderSlug[]
  retryCount: number
  retryDelayMs: number
}

// Mask an API key for display: sk-1234567890abcdef → sk-1••••cdef
export function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length < 12) return '••••' + key.slice(-4)
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

// Provider display metadata (logos, descriptions, default base URLs)
export interface ProviderMeta {
  slug: ProviderSlug
  name: string
  description: string
  logoUrl: string
  defaultBaseUrl: string
  docsUrl: string
  authType: AuthType
  capabilities: Modality[]
  color: string
  isCustom?: boolean
}

export const PROVIDER_REGISTRY: ProviderMeta[] = [
  {
    slug: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified gateway to 300+ LLMs. Auto-discovers models, pricing, and capabilities.',
    logoUrl: '/providers/openrouter.svg',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/docs',
    authType: 'bearer',
    capabilities: ['TEXT', 'VISION'],
    color: '#6366f1',
  },
  {
    slug: 'fal-ai',
    name: 'Fal AI',
    description: 'Serverless image & video generation. Flux, Kling, SDXL, and more.',
    logoUrl: '/providers/fal-ai.svg',
    defaultBaseUrl: 'https://fal.run',
    docsUrl: 'https://fal.ai/docs',
    authType: 'bearer',
    capabilities: ['IMAGE', 'VIDEO'],
    color: '#10b981',
  },
  {
    slug: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, DALL·E, Whisper, TTS, and embeddings.',
    logoUrl: '/providers/openai.svg',
    defaultBaseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/docs',
    authType: 'bearer',
    capabilities: ['TEXT', 'IMAGE', 'AUDIO', 'EMBEDDING', 'STT', 'TTS', 'VISION'],
    color: '#10a37f',
  },
  {
    slug: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models with extended thinking and tool use.',
    logoUrl: '/providers/anthropic.svg',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    docsUrl: 'https://docs.anthropic.com',
    authType: 'x-api-key',
    capabilities: ['TEXT', 'VISION'],
    color: '#d4a574',
  },
  {
    slug: 'gemini',
    name: 'Google AI',
    description: 'Gemini models with multimodal, thinking, and embedding support.',
    logoUrl: '/providers/gemini.svg',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1',
    docsUrl: 'https://ai.google.dev/docs',
    authType: 'query-param',
    capabilities: ['TEXT', 'IMAGE', 'EMBEDDING', 'VISION'],
    color: '#4285f4',
  },
  {
    slug: 'groq',
    name: 'Groq',
    description: 'Ultra-fast LLM inference for Llama, Mixtral, and Gemma.',
    logoUrl: '/providers/groq.svg',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    docsUrl: 'https://console.groq.com/docs',
    authType: 'bearer',
    capabilities: ['TEXT'],
    color: '#f55036',
  },
  {
    slug: 'together',
    name: 'Together AI',
    description: 'Fast, cheap inference for 200+ open-source models.',
    logoUrl: '/providers/together.svg',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    docsUrl: 'https://docs.together.ai',
    authType: 'bearer',
    capabilities: ['TEXT', 'IMAGE'],
    color: '#0f6fff',
  },
  {
    slug: 'deepseek',
    name: 'DeepSeek',
    description: 'Cost-effective reasoning and code generation.',
    logoUrl: '/providers/deepseek.svg',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    docsUrl: 'https://api-docs.deepseek.com',
    authType: 'bearer',
    capabilities: ['TEXT'],
    color: '#4d6bfe',
  },
  {
    slug: 'glm',
    name: 'GLM (Z.ai)',
    description: 'Z.ai GLM models. Default fallback for text and image generation.',
    logoUrl: '/providers/glm.svg',
    defaultBaseUrl: '',
    docsUrl: 'https://docs.z.ai',
    authType: 'bearer',
    capabilities: ['TEXT', 'IMAGE'],
    color: '#10b981',
  },
  {
    slug: 'replicate',
    name: 'Replicate',
    description: 'Run open-source models. Stable Diffusion, Llama video, and more.',
    logoUrl: '/providers/replicate.svg',
    defaultBaseUrl: 'https://api.replicate.com/v1',
    docsUrl: 'https://replicate.com/docs',
    authType: 'bearer',
    capabilities: ['IMAGE', 'VIDEO'],
    color: '#000000',
  },
  {
    slug: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Realistic AI voices and text-to-speech.',
    logoUrl: '/providers/elevenlabs.svg',
    defaultBaseUrl: 'https://api.elevenlabs.io/v1',
    docsUrl: 'https://elevenlabs.io/docs',
    authType: 'bearer',
    capabilities: ['TTS'],
    color: '#000000',
  },
  {
    slug: 'deepgram',
    name: 'Deepgram',
    description: 'Speech-to-text transcription with Nova-2.',
    logoUrl: '/providers/deepgram.svg',
    defaultBaseUrl: 'https://api.deepgram.com/v1',
    docsUrl: 'https://developers.deepgram.com/docs',
    authType: 'bearer',
    capabilities: ['STT'],
    color: '#13afe9',
  },
  {
    slug: 'custom',
    name: 'Custom Provider',
    description: 'OpenAI-compatible endpoint. Configure base URL, headers, and auth.',
    logoUrl: '/providers/custom.svg',
    defaultBaseUrl: '',
    docsUrl: '',
    authType: 'bearer',
    capabilities: ['TEXT', 'IMAGE', 'EMBEDDING'],
    color: '#6b7280',
    isCustom: true,
  },
]

export function getProviderMeta(slug: string): ProviderMeta | undefined {
  return PROVIDER_REGISTRY.find((p) => p.slug === slug)
}

// Creator strategy → route category mapping
export const STRATEGY_LABELS: Record<CreatorStrategy, string> = {
  fast: 'Fast',
  balanced: 'Balanced',
  best: 'Best',
  creative: 'Creative',
  reasoning: 'Reasoning',
}

export const STRATEGY_DESCRIPTIONS: Record<CreatorStrategy, string> = {
  fast: 'Optimized for speed — picks the lowest-latency active model',
  balanced: 'Smart default — balances cost, speed, and quality',
  best: 'Highest quality — picks the most capable model regardless of cost',
  creative: 'High temperature — optimized for creative writing and ideation',
  reasoning: 'Extended thinking — picks models with chain-of-thought support',
}

// Route categories that map to creator-facing features
export const ROUTE_CATEGORIES = [
  { id: 'CHAT', label: 'Default Chat', description: 'AI Chat conversations', modality: 'TEXT' as Modality },
  { id: 'IMAGE', label: 'Default Image', description: 'Image generation', modality: 'IMAGE' as Modality },
  { id: 'VIDEO', label: 'Default Video', description: 'Video generation', modality: 'VIDEO' as Modality },
  { id: 'AUDIO', label: 'Default Audio', description: 'Audio generation', modality: 'AUDIO' as Modality },
  { id: 'EMBEDDING', label: 'Default Embedding', description: 'Vector embeddings', modality: 'EMBEDDING' as Modality },
  { id: 'OCR', label: 'Default OCR', description: 'Image text extraction', modality: 'OCR' as Modality },
  { id: 'STT', label: 'Default Speech-to-Text', description: 'Transcription', modality: 'STT' as Modality },
  { id: 'TTS', label: 'Default Text-to-Speech', description: 'Voice synthesis', modality: 'TTS' as Modality },
  { id: 'VISION', label: 'Default Vision', description: 'Image understanding', modality: 'VISION' as Modality },
  { id: 'RERANKER', label: 'Default Reranker', description: 'Search result reranking', modality: 'RERANKER' as Modality },
  { id: 'MODERATION', label: 'Default Moderation', description: 'Content moderation', modality: 'MODERATION' as Modality },
] as const
