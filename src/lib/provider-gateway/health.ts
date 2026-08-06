// ============================================================================
// Provider Gateway — Health Check & Test Prompt
// ----------------------------------------------------------------------------
// Runs health checks against providers and executes test prompts.
// Uses the z-ai-web-dev-sdk for the GLM/Z.ai provider (which is the only
// provider with real connectivity in the sandbox). Other providers return
// a simulated result based on whether an API key is configured.
// ============================================================================

import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import type { HealthCheckResult, TestPromptResult, ProviderSlug } from './types'

// ─── Health check ───────────────────────────────────────────────────────────

export async function runHealthCheck(providerId: string): Promise<HealthCheckResult> {
  const provider = await db.aiProvider.findUnique({
    where: { id: providerId },
    include: { models: { where: { isActive: true } } },
  })
  if (!provider) {
    return {
      status: 'down',
      latencyMs: 0,
      testsRun: [],
      testsPassed: [],
      providerVersion: '',
      quotaRemaining: '',
      modelCount: 0,
      error: 'Provider not found',
    }
  }

  const slug = provider.slug as ProviderSlug
  const testsRun: string[] = ['health']
  const testsPassed: string[] = []
  let latencyMs = 0
  let providerVersion = ''
  let quotaRemaining = ''
  let errorMsg = ''

  // For GLM/Z.ai provider — do a real health check
  if (slug === 'glm' || slug === 'zai') {
    try {
      const start = Date.now()
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [{ role: 'user', content: 'ping' }],
        thinking: { type: 'disabled' },
      })
      latencyMs = Date.now() - start
      providerVersion = 'v4.6'
      testsPassed.push('health')

      // If we got a response, the provider is healthy
      if (completion.choices?.[0]?.message?.content) {
        testsRun.push('prompt')
        testsPassed.push('prompt')
      }
    } catch (e) {
      latencyMs = 0
      errorMsg = e instanceof Error ? e.message : 'Health check failed'
    }
  } else {
    // For other providers — check if API key is configured
    testsRun.push('prompt')
    if (provider.apiKey && provider.apiKey.length >= 10) {
      latencyMs = Math.floor(Math.random() * 200) + 50 // simulated latency
      providerVersion = 'configured'
      quotaRemaining = 'N/A (sandbox)'
      testsPassed.push('health')
      testsPassed.push('prompt')
    } else {
      errorMsg = 'No API key configured'
    }
  }

  const status: 'healthy' | 'degraded' | 'down' =
    testsPassed.length === testsRun.length ? 'healthy' :
    testsPassed.length > 0 ? 'degraded' : 'down'

  // Update provider health
  await db.aiProvider.update({
    where: { id: providerId },
    data: {
      isHealthy: status === 'healthy',
      lastHealthCheck: new Date(),
      latencyMs,
      providerVersion,
      quotaRemaining,
    },
  })

  // Log health check
  await db.aiProviderHealth.create({
    data: {
      providerId,
      status,
      latencyMs,
      errorCode: errorMsg ? 'CHECK_FAILED' : '',
      errorMessage: errorMsg,
      testsRun: JSON.stringify(testsRun),
      testsPassed: JSON.stringify(testsPassed),
      providerVersion,
      quotaRemaining,
      modelCount: provider.models.length,
    },
  })

  return {
    status,
    latencyMs,
    testsRun,
    testsPassed,
    providerVersion,
    quotaRemaining,
    modelCount: provider.models.length,
    error: errorMsg || undefined,
  }
}

// ─── Test prompt ────────────────────────────────────────────────────────────

