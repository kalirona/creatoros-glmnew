// ============================================================================
// AI Engine — Main entry point
// ----------------------------------------------------------------------------
// Creators (and modules) call generateText() / generateImage() / generateVideo()
// and never have to know which provider or model serves the request.
//
// Flow:
//   Creator request
//     ↓
//   resolveRoute(category)          → picks provider + model
//     ↓
//   checkRateLimit(workspace, user) → blocks abuse
//     ↓
//   checkCredits(user, cost)        → blocks unpaid usage
//     ↓
//   adapter.generateText/Image()    → actual provider call (with fallback)
//     ↓
//   deductCredits + trackUsage + trackCost + writeLog
//     ↓
//   Save AiGeneration + AiAsset (auto-save to Media Library)
// ============================================================================

import { db } from '@/lib/db'
import { resolveRoute, invalidateRouteCache } from './router'
import { withFallback, type ChatMessage } from './providers'
import {
  checkCredits, deductCredits, trackUsage, trackCost, writeLog,
  checkRateLimit, estimateCost,
} from './cost'
import {
  ASPECT_RATIOS, TOOL_ROUTE_MAP,
  type GenerateImageParams, type GenerateImageResult,
  type GenerateTextParams, type GenerateTextResult,
  type GenerateVideoParams, type GenerateVideoResult,
  type RouteCategory,
} from './types'

// ─── Generate text (chat, documents, courses, marketing, etc.) ────────────

export async function generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
  const routeCategory = params.routeCategory || TOOL_ROUTE_MAP[params.toolSlug] || 'WRITING'

  // 1. Resolve route (which provider + model)
  let route = await resolveRoute(routeCategory)
  if (!route) {
    // Try fallback to any TEXT-capable provider
    route = await resolveRoute('WRITING')
  }
  if (!route) {
    throw new Error('No AI provider is currently active. Please contact your administrator.')
  }

  // 2. Look up the tool for cost info
  const tool = await db.aiTool.findUnique({ where: { slug: params.toolSlug } })
  if (!tool) throw new Error(`Unknown AI tool: ${params.toolSlug}`)
  if (!tool.isVisible) throw new Error('This AI tool is currently disabled.')

  // 3. Rate limit check
  const rl = await checkRateLimit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    routeCategory,
  })
  if (!rl.ok) {
    throw new Error(rl.message || 'Rate limit exceeded. Please slow down.')
  }

  // 4. Credit check
  const creditCheck = await checkCredits(params.userId, tool.creditCost)
  if (!creditCheck.ok) {
    throw new Error(creditCheck.message || `Insufficient credits. Need ${tool.creditCost}, have ${creditCheck.remaining}.`)
  }

  // 5. Call provider (with fallback)
  const messages: ChatMessage[] = [
    { role: 'user', content: params.userInput },
  ]
  const { result: completion, usedSlug } = await withFallback(
    route.providerSlug as any,
    (route.fallbackProviderSlug as any) || 'zai',
    (adapter) => adapter.generateText(messages, {
      temperature: params.temperature ?? tool.temperature,
      maxTokens: params.maxTokens ?? tool.maxTokens,
      systemPrompt: params.systemPrompt || tool.systemPrompt,
    }),
  )

  // 6. Compute cost
  const costUsd = estimateCost('TEXT', completion.inputTokens, completion.outputTokens, 1.0)

  // 7. Try to parse structured output if applicable
  let structured: Record<string, unknown> = {}
  if (tool.outputType !== 'MARKDOWN') {
    structured = parseStructured(completion.text)
  }

  // 8. Save generation record
  const generation = await db.aiGeneration.create({
    data: {
      userId: params.userId,
      workspaceId: params.workspaceId,
      toolId: tool.id,
      toolSlug: tool.slug,
      routeCategory,
      providerSlug: usedSlug,
      modelId: route.modelId,
      title: (params.title || params.userInput).slice(0, 120),
      input: params.userInput,
      output: completion.text,
      structured: JSON.stringify(structured),
      status: 'COMPLETED',
      creditsUsed: tool.creditCost,
      costUsd,
      durationMs: completion.durationMs,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      metadata: JSON.stringify(params.metadata || {}),
      completedAt: new Date(),
    },
  })

  // 9. Deduct credits
  const remainingCredits = await deductCredits(params.userId, tool.creditCost, `AI: ${tool.name}`)

  // 10. Track usage + cost + audit log
  await Promise.all([
    trackUsage({
      workspaceId: params.workspaceId,
      userId: params.userId,
      toolSlug: tool.slug,
      routeCategory,
      providerSlug: usedSlug,
      creditsUsed: tool.creditCost,
      costUsd,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      durationMs: completion.durationMs,
    }),
    trackCost({
      providerId: route.providerId,
      costUsd,
      credits: tool.creditCost,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
    }),
    writeLog({
      workspaceId: params.workspaceId,
      userId: params.userId,
      providerId: route.providerId,
      providerSlug: usedSlug,
      modelId: route.modelId,
      toolSlug: tool.slug,
      routeCategory,
      requestType: 'GENERATE',
      inputPreview: params.userInput,
      status: 'OK',
      durationMs: completion.durationMs,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      creditsUsed: tool.creditCost,
      costUsd,
    }),
  ])

  return {
    generationId: generation.id,
    raw: completion.text,
    structured,
    providerSlug: usedSlug,
    modelId: route.modelId,
    creditsUsed: tool.creditCost,
    costUsd,
    remainingCredits,
    durationMs: completion.durationMs,
    inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens,
  }
}

