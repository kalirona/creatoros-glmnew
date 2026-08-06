import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

// GET — return AI feature settings (stored as JSON in AdminSetting key='ai_features')
export async function GET() {
  try {
    const setting = await db.adminSetting.findUnique({ where: { key: 'ai_features' } })
    let features: Record<string, boolean> = {}
    if (setting?.value) {
      try { features = JSON.parse(setting.value) } catch { features = {} }
    }
    // Default features (all enabled unless explicitly disabled)
    const DEFAULTS: Record<string, boolean> = {
      chat: true,
      images: true,
      video: true,
      voice: false,
      course: true,
      landing: true,
      email: true,
      blog: true,
      seo: true,
      automation: true,
      document: true,
      vision: false,
      ocr: false,
      embeddings: true,
      reasoning: false,
    }
    // Merge defaults with stored settings
    const result = { ...DEFAULTS, ...features }
    return NextResponse.json({ features: result })
  } catch (e) {
    console.error('AI features GET error:', e)
    return NextResponse.json({ error: 'Failed to fetch AI features' }, { status: 500 })
  }
}

// PUT — update a single feature's enabled state
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { featureId, enabled } = body as { featureId: string; enabled: boolean }

    if (!featureId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'featureId and enabled are required' }, { status: 400 })
    }

    // Get current features
    const setting = await db.adminSetting.findUnique({ where: { key: 'ai_features' } })
    let features: Record<string, boolean> = {}
    if (setting?.value) {
      try { features = JSON.parse(setting.value) } catch { features = {} }
    }

    // Update the feature
    features[featureId] = enabled

    // Save back
    await db.adminSetting.upsert({
      where: { key: 'ai_features' },
      create: { key: 'ai_features', value: JSON.stringify(features), category: 'ai' },
      update: { value: JSON.stringify(features) },
    })

    return NextResponse.json({ success: true, features })
  } catch (e) {
    console.error('AI features PUT error:', e)
    return NextResponse.json({ error: 'Failed to update AI feature' }, { status: 500 })
  }
}
