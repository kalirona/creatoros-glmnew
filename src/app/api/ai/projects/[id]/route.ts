import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  serializeCreatorAsset,
} from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set(['ACTIVE', 'ARCHIVED', 'COMPLETED'])

interface ProjectResponse {
  id: string
  name: string
  description: string
  color: string
  status: string
  assetCount: number
  createdAt: string
}

function serializeProject(p: {
  id: string
  name: string
  description: string
  color: string
  status: string
  assetCount: number
  createdAt: Date
}): ProjectResponse {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color,
    status: p.status,
    assetCount: p.assetCount,
    createdAt: p.createdAt.toISOString(),
  }
}

// GET /api/ai/projects/:id — single project + its assets.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const { id } = await params
    const project = await db.aiProject.findFirst({
      where: { id, workspaceId: user.workspaceId },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    // Assets belong to projects via AiAsset's prompt/title matching is loose;
    // in our schema there's no direct projectId on AiAsset, so we approximate
    // by listing recent assets in this workspace (creator can filter further).
    const assets = await db.aiAsset.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      project: serializeProject(project),
      assets: assets.map(serializeCreatorAsset),
    })
  } catch (e) {
    console.error('AI project get error:', e)
    return NextResponse.json(
      { error: 'Failed to load project.' },
      { status: 500 },
    )
  }
}

// PATCH /api/ai/projects/:id — update project.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { name, description, color, status } = body as {
      name?: string
      description?: string
      color?: string
      status?: string
    }

    const existing = await db.aiProject.findFirst({
      where: { id, workspaceId: user.workspaceId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (typeof name === 'string' && name.trim()) data.name = name.trim().slice(0, 200)
    if (typeof description === 'string') data.description = description.slice(0, 2000)
    if (typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)) data.color = color
    if (typeof status === 'string' && VALID_STATUSES.has(status)) data.status = status

    const updated = await db.aiProject.update({ where: { id }, data })
    return NextResponse.json({ project: serializeProject(updated) })
  } catch (e) {
    console.error('AI project update error:', e)
    return NextResponse.json(
      { error: 'Failed to update project.' },
      { status: 500 },
    )
  }
}

// DELETE /api/ai/projects/:id — delete project (assets remain, just unlinked).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const { id } = await params
    const existing = await db.aiProject.findFirst({
      where: { id, workspaceId: user.workspaceId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    await db.aiProject.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('AI project delete error:', e)
    return NextResponse.json(
      { error: 'Failed to delete project.' },
      { status: 500 },
    )
  }
}
