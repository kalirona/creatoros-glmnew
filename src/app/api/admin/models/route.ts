import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateRouteCache } from '@/lib/ai-engine'
export const dynamic = 'force-dynamic'

const ALLOWED_MODALITIES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'EMBEDDING', 'STT', 'TTS']

// ─── Helpers ────────────────────────────────────────────────────────────────
function safeJsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

// ─── GET — list all models with provider info; supports filters ────────────
// Returns the new capability flags (supportsVision, supportsImage, …) and
// parses providerTags from its stored JSON string into a string[].
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const providerId = searchParams.get('providerId') || undefined
    const modality = searchParams.get('modality') || undefined

    const where: Record<string, unknown> = {}
    if (providerId) where.providerId = providerId
    if (modality) where.modality = modality

    const models = await db.aiModel.findMany({
      where,
      include: { provider: { select: { id: true, name: true, slug: true, isActive: true } } },
      orderBy: [{ providerId: 'asc' }, { modality: 'asc' }, { name: 'asc' }],
    })

    const result = models.map((m) => ({
      ...m,
      providerTags: safeJsonParse<string[]>(m.providerTags, []),
    }))

    return NextResponse.json({ models: result })
  } catch (e) {
    console.error('[admin/models GET]', e)
    return NextResponse.json({ error: 'Failed to load models' }, { status: 500 })
  }
}