// ─── Generate image (auto-saves to Media Library) ─────────────────────────

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const routeCategory: RouteCategory = 'IMAGE'
  const ratio = ASPECT_RATIOS[params.aspectRatio || '1:1'] || ASPECT_RATIOS['1:1']

  // 1. Resolve route
  let route = await resolveRoute(routeCategory)
  if (!route) route = await resolveRoute('WRITING') // fallback
  if (!route) throw new Error('No image provider is currently active. Please contact your administrator.')

  // 2. Get cost (image gen is 3 credits by default, override via tool)
  const tool = await db.aiTool.findUnique({ where: { slug: 'IMAGE_GEN' } })
  const creditCost = tool?.creditCost ?? 3

  // 3. Rate limit + credit checks
  const rl = await checkRateLimit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    routeCategory,
  })
  if (!rl.ok) throw new Error(rl.message || 'Rate limit exceeded.')

  const creditCheck = await checkCredits(params.userId, creditCost)
  if (!creditCheck.ok) throw new Error(creditCheck.message || 'Insufficient credits.')

  // 4. Call provider (with fallback)
  const { result: image, usedSlug } = await withFallback(
    route.providerSlug as any,
    (route.fallbackProviderSlug as any) || 'zai',
    (adapter) => adapter.generateImage(params.prompt, {
      width: ratio.w,
      height: ratio.h,
      style: params.style,
    }),
  )

  // 5. Cost tracking
  const costUsd = estimateCost('IMAGE', 0, 0, 1.0)

  // 6. Save generation record
  const generation = await db.aiGeneration.create({
    data: {
      userId: params.userId,
      workspaceId: params.workspaceId,
      toolId: tool?.id || 'image-gen',
      toolSlug: 'IMAGE_GEN',
      routeCategory,
      providerSlug: usedSlug,
      modelId: route.modelId,
      title: (params.title || params.prompt).slice(0, 120),
      input: params.prompt,
      output: image.url,
      structured: JSON.stringify({ url: image.url, width: image.width, height: image.height }),
      status: 'COMPLETED',
      creditsUsed: creditCost,
      costUsd,
      durationMs: image.durationMs,
      metadata: JSON.stringify({
        style: params.style,
        aspectRatio: params.aspectRatio,
        negativePrompt: params.negativePrompt,
        seed: params.seed,
      }),
      completedAt: new Date(),
    },
  })

  // 7. Auto-save to Media Library (AiAsset)
  const asset = await db.aiAsset.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      generationId: generation.id,
      type: 'IMAGE',
      folder: 'AI Images',
      name: (params.title || params.prompt).slice(0, 80) || 'AI Image',
      description: params.prompt.slice(0, 500),
      url: image.url,
      thumbnailUrl: image.url,
      mimeType: 'image/png',
      width: image.width,
      height: image.height,
      prompt: params.prompt,
      style: params.style || '',
      aspectRatio: params.aspectRatio || '1:1',
      tags: JSON.stringify([params.style?.toLowerCase() || 'ai-generated']),
    },
  })

  // 8. Link asset back to generation
  await db.aiGeneration.update({
    where: { id: generation.id },
    data: { assetId: asset.id },
  })

  // 9. Deduct credits
  const remainingCredits = await deductCredits(params.userId, creditCost, `AI Image: ${params.prompt.slice(0, 50)}`)

  // 10. Track usage + cost + log
  await Promise.all([
    trackUsage({
      workspaceId: params.workspaceId,
      userId: params.userId,
      toolSlug: 'IMAGE_GEN',
      routeCategory,
      providerSlug: usedSlug,
      creditsUsed: creditCost,
      costUsd,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: image.durationMs,
    }),
    trackCost({
      providerId: route.providerId,
      costUsd,
      credits: creditCost,
      inputTokens: 0,
      outputTokens: 0,
    }),
    writeLog({
      workspaceId: params.workspaceId,
      userId: params.userId,
      providerId: route.providerId,
      providerSlug: usedSlug,
      modelId: route.modelId,
      toolSlug: 'IMAGE_GEN',
      routeCategory,
      requestType: 'IMAGE',
      inputPreview: `${params.style ? `[${params.style}] ` : ''}${params.prompt}`,
      status: 'OK',
      durationMs: image.durationMs,
      inputTokens: 0,
      outputTokens: 0,
      creditsUsed: creditCost,
      costUsd,
    }),
  ])

  return {
    generationId: generation.id,
    assetId: asset.id,
    url: image.url,
    thumbnailUrl: image.url,
    width: image.width,
    height: image.height,
    creditsUsed: creditCost,
    costUsd,
    remainingCredits,
    durationMs: image.durationMs,
  }
}

