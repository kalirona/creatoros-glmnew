import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext } from '@/lib/community'

export const dynamic = 'force-dynamic'

// POST — reply to a ticket
export async function POST(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const ctx = await getContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { ticketId } = await params
    const body = await req.json()
    const { content } = body
    if (!content?.trim()) return NextResponse.json({ error: 'Reply content is required' }, { status: 400 })

    // Verify ticket exists in workspace
    const ticket = await db.supportTicket.findFirst({
      where: { id: ticketId, workspaceId: ctx.workspaceId },
    })
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

    // Determine if staff (owner/admin)
    const isStaff = ['OWNER', 'ADMIN'].includes(ctx.workspaceRole || '')

    const reply = await db.ticketReply.create({
      data: {
        ticketId,
        userId: ctx.user.id,
        content: content.trim().slice(0, 10000),
        isStaff,
      },
    })

    // If staff replies, set ticket status to in_progress
    if (isStaff && ticket.status === 'open') {
      await db.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'in_progress' },
      })
    }

    return NextResponse.json({ success: true, reply })
  } catch (e) {
    console.error('Reply error:', e)
    return NextResponse.json({ error: 'Failed to post reply' }, { status: 500 })
  }
}
