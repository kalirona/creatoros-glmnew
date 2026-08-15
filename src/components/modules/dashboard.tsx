'use client'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, DollarSign, Users, GraduationCap, Star, ShoppingCart, Sparkles, ArrowUpRight, Activity, Zap } from 'lucide-react'
import { useApi, formatCurrency, formatNumber, timeAgo } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { useAppStore } from '@/store/app-store'
import { Skeleton } from '@/components/ui/skeleton'

interface DashData {
  workspace: { name: string; plan: string; slug: string }
  stats: {
    revenue: number; refunded: number; mrr: number; totalStudents: number; activeMembers: number;
    courses: number; products: number; customers: number; avgRating: number; posts: number;
    affiliates: number; pages: number;
  }
  charts: {
    revenue14d: { date: string; revenue: number; orders: number }[]
    salesByType: { type: string; amount: number }[]
    topProducts: { name: string; sales: number; revenue: number }[]
  }
  recentOrders: { id: string; customer: string; email: string; amount: number; status: string; product: string; time: string }[]
  team: { name: string; email: string; role: string }[]
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function DashboardModule() {
  const { data, loading, error } = useApi<DashData>('/api/data/dashboard')
  const setActiveModule = useAppStore((s) => s.setActiveModule)

  if (error) return <div className="p-8 text-center text-sm text-muted-foreground">Failed to load dashboard data. Please try again.</div>
  if (loading || !data) return <DashboardSkeleton />

  const kpis = [
    { label: 'Total Revenue', value: formatCurrency(data.stats.revenue), delta: '+12.4%', up: true, icon: DollarSign, accent: 'text-emerald-500' },
    { label: 'MRR', value: formatCurrency(data.stats.mrr), delta: '+8.2%', up: true, icon: TrendingUp, accent: 'text-primary' },
    { label: 'Active Members', value: formatNumber(data.stats.activeMembers, true), delta: '+5.1%', up: true, icon: Users, accent: 'text-blue-500' },
    { label: 'Avg. Rating', value: `${data.stats.avgRating}★`, delta: '+0.2', up: true, icon: Star, accent: 'text-amber-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8"
      >
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-32 top-20 h-32 w-32 rounded-full bg-chart-2/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20">
                <Sparkles className="h-3 w-3 mr-1" /> {data.workspace.plan} Plan
              </Badge>
              <span className="text-xs text-muted-foreground">Workspace: {data.workspace.name}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back, Alex 👋</h2>
            <p className="text-sm text-muted-foreground max-w-lg">
              Your creator business is up <span className="font-semibold text-emerald-500">12.4%</span> this week. You have 3 new sales and 2 AI generations waiting.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveModule('analytics')}>
              <Activity className="h-4 w-4 mr-1.5" /> View analytics
            </Button>
            <Button size="sm" onClick={() => setActiveModule('ai-studio')}>
              <Zap className="h-4 w-4 mr-1.5" /> Open AI Studio
            </Button>
          </div>
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted ${kpi.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`flex items-center gap-0.5 text-xs font-semibold ${kpi.up ? 'text-emerald-500' : 'text-red-500'}`}>
                      {kpi.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {kpi.delta}
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Revenue</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Last 14 days</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums">{formatCurrency(data.stats.revenue)}</p>
              <p className="text-xs text-emerald-500 font-medium">+12.4% vs prev period</p>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.charts.revenue14d} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--popover-foreground)' }}
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sales by type donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Mix</CardTitle>
            <p className="text-xs text-muted-foreground">By product type</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.charts.salesByType} dataKey="amount" nameKey="type" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                  {data.charts.salesByType.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {data.charts.salesByType.map((t, i) => (
                <div key={t.type} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground">{t.type}</span>
                  </div>
                  <span className="font-medium tabular-nums">{formatCurrency(t.amount, { compact: true })}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top products */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Top Products</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveModule('products')}>
              View all <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.charts.topProducts} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v, true)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={120} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="revenue" fill="var(--chart-1)" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Sales</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveModule('crm')}>
              CRM <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[220px] overflow-y-auto scroll-thin">
            {data.recentOrders.map((o) => (
              <div key={o.id} className="flex items-center gap-3 py-1.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-[10px] bg-muted">{o.customer.split(' ').map((n) => n[0]).join('').slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{o.customer}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{o.product}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold tabular-nums">{formatCurrency(o.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(o.time)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: GraduationCap, label: 'Create Course', desc: 'AI-assisted course builder', mod: 'courses' as const, color: 'text-primary' },
          { icon: ShoppingCart, label: 'Add Product', desc: 'Sell digital downloads', mod: 'products' as const, color: 'text-chart-2' },
          { icon: Users, label: 'Post in Community', desc: 'Engage your audience', mod: 'community' as const, color: 'text-chart-3' },
          { icon: Sparkles, label: 'Generate Content', desc: 'AI Studio tools', mod: 'ai-studio' as const, color: 'text-chart-4' },
        ].map((a) => {
          const Icon = a.icon
          return (
            <button key={a.label} onClick={() => setActiveModule(a.mod)} className="group text-left">
              <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted ${a.color} mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold">{a.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
