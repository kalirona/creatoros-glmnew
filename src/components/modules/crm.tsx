'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, DollarSign, Users, TrendingUp, RotateCcw, Mail, Tag, Activity, ArrowUpRight } from 'lucide-react'
import { useApi, formatCurrency, formatNumber, timeAgo } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Data {
  stats: { totalRevenue: number; avgLtv: number; totalCustomers: number; activeCustomers: number; churned: number; totalOrders: number; refunded: number }
  orders: { id: string; customer: string; email: string; amount: number; status: string; product: string; date: string }[]
  customers: { id: string; name: string; email: string; tags: string[]; ltv: number; orders: number; status: string; joined: string }[]
}

const STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-emerald-500/10 text-emerald-600',
  REFUNDED: 'bg-rose-500/10 text-rose-600',
  PENDING: 'bg-amber-500/10 text-amber-600',
  ACTIVE: 'bg-emerald-500/10 text-emerald-600',
  CHURNED: 'bg-rose-500/10 text-rose-600',
  LEAD: 'bg-sky-500/10 text-sky-600',
}

export function CrmModule() {
  const { data, loading, error } = useApi<Data>('/api/data/crm')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Data['customers'][0] | null>(null)

  if (error) return <div className="p-8 text-center text-sm text-muted-foreground">Failed to load data. Please try again.</div>
  if (loading || !data) return <Skeleton className="h-96 rounded-xl" />

  const filteredCustomers = data.customers.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) || c.email.toLowerCase().includes(query.toLowerCase()))

  const kpis = [
    { label: 'Total Revenue', value: formatCurrency(data.stats.totalRevenue, { compact: true }), icon: DollarSign, delta: '+12.4%' },
    { label: 'Customers', value: formatNumber(data.stats.totalCustomers), icon: Users, delta: `${data.stats.activeCustomers} active` },
    { label: 'Avg LTV', value: formatCurrency(data.stats.avgLtv), icon: TrendingUp, delta: '+8.2%' },
    { label: 'Churn Rate', value: `${((data.stats.churned / data.stats.totalCustomers) * 100).toFixed(1)}%`, icon: RotateCcw, delta: '-1.2%' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label}><CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div>
                <span className="text-[11px] text-muted-foreground">{k.delta}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent></Card>
          )
        })}
      </div>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers..." className="pl-9" />
            </div>
            <Button size="sm" onClick={() => toast.success('Add customer form opened', { description: 'Manually add a customer to your CRM.' })}><Users className="h-4 w-4 mr-1.5" /> Add Customer</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[520px] overflow-y-auto scroll-thin">
                  {filteredCustomers.map((c, i) => (
                    <motion.button key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      onClick={() => setSelected(c)}
                      className={cn('flex w-full items-center gap-3 p-3 text-left border-b last:border-0 hover:bg-muted/50 transition',
                        selected?.id === c.id && 'bg-primary/5')}>
                      <Avatar><AvatarFallback className="bg-muted text-xs">{c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(c.ltv)}</p>
                        <p className="text-[10px] text-muted-foreground">{c.orders} orders</p>
                      </div>
                      <Badge variant="secondary" className={cn('text-[10px]', STATUS_CLS[c.status])}>{c.status}</Badge>
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selected ? (
              <Card className="h-fit">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12"><AvatarFallback className="bg-primary/15 text-primary">{selected.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{selected.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{selected.email}</p>
                    </div>
                    <Badge variant="secondary" className={cn('text-[10px]', STATUS_CLS[selected.status])}>{selected.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/50 p-3"><p className="text-lg font-bold tabular-nums">{formatCurrency(selected.ltv)}</p><p className="text-[10px] text-muted-foreground">Lifetime Value</p></div>
                    <div className="rounded-lg bg-muted/50 p-3"><p className="text-lg font-bold tabular-nums">{selected.orders}</p><p className="text-[10px] text-muted-foreground">Total Orders</p></div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5"><Tag className="h-3 w-3" />Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      <Badge variant="outline" className="text-[10px] cursor-pointer">+ Add</Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Activity className="h-3 w-3" />Activity Timeline</p>
                    <div className="space-y-2.5 border-l-2 border-border pl-3">
                      <div><p className="text-xs font-medium">Purchased {selected.orders > 1 ? `${selected.orders} products` : 'a product'}</p><p className="text-[10px] text-muted-foreground">{timeAgo(selected.joined)}</p></div>
                      <div><p className="text-xs font-medium">Joined as customer</p><p className="text-[10px] text-muted-foreground">{timeAgo(selected.joined)}</p></div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => toast.success(`Email draft started`, { description: `Composing email to ${selected.email}` })}><Mail className="h-3.5 w-3.5 mr-1.5" /> Email customer</Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-fit"><CardContent className="p-8 text-center text-sm text-muted-foreground">Select a customer to view details</CardContent></Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[520px] overflow-y-auto scroll-thin">
                {data.orders.map((o, i) => (
                  <motion.div key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50 transition">
                    <Avatar className="h-8 w-8"><AvatarFallback className="bg-muted text-[10px]">{o.customer.split(' ').map((n) => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{o.customer}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.product}</p>
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{timeAgo(o.date)}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(o.amount)}</span>
                    <Badge variant="secondary" className={cn('text-[10px]', STATUS_CLS[o.status])}>{o.status}</Badge>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
