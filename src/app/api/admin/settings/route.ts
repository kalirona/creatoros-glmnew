import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await db.adminSetting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] })
  return NextResponse.json({ settings })
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { id, value } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const setting = await db.adminSetting.update({ where: { id }, data: { value: String(value) } })
    return NextResponse.json({ success: true, setting })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
