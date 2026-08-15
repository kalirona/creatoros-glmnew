'use client'
import { motion } from 'framer-motion'
import { Crown, Users, DollarSign, TrendingUp, Plus, Check, Zap } from 'lucide-react'
import { useApi, formatCurrency, formatNumber } from '@/hooks/use-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Data {
  stats: { totalMembers: number; mrr: number; lifetime: number; arr: number; plans: number }
  plans: { id: string; name: string; price: number; interval: string; members: number; status: string }[]
}

const INTERVAL_LABEL: Record<string, string> = { MONTHLY: '/mo', YEARLY: '/yr', LIFETIME: ' once' }
const PLAN_COLORS: Record<string, string> = {
  Free: 'from-muted to-muted/50',
  Pro: 'from-primary/20 to-primary/5',
  'Pro Annual': 'from-violet-500/20 to-fuchsia-500/5',
  Lifetime: 'from-amber-500/20 to-orange-500/5',
}

export function MembershipModule() {
  const { data, loading, error } = useApi<Data>('/api/data/membership')
  if (error) return <div className="p-8 text-center text-sm text-muted-foreground">Failed to load data. Please try again.</div>
  if (loading || !data) return <Skeleton className="h-96 rounded-xl" />

  const kpis = [
    { label: 'Total Members', value: formatNumber(data.stats.totalMembers, true), icon: Users, delta: '+342' },
    { label: 'MRR', value: formatCurrency(data.stats.mrr, { compact: true }), icon: DollarSign, delta: '+8.2%' },
    { label: 'ARR', value: formatCurrency(data.stats.arr, { compact: true }), icon: TrendingUp, delta: '+8.2%' },
    { label: 'Lifetime Revenue', value: formatCurrency(data.stats.lifetime, { compact: true }), icon: Crown, delta: '92 members' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Recurring revenue plans and member tiers.</p>
        <Button size="sm" onClick={() => toast.success('New plan builder opened', { description: 'Set up a new membership tier.' })}><Plus className="h-4 w-4 mr-1.5" /> New Plan</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label}><CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div>
                <span className="text-[11px] text-emerald-500 font-medium">{k.delta}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums">{k.value}</p><p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent></Card>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.plans.map((p, i) => {
          const isPro = p.name === 'Pro'
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card className={cn('relative overflow-hidden h-full', isPro && 'ring-2 ring-primary')}>
                {isPro && <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground"><Zap className="h-2.5 w-2.5 mr-1" />Popular</Badge>}
                <div className={cn('h-20 bg-gradient-to-br flex items-center justify-center', PLAN_COLORS[p.name] || 'from-muted to-muted/50')}>
                  <Crown className={cn('h-8 w-8', isPro ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <CardContent className="p-5">
                  <p className="font-semibold">{p.name}</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tabular-nums">{p.price === 0 ? 'Free' : formatCurrency(p.price)}</span>
                    {p.price > 0 && <span className="text-xs text-muted-foreground">{INTERVAL_LABEL[p.interval]}</span>}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{formatNumber(p.members)} active members</p>
                  <div className="mt-4 space-y-1.5">
                    {['All community access', 'Weekly newsletter', p.price > 0 && 'All courses & products', p.price > 199 && 'Weekly office hours', p.price > 1000 && 'Lifetime updates'].filter(Boolean).map((f) => (
                      <div key={f as string} className="flex items-center gap-2 text-xs"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /><span className="text-muted-foreground">{f}</span></div>
                    ))}
                  </div>
                  <Button className="mt-4 w-full" size="sm" variant={isPro ? 'default' : 'outline'} onClick={() => toast.info(`Managing "${p.name}" plan`, { description: 'Edit pricing, features, and benefits.' })}>Manage plan</Button>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
