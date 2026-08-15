import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  generateImage,
  ASPECT_RATIOS,
  IMAGE_STYLES,
} from '@/lib/ai-engine'
import {
  mapEngineError,
} from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/ai/images — generate an AI image via the AI Engine.
// Creators never see providerSlug/modelId/costUsd/durationMs.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      prompt,
      style,
      aspectRatio,
      projectId,
      title,
    } = body as {
      prompt?: string
      style?: string
      aspectRatio?: string
      projectId?: string
      title?: string
    }

    // ── Validate prompt ──────────────────────────────────────────────────
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }
    if (prompt.length > 2000) {
      return NextResponse.json({ error: 'Prompt must be 2000 characters or fewer.' }, { status: 400 })
    }
    const cleanPrompt = prompt.trim()

    // ── Validate style ────────────────────────────────────────────────────
    const validStyles = IMAGE_STYLES as readonly string[]
    const cleanStyle =
      style && validStyles.includes(style) ? style : undefined

    // ── Validate aspect ratio ─────────────────────────────────────────────
    const validRatios = Object.keys(ASPECT_RATIOS)
    const cleanRatio =
      aspectRatio && validRatios.includes(aspectRatio) ? aspectRatio : undefined

    // ── Demo user ─────────────────────────────────────────────────────────
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No user account is available.' }, { status: 400 })
    }

    // ── Call the engine ──────────────────────────────────────────────────
    const result = await generateImage({
      prompt: cleanPrompt,
      style: cleanStyle,
      aspectRatio: cleanRatio,
      userId: user.id,
      workspaceId: user.workspaceId,
      projectId,
      title,
    })

    // ── Creator-safe response (strip providerSlug, modelId, costUsd, durationMs) ──
    return NextResponse.json({
      generationId: result.generationId,
      assetId: result.assetId,
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
      width: result.width,
      height: result.height,
      creditsUsed: result.creditsUsed,
      remainingCredits: result.remainingCredits,
    })
  } catch (e) {
    console.error('AI image generation error:', e)
    const { status, message } = mapEngineError(e)
    return NextResponse.json({ error: message }, { status })
  }
}
