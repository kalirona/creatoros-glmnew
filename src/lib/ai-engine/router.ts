// ============================================================================
// AI Engine — Router
// ----------------------------------------------------------------------------
// Given a route category (e.g. "IMAGE", "WRITING", "VIDEO"), resolve which
// provider + model should serve the request. Falls back to next provider on
// failure. Creators never call this directly — they call generateText/Image.
//
// Routing rules:
//   - ONLY reads from ApprovedModel table (NOT AiModel/ProviderCatalog)
//   - Only models with isEnabled=true AND workspaceVisible=true are eligible
//   - Provider must be active + healthy
//   - If the default model is unavailable, falls back to next enabled model
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

  // Map route category to the modality we need
  const capabilityMap: Record<RouteCategory, string> = {
    WRITING: 'TEXT', MARKETING: 'TEXT', COURSE: 'TEXT', WEBSITE: 'TEXT',
    SEO: 'TEXT', EMAIL: 'TEXT', BLOG: 'TEXT', CRM: 'TEXT', AUTOMATION: 'TEXT',
    IMAGE: 'IMAGE', VIDEO: 'VIDEO', VOICE: 'TTS', STT: 'STT', EMBEDDING: 'EMBEDDING',
  }
  const neededModality = capabilityMap[category]

  // 1. Try the active route for this category
  const route = await db.aiRoute.findFirst({
    where: { toolCategory: category, isActive: true },
    include: {
      provider: true,
      fallbackProvider: true,
    },
  })

  if (route?.provider && route.provider.isActive && route.provider.isHealthy) {
    // Find approved models for this provider + modality
    const approvedModels = await db.approvedModel.findMany({
      where: {
        providerId: route.provider.id,
        modality: neededModality,
        isEnabled: true,
        workspaceVisible: true,
      },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
    })

    // Pick model: explicit override → default → first enabled
    const model =
      (route.modelId ? approvedModels.find((m) => m.id === route.modelId) : null) ||
      approvedModels.find((m) => m.isDefault) ||
      approvedModels[0]

    if (model) {
      const resolution: RouteResolution = {
        providerId: route.provider.id,
        providerSlug: route.provider.slug,
        providerName: route.provider.name,
        modelId: model.id,
        modelName: model.modelId,
        strategy: route.strategy,
        fallbackProviderId: route.fallbackProvider?.id,
        fallbackProviderSlug: route.fallbackProvider?.slug,
      }
      routeCache.set(category, { value: resolution, expires: Date.now() + CACHE_TTL_MS })
      return resolution
    }

    // If no approved model for this provider, try fallback provider
    if (route.fallbackProvider && route.fallbackProvider.isActive && route.fallbackProvider.isHealthy) {
      const fallbackModels = await db.approvedModel.findMany({
        where: {
          providerId: route.fallbackProvider.id,
          modality: neededModality,
          isEnabled: true,
          workspaceVisible: true,
        },
        orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
      })
      const fmodel = fallbackModels.find((m) => m.isDefault) || fallbackModels[0]
      if (fmodel) {
        const resolution: RouteResolution = {
          providerId: route.fallbackProvider.id,
          providerSlug: route.fallbackProvider.slug,
          providerName: route.fallbackProvider.name,
          modelId: fmodel.id,
          modelName: fmodel.modelId,
          strategy: 'fallback',
        }
        routeCache.set(category, { value: resolution, expires: Date.now() + CACHE_TTL_MS })
        return resolution
      }
    }
  }

  // 2. Global fallback: any active + healthy provider that has an approved model
  //    with the needed modality
  const providersWithApprovedModels = await db.aiProvider.findMany({
    where: {
      isActive: true,
      isHealthy: true,
      approvedModels: {
        some: {
          modality: neededModality,
          isEnabled: true,
          workspaceVisible: true,
        },
      },
    },
    orderBy: { priority: 'asc' },
    include: {
      approvedModels: {
        where: {
          modality: neededModality,
          isEnabled: true,
          workspaceVisible: true,
        },
        orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
      },
    },
  })

  if (providersWithApprovedModels.length === 0) {
    routeCache.set(category, { value: null, expires: Date.now() + CACHE_TTL_MS })
    return null
  }

  const fallbackProvider = providersWithApprovedModels[0]
  const model = fallbackProvider.approvedModels[0]

  const resolution: RouteResolution = {
    providerId: fallbackProvider.id,
    providerSlug: fallbackProvider.slug,
    providerName: fallbackProvider.name,
    modelId: model.id,
    modelName: model.modelId,
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
