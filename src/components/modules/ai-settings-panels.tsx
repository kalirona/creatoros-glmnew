'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, ToggleRight, BarChart3, Plus, Search, Save, Trash2, Edit,
  MessageCircle, Image as ImageIcon, Video, Mic, GraduationCap, Globe,
  Mail, PenLine, Search as SearchIcon, Zap, FileText, Eye, ScanLine,
  Brain, FlaskConical, Server, Activity, TrendingUp, Clock, DollarSign,
  AlertCircle, Check, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi, formatNumber } from '@/hooks/use-api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ============================================================================
// Prompt Library — global prompts, system prompts, safety prompts, etc.
// ============================================================================

interface Prompt {
  id: string
  name: string
  category: string
  content: string
  variables: string[]
  isActive: boolean
  version: number
  updatedAt: string
}

const PROMPT_CATEGORIES = [
  'System', 'Safety', 'Brand', 'Marketing', 'Course', 'Website', 'Image', 'Video', 'Email',
]

// Seed prompts (in production these would be in the database)
const SEED_PROMPTS: Prompt[] = [
  { id: 'p1', name: 'Default System Prompt', category: 'System', content: 'You are CreatorOS AI, a helpful assistant for creators. Always be concise, professional, and actionable.', variables: ['{{user_input}}'], isActive: true, version: 3, updatedAt: '2026-08-01' },
  { id: 'p2', name: 'Safety Guardrails', category: 'Safety', content: 'Never generate content that is illegal, harmful, or violates platform policies. Refuse requests for personal data, credentials, or malicious code.', variables: [], isActive: true, version: 2, updatedAt: '2026-07-28' },
  { id: 'p3', name: 'Brand Voice — Professional', category: 'Brand', content: 'Write in a professional, confident tone. Use clear language. Address the reader directly. Avoid jargon.', variables: ['{{brand_name}}', '{{audience}}'], isActive: true, version: 5, updatedAt: '2026-08-03' },
  { id: 'p4', name: 'Marketing Email Prompt', category: 'Marketing', content: 'Generate a high-converting email with: subject lines (3 options), preview text, greeting, body (short paragraphs), CTA, and P.S. Target audience: {{audience}}. Goal: {{goal}}.', variables: ['{{audience}}', '{{goal}}'], isActive: true, version: 8, updatedAt: '2026-08-05' },
  { id: 'p5', name: 'Course Generator Prompt', category: 'Course', content: 'Create a complete online course as JSON with: title, subtitle, description, level, modules (4-5 with 3-4 lessons each), quiz, pricing. Topic: {{topic}}. Audience: {{audience}}.', variables: ['{{topic}}', '{{audience}}'], isActive: true, version: 12, updatedAt: '2026-08-04' },
  { id: 'p6', name: 'Landing Page Hero', category: 'Website', content: 'Generate a high-converting landing page hero section: headline, subheadline, CTA text, and 3 benefit bullets. Product: {{product}}. Audience: {{audience}}.', variables: ['{{product}}', '{{audience}}'], isActive: true, version: 4, updatedAt: '2026-07-30' },
  { id: 'p7', name: 'Image Style — Cinematic', category: 'Image', content: 'Cinematic style with dramatic lighting, film grain, shallow depth of field, and rich color grading.', variables: ['{{subject}}'], isActive: true, version: 2, updatedAt: '2026-07-25' },
  { id: 'p8', name: 'Video Script — Social Reel', category: 'Video', content: 'Create a 30-second vertical video script for social media. Hook in first 3 seconds. Include visual cues and text overlays. Topic: {{topic}}.', variables: ['{{topic}}'], isActive: false, version: 1, updatedAt: '2026-07-20' },
]

