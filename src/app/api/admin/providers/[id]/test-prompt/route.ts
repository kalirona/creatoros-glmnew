import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runTestPrompt } from '@/lib/provider-gateway/health'

export const dynamic = 'force-dynamic'

// ─── POST — run a test prompt against a specific model ─────────────────────
// Body: { modelId?: string, prompt: string }
// Calls runTestPrompt(providerId, modelId, prompt) which:
//   - For GLM/Z.ai: makes a real chat completion call via z-ai-web-dev-sdk
//   - For other providers: makes a REAL POST /chat/completions to the provider's API
// Returns: { success, response, inputTokens, outputTokens, costUsd,
//            latencyMs, error? }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const { modelId, prompt } = body as { modelId?: string; prompt?: string }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      )
    }

    const provider = await db.aiProvider.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    // If modelId provided, validate it belongs to this provider.
    if (modelId) {
      const model = await db.aiModel.findUnique({
        where: { id: modelId },
        select: { providerId: true },
      })
      if (!model || model.providerId !== id) {
        return NextResponse.json(
          { error: 'Model not found on this provider' },
          { status: 400 }
        )
      }
    }

    const result = await runTestPrompt(id, modelId || null, prompt)

    return NextResponse.json({
      success: result.success,
      response: result.response,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      error: result.error,
    })
  } catch (e) {
    console.error('[admin/providers/[id]/test-prompt POST]', e)
    return NextResponse.json({ error: 'Failed to run test prompt' }, { status: 500 })
  }
}
