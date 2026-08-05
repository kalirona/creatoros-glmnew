import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, writeAuditLog } from '@/lib/community'

export const dynamic = 'force-dynamic'

const RSVP_STATUSES = ['GOING', 'MAYBE', 'NOT_GOING']

// ─── POST /api/community/events/rsvp ───────────────────────────────────────
// Body: { eventId, status: 'GOING'|'MAYBE'|'NOT_GOING' }
// Upserts the current user's RSVP for an event (unique [eventId, userId]).
export async function POST(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const eventId = typeof body?.eventId === 'string' ? body.eventId : null
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
    }

    const status = typeof body?.status === 'string' ? body.status.toUpperCase() : ''
    if (!RSVP_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: 'status must be one of GOING, MAYBE, NOT_GOING' },
        { status: 400 }
      )
    }

    // Verify event exists and belongs to the same workspace (not workspace-leakable).
    const event = await db.communityEvent.findFirst({
      where: { id: eventId, workspaceId: ctx.workspaceId },
      select: { id: true, title: true, status: true, maxAttendees: true },
    })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    if (event.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cannot RSVP to a cancelled event' }, { status: 400 })
    }

    // Enforce maxAttendees cap for GOING RSVPs (MAYBE/NOT_GOING don't count toward the cap).
    if (status === 'GOING' && event.maxAttendees !== null) {
      const goingCount = await db.eventRSVP.count({
        where: { eventId, status: 'GOING' },
      })
      // Look up existing RSVP for this user — if it was already GOING, swapping is fine.
      const existing = await db.eventRSVP.findUnique({
        where: { eventId_userId: { eventId, userId: ctx.user.id } },
        select: { status: true },
      })
      const wasGoing = existing?.status === 'GOING'
      if (!wasGoing && goingCount >= event.maxAttendees) {
        return NextResponse.json(
          { error: 'Event is at maximum capacity' },
          { status: 409 }
        )
      }
    }

    const rsvp = await db.eventRSVP.upsert({
      where: { eventId_userId: { eventId, userId: ctx.user.id } },
      create: { eventId, userId: ctx.user.id, status },
      update: { status },
    })

    await writeAuditLog(ctx, 'EVENT_RSVP', 'CommunityEvent', eventId, {
      rsvpId: rsvp.id,
      status,
      eventTitle: event.title,
    })

    return NextResponse.json({ success: true, status: rsvp.status })
  } catch (e) {
    console.error('[community/events/rsvp POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
