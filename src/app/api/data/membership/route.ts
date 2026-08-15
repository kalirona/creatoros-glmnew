import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
export async function GET() {
  const plans = await db.membershipPlan.findMany({ orderBy: { price: 'asc' } })
  const totalMembers = plans.reduce((s, p) => s + p.members, 0)
  const mrr = plans.filter((p) => p.interval === 'MONTHLY').reduce((s, p) => s + p.price * p.members, 0) +
    plans.filter((p) => p.interval === 'YEARLY').reduce((s, p) => s + (p.price * p.members) / 12, 0)
  const lifetime = plans.filter((p) => p.interval === 'LIFETIME').reduce((s, p) => s + p.price * p.members, 0)
  return NextResponse.json({
    stats: { totalMembers, mrr, lifetime, arr: mrr * 12, plans: plans.length },
    plans: plans.map((p) => ({ id: p.id, name: p.name, price: p.price, interval: p.interval, members: p.members, status: p.status })),
  })
}
