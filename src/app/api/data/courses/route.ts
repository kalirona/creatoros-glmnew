import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const courses = await db.course.findMany({
      orderBy: { createdAt: 'desc' },
      include: { sections: { include: { lessons: true }, orderBy: { position: 'asc' } } },
    })
    return NextResponse.json(courses.map((c) => ({
      id: c.id, title: c.title, description: c.description, category: c.category,
      price: c.price, level: c.level, rating: c.rating, studentsCount: c.studentsCount,
      status: c.status, thumbnailUrl: c.thumbnailUrl,
      sections: c.sections.map((s) => ({
        id: s.id, title: s.title, position: s.position,
        lessons: s.lessons.map((l) => ({ id: l.id, title: l.title, type: l.type, duration: l.duration, isPreview: l.isPreview, content: l.content })),
      })),
      totalLessons: c.sections.reduce((acc, s) => acc + s.lessons.length, 0),
      totalDuration: c.sections.reduce((acc, s) => acc + s.lessons.reduce((a, l) => a + l.duration, 0), 0),
    })))
  } catch (e) {
    console.error('Courses list error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// POST — create course
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { title, description, category, level, price } = body

    if (!title || !title.trim()) return NextResponse.json({ error: 'Course title is required' }, { status: 400 })

    const workspace = await db.workspace.findFirst()
    if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })

    const course = await db.course.create({
      data: {
        workspaceId: workspace.id,
        title: title.trim(),
        description: description || '',
        category: category || 'Marketing',
        level: level || 'BEGINNER',
        price: parseFloat(price) || 0,
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ success: true, course: { id: course.id, title: course.title, status: course.status } })
  } catch (e) {
    console.error('Course create error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// PUT — update course
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { id, title, description, category, level, price, status, thumbnailUrl } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const existing = await db.course.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = title.trim()
    if (description !== undefined) data.description = description
    if (category !== undefined) data.category = category
    if (level !== undefined) data.level = level
    if (price !== undefined) data.price = parseFloat(price) || 0
    if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl || null
    if (status !== undefined) data.status = status

    const course = await db.course.update({ where: { id }, data })
    return NextResponse.json({ success: true, course: { id: course.id, title: course.title, status: course.status } })
  } catch (e) {
    console.error('Course update error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// DELETE — delete course
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await db.course.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Delete sections and lessons first (cascade)
    await db.section.deleteMany({ where: { courseId: id } })
    await db.course.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Course delete error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
