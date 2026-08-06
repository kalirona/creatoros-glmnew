import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  generateVideo,
  VIDEO_PRESETS,
} from '@/lib/ai-engine'
import {
  getDemoUser,
  DEMO_WORKSPACE_ID,
  mapEngineError,
} from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VALID_RESOLUTIONS = new Set(['720p', '1080p', '4K'])

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
    const validPresets = VIDEO_PRESETS as readonly string[]
    const cleanPreset =
      preset && validPresets.includes(preset) ? preset : undefined

    // ── Validate duration ─────────────────────────────────────────────────
    let cleanDuration: number | undefined
    if (duration !== undefined) {
      const d = Number(duration)
      if (!Number.isFinite(d) || d < 1 || d > 60) {
        return NextResponse.json(
          { error: 'Duration must be between 1 and 60 seconds.' },
          { status: 400 },
        )
      }
      cleanDuration = Math.floor(d)
    }

    // ── Validate resolution ───────────────────────────────────────────────
    let cleanResolution: string | undefined
    if (resolution !== undefined) {
      if (!VALID_RESOLUTIONS.has(resolution)) {
        return NextResponse.json(
          { error: 'Resolution must be one of: 720p, 1080p, 4K.' },
          { status: 400 },
        )
      }
      cleanResolution = resolution
    }

    // ── Demo user ─────────────────────────────────────────────────────────
    const user = await getDemoUser()
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
      workspaceId: DEMO_WORKSPACE_ID,
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
