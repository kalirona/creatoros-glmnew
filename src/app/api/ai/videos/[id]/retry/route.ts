import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveRoute, estimateCost, deductCredits, checkCredits, trackUsage, writeLog } from '@/lib/ai-engine'
import {
  getDemoUser,
  DEMO_WORKSPACE_ID,
  mapEngineError,
  safeJsonParse,
} from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/ai/videos/:id/retry — retry a failed video job.
// Creates a NEW AiJob with the same params and deducts credits again.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const original = await db.aiJob.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID, type: 'VIDEO_GEN' },
    })
    if (!original) {
      return NextResponse.json({ error: 'Video job not found.' }, { status: 404 })
    }
    if (original.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Only failed video jobs can be retried.' },
        { status: 400 },
      )
    }

    const user = await getDemoUser()
    if (!user) {
      return NextResponse.json({ error: 'No user account is available.' }, { status: 400 })
    }

    // ── Resolve route — VIDEO only (no fallback to IMAGE) ────────────────
    const route = await resolveRoute('VIDEO')
    if (!route) {
      return NextResponse.json(
        { error: 'No enabled video model available. Please ask your administrator to approve a video model.' },
        { status: 503 },
      )
    }

    const tool = await db.aiTool.findUnique({ where: { slug: 'VIDEO_GEN' } })
    const creditCost = tool?.creditCost ?? 15

    const creditCheck = await checkCredits(user.id, creditCost)
    if (!creditCheck.ok) {
      return NextResponse.json(
        { error: `You need ${creditCost} credits but have ${creditCheck.remaining}. Top up your account to continue.` },
        { status: 402 },
      )
    }

    // ── Create new job with same params ───────────────────────────────────
    const originalParams = safeJsonParse<{
      preset?: string
      duration?: number
      resolution?: string
    }>(original.params, {})

    const newJob = await db.aiJob.create({
      data: {
        workspaceId: DEMO_WORKSPACE_ID,
        userId: user.id,
        providerId: route.providerId,
        providerSlug: route.providerSlug,
        type: 'VIDEO_GEN',
        prompt: original.prompt,
        params: JSON.stringify({
          preset: originalParams.preset || 'Social Reel',
          duration: originalParams.duration || 8,
          resolution: originalParams.resolution || '1080p',
          retriedFrom: original.id,
        }),
        status: 'QUEUED',
        creditsUsed: creditCost,
        costUsd: estimateCost('VIDEO', 0, 0, 1.0),
      },
    })

    // ── Deduct credits ────────────────────────────────────────────────────
    const remainingCredits = await deductCredits(
      user.id,
      creditCost,
      `AI Video retry: ${original.prompt.slice(0, 50)}`,
    )

    // ── Track usage + log ─────────────────────────────────────────────────
    await Promise.all([
      trackUsage({
        workspaceId: DEMO_WORKSPACE_ID,
        userId: user.id,
        toolSlug: 'VIDEO_GEN',
        routeCategory: 'VIDEO',
        providerSlug: route.providerSlug,
        creditsUsed: creditCost,
        costUsd: newJob.costUsd,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
      }).catch(() => {}),
      writeLog({
        workspaceId: DEMO_WORKSPACE_ID,
        userId: user.id,
        providerId: route.providerId,
        providerSlug: route.providerSlug,
        modelId: route.modelId,
        toolSlug: 'VIDEO_GEN',
        routeCategory: 'VIDEO',
        requestType: 'VIDEO_RETRY',
        inputPreview: `[retry of ${original.id}] ${original.prompt}`.slice(0, 500),
        status: 'OK',
        durationMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        creditsUsed: creditCost,
        costUsd: newJob.costUsd,
      }).catch(() => {}),
    ])

    return NextResponse.json({
      jobId: newJob.id,
      status: newJob.status,
      creditsUsed: creditCost,
      remainingCredits,
    })
  } catch (e) {
    console.error('AI video retry error:', e)
    const { status, message } = mapEngineError(e)
    return NextResponse.json({ error: message }, { status })
  }
}
