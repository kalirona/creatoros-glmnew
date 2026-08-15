import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
export async function GET() {
  const [orders, customers, products] = await Promise.all([
    db.order.findMany({ orderBy: { createdAt: 'desc' }, include: { product: true } }),
    db.customer.findMany({ orderBy: { ltv: 'desc' } }),
    db.product.findMany(),
  ])
  const totalRevenue = orders.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + o.amount, 0)
  const avgLtv = customers.reduce((s, c) => s + c.ltv, 0) / (customers.length || 1)
  return NextResponse.json({
    stats: {
      totalRevenue, avgLtv,
      totalCustomers: customers.length,
      activeCustomers: customers.filter((c) => c.status === 'ACTIVE').length,
      churned: customers.filter((c) => c.status === 'CHURNED').length,
      totalOrders: orders.length,
      refunded: orders.filter((o) => o.status === 'REFUNDED').length,
    },
    orders: orders.slice(0, 30).map((o) => ({
      id: o.id, customer: o.customerName, email: o.customerEmail, amount: o.amount,
      status: o.status, product: o.product?.name || '—', date: o.createdAt,
    })),
    customers: customers.map((c) => ({
      id: c.id, name: c.name, email: c.email, tags: c.tags.split(',').filter(Boolean),
      ltv: c.ltv, orders: c.ordersCount, status: c.status, joined: c.createdAt,
    })),
  })
}
