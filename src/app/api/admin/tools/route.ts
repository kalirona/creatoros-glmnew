import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

// GET all tools (including hidden) for admin
export async function GET() {
  const tools = await db.aiTool.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] })
  const generations = await db.aiGeneration.count()
  const totalCreditsUsed = await db.creditTransaction.aggregate({ where: { amount: { lt: 0 } }, _sum: { amount: true } })
  return NextResponse.json({
    tools: tools.map((t) => ({ ...t, generationCount: 0 })),
    stats: {
      total: tools.length,
      visible: tools.filter((t) => t.isVisible).length,
      pro: tools.filter((t) => t.isPro).length,
      generations,
      totalCreditsUsed: Math.abs(totalCreditsUsed._sum.amount || 0),
    },
  })
}

// PUT — update a tool (Tool Builder: prompts, costs, temp, visibility, etc.)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    // Only allow safe fields
    const allowed = ['name', 'description', 'icon', 'category', 'systemPrompt', 'creditCost', 'temperature', 'maxTokens', 'outputType', 'isVisible', 'isPro']
    const data: Record<string, unknown> = {}
    for (const k of allowed) if (k in updates) data[k] = updates[k]
    const tool = await db.aiTool.update({ where: { id }, data })
    return NextResponse.json({ success: true, tool })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
