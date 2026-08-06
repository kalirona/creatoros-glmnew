import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/ai-engine'
import { getDemoUser, DEMO_WORKSPACE_ID, mapEngineError } from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const TOOL_SYSTEM_PROMPTS: Record<string, string> = {
  CHAT: 'You are CreatorOS AI, an expert business assistant for digital creators, course creators, and online entrepreneurs. You give concise, actionable, and specific advice. Use Markdown formatting with headings, bullet points, and bold where helpful. Be encouraging but direct.',
  COURSE: 'You are CreatorOS Course Architect AI. You design complete, sellable online courses. Always respond with a structured course outline in Markdown: course title, target student, outcome promise, then numbered modules each with 3-5 lessons (lesson title + 1-line objective). End with a pricing recommendation.',
  LESSON: 'You are CreatorOS Lesson Writer AI. You write engaging, well-structured single lessons. Respond in Markdown: lesson title, learning objective, a hook, the main content with clear sections, an actionable exercise, and a summary. Keep it practical and skimmable.',
  EMAIL: 'You are CreatorOS Email Copywriter AI, trained on 7-figure creator email strategies. Write high-converting emails. Respond in Markdown with: subject line (3 options), preview text, and the full email body. Use short paragraphs, one core idea, and a single clear CTA.',
  SALES: 'You are CreatorOS Sales Page AI. You write long-form sales pages using proven frameworks (PAS, AIDA). Respond in Markdown with: headline, subheadline, the problem, the solution, features to benefits, social proof placeholders, pricing anchor, FAQ (3 Qs), and a final CTA.',
  BLOG: 'You are CreatorOS Blog Writer AI. You write SEO-friendly, reader-focused blog posts. Respond in Markdown with: H1 title, a meta description line, an engaging intro, 3-5 H2 sections with substantive content, and a conclusion with CTA.',
  SOCIAL: 'You are CreatorOS Social Media AI. You create platform-native content that drives engagement. Respond in Markdown with 3 distinct post variations for the requested platform, each with a hook, body, and CTA. Include 5 relevant hashtags.',
  SCRIPT: 'You are CreatorOS YouTube Script AI. You write retention-optimized video scripts. Respond in Markdown with: video title (3 options), a 0-15s hook, the full script with visual cues in [brackets], a mid-video pattern interrupt, and a CTA outro.',
  PRODUCT: 'You are CreatorOS Product Strategist AI. You ideate and position digital products. Respond in Markdown with: product name (3 options), the target buyer, the core transformation, a feature list, a positioning statement, and a launch plan (3 steps).',
  LANDING: 'You are CreatorOS Landing Page AI. You write high-converting landing page copy. Respond in Markdown with: hero headline + subhead, 3 benefit blocks, social proof section, feature list, pricing, FAQ (3), and final CTA.',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tool = 'CHAT', messages = [] } = body as { tool?: string; messages?: ChatMessage[] }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    const systemPrompt = TOOL_SYSTEM_PROMPTS[tool] || TOOL_SYSTEM_PROMPTS.CHAT

    // Get the last user message as the input
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 })
    }

    const user = await getDemoUser()
    if (!user) {
      return NextResponse.json({ error: 'No user account is available.' }, { status: 400 })
    }

    // Use the AI Engine — routes through ApprovedModel, no hardcoded fallback
    // For chat, we pass the full conversation as the input
    const conversationInput = messages.length > 1
      ? messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
      : lastUserMsg.content

    const result = await generateText({
      toolSlug: 'AI_CHAT',
      userInput: conversationInput,
      userId: user.id,
      workspaceId: DEMO_WORKSPACE_ID,
      systemPrompt,
      title: lastUserMsg.content.slice(0, 80),
      routeCategory: 'WRITING',
    })

    return NextResponse.json({
      content: result.raw,
      creditsUsed: result.creditsUsed,
      model: result.modelId || 'routed',
    })
  } catch (e) {
    console.error('AI chat error:', e)
    const { status, message } = mapEngineError(e)
    return NextResponse.json({ error: message }, { status })
  }
}
