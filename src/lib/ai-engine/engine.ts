// ============================================================================
// AI Engine — Main entry point (SINGLE SOURCE OF TRUTH for all AI requests)
// ----------------------------------------------------------------------------
// Creators (and modules) call generateText() / generateImage() / generateVideo()
// and never have to know which provider or model serves the request.
//
// Flow:
//   Creator request
//     ↓
//   resolveRoute(category)          → picks provider + approved model
//     ↓
//   If no route → throw error (NO hardcoded fallback)
//     ↓
//   loadSystemPrompts()             → injects admin-configured prompts
//     ↓
//   checkRateLimit(workspace, user) → blocks abuse
//     ↓
//   checkCredits(user, cost)        → blocks unpaid usage
//     ↓
//   adapter.generateText/Image()    → actual provider call
//     ↓
//   deductCredits + trackUsage + trackCost + writeLog
//     ↓
//   Save AiGeneration + AiAsset (auto-save to Media Library)
//
// CRITICAL: This is the ONLY routing implementation. No API route should
// call ZAI.create() directly — they must all go through this engine.
// ============================================================================

import { db } from '@/lib/db'
import { resolveRoute, invalidateRouteCache } from './router'
import { getAdapter, type ChatMessage } from './providers'
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

// ─── Load active system prompts from the database ──────────────────────────
// Super Admin configures prompts in AI Settings → Prompt Library.
// Active prompts are injected into every AI request.
async function loadSystemPrompts(): Promise<string> {
  try {
    const setting = await db.adminSetting.findUnique({ where: { key: 'ai_prompts' } })
    if (!setting?.value) return ''
    const prompts = JSON.parse(setting.value) as Array<{
      content: string
      isActive: boolean
      category: string
    }>
    const activePrompts = prompts.filter((p) => p.isActive)
    if (activePrompts.length === 0) return ''
    return activePrompts.map((p) => p.content).join('\n\n---\n\n')
  } catch {
    return ''
  }
}

// ─── Generate text (chat, documents, courses, marketing, etc.) ────────────

