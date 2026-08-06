// ============================================================================
// AI Engine — Cost, Credit & Usage tracking
// ----------------------------------------------------------------------------
// Every AI request goes through these helpers so we always:
//  1. Validate the user has enough credits
//  2. Deduct credits atomically
//  3. Track usage per workspace/user/tool/day for analytics
//  4. Track cost per provider/day for budget alerts
//  5. Log every request to AiLog (admin-only audit trail)
// ============================================================================

import { db } from '@/lib/db'
import { DEFAULT_COST_USD } from './types'
import type { Modality, ProviderSlug, RouteCategory } from './types'

// ─── Credit check & deduction ─────────────────────────────────────────────

export async function checkCredits(userId: string, required: number) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { credits: true } })
  if (!user) return { ok: false, remaining: 0, required, message: 'User not found' }
  return {
    ok: user.credits >= required,
    remaining: user.credits,
    required,
    message: user.credits < required
      ? `Insufficient credits. Need ${required}, have ${user.credits}.`
      : undefined,
  }
}

export async function deductCredits(
  userId: string,
  amount: number,
  reason: string,
): Promise<number> {
  const updated = await db.user.update({
    where: { id: userId },
    data: { credits: { decrement: amount } },
    select: { credits: true },
  })
  await db.creditTransaction.create({
    data: { userId, amount: -amount, reason },
  })
  return updated.credits
}

// ─── Usage aggregation (per workspace/user/tool/day) ──────────────────────

export async function trackUsage(opts: {
  workspaceId: string
  userId: string
  toolSlug: string
  routeCategory: RouteCategory
  providerSlug: string
  creditsUsed: number
  costUsd: number
  inputTokens: number
  outputTokens: number
  durationMs: number
  failed?: boolean
}): Promise<void> {
  const day = startOfDay(new Date())
  try {
    await db.aiUsage.upsert({
      where: {
        workspaceId_userId_toolSlug_day: {
          workspaceId: opts.workspaceId,
          userId: opts.userId,
          toolSlug: opts.toolSlug,
          day,
        },
      },
      create: {
        workspaceId: opts.workspaceId,
        userId: opts.userId,
        toolSlug: opts.toolSlug,
        routeCategory: opts.routeCategory,
        providerSlug: opts.providerSlug,
        day,
        requests: 1,
        creditsUsed: opts.creditsUsed,
        costUsd: opts.costUsd,
        inputTokens: opts.inputTokens,
        outputTokens: opts.outputTokens,
        durationMs: opts.durationMs,
        failures: opts.failed ? 1 : 0,
      },
      update: {
        requests: { increment: 1 },
        creditsUsed: { increment: opts.creditsUsed },
        costUsd: { increment: opts.costUsd },
        inputTokens: { increment: opts.inputTokens },
        outputTokens: { increment: opts.outputTokens },
        durationMs: { increment: opts.durationMs },
        failures: { increment: opts.failed ? 1 : 0 },
      },
    })
  } catch (e) {
    console.error('[ai-engine] trackUsage failed:', e)
  }
}

// ─── Per-provider cost aggregation (for budgets & admin dashboard) ────────

export async function trackCost(opts: {
  providerId: string
  costUsd: number
  credits: number
  inputTokens: number
  outputTokens: number
  failed?: boolean
}): Promise<{ budgetExceeded: boolean }> {
  const day = startOfDay(new Date())
  try {
    const cost = await db.aiCost.upsert({
      where: { providerId_day: { providerId: opts.providerId, day } },
      create: {
        providerId: opts.providerId,
        day,
        totalCostUsd: opts.costUsd,
        totalCredits: opts.credits,
        requests: 1,
        failures: opts.failed ? 1 : 0,
        inputTokens: opts.inputTokens,
        outputTokens: opts.outputTokens,
      },
      update: {
        totalCostUsd: { increment: opts.costUsd },
        totalCredits: { increment: opts.credits },
        requests: { increment: 1 },
        failures: { increment: opts.failed ? 1 : 0 },
        inputTokens: { increment: opts.inputTokens },
        outputTokens: { increment: opts.outputTokens },
      },
    })

    // Check provider budget — auto-disable if exceeded
    const provider = await db.aiProvider.findUnique({
      where: { id: opts.providerId },
      select: { dailyBudget: true, isActive: true, name: true },
    })
    if (provider && cost.totalCostUsd >= provider.dailyBudget && provider.isActive) {
      await db.aiProvider.update({
        where: { id: opts.providerId },
        data: { isActive: false },
      })
      await db.aiCost.update({
        where: { id: cost.id },
        data: { budgetExceeded: true, autoDisabled: true },
      })
      console.warn(`[ai-engine] Provider "${provider.name}" auto-disabled: daily budget $${provider.dailyBudget} exceeded`)
      return { budgetExceeded: true }
    }
    return { budgetExceeded: false }
  } catch (e) {
    console.error('[ai-engine] trackCost failed:', e)
    return { budgetExceeded: false }
  }
}

