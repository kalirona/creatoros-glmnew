import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? '1') || 1
    const pageSize = Number(searchParams.get('pageSize') ?? '20') || 20

    if (!user) return NextResponse.json({ generations: [], total: 0 })

    const [generations, total] = await Promise.all([
      db.aiGeneration.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          toolSlug: true,
          title: true,
          status: true,
          creditsUsed: true,
          createdAt: true,
        },
      }),
      db.aiGeneration.count({ where: { userId: user.id } }),
    ])

    return NextResponse.json({ generations, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (e) {
    console.error('Generations list error:', e)
    return NextResponse.json({ error: 'Failed to load generations' }, { status: 500 })
  }
}
