import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const orders = await db.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { product: { select: { name: true } } },
    })
    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id, customerName: o.customerName, customerEmail: o.customerEmail,
        amount: o.amount, currency: o.currency, status: o.status,
        productName: o.product?.name || 'N/A',
        createdAt: o.createdAt,
      })),
      stats: {
        total: orders.length,
        revenue: orders.filter(o => o.status === 'COMPLETED').reduce((s, o) => s + o.amount, 0),
        refunds: orders.filter(o => o.status === 'REFUNDED').reduce((s, o) => s + o.amount, 0),
        pending: orders.filter(o => o.status === 'PENDING').length,
      },
    })
  } catch (e) {
    console.error('Orders error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
