'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LifeBuoy, MessageCircle, BookOpen, Video, Send, Search, Clock, CheckCircle2,
  AlertCircle, Plus, ArrowLeft, Loader2, X, User, Mail, Tag, ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi } from '@/hooks/use-api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'

// ============================================================================
// Support Module — Full ticket system with create, view, reply, status update
// ============================================================================

interface Ticket {
  id: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  replyCount: number
  user: { name: string; email: string; avatarUrl?: string | null } | null
}

interface TicketDetail {
  id: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  userId: string
  user: { name: string; email: string; avatarUrl?: string | null } | null
  replies: Array<{
    id: string
    content: string
    isStaff: boolean
    createdAt: string
    user: { name: string; avatarUrl?: string | null } | null
  }>
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-rose-500/10 text-rose-600' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-600' },
  resolved: { label: 'Resolved', cls: 'bg-emerald-500/10 text-emerald-600' },
  closed: { label: 'Closed', cls: 'bg-muted text-muted-foreground' },
}

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  low: { label: 'Low', cls: 'bg-muted text-muted-foreground' },
  medium: { label: 'Medium', cls: 'bg-sky-500/10 text-sky-600' },
  high: { label: 'High', cls: 'bg-amber-500/10 text-amber-600' },
  urgent: { label: 'Urgent', cls: 'bg-rose-500/10 text-rose-600' },
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  billing: 'Billing',
  technical: 'Technical',
  course: 'Course',
  product: 'Product',
  community: 'Community',
}

const HELP_CATS = [
  { icon: BookOpen, label: 'Getting Started', count: 24, color: 'text-emerald-600 bg-emerald-500/10' },
  { icon: Video, label: 'Courses & Lessons', count: 18, color: 'text-violet-600 bg-violet-500/10' },
  { icon: MessageCircle, label: 'Community', count: 12, color: 'text-sky-600 bg-sky-500/10' },
  { icon: LifeBuoy, label: 'Billing & Plans', count: 15, color: 'text-amber-600 bg-amber-500/10' },
]