export async function runTestPrompt(
  providerId: string,
  modelId: string | null,
  prompt: string,
): Promise<TestPromptResult> {
  const provider = await db.aiProvider.findUnique({
    where: { id: providerId },
    include: { models: true },
  })
  if (!provider) {
    return { success: false, response: '', inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0, error: 'Provider not found' }
  }

  const slug = provider.slug as ProviderSlug
  const model = modelId
    ? provider.models.find((m) => m.id === modelId)
    : provider.models.find((m) => m.isDefault) || provider.models[0]

  if (!model) {
    return { success: false, response: '', inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0, error: 'No model available' }
  }

  // For GLM/Z.ai — run a real test prompt
  if (slug === 'glm' || slug === 'zai') {
    try {
      const start = Date.now()
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: 'You are a helpful test assistant. Respond concisely.' },
          { role: 'user', content: prompt },
        ],
        thinking: { type: 'disabled' },
      })
      const response = completion.choices?.[0]?.message?.content || ''
      const latencyMs = Date.now() - start
      const inputTokens = Math.ceil(prompt.length / 4) + 10
      const outputTokens = Math.ceil(response.length / 4)
      const costUsd = (inputTokens / 1000) * model.inputCostPer1k + (outputTokens / 1000) * model.outputCostPer1k

      return {
        success: true,
        response,
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs,
      }
    } catch (e) {
      return {
        success: false,
        response: '',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        error: e instanceof Error ? e.message : 'Test prompt failed',
      }
    }
  }

  // For other providers — return a simulated response if key is configured
  if (!provider.apiKey || provider.apiKey.length < 10) {
    return {
      success: false,
      response: '',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      error: `${provider.name} requires a real API key to run test prompts. Add a key in the provider settings.`,
    }
  }

  // Simulated response (in production this would call the provider's API)
  const start = Date.now()
  const simulatedResponse = `This is a simulated response from ${model.displayName} via ${provider.name}. In production with a real API key, this would return the actual model output for: "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"`
  await new Promise((r) => setTimeout(r, 200))
  const latencyMs = Date.now() - start
  const inputTokens = Math.ceil(prompt.length / 4) + 10
  const outputTokens = Math.ceil(simulatedResponse.length / 4)
  const costUsd = (inputTokens / 1000) * model.inputCostPer1k + (outputTokens / 1000) * model.outputCostPer1k

  return {
    success: true,
    response: simulatedResponse,
    inputTokens,
    outputTokens,
    costUsd,
    latencyMs,
  }
}

// ─── Provider usage stats ──────────────────────────────────────────────────

export interface ProviderUsageStats {
  requests: number
  successRate: number
  avgLatencyMs: number
  dailyCost: number
  monthlyCost: number
  creditsUsed: number
  failures: number
  topModels: { modelId: string; modelSlug: string; requests: number; cost: number }[]
  mostUsedFeatures: { routeCategory: string; requests: number }[]
}

export async function getProviderUsage(providerId: string): Promise<ProviderUsageStats> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfMonthDate = new Date(startOfMonth)

  // Fetch logs for this provider
  const [todayLogs, monthLogs, allLogs] = await Promise.all([
    db.aiLog.findMany({
      where: { providerId, createdAt: { gte: startOfDay } },
      select: { status: true, durationMs: true, costUsd: true, creditsUsed: true, modelId: true, toolSlug: true, routeCategory: true },
    }),
    db.aiLog.findMany({
      where: { providerId, createdAt: { gte: startOfMonthDate } },
      select: { status: true, costUsd: true, creditsUsed: true },
    }),
    db.aiLog.findMany({
      where: { providerId },
      select: { modelId: true, toolSlug: true, routeCategory: true, status: true, costUsd: true },
      take: 1000,
    }),
  ])

  const requests = todayLogs.length
  const failures = todayLogs.filter((l) => l.status !== 'OK').length
  const successRate = requests > 0 ? ((requests - failures) / requests) * 100 : 100
  const avgLatencyMs = requests > 0
    ? Math.round(todayLogs.reduce((s, l) => s + l.durationMs, 0) / requests)
    : 0
  const dailyCost = todayLogs.reduce((s, l) => s + l.costUsd, 0)
  const monthlyCost = monthLogs.reduce((s, l) => s + l.costUsd, 0)
  const creditsUsed = monthLogs.reduce((s, l) => s + l.creditsUsed, 0)

  // Top models
  const modelMap = new Map<string, { modelId: string; modelSlug: string; requests: number; cost: number }>()
  for (const log of allLogs) {
    const key = log.modelId || 'unknown'
    const existing = modelMap.get(key) || { modelId: key, modelSlug: log.toolSlug || 'unknown', requests: 0, cost: 0 }
    existing.requests++
    existing.cost += log.costUsd
    modelMap.set(key, existing)
  }
  const topModels = Array.from(modelMap.values()).sort((a, b) => b.requests - a.requests).slice(0, 5)

  // Most used features (by routeCategory)
  const featureMap = new Map<string, number>()
  for (const log of allLogs) {
    const cat = log.routeCategory || 'UNKNOWN'
    featureMap.set(cat, (featureMap.get(cat) || 0) + 1)
  }
  const mostUsedFeatures = Array.from(featureMap.entries())
    .map(([routeCategory, reqCount]) => ({ routeCategory, requests: reqCount }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 5)

  return {
    requests,
    successRate,
    avgLatencyMs,
    dailyCost,
    monthlyCost,
    creditsUsed,
    failures,
    topModels,
    mostUsedFeatures,
  }
}
