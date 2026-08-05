'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ShoppingBag, Package, Users, DollarSign, TrendingUp, TrendingDown, Search,
  Star, Download, Eye, MoreVertical, Tag, Receipt, ShoppingCart, CreditCard,
  AlertCircle, ArrowLeft, Loader2, Filter,
} from 'lucide-react'
import { useApi, formatCurrency, formatNumber, timeAgo } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { ApiErrorBanner, ModuleEmptyState } from '@/components/modules/_state-utils'

interface Product { id: string; name: string; price: number; salesCount: number; status: string; type: string; coverUrl: string | null; revenue: number }
interface Order { id: string; customerName: string; customerEmail: string; amount: number; status: string; productName: string; createdAt: string }
interface Customer { id: string; name: string; email: string; ltv: number; ordersCount: number; status: string; tags: string[]; createdAt: string }

const ORDER_STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-emerald-500/10 text-emerald-600',
  PENDING: 'bg-amber-500/10 text-amber-600',
  REFUNDED: 'bg-rose-500/10 text-rose-600',
  FAILED: 'bg-muted text-muted-foreground',
}

export function StoreModule() {
  const { activeSubTab } = useAppStore()
  const [storeTab, setStoreTab] = useState(activeSubTab || 'overview')

  useEffect(() => {
    if (activeSubTab && ['overview', 'catalog', 'orders', 'customers', 'coupons', 'reports'].includes(activeSubTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStoreTab(activeSubTab)
    }
  }, [activeSubTab])

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Your storefront — manage orders, customers, coupons, and revenue.</p>
      <Tabs value={storeTab} onValueChange={setStoreTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="catalog"><CatalogTab /></TabsContent>
        <TabsContent value="orders"><OrdersTab /></TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="coupons"><CouponsTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Overview Tab ────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: ordersData, loading: ordersLoading } = useApi<{ orders: Order[]; stats: { total: number; revenue: number; refunds: number; pending: number } }>('/api/data/orders')
  const { data: products } = useApi<Product[]>('/api/data/products')

  if (ordersLoading) return <Skeleton className="h-96 rounded-xl" />

  const orders = ordersData?.orders || []
  const stats = ordersData?.stats || { total: 0, revenue: 0, refunds: 0, pending: 0 }
  const topProducts = (products || []).sort((a, b) => b.salesCount - a.salesCount).slice(0, 5)

  const kpis = [
    { label: 'Revenue', value: formatCurrency(stats.revenue, { compact: true }), icon: DollarSign, delta: '+12.4%', up: true },
    { label: 'Orders', value: stats.total, icon: ShoppingBag, delta: '+8.2%', up: true },
    { label: 'Refunds', value: formatCurrency(stats.refunds, { compact: true }), icon: TrendingDown, delta: '-2.1%', up: false },
    { label: 'Pending', value: stats.pending, icon: AlertCircle, delta: '3 orders', up: null },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div>
                  <span className={cn('text-xs font-medium', k.up === true && 'text-emerald-500', k.up === false && 'text-rose-500', k.up === null && 'text-muted-foreground')}>{k.delta}</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Recent orders */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent Orders</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
            ) : orders.slice(0, 8).map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{o.customerName}</p>
                  <p className="text-xs text-muted-foreground truncate">{o.productName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatCurrency(o.amount)}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</p>
                </div>
                <Badge variant="secondary" className={cn('text-xs shrink-0', ORDER_STATUS_CLS[o.status])}>{o.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Best sellers */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Best Sellers</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No products yet</p>
            ) : topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(p.salesCount, true)} sales</p>
                </div>
                <span className="text-sm font-bold text-primary shrink-0">{formatCurrency(p.revenue, { compact: true })}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Catalog Tab ─────────────────────────────────────────────────────────────
function CatalogTab() {
  const { data: products, loading } = useApi<Product[]>('/api/data/products')
  const [query, setQuery] = useState('')

  if (loading) return <Skeleton className="h-96 rounded-xl" />
  if (!products) return <ApiErrorBanner />

  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search catalog..." className="pl-9" />
        </div>
        <Badge variant="secondary" className="text-xs">{filtered.length} products</Badge>
      </div>

      {filtered.length === 0 ? (
        <ModuleEmptyState icon={Package} title="No products in catalog" hint="Products you create in Digital Products will appear here automatically." />
      ) : (
        <Card>
          <CardContent className="p-0">
            {filtered.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50 transition">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                  <Package className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(p.salesCount, true)} sales · {formatCurrency(p.revenue, { compact: true })} revenue</p>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="text-right"><p className="font-medium text-foreground tabular-nums">{formatCurrency(p.price)}</p><p>price</p></div>
                  <div className="text-right"><p className="font-medium text-foreground tabular-nums">{p.salesCount}</p><p>sales</p></div>
                </div>
                <Badge variant="secondary" className={cn('text-xs', p.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted')}>{p.status}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => toast.info('Featuring product')}><Star className="h-4 w-4 mr-2" /> Feature</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info('Visibility toggled')}><Eye className="h-4 w-4 mr-2" /> Hide/Show</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info('Reordering')}><Filter className="h-4 w-4 mr-2" /> Reorder</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Orders Tab ──────────────────────────────────────────────────────────────
function OrdersTab() {
  const { data, loading } = useApi<{ orders: Order[]; stats: { total: number; revenue: number; refunds: number; pending: number } }>('/api/data/orders')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')

  if (loading) return <Skeleton className="h-96 rounded-xl" />

  const orders = data?.orders || []
  const filtered = orders.filter((o) =>
    (filter === 'All' || o.status === filter) &&
    (o.customerName.toLowerCase().includes(query.toLowerCase()) || o.customerEmail.toLowerCase().includes(query.toLowerCase()) || o.id.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by order #, customer, or email..." className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          {['All', 'COMPLETED', 'PENDING', 'REFUNDED'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('rounded-full px-3 py-1.5 text-sm font-medium transition',
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70')}>
              {f === 'All' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <ModuleEmptyState icon={ShoppingBag} title="No orders found" hint={query ? 'Try a different search.' : 'Orders will appear here when customers purchase.'} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_1fr_1fr_80px_100px_80px] gap-2 px-4 py-2.5 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:grid">
              <span>Order #</span><span>Customer</span><span>Product</span><span>Amount</span><span>Status</span><span>Date</span>
            </div>
            {filtered.map((o) => (
              <div key={o.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_80px_100px_80px] gap-2 px-4 py-3 border-b last:border-0 hover:bg-muted/50 transition items-center text-sm">
                <span className="font-mono text-xs truncate">#{o.id.slice(-8)}</span>
                <div className="min-w-0"><p className="font-medium truncate">{o.customerName}</p><p className="text-xs text-muted-foreground truncate">{o.customerEmail}</p></div>
                <span className="truncate text-muted-foreground">{o.productName}</span>
                <span className="font-bold">{formatCurrency(o.amount)}</span>
                <Badge variant="secondary" className={cn('text-xs w-fit', ORDER_STATUS_CLS[o.status])}>{o.status}</Badge>
                <span className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Customers Tab ───────────────────────────────────────────────────────────
function CustomersTab() {
  const { data, loading } = useApi<{ customers: Customer[]; stats: { total: number; active: number; totalLTV: number; avgLTV: number } }>('/api/data/customers')
  const [query, setQuery] = useState('')

  if (loading) return <Skeleton className="h-96 rounded-xl" />

  const customers = data?.customers || []
  const stats = data?.stats || { total: 0, active: 0, totalLTV: 0, avgLTV: 0 }
  const filtered = customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.email.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Customers', v: stats.total, i: Users },
          { l: 'Active', v: stats.active, i: TrendingUp },
          { l: 'Total LTV', v: formatCurrency(stats.totalLTV, { compact: true }), i: DollarSign },
          { l: 'Avg LTV', v: formatCurrency(stats.avgLTV, { compact: true }), i: CreditCard },
        ].map((s) => {
          const Icon = s.i
          return (
            <Card key={s.l}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div>
                <div><p className="text-lg font-bold tabular-nums leading-none">{s.v}</p><p className="text-xs text-muted-foreground mt-1">{s.l}</p></div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers..." className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <ModuleEmptyState icon={Users} title="No customers found" hint={query ? 'Try a different search.' : 'Customers will appear here after their first purchase.'} />
      ) : (
        <Card>
          <CardContent className="p-0">
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50 transition">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold text-sm shrink-0">
                  {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="text-right"><p className="font-medium text-foreground tabular-nums">{c.ordersCount}</p><p>orders</p></div>
                  <div className="text-right"><p className="font-medium text-foreground tabular-nums">{formatCurrency(c.ltv, { compact: true })}</p><p>LTV</p></div>
                </div>
                <Badge variant="secondary" className={cn('text-xs', c.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted')}>{c.status}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => toast.info('Viewing customer')}>View Profile</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info('Order history')}>Order History</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info('Add tag')}><Tag className="h-4 w-4 mr-2" /> Add Tag</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Coupons Tab ─────────────────────────────────────────────────────────────
function CouponsTab() {
  const coupons = [
    { code: 'WELCOME10', discount: '10%', uses: 142, maxUses: 500, status: 'Active', expires: 'Dec 31, 2025' },
    { code: 'BLACKFRIDAY', discount: '50%', uses: 89, maxUses: 100, status: 'Active', expires: 'Nov 30, 2025' },
    { code: 'LAUNCH25', discount: '25%', uses: 320, maxUses: 1000, status: 'Active', expires: 'Jan 31, 2026' },
    { code: 'EXPIRED50', discount: '50%', uses: 45, maxUses: 50, status: 'Expired', expires: 'Oct 31, 2025' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Coupons & Discounts</h3>
        <Button size="sm" onClick={() => toast.info('Create coupon')}><Tag className="h-4 w-4 mr-1.5" /> New Coupon</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {coupons.map((c) => (
            <div key={c.code} className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50 transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Tag className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-mono">{c.code}</p>
                <p className="text-xs text-muted-foreground">{c.discount} off · {c.uses}/{c.maxUses} used · expires {c.expires}</p>
              </div>
              <Badge variant="secondary" className={cn('text-xs', c.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted')}>{c.status}</Badge>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => toast.info('Edit coupon')}><MoreVertical className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Reports Tab ─────────────────────────────────────────────────────────────
function ReportsTab() {
  const { data: ordersData } = useApi<{ stats: { total: number; revenue: number; refunds: number; pending: number } }>('/api/data/orders')
  const { data: products } = useApi<Product[]>('/api/data/products')
  const { data: customersData } = useApi<{ stats: { total: number; active: number; totalLTV: number; avgLTV: number } }>('/api/data/customers')

  const revenue = ordersData?.stats.revenue || 0
  const refunds = ordersData?.stats.refunds || 0
  const totalSales = (products || []).reduce((s, p) => s + p.salesCount, 0)
  const totalProducts = products?.length || 0
  const totalCustomers = customersData?.stats.total || 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Total Revenue', v: formatCurrency(revenue, { compact: true }), i: DollarSign },
          { l: 'Total Sales', v: formatNumber(totalSales, true), i: ShoppingBag },
          { l: 'Refunds', v: formatCurrency(refunds, { compact: true }), i: TrendingDown },
          { l: 'Customers', v: totalCustomers, i: Users },
        ].map((s) => {
          const Icon = s.i
          return (
            <Card key={s.l}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div>
                <div><p className="text-lg font-bold tabular-nums leading-none">{s.v}</p><p className="text-xs text-muted-foreground mt-1">{s.l}</p></div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue by Product</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(products || []).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((p) => {
            const pct = revenue > 0 ? (p.revenue / revenue) * 100 : 0
            return (
              <div key={p.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate">{p.name}</span>
                  <span className="text-muted-foreground">{formatCurrency(p.revenue, { compact: true })}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