// ─── Generate video (async — goes through AiJob queue) ────────────────────

export async function generateVideo(params: GenerateVideoParams): Promise<GenerateVideoResult> {
  const routeCategory: RouteCategory = 'VIDEO'

  // 1. Resolve route
  let route = await resolveRoute(routeCategory)
  if (!route) route = await resolveRoute('IMAGE') // many image providers also do video
  if (!route) throw new Error('No video provider is currently active. Please contact your administrator.')

  // 2. Cost — video is expensive (15 credits default)
  const tool = await db.aiTool.findUnique({ where: { slug: 'VIDEO_GEN' } })
  const creditCost = tool?.creditCost ?? 15

  // 3. Rate + credit checks
  const rl = await checkRateLimit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    routeCategory,
  })
  if (!rl.ok) throw new Error(rl.message || 'Rate limit exceeded.')

  const creditCheck = await checkCredits(params.userId, creditCost)
  if (!creditCheck.ok) throw new Error(creditCheck.message || 'Insufficient credits.')

  // 4. Create AiJob in QUEUED state (real video generation is async; in sandbox we simulate)
  const job = await db.aiJob.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      providerId: route.providerId,
      providerSlug: route.providerSlug,
      type: 'VIDEO_GEN',
      prompt: params.prompt,
      params: JSON.stringify({
        preset: params.preset || 'Social Reel',
        duration: params.duration || 8,
        resolution: params.resolution || '1080p',
      }),
      status: 'QUEUED',
      creditsUsed: creditCost,
      costUsd: estimateCost('VIDEO', 0, 0, 1.0),
    },
  })

  // 5. Deduct credits
  const remainingCredits = await deductCredits(params.userId, creditCost, `AI Video: ${params.prompt.slice(0, 50)}`)

  // 6. Track usage + cost + log
  await Promise.all([
    trackUsage({
      workspaceId: params.workspaceId,
      userId: params.userId,
      toolSlug: 'VIDEO_GEN',
      routeCategory,
      providerSlug: route.providerSlug,
      creditsUsed: creditCost,
      costUsd: job.costUsd,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
    }),
    trackCost({
      providerId: route.providerId,
      costUsd: job.costUsd,
      credits: creditCost,
      inputTokens: 0,
      outputTokens: 0,
    }),
    writeLog({
      workspaceId: params.workspaceId,
      userId: params.userId,
      providerId: route.providerId,
      providerSlug: route.providerSlug,
      modelId: route.modelId,
      toolSlug: 'VIDEO_GEN',
      routeCategory,
      requestType: 'VIDEO',
      inputPreview: `[${params.preset || 'Social Reel'}] ${params.prompt}`,
      status: 'OK',
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      creditsUsed: creditCost,
      costUsd: job.costUsd,
    }),
  ])

  // 7. Kick off background simulation (in production this would call Fal AI's queue API)
  // We simulate by immediately marking RENDERING, then later polling will mark COMPLETED.
  // For the sandbox, we kick a setTimeout to flip the state so the UI's poll loop can see progress.
  simulateJobProgress(job.id).catch((e) => console.error('[ai-engine] job sim failed:', e))

  return {
    jobId: job.id,
    status: 'QUEUED',
    creditsUsed: creditCost,
    costUsd: job.costUsd,
    remainingCredits,
  }
}

