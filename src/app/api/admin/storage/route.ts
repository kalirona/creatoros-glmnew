import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

// Convert BigInt → Number (safe for our use cases; storage is < 2^53 bytes)
function toNum(b: bigint | null | undefined): number {
  if (b === null || b === undefined) return 0
  return Number(b.toString())
}

// ─── GET — per-workspace storage summary + totals across all workspaces ───
export async function GET() {
  try {
    const stores = await db.aiStorage.findMany({
      orderBy: { totalBytes: 'desc' },
    })

    const workspaces = stores.map((s) => ({
      id: s.id,
      workspaceId: s.workspaceId,
      imagesBytes: toNum(s.imagesBytes),
      videosBytes: toNum(s.videosBytes),
      audioBytes: toNum(s.audioBytes),
      documentsBytes: toNum(s.documentsBytes),
      totalBytes: toNum(s.totalBytes),
      quotaBytes: toNum(s.quotaBytes),
      assetCount: s.assetCount,
      usagePercent: s.quotaBytes > 0 ? (toNum(s.totalBytes) / toNum(s.quotaBytes)) * 100 : 0,
      updatedAt: s.updatedAt,
    }))

    // Aggregate totals across all workspaces
    const totalAgg = stores.reduce(
      (acc, s) => {
        acc.images += toNum(s.imagesBytes)
        acc.videos += toNum(s.videosBytes)
        acc.audio += toNum(s.audioBytes)
        acc.documents += toNum(s.documentsBytes)
        acc.total += toNum(s.totalBytes)
        acc.quota += toNum(s.quotaBytes)
        acc.assets += s.assetCount
        return acc
      },
      { images: 0, videos: 0, audio: 0, documents: 0, total: 0, quota: 0, assets: 0 }
    )

    return NextResponse.json({
      workspaces,
      totals: {
        ...totalAgg,
        usagePercent:
          totalAgg.quota > 0 ? (totalAgg.total / totalAgg.quota) * 100 : 0,
        workspaceCount: stores.length,
      },
    })
  } catch (e) {
    console.error('[admin/storage GET]', e)
    return NextResponse.json({ error: 'Failed to load storage' }, { status: 500 })
  }
}

// ─── PATCH — update storage quota for a workspace ─────────────────────────
// Body: { workspaceId, quotaBytes }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { workspaceId, quotaBytes } = body as {
      workspaceId?: string
      quotaBytes?: number | string
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
    }
    if (quotaBytes === undefined) {
      return NextResponse.json({ error: 'quotaBytes required' }, { status: 400 })
    }

    const quota = typeof quotaBytes === 'string' ? BigInt(quotaBytes) : BigInt(Math.floor(Number(quotaBytes)))
    if (quota < 0) {
      return NextResponse.json({ error: 'quotaBytes must be non-negative' }, { status: 400 })
    }

    // Find existing record (workspaceId is unique on AiStorage)
    const existing = await db.aiStorage.findUnique({ where: { workspaceId } })
    let storage
    if (existing) {
      storage = await db.aiStorage.update({
        where: { workspaceId },
        data: { quotaBytes: quota },
      })
    } else {
      storage = await db.aiStorage.create({
        data: { workspaceId, quotaBytes: quota },
      })
    }

    return NextResponse.json({
      success: true,
      storage: {
        ...storage,
        imagesBytes: toNum(storage.imagesBytes),
        videosBytes: toNum(storage.videosBytes),
        audioBytes: toNum(storage.audioBytes),
        documentsBytes: toNum(storage.documentsBytes),
        totalBytes: toNum(storage.totalBytes),
        quotaBytes: toNum(storage.quotaBytes),
      },
    })
  } catch (e) {
    console.error('[admin/storage PATCH]', e)
    return NextResponse.json({ error: 'Failed to update storage quota' }, { status: 500 })
  }
}
