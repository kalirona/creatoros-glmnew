'use client'
import { useState } from 'react'
import { Zap, Megaphone, Plus, Loader2, TrendingUp, Users, DollarSign, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useApi, formatNumber, timeAgo } from '@/hooks/use-api'
import { ModuleEmptyState } from '@/components/modules/_state-utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Funnel {
  id: string
  name: string
  description?: string
  type: string
  status: string
  visits: number
  conversions: number
  revenue: number
  steps?: Array<{ id: string; name: string; type: string; position: number }>
  createdAt: string
}

export function AutomationModule() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automation</h1>
          <p className="text-sm text-muted-foreground mt-1">Sales funnels, workflows, and automated sequences that convert visitors into customers.</p>
        </div>
      </div>

      <FunnelsPanel />
    </div>
  )
}

// ─── Funnels Panel ──────────────────────────────────────────────────────────

function FunnelsPanel() {
  const { data, loading, refetch } = useApi<{ funnels: Funnel[]; stats: { total: number; live: number; totalVisits: number; totalRevenue: number } }>('/api/data/funnels')
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('SALES')
  const [creating, setCreating] = useState(false)

  const createFunnel = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/data/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description, type }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      toast.success('Funnel created')
      setName(''); setDescription(''); setType('SALES')
      setCreateOpen(false)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <Skeleton className="h-64 rounded-xl" />

  const funnels = data?.funnels || []
  const stats = data?.stats || { total: 0, live: 0, totalVisits: 0, totalRevenue: 0 }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Zap className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Total Funnels</span></div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Live</span></div>
          <p className="text-2xl font-bold text-emerald-500">{stats.live}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Eye className="h-4 w-4 text-sky-500" /><span className="text-xs text-muted-foreground">Total Visits</span></div>
          <p className="text-2xl font-bold">{formatNumber(stats.totalVisits)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Revenue</span></div>
          <p className="text-2xl font-bold">${formatNumber(stats.totalRevenue)}</p>
        </CardContent></Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Sales Funnels</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New Funnel</Button>
      </div>

      {/* Funnels list */}
      {funnels.length === 0 ? (
        <ModuleEmptyState icon={Megaphone} title="No funnels yet" hint="Create your first sales funnel to automate customer journeys." />
      ) : (
        <div className="space-y-3">
          {funnels.map((f) => (
            <Card key={f.id} className="hover:shadow-md transition">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{f.name}</h3>
                      <Badge variant="secondary" className="text-xs">{f.type}</Badge>
                      <Badge variant="outline" className={cn('text-xs', f.status === 'LIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted')}>{f.status}</Badge>
                    </div>
                    {f.description && <p className="text-sm text-muted-foreground mt-1">{f.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{f.visits} visits</span>
                      <span>{f.conversions} conversions</span>
                      <span>${f.revenue} revenue</span>
                      <span>Created {timeAgo(f.createdAt)}</span>
                    </div>
                    {f.steps && f.steps.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {f.steps.sort((a, b) => a.position - b.position).map((s, i) => (
                          <div key={s.id} className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">{s.name}</Badge>
                            {i < f.steps!.length - 1 && <span className="text-muted-foreground">→</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Funnel</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Funnel name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Course Launch Funnel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description (optional)</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this funnel do?" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="SALES">Sales Funnel</option>
                <option value="LEAD">Lead Magnet</option>
                <option value="WEBINAR">Webinar</option>
                <option value="LAUNCH">Product Launch</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createFunnel} disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Create funnel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
