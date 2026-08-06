// ============================================================================
// AI Engine — Type definitions
// ----------------------------------------------------------------------------
// The AI Engine is the single entry point for all AI operations in CreatorOS.
// Creators call `generateText()` or `generateImage()` — they never see which
// provider or model serves the request. Super Admin configures routing in DB.
// ============================================================================

export type Modality = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'EMBEDDING' | 'STT' | 'TTS'

export type RouteCategory =
  | 'WRITING' | 'MARKETING' | 'COURSE' | 'WEBSITE' | 'SEO' | 'EMAIL'
  | 'BLOG' | 'CRM' | 'AUTOMATION' | 'IMAGE' | 'VIDEO' | 'VOICE' | 'STT' | 'EMBEDDING'

export type ProviderSlug =
  | 'openrouter' | 'fal-ai' | 'openai' | 'anthropic' | 'gemini'
  | 'deepseek' | 'glm' | 'replicate' | 'together' | 'runpod'
  | 'deepgram' | 'elevenlabs' | 'zai' | 'custom'

export type JobType =
  | 'IMAGE_GEN' | 'VIDEO_GEN' | 'IMAGE_UPSCALE' | 'BG_REMOVE'
  | 'IMAGE_VARIATION' | 'FACE_SWAP' | 'AVATAR_GEN' | 'VIDEO_UPSCALE'
  | 'FRAME_INTERPOLATION' | 'LOGO_GEN' | 'ICON_GEN' | 'THUMBNAIL_GEN'

export type JobStatus = 'QUEUED' | 'RENDERING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface RouteResolution {
  providerId: string
  providerSlug: string
  providerName: string
  modelId: string
  modelName: string
  strategy: string
  fallbackProviderId?: string
  fallbackProviderSlug?: string
}

export interface GenerateTextParams {
  toolSlug: string
  routeCategory: RouteCategory
  systemPrompt: string
  userInput: string
  temperature?: number
  maxTokens?: number
  userId: string
  workspaceId: string
  title?: string
  metadata?: Record<string, unknown>
}

export interface GenerateTextResult {
  generationId: string
  raw: string
  structured: Record<string, unknown>
  providerSlug: string
  modelId: string
  creditsUsed: number
  costUsd: number
  remainingCredits: number
  durationMs: number
  inputTokens: number
  outputTokens: number
}

export interface GenerateImageParams {
  prompt: string
  style?: string        // Realistic | Cartoon | Anime | 3D | Illustration | Watercolor | Cinematic | Product | Logo | Flat
  aspectRatio?: string  // 1:1 | 2:3 | 3:2 | 9:16 | 16:9 | 1:3 | 4:1
  userId: string
  workspaceId: string
  projectId?: string
  title?: string
  negativePrompt?: string
  seed?: number
}

export interface GenerateImageResult {
  generationId: string
  assetId: string
  url: string
  thumbnailUrl: string
  width: number
  height: number
  creditsUsed: number
  costUsd: number
  remainingCredits: number
  durationMs: number
}

export interface GenerateVideoParams {
  prompt: string
  preset?: string       // Product Demo | Social Reel | YouTube Short | Explainer | Promo | AI Avatar | Presentation | Animation
  duration?: number     // seconds
  resolution?: string   // 720p | 1080p | 4K
  userId: string
  workspaceId: string
  projectId?: string
}

export interface GenerateVideoResult {
  jobId: string
  status: JobStatus
  externalId?: string
  creditsUsed: number
  costUsd: number
  remainingCredits: number
}

export interface CreditCheckResult {
  ok: boolean
  remaining: number
  required: number
  message?: string
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: Date
  message?: string
}

// Mask an API key for display (sk-1234567890abcdef → sk-1••••cdef)
export function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length < 12) return '••••' + key.slice(-4)
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

// Aspect ratio → pixel dimensions
export const ASPECT_RATIOS: Record<string, { w: number; h: number; label: string }> = {
  '1:1': { w: 1024, h: 1024, label: 'Square' },
  '2:3': { w: 832, h: 1248, label: 'Portrait' },
  '3:2': { w: 1248, h: 832, label: 'Landscape' },
  '9:16': { w: 720, h: 1280, label: 'Story' },
  '16:9': { w: 1280, h: 720, label: 'Banner' },
  '4:1': { w: 2048, h: 512, label: 'Thumbnail' },
  '1:3': { w: 400, h: 1200, label: 'Tall Banner' },
}

export const IMAGE_STYLES = [
  'Realistic', 'Cartoon', 'Anime', '3D', 'Illustration',
  'Watercolor', 'Cinematic', 'Product', 'Logo', 'Flat',
] as const

export const VIDEO_PRESETS = [
  'Product Demo', 'Social Reel', 'YouTube Short', 'Explainer',
  'Promo', 'Animation',
] as const

// Tool slug → route category mapping (for default routing)
export const TOOL_ROUTE_MAP: Record<string, RouteCategory> = {
  COURSE_GENERATOR: 'COURSE',
  LESSON_WRITER: 'COURSE',
  EMAIL_WRITER: 'EMAIL',
  SALES_PAGE_GENERATOR: 'WEBSITE',
  BLOG_WRITER: 'BLOG',
  SOCIAL_MEDIA: 'MARKETING',
  SCRIPT_WRITER: 'MARKETING',
  PRODUCT_DESCRIPTION: 'MARKETING',
  LANDING_PAGE_GENERATOR: 'WEBSITE',
  SEO_OPTIMIZER: 'SEO',
  IMAGE_GEN: 'IMAGE',
  VIDEO_GEN: 'VIDEO',
  CHAT: 'WRITING',
}

// Cost in USD cents per modality (rough estimates, admin can override per model)
export const DEFAULT_COST_USD: Record<Modality, number> = {
  TEXT: 0.002,      // ~$0.002 per 1k tokens
  IMAGE: 0.04,      // ~$0.04 per image
  VIDEO: 0.50,      // ~$0.50 per second of video
  AUDIO: 0.10,
  EMBEDDING: 0.0001,
  STT: 0.006,
  TTS: 0.005,
}
