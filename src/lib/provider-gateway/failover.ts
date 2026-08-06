// ============================================================================
// Provider Gateway — Failover Chain
// ----------------------------------------------------------------------------
// When a provider fails, the gateway retries on the next provider in the
// failover chain. The chain is configurable per route category.
// ============================================================================

import { db } from '@/lib/db'
import { invalidateRouteCache } from '@/lib/ai-engine/router'
import type { ProviderSlug } from './types'

export interface FailoverConfig {
  routeCategory: string
  primarySlug: ProviderSlug
  fallbackSlugs: ProviderSlug[]
  retryCount: number
  retryDelayMs: number
}

// Default failover chains per route category
export const DEFAULT_FAILOVER_CHAINS: Record<string, ProviderSlug[]> = {
  CHAT: ['openrouter', 'groq', 'glm', 'together', 'deepseek'],
  IMAGE: ['fal-ai', 'glm', 'openai', 'replicate'],
  VIDEO: ['fal-ai', 'replicate', 'glm'],
  AUDIO: ['openai', 'elevenlabs'],
  EMBEDDING: ['openai', 'glm'],
  STT: ['deepgram', 'openai'],
  TTS: ['elevenlabs', 'openai'],
  VISION: ['openai', 'anthropic', 'gemini', 'glm'],
  OCR: ['openai', 'glm'],
  RERANKER: ['glm', 'openai'],
  MODERATION: ['openai', 'glm'],
}

// Get the failover chain for a route category
export function getFailoverChain(routeCategory: string): ProviderSlug[] {
  return DEFAULT_FAILOVER_CHAINS[routeCategory] || ['glm']
}

// Get the failover config for a route category from the database
export async function getRouteFailoverConfig(routeCategory: string): Promise<FailoverConfig | null> {
  const route = await db.aiRoute.findFirst({
    where: { toolCategory: routeCategory },
    include: {
      provider: true,
      fallbackProvider: true,
    },
  })

  if (!route) return null

  // Build the chain: primary → fallback → default chain
  const primarySlug = route.provider.slug as ProviderSlug
  const fallbackSlug = route.fallbackProvider?.slug as ProviderSlug | undefined
  const defaultChain = DEFAULT_FAILOVER_CHAINS[routeCategory] || []

  // Deduplicate: primary first, then fallback, then the rest of the default chain
  const chain = [primarySlug]
  if (fallbackSlug && fallbackSlug !== primarySlug) chain.push(fallbackSlug)
  for (const s of defaultChain) {
    if (!chain.includes(s)) chain.push(s)
  }

  return {
    routeCategory,
    primarySlug,
    fallbackSlugs: chain.slice(1),
    retryCount: 2,
    retryDelayMs: 1000,
  }
}

// Update the failover chain for a route category
export async function updateRouteFailover(
  routeCategory: string,
  primarySlug: ProviderSlug,
  fallbackSlug?: ProviderSlug,
): Promise<void> {
  const primary = await db.aiProvider.findUnique({ where: { slug: primarySlug } })
  if (!primary) throw new Error(`Provider ${primarySlug} not found`)

  let fallbackId: string | null = null
  if (fallbackSlug && fallbackSlug !== primarySlug) {
    const fallback = await db.aiProvider.findUnique({ where: { slug: fallbackSlug } })
    if (fallback) fallbackId = fallback.id
  }

  await db.aiRoute.upsert({
    where: { toolCategory: routeCategory },
    create: {
      toolCategory: routeCategory,
      providerId: primary.id,
      fallbackProviderId: fallbackId,
      strategy: 'smart',
      isActive: true,
    },
    update: {
      providerId: primary.id,
      fallbackProviderId: fallbackId,
    },
  })

  // Invalidate the route cache so the engine picks up the new config
  invalidateRouteCache()
}

// Execute a function with failover — tries each provider in the chain until one succeeds
export async function withFailover<T>(
  chain: ProviderSlug[],
  fn: (slug: ProviderSlug) => Promise<T>,
  retryCount = 2,
  retryDelayMs = 1000,
): Promise<{ result: T; usedSlug: ProviderSlug; attempts: { slug: ProviderSlug; success: boolean; error?: string }[] }> {
  const attempts: { slug: ProviderSlug; success: boolean; error?: string }[] = []

  for (const slug of chain) {
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const result = await fn(slug)
        attempts.push({ slug, success: true })
        return { result, usedSlug: slug, attempts }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error'
        if (attempt < retryCount) {
          await new Promise((r) => setTimeout(r, retryDelayMs))
          continue
        }
        attempts.push({ slug, success: false, error: errorMsg })
        break
      }
    }
  }

  throw new Error(`All providers in failover chain failed: ${chain.join(' → ')}`)
}