// ─── POST — create a new model on a provider ──────────────────────────────
// Supports all standard fields plus contextWindow + the capability flags.
// Models created manually here are flagged isCustomPricing=true if the caller
// supplies pricing (so future syncs won't overwrite it).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      providerId, name, displayName, modality,
      isDefault, costMultiplier, inputCostPer1k, outputCostPer1k, isActive,
      contextWindow,
      supportsVision, supportsImage, supportsAudio, supportsVideo,
      supportsEmbeddings, supportsStreaming, supportsJson,
      supportsToolCalling, supportsReasoning, providerTags,
    } = body as Record<string, unknown>

    if (!providerId || typeof providerId !== 'string') {
      return NextResponse.json({ error: 'providerId required' }, { status: 400 })
    }
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json({ error: 'displayName required' }, { status: 400 })
    }
    if (typeof modality !== 'string' || !ALLOWED_MODALITIES.includes(modality)) {
      return NextResponse.json(
        { error: `modality must be one of: ${ALLOWED_MODALITIES.join(', ')}` },
        { status: 400 }
      )
    }

    const provider = await db.aiProvider.findUnique({ where: { id: providerId } })
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

    // Enforce unique [providerId, name]
    const existing = await db.aiModel.findUnique({
      where: { providerId_name: { providerId, name } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Model '${name}' already exists on this provider` },
        { status: 400 }
      )
    }

    // If isDefault=true, unset isDefault on ALL other models with the same modality
    // (exactly ONE default per capability: TEXT, IMAGE, VIDEO, AUDIO, EMBEDDING, etc.)
    if (isDefault) {
      await db.aiModel.updateMany({
        where: { modality: modality as string, isDefault: true },
        data: { isDefault: false },
      })
    }

    // Coerce providerTags to a JSON string for storage
    let providerTagsStr = '[]'
    if (providerTags !== undefined) {
      if (typeof providerTags === 'string') {
        try { JSON.parse(providerTags); providerTagsStr = providerTags } catch {
          return NextResponse.json({ error: 'providerTags must be valid JSON' }, { status: 400 })
        }
      } else if (Array.isArray(providerTags)) {
        providerTagsStr = JSON.stringify(providerTags)
      }
    }

    // Manual pricing → mark as custom so future syncs won't overwrite
    const hasCustomPricing =
      (inputCostPer1k !== undefined && Number(inputCostPer1k) > 0) ||
      (outputCostPer1k !== undefined && Number(outputCostPer1k) > 0)

    const model = await db.aiModel.create({
      data: {
        providerId,
        name,
        displayName,
        modality,
        isDefault: !!isDefault,
        costMultiplier: costMultiplier !== undefined ? Number(costMultiplier) : 1.0,
        inputCostPer1k: inputCostPer1k !== undefined ? Number(inputCostPer1k) : 0,
        outputCostPer1k: outputCostPer1k !== undefined ? Number(outputCostPer1k) : 0,
        contextWindow: contextWindow !== undefined ? Number(contextWindow) : 128000,
        isActive: isActive !== undefined ? !!isActive : true,
        // Capability flags
        supportsVision: !!supportsVision,
        supportsImage: !!supportsImage,
        supportsAudio: !!supportsAudio,
        supportsVideo: !!supportsVideo,
        supportsEmbeddings: !!supportsEmbeddings,
        supportsStreaming: supportsStreaming !== undefined ? !!supportsStreaming : true,
        supportsJson: !!supportsJson,
        supportsToolCalling: !!supportsToolCalling,
        supportsReasoning: !!supportsReasoning,
        providerTags: providerTagsStr,
        isCustomPricing: hasCustomPricing,
        lastSyncedAt: new Date(),
      },
      include: { provider: { select: { id: true, name: true, slug: true } } },
    })

    invalidateRouteCache()

    return NextResponse.json({
      success: true,
      model: {
        ...model,
        providerTags: safeJsonParse<string[]>(model.providerTags, []),
      },
    })
  } catch (e) {
    console.error('[admin/models POST]', e)
    return NextResponse.json({ error: 'Failed to create model' }, { status: 500 })
  }
}

// ─── PUT — update a model ─────────────────────────────────────────────────
// Supports updating: inputCostPer1k, outputCostPer1k (sets isCustomPricing=true
// when changed), isActive, isDefault, displayName, contextWindow, costMultiplier,
// and all capability flags.
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id, providerId, name, displayName, modality,
      isDefault, costMultiplier, inputCostPer1k, outputCostPer1k, isActive,
      contextWindow,
      supportsVision, supportsImage, supportsAudio, supportsVideo,
      supportsEmbeddings, supportsStreaming, supportsJson,
      supportsToolCalling, supportsReasoning, providerTags,
      providerStatus, isVerified, lastTestedAt, latencyMs,
    } = body as Record<string, unknown>

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const existing = await db.aiModel.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Model not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (providerId !== undefined) data.providerId = providerId
    if (name !== undefined) data.name = name
    if (displayName !== undefined) data.displayName = displayName
    if (modality !== undefined) {
      if (typeof modality !== 'string' || !ALLOWED_MODALITIES.includes(modality)) {
        return NextResponse.json(
          { error: `modality must be one of: ${ALLOWED_MODALITIES.join(', ')}` },
          { status: 400 }
        )
      }
      data.modality = modality
    }
    if (isDefault !== undefined) data.isDefault = !!isDefault
    if (costMultiplier !== undefined) data.costMultiplier = Number(costMultiplier)
    if (inputCostPer1k !== undefined) data.inputCostPer1k = Number(inputCostPer1k)
    if (outputCostPer1k !== undefined) data.outputCostPer1k = Number(outputCostPer1k)
    if (isActive !== undefined) data.isActive = !!isActive
    if (contextWindow !== undefined) data.contextWindow = Number(contextWindow)

    // Capability flags
    if (supportsVision !== undefined) data.supportsVision = !!supportsVision
    if (supportsImage !== undefined) data.supportsImage = !!supportsImage
    if (supportsAudio !== undefined) data.supportsAudio = !!supportsAudio
    if (supportsVideo !== undefined) data.supportsVideo = !!supportsVideo
    if (supportsEmbeddings !== undefined) data.supportsEmbeddings = !!supportsEmbeddings
    if (supportsStreaming !== undefined) data.supportsStreaming = !!supportsStreaming
    if (supportsJson !== undefined) data.supportsJson = !!supportsJson
    if (supportsToolCalling !== undefined) data.supportsToolCalling = !!supportsToolCalling
    if (supportsReasoning !== undefined) data.supportsReasoning = !!supportsReasoning

    // Provider status & verification fields
    if (providerStatus !== undefined) data.providerStatus = String(providerStatus)
    if (isVerified !== undefined) data.isVerified = !!isVerified
    if (lastTestedAt !== undefined) data.lastTestedAt = lastTestedAt ? new Date(lastTestedAt as string) : null
    if (latencyMs !== undefined) data.latencyMs = Number(latencyMs)

    // providerTags — accept array or JSON string
    if (providerTags !== undefined) {
      if (typeof providerTags === 'string') {
        try { JSON.parse(providerTags); data.providerTags = providerTags } catch {
          return NextResponse.json({ error: 'providerTags must be valid JSON' }, { status: 400 })
        }
      } else if (Array.isArray(providerTags)) {
        data.providerTags = JSON.stringify(providerTags)
      }
    }

    // If pricing was manually changed, mark as custom pricing so future syncs
    // won't overwrite the admin's override.
    const pricingChanged =
      (inputCostPer1k !== undefined && Number(inputCostPer1k) !== existing.inputCostPer1k) ||
      (outputCostPer1k !== undefined && Number(outputCostPer1k) !== existing.outputCostPer1k)
    if (pricingChanged) {
      data.isCustomPricing = true
    }

    // If isDefault=true, unset isDefault on ALL other models with the same modality
    // (exactly ONE default per capability: TEXT, IMAGE, VIDEO, AUDIO, EMBEDDING, etc.)
    if (isDefault) {
      await db.aiModel.updateMany({
        where: {
          modality: existing.modality,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }

    const model = await db.aiModel.update({
      where: { id },
      data,
      include: { provider: { select: { id: true, name: true, slug: true } } },
    })

    invalidateRouteCache()

    return NextResponse.json({
      success: true,
      model: {
        ...model,
        providerTags: safeJsonParse<string[]>(model.providerTags, []),
      },
    })
  } catch (e) {
    console.error('[admin/models PUT]', e)
    return NextResponse.json({ error: 'Failed to update model' }, { status: 500 })
  }
}
