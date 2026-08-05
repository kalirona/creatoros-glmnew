import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

// GET — list all pages (with optional type filter)
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  const where = type ? { type } : {}
  const pages = await db.page.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { sections: true } } } })
  return NextResponse.json({
    pages: pages.map((p) => ({
      id: p.id, title: p.title, slug: p.slug, type: p.type, status: p.status,
      category: p.category, visits: p.visits, conversions: p.conversions,
      sectionCount: p._count.sections, publishedAt: p.publishedAt, createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    stats: {
      total: pages.length,
      published: pages.filter((p) => p.status === 'PUBLISHED').length,
      drafts: pages.filter((p) => p.status === 'DRAFT').length,
      totalVisits: pages.reduce((s, p) => s + p.visits, 0),
    },
  })
}

// POST — create a new page
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, slug, type = 'PAGE', category = 'General' } = body
    if (!title || !slug) return NextResponse.json({ error: 'title and slug required' }, { status: 400 })
    const workspace = await db.workspace.findFirst()
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })
    const page = await db.page.create({ data: { workspaceId: workspace.id, title, slug, type, category, status: 'DRAFT', seoTitle: title } })
    return NextResponse.json({ success: true, page })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

// PUT — update page (status, title, slug, SEO, category)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, title, slug, seoTitle, seoDescription, category } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const existing = await db.page.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Page not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (status !== undefined) {
      data.status = status
      if (status === 'PUBLISHED' && !existing.publishedAt) data.publishedAt = new Date()
      if (status === 'DRAFT') data.publishedAt = null
    }
    if (title !== undefined) data.title = title
    if (slug !== undefined) data.slug = slug
    if (seoTitle !== undefined) data.seoTitle = seoTitle
    if (seoDescription !== undefined) data.seoDescription = seoDescription
    if (category !== undefined) data.category = category

    const page = await db.page.update({ where: { id }, data })
    return NextResponse.json({ success: true, page })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

// DELETE — delete a page
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await db.page.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
