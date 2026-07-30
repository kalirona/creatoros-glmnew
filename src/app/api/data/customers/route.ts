import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const customers = await db.customer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      customers: customers.map((c) => ({
        id: c.id, name: c.name, email: c.email, tags: c.tags.split(',').filter(Boolean),
        ltv: c.ltv, ordersCount: c.ordersCount, status: c.status, createdAt: c.createdAt,
      })),
      stats: {
        total: customers.length,
        active: customers.filter(c => c.status === 'ACTIVE').length,
        totalLTV: customers.reduce((s, c) => s + c.ltv, 0),
        avgLTV: customers.length ? customers.reduce((s, c) => s + c.ltv, 0) / customers.length : 0,
      },
    })
  } catch (e) {
    console.error('Customers error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
