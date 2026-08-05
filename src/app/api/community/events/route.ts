import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  sanitizeString,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

const EVENT_TYPES = ['ONLINE', 'OFFLINE', 'ZOOM', 'MEET', 'TEAMS']

// ─── GET /api/community/events ─────────────────────────────────────────────
// Returns all non-CANCELLED events in workspace, ordered by startTime asc.
// Includes RSVP count and the current user's RSVP status per event.
export async function GET() {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const events = await db.communityEvent.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        status: { not: 'CANCELLED' },
      },
      orderBy: { startTime: 'asc' },
      include: {
        user: true,
        _count: { select: { rsvps: true } },
        rsvps: {
          where: { userId: ctx.user.id },
          select: { status: true },
        },
      },
    })

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        location: e.location,
        meetingUrl: e.meetingUrl,
        startTime: e.startTime,
        endTime: e.endTime,
        bannerUrl: e.bannerUrl,
        maxAttendees: e.maxAttendees,
        status: e.status,
        spaceId: e.spaceId,
        createdAt: e.createdAt,
        organizer: {
          id: e.user.id,
          name: e.user.name,
          avatarUrl: e.user.avatarUrl,
        },
        _count: { rsvps: e._count.rsvps },
        // rsvps[0] is the current user's RSVP (if any)
        myRSVP: e.rsvps.length > 0 ? e.rsvps[0].status : null,
      })),
    })
  } catch (e) {
    console.error('[community/events GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── POST /api/community/events ────────────────────────────────────────────
// Body: { title, description?, type?, location?, meetingUrl?, startTime,
//         endTime?, spaceId?, maxAttendees? } — creates an event.
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

    const title = sanitizeString(body?.title ?? '', 200)
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const startMs = Date.parse(body?.startTime)
    if (!body?.startTime || Number.isNaN(startMs)) {
      return NextResponse.json({ error: 'Valid startTime is required' }, { status: 400 })
    }
    const startTime = new Date(startMs)

    let endTime: Date | null = null
    if (body?.endTime) {
      const endMs = Date.parse(body.endTime)
      if (Number.isNaN(endMs)) {
        return NextResponse.json({ error: 'Invalid endTime' }, { status: 400 })
      }
      endTime = new Date(endMs)
      if (endTime < startTime) {
        return NextResponse.json({ error: 'endTime must be after startTime' }, { status: 400 })
      }
    }

    const type = EVENT_TYPES.includes(body?.type) ? body.type : 'ONLINE'
    const description = sanitizeString(body?.description ?? '', 5000)
    const location = body?.location ? sanitizeString(body.location, 300) : null
    const meetingUrl = body?.meetingUrl ? sanitizeString(body.meetingUrl, 2048) : null
    const bannerUrl = body?.bannerUrl ? sanitizeString(body.bannerUrl, 2048) : null
    const maxAttendees =
      typeof body?.maxAttendees === 'number' && body.maxAttendees > 0
        ? Math.floor(body.maxAttendees)
        : null

    // Optional: link to a space — must belong to same workspace.
    let spaceId: string | null = null
    if (body?.spaceId) {
      const space = await db.communitySpace.findFirst({
        where: { id: body.spaceId, workspaceId: ctx.workspaceId },
        select: { id: true },
      })
      if (!space) {
        return NextResponse.json({ error: 'Referenced space not found' }, { status: 400 })
      }
      spaceId = space.id
    }

    const event = await db.communityEvent.create({
      data: {
        workspaceId: ctx.workspaceId,
        spaceId,
        userId: ctx.user.id,
        title,
        description,
        type,
        location,
        meetingUrl,
        startTime,
        endTime,
        bannerUrl,
        maxAttendees,
        status: 'SCHEDULED',
      },
    })

    await writeAuditLog(ctx, 'EVENT_CREATE', 'CommunityEvent', event.id, {
      title: event.title,
      type: event.type,
      startTime: event.startTime.toISOString(),
      spaceId: event.spaceId,
    })

    return NextResponse.json({
      success: true,
      event: { id: event.id },
    })
  } catch (e) {
    console.error('[community/events POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── DELETE /api/community/events?id={eventId} ─────────────────────────────
// Cancels an event (sets status=CANCELLED). Does NOT hard-delete (preserves RSVPs/history).
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventId = req.nextUrl.searchParams.get('id')
    if (!eventId) {
      return NextResponse.json({ error: 'Missing id query parameter' }, { status: 400 })
    }

    const existing = await db.communityEvent.findFirst({
      where: { id: eventId, workspaceId: ctx.workspaceId },
      select: { id: true, title: true, status: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    await db.communityEvent.update({
      where: { id: eventId },
      data: { status: 'CANCELLED' },
    })

    await writeAuditLog(ctx, 'EVENT_CANCEL', 'CommunityEvent', eventId, {
      title: existing.title,
      previousStatus: existing.status,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[community/events DELETE] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
