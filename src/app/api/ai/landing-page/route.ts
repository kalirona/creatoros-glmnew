import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateText } from '@/lib/ai-engine'
import { getDemoUser, DEMO_WORKSPACE_ID, mapEngineError } from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface LandingSection { type: string; content: Record<string, unknown> }
interface LandingData {
  seo: { title: string; description: string }
  sections: LandingSection[]
}

function parseStructured(raw: string): LandingData | null {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try { return JSON.parse(text.slice(start, end + 1)) as LandingData } catch { return null }
}

const SYSTEM_PROMPT = `You are CreatorOS Landing Page AI, an expert at generating high-converting landing pages for digital products, courses, memberships, and communities.

Generate a COMPLETE landing page as a single JSON object. Respond with ONLY the JSON (no markdown, no commentary).

The JSON shape must be:
{
  "seo": { "title": "string (under 60 chars)", "description": "string (under 160 chars)" },
  "sections": [
    { "type": "HERO", "content": { "headline": "string", "subheadline": "string", "ctaText": "string", "ctaSecondary": "string", "emoji": "string" } },
    { "type": "BENEFITS", "content": { "heading": "string", "items": [ { "title": "string", "description": "string" } ] } },
    { "type": "FEATURES", "content": { "heading": "string", "subheading": "string", "items": [ { "icon": "emoji", "title": "string", "description": "string" } ] } },
    { "type": "TESTIMONIALS", "content": { "heading": "string", "items": [ { "name": "string", "role": "string", "quote": "string" } ] } },
    { "type": "PRICING", "content": { "heading": "string", "plans": [ { "name": "string", "price": number, "interval": "string", "features": ["string"], "cta": "string", "highlighted": boolean } ] } },
    { "type": "FAQ", "content": { "heading": "string", "items": [ { "question": "string", "answer": "string" } ] } },
    { "type": "CTA", "content": { "headline": "string", "subtext": "string", "ctaText": "string" } }
  ]
}

Rules:
- Include exactly 7 sections in this order: HERO, BENEFITS, FEATURES, TESTIMONIALS, PRICING, FAQ, CTA
- HERO: bold benefit-driven headline, clear subheadline, strong CTA
- BENEFITS: 3 outcome-focused benefits (not features)
- FEATURES: 3-4 specific features with emojis
- TESTIMONIALS: 3 realistic-sounding testimonials
- PRICING: 2 plans (a Pro/highlighted and a Basic)
- FAQ: 3-4 objection-handling questions
- CTA: urgency-driven final call to action
- Make all copy specific to what the user is selling
- Use emojis sparingly but effectively`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { selling, category } = body as { selling?: string; category?: string }
    if (!selling?.trim()) return NextResponse.json({ error: 'What are you selling? is required' }, { status: 400 })

    const user = await getDemoUser()
    if (!user) return NextResponse.json({ error: 'No user' }, { status: 400 })

    // Use the AI Engine — routes through ApprovedModel
    const result = await generateText({
      toolSlug: 'LANDING_PAGE_GENERATOR',
      userInput: `What I'm selling: ${selling}\nCategory: ${category || 'General'}`,
      userId: user.id,
      workspaceId: DEMO_WORKSPACE_ID,
      systemPrompt: SYSTEM_PROMPT,
      title: selling.slice(0, 60),
      routeCategory: 'WEBSITE',
    })

    const data = parseStructured(result.raw)
    if (!data || !Array.isArray(data.sections)) return NextResponse.json({ error: 'AI failed to generate valid landing page. Please try again.' }, { status: 502 })

    // Persist: create a Page + PageSections in DB
    const workspace = await db.workspace.findFirst()
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })
    const slug = `landing-${Date.now().toString(36)}`
    const title = selling.slice(0, 60)
    const page = await db.page.create({
      data: {
        workspaceId: workspace.id, title, slug, type: 'LANDING', category: category || 'General',
        status: 'DRAFT', seoTitle: data.seo?.title || title, seoDescription: data.seo?.description || '',
        schema: JSON.stringify({ '@type': 'Product', name: title }),
      },
    })
    for (let i = 0; i < data.sections.length; i++) {
      const sec = data.sections[i]
      await db.pageSection.create({ data: { pageId: page.id, type: sec.type, content: JSON.stringify(sec.content), position: i } })
    }

    return NextResponse.json({ success: true, pageId: page.id, pageSlug: slug, sections: data.sections, seo: data.seo, creditsUsed: result.creditsUsed, remainingCredits: result.remainingCredits })
  } catch (e) {
    console.error('AI landing page error:', e)
    const { status, message } = mapEngineError(e)
    return NextResponse.json({ error: message }, { status })
  }
}
