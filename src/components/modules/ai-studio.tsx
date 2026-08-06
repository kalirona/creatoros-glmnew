'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, Zap, Copy, Check, RotateCcw, ChevronDown, Wand2, Loader2,
  GraduationCap, FileText, Mail, ShoppingCart, LayoutTemplate, PenLine, Share2,
  Youtube, Package, MessageSquare, Eye, Pencil, Download, Plus, Globe,
  ArrowLeft, BookOpen, Award, Tag, Search, Rocket, LayoutDashboard,
  Image as ImageIcon, History, Settings2, Clock, TrendingUp, MessageCircle,
  Trash2, Palette, Type, Target, Film, Video, Music, FileCode, Layers,
  Star, FolderOpen, Folder, Scissors, Maximize2, Eraser, Wand, Send as SendIcon,
  Play, Pause, X, CheckCircle2, AlertCircle, AlertTriangle, Filter, Calendar,
  ChevronLeft, ChevronRight, RefreshCw, MoreVertical, ExternalLink, Clapperboard,
  Megaphone, Brush, Camera, Box, Droplet, PictureInPicture, Smartphone,
  Monitor, Tv, type LucideIcon,
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
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useApi, formatNumber, timeAgo } from '@/hooks/use-api'

// ============================================================================
// AI Studio — Enterprise Creator AI Workspace
// 11 tabs · no model names, no provider names, no API keys visible to creators.
// ============================================================================

type StudioTab =
  | 'dashboard' | 'chat' | 'documents' | 'images' | 'videos'
  | 'courses' | 'marketing' | 'media-library' | 'history' | 'settings'

const TABS: { id: StudioTab; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard',     label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'chat',          label: 'AI Chat',      icon: MessageCircle },
  { id: 'documents',     label: 'Documents',    icon: FileText },
  { id: 'images',        label: 'Images',       icon: ImageIcon },
  { id: 'videos',        label: 'Videos',       icon: Film },
  { id: 'courses',       label: 'Courses',      icon: GraduationCap },
  { id: 'marketing',     label: 'Marketing',    icon: Mail },
  { id: 'media-library', label: 'Media Library', icon: FolderOpen },
  { id: 'history',       label: 'History',      icon: History },
  { id: 'settings',      label: 'Settings',     icon: Settings2 },
]

const ALL_TABS: StudioTab[] = TABS.map(t => t.id)

// ─── Asset shape (matches /api/ai/assets serializeCreatorAsset) ─────────────
interface CreatorAsset {
  id: string
  type: string
  folder: string
  name: string
  description: string
  url: string
  thumbnailUrl: string
  width: number
  height: number
  duration: number
  prompt: string
  style: string
  aspectRatio: string
  tags: string[]
  isFavorite: boolean
  isUsed: boolean
  usedIn: Array<{ module: string; entityId?: string | null; entityName?: string | null; usedAt: string }>
  createdAt: string
}

interface DashboardData {
  todayGenerations: number
  totalGenerations: number
  creditsRemaining: number
  creditsUsed: number
  recentGenerations: Array<{
    id: string
    toolSlug: string
    title: string
    status: string
    creditsUsed: number
    createdAt: string
    assetUrl: string | null
    outputType: string
  }>
  assetCounts: { images: number; videos: number; logos: number; icons: number; audio: number; documents: number; templates: number }
  quickActions: Array<{ slug: string; name: string; icon: string; creditCost: number; category: string }>
  favoriteAssets: CreatorAsset[]
}

interface BrandProfile {
  brandVoice: string
  tone: string
  language: string
  primaryColor: string
  secondaryColor: string
  logoUrl: string
  defaultAspectRatio: string
  guidelines: string
  targetAudience: string
}

// ─── Static option lists (mirror IMAGE_STYLES / ASPECT_RATIOS / VIDEO_PRESETS) ─
const IMAGE_STYLES_UI: { value: string; icon: LucideIcon }[] = [
  { value: 'Realistic', icon: Camera },
  { value: 'Cartoon',   icon: Brush },
  { value: 'Anime',     icon: PenLine },
  { value: '3D',        icon: Box },
  { value: 'Illustration', icon: PictureInPicture },
  { value: 'Watercolor', icon: Droplet },
  { value: 'Cinematic', icon: Film },
  { value: 'Product',   icon: Package },
  { value: 'Logo',      icon: Award },
  { value: 'Flat',      icon: Layers },
]

const ASPECT_RATIOS_UI: { value: string; label: string; w: string; h: string }[] = [
  { value: '1:1',  label: 'Square',    w: 'w-8', h: 'h-8' },
  { value: '2:3',  label: 'Portrait',  w: 'w-7', h: 'h-10' },
  { value: '3:2',  label: 'Landscape', w: 'w-10', h: 'h-7' },
  { value: '9:16', label: 'Story',     w: 'w-6', h: 'h-10' },
  { value: '16:9', label: 'Banner',    w: 'w-10', h: 'h-6' },
  { value: '4:1',  label: 'Thumbnail', w: 'w-10', h: 'h-3' },
]

const VIDEO_PRESETS_UI: { value: string; icon: LucideIcon; desc: string }[] = [
  { value: 'Product Demo', icon: Package, desc: 'Showcase a product in action' },
  { value: 'Social Reel',  icon: Smartphone, desc: 'Vertical clip for social' },
  { value: 'YouTube Short', icon: Youtube, desc: 'Under 60s, engaging hook' },
  { value: 'Explainer',    icon: BookOpen, desc: 'Walk through a concept' },
  { value: 'Promo',        icon: Megaphone, desc: 'Announce a launch or deal' },
  { value: 'AI Avatar',    icon: MessageSquare, desc: 'Talking-head presenter' },
  { value: 'Presentation', icon: Monitor, desc: 'Slide-style with voiceover' },
  { value: 'Animation',    icon: Clapperboard, desc: 'Animated motion graphic' },
]

const VIDEO_DURATIONS = [4, 8, 15, 30]
const VIDEO_RESOLUTIONS: { value: string; icon: LucideIcon }[] = [
  { value: '720p', icon: Tv },
  { value: '1080p', icon: Monitor },
  { value: '4K', icon: Tv },
]

const FOLDERS = [
  { name: 'AI Images',    icon: ImageIcon,    type: 'IMAGE' },
  { name: 'AI Videos',    icon: Film,         type: 'VIDEO' },
  { name: 'AI Logos',     icon: Award,        type: 'LOGO' },
  { name: 'AI Icons',     icon: Layers,       type: 'ICON' },
  { name: 'AI Audio',     icon: Music,        type: 'AUDIO' },
  { name: 'AI Documents', icon: FileText,     type: 'DOCUMENT' },
  { name: 'AI Templates', icon: LayoutTemplate, type: 'TEMPLATE' },
] as const

