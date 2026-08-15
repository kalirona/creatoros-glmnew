import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  safeJsonParse,
} from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'

const VALID_MODULES = new Set([
  'course',
  'website',
  'blog',
  'product',
  'community',
  'email',
  'marketing',
])

interface UsedInEntry {
  module: string
  entityId?: string | null
  entityName?: string | null
  usedAt: string
}

// POST /api/ai/assets/:id/use — mark an asset as used in a module.
// (Called by the "Use in Course" / "Use in Website" / "Use in Blog" buttons.)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { module, entityId, entityName } = body as {
      module?: string
      entityId?: string
      entityName?: string
    }

    if (!module || !VALID_MODULES.has(module)) {
      return NextResponse.json(
        {
          error:
            'Invalid module. Allowed: course, website, blog, product, community, email, marketing.',
        },
        { status: 400 },
      )
    }

    const asset = await db.aiAsset.findFirst({
      where: { id, workspaceId: user.workspaceId },
    })
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
    }

    const existing = safeJsonParse<UsedInEntry[]>(asset.usedIn, [])
    const entry: UsedInEntry = {
      module,
      entityId: entityId ?? null,
      entityName: entityName ?? null,
      usedAt: new Date().toISOString(),
    }
    const updated = [...existing, entry]

    await db.aiAsset.update({
      where: { id },
      data: {
        usedIn: JSON.stringify(updated),
        isUsed: true,
      },
    })

    return NextResponse.json({
      success: true,
      usedIn: updated,
    })
  } catch (e) {
    console.error('AI asset use error:', e)
    return NextResponse.json(
      { error: 'Failed to mark asset as used.' },
      { status: 500 },
    )
  }
}
