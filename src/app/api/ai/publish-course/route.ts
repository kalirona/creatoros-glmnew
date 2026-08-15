import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST — publish an AI-generated course into the Courses module (real DB persistence)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { generationId } = body as { generationId?: string }
    if (!generationId) return NextResponse.json({ error: 'generationId required' }, { status: 400 })

    const gen = await db.aiGeneration.findUnique({ where: { id: generationId } })
    if (!gen) return NextResponse.json({ error: 'Generation not found' }, { status: 404 })

    interface CourseData {
      title?: string; description?: string; category?: string; level?: string;
      pricing?: { price?: number };
      thumbnail?: { gradient?: string; emoji?: string };
      modules?: { title?: string; lessons?: { title?: string; type?: string; duration?: number; content?: string; objective?: string }[] }[]
    }
    let courseData: CourseData = {}
    try { courseData = JSON.parse(gen.structured) as CourseData } catch { return NextResponse.json({ error: 'Invalid structured data' }, { status: 400 }) }

    const workspace = await db.workspace.findFirst()
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const course = await db.course.create({
      data: {
        workspaceId: workspace.id,
        title: courseData.title || gen.title,
        description: courseData.description || '',
        category: courseData.category || 'Marketing',
        level: (courseData.level as string) || 'BEGINNER',
        price: courseData.pricing?.price ?? 99,
        rating: 0,
        studentsCount: 0,
      },
    })

    // Create sections (modules) + lessons — sequential to guarantee order
    if (Array.isArray(courseData.modules)) {
      for (let mIdx = 0; mIdx < courseData.modules.length; mIdx++) {
        const mod = courseData.modules[mIdx]
        const section = await db.section.create({
          data: { courseId: course.id, title: mod.title || `Module ${mIdx + 1}`, position: mIdx },
        })
        if (Array.isArray(mod.lessons)) {
          for (let lIdx = 0; lIdx < mod.lessons.length; lIdx++) {
            const lesson = mod.lessons[lIdx]
            await db.lesson.create({
              data: {
                sectionId: section.id,
                title: lesson.title || `Lesson ${lIdx + 1}`,
                content: lesson.content || lesson.objective || '',
                type: (lesson.type as string) || 'VIDEO',
                duration: lesson.duration || 8,
                position: lIdx,
                isPreview: lIdx === 0,
              },
            })
          }
        }
      }
    }

    return NextResponse.json({ success: true, courseId: course.id, title: course.title })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
