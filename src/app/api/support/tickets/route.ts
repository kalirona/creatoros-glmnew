import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext } from '@/lib/community'

export const dynamic = 'force-dynamic'

// GET — list tickets for this workspace
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const page = Number(searchParams.get('page') ?? '1') || 1
    const pageSize = Number(searchParams.get('pageSize') ?? '20') || 20

    const where: Record<string, unknown> = { workspaceId: ctx.workspaceId }
    if (status && status !== 'all') where.status = status

    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { replies: true } },
        },
      }),
      db.supportTicket.count({ where }),
    ])

    // Fetch user info for each ticket
    const userIds = [...new Set(tickets.map(t => t.userId))]
    const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, avatarUrl: true } })
    const userMap = new Map(users.map(u => [u.id, u]))

    return NextResponse.json({
      tickets: tickets.map(t => ({
        id: t.id,
        subject: t.subject,
        description: t.description,
        category: t.category,
        priority: t.priority,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        replyCount: t._count.replies,
        user: userMap.get(t.userId) ? {
          name: userMap.get(t.userId)!.name,
          email: userMap.get(t.userId)!.email,
          avatarUrl: userMap.get(t.userId)!.avatarUrl,
        } : null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e) {
    console.error('Tickets GET error:', e)
    return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 })
  }
}

// POST — create a new ticket
export async function POST(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { subject, description, category, priority } = body
    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 })
    }

    const ticket = await db.supportTicket.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.user.id,
        subject: subject.trim().slice(0, 200),
        description: description.trim().slice(0, 10000),
        category: category || 'general',
        priority: priority || 'medium',
      },
    })

    return NextResponse.json({ success: true, ticket })
  } catch (e) {
    console.error('Ticket create error:', e)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}
