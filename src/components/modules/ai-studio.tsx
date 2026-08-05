'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, Zap, Copy, Check, RotateCcw, ChevronDown, Wand2, Loader2,
  GraduationCap, FileText, Mail, ShoppingCart, LayoutTemplate, PenLine, Share2,
  Youtube, Package, MessageSquare, Eye, Pencil, Download, Plus, Globe, DollarSign,
  ArrowLeft, FileCode, BookOpen, Award, Tag, Search, Rocket, LayoutDashboard,
  Image as ImageIcon, History, Settings2, Bot, Clock, TrendingUp, MessageCircle,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useApi, formatNumber, timeAgo } from '@/hooks/use-api'

// ============================================================================
// AI Studio — Enterprise AI workspace with tabs
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
  const { activeSubTab } = useAppStore()
  const [tab, setTab] = useState<StudioTab>('dashboard')
  const [credits, setCredits] = useState(4280)

  // Sync with sidebar sub-tab
  useEffect(() => {
    if (activeSubTab && ['dashboard', 'chat', 'documents', 'images', 'courses', 'website', 'marketing', 'history', 'settings'].includes(activeSubTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(activeSubTab as StudioTab)
    }
  }, [activeSubTab])

  // Fetch credits
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
                  <Zap className="h-2.5 w-2.5 mr-1" /> Smart AI
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Generate, edit, and publish AI-powered content across your workspace.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold tabular-nums">{credits.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">credits</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as StudioTab)}>
        <TabsList className="flex-wrap h-auto">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <TabsTrigger key={t.id} value={t.id} className="text-xs gap-1.5">
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab credits={credits} onNavigate={setTab} /></TabsContent>
        <TabsContent value="chat"><ChatTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="images"><ImagesTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="courses"><CoursesTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="website"><WebsiteTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="marketing"><MarketingTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────