export function SupportModule() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  if (selectedTicketId) {
    return <TicketDetailPanel ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage support tickets, help center, and live chat.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Ticket
        </Button>
      </div>

      <TicketsList onSelectTicket={setSelectedTicketId} />

      {/* Help center + Live Chat (Coming Soon) */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Help Center</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {HELP_CATS.map((c) => {
              const Icon = c.icon
              return (
                <button key={c.label} onClick={() => toast.info(`Browsing: ${c.label}`, { description: `${c.count} articles available` })} className="flex w-full items-center gap-2.5 rounded-lg p-2.5 hover:bg-muted/50 transition text-left">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', c.color)}><Icon className="h-4 w-4" /></div>
                  <span className="flex-1 text-xs font-medium">{c.label}</span>
                  <span className="text-[10px] text-muted-foreground">{c.count} articles</span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        {/* Live Chat — Coming Soon */}
        <Card className="bg-gradient-to-br from-primary/10 to-card border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><MessageCircle className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-semibold">Live Chat</p>
                <p className="text-[10px] text-muted-foreground">Coming Soon</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Real-time live chat support is being built and will be available soon.</p>
            <Button size="sm" variant="outline" className="mt-3 w-full" disabled>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Create ticket dialog */}
      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

// ─── Tickets List ────────────────────────────────────────────────────────────

function TicketsList({ onSelectTicket }: { onSelectTicket: (id: string) => void }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const { data, loading, refetch } = useApi<{
    tickets: Ticket[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>(`/api/support/tickets?status=${statusFilter}&page=1&pageSize=50`)

  const tickets = data?.tickets || []
  const filtered = tickets.filter(t =>
    !search || t.subject.toLowerCase().includes(search.toLowerCase()) || (t.user?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    total: data?.total || 0,
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Open', value: stats.open, icon: AlertCircle, color: 'text-rose-500' },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-amber-500' },
          { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Total', value: stats.total, icon: MessageCircle, color: 'text-primary' },
        ].map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}><CardContent className="p-4 flex items-center gap-3">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-muted', s.color)}><Icon className="h-4 w-4" /></div>
              <div><p className="text-lg font-bold tabular-nums leading-none">{s.value}</p><p className="text-[11px] text-muted-foreground mt-1">{s.label}</p></div>
            </CardContent></Card>
          )
        })}
      </div>

      {/* Filters + Search */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium capitalize transition', statusFilter === s ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
              {s === 'in_progress' ? 'In Progress' : s}
            </button>
          ))}
        </div>
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." className="pl-9" />
        </div>
      </div>

      {/* Tickets */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium">No tickets found</p>
              <p className="text-xs text-muted-foreground mt-1">{statusFilter !== 'all' ? `No ${statusFilter} tickets.` : 'Create a new ticket to get started.'}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((t, i) => (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => onSelectTicket(t.id)}
                  className="group flex w-full items-center gap-3 p-4 hover:bg-muted/50 transition text-left"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    {t.user?.avatarUrl ? <img src={t.user.avatarUrl} alt={t.user.name} className="h-full w-full rounded-full object-cover" /> : null}
                    <AvatarFallback className="bg-muted text-[10px]">{(t.user?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      {t.replyCount > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{t.replyCount} {t.replyCount === 1 ? 'reply' : 'replies'}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{t.user?.name || 'Unknown'} · {t.user?.email || ''} · {new Date(t.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <Badge variant="secondary" className={cn('text-[10px] shrink-0', PRIORITY_META[t.priority]?.cls || '')}>{PRIORITY_META[t.priority]?.label || t.priority}</Badge>
                  <Badge variant="secondary" className={cn('text-[10px] shrink-0', STATUS_META[t.status]?.cls || '')}>{STATUS_META[t.status]?.label || t.status}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition" />
                </motion.button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Ticket Detail Panel ─────────────────────────────────────────────────────

function TicketDetailPanel({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { data, loading, refetch } = useApi<{ ticket: TicketDetail }>(`/api/support/tickets/${ticketId}`)
  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const ticket = data?.ticket

  const postReply = async () => {
    if (!reply.trim()) return
    setReplying(true)
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply.trim() }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      toast.success('Reply sent')
      setReply('')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to post reply')
    } finally {
      setReplying(false)
    }
  }

  const updateStatus = async (status: string) => {
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`Status updated to ${STATUS_META[status]?.label || status}`)
      refetch()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading || !ticket) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Button>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1.5" /> All Tickets</Button>
        {/* Status dropdown */}
        <Select value={ticket.status} onValueChange={updateStatus} disabled={updatingStatus}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <SelectItem key={value} value={value}>{meta.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ticket header */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              {ticket.user?.avatarUrl ? <img src={ticket.user.avatarUrl} alt={ticket.user.name} className="h-full w-full rounded-full object-cover" /> : null}
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">{(ticket.user?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold">{ticket.subject}</h2>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-xs text-muted-foreground">{ticket.user?.name}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{ticket.user?.email}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{new Date(ticket.createdAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className={cn('text-[10px]', PRIORITY_META[ticket.priority]?.cls || '')}>{PRIORITY_META[ticket.priority]?.label || ticket.priority}</Badge>
              <Badge variant="secondary" className={cn('text-[10px]', STATUS_META[ticket.status]?.cls || '')}>{STATUS_META[ticket.status]?.label || ticket.status}</Badge>
              <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[ticket.category] || ticket.category}</Badge>
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</div>
        </CardContent>
      </Card>

      {/* Replies */}
      {ticket.replies.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">{ticket.replies.length} {ticket.replies.length === 1 ? 'Reply' : 'Replies'}</p>
          {ticket.replies.map((r) => (
            <Card key={r.id} className={cn(r.isStaff && 'border-primary/30 bg-primary/5')}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    {r.user?.avatarUrl ? <img src={r.user.avatarUrl} alt={r.user.name} className="h-full w-full rounded-full object-cover" /> : null}
                    <AvatarFallback className="bg-muted text-[10px]">{(r.user?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.user?.name || 'Unknown'}</span>
                      {r.isStaff && <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary">Staff</Badge>}
                      <span className="text-xs text-muted-foreground">· {new Date(r.createdAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.content}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reply box */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Post a reply</Label>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your reply..."
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setReply('')} disabled={!reply.trim() || replying}>Clear</Button>
            <Button size="sm" onClick={postReply} disabled={!reply.trim() || replying}>
              {replying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Send Reply
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Create Ticket Dialog ────────────────────────────────────────────────────

function CreateTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState('medium')
  const [creating, setCreating] = useState(false)

  const create = async () => {
    if (!subject.trim() || !description.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), description: description.trim(), category, priority }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      toast.success('Ticket created', { description: 'We will respond within 24 hours.' })
      setSubject(''); setDescription(''); setCategory('general'); setPriority('medium')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create ticket')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Support Ticket</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Subject *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your issue" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Priority</Label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Description *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your issue in detail..." rows={5} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create} disabled={creating || !subject.trim() || !description.trim()}>
            {creating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
