import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from "@/lib/auth"

export const dynamic = 'force-dynamic'

// GET /api/ai/projects — list projects for the user.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No user account is available.' }, { status: 400 })
    }

    const projects = await db.aiProject.findMany({
      where: { workspaceId: user.workspaceId, userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        color: p.color,
        status: p.status,
        assetCount: p.assetCount,
        createdAt: p.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('AI projects list error:', e)
    return NextResponse.json(
      { error: 'Failed to load projects.' },
      { status: 500 },
    )
  }
}

// POST /api/ai/projects — create a new project.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { name, description, color } = body as {
      name?: string
      description?: string
      color?: string
    }

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
    }
    if (name.length > 200) {
      return NextResponse.json(
        { error: 'Project name must be ≤ 200 chars.' },
        { status: 400 },
      )
    }
    const cleanDesc =
      typeof description === 'string' ? description.slice(0, 2000) : ''
    const cleanColor =
      typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)
        ? color
        : '#10b981'

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No user account is available.' }, { status: 400 })
    }

    const project = await db.aiProject.create({
      data: {
        workspaceId: user.workspaceId,
        userId: user.id,
        name: name.trim(),
        description: cleanDesc,
        color: cleanColor,
        status: 'ACTIVE',
      },
    })

    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      status: project.status,
      assetCount: project.assetCount,
      createdAt: project.createdAt.toISOString(),
    })
  } catch (e) {
    console.error('AI project create error:', e)
    return NextResponse.json(
      { error: 'Failed to create project.' },
      { status: 500 },
    )
  }
}