export async function generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
  const routeCategory = params.routeCategory || TOOL_ROUTE_MAP[params.toolSlug] || 'WRITING'

  // 1. Resolve route — ONLY from ApprovedModel table
  const route = await resolveRoute(routeCategory)
  if (!route) {
    // NO hardcoded fallback — throw a meaningful error
    throw new Error(`No enabled model available for ${routeCategory}. Please ask your administrator to approve a model for this capability.`)
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

  // 5. Build system prompt: admin-configured prompts + tool prompt + user prompt
  const adminPrompts = await loadSystemPrompts()
  const systemPrompt = [
    adminPrompts,
    params.systemPrompt || tool.systemPrompt,
  ].filter(Boolean).join('\n\n')

  // 6. Call provider — try the resolved provider's adapter
  // If it fails (e.g. no real API key), try other approved providers for the same capability
  const messages: ChatMessage[] = [
    { role: 'user', content: params.userInput },
  ]

  const capabilityMap: Record<string, string> = {
    WRITING: 'TEXT', MARKETING: 'TEXT', COURSE: 'TEXT', WEBSITE: 'TEXT',
    SEO: 'TEXT', EMAIL: 'TEXT', BLOG: 'TEXT', CRM: 'TEXT', AUTOMATION: 'TEXT',
    IMAGE: 'IMAGE', VIDEO: 'VIDEO', VOICE: 'TTS', STT: 'STT', EMBEDDING: 'EMBEDDING',
  }
  const neededModality = capabilityMap[routeCategory] || 'TEXT'

  let completion: { text: string; inputTokens: number; outputTokens: number; durationMs: number } | null = null
  let usedRoute = route

  // Try the primary route first
  try {
    const adapter = getAdapter(route.providerSlug as any)
    completion = await adapter.generateText(messages, {
      temperature: params.temperature ?? tool.temperature,
      maxTokens: params.maxTokens ?? tool.maxTokens,
      systemPrompt,
    })
  } catch (primaryErr) {
    // Primary failed — try other approved providers with the same modality
    const otherApproved = await db.approvedModel.findMany({
      where: {
        modality: neededModality,
        isEnabled: true,
        workspaceVisible: true,
        providerId: { not: route.providerId },
      },
      include: { provider: { select: { id: true, slug: true, name: true, isActive: true, isHealthy: true } } },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
      take: 5,
    })

    for (const m of otherApproved) {
      if (!m.provider.isActive || !m.provider.isHealthy) continue
      try {
        const adapter = getAdapter(m.provider.slug as any)
        completion = await adapter.generateText(messages, {
          temperature: params.temperature ?? tool.temperature,
          maxTokens: params.maxTokens ?? tool.maxTokens,
          systemPrompt,
        })
        usedRoute = {
          providerId: m.provider.id,
          providerSlug: m.provider.slug,
          providerName: m.provider.name,
          modelId: m.id,
          modelName: m.modelId,
          strategy: 'failover',
        }
        break
      } catch {
        continue // try next provider
      }
    }

    if (!completion) {
      // All providers failed
      throw new Error(`No available AI provider could handle this request. Primary error: ${primaryErr instanceof Error ? primaryErr.message : 'Unknown'}. Please ask your administrator to check provider configuration.`)
    }
  }

  // 7. Compute cost
  const costUsd = estimateCost('TEXT', completion.inputTokens, completion.outputTokens, 1.0)

  // 8. Try to parse structured output if applicable
  let structured: Record<string, unknown> = {}
  if (tool.outputType !== 'MARKDOWN') {
    structured = parseStructured(completion.text)
  }

  // 9. Save generation record
  const generation = await db.aiGeneration.create({
    data: {
      userId: params.userId,
      workspaceId: params.workspaceId,
      toolId: tool.id,
      toolSlug: tool.slug,
      routeCategory,
      providerSlug: usedRoute.providerSlug,
      modelId: usedRoute.modelId,
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

  // 10. Deduct credits
  const remainingCredits = await deductCredits(params.userId, tool.creditCost, `AI: ${tool.name}`)

  // 11. Track usage + cost + audit log
  await Promise.all([
    trackUsage({
      workspaceId: params.workspaceId,
      userId: params.userId,
      toolSlug: tool.slug,
      routeCategory,
      providerSlug: usedRoute.providerSlug,
      creditsUsed: tool.creditCost,
      costUsd,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      durationMs: completion.durationMs,
    }),
    trackCost({
      providerId: usedRoute.providerId,
      costUsd,
      credits: tool.creditCost,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
    }),
    writeLog({
      workspaceId: params.workspaceId,
      userId: params.userId,
      providerId: usedRoute.providerId,
      providerSlug: usedRoute.providerSlug,
      modelId: usedRoute.modelId,
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
    providerSlug: usedRoute.providerSlug,
    modelId: usedRoute.modelId,
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

  // 1. Resolve route — ONLY from ApprovedModel table (IMAGE capability)
  const route = await resolveRoute(routeCategory)
  if (!route) {
    // NO fallback to TEXT — image generation needs IMAGE capability
    throw new Error('No enabled image model available. Please ask your administrator to approve an image model.')
  }

  // 2. Get cost
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

  // 4. Call provider — use the resolved provider's adapter (NO hardcoded fallback)
  const adapter = getAdapter(route.providerSlug as any)
  const image = await adapter.generateImage(params.prompt, {
    width: ratio.w,
    height: ratio.h,
    style: params.style,
  })

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
      providerSlug: route.providerSlug,
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
      providerSlug: route.providerSlug,
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
      providerSlug: route.providerSlug,
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

  // 1. Resolve route — ONLY from ApprovedModel table (VIDEO capability)
  const route = await resolveRoute(routeCategory)
  if (!route) {
    throw new Error('No enabled video model available. Please ask your administrator to approve a video model.')
  }

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

  // 4. Create AiJob in QUEUED state
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

  // 7. Kick off background simulation
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
    // Get the job to read actual params
    const job = await db.aiJob.findUnique({ where: { id: jobId } })
    if (!job) return
    const jobParams = JSON.parse(job.params || '{}')
    const videoDuration = jobParams.duration || 5
    const videoResolution = jobParams.resolution || '1080p'
    const [w, h] = videoResolution === '720p' ? [1280, 720] : [1920, 1080]

    await sleep(2000)
    await db.aiJob.update({
      where: { id: jobId },
      data: { status: 'RENDERING', progress: 15, startedAt: new Date() },
    })

    for (const pct of [35, 55, 75, 90]) {
      await sleep(2000)
      await db.aiJob.update({
        where: { id: jobId },
        data: { progress: pct, status: pct >= 75 ? 'PROCESSING' : 'RENDERING' },
      })
    }

    await sleep(1500)
    const completedAt = new Date()
    const resultUrl = `https://cdn.creatoros.ai/video/${jobId}.mp4`
    const updatedJob = await db.aiJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        resultUrl,
        resultMeta: JSON.stringify({ width: w, height: h, duration: videoDuration }),
        completedAt,
      },
    })

    await db.aiAsset.create({
      data: {
        workspaceId: updatedJob.workspaceId,
        userId: updatedJob.userId,
        generationId: null,
        type: 'VIDEO',
        folder: 'AI Videos',
        name: updatedJob.prompt.slice(0, 80) || 'AI Video',
        description: updatedJob.prompt.slice(0, 500),
        url: resultUrl,
        thumbnailUrl: '',
        mimeType: 'video/mp4',
        width: w,
        height: h,
        duration: videoDuration,
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
