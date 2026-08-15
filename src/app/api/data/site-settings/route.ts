import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  const settings = await db.siteSetting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] })
  // parse JSON values where applicable
  const parsed = settings.map((s) => {
    let value: unknown = s.value
    try { if (s.value.startsWith('{') || s.value.startsWith('[')) value = JSON.parse(s.value) } catch { /* keep string */ }
    return { id: s.id, key: s.key, value, category: s.category }
  })
  return NextResponse.json({ settings: parsed })
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { id, value } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const val = typeof value === 'string' ? value : JSON.stringify(value)
    const setting = await db.siteSetting.update({ where: { id }, data: { value: val } })
    return NextResponse.json({ success: true, setting })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
