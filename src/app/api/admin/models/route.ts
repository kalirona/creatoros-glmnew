import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateRouteCache } from '@/lib/ai-engine'
export const dynamic = 'force-dynamic'

const ALLOWED_MODALITIES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'EMBEDDING', 'STT', 'TTS']

// ─── GET — list all models with provider info; supports filters ────────────
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

    return NextResponse.json({ models })
  } catch (e) {
    console.error('[admin/models GET]', e)
    return NextResponse.json({ error: 'Failed to load models' }, { status: 500 })
  }
}

// ─── POST — create a new model on a provider ──────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      providerId, name, displayName, modality,
      isDefault, costMultiplier, inputCostPer1k, outputCostPer1k, isActive,
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

    // If isDefault=true, unset isDefault on other models of the same provider first
    if (isDefault) {
      await db.aiModel.updateMany({
        where: { providerId, isDefault: true },
        data: { isDefault: false },
      })
    }

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
        isActive: isActive !== undefined ? !!isActive : true,
      },
      include: { provider: { select: { id: true, name: true, slug: true } } },
    })

    invalidateRouteCache()

    return NextResponse.json({ success: true, model })
  } catch (e) {
    console.error('[admin/models POST]', e)
    return NextResponse.json({ error: 'Failed to create model' }, { status: 500 })
  }
}

// ─── PUT — update a model ─────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id, providerId, name, displayName, modality,
      isDefault, costMultiplier, inputCostPer1k, outputCostPer1k, isActive,
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

    // If isDefault=true, unset isDefault on other models of the same provider
    if (isDefault) {
      await db.aiModel.updateMany({
        where: { providerId: existing.providerId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const model = await db.aiModel.update({
      where: { id },
      data,
      include: { provider: { select: { id: true, name: true, slug: true } } },
    })

    invalidateRouteCache()

    return NextResponse.json({ success: true, model })
  } catch (e) {
    console.error('[admin/models PUT]', e)
    return NextResponse.json({ error: 'Failed to update model' }, { status: 500 })
  }
}
