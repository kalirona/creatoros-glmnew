import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getContext,
  writeAuditLog,
  sanitizeString,
} from '@/lib/community'

export const dynamic = 'force-dynamic'

// ─── GET /api/community/spaces/[spaceId] ───────────────────────────────────
// Returns a single space with its last 20 posts (including author info).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { spaceId } = await params

    const space = await db.communitySpace.findFirst({
      where: {
        id: spaceId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        posts: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            user: true,
          },
        },
      },
    })

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 })
    }

    return NextResponse.json({
      space: {
        id: space.id,
        name: space.name,
        slug: space.slug,
        description: space.description,
        icon: space.icon,
        color: space.color,
        visibility: space.visibility,
        memberCount: space.memberCount,
        postCount: space.postCount,
        status: space.status,
        createdAt: space.createdAt,
        updatedAt: space.updatedAt,
        posts: space.posts.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          category: p.category,
          likesCount: p.likesCount,
          commentsCount: p.commentsCount,
          isPinned: p.isPinned,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          author: {
            id: p.user.id,
            name: p.user.name,
            email: p.user.email,
            avatarUrl: p.user.avatarUrl,
          },
        })),
      },
    })
  } catch (e) {
    console.error('[community/spaces/[spaceId] GET] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── PATCH /api/community/spaces/[spaceId] ─────────────────────────────────
// Body: { name?, description?, visibility? } — updates a space.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { spaceId } = await params

    const existing = await db.communitySpace.findFirst({
      where: { id: spaceId, workspaceId: ctx.workspaceId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const data: Record<string, string> = {}
    if (typeof body?.name === 'string') {
      const name = sanitizeString(body.name, 80)
      if (!name) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      data.name = name
    }
    if (typeof body?.description === 'string') {
      data.description = sanitizeString(body.description, 2000)
    }
    if (typeof body?.visibility === 'string') {
      if (!['PUBLIC', 'PRIVATE', 'HIDDEN', 'WORKSPACE_ONLY'].includes(body.visibility)) {
        return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 })
      }
      data.visibility = body.visibility
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const updated = await db.communitySpace.update({
      where: { id: spaceId },
      data,
    })

    await writeAuditLog(ctx, 'SPACE_UPDATE', 'CommunitySpace', spaceId, {
      before: {
        name: existing.name,
        description: existing.description,
        visibility: existing.visibility,
      },
      after: {
        name: updated.name,
        description: updated.description,
        visibility: updated.visibility,
      },
    })

    return NextResponse.json({
      success: true,
      space: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        visibility: updated.visibility,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (e) {
    console.error('[community/spaces/[spaceId] PATCH] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// ─── DELETE /api/community/spaces/[spaceId] ────────────────────────────────
// Archives a space (sets status=ARCHIVED). Does NOT hard-delete.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const ctx = await getContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { spaceId } = await params

    const existing = await db.communitySpace.findFirst({
      where: { id: spaceId, workspaceId: ctx.workspaceId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 })
    }

    await db.communitySpace.update({
      where: { id: spaceId },
      data: { status: 'ARCHIVED' },
    })

    await writeAuditLog(ctx, 'SPACE_ARCHIVE', 'CommunitySpace', spaceId, {
      name: existing.name,
      slug: existing.slug,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[community/spaces/[spaceId] DELETE] Failed:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
