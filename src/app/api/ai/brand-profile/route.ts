import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEMO_WORKSPACE_ID } from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'

const VALID_VOICES = new Set([
  'professional', 'casual', 'witty', 'authoritative', 'friendly', 'inspirational',
])
const VALID_TONES = new Set([
  'confident', 'warm', 'playful', 'serious', 'energetic', 'calm',
])
const VALID_RATIOS = new Set(['1:1', '2:3', '3:2', '9:16', '16:9', '4:1', '1:3'])

interface BrandProfileBody {
  brandVoice?: string
  tone?: string
  language?: string
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string
  defaultAspectRatio?: string
  guidelines?: string
  targetAudience?: string
}

// GET /api/ai/brand-profile — return the workspace's brand profile.
export async function GET() {
  try {
    const profile = await db.aiBrandProfile.findUnique({
      where: { workspaceId: DEMO_WORKSPACE_ID },
    })
    if (!profile) {
      // Return defaults if not seeded
      return NextResponse.json({
        brandVoice: 'professional',
        tone: 'confident',
        language: 'en',
        primaryColor: '#10b981',
        secondaryColor: '#0ea5e9',
        logoUrl: '',
        defaultAspectRatio: '1:1',
        guidelines: '',
        targetAudience: '',
      })
    }

    // Creator-safe — strip workspaceId and never expose provider info.
    return NextResponse.json({
      brandVoice: profile.brandVoice,
      tone: profile.tone,
      language: profile.language,
      primaryColor: profile.primaryColor,
      secondaryColor: profile.secondaryColor,
      logoUrl: profile.logoUrl,
      defaultAspectRatio: profile.defaultAspectRatio,
      guidelines: profile.guidelines,
      targetAudience: profile.targetAudience,
    })
  } catch (e) {
    console.error('Brand profile get error:', e)
    return NextResponse.json(
      { error: 'Failed to load brand profile.' },
      { status: 500 },
    )
  }
}

// PUT /api/ai/brand-profile — upsert the workspace's brand profile.
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as BrandProfileBody

    // Light validation
    if (body.brandVoice !== undefined && !VALID_VOICES.has(body.brandVoice)) {
      return NextResponse.json(
        { error: 'Invalid brandVoice.' },
        { status: 400 },
      )
    }
    if (body.tone !== undefined && !VALID_TONES.has(body.tone)) {
      return NextResponse.json({ error: 'Invalid tone.' }, { status: 400 })
    }
    if (
      body.defaultAspectRatio !== undefined &&
      !VALID_RATIOS.has(body.defaultAspectRatio)
    ) {
      return NextResponse.json(
        { error: 'Invalid defaultAspectRatio.' },
        { status: 400 },
      )
    }
    if (body.language !== undefined && body.language.length > 10) {
      return NextResponse.json(
        { error: 'language must be a short ISO code (≤ 10 chars).' },
        { status: 400 },
      )
    }
    if (body.primaryColor !== undefined && !/^#[0-9a-fA-F]{3,8}$/.test(body.primaryColor)) {
      return NextResponse.json(
        { error: 'primaryColor must be a hex color.' },
        { status: 400 },
      )
    }
    if (body.secondaryColor !== undefined && !/^#[0-9a-fA-F]{3,8}$/.test(body.secondaryColor)) {
      return NextResponse.json(
        { error: 'secondaryColor must be a hex color.' },
        { status: 400 },
      )
    }
    if (body.guidelines !== undefined && body.guidelines.length > 5000) {
      return NextResponse.json(
        { error: 'guidelines must be ≤ 5000 chars.' },
        { status: 400 },
      )
    }
    if (body.targetAudience !== undefined && body.targetAudience.length > 1000) {
      return NextResponse.json(
        { error: 'targetAudience must be ≤ 1000 chars.' },
        { status: 400 },
      )
    }

    const data = {
      brandVoice: body.brandVoice ?? 'professional',
      tone: body.tone ?? 'confident',
      language: body.language ?? 'en',
      primaryColor: body.primaryColor ?? '#10b981',
      secondaryColor: body.secondaryColor ?? '#0ea5e9',
      logoUrl: body.logoUrl ?? '',
      defaultAspectRatio: body.defaultAspectRatio ?? '1:1',
      guidelines: body.guidelines ?? '',
      targetAudience: body.targetAudience ?? '',
    }

    const profile = await db.aiBrandProfile.upsert({
      where: { workspaceId: DEMO_WORKSPACE_ID },
      create: { workspaceId: DEMO_WORKSPACE_ID, ...data },
      update: data,
    })

    return NextResponse.json({
      brandVoice: profile.brandVoice,
      tone: profile.tone,
      language: profile.language,
      primaryColor: profile.primaryColor,
      secondaryColor: profile.secondaryColor,
      logoUrl: profile.logoUrl,
      defaultAspectRatio: profile.defaultAspectRatio,
      guidelines: profile.guidelines,
      targetAudience: profile.targetAudience,
    })
  } catch (e) {
    console.error('Brand profile update error:', e)
    return NextResponse.json(
      { error: 'Failed to update brand profile.' },
      { status: 500 },
    )
  }
}
