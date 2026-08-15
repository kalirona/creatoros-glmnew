import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  generateVideo,
} from '@/lib/ai-engine'
import {
  mapEngineError,
} from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VALID_RESOLUTIONS = new Set(['720p', '1080p'])
const VALID_DURATIONS = new Set([5, 10])
const VALID_PRESETS = new Set([
  'Product Demo', 'Social Reel', 'YouTube Short', 'Explainer', 'Promo', 'Animation',
])

// POST /api/ai/videos — kick off an AI video generation job.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      prompt,
      preset,
      duration,
      resolution,
      projectId,
    } = body as {
      prompt?: string
      preset?: string
      duration?: number
      resolution?: string
      projectId?: string
    }

    // ── Validate prompt ──────────────────────────────────────────────────
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }
    if (prompt.length > 1000) {
      return NextResponse.json({ error: 'Prompt must be 1000 characters or fewer.' }, { status: 400 })
    }
    const cleanPrompt = prompt.trim()

    // ── Validate preset ──────────────────────────────────────────────────
    const cleanPreset =
      preset && VALID_PRESETS.has(preset) ? preset : 'Social Reel'

    // ── Validate duration ─────────────────────────────────────────────────
    // Real video models support: 5s, 10s (Kling, CogVideoX)
    let cleanDuration = 5
    if (duration !== undefined) {
      const d = Number(duration)
      if (!VALID_DURATIONS.has(d)) {
        return NextResponse.json(
          { error: `Duration must be 5 or 10 seconds. Received: ${duration}` },
          { status: 400 },
        )
      }
      cleanDuration = d
    }

    // ── Validate resolution ───────────────────────────────────────────────
    // Real video models support: 720p, 1080p (4K is NOT supported)
    let cleanResolution = '1080p'
    if (resolution !== undefined) {
      if (!VALID_RESOLUTIONS.has(resolution)) {
        return NextResponse.json(
          { error: 'Resolution must be 720p or 1080p. 4K is not supported by current video models.' },
          { status: 400 },
        )
      }
      cleanResolution = resolution
    }

    // ── Authenticated user ─────────────────────────────────────────────────────────
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No user account is available.' }, { status: 400 })
    }

    // ── Call the engine ──────────────────────────────────────────────────
    const result = await generateVideo({
      prompt: cleanPrompt,
      preset: cleanPreset,
      duration: cleanDuration,
      resolution: cleanResolution,
      userId: user.id,
      workspaceId: user.workspaceId,
      projectId,
    })

    // ── Creator-safe response (strip providerSlug, modelId, costUsd) ──
    return NextResponse.json({
      jobId: result.jobId,
      status: result.status,
      creditsUsed: result.creditsUsed,
      remainingCredits: result.remainingCredits,
    })
  } catch (e) {
    console.error('AI video generation error:', e)
    const { status, message } = mapEngineError(e)
    return NextResponse.json({ error: message }, { status })
  }
}
