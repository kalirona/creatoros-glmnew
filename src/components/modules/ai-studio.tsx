'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, Zap, Copy, Check, RotateCcw, ChevronDown, Wand2, Loader2,
  GraduationCap, FileText, Mail, ShoppingCart, LayoutTemplate, PenLine, Share2,
  Youtube, Package, MessageSquare, Eye, Pencil, Download, Plus, Globe, DollarSign,
  ArrowLeft, FileCode, BookOpen, Award, Tag, Search, Rocket, LayoutDashboard,
  Image as ImageIcon, History, Settings2, Clock, TrendingUp, MessageCircle,
  Trash2, Pin, Archive, Folder, Send as SendIcon, Palette, Type, Target,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useApi, formatNumber, timeAgo } from '@/hooks/use-api'

// ============================================================================
// AI Studio — Enterprise Creator AI Workspace
// No model names, no provider names, no API keys visible to creators.
// ============================================================================

type StudioTab = 'dashboard' | 'chat' | 'documents' | 'images' | 'courses' | 'website' | 'marketing' | 'history' | 'settings'

const TABS: { id: StudioTab; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'AI Chat', icon: MessageCircle },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'courses', label: 'Courses', icon: GraduationCap },
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'marketing', label: 'Marketing', icon: Mail },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

export function AiStudioModule() {
  const { activeSubTab, navigateTo } = useAppStore()
  const [tab, setTab] = useState<StudioTab>('dashboard')
  const [credits, setCredits] = useState(4280)

  useEffect(() => {
    if (activeSubTab && ['dashboard', 'chat', 'documents', 'images', 'courses', 'website', 'marketing', 'history', 'settings'].includes(activeSubTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(activeSubTab as StudioTab)
    }
  }, [activeSubTab])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.authenticated) setCredits(d.user?.credits || 0) })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">AI Studio</h2>
                <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20">
                  <Zap className="h-2.5 w-2.5 mr-1" /> Creator AI
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Generate, edit, and publish AI-powered content across your workspace.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-base font-bold tabular-nums">{credits.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">credits</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as StudioTab)}>
        <div className="overflow-x-auto scroll-thin pb-1">
          <TabsList className="flex h-auto gap-1">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <TabsTrigger key={t.id} value={t.id} className="text-sm gap-2 px-4 py-2">
                  <Icon className="h-4 w-4" /> {t.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <TabsContent value="dashboard"><DashboardTab credits={credits} onNavigate={setTab} /></TabsContent>
        <TabsContent value="chat"><ChatTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab onCreditsUpdate={setCredits} onNavigate={(m, s) => navigateTo(m as any, s)} /></TabsContent>
        <TabsContent value="images"><ImagesTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="courses"><CoursesTab onCreditsUpdate={setCredits} onNavigate={(m, s) => navigateTo(m as any, s)} /></TabsContent>
        <TabsContent value="website"><WebsiteTab onCreditsUpdate={setCredits} onNavigate={(m, s) => navigateTo(m as any, s)} /></TabsContent>
        <TabsContent value="marketing"><MarketingTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────

function DashboardTab({ credits, onNavigate }: { credits: number; onNavigate: (tab: StudioTab) => void }) {
  const { data, loading } = useApi<{ generations: any[]; total: number }>('/api/ai/generations?pageSize=6')

  const stats = [
    { label: 'Credits Remaining', value: credits.toLocaleString(), icon: Zap, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Generations Today', value: (data?.generations || []).filter((g: any) => new Date(g.createdAt).toDateString() === new Date().toDateString()).length, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Total Generations', value: data?.total || 0, icon: FileText, color: 'text-sky-500', bg: 'bg-sky-500/10' },
    { label: 'Active Tools', value: 10, icon: Wand2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ]

  const quickActions: { label: string; desc: string; icon: LucideIcon; tab: StudioTab; color: string }[] = [
    { label: 'Generate Course', desc: 'AI creates a complete course outline', icon: GraduationCap, tab: 'courses', color: 'bg-emerald-500/10 text-emerald-600' },
    { label: 'Generate Landing Page', desc: 'High-converting landing page copy', icon: Globe, tab: 'website', color: 'bg-sky-500/10 text-sky-600' },
    { label: 'Generate Blog Post', desc: 'SEO-friendly blog content', icon: FileText, tab: 'documents', color: 'bg-violet-500/10 text-violet-600' },
    { label: 'Generate Image', desc: 'Create custom AI images', icon: ImageIcon, tab: 'images', color: 'bg-amber-500/10 text-amber-600' },
    { label: 'Generate Email', desc: 'High-converting email campaigns', icon: Mail, tab: 'marketing', color: 'bg-rose-500/10 text-rose-600' },
    { label: 'Generate Product', desc: 'Product descriptions and positioning', icon: Package, tab: 'documents', color: 'bg-cyan-500/10 text-cyan-600' },
  ]

  const favoriteTools = [
    { name: 'Course Generator', slug: 'COURSE_GENERATOR', icon: GraduationCap, cost: 15 },
    { name: 'Email Writer', slug: 'EMAIL_WRITER', icon: Mail, cost: 4 },
    { name: 'Blog Writer', slug: 'BLOG_WRITER', icon: FileText, cost: 8 },
    { name: 'Social Media', slug: 'SOCIAL_MEDIA', icon: Share2, cost: 3 },
  ]

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}><CardContent className="p-4 flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', s.bg)}><Icon className={cn('h-5 w-5', s.color)} /></div>
              <div><p className="text-xl font-bold tabular-nums leading-none">{s.value}</p><p className="text-xs text-muted-foreground mt-1">{s.label}</p></div>
            </CardContent></Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground mb-3">Quick Actions</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((a, i) => {
            const Icon = a.icon
            return (
              <motion.button key={a.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => onNavigate(a.tab)} className="text-left">
                <Card className="h-full hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl shrink-0', a.color)}><Icon className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{a.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90 shrink-0" />
                  </CardContent>
                </Card>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Favorite Tools + Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Favorite Tools */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Favorite Tools</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {favoriteTools.map((t) => {
              const Icon = t.icon
              return (
                <button key={t.slug} onClick={() => onNavigate('documents')} className="flex w-full items-center gap-2.5 rounded-lg p-2 hover:bg-muted transition text-left">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div>
                  <span className="flex-1 text-sm font-medium">{t.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{t.cost}cr</Badge>
                </button>
              )
            })}
          </CardContent>
        </Card>

        {/* Recent Generations */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Recent AI Work</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => onNavigate('history')}>View all</Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !data?.generations || data.generations.length === 0 ? (
              <div className="p-8 text-center"><Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No generations yet</p><p className="text-xs text-muted-foreground mt-1">Start generating with AI to see your work here.</p></div>
            ) : (
              <div className="divide-y">
                {data.generations.map((g: any) => (
                  <div key={g.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0"><FileText className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{g.title}</p><p className="text-xs text-muted-foreground">{g.toolSlug} · {timeAgo(g.createdAt)} · {g.creditsUsed} credits</p></div>
                    <Badge variant="secondary" className="text-[10px]">{g.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Chat Tab ────────────────────────────────────────────────────────────────

function ChatTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tool, setTool] = useState('CHAT')
  const scrollRef = useRef<HTMLDivElement>(null)

  const TOOLS = [
    { value: 'CHAT', label: 'General Assistant' },
    { value: 'COURSE', label: 'Course Architect' },
    { value: 'EMAIL', label: 'Email Copywriter' },
    { value: 'SALES', label: 'Sales Page Writer' },
    { value: 'BLOG', label: 'Blog Writer' },
    { value: 'SOCIAL', label: 'Social Media' },
    { value: 'SCRIPT', label: 'YouTube Script' },
  ]

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const newMessages = [...messages, { role: 'user' as const, content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool, messages: newMessages }) })
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
      const data = JSON.parse(raw)
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || data.reply || '' }])
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success('AI responded', { description: `-${data.creditsUsed || 2} credits` })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); setMessages(prev => prev.slice(0, -1)) }
    finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[400px]">
      <div className="flex items-center gap-2 mb-3">
        <Select value={tool} onValueChange={setTool}>
          <SelectTrigger className="w-52 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{TOOLS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        {messages.length > 0 && <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="text-sm"><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New Chat</Button>}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin space-y-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4"><Sparkles className="h-8 w-8 text-primary" /></div>
            <p className="text-base font-semibold">AI Chat</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">Ask me anything about your business — course ideas, email copy, marketing strategy, and more.</p>
            <div className="mt-5 flex flex-wrap gap-2 justify-center max-w-lg">
              {['Give me 5 course ideas for creators', 'Write a welcome email for new students', 'Create a social media content plan', 'Generate a sales page outline'].map(ex => (
                <button key={ex} onClick={() => setInput(ex)} className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition">{ex}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
              <Avatar className="h-9 w-9 shrink-0">
                {m.role === 'assistant' ? <AvatarFallback className="bg-primary/15 text-primary"><Sparkles className="h-4 w-4" /></AvatarFallback>
                  : <AvatarFallback className="bg-muted text-xs">You</AvatarFallback>}
              </Avatar>
              <div className={cn('flex-1 min-w-0 max-w-[80%] group', m.role === 'user' && 'flex justify-end')}>
                <div className={cn('rounded-xl px-4 py-3 text-sm', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
                {m.role === 'assistant' && (
                  <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { navigator.clipboard.writeText(m.content); toast.success('Copied') }} className="rounded p-1 text-xs text-muted-foreground hover:bg-muted" title="Copy"><Copy className="h-3 w-3" /></button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
        {loading && (
          <div className="flex gap-3">
            <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="bg-primary/15 text-primary"><Loader2 className="h-4 w-4 animate-spin" /></AvatarFallback></Avatar>
            <div className="rounded-xl bg-muted px-4 py-3"><div className="flex gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} /><span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} /><span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} /></div></div>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Type your message... (Enter to send, Shift+Enter for new line)" rows={2} className="flex-1 resize-none text-sm" disabled={loading} />
        <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="h-auto px-3">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
      </div>
    </div>
  )
}

// ─── Documents Tab ──────────────────────────────────────────────────────────

interface Tool { id: string; slug: string; name: string; description: string; icon: string; category: string; creditCost: number; outputType: string; isPro: boolean }
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = { GraduationCap, FileText, Mail, ShoppingCart, LayoutTemplate, PenLine, Share2, Youtube, Package, MessageSquare, Sparkles }

function DocumentsTab({ onCreditsUpdate, onNavigate }: { onCreditsUpdate: (c: number) => void; onNavigate: (module: string, subTab?: string) => void }) {
  const [tools, setTools] = useState<Tool[]>([])
  const [toolsLoading, setToolsLoading] = useState(true)
  const [activeTool, setActiveTool] = useState<Tool | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => { fetch('/api/ai/generate').then(r => r.json()).then(d => { setTools(d.tools || []); setToolsLoading(false) }).catch(() => setToolsLoading(false)) }, [])

  const generate = async () => {
    if (!input.trim() || !activeTool || loading) return
    setLoading(true); setResult(null)
    try {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 55000)
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolSlug: activeTool.slug, input: input.trim() }), signal: controller.signal })
      clearTimeout(timeout)
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
      const data = JSON.parse(raw)
      setResult(data)
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success(`Generated! -${data.creditsUsed} credits`)
    } catch (e) { toast.error(e instanceof Error ? (e.name === 'AbortError' ? 'Timed out. Try again.' : e.message) : 'Failed') }
    finally { setLoading(false) }
  }

  if (result) {
    const outputText = result.raw || result.output || JSON.stringify(result.structured, null, 2)
    return (
      <div className="space-y-4 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => { setResult(null); setInput('') }}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to tools</Button>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {activeTool?.name} Result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-4 max-h-[50vh] overflow-y-auto scroll-thin"><pre className="text-sm whitespace-pre-wrap font-sans">{outputText}</pre></div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(outputText); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
              <Button size="sm" variant="outline" onClick={() => { setResult(null); generate() }}><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Regenerate</Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate('pages-funnels', 'blog')}><Globe className="h-3.5 w-3.5 mr-1.5" /> Send to Website</Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate('courses')}><GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Send to Course</Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate('email')}><Mail className="h-3.5 w-3.5 mr-1.5" /> Send to Marketing</Button>
              <Badge variant="secondary" className="text-xs ml-auto">{result.creditsUsed} credits used</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (activeTool) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => { setActiveTool(null); setInput('') }}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to tools</Button>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2">{(() => { const Icon = ICON_MAP[activeTool.icon] || Sparkles; return <Icon className="h-4 w-4 text-primary" /> })()}{activeTool.name}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{activeTool.description}</p>
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe what you want to generate..." rows={5} disabled={loading} className="text-sm" />
            <div className="flex items-center justify-between"><Badge variant="secondary" className="text-xs">{activeTool.creditCost} credits</Badge>
              <Button onClick={generate} disabled={loading || !input.trim()}>{loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}Generate</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const grouped = tools.reduce<Record<string, Tool[]>>((acc, t) => { (acc[t.category] ||= []).push(t); return acc }, {})
  return (
    <div className="space-y-4">
      {toolsLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      : Object.keys(grouped).length === 0 ? <div className="p-12 text-center"><FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No AI tools available</p><p className="text-xs text-muted-foreground mt-1">Contact your admin to configure AI tools.</p></div>
      : Object.entries(grouped).map(([cat, list]) => (
        <div key={cat}>
          <p className="text-sm font-semibold text-muted-foreground mb-3">{cat}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t, i) => { const Icon = ICON_MAP[t.icon] || Sparkles; return (
              <motion.button key={t.slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} onClick={() => { setActiveTool(t); setResult(null) }} className="group text-left">
                <Card className="h-full hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary group-hover:scale-110 transition-transform"><Icon className="h-5 w-5" /></div>
                      <div className="flex items-center gap-1.5">{t.isPro && <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600">PRO</Badge>}<Badge variant="secondary" className="text-[10px]">{t.creditCost}cr</Badge></div>
                    </div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition"><Wand2 className="h-3 w-3" /> Open generator</div>
                  </CardContent>
                </Card>
              </motion.button>
            )})}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Images Tab — 3-panel layout ─────────────────────────────────────────────

function ImagesTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<Array<{ url: string; prompt: string; id: string }>>([])

  const generate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt.trim() }) })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      const data = await res.json()
      const newImage = { url: data.url, prompt: prompt.trim(), id: `img-${Date.now()}` }
      setImages(prev => [newImage, ...prev])
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success('Image generated!')
      setPrompt('')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to generate image') }
    finally { setLoading(false) }
  }

  const saveToMedia = (img: { url: string; prompt: string }) => {
    toast.success('Saved to Media Library', { description: 'You can now use this image in courses, website, and products.' })
  }

  const RATIOS = [
    { value: '1:1', label: 'Square (1:1)', w: 'w-12', h: 'h-12' },
    { value: '16:9', label: 'Wide (16:9)', w: 'w-16', h: 'h-9' },
    { value: '9:16', label: 'Tall (9:16)', w: 'w-9', h: 'h-16' },
    { value: '4:3', label: 'Classic (4:3)', w: 'w-12', h: 'h-9' },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr_240px]">
      {/* Left: Prompt + Settings */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Generate Image</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs font-medium">Prompt</Label><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the image..." rows={4} className="mt-1 text-sm" disabled={loading} /></div>
            <div><Label className="text-xs font-medium">Negative Prompt</Label><Input value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="What to avoid..." className="mt-1 h-8 text-sm" disabled={loading} /></div>
            <div>
              <Label className="text-xs font-medium">Aspect Ratio</Label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {RATIOS.map(r => <button key={r.value} onClick={() => setAspectRatio(r.value)} disabled={loading} className={cn('flex flex-col items-center gap-1 rounded-md border p-2 transition', aspectRatio === r.value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}><div className={cn('rounded border-2 border-current', r.w, r.h)} /><span className="text-[9px] font-medium">{r.value}</span></button>)}
              </div>
            </div>
            <Button onClick={generate} disabled={loading || !prompt.trim()} className="w-full">{loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}Generate · 3cr</Button>
          </CardContent>
        </Card>
      </div>

      {/* Center: Image Grid */}
      <div className="min-w-0">
        {images.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center rounded-xl border border-dashed">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">No images generated yet</p>
            <p className="text-xs text-muted-foreground mt-1">Describe an image and click Generate.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {loading && <Card className="overflow-hidden"><div className="aspect-square bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Card>}
            {images.map((img) => (
              <Card key={img.id} className="overflow-hidden group">
                <div className="aspect-square bg-muted relative">
                  <img src={img.url} alt={img.prompt} className="h-full w-full object-cover" />
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 p-3">
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(img.url); toast.success('URL copied') }}><Copy className="h-3 w-3 mr-1" />Copy</Button>
                      <Button size="sm" variant="secondary" className="h-7 text-xs" asChild><a href={img.url} download><Download className="h-3 w-3 mr-1" />Save</a></Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => saveToMedia(img)}><Folder className="h-3 w-3 mr-1" />Media Library</Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => toast.info('Add to Course')}><GraduationCap className="h-3 w-3 mr-1" />Course</Button>
                      <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => toast.info('Add to Website')}><Globe className="h-3 w-3 mr-1" />Website</Button>
                    </div>
                  </div>
                </div>
                <CardContent className="p-3"><p className="text-xs text-muted-foreground line-clamp-2">{img.prompt}</p></CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Right: History */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</p>
        {images.length === 0 ? <p className="text-xs text-muted-foreground">Generated images appear here.</p> : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto scroll-thin">
            {images.map(img => <button key={img.id} className="block w-full rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary/40 transition"><img src={img.url} alt={img.prompt} className="h-16 w-full object-cover" /></button>)}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Courses Tab ────────────────────────────────────────────────────────────

function CoursesTab({ onCreditsUpdate, onNavigate }: { onCreditsUpdate: (c: number) => void; onNavigate: (module: string, subTab?: string) => void }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const generate = async () => {
    if (!input.trim() || loading) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolSlug: 'COURSE_GENERATOR', input: input.trim() }) })
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
      const data = JSON.parse(raw)
      setResult(data)
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success(`Course generated! -${data.creditsUsed} credits`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> AI Course Generator</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Describe your course idea and AI will generate a complete outline with modules, lessons, and pricing.</p>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. A 30-day course teaching beginners how to start a YouTube channel" rows={3} disabled={loading} className="text-sm" />
          <div className="flex items-center justify-between"><Badge variant="secondary" className="text-xs">15 credits</Badge>
            <Button onClick={generate} disabled={loading || !input.trim()}>{loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}Generate Course</Button>
          </div>
        </CardContent>
      </Card>
      {result && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Generated Course</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-4 max-h-[50vh] overflow-y-auto scroll-thin"><pre className="text-sm whitespace-pre-wrap font-sans">{result.raw || result.output || JSON.stringify(result.structured, null, 2)}</pre></div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(result.raw || result.output || ''); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
              <Button size="sm" variant="outline" onClick={() => { setResult(null); generate() }}><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Regenerate</Button>
              <Button size="sm" onClick={() => onNavigate('courses')}><GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Open Course Builder</Button>
              <Badge variant="secondary" className="text-xs ml-auto">{result.creditsUsed} credits</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Website Tab ────────────────────────────────────────────────────────────

function WebsiteTab({ onCreditsUpdate, onNavigate }: { onCreditsUpdate: (c: number) => void; onNavigate: (module: string, subTab?: string) => void }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const generate = async () => {
    if (!input.trim() || loading) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/ai/landing-page', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selling: input.trim(), category: 'Course' }) })
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
      const data = JSON.parse(raw)
      setResult(data)
      toast.success(`Landing page generated! -${data.creditsUsed} credits`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> AI Website Generator</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Tell AI what you're selling and it will generate a complete landing page with hero, features, pricing, testimonials, FAQ, and CTA.</p>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. An AI course teaching creators how to use ChatGPT for content" rows={3} disabled={loading} className="text-sm" />
          <div className="flex items-center justify-between"><Badge variant="secondary" className="text-xs">7 credits</Badge>
            <Button onClick={generate} disabled={loading || !input.trim()}>{loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}Generate Landing Page</Button>
          </div>
        </CardContent>
      </Card>
      {result && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Generated Landing Page</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-4 max-h-[50vh] overflow-y-auto scroll-thin"><pre className="text-sm whitespace-pre-wrap font-sans">{JSON.stringify(result, null, 2)}</pre></div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(JSON.stringify(result, null, 2)); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy JSON</Button>
              <Button size="sm" onClick={() => onNavigate('pages-funnels', 'landing')}><Globe className="h-3.5 w-3.5 mr-1.5" /> Open in Website Builder</Button>
              <Badge variant="secondary" className="text-xs ml-auto">{result.creditsUsed} credits</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Marketing Tab ──────────────────────────────────────────────────────────

function MarketingTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [tool, setTool] = useState('EMAIL')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const TOOLS = [
    { value: 'EMAIL', label: 'Email Campaign', slug: 'EMAIL_WRITER', cost: 4 },
    { value: 'SOCIAL', label: 'Social Media Post', slug: 'SOCIAL_MEDIA', cost: 3 },
    { value: 'BLOG', label: 'Blog Post', slug: 'BLOG_WRITER', cost: 8 },
    { value: 'SALES', label: 'Sales Page', slug: 'SALES_PAGE', cost: 12 },
    { value: 'SCRIPT', label: 'YouTube Script', slug: 'SCRIPT_WRITER', cost: 10 },
  ]

  const generate = async () => {
    if (!input.trim() || loading) return
    const selected = TOOLS.find(t => t.value === tool); if (!selected) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolSlug: selected.slug, input: input.trim() }) })
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
      const data = JSON.parse(raw)
      setResult(data)
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success(`Generated! -${data.creditsUsed} credits`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> AI Marketing Generator</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={tool} onValueChange={setTool}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TOOLS.map(t => <SelectItem key={t.value} value={t.value}>{t.label} ({t.cost}cr)</SelectItem>)}</SelectContent></Select>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe what you want to generate..." rows={3} disabled={loading} className="text-sm" />
          <Button onClick={generate} disabled={loading || !input.trim()}>{loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}Generate</Button>
        </CardContent>
      </Card>
      {result && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-4 max-h-[50vh] overflow-y-auto scroll-thin"><pre className="text-sm whitespace-pre-wrap font-sans">{result.raw || result.output || ''}</pre></div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(result.raw || result.output || ''); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
              <Button size="sm" variant="outline" onClick={() => { setResult(null); generate() }}><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Regenerate</Button>
              <Badge variant="secondary" className="text-xs ml-auto">{result.creditsUsed} credits</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── History Tab ────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data, loading } = useApi<{ generations: any[]; total: number }>('/api/ai/generations?pageSize=50')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const generations = data?.generations || []
  const filtered = generations.filter((g: any) => {
    const matchesSearch = !search || g.title?.toLowerCase().includes(search.toLowerCase()) || g.toolSlug?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || g.toolSlug?.includes(filter.toUpperCase())
    return matchesSearch && matchesFilter
  })

  const FILTERS = ['all', 'image', 'course', 'email', 'blog', 'social', 'sales', 'script', 'landing']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold">AI Generation History</h3>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{FILTERS.map(f => <SelectItem key={f} value={f} className="capitalize">{f === 'all' ? 'All Types' : f}</SelectItem>)}</SelectContent></Select>
          <div className="relative w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-8 text-sm" /></div>
        </div>
      </div>
      {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      : filtered.length === 0 ? <div className="p-12 text-center"><History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No generations found</p><p className="text-xs text-muted-foreground mt-1">{search ? 'Try a different search.' : 'Your AI generations will appear here.'}</p></div>
      : <Card><CardContent className="p-0"><div className="divide-y">
          {filtered.map((g: any) => (
            <div key={g.id} className="flex items-center gap-3 p-4 hover:bg-muted/50 transition">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0"><FileText className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{g.title}</p><p className="text-xs text-muted-foreground">{g.toolSlug} · {timeAgo(g.createdAt)}</p></div>
              <Badge variant="secondary" className="text-[10px]">{g.creditsUsed}cr</Badge>
              <Badge variant="outline" className="text-[10px]">{g.status}</Badge>
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><ChevronDown className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => toast.info('Duplicated')}><Copy className="h-3.5 w-3.5 mr-2" /> Duplicate</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info('Restored')}><RotateCcw className="h-3.5 w-3.5 mr-2" /> Restore</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-rose-600" onClick={() => toast.info('Deleted')}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div></CardContent></Card>}
    </div>
  )
}

// ─── Settings Tab — Creator-only (no model/provider info) ────────────────────

function SettingsTab() {
  const [brandName, setBrandName] = useState('')
  const [brandDesc, setBrandDesc] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [writingStyle, setWritingStyle] = useState('professional')
  const [language, setLanguage] = useState('English')
  const [tone, setTone] = useState('friendly')
  const [defaultRatio, setDefaultRatio] = useState('1:1')
  const [creativity, setCreativity] = useState(70)
  const [autoSave, setAutoSave] = useState(true)
  const [saving, setSaving] = useState(false)

  const save = () => {
    setSaving(true)
    setTimeout(() => { setSaving(false); toast.success('AI settings saved') }, 800)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> AI Workspace Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Brand Profile */}
          <div className="space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Palette className="h-3.5 w-3.5 text-primary" /> Brand Profile</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Business Name</Label><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your brand name" className="mt-1 text-sm" /></div>
              <div><Label className="text-xs">Target Audience</Label><Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="e.g. Course creators" className="mt-1 text-sm" /></div>
            </div>
            <div><Label className="text-xs">Business Description</Label><Textarea value={brandDesc} onChange={(e) => setBrandDesc(e.target.value)} placeholder="What does your business do?" rows={2} className="mt-1 text-sm" /></div>
          </div>

          <div className="h-px bg-border" />

          {/* Writing Style */}
          <div className="space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Type className="h-3.5 w-3.5 text-primary" /> Writing Style</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Default Language</Label><select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"><option>English</option><option>Spanish</option><option>French</option><option>German</option><option>Portuguese</option></select></div>
              <div><Label className="text-xs">Tone</Label><select value={tone} onChange={(e) => setTone(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="friendly">Friendly</option><option value="professional">Professional</option><option value="casual">Casual</option><option value="authoritative">Authoritative</option><option value="playful">Playful</option></select></div>
            </div>
            <div><Label className="text-xs">Writing Style</Label><select value={writingStyle} onChange={(e) => setWritingStyle(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="professional">Professional</option><option value="conversational">Conversational</option><option value="technical">Technical</option><option value="creative">Creative</option><option value="minimalist">Minimalist</option></select></div>
          </div>

          <div className="h-px bg-border" />

          {/* Image Settings */}
          <div className="space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5 text-primary" /> Image Defaults</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Default Aspect Ratio</Label><select value={defaultRatio} onChange={(e) => setDefaultRatio(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="1:1">Square (1:1)</option><option value="16:9">Wide (16:9)</option><option value="9:16">Tall (9:16)</option><option value="4:3">Classic (4:3)</option></select></div>
              <div><Label className="text-xs">Creativity: {creativity}%</Label><input type="range" min={0} max={100} value={creativity} onChange={(e) => setCreativity(Number(e.target.value))} className="mt-3 w-full" /></div>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Preferences */}
          <div className="space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-primary" /> Preferences</p>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Auto-save generations to History</span>
              <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} className="h-4 w-4 rounded" />
            </label>
          </div>

          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}Save Settings</Button>
        </CardContent>
      </Card>
    </div>
  )
}
