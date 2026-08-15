import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  serializeCreatorAsset,
} from '@/lib/creator-ai'

const VALID_FOLDERS = new Set([
  'AI Images',
  'AI Videos',
  'AI Logos',
  'AI Icons',
  'AI Audio',
  'AI Documents',
  'AI Templates',
])

export const dynamic = 'force-dynamic'

// GET /api/ai/assets/:id — single asset (creator-safe).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const { id } = await params
    const asset = await db.aiAsset.findFirst({
      where: { id, workspaceId: user.workspaceId },
    })
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
    }
    return NextResponse.json(serializeCreatorAsset(asset))
  } catch (e) {
    console.error('AI asset get error:', e)
    return NextResponse.json(
      { error: 'Failed to load asset.' },
      { status: 500 },
    )
  }
}

// PATCH /api/ai/assets/:id — update asset metadata.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { name, description, isFavorite, folder, tags } = body as {
      name?: string
      description?: string
      isFavorite?: boolean
      folder?: string
      tags?: string[]
    }

    const existing = await db.aiAsset.findFirst({
      where: { id, workspaceId: user.workspaceId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (typeof name === 'string' && name.trim()) data.name = name.trim().slice(0, 200)
    if (typeof description === 'string') data.description = description.slice(0, 2000)
    if (typeof isFavorite === 'boolean') data.isFavorite = isFavorite
    if (typeof folder === 'string' && VALID_FOLDERS.has(folder)) data.folder = folder
    if (Array.isArray(tags)) {
      const cleanTags = tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.slice(0, 60))
        .slice(0, 20)
      data.tags = JSON.stringify(cleanTags)
    }

    const updated = await db.aiAsset.update({ where: { id }, data })
    return NextResponse.json(serializeCreatorAsset(updated))
  } catch (e) {
    console.error('AI asset update error:', e)
    return NextResponse.json(
      { error: 'Failed to update asset.' },
      { status: 500 },
    )
  }
}

// DELETE /api/ai/assets/:id — delete asset (unlinks AiGeneration first).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const { id } = await params
    const existing = await db.aiAsset.findFirst({
      where: { id, workspaceId: user.workspaceId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
    }

    // Unlink any AiGeneration pointing at this asset (assetId=null) so the
    // relation doesn't break when we delete.
    if (existing.generationId) {
      await db.aiGeneration.updateMany({
        where: { assetId: id },
        data: { assetId: null },
      }).catch(() => {})
    }

    await db.aiAsset.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('AI asset delete error:', e)
    return NextResponse.json(
      { error: 'Failed to delete asset.' },
      { status: 500 },
    )
  }
}
