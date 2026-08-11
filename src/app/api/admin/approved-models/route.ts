import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateRouteCache } from '@/lib/ai-engine'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

const ALLOWED_MODALITIES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'EMBEDDING', 'STT', 'TTS', 'VISION']

// GET — list approved models (the creator-facing catalog)
// Supports filters: ?modality= &isEnabled= &workspaceVisible=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const modality = searchParams.get('modality') || undefined
    const isEnabled = searchParams.get('isEnabled')
    const workspaceVisible = searchParams.get('workspaceVisible')

    const where: Record<string, unknown> = {}
    if (modality) where.modality = modality
    if (isEnabled !== null && isEnabled !== undefined) where.isEnabled = isEnabled === 'true'
    if (workspaceVisible !== null && workspaceVisible !== undefined) where.workspaceVisible = workspaceVisible === 'true'

    const models = await db.approvedModel.findMany({
      where,
      include: { provider: { select: { id: true, name: true, slug: true, isActive: true, isHealthy: true } } },
      orderBy: [{ modality: 'asc' }, { priority: 'asc' }, { displayName: 'asc' }],
    })

    return NextResponse.json({ models })
  } catch (e) {
    console.error('[admin/approved-models GET]', e)
    return NextResponse.json({ error: 'Failed to load approved models' }, { status: 500 })
  }
}

// POST — approve a model (copy from AiModel/ProviderCatalog to ApprovedModel)
// Body: { providerModelId: string } OR { providerId, modelId, displayName, modality, ... }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { providerModelId } = body as { providerModelId?: string }

    if (providerModelId) {
      // Approve from Provider Catalog (AiModel)
      const catalogModel = await db.aiModel.findUnique({
        where: { id: providerModelId },
        include: { provider: { select: { id: true, name: true, slug: true } } },
      })
      if (!catalogModel) {
        return NextResponse.json({ error: 'Provider catalog model not found' }, { status: 404 })
      }
      if (catalogModel.providerStatus !== 'available') {
        return NextResponse.json({ error: `Cannot approve — model is ${catalogModel.providerStatus}` }, { status: 400 })
      }

      // Check if already approved
      const existing = await db.approvedModel.findUnique({
        where: { providerId_modelId: { providerId: catalogModel.providerId, modelId: catalogModel.name } },
      })
      if (existing) {
        // Already approved — just re-enable if disabled
        if (!existing.isEnabled) {
          const updated = await db.approvedModel.update({
            where: { id: existing.id },
            data: { isEnabled: true, updatedAt: new Date() },
          })
          invalidateRouteCache()
          return NextResponse.json({ success: true, model: updated, action: 're-enabled' })
        }
        return NextResponse.json({ success: true, model: existing, action: 'already-approved' })
      }

      // Create new ApprovedModel entry — copy capability flags from catalog
      const approved = await db.approvedModel.create({
        data: {
          providerId: catalogModel.providerId,
          providerModelId: catalogModel.id,
          providerName: catalogModel.provider.name,
          providerSlug: catalogModel.provider.slug,
          modelId: catalogModel.name,
          displayName: catalogModel.displayName,
          modality: catalogModel.modality,
          isDefault: false,
          isEnabled: true,
          workspaceVisible: true,
          priority: 100,
          creditsMultiplier: 1.0,
          supportsVision: catalogModel.supportsVision,
          supportsImage: catalogModel.supportsImage,
          supportsAudio: catalogModel.supportsAudio,
          supportsVideo: catalogModel.supportsVideo,
          supportsEmbeddings: catalogModel.supportsEmbeddings,
          supportsStreaming: catalogModel.supportsStreaming,
          supportsJson: catalogModel.supportsJson,
          supportsToolCalling: catalogModel.supportsToolCalling,
          supportsReasoning: catalogModel.supportsReasoning,
          contextWindow: catalogModel.contextWindow,
          inputCostPer1k: catalogModel.inputCostPer1k,
          outputCostPer1k: catalogModel.outputCostPer1k,
          approvedAt: new Date(),
        },
      })
      invalidateRouteCache()
      return NextResponse.json({ success: true, model: approved, action: 'approved' })
    }

    return NextResponse.json({ error: 'providerModelId required' }, { status: 400 })
  } catch (e) {
    console.error('[admin/approved-models POST]', e)
    return NextResponse.json({ error: 'Failed to approve model' }, { status: 500 })
  }
}

// PUT — update an approved model (enable/disable, set default, update display name, etc.)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { id, isDefault, isEnabled, workspaceVisible, displayName, priority, creditsMultiplier } = body as Record<string, unknown>

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const existing = await db.approvedModel.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Approved model not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (isDefault !== undefined) data.isDefault = !!isDefault
    if (isEnabled !== undefined) data.isEnabled = !!isEnabled
    if (workspaceVisible !== undefined) data.workspaceVisible = !!workspaceVisible
    if (displayName !== undefined) data.displayName = String(displayName)
    if (priority !== undefined) data.priority = Number(priority)
    if (creditsMultiplier !== undefined) data.creditsMultiplier = Number(creditsMultiplier)

    // If setting as default, unset other defaults for the same modality
    if (isDefault) {
      await db.approvedModel.updateMany({
        where: {
          modality: existing.modality,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }

    const model = await db.approvedModel.update({
      where: { id },
      data,
      include: { provider: { select: { id: true, name: true, slug: true } } },
    })

    invalidateRouteCache()

    return NextResponse.json({ success: true, model })
  } catch (e) {
    console.error('[admin/approved-models PUT]', e)
    return NextResponse.json({ error: 'Failed to update approved model' }, { status: 500 })
  }
}

// DELETE — remove a model from the approved catalog (creators will no longer see it)
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await db.approvedModel.delete({ where: { id } })
    invalidateRouteCache()

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[admin/approved-models DELETE]', e)
    return NextResponse.json({ error: 'Failed to delete approved model' }, { status: 500 })
  }
}
