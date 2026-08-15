import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

// GET — return AI feature settings for the AI Studio (creator-facing)
// Returns only whether each feature is enabled (no admin-only data)
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
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
    const result = { ...DEFAULTS, ...features }
    return NextResponse.json({ features: result })
  } catch (e) {
    console.error('AI features GET error:', e)
    return NextResponse.json({ error: 'Failed to fetch AI features' }, { status: 500 })
  }
}
