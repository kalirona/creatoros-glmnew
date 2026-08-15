import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  const generations = await db.aiGeneration.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, toolSlug: true, title: true, status: true, creditsUsed: true, createdAt: true },
  })
  return NextResponse.json({ generations })
}
