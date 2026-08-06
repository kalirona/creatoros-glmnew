import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { safeJsonParse, DEMO_WORKSPACE_ID } from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'

// GET /api/ai/videos/:id — single AI video job (creator-safe fields only).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const job = await db.aiJob.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID, type: 'VIDEO_GEN' },
    })
    if (!job) {
      return NextResponse.json({ error: 'Video job not found.' }, { status: 404 })
    }

    // Resolve the assetId (if the job produced a saved asset).
    let assetId: string | undefined
    if (job.resultUrl) {
      const asset = await db.aiAsset.findFirst({
        where: { workspaceId: DEMO_WORKSPACE_ID, url: job.resultUrl },
        select: { id: true },
      })
      assetId = asset?.id
    }

    return NextResponse.json({
      id: job.id,
      type: job.type,
      prompt: job.prompt,
      params: safeJsonParse<Record<string, unknown>>(job.params, {}),
      status: job.status,
      progress: job.progress,
      resultUrl: job.resultUrl,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      assetId,
    })
  } catch (e) {
    console.error('AI video job get error:', e)
    return NextResponse.json(
      { error: 'Failed to load video job.' },
      { status: 500 },
    )
  }
}

// PATCH /api/ai/videos/:id — only CANCELLED is allowed from creator side.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { status } = body as { status?: string }

    if (status !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'Only status=CANCELLED is allowed.' },
        { status: 400 },
      )
    }

    const existing = await db.aiJob.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID, type: 'VIDEO_GEN' },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Video job not found.' }, { status: 404 })
    }

    // Don't allow cancelling terminal jobs.
    if (existing.status === 'COMPLETED' || existing.status === 'FAILED' || existing.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `Cannot cancel a job that is already ${existing.status}.` },
        { status: 400 },
      )
    }

    const updated = await db.aiJob.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
    })
  } catch (e) {
    console.error('AI video job update error:', e)
    return NextResponse.json(
      { error: 'Failed to update video job.' },
      { status: 500 },
    )
  }
}
