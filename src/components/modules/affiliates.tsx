'use client'
import { motion } from 'framer-motion'
import { Link2, DollarSign, MousePointerClick, Target, Wallet, Copy, Check, TrendingUp, Plus } from 'lucide-react'
import { useState } from 'react'
import { useApi, formatCurrency, formatNumber } from '@/hooks/use-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Data {
  stats: { totalEarnings: number; totalClicks: number; totalConversions: number; affiliates: number; avgConversionRate: number; pendingPayouts: number }
  affiliates: { id: string; name: string; email: string; code: string; clicks: number; conversions: number; earnings: number; commissionRate: number; status: string }[]
}

export function AffiliatesModule() {
  const { data, loading, error } = useApi<Data>('/api/data/affiliates')
  const [copied, setCopied] = useState<string | null>(null)

  if (error) return <div className="p-8 text-center text-sm text-muted-foreground">Failed to load data. Please try again.</div>
  if (loading || !data) return <Skeleton className="h-96 rounded-xl" />

  const copy = (code: string) => {
    navigator.clipboard.writeText(`https://creatoros.io/r/${code}`)
    setCopied(code); setTimeout(() => setCopied(null), 1500); toast.success('Referral link copied')
  }

  const kpis = [
    { label: 'Total Earnings', value: formatCurrency(data.stats.totalEarnings), icon: DollarSign, delta: '+24%' },
    { label: 'Total Clicks', value: formatNumber(data.stats.totalClicks, true), icon: MousePointerClick, delta: '+18%' },
    { label: 'Conversions', value: formatNumber(data.stats.totalConversions), icon: Target, delta: '+12%' },
    { label: 'Pending Payouts', value: formatCurrency(data.stats.pendingPayouts), icon: Wallet, delta: '3 affiliates' },
  ]

  return (
    <div className="space-y-5">
      {/* Referral CTA */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="secondary" className="bg-primary/15 text-primary mb-2"><Link2 className="h-3 w-3 mr-1" />Your referral link</Badge>
            <p className="text-sm text-muted-foreground">Share this link and earn 30% commission on every sale.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded-lg bg-muted px-3 py-1.5 text-sm font-mono">creatoros.io/r/ALEX30</code>
              <Button size="sm" variant="outline" onClick={() => copy('ALEX30')}>
                {copied === 'ALEX30' ? <><Check className="h-3.5 w-3.5 mr-1" />Copied</> : <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>}
              </Button>
            </div>
          </div>
          <div className="flex gap-6">
            <div><p className="text-2xl font-bold text-primary tabular-nums">142</p><p className="text-xs text-muted-foreground">Your clicks</p></div>
            <div><p className="text-2xl font-bold text-primary tabular-nums">12</p><p className="text-xs text-muted-foreground">Conversions</p></div>
            <div><p className="text-2xl font-bold text-primary tabular-nums">$1,284</p><p className="text-xs text-muted-foreground">Earned</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label}><CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div>
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />{k.delta}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent></Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <p className="text-sm font-semibold">Top Affiliates</p>
              <Button size="sm" variant="outline" onClick={() => toast.success('Invite link ready', { description: 'Share this link to recruit new affiliates.' })}><Plus className="h-3.5 w-3.5 mr-1" />Invite</Button>
            </div>
            <div className="max-h-[420px] overflow-y-auto scroll-thin">
              {data.affiliates.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50 transition">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</div>
                  <Avatar><AvatarFallback className="bg-muted text-xs">{a.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">code: <code className="font-mono">{a.code}</code></p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="text-right"><p className="font-medium text-foreground tabular-nums">{formatNumber(a.clicks)}</p><p>clicks</p></div>
                    <div className="text-right"><p className="font-medium text-foreground tabular-nums">{a.conversions}</p><p>conv.</p></div>
                    <div className="text-right"><p className="font-semibold text-primary tabular-nums">{formatCurrency(a.earnings)}</p><p>earned</p></div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => copy(a.code)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-1">Conversion by Affiliate</p>
            <p className="text-xs text-muted-foreground mb-3">Conversions this month</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.affiliates.map((a) => ({ name: a.name.split(' ')[0], conv: a.conversions }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="conv" fill="var(--chart-1)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