function DashboardTab({ credits, onNavigate }: { credits: number; onNavigate: (tab: StudioTab) => void }) {
  const { data, loading } = useApi<{ generations: any[]; total: number }>('/api/ai/generations?pageSize=5')

  const stats = [
    { label: 'Credits Remaining', value: credits.toLocaleString(), icon: Zap, color: 'text-primary' },
    { label: 'Documents Generated', value: data?.total || 0, icon: FileText, color: 'text-sky-500' },
    { label: 'Active Tools', value: 10, icon: Wand2, color: 'text-emerald-500' },
    { label: 'Saved Prompts', value: 0, icon: BookOpen, color: 'text-amber-500' },
  ]

  const quickActions = [
    { label: 'AI Chat', icon: MessageCircle, tab: 'chat' as StudioTab, desc: 'Chat with AI assistant' },
    { label: 'Generate Document', icon: FileText, tab: 'documents' as StudioTab, desc: 'Blog, email, sales copy' },
    { label: 'AI Course', icon: GraduationCap, tab: 'courses' as StudioTab, desc: 'Generate course outline' },
    { label: 'AI Website', icon: Globe, tab: 'website' as StudioTab, desc: 'Landing pages' },
    { label: 'AI Marketing', icon: Mail, tab: 'marketing' as StudioTab, desc: 'Ads, social, SEO' },
    { label: 'AI Images', icon: ImageIcon, tab: 'images' as StudioTab, desc: 'Generate images' },
  ]

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}><CardContent className="p-4 flex items-center gap-3">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-muted', s.color)}><Icon className="h-4 w-4" /></div>
              <div><p className="text-lg font-bold tabular-nums leading-none">{s.value}</p><p className="text-[11px] text-muted-foreground mt-1">{s.label}</p></div>
            </CardContent></Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Actions</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((a, i) => {
            const Icon = a.icon
            return (
              <motion.button key={a.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => onNavigate(a.tab)} className="text-left">
                <Card className="h-full hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0"><Icon className="h-5 w-5" /></div>
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

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Recent Generations</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.generations || data.generations.length === 0 ? (
            <div className="p-8 text-center"><Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No generations yet</p><p className="text-xs text-muted-foreground mt-1">Start generating with AI to see your history here.</p></div>
          ) : (
            <div className="divide-y">
              {data.generations.map((g: any) => (
                <div key={g.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0"><FileText className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.title}</p>
                    <p className="text-xs text-muted-foreground">{g.toolSlug} · {timeAgo(g.createdAt)} · {g.creditsUsed} credits</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{g.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
    { value: 'CHAT', label: 'General Chat' },
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
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, messages: newMessages }),
      })
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
      const data = JSON.parse(raw)
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || data.reply || '' }])
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success(`AI responded`, { description: `-${data.creditsUsed || 2} credits` })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      {/* Chat header */}
      <div className="flex items-center gap-2 mb-3">
        <Select value={tool} onValueChange={setTool}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{TOOLS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="text-xs"><RotateCcw className="h-3 w-3 mr-1" /> New Chat</Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin space-y-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-3"><Sparkles className="h-8 w-8 text-primary" /></div>
            <p className="text-sm font-medium">AI Chat</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">Ask me anything about your business — course ideas, email copy, marketing strategy, and more.</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {['Give me 5 course ideas for creators', 'Write a welcome email for new students', 'Create a social media content plan'].map(ex => (
                <button key={ex} onClick={() => setInput(ex)} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition">{ex}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
              <Avatar className="h-8 w-8 shrink-0">
                {m.role === 'assistant'
                  ? <AvatarFallback className="bg-primary/15 text-primary text-xs"><Sparkles className="h-4 w-4" /></AvatarFallback>
                  : <AvatarFallback className="bg-muted text-xs">You</AvatarFallback>}
              </Avatar>
              <div className={cn('flex-1 min-w-0 max-w-[80%] group', m.role === 'user' && 'flex justify-end')}>
                <div className={cn('rounded-xl px-4 py-3 text-sm', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
                {m.role === 'assistant' && (
                  <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => copyMessage(m.content)} className="rounded p-1 text-xs text-muted-foreground hover:bg-muted transition" title="Copy"><Copy className="h-3 w-3" /></button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
        {loading && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-primary/15 text-primary"><Loader2 className="h-4 w-4 animate-spin" /></AvatarFallback></Avatar>
            <div className="rounded-xl bg-muted px-4 py-3"><div className="flex gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} /><span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} /><span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} /></div></div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          rows={2}
          className="flex-1 resize-none"
          disabled={loading}
        />
        <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="h-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

// ─── Documents Tab (existing tool-picker + generate flow) ───────────────────

interface Tool {
  id: string; slug: string; name: string; description: string; icon: string;
  category: string; creditCost: number; outputType: string; isPro: boolean
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  GraduationCap, FileText, Mail, ShoppingCart, LayoutTemplate, PenLine, Share2, Youtube, Package, MessageSquare, Sparkles,
}

function DocumentsTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [tools, setTools] = useState<Tool[]>([])
  const [toolsLoading, setToolsLoading] = useState(true)
  const [activeTool, setActiveTool] = useState<Tool | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    fetch('/api/ai/generate')
      .then(r => r.json())
      .then(d => { setTools(d.tools || []); setToolsLoading(false) })
      .catch(() => setToolsLoading(false))
  }, [])

  const generate = async () => {
    if (!input.trim() || !activeTool || loading) return
    setLoading(true)
    setResult(null)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 55000)
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolSlug: activeTool.slug, input: input.trim() }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
      const data = JSON.parse(raw)
      setResult(data)
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success(`Generated! -${data.creditsUsed} credits`)
    } catch (e) {
      toast.error(e instanceof Error ? (e.name === 'AbortError' ? 'Timed out. Try again.' : e.message) : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  // Result view
  if (result) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setResult(null); setInput('') }}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to tools
        </Button>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {activeTool?.name} Result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-4 max-h-[60vh] overflow-y-auto scroll-thin">
              <pre className="text-sm whitespace-pre-wrap font-sans">{result.raw || result.output || JSON.stringify(result.structured, null, 2)}</pre>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(result.raw || result.output || ''); toast.success('Copied') }}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setResult(null); generate() }}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Regenerate
              </Button>
              <Badge variant="secondary" className="text-xs ml-auto">{result.creditsUsed} credits used</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Tool input view
  if (activeTool) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => { setActiveTool(null); setInput('') }}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to tools
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {(() => { const Icon = ICON_MAP[activeTool.icon] || Sparkles; return <Icon className="h-4 w-4 text-primary" /> })()}
              {activeTool.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{activeTool.description}</p>
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe what you want to generate..." rows={5} disabled={loading} />
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">{activeTool.creditCost} credits</Badge>
              <Button onClick={generate} disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Tool picker
  const grouped = tools.reduce<Record<string, Tool[]>>((acc, t) => { (acc[t.category] ||= []).push(t); return acc }, {})

  return (
    <div className="space-y-4">
      {toolsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="p-12 text-center"><FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No AI tools available</p><p className="text-xs text-muted-foreground mt-1">Contact your admin to configure AI tools.</p></div>
      ) : (
        Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{cat}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t, i) => {
                const Icon = ICON_MAP[t.icon] || Sparkles
                return (
                  <motion.button key={t.slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    onClick={() => { setActiveTool(t); setResult(null) }} className="group text-left">
                    <Card className="h-full hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary group-hover:scale-110 transition-transform"><Icon className="h-5 w-5" /></div>
                          <div className="flex items-center gap-1.5">
                            {t.isPro && <Badge variant="secondary" className="text-[9px] bg-amber-500/10 text-amber-600">PRO</Badge>}
                            <Badge variant="secondary" className="text-[9px]">{t.creditCost}cr</Badge>
                          </div>
                        </div>
                        <p className="font-semibold text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                        <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition"><Wand2 className="h-3 w-3" /> Open generator</div>
                      </CardContent>
                    </Card>
                  </motion.button>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Images Tab ─────────────────────────────────────────────────────────────

function ImagesTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<Array<{ url: string; prompt: string }>>([])

  const generate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      const data = await res.json()
      setImages(prev => [{ url: data.url, prompt: prompt.trim() }, ...prev])
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success('Image generated!')
      setPrompt('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate image')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">AI Image Generator</p>
            <Badge variant="secondary" className="text-[10px] ml-auto">3 credits</Badge>
          </div>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the image you want to generate..." rows={3} disabled={loading} />
          <Button onClick={generate} disabled={loading || !prompt.trim()}>
            {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            Generate Image
          </Button>
        </CardContent>
      </Card>

      {images.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center">
                <img src={img.url} alt={img.prompt} className="h-full w-full object-cover" />
              </div>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground line-clamp-2">{img.prompt}</p>
                <div className="mt-2 flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(img.url); toast.success('URL copied') }}><Copy className="h-3 w-3 mr-1" /> Copy URL</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" asChild><a href={img.url} download><Download className="h-3 w-3 mr-1" /> Download</a></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {images.length === 0 && !loading && (
        <div className="p-12 text-center"><ImageIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No images generated yet</p><p className="text-xs text-muted-foreground mt-1">Describe an image above and click Generate.</p></div>
      )}
    </div>
  )
}

// ─── Courses Tab ────────────────────────────────────────────────────────────

function CoursesTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const generate = async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolSlug: 'COURSE_GENERATOR', input: input.trim() }),
      })
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
      const data = JSON.parse(raw)
      setResult(data)
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success(`Course generated! -${data.creditsUsed} credits`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> AI Course Generator</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Describe your course idea and AI will generate a complete outline with modules, lessons, and pricing.</p>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. A 30-day course teaching beginners how to start a YouTube channel" rows={3} disabled={loading} />
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">15 credits</Badge>
            <Button onClick={generate} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
              Generate Course
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Generated Course</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-4 max-h-[60vh] overflow-y-auto scroll-thin">
              <pre className="text-sm whitespace-pre-wrap font-sans">{result.raw || result.output || JSON.stringify(result.structured, null, 2)}</pre>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(result.raw || result.output || ''); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
              <Button size="sm" variant="outline" onClick={() => { setResult(null); generate() }}><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Regenerate</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Website Tab ────────────────────────────────────────────────────────────

function WebsiteTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const generate = async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/landing-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selling: input.trim(), category: 'Course' }),
      })
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
      const data = JSON.parse(raw)
      setResult(data)
      toast.success(`Landing page generated! -${data.creditsUsed} credits`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> AI Landing Page Generator</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Tell AI what you're selling and it will generate a complete landing page with hero, features, pricing, testimonials, FAQ, and CTA.</p>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. An AI course teaching creators how to use ChatGPT for content" rows={3} disabled={loading} />
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">7 credits</Badge>
            <Button onClick={generate} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
              Generate Landing Page
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Generated Landing Page</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-4 max-h-[60vh] overflow-y-auto scroll-thin">
              <pre className="text-sm whitespace-pre-wrap font-sans">{JSON.stringify(result, null, 2)}</pre>
            </div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(JSON.stringify(result, null, 2)); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy JSON</Button>
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
    const selectedTool = TOOLS.find(t => t.value === tool)
    if (!selectedTool) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolSlug: selectedTool.slug, input: input.trim() }),
      })
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
      const data = JSON.parse(raw)
      setResult(data)
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success(`Generated! -${data.creditsUsed} credits`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> AI Marketing Generator</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={tool} onValueChange={setTool}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{TOOLS.map(t => <SelectItem key={t.value} value={t.value}>{t.label} ({t.cost}cr)</SelectItem>)}</SelectContent>
          </Select>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe what you want to generate..." rows={3} disabled={loading} />
          <Button onClick={generate} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
            Generate
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-4 max-h-[60vh] overflow-y-auto scroll-thin">
              <pre className="text-sm whitespace-pre-wrap font-sans">{result.raw || result.output || ''}</pre>
            </div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(result.raw || result.output || ''); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── History Tab ────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data, loading, refetch } = useApi<{ generations: any[]; total: number }>('/api/ai/generations?pageSize=50')
  const [search, setSearch] = useState('')

  const generations = data?.generations || []
  const filtered = generations.filter((g: any) =>
    !search || g.title?.toLowerCase().includes(search.toLowerCase()) || g.toolSlug?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Generation History</h3>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search generations..." className="pl-9 h-8" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center"><History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No generations yet</p><p className="text-xs text-muted-foreground mt-1">Your AI generations will appear here.</p></div>
      ) : (
        <Card><CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((g: any) => (
              <div key={g.id} className="flex items-center gap-3 p-4 hover:bg-muted/50 transition cursor-pointer" onClick={() => toast.info(g.title, { description: g.toolSlug })}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0"><FileText className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{g.title}</p>
                  <p className="text-xs text-muted-foreground">{g.toolSlug} · {timeAgo(g.createdAt)}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{g.creditsUsed}cr</Badge>
                <Badge variant="outline" className="text-[10px]">{g.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}

// ─── Settings Tab ───────────────────────────────────────────────────────────

function SettingsTab() {
  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> AI Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Default Model</label>
            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option>GLM-4 (Default)</option>
              <option>GPT-4o</option>
              <option>Claude 3.5 Sonnet</option>
            </select>
            <p className="text-xs text-muted-foreground">The default AI model for all generations.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Brand Voice</label>
            <Textarea placeholder="Describe your brand voice (e.g., professional, friendly, authoritative)..." rows={2} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Default Language</label>
            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
              <option>German</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Credit Limit (daily)</label>
            <Input type="number" defaultValue={100} />
            <p className="text-xs text-muted-foreground">Maximum credits per day across all AI tools.</p>
          </div>
          <Button onClick={() => toast.success('AI settings saved')}>Save Settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Model Manager</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Manage AI providers and models. Configure in Super Admin → AI Providers.</p>
          <Button variant="outline" size="sm" onClick={() => useAppStore.getState().navigateTo('admin')}>Go to Model Manager</Button>
        </CardContent>
      </Card>
    </div>
  )
}