export function PromptLibraryPanel() {
  const [prompts] = useState<Prompt[]>(SEED_PROMPTS)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [editing, setEditing] = useState<Prompt | null>(null)

  const filtered = prompts.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'all' || p.category === category
    return matchSearch && matchCat
  })

  const grouped = filtered.reduce<Record<string, Prompt[]>>((acc, p) => {
    (acc[p.category] ||= []).push(p)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {PROMPT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => toast.info('Create Prompt dialog — coming soon')}><Plus className="h-4 w-4 mr-1.5" />New Prompt</Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Total Prompts', v: prompts.length, i: BookOpen },
          { l: 'Active', v: prompts.filter((p) => p.isActive).length, i: Check },
          { l: 'Categories', v: PROMPT_CATEGORIES.length, i: ToggleRight },
          { l: 'Variables', v: new Set(prompts.flatMap((p) => p.variables)).size, i: Zap },
        ].map((s) => { const Icon = s.i; return (
          <Card key={s.l}><CardContent className="p-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Icon className="h-4 w-4" /></div>
            <div><p className="text-lg font-bold tabular-nums leading-none">{s.v}</p><p className="text-[10px] text-muted-foreground mt-0.5">{s.l}</p></div>
          </CardContent></Card>
        )})}
      </div>

      {/* Prompt list */}
      {editing ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Edit: {editing.name}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" onClick={() => { toast.success('Prompt saved'); setEditing(null) }}><Save className="h-4 w-4 mr-1.5" />Save</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input className="mt-1" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Category</Label>
              <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROMPT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Content</Label><Textarea className="mt-1 font-mono text-xs" rows={8} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={editing.isActive} onCheckedChange={(v) => setEditing({ ...editing, isActive: v })} /><Label className="text-sm">Active</Label></div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</p>
            <div className="space-y-2">
              {items.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <Card><CardContent className="p-3 flex items-start gap-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', p.isActive ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground')}>
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <Badge variant="secondary" className="text-[10px]">v{p.version}</Badge>
                        {p.variables.length > 0 && <Badge variant="secondary" className="text-[10px] bg-sky-500/10 text-sky-600">{p.variables.length} vars</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{p.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Updated {p.updatedAt}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={p.isActive} onCheckedChange={() => toast.success(`${p.name} ${p.isActive ? 'disabled' : 'enabled'}`)} />
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Edit className="h-3.5 w-3.5" /></Button>
                    </div>
                  </CardContent></Card>
                </motion.div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ============================================================================
// AI Features — enable/disable individual AI capabilities
// ============================================================================

interface AiFeature {
  id: string
  name: string
  description: string
  icon: typeof MessageCircle
  category: 'Core' | 'Content' | 'Media' | 'Experimental'
  enabled: boolean
  isPro: boolean
  usageCount: number
}

const FEATURES: AiFeature[] = [
  { id: 'chat', name: 'AI Chat', description: 'Conversational AI assistant', icon: MessageCircle, category: 'Core', enabled: true, isPro: false, usageCount: 1247 },
  { id: 'images', name: 'Image Generator', description: 'Generate AI images with styles', icon: ImageIcon, category: 'Media', enabled: true, isPro: false, usageCount: 892 },
  { id: 'video', name: 'Video Generator', description: 'AI-powered video creation', icon: Video, category: 'Media', enabled: true, isPro: true, usageCount: 156 },
  { id: 'voice', name: 'Voice AI', description: 'Text-to-speech & voice cloning', icon: Mic, category: 'Media', enabled: false, isPro: true, usageCount: 0 },
  { id: 'course', name: 'Course Generator', description: 'AI builds complete courses', icon: GraduationCap, category: 'Content', enabled: true, isPro: false, usageCount: 423 },
  { id: 'landing', name: 'Landing Page Generator', description: 'High-converting page copy', icon: Globe, category: 'Content', enabled: true, isPro: false, usageCount: 287 },
  { id: 'email', name: 'Email Generator', description: 'Email campaign sequences', icon: Mail, category: 'Content', enabled: true, isPro: false, usageCount: 534 },
  { id: 'blog', name: 'Blog Generator', description: 'SEO-friendly blog content', icon: PenLine, category: 'Content', enabled: true, isPro: false, usageCount: 412 },
  { id: 'seo', name: 'SEO Optimizer', description: 'Optimize content for search', icon: SearchIcon, category: 'Content', enabled: true, isPro: false, usageCount: 198 },
  { id: 'automation', name: 'Automation AI', description: 'AI-powered workflow automation', icon: Zap, category: 'Core', enabled: true, isPro: true, usageCount: 67 },
  { id: 'document', name: 'Document AI', description: 'Generate & analyze documents', icon: FileText, category: 'Content', enabled: true, isPro: false, usageCount: 345 },
  { id: 'vision', name: 'Vision AI', description: 'Image understanding & analysis', icon: Eye, category: 'Experimental', enabled: false, isPro: true, usageCount: 0 },
  { id: 'ocr', name: 'OCR', description: 'Extract text from images', icon: ScanLine, category: 'Experimental', enabled: false, isPro: true, usageCount: 0 },
  { id: 'embeddings', name: 'Embeddings', description: 'Vector embeddings for search', icon: Brain, category: 'Experimental', enabled: true, isPro: true, usageCount: 89 },
  { id: 'reasoning', name: 'Reasoning Mode', description: 'Extended thinking for complex tasks', icon: FlaskConical, category: 'Experimental', enabled: false, isPro: true, usageCount: 0 },
]

export function AiFeaturesPanel() {
  const [features, setFeatures] = useState<AiFeature[]>(FEATURES)

  const toggle = (id: string) => {
    setFeatures((prev) => prev.map((f) => f.id === id ? { ...f, enabled: !f.enabled } : f))
    const f = features.find((x) => x.id === id)
    if (f) toast.success(`${f.name} ${f.enabled ? 'disabled' : 'enabled'}`)
  }

  const grouped = features.reduce<Record<string, AiFeature[]>>((acc, f) => {
    (acc[f.category] ||= []).push(f)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Total Features', v: features.length, i: ToggleRight },
          { l: 'Enabled', v: features.filter((f) => f.enabled).length, i: Check },
          { l: 'PRO Only', v: features.filter((f) => f.isPro).length, i: Zap },
          { l: 'Total Usage', v: formatNumber(features.reduce((s, f) => s + f.usageCount, 0)), i: Activity },
        ].map((s) => { const Icon = s.i; return (
          <Card key={s.l}><CardContent className="p-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Icon className="h-4 w-4" /></div>
            <div><p className="text-lg font-bold tabular-nums leading-none">{s.v}</p><p className="text-[10px] text-muted-foreground mt-0.5">{s.l}</p></div>
          </CardContent></Card>
        )})}
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((f, i) => { const Icon = f.icon; return (
              <motion.div key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <Card className={cn(!f.enabled && 'opacity-60')}><CardContent className="p-4 flex items-start gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shrink-0', f.enabled ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{f.name}</p>
                      {f.isPro && <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600">PRO</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatNumber(f.usageCount)} uses</p>
                  </div>
                  <Switch checked={f.enabled} onCheckedChange={() => toggle(f.id)} />
                </CardContent></Card>
              </motion.div>
            )})}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Usage Analytics — provider comparison, model comparison, trends
// ============================================================================

export function UsageAnalyticsPanel() {
  const { data, loading } = useApi<{
    today: { requests: number; costUsd: number; successRate: number; avgLatencyMs: number }
    thisMonth: { requests: number; costUsd: number }
    perProviderHealth: { id: string; name: string; slug: string; isHealthy: boolean; todayCost: number; todayRequests: number; todayFailures: number }[]
  }>('/api/admin/monitoring')

  if (loading || !data) return <Skeleton className="h-96 rounded-xl" />

  const topProviders = [...data.perProviderHealth]
    .sort((a, b) => b.todayRequests - a.todayRequests)
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Requests Today', v: formatNumber(data.today.requests), i: Activity, c: 'text-sky-500' },
          { l: 'Cost Today', v: `$${data.today.costUsd.toFixed(4)}`, i: DollarSign, c: 'text-amber-500' },
          { l: 'Success Rate', v: `${data.today.successRate.toFixed(1)}%`, i: Check, c: 'text-emerald-500' },
          { l: 'Avg Latency', v: `${data.today.avgLatencyMs.toFixed(0)}ms`, i: Clock, c: 'text-violet-500' },
        ].map((s) => { const Icon = s.i; return (
          <Card key={s.l}><CardContent className="p-4 flex items-center gap-3">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-muted', s.c)}><Icon className="h-4 w-4" /></div>
            <div><p className="text-lg font-bold tabular-nums leading-none">{s.v}</p><p className="text-[11px] text-muted-foreground mt-1">{s.l}</p></div>
          </CardContent></Card>
        )})}
      </div>

      {/* Monthly summary */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-amber-500" />Monthly Summary</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div><p className="text-xs text-muted-foreground">Total Requests</p><p className="text-2xl font-bold tabular-nums mt-1">{formatNumber(data.thisMonth.requests)}</p></div>
          <div><p className="text-xs text-muted-foreground">Total Cost</p><p className="text-2xl font-bold tabular-nums mt-1">${data.thisMonth.costUsd.toFixed(2)}</p></div>
          <div><p className="text-xs text-muted-foreground">Avg Cost / Request</p><p className="text-2xl font-bold tabular-nums mt-1">${data.thisMonth.requests > 0 ? (data.thisMonth.costUsd / data.thisMonth.requests).toFixed(4) : '0.00'}</p></div>
        </CardContent>
      </Card>

      {/* Provider comparison */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4 text-amber-500" />Provider Comparison</CardTitle></CardHeader>
        <CardContent className="p-0">
          {topProviders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No usage data yet.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto scroll-thin">
              {topProviders.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-bold text-xs">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{p.name}</p>
                      <span className={cn('h-1.5 w-1.5 rounded-full', p.isHealthy ? 'bg-emerald-500' : 'bg-red-500')} />
                    </div>
                    <p className="text-xs text-muted-foreground">{p.todayRequests} requests · {p.todayFailures} failures</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums">${p.todayCost.toFixed(4)}</p>
                    <p className="text-[10px] text-muted-foreground">today</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost trend (placeholder) */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-amber-500" />Cost Trend (30 days)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 30 }).map((_, i) => {
              const height = Math.max(2, Math.sin(i / 3) * 40 + Math.random() * 30 + 10)
              return (
                <div key={i} className="flex-1 bg-amber-500/20 rounded-t hover:bg-amber-500/40 transition-colors" style={{ height: `${height}%` }} title={`Day ${i + 1}`} />
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Last 30 days · hover bars for details</p>
        </CardContent>
      </Card>
    </div>
  )
}