const USE_IN_MODULES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'course',    label: 'Course',    icon: GraduationCap },
  { value: 'website',   label: 'Website',   icon: Globe },
  { value: 'blog',      label: 'Blog',      icon: FileText },
  { value: 'product',   label: 'Product',   icon: Package },
  { value: 'community', label: 'Community', icon: MessageCircle },
  { value: 'email',     label: 'Email',     icon: Mail },
  { value: 'marketing', label: 'Marketing', icon: Megaphone },
]

const HISTORY_TYPES = [
  { value: '',           label: 'All Types' },
  { value: 'MARKDOWN',   label: 'Markdown' },
  { value: 'COURSE',     label: 'Course' },
  { value: 'LESSON',     label: 'Lesson' },
  { value: 'EMAIL',      label: 'Email' },
  { value: 'SALES_PAGE', label: 'Sales Page' },
  { value: 'BLOG',       label: 'Blog' },
  { value: 'SOCIAL',     label: 'Social' },
  { value: 'SCRIPT',     label: 'Script' },
  { value: 'PRODUCT',    label: 'Product' },
  { value: 'LANDING',    label: 'Landing' },
  { value: 'IMAGE',      label: 'Image' },
  { value: 'VIDEO',      label: 'Video' },
]
const HISTORY_STATUSES = [
  { value: '',          label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED',    label: 'Failed' },
  { value: 'PENDING',   label: 'Pending' },
]

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  GraduationCap, FileText, Mail, ShoppingCart, LayoutTemplate, PenLine,
  Share2, Youtube, Package, MessageSquare, Sparkles, ImageIcon,
}

// ─── Tiny fetch helper ──────────────────────────────────────────────────────
async function postJSON<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  let data: any
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { error: raw } }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data as T
}

async function patchJSON<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  let data: any
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { error: raw } }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data as T
}

async function putJSON<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  let data: any
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { error: raw } }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data as T
}

async function deleteJSON<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' })
  const raw = await res.text()
  let data: any
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { error: raw } }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data as T
}

// ─── Status badge helper ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase() || 'UNKNOWN'
  if (s === 'COMPLETED') return <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>
  if (s === 'FAILED')    return <Badge variant="secondary" className="bg-rose-500/15 text-rose-600 border-rose-500/20"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>
  if (s === 'CANCELLED') return <Badge variant="secondary" className="bg-muted text-muted-foreground"><X className="h-3 w-3 mr-1" />Cancelled</Badge>
  if (s === 'QUEUED')    return <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" />Queued</Badge>
  if (s === 'RENDERING' || s === 'PROCESSING' || s === 'PENDING')
    return <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/20"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{s.charAt(0) + s.slice(1).toLowerCase()}</Badge>
  return <Badge variant="outline" className="text-xs">{s}</Badge>
}

// ============================================================================
// Main module
// ============================================================================

