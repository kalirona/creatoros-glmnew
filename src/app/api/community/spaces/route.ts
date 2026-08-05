import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  sanitizeString,
  slugify,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── GET /api/community/spaces ─────────────────────────────────────────────
// Returns all ACTIVE spaces in the current workspace, ordered oldest → newest.
export async function GET() {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const spaces = await db.communitySpace.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      spaces: spaces.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        description: s.description,
        icon: s.icon,
        color: s.color,
        visibility: s.visibility,
        memberCount: s.memberCount,
        postCount: s.postCount,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    })
  } catch (e) {
    console.error('[community/spaces GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── POST /api/community/spaces ────────────────────────────────────────────
// Body: { name, description?, visibility? } — creates a space with a unique slug.
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

    const name = sanitizeString(body?.name ?? '', 80)
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const description = sanitizeString(body?.description ?? '', 2000)
    const visibility = ['PUBLIC', 'PRIVATE', 'HIDDEN', 'WORKSPACE_ONLY'].includes(body?.visibility)
      ? body.visibility
      : 'PUBLIC'

    // Unique slug: slugify(name) + timestamp suffix — guaranteed unique per request.
    const slug = `${slugify(name)}-${Date.now().toString(36)}`

    const space = await db.communitySpace.create({
      data: {
        workspaceId: ctx.workspaceId,
        name,
        slug,
        description,
        visibility,
        status: 'ACTIVE',
      },
    })

    await writeAuditLog(ctx, 'SPACE_CREATE', 'CommunitySpace', space.id, {
      name: space.name,
      slug: space.slug,
      visibility: space.visibility,
    })

    return NextResponse.json({
      success: true,
      space: { id: space.id, name: space.name, slug: space.slug },
    })
  } catch (e) {
    console.error('[community/spaces POST] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
