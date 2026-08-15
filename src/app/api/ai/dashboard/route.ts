import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  serializeCreatorAsset,
} from '@/lib/creator-ai'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// GET /api/ai/dashboard — everything the AI Studio Dashboard needs.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No user account is available.' }, { status: 400 })
    }

    const todayStart = startOfToday()

    const [
      todayGenerations,
      totalGenerations,
      creditsUsedAgg,
      recentGenerationsRaw,
      assetCountsByFolder,
      quickActions,
      favoriteAssetsRaw,
    ] = await Promise.all([
      db.aiGeneration.count({
        where: { userId: user.id, createdAt: { gte: todayStart } },
      }),
      db.aiGeneration.count({ where: { userId: user.id } }),
      db.creditTransaction.aggregate({
        where: { userId: user.id, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      db.aiGeneration.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          tool: { select: { outputType: true } },
        },
      }),
      Promise.all(
        [
          'AI Images',
          'AI Videos',
          'AI Logos',
          'AI Icons',
          'AI Audio',
          'AI Documents',
          'AI Templates',
        ].map((folder) =>
          db.aiAsset
            .count({
              where: { workspaceId: folder },
            })
            .then((count) => ({ folder, count })),
        ),
      ),
      db.aiTool.findMany({
        where: { isVisible: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          slug: true,
          name: true,
          icon: true,
          creditCost: true,
          category: true,
        },
      }),
      db.aiAsset.findMany({
        where: { workspaceId: user.workspaceId, isFavorite: true },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
    ])

    // Resolve asset URLs for recent generations (one batched query)
    const assetIds = recentGenerationsRaw
      .map((g) => g.assetId)
      .filter((x): x is string => !!x)
    const assetsForRecent =
      assetIds.length > 0
        ? await db.aiAsset.findMany({
            where: { id: { in: assetIds } },
            select: { id: true, url: true },
          })
        : []
    const assetUrlMap = new Map(assetsForRecent.map((a) => [a.id, a.url]))

    // Parse folder counts into the dashboard's expected shape
    const folderMap = new Map(assetCountsByFolder.map((f) => [f.folder, f.count]))
    const assetCounts = {
      images: folderMap.get('AI Images') ?? 0,
      videos: folderMap.get('AI Videos') ?? 0,
      logos: folderMap.get('AI Logos') ?? 0,
      icons: folderMap.get('AI Icons') ?? 0,
      audio: folderMap.get('AI Audio') ?? 0,
      documents: folderMap.get('AI Documents') ?? 0,
      templates: folderMap.get('AI Templates') ?? 0,
    }

    const recentGenerations = recentGenerationsRaw.map((g) => ({
      id: g.id,
      toolSlug: g.toolSlug,
      title: g.title,
      status: g.status,
      creditsUsed: g.creditsUsed,
      createdAt: g.createdAt.toISOString(),
      assetUrl: g.assetId ? assetUrlMap.get(g.assetId) || null : null,
      outputType: g.tool?.outputType || '',
    }))

    // Defensive: ensure Prisma aggregate result is a number
    const creditsUsedAggValue =
      (creditsUsedAgg._sum.amount as Prisma.Decimal | number | null) ?? 0
    const creditsUsed =
      typeof creditsUsedAggValue === 'number'
        ? Math.abs(creditsUsedAggValue)
        : Math.abs(Number(creditsUsedAggValue))

    return NextResponse.json({
      todayGenerations,
      totalGenerations,
      creditsRemaining: user.credits,
      creditsUsed,
      recentGenerations,
      assetCounts,
      quickActions,
      favoriteAssets: favoriteAssetsRaw.map(serializeCreatorAsset),
    })
  } catch (e) {
    console.error('AI dashboard error:', e)
    return NextResponse.json(
      { error: 'Failed to load AI dashboard.' },
      { status: 500 },
    )
  }
}
