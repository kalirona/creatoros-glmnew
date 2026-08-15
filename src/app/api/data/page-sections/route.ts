import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

const SECTION_DEFAULTS: Record<string, unknown> = {
  HERO: { headline: 'Your headline here', subheadline: 'Your subheadline', ctaText: 'Get Started', ctaSecondary: '', emoji: '🚀' },
  FEATURES: { heading: 'Features', subheading: '', items: [{ icon: '✨', title: 'Feature', description: 'Description' }] },
  BENEFITS: { heading: 'Benefits', items: [{ title: 'Benefit', description: 'Description' }] },
  PRICING: { heading: 'Pricing', plans: [{ name: 'Basic', price: 0, interval: 'free', features: ['Feature'], cta: 'Get started', highlighted: false }] },
  TESTIMONIALS: { heading: 'Testimonials', items: [{ name: 'Name', role: 'Role', quote: 'Quote' }] },
  FAQ: { heading: 'FAQ', items: [{ question: 'Question?', answer: 'Answer.' }] },
  VIDEO: { heading: 'Video', videoUrl: '', description: '' },
  GALLERY: { heading: 'Gallery', images: [] },
  COUNTDOWN: { heading: 'Limited time', endDate: '', ctaText: 'Get access' },
  CTA: { headline: 'Ready?', subtext: '', ctaText: 'Start now' },
  NEWSLETTER: { heading: 'Subscribe', subtext: '', placeholder: 'you@email.com', ctaText: 'Subscribe' },
  FOOTER: { brand: 'CreatorOS', tagline: 'All-in-one creator platform.', links: [] },
  TEXT: { text: 'Write your paragraph here.' },
  HEADING: { text: 'Section Heading', alignment: 'center' },
}

// GET sections for a page (with full page data)
export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get('pageId')
  if (!pageId) return NextResponse.json({ error: 'pageId required' }, { status: 400 })
  const page = await db.page.findUnique({ where: { id: pageId }, include: { sections: { orderBy: { position: 'asc' } } } })
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  return NextResponse.json({
    page: { ...page, sections: page.sections.map((s) => ({ ...s, content: JSON.parse(s.content || '{}') })) },
  })
}

// POST — add a new section to a page
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { pageId, type, content, position } = body
    if (!pageId || !type) return NextResponse.json({ error: 'pageId and type required' }, { status: 400 })
    const count = await db.pageSection.count({ where: { pageId } })
    const section = await db.pageSection.create({
      data: { pageId, type, content: JSON.stringify(content || SECTION_DEFAULTS[type] || {}), position: position ?? count },
    })
    return NextResponse.json({ success: true, section: { ...section, content: JSON.parse(section.content || '{}') } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

// PUT — update section content, or move/duplicate/hide
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { id, action, content, isHidden } = body

    if (action === 'duplicate') {
      const orig = await db.pageSection.findUnique({ where: { id } })
      if (!orig) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const dup = await db.pageSection.create({ data: { pageId: orig.pageId, type: orig.type, content: orig.content, position: orig.position + 1 } })
      // shift later sections up
      await db.pageSection.updateMany({ where: { pageId: orig.pageId, position: { gt: orig.position }, id: { not: dup.id } }, data: { position: { increment: 1 } } })
      return NextResponse.json({ success: true, section: { ...dup, content: JSON.parse(dup.content || '{}') } })
    }

    if (action === 'moveUp' || action === 'moveDown') {
      const section = await db.pageSection.findUnique({ where: { id } })
      if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const dir = action === 'moveUp' ? -1 : 1
      const newPos = section.position + dir
      const swap = await db.pageSection.findFirst({ where: { pageId: section.pageId, position: newPos } })
      if (!swap) return NextResponse.json({ success: true, message: 'Already at edge' })
      await db.pageSection.update({ where: { id: swap.id }, data: { position: section.position } })
      await db.pageSection.update({ where: { id: section.id }, data: { position: newPos } })
      return NextResponse.json({ success: true })
    }

    // default: update content or hidden
    const data: Record<string, unknown> = {}
    if (content !== undefined) data.content = JSON.stringify(content)
    if (isHidden !== undefined) data.isHidden = isHidden
    const section = await db.pageSection.update({ where: { id }, data })
    return NextResponse.json({ success: true, section: { ...section, content: JSON.parse(section.content || '{}') } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

// DELETE a section
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const section = await db.pageSection.findUnique({ where: { id } })
    await db.pageSection.delete({ where: { id } })
    // reorder remaining sections
    if (section) {
      const remaining = await db.pageSection.findMany({ where: { pageId: section.pageId }, orderBy: { position: 'asc' } })
      for (let i = 0; i < remaining.length; i++) {
        await db.pageSection.update({ where: { id: remaining[i].id }, data: { position: i } })
      }
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
