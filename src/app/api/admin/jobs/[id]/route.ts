import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

// ─── GET — single AiJob detail ────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { id } = await ctx.params

    const job = await db.aiJob.findUnique({
      where: { id },
      include: {
        provider: { select: { id: true, name: true, slug: true } },
      },
    })

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const user = await db.user.findUnique({
      where: { id: job.userId },
      select: { id: true, name: true, avatarUrl: true, email: true },
    })

    return NextResponse.json({ job: { ...job, user } })
  } catch (e) {
    console.error('[admin/jobs/[id] GET]', e)
    return NextResponse.json({ error: 'Failed to load job' }, { status: 500 })
  }
}

// ─── PATCH — update job status (e.g. cancel) ──────────────────────────────
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { id } = await ctx.params
    const body = await req.json()
    const { status, progress, errorMessage } = body as {
      status?: string
      progress?: number
      errorMessage?: string
    }

    const existing = await db.aiJob.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const allowedStatuses = ['QUEUED', 'RENDERING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}
    if (status) data.status = status
    if (progress !== undefined) data.progress = Math.min(100, Math.max(0, Number(progress)))
    if (errorMessage !== undefined) data.errorMessage = errorMessage
    if (status === 'COMPLETED') data.completedAt = new Date()
    if (status === 'CANCELLED') data.completedAt = new Date()
    if (status === 'FAILED') data.completedAt = new Date()

    const job = await db.aiJob.update({ where: { id }, data })
    return NextResponse.json({ success: true, job })
  } catch (e) {
    console.error('[admin/jobs/[id] PATCH]', e)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}

// ─── DELETE — cancel + soft delete (set status=CANCELLED) ─────────────────
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { id } = await ctx.params

    const existing = await db.aiJob.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const job = await db.aiJob.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        errorMessage: existing.errorMessage || 'Cancelled by admin',
      },
    })

    return NextResponse.json({ success: true, job })
  } catch (e) {
    console.error('[admin/jobs/[id] DELETE]', e)
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 })
  }
}
