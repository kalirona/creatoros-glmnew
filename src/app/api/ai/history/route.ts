import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  parsePagination,
} from '@/lib/creator-ai'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET /api/ai/history — paginated list of AiGeneration for the user.
// Filters: ?page=&pageSize=&type=&status=&from=&to=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const { page, pageSize, skip, take } = parsePagination(req)

    const typeFilter = searchParams.get('type') || ''
    const statusFilter = searchParams.get('status') || ''
    const fromParam = searchParams.get('from') || ''
    const toParam = searchParams.get('to') || ''

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No user account is available.' }, { status: 400 })
    }

    const where: Prisma.AiGenerationWhereInput = { userId: user.id }
    if (typeFilter) {
      where.tool = { outputType: typeFilter }
    }
    if (statusFilter) where.status = statusFilter

    const createdAt: Record<string, Date> = {}
    if (fromParam) {
      const from = new Date(fromParam)
      if (!isNaN(from.getTime())) createdAt.gte = from
    }
    if (toParam) {
      const to = new Date(toParam)
      if (!isNaN(to.getTime())) createdAt.lte = to
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt

    const [generationsRaw, total, typesGroupedByTool] = await Promise.all([
      db.aiGeneration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          tool: { select: { name: true, outputType: true } },
        },
      }),
      db.aiGeneration.count({ where }),
      db.aiGeneration.groupBy({
        by: ['toolId'],
        where: { userId: user.id },
        _count: { _all: true },
      }),
    ])

    // Resolve outputType per tool (for the types[] aggregation)
    const toolIds = typesGroupedByTool.map((t) => t.toolId)
    const tools =
      toolIds.length > 0
        ? await db.aiTool.findMany({
            where: { id: { in: toolIds } },
            select: { id: true, outputType: true },
          })
        : []
    const toolOutputTypeMap = new Map(tools.map((t) => [t.id, t.outputType]))

    // Aggregate types: sum counts per outputType (multiple tools may share one outputType)
    const typeCountMap = new Map<string, number>()
    for (const t of typesGroupedByTool) {
      const ot = toolOutputTypeMap.get(t.toolId) || ''
      typeCountMap.set(ot, (typeCountMap.get(ot) ?? 0) + t._count._all)
    }
    const types = Array.from(typeCountMap.entries()).map(([type, count]) => ({
      type,
      count,
    }))

    // Resolve asset URLs (batched)
    const assetIds = generationsRaw
      .map((g) => g.assetId)
      .filter((x): x is string => !!x)
    const assets =
      assetIds.length > 0
        ? await db.aiAsset.findMany({
            where: { id: { in: assetIds } },
            select: { id: true, url: true },
          })
        : []
    const assetMap = new Map(assets.map((a) => [a.id, a.url]))

    const generations = generationsRaw.map((g) => ({
      id: g.id,
      toolSlug: g.toolSlug,
      toolName: g.tool?.name || '',
      title: g.title,
      status: g.status,
      outputType: g.tool?.outputType || '',
      creditsUsed: g.creditsUsed,
      createdAt: g.createdAt.toISOString(),
      assetUrl: g.assetId ? assetMap.get(g.assetId) || null : null,
      assetId: g.assetId,
    }))

    return NextResponse.json({
      generations,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      types,
    })
  } catch (e) {
    console.error('AI history error:', e)
    return NextResponse.json(
      { error: 'Failed to load AI history.' },
      { status: 500 },
    )
  }
}