// ─── Audit log (admin-only) ───────────────────────────────────────────────

export async function writeLog(opts: {
  workspaceId: string
  userId: string
  providerId: string
  providerSlug: string
  modelId: string
  toolSlug: string
  routeCategory: RouteCategory
  requestType: string
  inputPreview: string
  status: string
  errorCode?: string
  errorMessage?: string
  durationMs: number
  inputTokens: number
  outputTokens: number
  creditsUsed: number
  costUsd: number
  ip?: string
  userAgent?: string
}): Promise<void> {
  try {
    await db.aiLog.create({
      data: {
        workspaceId: opts.workspaceId,
        userId: opts.userId,
        providerId: opts.providerId,
        providerSlug: opts.providerSlug,
        modelId: opts.modelId,
        toolSlug: opts.toolSlug,
        routeCategory: opts.routeCategory,
        requestType: opts.requestType,
        inputPreview: opts.inputPreview.slice(0, 500),
        status: opts.status,
        errorCode: opts.errorCode || '',
        errorMessage: (opts.errorMessage || '').slice(0, 1000),
        durationMs: opts.durationMs,
        inputTokens: opts.inputTokens,
        outputTokens: opts.outputTokens,
        creditsUsed: opts.creditsUsed,
        costUsd: opts.costUsd,
        ip: opts.ip || '',
        userAgent: (opts.userAgent || '').slice(0, 500),
      },
    })
  } catch (e) {
    console.error('[ai-engine] writeLog failed:', e)
  }
}

// ─── Rate limiting (sliding minute window per workspace/user/category) ─────

export async function checkRateLimit(opts: {
  workspaceId: string
  userId: string
  routeCategory: RouteCategory
  maxPerMinute?: number
  maxPerHour?: number
}): Promise<{ ok: boolean; remaining: number; resetAt: Date; message?: string }> {
  const now = new Date()
  const minuteWindow = new Date(Math.floor(now.getTime() / 60_000) * 60_000)
  const maxPerMin = opts.maxPerMinute ?? 60

  try {
    const existing = await db.aiRateLimit.findUnique({
      where: {
        workspaceId_userId_routeCategory_minuteWindow: {
          workspaceId: opts.workspaceId,
          userId: opts.userId,
          routeCategory: opts.routeCategory,
          minuteWindow,
        },
      },
    })

    if (existing && existing.requests >= maxPerMin) {
      const resetAt = new Date(minuteWindow.getTime() + 60_000)
      return {
        ok: false,
        remaining: 0,
        resetAt,
        message: `Rate limit reached (${maxPerMin}/min for ${opts.routeCategory}). Retry after ${resetAt.toLocaleTimeString()}.`,
      }
    }

    // Increment counter (upsert)
    await db.aiRateLimit.upsert({
      where: {
        workspaceId_userId_routeCategory_minuteWindow: {
          workspaceId: opts.workspaceId,
          userId: opts.userId,
          routeCategory: opts.routeCategory,
          minuteWindow,
        },
      },
      create: {
        workspaceId: opts.workspaceId,
        userId: opts.userId,
        routeCategory: opts.routeCategory,
        minuteWindow,
        hourWindow: new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000),
        requests: 1,
        maxPerMinute: maxPerMin,
        maxPerHour: opts.maxPerHour ?? 600,
      },
      update: { requests: { increment: 1 } },
    })

    const current = (existing?.requests ?? 0) + 1
    return {
      ok: true,
      remaining: Math.max(0, maxPerMin - current),
      resetAt: new Date(minuteWindow.getTime() + 60_000),
    }
  } catch (e) {
    console.error('[ai-engine] checkRateLimit failed:', e)
    // Fail open — better to serve than to block on a DB error
    return { ok: true, remaining: 999, resetAt: new Date(Date.now() + 60_000) }
  }
}

// ─── Cost estimation ──────────────────────────────────────────────────────

export function estimateCost(
  modality: Modality,
  inputTokens: number,
  outputTokens: number,
  costMultiplier = 1.0,
): number {
  if (modality === 'TEXT') {
    return ((inputTokens + outputTokens) / 1000) * DEFAULT_COST_USD.TEXT * costMultiplier
  }
  if (modality === 'IMAGE') return DEFAULT_COST_USD.IMAGE * costMultiplier
  if (modality === 'VIDEO') return DEFAULT_COST_USD.VIDEO * costMultiplier
  if (modality === 'EMBEDDING') return (inputTokens / 1000) * DEFAULT_COST_USD.EMBEDDING * costMultiplier
  if (modality === 'STT') return (inputTokens / 1000) * DEFAULT_COST_USD.STT * costMultiplier
  if (modality === 'TTS') return (inputTokens / 1000) * DEFAULT_COST_USD.TTS * costMultiplier
  return 0
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function providerSlugFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Helper used by asset endpoints — what provider served a generation
export function parseProviderInfo(generation: { providerSlug: string; modelId: string }) {
  return {
    providerSlug: generation.providerSlug as ProviderSlug,
    modelId: generation.modelId,
  }
}
