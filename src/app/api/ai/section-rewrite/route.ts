import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/ai-engine'
import { mapEngineError } from "@/lib/creator-ai"
import { getCurrentUser } from "@/lib/auth"

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ACTION_PROMPTS: Record<string, string> = {
  REWRITE: 'Rewrite the following content to be clearer and more compelling. Keep the same JSON structure and keys. Respond with ONLY the JSON.',
  IMPROVE: 'Improve the following content to be more persuasive, specific, and conversion-focused. Keep the same JSON structure and keys. Respond with ONLY the JSON.',
  SHORTEN: 'Shorten the following content to be more concise while keeping the key message. Keep the same JSON structure and keys. Respond with ONLY the JSON.',
  EXPAND: 'Expand the following content with more detail, specificity, and persuasive language. Keep the same JSON structure and keys. Respond with ONLY the JSON.',
  TRANSLATE: 'Translate all text values in the following JSON content to Spanish. Keep the same JSON structure and keys. Respond with ONLY the JSON.',
  SEO: 'Optimize the following content for SEO. Make headlines more search-friendly, add relevant keywords naturally, and improve meta descriptions if present. Keep the same JSON structure and keys. Respond with ONLY the JSON.',
}

function parseJSON(raw: string): Record<string, unknown> | null {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, content, sectionType } = body as { action?: string; content?: Record<string, unknown>; sectionType?: string }
    if (!action || !content) return NextResponse.json({ error: 'action and content required' }, { status: 400 })
    const instruction = ACTION_PROMPTS[action]
    if (!instruction) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No user' }, { status: 400 })

    // Use the AI Engine — routes through ApprovedModel
    const result = await generateText({
      toolSlug: 'AI_CHAT',  // reuse chat tool for section rewrite
      userInput: JSON.stringify(content, null, 2),
      userId: user.id,
      workspaceId: user.workspaceId,
      systemPrompt: `You are an expert copywriter for creator businesses. You improve ${sectionType || 'page'} section content. ${instruction}`,
      title: `Section ${action}`,
      routeCategory: 'WEBSITE',
    })

    const newContent = parseJSON(result.raw)
    if (!newContent) return NextResponse.json({ error: 'AI failed to produce valid content. Please try again.' }, { status: 502 })

    return NextResponse.json({ success: true, content: newContent, creditsUsed: result.creditsUsed, remainingCredits: result.remainingCredits })
  } catch (e) {
    console.error('Section rewrite error:', e)
    const { status, message } = mapEngineError(e)
    return NextResponse.json({ error: message }, { status })
  }
}
