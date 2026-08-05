import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getContext, sanitizeString } from '@/lib/community'

export const dynamic = 'force-dynamic'

// Escapes a user-supplied keyword for use inside a RegExp.
// Supports simple wildcard `*` (mapped to `.*`) and otherwise literal matching.
function keywordToRegex(keyword: string): RegExp {
  // Treat `*` as a wildcard (any chars), escape everything else.
  const escaped = keyword
    .split(/(\*)/)
    .map((seg) => {
      if (seg === '*') return '.*'
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  return new RegExp(escaped, 'i')
}

// ─── POST /api/community/moderation/check ───────────────────────────────────
// Body: { content }
// Returns: { allowed, flagged, matchedKeywords: [{keyword, action}], cleanedContent }
// - BLOCK  → allowed=false, content untouched
// - REVIEW → flagged=true, content untouched
// - REPLACE → apply replacement (default `***`)
// Requires workspace membership (any resolved ctx).
export async function POST(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const b = (body || {}) as Record<string, unknown>

    const content = sanitizeString(
      typeof b.content === 'string' ? b.content : '',
      50000
    )
    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const keywords = await db.bannedKeyword.findMany({
      where: { workspaceId: ctx.workspaceId },
    })

    const matchedKeywords: Array<{ keyword: string; action: string }> = []
    let allowed = true
    let flagged = false
    let cleanedContent = content

    for (const kw of keywords) {
      const re = keywordToRegex(kw.keyword)
      if (!re.test(cleanedContent)) continue

      matchedKeywords.push({ keyword: kw.keyword, action: kw.action })

      if (kw.action === 'BLOCK') {
        allowed = false
      } else if (kw.action === 'REVIEW') {
        flagged = true
      } else if (kw.action === 'REPLACE') {
        const repl = kw.replacement ?? '***'
        // Replace all occurrences using the same regex with global flag.
        const globalRe = new RegExp(re.source, 'gi')
        cleanedContent = cleanedContent.replace(globalRe, repl)
      }
    }

    return NextResponse.json({
      allowed,
      flagged,
      matchedKeywords,
      cleanedContent,
    })
  } catch (e) {
    console.error('[community/moderation/check POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
