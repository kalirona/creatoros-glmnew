import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, canModerate } from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── GET /api/community/moderation/warnings ─────────────────────────────────
// Query: ?memberId={memberId}
// Returns: { warnings: [...] } for that member within the workspace.
// Requires: canModerate.
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canModerate(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')
    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId query parameter is required' },
        { status: 400 }
      )
    }

    // Confirm the member exists within the workspace.
    const member = await db.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: ctx.workspaceId },
      select: { id: true },
    })
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const warnings = await db.memberWarning.findMany({
      where: { memberId, workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
    })

    // Resolve issuer users in a single batch.
    const issuerIds = Array.from(
      new Set(warnings.map((w) => w.issuedBy).filter((x): x is string => !!x))
    )
    const issuers =
      issuerIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: issuerIds } },
            select: { id: true, name: true, avatarUrl: true },
          })
        : []
    const issuerMap = new Map(issuers.map((u) => [u.id, u]))

    const out = warnings.map((w) => {
      const issuer = issuerMap.get(w.issuedBy)
      return {
        id: w.id,
        reason: w.reason,
        severity: w.severity,
        acknowledged: w.acknowledged,
        createdAt: w.createdAt,
        issuedBy: issuer
          ? { name: issuer.name, avatarUrl: issuer.avatarUrl }
          : null,
      }
    })

    return NextResponse.json({ warnings: out })
  } catch (e) {
    console.error('[community/moderation/warnings GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
