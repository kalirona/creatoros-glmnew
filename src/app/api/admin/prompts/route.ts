import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

// GET — return all prompts (stored as JSON in AdminSetting key='ai_prompts')
export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const setting = await db.adminSetting.findUnique({ where: { key: 'ai_prompts' } })
    let prompts: any[] = []
    if (setting?.value) {
      try { prompts = JSON.parse(setting.value) } catch { prompts = [] }
    }
    // If no prompts exist yet, return empty array (no demo data)
    return NextResponse.json({ prompts })
  } catch (e) {
    console.error('Prompts GET error:', e)
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
  }
}

// POST — save a prompt (create or update)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { id, name, category, content, variables, isActive } = body as {
      id?: string; name: string; category: string; content: string; variables?: string[]; isActive?: boolean
    }
    if (!name || !category || !content) {
      return NextResponse.json({ error: 'name, category, and content are required' }, { status: 400 })
    }
    const setting = await db.adminSetting.findUnique({ where: { key: 'ai_prompts' } })
    let prompts: any[] = []
    if (setting?.value) {
      try { prompts = JSON.parse(setting.value) } catch { prompts = [] }
    }
    const now = new Date().toISOString()
    if (id) {
      // Update existing
      const idx = prompts.findIndex((p) => p.id === id)
      if (idx >= 0) {
        prompts[idx] = { ...prompts[idx], name, category, content, variables: variables || [], isActive: isActive ?? true, version: (prompts[idx].version || 1) + 1, updatedAt: now }
      }
    } else {
      // Create new
      prompts.push({ id: `p${Date.now()}`, name, category, content, variables: variables || [], isActive: isActive ?? true, version: 1, createdAt: now, updatedAt: now })
    }
    await db.adminSetting.upsert({
      where: { key: 'ai_prompts' },
      create: { key: 'ai_prompts', value: JSON.stringify(prompts), category: 'ai' },
      update: { value: JSON.stringify(prompts) },
    })
    return NextResponse.json({ success: true, prompts })
  } catch (e) {
    console.error('Prompts POST error:', e)
    return NextResponse.json({ error: 'Failed to save prompt' }, { status: 500 })
  }
}

// PUT — toggle active or update
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { id, isActive } = body as { id: string; isActive?: boolean }
    const setting = await db.adminSetting.findUnique({ where: { key: 'ai_prompts' } })
    let prompts: any[] = []
    if (setting?.value) {
      try { prompts = JSON.parse(setting.value) } catch { prompts = [] }
    }
    const idx = prompts.findIndex((p) => p.id === id)
    if (idx < 0) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    prompts[idx].isActive = isActive ?? !prompts[idx].isActive
    prompts[idx].updatedAt = new Date().toISOString()
    await db.adminSetting.upsert({
      where: { key: 'ai_prompts' },
      create: { key: 'ai_prompts', value: JSON.stringify(prompts), category: 'ai' },
      update: { value: JSON.stringify(prompts) },
    })
    return NextResponse.json({ success: true, prompts })
  } catch (e) {
    console.error('Prompts PUT error:', e)
    return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 })
  }
}

// DELETE — remove a prompt
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const setting = await db.adminSetting.findUnique({ where: { key: 'ai_prompts' } })
    let prompts: any[] = []
    if (setting?.value) {
      try { prompts = JSON.parse(setting.value) } catch { prompts = [] }
    }
    prompts = prompts.filter((p) => p.id !== id)
    await db.adminSetting.upsert({
      where: { key: 'ai_prompts' },
      create: { key: 'ai_prompts', value: JSON.stringify(prompts), category: 'ai' },
      update: { value: JSON.stringify(prompts) },
    })
    return NextResponse.json({ success: true, prompts })
  } catch (e) {
    console.error('Prompts DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete prompt' }, { status: 500 })
  }
}
