import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { safeJsonParse, DEMO_WORKSPACE_ID } from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'

// GET /api/ai/images/:id — single AI image asset (creator-safe fields only).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const asset = await db.aiAsset.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID, type: 'IMAGE' },
    })
    if (!asset) {
      return NextResponse.json({ error: 'Image not found.' }, { status: 404 })
    }

    // Creator-safe response: NO providerSlug, NO modelId, NO costUsd.
    return NextResponse.json({
      id: asset.id,
      name: asset.name,
      description: asset.description,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      width: asset.width,
      height: asset.height,
      prompt: asset.prompt,
      style: asset.style,
      aspectRatio: asset.aspectRatio,
      tags: safeJsonParse<string[]>(asset.tags, []),
      isFavorite: asset.isFavorite,
      createdAt: asset.createdAt.toISOString(),
    })
  } catch (e) {
    console.error('AI image get error:', e)
    return NextResponse.json(
      { error: 'Failed to load image.' },
      { status: 500 },
    )
  }
}

// PATCH /api/ai/images/:id — update image metadata.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { name, description, isFavorite, tags } = body as {
      name?: string
      description?: string
      isFavorite?: boolean
      tags?: string[]
    }

    const existing = await db.aiAsset.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID, type: 'IMAGE' },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Image not found.' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (typeof name === 'string' && name.trim()) data.name = name.trim().slice(0, 200)
    if (typeof description === 'string') data.description = description.slice(0, 2000)
    if (typeof isFavorite === 'boolean') data.isFavorite = isFavorite
    if (Array.isArray(tags)) {
      const cleanTags = tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.slice(0, 60))
        .slice(0, 20)
      data.tags = JSON.stringify(cleanTags)
    }

    const updated = await db.aiAsset.update({ where: { id }, data })

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      url: updated.url,
      thumbnailUrl: updated.thumbnailUrl,
      width: updated.width,
      height: updated.height,
      prompt: updated.prompt,
      style: updated.style,
      aspectRatio: updated.aspectRatio,
      tags: safeJsonParse<string[]>(updated.tags, []),
      isFavorite: updated.isFavorite,
      createdAt: updated.createdAt.toISOString(),
    })
  } catch (e) {
    console.error('AI image update error:', e)
    return NextResponse.json(
      { error: 'Failed to update image.' },
      { status: 500 },
    )
  }
}
