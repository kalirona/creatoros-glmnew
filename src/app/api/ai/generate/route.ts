import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateText } from '@/lib/ai-engine'
import { getDemoUser, DEMO_WORKSPACE_ID, mapEngineError } from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { toolSlug, input } = body as { toolSlug?: string; input?: string }

    if (!toolSlug || !input?.trim()) {
      return NextResponse.json({ error: 'toolSlug and input are required' }, { status: 400 })
    }

    const user = await getDemoUser()
    if (!user) {
      return NextResponse.json({ error: 'No user account is available.' }, { status: 400 })
    }

    // Use the AI Engine — this goes through the routing pipeline:
    //   resolveRoute() → ApprovedModel → provider → adapter
    // NO direct ZAI.create() calls. NO hardcoded model fallbacks.
    const result = await generateText({
      toolSlug,
      routeCategory: 'WRITING',
      systemPrompt: '',
      userInput: input,
      userId: user.id,
      workspaceId: DEMO_WORKSPACE_ID,
      title: input.slice(0, 80),
    })

    // Look up the tool for response metadata
    const tool = await db.aiTool.findUnique({ where: { slug: toolSlug } })

    return NextResponse.json({
      generationId: result.generationId,
      toolSlug,
      toolName: tool?.name || toolSlug,
      outputType: tool?.outputType || 'MARKDOWN',
      raw: result.raw,
      structured: result.structured,
      creditsUsed: result.creditsUsed,
      remainingCredits: result.remainingCredits,
    })
  } catch (e) {
    console.error('AI generate error:', e)
    const { status, message } = mapEngineError(e)
    return NextResponse.json({ error: message }, { status })
  }
}

// GET — list all visible tools (DB-driven tool picker)
export async function GET() {
  const tools = await db.aiTool.findMany({
    where: { isVisible: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, slug: true, name: true, description: true, icon: true, category: true, creditCost: true, outputType: true, isPro: true },
  })
  return NextResponse.json({ tools })
}
