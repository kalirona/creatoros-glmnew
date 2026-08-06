import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  serializeCreatorAsset,
  parsePagination,
  DEMO_WORKSPACE_ID,
} from '@/lib/creator-ai'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const VALID_TYPES = new Set([
  'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'TEMPLATE', 'LOGO', 'ICON',
])

const VALID_FOLDERS = [
  'AI Images',
  'AI Videos',
  'AI Logos',
  'AI Icons',
  'AI Audio',
  'AI Documents',
  'AI Templates',
]

// GET /api/ai/assets — list assets (the Media Library).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const { page, pageSize, skip, take } = parsePagination(req)

    const typeParam = searchParams.get('type') || ''
    const folderParam = searchParams.get('folder') || ''
    const isFavoriteParam = searchParams.get('isFavorite')
    const projectIdParam = searchParams.get('projectId') || ''
    const search = (searchParams.get('search') || '').trim()
    const tagParam = searchParams.get('tag') || ''

    const where: Prisma.AiAssetWhereInput = {
      workspaceId: DEMO_WORKSPACE_ID,
    }
    if (typeParam && VALID_TYPES.has(typeParam)) {
      where.type = typeParam
    }
    if (folderParam && VALID_FOLDERS.includes(folderParam)) {
      where.folder = folderParam
    }
    if (isFavoriteParam === 'true') where.isFavorite = true
    if (isFavoriteParam === 'false') where.isFavorite = false
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { prompt: { contains: search } },
      ]
    }
    if (tagParam) {
      // SQLite JSON contains via substring match (tags is a JSON array string)
      where.tags = { contains: `"${tagParam.replace(/"/g, '')}"` }
    }
    // projectId is stored on AiGeneration, not directly on AiAsset. We approximate
    // by joining through generationId — but since AiAsset has no projectId field,
    // we keep projectId as a no-op filter for now (only metadata filtering).
    if (projectIdParam) {
      where.generationId = { not: null }
    }

    const [assets, total, folderCounts] = await Promise.all([
      db.aiAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      db.aiAsset.count({ where }),
      Promise.all(
        VALID_FOLDERS.map((f) =>
          db.aiAsset
            .count({ where: { workspaceId: DEMO_WORKSPACE_ID, folder: f } })
            .then((count) => ({ name: f, count })),
        ),
      ),
    ])

    return NextResponse.json({
      assets: assets.map(serializeCreatorAsset),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      folders: folderCounts,
    })
  } catch (e) {
    console.error('AI assets list error:', e)
    return NextResponse.json(
      { error: 'Failed to load assets.' },
      { status: 500 },
    )
  }
}
