// ============================================================================
// AI Engine — Router
// ----------------------------------------------------------------------------
// Given a route category (e.g. "IMAGE", "WRITING", "VIDEO"), resolve which
// provider + model should serve the request. Falls back to next provider on
// failure. Creators never call this directly — they call generateText/Image.
// ============================================================================

import { db } from '@/lib/db'
import type { RouteCategory, RouteResolution } from './types'

// Cache route resolutions for 30s to avoid hitting DB on every request
interface CacheEntry { value: RouteResolution | null; expires: number }
const routeCache = new Map<RouteCategory, CacheEntry>()
const CACHE_TTL_MS = 30_000

export async function resolveRoute(category: RouteCategory): Promise<RouteResolution | null> {
  const cached = routeCache.get(category)
  if (cached && cached.expires > Date.now()) return cached.value

  // 1. Try the active route for this category
  const route = await db.aiRoute.findFirst({
    where: { toolCategory: category, isActive: true },
    include: {
      provider: { include: { models: { where: { isActive: true } } } },
      fallbackProvider: { include: { models: { where: { isActive: true } } } },
    },
  })

  if (route?.provider && route.provider.isActive && route.provider.isHealthy) {
    // Pick model: explicit override → provider's default → first active model
    const model =
      (route.modelId ? route.provider.models.find((m) => m.id === route.modelId) : null) ||
      route.provider.models.find((m) => m.isDefault) ||
      route.provider.models[0]

    const resolution: RouteResolution = {
      providerId: route.provider.id,
      providerSlug: route.provider.slug,
      providerName: route.provider.name,
      modelId: model?.id || '',
      modelName: model?.name || '',
      strategy: route.strategy,
      fallbackProviderId: route.fallbackProvider?.id,
      fallbackProviderSlug: route.fallbackProvider?.slug,
    }
    routeCache.set(category, { value: resolution, expires: Date.now() + CACHE_TTL_MS })
    return resolution
  }

  // 2. Fallback: any active + healthy provider with the right capability
  const capabilityMap: Record<RouteCategory, string> = {
    WRITING: 'TEXT', MARKETING: 'TEXT', COURSE: 'TEXT', WEBSITE: 'TEXT',
    SEO: 'TEXT', EMAIL: 'TEXT', BLOG: 'TEXT', CRM: 'TEXT', AUTOMATION: 'TEXT',
    IMAGE: 'IMAGE', VIDEO: 'VIDEO', VOICE: 'TTS', STT: 'STT', EMBEDDING: 'EMBEDDING',
  }
  const neededCap = capabilityMap[category]
  const fallbackProvider = await db.aiProvider.findFirst({
    where: {
      isActive: true,
      isHealthy: true,
      capabilities: { contains: neededCap },
    },
    orderBy: { priority: 'asc' },
    include: { models: { where: { isActive: true } } },
  })

  if (!fallbackProvider) {
    routeCache.set(category, { value: null, expires: Date.now() + CACHE_TTL_MS })
    return null
  }

  const model =
    fallbackProvider.models.find((m) => m.isDefault) ||
    fallbackProvider.models.find((m) => m.modality === neededCap) ||
    fallbackProvider.models[0]

  const resolution: RouteResolution = {
    providerId: fallbackProvider.id,
    providerSlug: fallbackProvider.slug,
    providerName: fallbackProvider.name,
    modelId: model?.id || '',
    modelName: model?.name || '',
    strategy: 'fallback',
  }
  routeCache.set(category, { value: resolution, expires: Date.now() + CACHE_TTL_MS })
  return resolution
}

// Force-clear cache when admin changes routing config
export function invalidateRouteCache(category?: RouteCategory): void {
  if (category) routeCache.delete(category)
  else routeCache.clear()
}

// Check whether a provider has a specific capability
export function hasCapability(providerCapabilities: string, cap: string): boolean {
  return providerCapabilities.split(',').map((c) => c.trim().toUpperCase()).includes(cap.toUpperCase())
}