export function AiStudioModule() {
  const { activeSubTab, navigateTo } = useAppStore()
  const [tab, setTab] = useState<StudioTab>('dashboard')
  const [credits, setCredits] = useState(4280)

  useEffect(() => {
    if (activeSubTab && ALL_TABS.includes(activeSubTab as StudioTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(activeSubTab as StudioTab)
    }
  }, [activeSubTab])

  // Best-effort load of the user's current credit balance.
  useEffect(() => {
    fetch('/api/ai/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.creditsRemaining === 'number') setCredits(d.creditsRemaining) })
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
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2">
            <Zap className="h-4 w-4 text-amber-600" />
            <span className="text-base font-bold tabular-nums text-amber-700 dark:text-amber-400">{credits.toLocaleString()}</span>
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
        <TabsContent value="videos"><VideosTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="courses"><CoursesTab onCreditsUpdate={setCredits} onNavigate={(m, s) => navigateTo(m as any, s)} /></TabsContent>
        <TabsContent value="marketing"><MarketingTab onCreditsUpdate={setCredits} /></TabsContent>
        <TabsContent value="media-library"><MediaLibraryTab onNavigate={setTab} /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab credits={credits} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================================
// 1. Dashboard Tab
// ============================================================================

function DashboardTab({ credits, onNavigate }: { credits: number; onNavigate: (tab: StudioTab) => void }) {
  const { data, loading, refetch } = useApi<DashboardData>('/api/ai/dashboard')

  const stats = [
    { label: 'Credits Remaining', value: credits.toLocaleString(), icon: Zap, color: 'text-amber-600', bg: 'bg-amber-500/10' },
    { label: "Today's Generations", value: data?.todayGenerations ?? 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    { label: 'Total Generations', value: data?.totalGenerations ?? 0, icon: FileText, color: 'text-rose-600', bg: 'bg-rose-500/10' },
    { label: 'Assets in Library', value: data ? Object.values(data.assetCounts).reduce((a, b) => a + b, 0) : 0, icon: FolderOpen, color: 'text-violet-600', bg: 'bg-violet-500/10' },
  ]

  const quickActions: { label: string; desc: string; icon: LucideIcon; tab: StudioTab; color: string }[] = [
    { label: 'Generate Course', desc: 'AI builds a complete course outline', icon: GraduationCap, tab: 'courses', color: 'bg-emerald-500/10 text-emerald-600' },
    { label: 'Generate Image', desc: 'Create custom AI imagery', icon: ImageIcon, tab: 'images', color: 'bg-amber-500/10 text-amber-600' },
    { label: 'Generate Video', desc: 'Short-form video for social', icon: Film, tab: 'videos', color: 'bg-rose-500/10 text-rose-600' },
    { label: 'Generate Email', desc: 'Email campaign sequences', icon: Mail, tab: 'marketing', color: 'bg-cyan-500/10 text-cyan-600' },
    { label: 'Generate Blog', desc: 'SEO-friendly blog content', icon: FileText, tab: 'documents', color: 'bg-pink-500/10 text-pink-600' },
  ]

  const assetCountCards = [
    { key: 'images',    label: 'AI Images',    icon: ImageIcon },
    { key: 'videos',    label: 'AI Videos',    icon: Film },
    { key: 'logos',     label: 'AI Logos',     icon: Award },
    { key: 'icons',     label: 'AI Icons',     icon: Layers },
    { key: 'audio',     label: 'AI Audio',     icon: Music },
    { key: 'documents', label: 'AI Documents', icon: FileText },
    { key: 'templates', label: 'AI Templates', icon: LayoutTemplate },
  ] as const

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', s.bg)}><Icon className={cn('h-5 w-5', s.color)} /></div>
                <div>
                  <p className="text-xl font-bold tabular-nums leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-muted-foreground">Quick Actions</p>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={refetch}><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button>
        </div>
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Recent AI Work + Asset counts */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Recent AI Work</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onNavigate('history')}>View all</Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !data?.recentGenerations || data.recentGenerations.length === 0 ? (
              <div className="p-8 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium">No generations yet</p>
                <p className="text-xs text-muted-foreground mt-1">Start generating with AI to see your work here.</p>
                <Button size="sm" className="mt-3" onClick={() => onNavigate('chat')}><Sparkles className="h-3.5 w-3.5 mr-1.5" />Try AI Chat</Button>
              </div>
            ) : (
              <div className="divide-y max-h-[420px] overflow-y-auto scroll-thin">
                {data.recentGenerations.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition">
                    {g.assetUrl ? (
                      <img src={g.assetUrl} alt={g.title} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0"><FileText className="h-4 w-4" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g.title || g.toolSlug}</p>
                      <p className="text-xs text-muted-foreground truncate">{g.toolSlug} · {timeAgo(g.createdAt)} · {g.creditsUsed}cr</p>
                    </div>
                    <StatusBadge status={g.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> Asset Library</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {assetCountCards.map(c => {
              const Icon = c.icon
              const count = (data?.assetCounts as any)?.[c.key] ?? 0
              return (
                <button key={c.key} onClick={() => onNavigate('media-library')} className="flex flex-col items-start gap-1 rounded-lg border p-2.5 hover:bg-muted/50 transition text-left">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-base font-bold tabular-nums leading-none">{count}</p>
                  <p className="text-[10px] text-muted-foreground">{c.label}</p>
                </button>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Favorite Assets */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Favorite Assets</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onNavigate('media-library')}>Open Library</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}</div>
          ) : !data?.favoriteAssets || data.favoriteAssets.length === 0 ? (
            <div className="p-6 text-center">
              <Star className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium">No favorites yet</p>
              <p className="text-xs text-muted-foreground mt-1">Star assets in your library to pin them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.favoriteAssets.map(a => (
                <button key={a.id} onClick={() => onNavigate('media-library')} className="group relative aspect-square rounded-lg overflow-hidden border bg-muted">
                  {a.thumbnailUrl || a.url ? (
                    <img src={a.thumbnailUrl || a.url} alt={a.name} className="h-full w-full object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground/40" /></div>
                  )}
                  <div className="absolute top-1.5 right-1.5"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /></div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-xs font-medium text-white truncate">{a.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 2. Chat Tab — preserved from original (uses /api/ai/chat)
// ============================================================================

function ChatTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tool, setTool] = useState('CHAT')
  const scrollRef = useRef<HTMLDivElement>(null)

  const TOOLS = [
    { value: 'CHAT',   label: 'General Assistant' },
    { value: 'COURSE', label: 'Course Architect' },
    { value: 'EMAIL',  label: 'Email Copywriter' },
    { value: 'SALES',  label: 'Sales Page Writer' },
    { value: 'BLOG',   label: 'Blog Writer' },
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

// ============================================================================
// 3. Documents Tab — preserved from original (uses /api/ai/generate)
// ============================================================================

interface Tool { id: string; slug: string; name: string; description: string; icon: string; category: string; creditCost: number; outputType: string; isPro: boolean }

function DocumentsTab({ onCreditsUpdate, onNavigate }: { onCreditsUpdate: (c: number) => void; onNavigate: (module: string, subTab?: string) => void }) {
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
    const Icon = ICON_MAP[activeTool.icon] || Sparkles
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => { setActiveTool(null); setInput('') }}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to tools</Button>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{activeTool.name}</CardTitle></CardHeader>
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

// ============================================================================
// 4. Images Tab — 3-column layout with editing + cross-module use
// ============================================================================

function ImagesTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('Realistic')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [loading, setLoading] = useState(false)
  const [lastImage, setLastImage] = useState<{ id: string; url: string; prompt: string; width: number; height: number } | null>(null)
  const [selected, setSelected] = useState<CreatorAsset | null>(null)
  const [selectedOpen, setSelectedOpen] = useState(false)

  const historyApi = useApi<{ assets: CreatorAsset[]; total: number }>('/api/ai/assets?folder=AI%20Images&pageSize=12')
  const recent = historyApi.data?.assets || []

  const generate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    try {
      const data = await postJSON<{ assetId: string; url: string; thumbnailUrl: string; width: number; height: number; creditsUsed: number; remainingCredits: number }>('/api/ai/images', { prompt: prompt.trim(), style, aspectRatio })
      setLastImage({ id: data.assetId, url: data.url, prompt: prompt.trim(), width: data.width, height: data.height })
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success('Image generated!', { description: `-${data.creditsUsed} credits` })
      setPrompt('')
      historyApi.refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to generate image') }
    finally { setLoading(false) }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr_280px]">
      {/* Column 1 — Prompt + Settings */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> Generate Image</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Prompt</Label>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A serene mountain landscape at golden hour..." rows={5} className="mt-1 text-sm resize-none" disabled={loading} />
              <p className="text-[10px] text-muted-foreground mt-1">{prompt.length}/2000</p>
            </div>

            <div>
              <Label className="text-xs font-medium">Style</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {IMAGE_STYLES_UI.map(s => {
                  const Icon = s.icon
                  return (
                    <button key={s.value} type="button" onClick={() => setStyle(s.value)} disabled={loading}
                      title={s.value}
                      className={cn('flex items-center gap-2 rounded-lg border p-2.5 transition text-left',
                        style === s.value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-medium leading-none">{s.value}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Aspect Ratio</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {ASPECT_RATIOS_UI.map(r => (
                  <button key={r.value} type="button" onClick={() => setAspectRatio(r.value)} disabled={loading}
                    className={cn('flex flex-col items-center gap-1 rounded-md border p-2 transition',
                      aspectRatio === r.value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
                    <div className="flex items-center justify-center h-6">
                      <div className={cn('rounded border-2 border-current', r.w, r.h)} />
                    </div>
                    <span className="text-[9px] font-medium leading-none">{r.value}</span>
                    <span className="text-[8px] text-muted-foreground leading-none">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={generate} disabled={loading || !prompt.trim()} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              {loading ? 'Generating...' : 'Generate · 3 credits'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Column 2 — Generated grid */}
      <div className="min-w-0 space-y-4">
        {/* Latest / loading */}
        {loading ? (
          <Card className="overflow-hidden">
            <div className="aspect-video bg-muted flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Creating your image...</p>
                <p className="text-xs text-muted-foreground">Usually takes 5-10 seconds</p>
              </div>
            </div>
          </Card>
        ) : lastImage ? (
          <Card className="overflow-hidden group">
            <div className="relative bg-muted">
              <img src={lastImage.url} alt={lastImage.prompt} className="w-full max-h-[480px] object-contain" />
              <div className="absolute top-2 right-2 flex gap-1.5">
                <Button size="sm" variant="secondary" className="h-7 text-xs" asChild><a href={lastImage.url} download target="_blank" rel="noreferrer"><Download className="h-3 w-3 mr-1" />Save</a></Button>
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(lastImage.url); toast.success('URL copied') }}><Copy className="h-3 w-3 mr-1" />Copy</Button>
              </div>
              <Badge variant="secondary" className="absolute top-2 left-2 bg-emerald-500/90 text-white border-0">Latest</Badge>
            </div>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground line-clamp-2">{lastImage.prompt}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{lastImage.width} × {lastImage.height} · {style}</p>
            </CardContent>
          </Card>
        ) : null}

        {/* Recent images grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Recent Images</p>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => historyApi.refetch()}><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button>
          </div>
          {historyApi.loading && recent.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}</div>
          ) : recent.length === 0 && !lastImage ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center rounded-xl border border-dashed">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Generate your first AI image</p>
              <p className="text-xs text-muted-foreground mt-1">Describe what you want and click Generate.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map(img => (
                <Card key={img.id} className="overflow-hidden group cursor-pointer hover:shadow-md transition" onClick={() => { setSelected(img); setSelectedOpen(true) }}>
                  <div className="aspect-square bg-muted relative">
                    {(img.thumbnailUrl || img.url) ? (
                      <img src={img.thumbnailUrl || img.url} alt={img.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground/40" /></div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Button size="sm" variant="secondary" className="h-7 text-xs"><Pencil className="h-3 w-3 mr-1" />Open</Button>
                    </div>
                    {img.isFavorite && <Star className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                  </div>
                  <CardContent className="p-2.5">
                    <p className="text-xs font-medium truncate">{img.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{img.prompt}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Column 3 — History sidebar */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3" /> History</p>
        {recent.length === 0 ? (
          <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Generated images appear here.</p></CardContent></Card>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto scroll-thin pr-1">
            {recent.map(img => (
              <button key={img.id} onClick={() => { setSelected(img); setSelectedOpen(true) }} className="block w-full rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary/40 transition text-left">
                <div className="aspect-video bg-muted relative">
                  {(img.thumbnailUrl || img.url) ? (
                    <img src={img.thumbnailUrl || img.url} alt={img.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground/40" /></div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-medium truncate">{img.name}</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(img.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Image detail dialog */}
      <ImageDetailDialog
        asset={selected}
        open={selectedOpen}
        onOpenChange={(v) => { setSelectedOpen(v); if (!v) setSelected(null) }}
        onCreditsUpdate={onCreditsUpdate}
        onChanged={() => historyApi.refetch()}
      />
    </div>
  )
}

// ─── Image detail dialog with all editing actions ──────────────────────────

function ImageDetailDialog({
  asset, open, onOpenChange, onCreditsUpdate, onChanged,
}: {
  asset: CreatorAsset | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreditsUpdate: (c: number) => void
  onChanged: () => void
}) {
  const [renameMode, setRenameMode] = useState(false)
  const [name, setName] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [cropW, setCropW] = useState(512)
  const [cropH, setCropH] = useState(512)
  const [cropOpen, setCropOpen] = useState(false)

  useEffect(() => {
    if (asset) { setName(asset.name); setRenameMode(false); setEditPrompt(''); setEditOpen(false); setCropOpen(false) }
  }, [asset])

  if (!asset) return null

  const doAction = async (action: string, params?: Record<string, unknown>) => {
    if (!asset) return
    setActionLoading(action)
    try {
      const data = await postJSON<{ assetId: string; url: string; creditsUsed: number; remainingCredits: number }>(`/api/ai/images/${asset.id}/actions`, { action, params })
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      toast.success(`${action} completed`, { description: `-${data.creditsUsed} credits` })
      onChanged()
      onOpenChange(false)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Action failed') }
    finally { setActionLoading(null); setEditOpen(false); setCropOpen(false) }
  }

  const toggleFavorite = async () => {
    setActionLoading('favorite')
    try {
      await patchJSON(`/api/ai/assets/${asset.id}`, { isFavorite: !asset.isFavorite })
      toast.success(asset.isFavorite ? 'Removed from favorites' : 'Added to favorites')
      onChanged()
      onOpenChange(false)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setActionLoading(null) }
  }

  const saveName = async () => {
    if (!name.trim()) return
    setActionLoading('rename')
    try {
      await patchJSON(`/api/ai/assets/${asset.id}`, { name: name.trim() })
      toast.success('Renamed')
      onChanged()
      setRenameMode(false)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setActionLoading(null) }
  }

  const applyUseIn = async (module: string) => {
    setActionLoading(`use-${module}`)
    try {
      await postJSON(`/api/ai/assets/${asset.id}/use`, { module })
      const label = USE_IN_MODULES.find(m => m.value === module)?.label || module
      toast.success(`Added to ${label}`, { description: 'Asset is now linked to your ' + label.toLowerCase() + '.' })
      onChanged()
      onOpenChange(false)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setActionLoading(null) }
  }

  const ACTIONS: { action: string; label: string; icon: LucideIcon }[] = [
    { action: 'upscale',   label: 'Upscale 2×',  icon: Maximize2 },
    { action: 'remove-bg', label: 'Remove BG',   icon: Eraser },
    { action: 'variations', label: 'Variations', icon: Layers },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            {renameMode ? (
              <span className="flex items-center gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 w-64" autoFocus />
                <Button size="sm" className="h-7" onClick={saveName} disabled={actionLoading === 'rename'}><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => { setRenameMode(false); setName(asset.name) }}><X className="h-3 w-3" /></Button>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>{asset.name}</span>
                <button onClick={() => setRenameMode(true)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">Image details and actions</DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-[1fr_280px] gap-4 overflow-y-auto max-h-[70vh]">
          {/* Preview */}
          <div className="space-y-3">
            <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center min-h-[300px]">
              {(asset.thumbnailUrl || asset.url) ? (
                <img src={asset.thumbnailUrl || asset.url} alt={asset.name} className="max-h-[60vh] w-auto object-contain" />
              ) : (
                <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild><a href={asset.url} download target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5 mr-1.5" />Download</a></Button>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(asset.url); toast.success('URL copied') }}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy URL</Button>
              <Button size="sm" variant="outline" onClick={toggleFavorite} disabled={actionLoading === 'favorite'}>
                <Star className={cn('h-3.5 w-3.5 mr-1.5', asset.isFavorite && 'fill-amber-400 text-amber-400')} />
                {asset.isFavorite ? 'Favorited' : 'Favorite'}
              </Button>
            </div>
          </div>

          {/* Sidebar actions */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Quick Actions</p>
              <div className="grid grid-cols-3 gap-1.5">
                {ACTIONS.map(a => {
                  const Icon = a.icon
                  return (
                    <Button key={a.action} variant="outline" size="sm" className="h-auto flex-col py-2 text-[10px]" disabled={actionLoading === a.action}
                      onClick={() => doAction(a.action)}>
                      {actionLoading === a.action ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                      {a.label}
                    </Button>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                <Button variant="outline" size="sm" className="h-auto flex-col py-2 text-[10px]" disabled={actionLoading === 'crop'}
                  onClick={() => setCropOpen(true)}>
                  {actionLoading === 'crop' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scissors className="h-3.5 w-3.5" />}
                  Crop
                </Button>
                <Button variant="outline" size="sm" className="h-auto flex-col py-2 text-[10px]" disabled={actionLoading === 'edit'}
                  onClick={() => setEditOpen(true)}>
                  {actionLoading === 'edit' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand className="h-3.5 w-3.5" />}
                  Edit with AI
                </Button>
              </div>
            </div>

            <div className="text-xs space-y-1.5 border-t pt-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Dimensions</span><span className="font-medium">{asset.width} × {asset.height}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Style</span><span className="font-medium">{asset.style || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Aspect</span><span className="font-medium">{asset.aspectRatio || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{timeAgo(asset.createdAt)}</span></div>
              {asset.isUsed && <div className="flex justify-between"><span className="text-muted-foreground">Used in</span><span className="font-medium text-emerald-600">{asset.usedIn.length} place{asset.usedIn.length !== 1 ? 's' : ''}</span></div>}
            </div>

            {asset.prompt && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Prompt</p>
                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 max-h-32 overflow-y-auto scroll-thin">{asset.prompt}</p>
              </div>
            )}
          </div>
        </div>

        {/* Crop dialog (nested) */}
        <Dialog open={cropOpen} onOpenChange={setCropOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Crop / Resize</DialogTitle>
              <DialogDescription>Specify the target dimensions in pixels (1-4096).</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <div><Label className="text-xs">Width</Label><Input type="number" min={1} max={4096} value={cropW} onChange={(e) => setCropW(Number(e.target.value))} className="mt-1" /></div>
              <div><Label className="text-xs">Height</Label><Input type="number" min={1} max={4096} value={cropH} onChange={(e) => setCropH(Number(e.target.value))} className="mt-1" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCropOpen(false)}>Cancel</Button>
              <Button onClick={() => doAction('crop', { width: cropW, height: cropH })} disabled={actionLoading === 'crop'}>
                {actionLoading === 'crop' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Scissors className="h-4 w-4 mr-1.5" />}
                Apply Crop · 2cr
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit-with-AI dialog (nested) */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit with AI</DialogTitle>
              <DialogDescription>Describe how you want to modify the image.</DialogDescription>
            </DialogHeader>
            <Textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="e.g. Add a sunset sky behind the mountains" rows={4} className="resize-none" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={() => doAction('edit', { prompt: editPrompt })} disabled={actionLoading === 'edit' || !editPrompt.trim()}>
                {actionLoading === 'edit' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand className="h-4 w-4 mr-1.5" />}
                Apply Edit · 2cr
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// 5. Videos Tab — NEW
// ============================================================================

interface VideoJob {
  id: string
  prompt: string
  params: { preset?: string; duration?: number; resolution?: string }
  status: string
  progress: number
  resultUrl: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

function VideosTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [prompt, setPrompt] = useState('')
  const [preset, setPreset] = useState('Social Reel')
  const [duration, setDuration] = useState(8)
  const [resolution, setResolution] = useState('1080p')
  const [loading, setLoading] = useState(false)
  const [activeJobs, setActiveJobs] = useState<VideoJob[]>([])
  const [playing, setPlaying] = useState<CreatorAsset | null>(null)

  // List completed videos from Media Library
  const completedApi = useApi<{ assets: CreatorAsset[] }>('/api/ai/assets?type=VIDEO&pageSize=20')
  const completed = completedApi.data?.assets || []

  // Poll active jobs every 2s
  useEffect(() => {
    if (activeJobs.length === 0) return
    const interval = setInterval(async () => {
      const stillActive: VideoJob[] = []
      await Promise.all(activeJobs.map(async (job) => {
        try {
          const res = await fetch(`/api/ai/videos/${job.id}`)
          if (res.ok) {
            const updated = await res.json() as VideoJob
            if (['QUEUED', 'RENDERING', 'PROCESSING'].includes(updated.status)) {
              stillActive.push(updated)
            } else {
              // Terminal — refresh completed list + remove from active
              if (updated.status === 'COMPLETED') {
                toast.success('Video ready!', { description: `"${updated.prompt.slice(0, 60)}"` })
              } else if (updated.status === 'FAILED') {
                toast.error('Video generation failed', { description: updated.errorMessage || 'Please try again.' })
              }
              completedApi.refetch()
            }
          } else {
            stillActive.push(job) // keep polling if fetch failed
          }
        } catch {
          stillActive.push(job)
        }
      }))
      // Only update if changed (avoid re-render loops)
      setActiveJobs(prev => {
        if (prev.length !== stillActive.length) return stillActive
        const sameIds = prev.every((p, i) => p.id === stillActive[i]?.id && p.progress === stillActive[i]?.progress && p.status === stillActive[i]?.status)
        return sameIds ? prev : stillActive
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [activeJobs, completedApi])

  const generate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    try {
      const data = await postJSON<{ jobId: string; status: string; creditsUsed: number; remainingCredits: number }>('/api/ai/videos', {
        prompt: prompt.trim(), preset, duration, resolution,
      })
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      const newJob: VideoJob = {
        id: data.jobId,
        prompt: prompt.trim(),
        params: { preset, duration, resolution },
        status: data.status,
        progress: 0,
        resultUrl: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      }
      setActiveJobs(prev => [newJob, ...prev])
      toast.success('Video queued!', { description: `-${data.creditsUsed} credits · we'll notify you when ready` })
      setPrompt('')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to generate video') }
    finally { setLoading(false) }
  }

  const retryJob = async (jobId: string) => {
    try {
      const data = await postJSON<{ jobId: string; status: string; creditsUsed: number; remainingCredits: number }>(`/api/ai/videos/${jobId}/retry`, {})
      if (data.remainingCredits !== undefined) onCreditsUpdate(data.remainingCredits)
      // Remove the failed job and add the new one
      setActiveJobs(prev => {
        const filtered = prev.filter(j => j.id !== jobId)
        const newJob: VideoJob = {
          id: data.jobId,
          prompt: prev.find(j => j.id === jobId)?.prompt || '',
          params: prev.find(j => j.id === jobId)?.params || { preset, duration, resolution },
          status: data.status, progress: 0, resultUrl: null, errorMessage: null,
          createdAt: new Date().toISOString(), completedAt: null,
        }
        return [newJob, ...filtered]
      })
      toast.success('Retrying video...', { description: `-${data.creditsUsed} credits` })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to retry') }
  }

  const cancelJob = async (jobId: string) => {
    try {
      await patchJSON(`/api/ai/videos/${jobId}`, { status: 'CANCELLED' })
      setActiveJobs(prev => prev.filter(j => j.id !== jobId))
      toast.success('Video cancelled')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to cancel') }
  }

  return (
    <div className="space-y-4">
      {/* Generation form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Film className="h-4 w-4 text-primary" /> AI Video Generator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs font-medium">Prompt</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. A short promo video introducing my new course on AI for creators" rows={3} className="mt-1 text-sm resize-none" disabled={loading} />
            <p className="text-[10px] text-muted-foreground mt-1">{prompt.length}/1000</p>
          </div>

          <div>
            <Label className="text-xs font-medium">Preset</Label>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {VIDEO_PRESETS_UI.map(p => {
                const Icon = p.icon
                return (
                  <button key={p.value} type="button" onClick={() => setPreset(p.value)} disabled={loading}
                    className={cn('flex flex-col items-center gap-1 rounded-lg border p-2.5 transition text-center',
                      preset === p.value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium leading-tight">{p.value}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Duration · {duration}s</Label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {VIDEO_DURATIONS.map(d => (
                  <button key={d} type="button" onClick={() => setDuration(d)} disabled={loading}
                    className={cn('rounded-md border py-2 text-xs font-medium transition',
                      duration === d ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Resolution</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {VIDEO_RESOLUTIONS.map(r => {
                  const Icon = r.icon
                  return (
                    <button key={r.value} type="button" onClick={() => setResolution(r.value)} disabled={loading}
                      className={cn('flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition',
                        resolution === r.value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
                      <Icon className="h-3.5 w-3.5" /> {r.value}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400">15 credits</Badge>
            <Button onClick={generate} disabled={loading || !prompt.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Film className="h-4 w-4 mr-1.5" />}
              {loading ? 'Queuing...' : 'Generate Video'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" /> In Progress ({activeJobs.length})</p>
          <div className="space-y-2">
            {activeJobs.map(job => (
              <Card key={job.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                      <Film className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{job.prompt}</p>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{job.params.preset} · {job.params.duration}s · {job.params.resolution} · {timeAgo(job.createdAt)}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={job.progress} className="h-1.5 flex-1" />
                        <span className="text-xs font-medium tabular-nums text-muted-foreground w-10 text-right">{job.progress}%</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10" onClick={() => cancelJob(job.id)}>
                      <X className="h-3.5 w-3.5 mr-1" />Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed videos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold flex items-center gap-2"><Clapperboard className="h-3.5 w-3.5 text-primary" /> Your Videos</p>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => completedApi.refetch()}><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button>
        </div>
        {completedApi.loading && completed.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-lg" />)}</div>
        ) : completed.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Film className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium">No videos yet</p>
              <p className="text-xs text-muted-foreground mt-1">Describe your video above and click Generate.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map(v => (
              <Card key={v.id} className="overflow-hidden group cursor-pointer hover:shadow-md transition" onClick={() => setPlaying(v)}>
                <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 relative flex items-center justify-center">
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt={v.name} className="h-full w-full object-cover" />
                  ) : (
                    <Film className="h-10 w-10 text-muted-foreground/40" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center"><Play className="h-5 w-5 text-black fill-black ml-0.5" /></div>
                  </div>
                  <Badge variant="secondary" className="absolute top-2 left-2 bg-emerald-500/90 text-white border-0"><CheckCircle2 className="h-3 w-3 mr-1" />Ready</Badge>
                  {v.duration > 0 && <Badge variant="secondary" className="absolute bottom-2 right-2 bg-black/80 text-white border-0">{v.duration}s</Badge>}
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.prompt}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Video player dialog */}
      <Dialog open={!!playing} onOpenChange={(v) => { if (!v) setPlaying(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Film className="h-4 w-4 text-primary" /> {playing?.name}</DialogTitle>
            <DialogDescription>{playing?.prompt}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg overflow-hidden bg-black">
            {playing?.url ? (
              <video src={playing.url} controls className="w-full aspect-video" autoPlay />
            ) : (
              <div className="aspect-video flex items-center justify-center text-white/60">
                <Film className="h-12 w-12" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild><a href={playing?.url} download target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5 mr-1.5" />Download</a></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Use in...<ChevronDown className="h-3 w-3 ml-1" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {USE_IN_MODULES.map(m => {
                  const Icon = m.icon
                  return (
                    <DropdownMenuItem key={m.value} onClick={async () => {
                      if (!playing) return
                      try {
                        await postJSON(`/api/ai/assets/${playing.id}/use`, { module: m.value })
                        toast.success(`Added to ${m.label}`)
                        completedApi.refetch()
                      } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
                    }}>
                      <Icon className="h-3.5 w-3.5 mr-2" /> {m.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// 6. Courses Tab — preserved (uses /api/ai/generate with COURSE_GENERATOR)
// ============================================================================

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

// ============================================================================
// 7. Website Tab — preserved (uses /api/ai/landing-page)
// ============================================================================

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

// ============================================================================
// 8. Marketing Tab — preserved (uses /api/ai/generate with EMAIL_WRITER etc.)
// ============================================================================

function MarketingTab({ onCreditsUpdate }: { onCreditsUpdate: (c: number) => void }) {
  const [tool, setTool] = useState('EMAIL')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const TOOLS = [
    { value: 'EMAIL',  label: 'Email Campaign',  slug: 'EMAIL_WRITER',    cost: 4 },
    { value: 'SOCIAL', label: 'Social Media Post', slug: 'SOCIAL_MEDIA',  cost: 3 },
    { value: 'BLOG',   label: 'Blog Post',         slug: 'BLOG_WRITER',    cost: 8 },
    { value: 'SALES',  label: 'Sales Page',        slug: 'SALES_PAGE_GENERATOR', cost: 12 },
    { value: 'SCRIPT', label: 'YouTube Script',    slug: 'SCRIPT_WRITER',  cost: 10 },
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

// ============================================================================
// 9. Media Library Tab — NEW
// ============================================================================

function MediaLibraryTab({ onNavigate: _onNavigate }: { onNavigate: (tab: StudioTab) => void }) {
  const [folder, setFolder] = useState<string>('') // '' = All
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<CreatorAsset | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const query = new URLSearchParams({ pageSize: '24', page: String(page) })
  if (folder) query.set('folder', folder)
  if (type) query.set('type', type)
  if (favoritesOnly) query.set('isFavorite', 'true')
  if (search) query.set('search', search)
  const { data, loading, refetch } = useApi<{ assets: CreatorAsset[]; total: number; page: number; totalPages: number; folders: Array<{ name: string; count: number }> }>(`/api/ai/assets?${query.toString()}`, [folder, type, favoritesOnly, search, page])

  const folderCounts = new Map((data?.folders || []).map(f => [f.name, f.count]))

  const openAsset = (a: CreatorAsset) => { setSelected(a); setDetailOpen(true) }

  const toggleFavorite = async (a: CreatorAsset, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await patchJSON(`/api/ai/assets/${a.id}`, { isFavorite: !a.isFavorite })
      refetch()
      toast.success(a.isFavorite ? 'Removed from favorites' : 'Added to favorites')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const applyUseIn = async (a: CreatorAsset, module: string) => {
    try {
      await postJSON(`/api/ai/assets/${a.id}/use`, { module })
      const label = USE_IN_MODULES.find(m => m.value === module)?.label || module
      toast.success(`Added to ${label}`)
      refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const doDelete = async () => {
    if (!selected) return
    try {
      await deleteJSON(`/api/ai/assets/${selected.id}`)
      toast.success('Asset deleted')
      setDeleteOpen(false); setDetailOpen(false); setSelected(null)
      refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* Folder sidebar */}
      <Card className="h-fit">
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> Folders</CardTitle></CardHeader>
        <CardContent className="p-2 space-y-0.5">
          <button onClick={() => { setFolder(''); setPage(1) }}
            className={cn('flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition', folder === '' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted')}>
            <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5" /> All Assets</span>
            <span className="text-xs text-muted-foreground">{(data?.folders || []).reduce((s, f) => s + f.count, 0)}</span>
          </button>
          {FOLDERS.map(f => {
            const Icon = f.icon
            const count = folderCounts.get(f.name) ?? 0
            return (
              <button key={f.name} onClick={() => { setFolder(f.name); setPage(1) }}
                className={cn('flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition', folder === f.name ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted')}>
                <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {f.name.replace('AI ', '')}</span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* Main area */}
      <div className="space-y-3 min-w-0">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search by name or prompt..." className="pl-9 h-9 text-sm" />
          </div>
          <Select value={type} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="IMAGE">Images</SelectItem>
              <SelectItem value="VIDEO">Videos</SelectItem>
              <SelectItem value="AUDIO">Audio</SelectItem>
              <SelectItem value="DOCUMENT">Documents</SelectItem>
              <SelectItem value="TEMPLATE">Templates</SelectItem>
              <SelectItem value="LOGO">Logos</SelectItem>
              <SelectItem value="ICON">Icons</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={favoritesOnly ? 'default' : 'outline'} size="sm" className="h-9" onClick={() => { setFavoritesOnly(!favoritesOnly); setPage(1) }}>
            <Star className={cn('h-3.5 w-3.5 mr-1.5', favoritesOnly && 'fill-current')} /> Favorites
          </Button>
          <Button variant="ghost" size="sm" className="h-9" onClick={refetch}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>

        {/* Asset grid */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}</div>
        ) : !data?.assets || data.assets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium">No assets found</p>
              <p className="text-xs text-muted-foreground mt-1">{search || favoritesOnly || folder ? 'Try adjusting your filters.' : 'Generate images or videos to populate your library.'}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {data.assets.map(a => (
                <Card key={a.id} className="overflow-hidden group cursor-pointer hover:shadow-md transition" onClick={() => openAsset(a)}>
                  <div className="aspect-square bg-muted relative">
                    {a.type === 'VIDEO' ? (
                      <div className="h-full w-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        {a.thumbnailUrl ? <img src={a.thumbnailUrl} alt={a.name} className="h-full w-full object-cover" /> : <Film className="h-8 w-8 text-muted-foreground/40" />}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <div className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center"><Play className="h-4 w-4 text-black fill-black ml-0.5" /></div>
                        </div>
                      </div>
                    ) : (a.thumbnailUrl || a.url) ? (
                      <img src={a.thumbnailUrl || a.url} alt={a.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><FileText className="h-8 w-8 text-muted-foreground/40" /></div>
                    )}
                    <button onClick={(e) => toggleFavorite(a, e)} className="absolute top-1.5 right-1.5 rounded-full bg-black/30 hover:bg-black/50 p-1 backdrop-blur-sm transition">
                      <Star className={cn('h-3.5 w-3.5', a.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-white/80')} />
                    </button>
                    {a.isUsed && <Badge variant="secondary" className="absolute bottom-1.5 left-1.5 bg-emerald-500/90 text-white border-0 text-[9px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Used</Badge>}
                  </div>
                  <CardContent className="p-2.5">
                    <p className="text-xs font-medium truncate">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{a.prompt || a.description || '—'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">Page {data.page} of {data.totalPages} · {data.total} assets</p>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm" className="h-8" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) setSelected(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> {selected?.name}</DialogTitle>
            <DialogDescription>{selected?.prompt || selected?.description}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid md:grid-cols-[1fr_220px] gap-4 overflow-y-auto max-h-[70vh]">
              <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {selected.type === 'VIDEO' ? (
                  <video src={selected.url} controls className="max-h-[60vh] w-auto" />
                ) : (selected.thumbnailUrl || selected.url) ? (
                  <img src={selected.thumbnailUrl || selected.url} alt={selected.name} className="max-h-[60vh] w-auto object-contain" />
                ) : (
                  <FileText className="h-12 w-12 text-muted-foreground/40" />
                )}
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-1.5">
                  <Button size="sm" variant="outline" asChild><a href={selected.url} download target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5 mr-1.5" />Download</a></Button>
                  <Button size="sm" variant="outline" onClick={() => toggleFavorite(selected)}>
                    <Star className={cn('h-3.5 w-3.5 mr-1.5', selected.isFavorite && 'fill-amber-400 text-amber-400')} />
                    {selected.isFavorite ? 'Favorited' : 'Favorite'}
                  </Button>
                  <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                  </Button>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Use in...</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {USE_IN_MODULES.map(m => {
                      const Icon = m.icon
                      return (
                        <Button key={m.value} variant="outline" size="sm" className="h-auto py-1.5 text-[10px] justify-start gap-1.5" onClick={() => applyUseIn(selected, m.value)}>
                          <Icon className="h-3 w-3" /> {m.label}
                        </Button>
                      )
                    })}
                  </div>
                </div>

                <div className="text-xs space-y-1 border-t pt-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{selected.type}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Folder</span><span className="font-medium">{selected.folder}</span></div>
                  {selected.width > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{selected.width}×{selected.height}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{timeAgo(selected.createdAt)}</span></div>
                  {selected.isUsed && <div className="flex justify-between"><span className="text-muted-foreground">Used in</span><span className="font-medium text-emerald-600">{selected.usedIn.length} place{selected.usedIn.length !== 1 ? 's' : ''}</span></div>}
                </div>

                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map((t, i) => <Badge key={i} variant="outline" className="text-[10px]"><Tag className="h-2 w-2 mr-1" />{t}</Badge>)}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove "{selected?.name}" from your Media Library. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================================
// 10. History Tab — full filters + view dialog
// ============================================================================

interface HistoryItem {
  id: string
  toolSlug: string
  toolName: string
  title: string
  status: string
  outputType: string
  creditsUsed: number
  createdAt: string
  assetUrl: string | null
  assetId: string | null
}

function HistoryTab() {
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<HistoryItem | null>(null)

  const query = new URLSearchParams({ pageSize: '20', page: String(page) })
  if (type) query.set('type', type)
  if (status) query.set('status', status)
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  const { data, loading, refetch } = useApi<{ generations: HistoryItem[]; total: number; page: number; totalPages: number; types: Array<{ type: string; count: number }> }>(`/api/ai/history?${query.toString()}`, [type, status, from, to, page])

  const gens = data?.generations || []
  const completed = gens.filter(g => g.status === 'COMPLETED').length
  const failed = gens.filter(g => g.status === 'FAILED').length
  const creditsUsed = gens.reduce((s, g) => s + g.creditsUsed, 0)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><p className="text-xl font-bold tabular-nums">{data?.total ?? 0}</p><p className="text-xs text-muted-foreground">Total Generations</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xl font-bold tabular-nums text-emerald-600">{completed}</p><p className="text-xs text-muted-foreground">Completed (this page)</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xl font-bold tabular-nums text-rose-600">{failed}</p><p className="text-xs text-muted-foreground">Failed (this page)</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xl font-bold tabular-nums text-amber-600">{creditsUsed}</p><p className="text-xs text-muted-foreground">Credits Used (this page)</p></CardContent></Card>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-end">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2"><Filter className="h-3.5 w-3.5" /> Filters:</div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</Label>
            <Select value={type} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-36 h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>{HISTORY_TYPES.map(t => <SelectItem key={t.value || 'all'} value={t.value || 'all'}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-32 h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>{HISTORY_STATUSES.map(s => <SelectItem key={s.value || 'all'} value={s.value || 'all'}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className="w-36 h-8 text-xs mt-0.5" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className="w-36 h-8 text-xs mt-0.5" />
          </div>
          <Button variant="ghost" size="sm" className="h-8 ml-auto" onClick={() => { setType(''); setStatus(''); setFrom(''); setTo(''); setPage(1) }}>Clear</Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={refetch}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : gens.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium">No generations found</p>
            <p className="text-xs text-muted-foreground mt-1">{type || status || from || to ? 'Try adjusting your filters.' : 'Your AI generations will appear here.'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {gens.map(g => (
                <div key={g.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition">
                  {g.assetUrl ? (
                    <img src={g.assetUrl} alt={g.title} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0"><FileText className="h-4 w-4" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.title || g.toolSlug}</p>
                    <p className="text-xs text-muted-foreground">{g.toolName || g.toolSlug} · {g.outputType || 'TEXT'} · {timeAgo(g.createdAt)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] hidden sm:flex">{g.creditsUsed}cr</Badge>
                  <StatusBadge status={g.status} />
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setViewing(g)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {data.page} of {data.totalPages} · {data.total} total</p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(v) => { if (!v) setViewing(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Generation Details</DialogTitle>
            <DialogDescription>{viewing?.title || viewing?.toolSlug}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              {viewing.assetUrl && (
                <div className="rounded-lg overflow-hidden bg-muted max-h-64 flex items-center justify-center">
                  <img src={viewing.assetUrl} alt={viewing.title} className="max-h-64 w-auto object-contain" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Tool</p><p className="font-medium">{viewing.toolName || viewing.toolSlug}</p></div>
                <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium">{viewing.outputType || 'TEXT'}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={viewing.status} /></div>
                <div><p className="text-xs text-muted-foreground">Credits</p><p className="font-medium">{viewing.creditsUsed}</p></div>
                <div className="col-span-2"><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{new Date(viewing.createdAt).toLocaleString()}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// 11. Settings Tab — brand profile (NO provider/model settings)
// ============================================================================

function SettingsTab({ credits }: { credits: number }) {
  const [brandVoice, setBrandVoice] = useState('professional')
  const [tone, setTone] = useState('confident')
  const [language, setLanguage] = useState('en')
  const [primaryColor, setPrimaryColor] = useState('#10b981')
  const [secondaryColor, setSecondaryColor] = useState('#0ea5e9')
  const [logoUrl, setLogoUrl] = useState('')
  const [defaultAspectRatio, setDefaultAspectRatio] = useState('1:1')
  const [guidelines, setGuidelines] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ai/brand-profile')
      .then(r => r.ok ? r.json() : null)
      .then((d: BrandProfile | null) => {
        if (d) {
          setBrandVoice(d.brandVoice)
          setTone(d.tone)
          setLanguage(d.language)
          setPrimaryColor(d.primaryColor)
          setSecondaryColor(d.secondaryColor)
          setLogoUrl(d.logoUrl)
          setDefaultAspectRatio(d.defaultAspectRatio)
          setGuidelines(d.guidelines)
          setTargetAudience(d.targetAudience)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await putJSON('/api/ai/brand-profile', {
        brandVoice, tone, language, primaryColor, secondaryColor,
        logoUrl, defaultAspectRatio, guidelines, targetAudience,
      })
      toast.success('Brand profile saved')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Brand Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <>
              {/* Voice + Tone */}
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Type className="h-3.5 w-3.5 text-primary" /> Voice & Tone</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Brand Voice</Label>
                    <Select value={brandVoice} onValueChange={setBrandVoice}>
                      <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="witty">Witty</SelectItem>
                        <SelectItem value="authoritative">Authoritative</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="inspirational">Inspirational</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confident">Confident</SelectItem>
                        <SelectItem value="warm">Warm</SelectItem>
                        <SelectItem value="playful">Playful</SelectItem>
                        <SelectItem value="serious">Serious</SelectItem>
                        <SelectItem value="energetic">Energetic</SelectItem>
                        <SelectItem value="calm">Calm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="pt">Portuguese</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                        <SelectItem value="ko">Korean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Colors + Logo */}
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Palette className="h-3.5 w-3.5 text-primary" /> Brand Colors</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Primary Color</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                      <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="text-sm font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Secondary Color</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                      <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="text-sm font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Default Aspect Ratio</Label>
                    <Select value={defaultAspectRatio} onValueChange={setDefaultAspectRatio}>
                      <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIOS_UI.map(r => <SelectItem key={r.value} value={r.value}>{r.value} · {r.label}</SelectItem>)}
                        <SelectItem value="1:3">1:3 · Tall Banner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Logo URL</Label>
                  <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="mt-1 text-sm" />
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Audience + Guidelines */}
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-primary" /> Audience & Guidelines</p>
                <div>
                  <Label className="text-xs">Target Audience</Label>
                  <Textarea value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="e.g. Course creators earning $5K-$50K/month who want to scale with AI" rows={2} className="mt-1 text-sm resize-none" />
                </div>
                <div>
                  <Label className="text-xs">Brand Guidelines</Label>
                  <Textarea value={guidelines} onChange={(e) => setGuidelines(e.target.value)} placeholder="e.g. Always use contractions. Avoid jargon. End CTAs with a clear next step." rows={4} className="mt-1 text-sm resize-none" />
                  <p className="text-[10px] text-muted-foreground mt-1">{guidelines.length}/5000 — used by AI when generating content for you</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-xs text-muted-foreground">These settings apply to all AI generations in this workspace.</p>
                <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}Save Brand Profile</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Credits summary */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Credits</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{credits.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">credits remaining</p>
            </div>
            <Button className="w-full" variant="outline" onClick={() => toast.info('Contact your admin to top up credits', { description: 'Your workspace admin manages credit allocations.' })}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Top Up Credits
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">Each AI generation uses credits. Different actions cost different amounts — see the badge on each tool.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Tips</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p className="flex gap-2"><Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" /> Set your brand voice so all AI content sounds like you.</p>
            <p className="flex gap-2"><Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" /> Favorite assets you reuse to find them faster.</p>
            <p className="flex gap-2"><Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" /> Use the Media Library to organize AI-generated files.</p>
            <p className="flex gap-2"><Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" /> Each "Use in..." action links an asset to a module.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
