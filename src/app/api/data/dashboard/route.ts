import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const workspace = await db.workspace.findFirst({
    include: { members: { include: { user: true } } },
  })
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const [courses, products, orders, customers, posts, campaigns, affiliates, pages, plans] = await Promise.all([
    db.course.findMany({ orderBy: { studentsCount: 'desc' } }),
    db.product.findMany({ orderBy: { salesCount: 'desc' } }),
    db.order.findMany({ orderBy: { createdAt: 'desc' }, include: { product: true } }),
    db.customer.findMany(),
    db.communityPost.findMany({ orderBy: { createdAt: 'desc' }, include: { user: true } }),
    db.emailCampaign.findMany(),
    db.affiliate.findMany(),
    db.webPage.findMany(),
    db.membershipPlan.findMany(),
  ])

  const revenue = orders.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + o.amount, 0)
  const refunded = orders.filter((o) => o.status === 'REFUNDED').reduce((s, o) => s + o.amount, 0)
  const totalStudents = courses.reduce((s, c) => s + c.studentsCount, 0)
  const avgRating = courses.reduce((s, c) => s + c.rating, 0) / (courses.length || 1)
  const activeMembers = plans.reduce((s, p) => s + p.members, 0)
  const mrr = plans.filter((p) => p.interval === 'MONTHLY').reduce((s, p) => s + p.price * p.members, 0) +
    plans.filter((p) => p.interval === 'YEARLY').reduce((s, p) => s + (p.price * p.members) / 12, 0)

  const days: { date: string; revenue: number; orders: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const dayOrders = orders.filter((o) => {
      const od = new Date(o.createdAt)
      return od.toDateString() === d.toDateString() && o.status === 'COMPLETED'
    })
    days.push({
      date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      revenue: dayOrders.reduce((s, o) => s + o.amount, 0),
      orders: dayOrders.length,
    })
  }

  const byType: Record<string, number> = {}
  orders.forEach((o) => {
    if (o.status !== 'COMPLETED' || !o.product) return
    byType[o.product.type] = (byType[o.product.type] || 0) + o.amount
  })

  const topProducts = products.slice(0, 5).map((p) => ({ name: p.name, sales: p.salesCount, revenue: p.salesCount * p.price }))
  const recentOrders = orders.slice(0, 6).map((o) => ({
    id: o.id, customer: o.customerName, email: o.customerEmail, amount: o.amount,
    status: o.status, product: o.product?.name || '—', time: o.createdAt,
  }))

  return NextResponse.json({
    workspace: { name: workspace.name, plan: workspace.plan, slug: workspace.slug },
    stats: {
      revenue, refunded, mrr, totalStudents, activeMembers,
      courses: courses.length, products: products.length, customers: customers.length,
      avgRating: Number(avgRating.toFixed(2)), posts: posts.length,
      affiliates: affiliates.length, pages: pages.length,
    },
    charts: {
      revenue14d: days,
      salesByType: Object.entries(byType).map(([type, amount]) => ({ type, amount })),
      topProducts,
    },
    recentOrders,
    team: workspace.members.map((m) => ({ name: m.user.name, email: m.user.email, role: m.role })),
  })
}