// ─── Job simulation (for sandbox — real providers replace this) ────────────

async function simulateJobProgress(jobId: string): Promise<void> {
  try {
    // QUEUED → RENDERING after 2s
    await sleep(2000)
    await db.aiJob.update({
      where: { id: jobId },
      data: { status: 'RENDERING', progress: 15, startedAt: new Date() },
    })

    // Progress updates every 2s
    for (const pct of [35, 55, 75, 90]) {
      await sleep(2000)
      await db.aiJob.update({
        where: { id: jobId },
        data: { progress: pct, status: pct >= 75 ? 'PROCESSING' : 'RENDERING' },
      })
    }

    // COMPLETED — generate a placeholder video URL
    await sleep(1500)
    const completedAt = new Date()
    const resultUrl = `https://cdn.creatoros.ai/video/${jobId}.mp4`
    const job = await db.aiJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        resultUrl,
        resultMeta: JSON.stringify({ width: 1280, height: 720, duration: 8 }),
        completedAt,
      },
    })

    // Auto-save to Media Library
    await db.aiAsset.create({
      data: {
        workspaceId: job.workspaceId,
        userId: job.userId,
        generationId: null,
        type: 'VIDEO',
        folder: 'AI Videos',
        name: job.prompt.slice(0, 80) || 'AI Video',
        description: job.prompt.slice(0, 500),
        url: resultUrl,
        thumbnailUrl: '', // would be a frame from the video
        mimeType: 'video/mp4',
        width: 1280,
        height: 720,
        duration: 8,
        prompt: job.prompt,
        tags: JSON.stringify(['ai-generated', 'video']),
      },
    })
  } catch (e) {
    console.error('[ai-engine] job sim error:', e)
    await db.aiJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: e instanceof Error ? e.message : 'Unknown error' },
    }).catch(() => {})
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseStructured(raw: string): Record<string, unknown> {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return {}
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return { _parseError: true, _raw: text.slice(0, 500) }
  }
}

// Re-export route cache invalidation for admin endpoints
export { invalidateRouteCache }
