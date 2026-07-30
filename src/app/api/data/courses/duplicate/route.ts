import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST — duplicate a course (with its sections and lessons)
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const original = await db.course.findUnique({
      where: { id },
      include: { sections: { include: { lessons: true }, orderBy: { position: 'asc' } } },
    })
    if (!original) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const copy = await db.course.create({
      data: {
        workspaceId: original.workspaceId,
        title: `${original.title} (Copy)`,
        description: original.description,
        thumbnailUrl: original.thumbnailUrl,
        category: original.category,
        price: original.price,
        level: original.level,
        status: 'DRAFT',
      },
    })

    // Copy sections and lessons
    for (const section of original.sections) {
      const newSection = await db.section.create({
        data: {
          courseId: copy.id,
          title: section.title,
          position: section.position,
        },
      })
      for (const lesson of section.lessons) {
        await db.lesson.create({
          data: {
            sectionId: newSection.id,
            title: lesson.title,
            type: lesson.type,
            duration: lesson.duration,
            isPreview: lesson.isPreview,
            content: lesson.content,
            position: lesson.position,
          },
        })
      }
    }

    return NextResponse.json({ success: true, course: { id: copy.id, title: copy.title } })
  } catch (e) {
    console.error('Course duplicate error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
