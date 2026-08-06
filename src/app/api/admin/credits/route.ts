import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

// ─── GET — global credit summary (Super Admin view) ───────────────────────
export async function GET() {
  try {
    const [issuedAgg, spentAgg, circulationAgg, recentTxns, totalUsers] = await Promise.all([
      // Credits issued = sum of positive CreditTransaction.amount
      db.creditTransaction.aggregate({
        where: { amount: { gt: 0 } },
        _sum: { amount: true },
        _count: true,
      }),
      // Credits spent = absolute sum of negative amounts
      db.creditTransaction.aggregate({
        where: { amount: { lt: 0 } },
        _sum: { amount: true },
        _count: true,
      }),
      // Total credits in circulation across all users
      db.user.aggregate({
        _sum: { credits: true },
        _count: true,
      }),
      // Recent 20 transactions with user info
      db.creditTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      }),
      db.user.count(),
    ])

    return NextResponse.json({
      summary: {
        totalIssued: issuedAgg._sum.amount || 0,
        issuedCount: issuedAgg._count,
        totalSpent: Math.abs(spentAgg._sum.amount || 0),
        spentCount: spentAgg._count,
        inCirculation: circulationAgg._sum.credits || 0,
        totalUsers,
        avgCreditsPerUser:
          totalUsers > 0 ? Math.round((circulationAgg._sum.credits || 0) / totalUsers) : 0,
      },
      recent: recentTxns,
    })
  } catch (e) {
    console.error('[admin/credits GET]', e)
    return NextResponse.json({ error: 'Failed to load credits' }, { status: 500 })
  }
}
