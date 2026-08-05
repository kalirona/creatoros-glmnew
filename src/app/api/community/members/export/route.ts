import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  canManageMembers,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

// Escape a CSV field — always quote, double-up any embedded quotes.
function csvEscape(value: string | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

// ─── GET /api/community/members/export ─────────────────────────────────────
// Query: ?role=&status=&search=
// Returns CSV attachment. Requires canManageMembers.
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageMembers(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || undefined
    const role = searchParams.get('role')?.trim() || undefined
    const status = searchParams.get('status')?.trim() || undefined

    type Where = {
      workspaceId: string
      role?: string
      memberStatus?: string
      user?: { OR: Array<{ name: { contains: string } } | { email: { contains: string } }> }
    }
    const where: Where = { workspaceId: ctx.workspaceId }
    if (role) where.role = role
    if (status) where.memberStatus = status
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      }
    }

    const members = await db.workspaceMember.findMany({
      where,
      orderBy: { joinedAt: 'desc' },
      include: { user: true },
    })

    const header = [
      'name',
      'email',
      'role',
      'status',
      'joinedAt',
      'lastSeenAt',
      'posts',
      'comments',
      'likesReceived',
    ]
    const rows = members.map((m) =>
      [
        m.user.name,
        m.user.email,
        m.role,
        m.memberStatus,
        m.joinedAt.toISOString(),
        m.lastSeenAt.toISOString(),
        String(m.postsCount),
        String(m.commentsCount),
        String(m.likesReceived),
      ]
        .map(csvEscape)
        .join(',')
    )

    const csv = [header.map(csvEscape).join(','), ...rows].join('\r\n')

    await writeAuditLog(ctx, 'EXPORT_CSV', 'WorkspaceMember', undefined, {
      count: members.length,
      filters: { role, status, search },
    })

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="members.csv"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[community/members/export GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
