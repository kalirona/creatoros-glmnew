import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
export async function GET() {
  const [courses, products, orders, customers, posts, campaigns, affiliates, pages, plans] = await Promise.all([
    db.course.findMany(), db.product.findMany(), db.order.findMany({ include: { product: true } }),
    db.customer.findMany(), db.communityPost.findMany(), db.emailCampaign.findMany(),
    db.affiliate.findMany(), db.webPage.findMany(), db.membershipPlan.findMany(),
  ])
  const revenue = orders.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + o.amount, 0)
  const mrr = plans.filter((p) => p.interval === 'MONTHLY').reduce((s, p) => s + p.price * p.members, 0) +
    plans.filter((p) => p.interval === 'YEARLY').reduce((s, p) => s + (p.price * p.members) / 12, 0)
  // 12-month revenue trend — use REAL order data grouped by month
  const months: { month: string; revenue: number; students: number }[] = []
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    // Real revenue from orders in this month
    const monthOrders = orders.filter((o) => {
      const od = new Date(o.createdAt)
      return o.status === 'COMPLETED' && od >= d && od < nextD
    })
    const monthRevenue = monthOrders.reduce((s, o) => s + o.amount, 0)
    months.push({
      month: monthNames[d.getMonth()],
      revenue: monthRevenue,
      students: Math.round(courses.reduce((s, c) => s + c.studentsCount, 0) / 12),
    })
  }
  // Traffic sources
  const traffic = [
    { source: 'Organic', visitors: 48200, pct: 38 },
    { source: 'YouTube', visitors: 32100, pct: 25 },
    { source: 'Email', visitors: 18400, pct: 15 },
    { source: 'Social', visitors: 12600, pct: 10 },
    { source: 'Affiliate', visitors: 9800, pct: 8 },
    { source: 'Direct', visitors: 6300, pct: 4 },
  ]
  return NextResponse.json({
    stats: {
      revenue, mrr, arr: mrr * 12,
      students: courses.reduce((s, c) => s + c.studentsCount, 0),
      members: plans.reduce((s, p) => s + p.members, 0),
      products: products.length, courses: courses.length,
      customers: customers.length, posts: posts.length,
      pages: pages.length, affiliates: affiliates.length,
    },
    charts: { months, traffic },
    topPages: pages.sort((a, b) => b.visits - a.visits).slice(0, 6),
    emailPerf: campaigns.filter((c) => c.status === 'SENT').map((c) => ({
      name: c.name, openRate: c.openRate, clickRate: c.clickRate, recipients: c.recipients,
    })),
  })
}
