import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  deductCredits,
  checkCredits,
  trackUsage,
  writeLog,
} from '@/lib/ai-engine'
import {
  mapEngineError,
} from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'

const VALID_ACTIONS = new Set([
  'upscale',
  'remove-bg',
  'crop',
  'resize',
  'variations',
  'edit',
])

const ACTION_CREDIT_COST = 2

// POST /api/ai/images/:id/actions — perform an action on an existing image.
// Sandbox behavior: create a new AiAsset that reuses the original image URL.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { action, params: actionParams } = body as {
      action?: string
      params?: Record<string, unknown>
    }

    // ── Validate action ────────────────────────────────────────────────────
    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Allowed: upscale, remove-bg, crop, resize, variations, edit.' },
        { status: 400 },
      )
    }
    const p = actionParams || {}

    // ── Validate action-specific params ─────────────────────────────────────
    if ((action === 'crop' || action === 'resize')) {
      const w = Number(p.width)
      const h = Number(p.height)
      if (!Number.isInteger(w) || w <= 0 || w > 4096 ||
          !Number.isInteger(h) || h <= 0 || h > 4096) {
        return NextResponse.json(
          { error: `${action} requires params.width and params.height (positive integers ≤ 4096).` },
          { status: 400 },
        )
      }
    }
    if (action === 'edit') {
      if (typeof p.prompt !== 'string' || !p.prompt.trim()) {
        return NextResponse.json(
          { error: 'edit requires params.prompt.' },
          { status: 400 },
        )
      }
    }

    // ── Resolve authenticated user ──────────────────────────────────────────
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    // ── Fetch original asset ────────────────────────────────────────────────
    const original = await db.aiAsset.findFirst({
      where: { id, workspaceId: user.workspaceId, type: 'IMAGE' },
    })
    if (!original) {
      return NextResponse.json({ error: 'Image not found.' }, { status: 404 })
    }

    // ── Credit check ───────────────────────────────────────────────────────
    const creditCheck = await checkCredits(user.id, ACTION_CREDIT_COST)
    if (!creditCheck.ok) {
      return NextResponse.json(
        { error: `You need ${ACTION_CREDIT_COST} credits but have ${creditCheck.remaining}. Top up your account to continue.` },
        { status: 402 },
      )
    }

    // ── Build new asset fields based on action ─────────────────────────────
    let newName = `${original.name} (${action})`
    let newWidth = original.width
    let newHeight = original.height
    let newPrompt = `[${action}] ${original.prompt}`

    switch (action) {
      case 'upscale':
        newName = `${original.name} (upscaled)`
        newWidth = original.width * 2
        newHeight = original.height * 2
        break
      case 'remove-bg':
        newName = `${original.name} (no bg)`
        break
      case 'variations':
        newName = `${original.name} (variation)`
        break
      case 'crop':
      case 'resize':
        newName = `${original.name} (${action} ${p.width}x${p.height})`
        newWidth = Number(p.width)
        newHeight = Number(p.height)
        break
      case 'edit':
        newName = `${original.name} (edited)`
        newPrompt = `[edit] ${String(p.prompt).slice(0, 500)}`
        break
    }

    // ── Save new asset (reuses original URL — sandbox) ─────────────────────
    const newAsset = await db.aiAsset.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        type: 'IMAGE',
        folder: original.folder || 'AI Images',
        name: newName.slice(0, 200),
        description: original.description,
        url: original.url,
        thumbnailUrl: original.thumbnailUrl || original.url,
        mimeType: original.mimeType || 'image/png',
        width: newWidth,
        height: newHeight,
        prompt: newPrompt,
        style: original.style,
        aspectRatio: original.aspectRatio,
        tags: original.tags,
      },
    })

    // ── Increment original.usedIn count via JSON array ─────────────────────
    // We treat the action itself as a "use" so usedIn grows.
    try {
      const usedInRaw = JSON.parse(original.usedIn || '[]') as Array<Record<string, unknown>>
      usedInRaw.push({
        module: 'image-action',
        entityId: newAsset.id,
        entityName: action,
        usedAt: new Date().toISOString(),
      })
      await db.aiAsset.update({
        where: { id: original.id },
        data: {
          usedIn: JSON.stringify(usedInRaw),
          isUsed: true,
        },
      })
    } catch {
      // non-fatal
    }

    // ── Save AiGeneration record (toolSlug=IMAGE_EDIT, routeCategory=IMAGE) ──
    const tool = await db.aiTool.findUnique({ where: { slug: 'IMAGE_GEN' } })
    await db.aiGeneration.create({
      data: {
        userId: user.id,
        workspaceId: user.workspaceId,
        toolId: tool?.id || 'image-gen',
        toolSlug: 'IMAGE_EDIT',
        routeCategory: 'IMAGE',
        providerSlug: '',
        modelId: '',
        title: `${action} → ${original.name}`.slice(0, 120),
        input: original.prompt,
        output: newAsset.url,
        structured: JSON.stringify({ action, assetId: newAsset.id }),
        status: 'COMPLETED',
        creditsUsed: ACTION_CREDIT_COST,
        costUsd: 0,
        durationMs: 0,
        assetId: newAsset.id,
        metadata: JSON.stringify({ action, params: p }),
        completedAt: new Date(),
      },
    })

    // ── Deduct credits ────────────────────────────────────────────────────
    const remainingCredits = await deductCredits(
      user.id,
      ACTION_CREDIT_COST,
      `AI Image ${action}: ${original.name.slice(0, 50)}`,
    )

    // ── Track usage + log (admin-only audit) ──────────────────────────────
    // Look up a real IMAGE-capable provider for the AiLog FK (best-effort).
    const imageProvider = await db.aiProvider.findFirst({
      where: { capabilities: { contains: 'IMAGE' } },
      select: { id: true, slug: true },
    })
    await Promise.all([
      trackUsage({
        workspaceId: user.workspaceId,
        userId: user.id,
        toolSlug: 'IMAGE_EDIT',
        routeCategory: 'IMAGE',
        providerSlug: imageProvider?.slug || '',
        creditsUsed: ACTION_CREDIT_COST,
        costUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
      }).catch(() => {}),
      imageProvider
        ? writeLog({
            workspaceId: user.workspaceId,
            userId: user.id,
            providerId: imageProvider.id,
            providerSlug: imageProvider.slug,
            modelId: '',
            toolSlug: 'IMAGE_EDIT',
            routeCategory: 'IMAGE',
            requestType: 'IMAGE_EDIT',
            inputPreview: `[${action}] ${original.prompt}`.slice(0, 500),
            status: 'OK',
            durationMs: 0,
            inputTokens: 0,
            outputTokens: 0,
            creditsUsed: ACTION_CREDIT_COST,
            costUsd: 0,
          }).catch(() => {})
        : Promise.resolve(),
    ])

    // ── Creator-safe response ─────────────────────────────────────────────
    return NextResponse.json({
      assetId: newAsset.id,
      url: newAsset.url,
      creditsUsed: ACTION_CREDIT_COST,
      remainingCredits,
    })
  } catch (e) {
    console.error('AI image action error:', e)
    const { status, message } = mapEngineError(e)
    return NextResponse.json({ error: message }, { status })
  }
}
