import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, paginate } from '@/lib/community'

export const dynamic = 'force-dynamic'

function serializeNotification(n: {
  id: string
  userId: string
  workspaceId: string
  type: string
  title: string
  body: string
  link: string
  actorId: string | null
  entityId: string | null
  entityType: string | null
  read: boolean
  createdAt: Date
}) {
  return {
    id: n.id,
    userId: n.userId,
    workspaceId: n.workspaceId,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    actorId: n.actorId,
    entityId: n.entityId,
    entityType: n.entityType,
    read: n.read,
    createdAt: n.createdAt,
  }
}

// ─── GET /api/community/notifications ───────────────────────────────────────
// Query: ?page=1&pageSize=20&unreadOnly=false
// Returns: { notifications, total, page, pageSize, totalPages, unreadCount }
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? '1') || 1
    const pageSize = Number(searchParams.get('pageSize') ?? '20') || 20
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const where: {
      userId: string
      workspaceId: string
      read?: boolean
    } = { userId: ctx.user.id, workspaceId: ctx.workspaceId }
    if (unreadOnly) where.read = false

    const [total, unreadCount] = await Promise.all([
      db.notification.count({ where }),
      db.notification.count({
        where: {
          userId: ctx.user.id,
          workspaceId: ctx.workspaceId,
          read: false,
        },
      }),
    ])

    const { skip, take, page: safePage, pageSize: safeSize, totalPages } = paginate(
      page,
      pageSize,
      total
    )

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    })

    // Resolve actor users in a single batch.
    const actorIds = Array.from(
      new Set(
        notifications
          .map((n) => n.actorId)
          .filter((x): x is string => !!x)
      )
    )
    const actors =
      actorIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, avatarUrl: true },
          })
        : []
    const actorMap = new Map(actors.map((u) => [u.id, u]))

    const out = notifications.map((n) => {
      const actor = n.actorId ? actorMap.get(n.actorId) ?? null : null
      return {
        ...serializeNotification(n),
        actor: actor
          ? { name: actor.name, avatarUrl: actor.avatarUrl }
          : null,
      }
    })

    return NextResponse.json({
      notifications: out,
      total,
      page: safePage,
      pageSize: safeSize,
      totalPages,
      unreadCount,
    })
  } catch (e) {
    console.error('[community/notifications GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── POST /api/community/notifications ──────────────────────────────────────
// Mark all notifications as read for this user in this workspace.
// Returns: { success, markedRead }
export async function POST(_req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await db.notification.updateMany({
      where: {
        userId: ctx.user.id,
        workspaceId: ctx.workspaceId,
        read: false,
      },
      data: { read: true },
    })

    return NextResponse.json({ success: true, markedRead: result.count })
  } catch (e) {
    console.error('[community/notifications POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── DELETE /api/community/notifications ────────────────────────────────────
// Delete all read notifications for this user in this workspace.
// Returns: { success, deleted }
export async function DELETE(_req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await db.notification.deleteMany({
      where: {
        userId: ctx.user.id,
        workspaceId: ctx.workspaceId,
        read: true,
      },
    })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (e) {
    console.error('[community/notifications DELETE] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
