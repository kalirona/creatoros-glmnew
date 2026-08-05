import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext } from '@/lib/community'

export const dynamic = 'force-dynamic'

// GET — single ticket with replies
export async function GET(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const ctx = await getContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { ticketId } = await params
    const ticket = await db.supportTicket.findFirst({
      where: { id: ticketId, workspaceId: ctx.workspaceId },
      include: {
        replies: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

    // Fetch user info
    const userIds = [...new Set([ticket.userId, ...ticket.replies.map(r => r.userId)])]
    const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, avatarUrl: true } })
    const userMap = new Map(users.map(u => [u.id, u]))

    return NextResponse.json({
      ticket: {
        ...ticket,
        user: userMap.get(ticket.userId) ? {
          name: userMap.get(ticket.userId)!.name,
          email: userMap.get(ticket.userId)!.email,
          avatarUrl: userMap.get(ticket.userId)!.avatarUrl,
        } : null,
        replies: ticket.replies.map(r => ({
          ...r,
          user: userMap.get(r.userId) ? { name: userMap.get(r.userId)!.name, avatarUrl: userMap.get(r.userId)!.avatarUrl } : null,
        })),
      },
    })
  } catch (e) {
    console.error('Ticket GET error:', e)
    return NextResponse.json({ error: 'Failed to load ticket' }, { status: 500 })
  }
}

// PATCH — update ticket status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const ctx = await getContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { ticketId } = await params
    const body = await req.json()
    const { status, priority } = body

    const data: Record<string, unknown> = {}
    if (status) data.status = status
    if (priority) data.priority = priority

    const ticket = await db.supportTicket.update({
      where: { id: ticketId },
      data,
    })

    return NextResponse.json({ success: true, ticket })
  } catch (e) {
    console.error('Ticket PATCH error:', e)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
