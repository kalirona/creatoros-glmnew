import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, canModerate, writeAuditLog, sanitizeString } from '@/lib/community'

export const dynamic = 'force-dynamic'

const VALID_ACTIONS = ['BLOCK', 'REVIEW', 'REPLACE']
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function serializeKeyword(k: {
  id: string
  workspaceId: string
  keyword: string
  action: string
  replacement: string | null
  severity: string
  createdBy: string | null
  createdAt: Date
}) {
  return {
    id: k.id,
    workspaceId: k.workspaceId,
    keyword: k.keyword,
    action: k.action,
    replacement: k.replacement,
    severity: k.severity,
    createdBy: k.createdBy,
    createdAt: k.createdAt,
  }
}

// ─── GET /api/community/moderation/keywords ─────────────────────────────────
// Requires: canModerate. Returns { keywords: [...] } for the workspace.
export async function GET(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canModerate(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Optional filters (ignored for shape, but supported for UX).
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || undefined

    const where: { workspaceId: string; action?: string } = { workspaceId: ctx.workspaceId }
    if (action && VALID_ACTIONS.includes(action)) where.action = action

    const keywords = await db.bannedKeyword.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ keywords: keywords.map(serializeKeyword) })
  } catch (e) {
    console.error('[community/moderation/keywords GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── POST /api/community/moderation/keywords ────────────────────────────────
// Body: { keyword, action: 'BLOCK'|'REVIEW'|'REPLACE', replacement?, severity }
export async function POST(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canModerate(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const keyword = sanitizeString(
      typeof b.keyword === 'string' ? b.keyword : '',
      100
    )
    if (!keyword || keyword.length < 1 || keyword.length > 100) {
      return NextResponse.json(
        { error: 'keyword is required and must be 1-100 characters' },
        { status: 400 }
      )
    }

    const action = typeof b.action === 'string' ? b.action : ''
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of BLOCK|REVIEW|REPLACE' },
        { status: 400 }
      )
    }

    const severity =
      typeof b.severity === 'string' && VALID_SEVERITIES.includes(b.severity)
        ? b.severity
        : 'MEDIUM'

    let replacement: string | null = null
    if (action === 'REPLACE') {
      const r = sanitizeString(
        typeof b.replacement === 'string' ? b.replacement : '',
        100
      )
      if (!r) {
        return NextResponse.json(
          { error: 'replacement is required when action is REPLACE' },
          { status: 400 }
        )
      }
      replacement = r
    }

    // Prevent duplicates within the workspace.
    const existing = await db.bannedKeyword.findFirst({
      where: { workspaceId: ctx.workspaceId, keyword },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'A banned keyword with this text already exists' },
        { status: 409 }
      )
    }

    const created = await db.bannedKeyword.create({
      data: {
        workspaceId: ctx.workspaceId,
        keyword,
        action,
        replacement,
        severity,
        createdBy: ctx.user.id,
      },
    })

    await writeAuditLog(ctx, 'KEYWORD_ADD', 'BannedKeyword', created.id, {
      keyword,
      action,
      replacement,
      severity,
    })

    return NextResponse.json({ success: true, keyword: serializeKeyword(created) })
  } catch (e) {
    console.error('[community/moderation/keywords POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── DELETE /api/community/moderation/keywords?id={keywordId} ───────────────
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canModerate(ctx.workspaceRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 }
      )
    }

    const existing = await db.bannedKeyword.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })
    }

    await db.bannedKeyword.delete({ where: { id: existing.id } })

    await writeAuditLog(ctx, 'KEYWORD_REMOVE', 'BannedKeyword', existing.id, {
      keyword: existing.keyword,
      action: existing.action,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[community/moderation/keywords DELETE] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
