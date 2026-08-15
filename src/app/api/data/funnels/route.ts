import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const funnels = await db.funnel.findMany({ orderBy: { createdAt: 'desc' }, include: { steps: { orderBy: { position: 'asc' }, include: { page: { select: { id: true, title: true, slug: true } } } } } })
    return NextResponse.json({
      funnels: funnels.map((f) => ({
        id: f.id, name: f.name, description: f.description, type: f.type, status: f.status,
        visits: f.visits, conversions: f.conversions, revenue: f.revenue, createdAt: f.createdAt,
        steps: f.steps.map((s) => ({ id: s.id, name: s.name, type: s.type, position: s.position, isRequired: s.isRequired, page: s.page })),
      })),
      stats: {
        total: funnels.length,
        live: funnels.filter((f) => f.status === 'LIVE').length,
        totalVisits: funnels.reduce((s, f) => s + f.visits, 0),
        totalRevenue: funnels.reduce((s, f) => s + f.revenue, 0),
      },
    })
  } catch (e) {
    console.error('Funnels error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// POST — create funnel
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { name, description, type } = body

    if (!name || !name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const workspace = await db.workspace.findFirst()
    if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })

    const funnel = await db.funnel.create({
      data: {
        workspaceId: workspace.id,
        name: name.trim(),
        description: description || '',
        type: type || 'SALES',
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ success: true, funnel: { id: funnel.id, name: funnel.name } })
  } catch (e) {
    console.error('Funnel create error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// PUT — update funnel
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { id, name, description, type, status } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const existing = await db.funnel.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Funnel not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim()
    if (description !== undefined) data.description = description
    if (type !== undefined) data.type = type
    if (status !== undefined) data.status = status

    const funnel = await db.funnel.update({ where: { id }, data })
    return NextResponse.json({ success: true, funnel: { id: funnel.id, name: funnel.name, status: funnel.status } })
  } catch (e) {
    console.error('Funnel update error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// DELETE — delete funnel
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await db.funnel.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Funnel not found' }, { status: 404 })

    await db.funnel.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Funnel delete error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
