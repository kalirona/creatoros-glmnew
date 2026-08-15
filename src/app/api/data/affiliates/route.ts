import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const affiliates = await db.affiliate.findMany({ orderBy: { earnings: 'desc' } })
  const totalEarnings = affiliates.reduce((s, a) => s + a.earnings, 0)
  const totalClicks = affiliates.reduce((s, a) => s + a.clicks, 0)
  const totalConversions = affiliates.reduce((s, a) => s + a.conversions, 0)
  return NextResponse.json({
    stats: {
      totalEarnings, totalClicks, totalConversions,
      affiliates: affiliates.length,
      avgConversionRate: totalClicks ? (totalConversions / totalClicks) * 100 : 0,
      pendingPayouts: totalEarnings * 0.3,
    },
    affiliates: affiliates.map((a) => ({
      id: a.id, name: a.name, email: a.email, code: a.code, clicks: a.clicks,
      conversions: a.conversions, earnings: a.earnings, commissionRate: a.commissionRate, status: a.status,
    })),
  })
}
