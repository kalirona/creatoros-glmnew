'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, FileText, Rocket, Menu, BookOpen, Server, Search as SearchIcon, Settings2,
  Plus, Eye, EyeOff, Copy, ArrowUp, ArrowDown, Trash2, Pencil, Sparkles, Languages,
  Loader2, ArrowLeft, Save, Check, Zap, ExternalLink, Megaphone, Star, ShoppingCart,
  HelpCircle, Type, Mail, Clock, Image as ImageIcon, Video, Layout, ChevronRight,
  TrendingUp, Users, DollarSign, FileCode, Wand2, Send, GripVertical,
  GraduationCap, Package, CreditCard, Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useApi, formatNumber, timeAgo } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'

type SubTab = 'home' | 'pages' | 'landing' | 'navigation' | 'blog' | 'branding' | 'seo' | 'domains'

export function PagesFunnelsModule() {
  const [tab, setTab] = useState<SubTab>('home')
  const [editingPage, setEditingPage] = useState<{ id: string; title: string; slug: string } | null>(null)
  const [generating, setGenerating] = useState(false)

  if (editingPage) {
    return <PageEditor page={editingPage} onBack={() => setEditingPage(null)} />
  }
  if (generating) {
    return <LandingGenerator onDone={(p) => { setGenerating(false); if (p) setEditingPage(p) }} onCancel={() => setGenerating(false)} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Website</h1>
          <p className="text-sm text-muted-foreground mt-1">Your public website is generated automatically from your courses, products, community, and blog.</p>
        </div>
        <Button size="sm" onClick={() => setGenerating(true)}><Sparkles className="h-4 w-4 mr-1.5 text-primary" /> AI Generate Page</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="home"><Globe className="h-3.5 w-3.5 mr-1.5" />Home</TabsTrigger>
          <TabsTrigger value="pages"><FileText className="h-3.5 w-3.5 mr-1.5" />Pages</TabsTrigger>
          <TabsTrigger value="landing"><Rocket className="h-3.5 w-3.5 mr-1.5" />Landing Pages</TabsTrigger>
          <TabsTrigger value="navigation"><Menu className="h-3.5 w-3.5 mr-1.5" />Navigation</TabsTrigger>
          <TabsTrigger value="blog"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Blog</TabsTrigger>
          <TabsTrigger value="branding"><Settings2 className="h-3.5 w-3.5 mr-1.5" />Branding</TabsTrigger>
          <TabsTrigger value="seo"><SearchIcon className="h-3.5 w-3.5 mr-1.5" />SEO</TabsTrigger>
          <TabsTrigger value="domains"><Server className="h-3.5 w-3.5 mr-1.5" />Domains</TabsTrigger>
        </TabsList>

        <TabsContent value="home"><HomePanel /></TabsContent>
        <TabsContent value="pages"><PagesList type="PAGE" onEdit={(p) => setEditingPage(p)} /></TabsContent>
        <TabsContent value="landing"><PagesList type="LANDING" onEdit={(p) => setEditingPage(p)} onGenerate={() => setGenerating(true)} /></TabsContent>
        <TabsContent value="navigation"><NavigationPanel /></TabsContent>
        <TabsContent value="blog"><BlogPanel /></TabsContent>
        <TabsContent value="branding"><SiteSettingsPanel /></TabsContent>
        <TabsContent value="seo"><SeoPanel /></TabsContent>
        <TabsContent value="domains"><DomainsPanel /></TabsContent>
      </Tabs>
    </div>
  )
}

// ===== Home Panel — Website overview with auto-generated pages =====
function HomePanel() {
  const { data: communityData } = useApi<{ stats: { totalPosts: number; totalSpaces: number; totalEvents: number; totalMembers: number } }>('/api/data/community')
  const { data: dashboardData } = useApi<{ stats: { totalCourses: number; totalProducts: number; totalOrders: number; totalRevenue: number } }>('/api/data/dashboard')

  const stats = dashboardData?.stats || { totalCourses: 0, totalProducts: 0, totalOrders: 0, totalRevenue: 0 }
  const communityStats = communityData?.stats || { totalPosts: 0, totalSpaces: 0, totalEvents: 0, totalMembers: 0 }

  const autoPages = [
    { label: 'Homepage', slug: '/', icon: Globe, status: 'Auto-generated', desc: 'Hero, featured courses, products, community highlights' },
    { label: 'Courses', slug: '/courses', icon: GraduationCap, status: `${stats.totalCourses} courses`, desc: 'Automatically lists all published courses' },
    { label: 'Store', slug: '/store', icon: Package, status: `${stats.totalProducts} products`, desc: 'Automatically lists all active products' },
    { label: 'Community', slug: '/community', icon: Users, status: `${communityStats.totalMembers} members`, desc: 'Feed, spaces, events, members' },
    { label: 'Blog', slug: '/blog', icon: BookOpen, status: 'Auto-generated', desc: 'Categories, tags, authors, archives' },
    { label: 'Membership', slug: '/membership', icon: CreditCard, status: 'Plans', desc: 'Membership tiers and pricing' },
    { label: 'About', slug: '/about', icon: FileText, status: 'Editable', desc: 'Custom page — edit in Pages tab' },
    { label: 'Contact', slug: '/contact', icon: Mail, status: 'Editable', desc: 'Custom page — edit in Pages tab' },
    { label: 'Pricing', slug: '/pricing', icon: ShoppingCart, status: 'Editable', desc: 'Custom page — edit in Pages tab' },
  ]

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary/10 to-card border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Globe className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">Your website is auto-generated</h3>
              <p className="text-sm text-muted-foreground mt-1">Pages are created automatically from your courses, products, community, and blog. No need to design — just create content and the website updates itself.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => window.open('/', '_blank')}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View Site
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {autoPages.map((page) => {
          const Icon = page.icon
          return (
            <Card key={page.slug} className="hover:shadow-md transition">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{page.label}</p>
                      <Badge variant="secondary" className="text-[10px]">{page.status}</Badge>
                    </div>
                    <code className="text-xs text-primary">{page.slug}</code>
                    <p className="text-xs text-muted-foreground mt-1">{page.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</div>
            <div>
              <p className="text-sm font-medium">Create content</p>
              <p className="text-xs text-muted-foreground">Add courses, products, blog posts, and community spaces. The website generates pages automatically.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</div>
            <div>
              <p className="text-sm font-medium">AI generates landing pages</p>
              <p className="text-xs text-muted-foreground">Use AI to generate custom landing pages with reusable sections — Hero, Features, Testimonials, Pricing, FAQ, CTA.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</div>
            <div>
              <p className="text-sm font-medium">Edit with forms, not drag-and-drop</p>
              <p className="text-xs text-muted-foreground">Edit text and images through simple forms. No complex page builder, no absolute positioning, no custom CSS.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</div>
            <div>
              <p className="text-sm font-medium">Publish</p>
              <p className="text-xs text-muted-foreground">Your website is live. SEO, Open Graph, and structured data are generated automatically.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Pages list (shared for Pages + Landing Pages) =====
interface PageRow { id: string; title: string; slug: string; type: string; status: string; category: string; visits: number; conversions: number; sectionCount: number; publishedAt: string; updatedAt: string }

function PagesList({ type, onEdit, onGenerate }: { type: string; onEdit: (p: { id: string; title: string; slug: string }) => void; onGenerate?: () => void }) {
  // Fetch all pages, filter client-side (PAGE = everything except LANDING; LANDING = only landing)
  const { data: allData, loading, refetch } = useApi<{ pages: PageRow[]; stats: { total: number; published: number; drafts: number; totalVisits: number } }>(`/api/data/pages`)
  const isLanding = type === 'LANDING'
  const data = allData ? {
    ...allData,
    pages: allData.pages.filter((p) => isLanding ? p.type === 'LANDING' : p.type !== 'LANDING'),
    stats: {
      total: allData.pages.filter((p) => isLanding ? p.type === 'LANDING' : p.type !== 'LANDING').length,
      published: allData.pages.filter((p) => (isLanding ? p.type === 'LANDING' : p.type !== 'LANDING') && p.status === 'PUBLISHED').length,
      drafts: allData.pages.filter((p) => (isLanding ? p.type === 'LANDING' : p.type !== 'LANDING') && p.status === 'DRAFT').length,
      totalVisits: allData.pages.filter((p) => isLanding ? p.type === 'LANDING' : p.type !== 'LANDING').reduce((s, p) => s + p.visits, 0),
    },
  } : null
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSlug, setNewSlug] = useState('')

  const create = async () => {
    if (!newTitle.trim() || !newSlug.trim()) return
    try {
      const res = await fetch('/api/data/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle, slug: newSlug, type, category: type === 'LANDING' ? 'Course' : 'General' }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success('Page created')
      setCreating(false); setNewTitle(''); setNewSlug('')
      refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  if (loading || !data) return <Skeleton className="h-96 rounded-xl" />

  const STATUS_CLS: Record<string, string> = { PUBLISHED: 'bg-emerald-500/10 text-emerald-600', DRAFT: 'bg-amber-500/10 text-amber-600', SCHEDULED: 'bg-sky-500/10 text-sky-600' }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Total Pages', v: data.stats.total, i: FileText },
          { l: 'Published', v: data.stats.published, i: Check },
          { l: 'Drafts', v: data.stats.drafts, i: Pencil },
          { l: 'Total Visits', v: formatNumber(data.stats.totalVisits, true), i: Eye },
        ].map((s) => { const Icon = s.i; return (
          <Card key={s.l}><CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div>
            <div><p className="text-lg font-bold tabular-nums leading-none">{s.v}</p><p className="text-[11px] text-muted-foreground mt-1">{s.l}</p></div>
          </CardContent></Card>
        )})}
      </div>

      {isLanding && (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
          <CardContent className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30"><Sparkles className="h-6 w-6 text-primary-foreground" /></div>
              <div><p className="font-semibold">Generate a landing page with AI</p><p className="text-xs text-muted-foreground">Tell us what you're selling. We'll generate the headline, benefits, features, pricing, testimonials, FAQ, CTA, and SEO — automatically.</p></div>
            </div>
            <Button onClick={onGenerate}><Wand2 className="h-4 w-4 mr-1.5" />Generate</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{isLanding ? 'Your Landing Pages' : 'Your Pages'}</h3>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1.5" />{isLanding ? 'Blank Landing' : 'New Page'}</Button>
      </div>

      <Card><CardContent className="p-0">
        {data.pages.length === 0 ? (
          <div className="p-12 text-center"><FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No {isLanding ? 'landing pages' : 'pages'} yet</p><p className="text-xs text-muted-foreground mt-1">{isLanding ? 'Generate one with AI or create a blank one.' : 'Create your first page to get started.'}</p></div>
        ) : data.pages.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
            className="group flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50 transition">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', isLanding ? 'bg-violet-500/10 text-violet-600' : 'bg-sky-500/10 text-sky-600')}>
              {isLanding ? <Rocket className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><p className="text-sm font-medium truncate">{p.title}</p><Badge variant="secondary" className="text-[10px]">{p.sectionCount} sections</Badge>{isLanding && p.category !== 'General' && <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">{p.category}</Badge>}</div>
              <p className="text-xs text-muted-foreground truncate">creatoros.io/{p.slug}</p>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <div className="text-right"><p className="font-medium text-foreground tabular-nums">{formatNumber(p.visits, true)}</p><p>visits</p></div>
              <div className="text-right"><p className="font-medium text-foreground tabular-nums">{p.conversions}</p><p>conv.</p></div>
            </div>
            <Badge variant="secondary" className={cn('text-[10px]', STATUS_CLS[p.status])}>{p.status}</Badge>
            <Button size="sm" onClick={() => onEdit({ id: p.id, title: p.title, slug: p.slug })}>Edit</Button>
          </motion.div>
        ))}
      </CardContent></Card>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>New {isLanding ? 'Landing Page' : 'Page'}</DialogTitle><DialogDescription>Create a blank page. You can add sections in the editor.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Page title</Label><Input className="mt-1.5" value={newTitle} onChange={(e) => { setNewTitle(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) }} placeholder="e.g. About Us" /></div>
            <div><Label>URL slug</Label><Input className="mt-1.5 font-mono text-sm" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="about-us" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={create}>Create page</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== AI Landing Page Generator =====
function LandingGenerator({ onDone, onCancel }: { onDone: (p: { id: string; title: string; slug: string } | null) => void; onCancel: () => void }) {
  const [selling, setSelling] = useState('')
  const [category, setCategory] = useState('Course')
  const [loading, setLoading] = useState(false)
  const CATEGORIES = ['Course', 'Membership', 'Product', 'Community', 'Agency', 'SaaS', 'LeadMagnet', 'Newsletter', 'Webinar', 'Coaching']
  const EXAMPLES = ['An SEO course for beginners', 'AI course teaching ChatGPT for business', 'Canva templates for Instagram', 'A prompt pack for marketers', 'A paid community for YouTubers', 'Monthly membership for coaches', '1-on-1 coaching for freelancers', 'Agency services for local businesses']

  const generate = async () => {
    if (!selling.trim()) return
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 55000)
      const res = await fetch('/api/ai/landing-page', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selling, category }), signal: controller.signal })
      clearTimeout(timeout)
      const raw = await res.text()
      if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch { } toast.error(m); setLoading(false); return }
      const data = JSON.parse(raw)
      toast.success(`Landing page generated! -${data.creditsUsed} credits`, { description: '7 sections added. Edit and publish when ready.' })
      onDone({ id: data.pageId, title: selling.slice(0, 60), slug: data.pageSlug })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); setLoading(false) }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"><ArrowLeft className="h-4 w-4" /> Back</button>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b p-5 bg-gradient-to-br from-primary/10 to-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30"><Sparkles className="h-6 w-6 text-primary-foreground" /></div>
          <div><h2 className="font-bold">AI Landing Page Generator</h2><p className="text-xs text-muted-foreground">Tell us what you're selling. We'll build a complete, high-converting landing page.</p></div>
        </div>
        <CardContent className="p-5 space-y-4">
          <div>
            <Label>What are you selling?</Label>
            <Textarea className="mt-1.5" rows={3} value={selling} onChange={(e) => setSelling(e.target.value)} placeholder="e.g. An SEO course for beginners who want to rank on Google" disabled={loading} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Try an example:</p>
            <div className="flex flex-wrap gap-1.5">{EXAMPLES.map((ex) => <button key={ex} onClick={() => setSelling(ex)} disabled={loading} className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50">{ex}</button>)}</div>
          </div>
          {loading && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-3 mb-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /><div><p className="text-sm font-medium">Generating your landing page...</p><p className="text-xs text-muted-foreground">Building headline, benefits, features, pricing, testimonials, FAQ, CTA, and SEO.</p></div></div>
              <div className="space-y-1.5">{['Writing headline & hero', 'Crafting benefits & features', 'Generating pricing & testimonials', 'Building FAQ & CTA', 'Optimizing SEO'].map((s, i) => (
                <motion.div key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.8 }} className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="h-3 w-3 text-emerald-500" />{s}</motion.div>
              ))}</div>
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">7 credits · ~20 seconds</p>
            <Button onClick={generate} disabled={loading || !selling.trim()}><Sparkles className="h-4 w-4 mr-1.5" />{loading ? 'Generating...' : 'Generate landing page'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Section-based Page Editor (no canvas, no drag-drop) =====
interface Section { id: string; pageId: string; type: string; content: Record<string, unknown>; position: number; isHidden: boolean }
interface FullPage { id: string; title: string; slug: string; type: string; status: string; category: string; seoTitle: string; seoDescription: string; visits: number; conversions: number; sections: Section[] }

const SECTION_TYPES = [
  { type: 'HERO', name: 'Hero', icon: Megaphone, desc: 'Headline + CTA' },
  { type: 'HEADING', name: 'Heading', icon: Type, desc: 'Section title' },
  { type: 'TEXT', name: 'Text', icon: FileText, desc: 'Paragraph' },
  { type: 'BENEFITS', name: 'Benefits', icon: Star, desc: 'Outcome benefits' },
  { type: 'FEATURES', name: 'Features', icon: Layout, desc: 'Feature grid' },
  { type: 'PRICING', name: 'Pricing', icon: ShoppingCart, desc: 'Pricing tiers' },
  { type: 'TESTIMONIALS', name: 'Testimonials', icon: Star, desc: 'Social proof' },
  { type: 'FAQ', name: 'FAQ', icon: HelpCircle, desc: 'Q&A' },
  { type: 'VIDEO', name: 'Video', icon: Video, desc: 'Embed video' },
  { type: 'GALLERY', name: 'Gallery', icon: ImageIcon, desc: 'Image gallery' },
  { type: 'COUNTDOWN', name: 'Countdown', icon: Clock, desc: 'Timer' },
  { type: 'CTA', name: 'Call to Action', icon: Megaphone, desc: 'Conversion CTA' },
  { type: 'NEWSLETTER', name: 'Newsletter', icon: Mail, desc: 'Email capture' },
  { type: 'FOOTER', name: 'Footer', icon: Layout, desc: 'Page footer' },
]

function PageEditor({ page, onBack }: { page: { id: string; title: string; slug: string }; onBack: () => void }) {
  const { data, loading, refetch } = useApi<{ page: FullPage }>(`/api/data/page-sections?pageId=${page.id}`)
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const pageData = data?.page

  const callApi = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const raw = await res.text()
    if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch { } throw new Error(m) }
    try { return JSON.parse(raw) } catch { return {} }
  }

  const addSection = async (type: string) => {
    setBusy('add')
    try { await callApi('/api/data/page-sections', 'POST', { pageId: page.id, type }); toast.success(`${type} section added`); setShowAddPanel(false); refetch() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }
  const duplicateSection = async (id: string) => { setBusy(id); try { await callApi('/api/data/page-sections', 'PUT', { id, action: 'duplicate' }); toast.success('Section duplicated'); refetch() } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) } }
  const moveSection = async (id: string, dir: 'moveUp' | 'moveDown') => { setBusy(id + dir); try { await callApi('/api/data/page-sections', 'PUT', { id, action: dir }); refetch() } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) } }
  const toggleHide = async (s: Section) => { setBusy(s.id); try { await callApi('/api/data/page-sections', 'PUT', { id: s.id, isHidden: !s.isHidden }); refetch() } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) } }
  const deleteSection = async (id: string) => { setBusy(id); try { await callApi(`/api/data/page-sections?id=${id}`, 'DELETE'); toast.success('Section deleted'); refetch() } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) } }
  const aiAction = async (s: Section, action: string) => { setBusy(s.id + action); try { const d = await callApi('/api/ai/section-rewrite', 'POST', { action, content: s.content, sectionType: s.type }); const updated = { ...s, content: d.content }; await updateSection(s.id, d.content); toast.success(`AI ${action.toLowerCase()} done! -${d.creditsUsed} credits`); refetch() } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) } }

  const [showPreview, setShowPreview] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [seoOpen, setSeoOpen] = useState(false)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set())

  const updateSection = async (id: string, content: Record<string, unknown>) => {
    setSavingSection(id)
    setPendingChanges(prev => new Set(prev).add(id))
    try {
      await callApi('/api/data/page-sections', 'PUT', { id, content })
      setPendingChanges(prev => { const n = new Set(prev); n.delete(id); return n })
      toast.success('Section saved', { duration: 1500 })
    } catch {
      toast.error('Save failed')
    } finally {
      setSavingSection(null)
    }
  }

  const saveAndPreview = async () => {
    // If there's a selected section being edited, save it first
    if (selectedSection) {
      await updateSection(selectedSection.id, selectedSection.content)
    }
    // Wait for any pending saves
    setBusy('save-preview')
    try {
      await refetch()
      setShowPreview(true)
    } finally {
      setBusy(null)
    }
  }

  const publish = async () => {
    setBusy('publish')
    try {
      await callApi('/api/data/pages', 'PUT', { id: page.id, status: 'PUBLISHED' })
      toast.success('Page published', { description: 'Your changes are now live.' })
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to publish')
    } finally {
      setBusy(null)
    }
  }

  const unpublish = async () => {
    setBusy('unpublish')
    try {
      await callApi('/api/data/pages', 'PUT', { id: page.id, status: 'DRAFT' })
      toast.success('Page unpublished', { description: 'Reverted to draft.' })
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  const saveSeo = async (seoTitle: string, seoDescription: string) => {
    setBusy('seo')
    try {
      await callApi('/api/data/pages', 'PUT', { id: page.id, seoTitle, seoDescription })
      toast.success('SEO settings saved')
      setSeoOpen(false)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  const applyTemplate = async (template: { name: string; sections: Array<{ type: string; content: Record<string, unknown> }> }) => {
    setBusy('template')
    try {
      if (pageData) {
        for (const s of pageData.sections) {
          await callApi(`/api/data/page-sections?id=${s.id}`, 'DELETE')
        }
      }
      for (let i = 0; i < template.sections.length; i++) {
        const sec = template.sections[i]
        await callApi('/api/data/page-sections', 'POST', { pageId: page.id, type: sec.type, content: sec.content, position: i })
      }
      toast.success(`Template "${template.name}" applied`, { description: `${template.sections.length} sections added.` })
      setShowTemplates(false)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading || !pageData) return <Skeleton className="h-96 rounded-xl" />

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1.5" />Pages</Button>
            <div className="h-6 w-px bg-border" />
            <div><p className="text-sm font-semibold">{pageData.title}</p><p className="text-[10px] text-muted-foreground">creatoros.io/{pageData.slug}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn('text-[10px]', pageData.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>{pageData.status}</Badge>
            {pendingChanges.size > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-sky-500/10 text-sky-600">
                {savingSection ? <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" /> : null}
                {savingSection ? 'Saving...' : `${pendingChanges.size} unsaved`}
              </Badge>
            )}
            {savingSection && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowTemplates(true)}><Layout className="h-3.5 w-3.5 mr-1.5" />Templates</Button>
            <Button size="sm" variant="outline" onClick={() => setSeoOpen(true)}><SearchIcon className="h-3.5 w-3.5 mr-1.5" />SEO</Button>
            <Button size="sm" variant="outline" onClick={saveAndPreview} disabled={busy === 'save-preview'}>
              {busy === 'save-preview' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save & Preview
            </Button>
            {pageData.status === 'PUBLISHED' ? (
              <Button size="sm" variant="outline" onClick={unpublish} disabled={busy === 'unpublish'}>
                {busy === 'unpublish' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Unpublish
              </Button>
            ) : (
              <Button size="sm" onClick={publish} disabled={busy === 'publish'}>
                {busy === 'publish' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
                Publish
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Section list (vertical, no canvas) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Sections <span className="text-muted-foreground font-normal">({pageData.sections.length})</span></p>
            <Button size="sm" variant="outline" onClick={() => setShowAddPanel(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Section</Button>
          </div>

          {pageData.sections.length === 0 ? (
            <Card><CardContent className="p-12 text-center"><Layout className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No sections yet</p><p className="text-xs text-muted-foreground mt-1">Add your first section to start building.</p><Button size="sm" className="mt-3" onClick={() => setShowAddPanel(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Add section</Button></CardContent></Card>
          ) : (
            <div className="space-y-1.5">
              {pageData.sections.map((s, i) => {
                const meta = SECTION_TYPES.find((t) => t.type === s.type)
                const Icon = meta?.icon || Layout
                const isSelected = selectedSection?.id === s.id
                return (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <Card className={cn('transition-all', isSelected && 'ring-2 ring-primary', s.isHidden && 'opacity-50')}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
                          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}><Icon className="h-4 w-4" /></div>
                          <button className="flex-1 text-left min-w-0" onClick={() => setSelectedSection(isSelected ? null : s)}>
                            <p className="text-sm font-medium truncate">{meta?.name || s.type}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{getSectionPreview(s)}</p>
                          </button>
                          <div className="flex items-center gap-0.5">
                            <IconBtn icon={ArrowUp} onClick={() => moveSection(s.id, 'moveUp')} disabled={busy === s.id + 'moveUp' || i === 0} title="Move up" />
                            <IconBtn icon={ArrowDown} onClick={() => moveSection(s.id, 'moveDown')} disabled={busy === s.id + 'moveDown' || i === pageData.sections.length - 1} title="Move down" />
                            <IconBtn icon={Copy} onClick={() => duplicateSection(s.id)} disabled={busy === s.id} title="Duplicate" />
                            <IconBtn icon={s.isHidden ? EyeOff : Eye} onClick={() => toggleHide(s)} disabled={busy === s.id} title={s.isHidden ? 'Show' : 'Hide'} active={s.isHidden} />
                            <IconBtn icon={Trash2} onClick={() => deleteSection(s.id)} disabled={busy === s.id} title="Delete" danger />
                          </div>
                        </div>
                        {/* AI actions row */}
                        <div className="flex items-center gap-1 mt-2 pl-9 flex-wrap">
                          <button onClick={() => setSelectedSection(s)} className={cn('rounded px-2 py-0.5 text-[10px] font-medium transition', isSelected ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}><Pencil className="h-2.5 w-2.5 inline mr-0.5" />Edit</button>
                          <AIChip label="Rewrite" loading={busy === s.id + 'REWRITE'} onClick={() => aiAction(s, 'REWRITE')} />
                          <AIChip label="Improve" loading={busy === s.id + 'IMPROVE'} onClick={() => aiAction(s, 'IMPROVE')} />
                          <AIChip label="Shorten" loading={busy === s.id + 'SHORTEN'} onClick={() => aiAction(s, 'SHORTEN')} />
                          <AIChip label="Expand" loading={busy === s.id + 'EXPAND'} onClick={() => aiAction(s, 'EXPAND')} />
                          <AIChip label="Translate" loading={busy === s.id + 'TRANSLATE'} onClick={() => aiAction(s, 'TRANSLATE')} />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* SEO summary */}
          <Card className="mt-3">
            <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1.5"><SearchIcon className="h-3.5 w-3.5 text-primary" />SEO</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              <div><span className="text-muted-foreground">Title:</span> <span className="font-medium">{pageData.seoTitle || '(not set)'}</span></div>
              <div><span className="text-muted-foreground">Description:</span> <span className="text-muted-foreground">{pageData.seoDescription || '(not set)'}</span></div>
              <div className="flex items-center gap-1.5 pt-1"><Badge variant="secondary" className="text-[9px]">OpenGraph</Badge><Badge variant="secondary" className="text-[9px]">Schema</Badge><Badge variant="secondary" className="text-[9px]">Twitter Cards</Badge></div>
            </CardContent>
          </Card>
        </div>

        {/* Right-side settings panel */}
        <div className="lg:sticky lg:top-4 h-fit">
          {selectedSection ? (
            <SectionSettingsPanel
              section={selectedSection}
              saving={savingSection === selectedSection.id}
              onSaveAndPreview={saveAndPreview}
              onUpdate={(c) => { updateSection(selectedSection.id, c); setSelectedSection({ ...selectedSection, content: c }) }}
            />
          ) : (
            <Card><CardContent className="p-6 text-center"><Pencil className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">Section settings</p><p className="text-xs text-muted-foreground mt-1">Click any section to edit its content, or use AI actions to rewrite it.</p></CardContent></Card>
          )}
        </div>
      </div>

      {/* Add section panel */}
      <AnimatePresence>
        {showAddPanel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddPanel(false)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
              <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Add a section</CardTitle><Button variant="ghost" size="icon" onClick={() => setShowAddPanel(false)}>✕</Button></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SECTION_TYPES.map((t) => { const Icon = t.icon; return (
                      <button key={t.type} onClick={() => addSection(t.type)} disabled={busy === 'add'} className="group flex flex-col items-start gap-1.5 rounded-xl border p-3 hover:border-primary/40 hover:bg-primary/5 transition disabled:opacity-50">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary group-hover:scale-110 transition"><Icon className="h-4 w-4" /></div>
                        <p className="text-xs font-medium">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                      </button>
                    )})}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Preview — {pageData.title}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border bg-white">
            {pageData.sections.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">No sections to preview. Add sections first.</div>
            ) : (
              <div className="divide-y">
                {pageData.sections.filter(s => !s.isHidden).map((s, i) => (
                  <div key={s.id} className="p-6">
                    <PreviewSection section={s} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
            {pageData.status !== 'PUBLISHED' && (
              <Button onClick={() => { setShowPreview(false); publish() }} disabled={busy === 'publish'}>
                {busy === 'publish' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
                Publish now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SEO Dialog */}
      <Dialog open={seoOpen} onOpenChange={setSeoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>SEO Settings</DialogTitle></DialogHeader>
          <SeoEditor
            initialTitle={pageData.seoTitle || pageData.title}
            initialDescription={pageData.seoDescription}
            onSave={saveSeo}
            saving={busy === 'seo'}
          />
        </DialogContent>
      </Dialog>

      {/* Templates Modal */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Prebuilt Templates</DialogTitle></DialogHeader>
          <TemplatesPanel onApply={applyTemplate} loading={busy === 'template'} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function IconBtn({ icon: Icon, onClick, disabled, title, danger, active }: { icon: React.ComponentType<{ className?: string }>; onClick: () => void; disabled?: boolean; title: string; danger?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={cn('flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-30 disabled:cursor-not-allowed',
        danger ? 'text-rose-500 hover:bg-rose-500/10' : active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

// ===== Preview Section — renders a section for preview =====
function PreviewSection({ section }: { section: Section }) {
  const c = section.content as Record<string, any>
  const type = section.type

  if (type === 'HERO') {
    return (
      <div className="text-center py-8">
        {c.emoji && <div className="text-4xl mb-3">{c.emoji}</div>}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{c.headline || 'Your headline'}</h1>
        <p className="text-lg text-gray-600 mb-4">{c.subheadline || ''}</p>
        <div className="flex justify-center gap-2">
          {c.ctaText && <span className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">{c.ctaText}</span>}
          {c.ctaSecondary && <span className="rounded-lg border px-4 py-2 text-sm font-medium">{c.ctaSecondary}</span>}
        </div>
      </div>
    )
  }
  if (type === 'HEADING') return <h2 className={cn('text-2xl font-bold text-gray-900', c.alignment === 'center' && 'text-center', c.alignment === 'left' && 'text-left')}>{c.text || 'Heading'}</h2>
  if (type === 'TEXT') return <p className="text-gray-600 leading-relaxed">{c.text || ''}</p>
  if (type === 'FEATURES' || type === 'BENEFITS') {
    const items = Array.isArray(c.items) ? c.items : []
    return (
      <div>
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-1">{c.heading}</h3>}
        {c.subheading && <p className="text-sm text-gray-500 mb-4">{c.subheading}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item: any, i: number) => (
            <div key={i} className="rounded-lg border p-4">
              {item.icon && <div className="text-2xl mb-2">{item.icon}</div>}
              <p className="font-semibold text-sm">{item.title || item.name}</p>
              <p className="text-xs text-gray-500 mt-1">{item.description || item.quote}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (type === 'TESTIMONIALS') {
    const items = Array.isArray(c.items) ? c.items : []
    return (
      <div>
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-4">{c.heading}</h3>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item: any, i: number) => (
            <div key={i} className="rounded-lg border p-4">
              <p className="text-sm text-gray-600 italic">"{item.quote}"</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">{(item.name || '?').slice(0, 2).toUpperCase()}</div>
                <div><p className="text-xs font-medium">{item.name}</p><p className="text-[10px] text-gray-500">{item.role}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (type === 'PRICING') {
    const plans = Array.isArray(c.plans) ? c.plans : []
    return (
      <div>
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">{c.heading}</h3>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan: any, i: number) => (
            <div key={i} className={cn('rounded-lg border p-4', plan.highlighted && 'border-primary ring-2 ring-primary/20')}>
              <p className="font-bold text-sm">{plan.name}</p>
              <p className="text-2xl font-bold my-2">${plan.price}<span className="text-sm font-normal text-gray-500">/{plan.interval}</span></p>
              <ul className="space-y-1 text-xs text-gray-600 mb-3">
                {(plan.features || []).map((f: string, fi: number) => <li key={fi}>✓ {f}</li>)}
              </ul>
              <span className={cn('block rounded text-center py-1.5 text-xs font-medium', plan.highlighted ? 'bg-primary text-white' : 'border')}>{plan.cta}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (type === 'FAQ') {
    const items = Array.isArray(c.items) ? c.items : []
    return (
      <div>
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-4">{c.heading}</h3>}
        <div className="space-y-2">
          {items.map((item: any, i: number) => (
            <div key={i} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{item.question}</p>
              <p className="text-xs text-gray-500 mt-1">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (type === 'CTA') {
    return (
      <div className="text-center py-6 rounded-lg bg-gradient-to-br from-primary/10 to-card">
        <h3 className="text-xl font-bold mb-1">{c.headline || 'Ready?'}</h3>
        {c.subtext && <p className="text-sm text-gray-500 mb-3">{c.subtext}</p>}
        <span className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">{c.ctaText || 'Start now'}</span>
      </div>
    )
  }
  if (type === 'NEWSLETTER') {
    return (
      <div className="text-center py-6">
        <h3 className="text-xl font-bold mb-1">{c.heading || 'Subscribe'}</h3>
        {c.subtext && <p className="text-sm text-gray-500 mb-3">{c.subtext}</p>}
        <div className="flex justify-center gap-2 max-w-xs mx-auto">
          <input className="flex-1 rounded-lg border px-3 py-2 text-sm" placeholder={c.placeholder || 'you@email.com'} disabled />
          <span className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">{c.ctaText || 'Subscribe'}</span>
        </div>
      </div>
    )
  }
  if (type === 'VIDEO') {
    return (
      <div>
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-2">{c.heading}</h3>}
        {c.videoUrl ? (
          <div className="aspect-video rounded-lg bg-black flex items-center justify-center">
            <Video className="h-12 w-12 text-white/40" />
          </div>
        ) : <p className="text-sm text-gray-500">No video URL set</p>}
        {c.description && <p className="text-xs text-gray-500 mt-2">{c.description}</p>}
      </div>
    )
  }
  if (type === 'GALLERY') {
    const images = Array.isArray(c.images) ? c.images : []
    return (
      <div>
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-3">{c.heading}</h3>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {images.length > 0 ? images.map((img: any, i: number) => (
            <div key={i} className="aspect-square rounded-lg bg-muted flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground/40" /></div>
          )) : <p className="text-sm text-gray-500 col-span-full">No images</p>}
        </div>
      </div>
    )
  }
  if (type === 'COUNTDOWN') {
    return (
      <div className="text-center py-6 rounded-lg bg-amber-500/10">
        <h3 className="text-xl font-bold mb-2">{c.heading || 'Limited time'}</h3>
        {c.endDate && <p className="text-3xl font-bold tabular-nums mb-2">{c.endDate}</p>}
        <span className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">{c.ctaText || 'Get access'}</span>
      </div>
    )
  }
  if (type === 'FOOTER') {
    return (
      <div className="border-t pt-6">
        <p className="font-bold text-sm">{c.brand || 'Brand'}</p>
        <p className="text-xs text-gray-500 mt-1">{c.tagline || ''}</p>
      </div>
    )
  }
  return <p className="text-sm text-muted-foreground">{type} section</p>
}

// ===== SEO Editor =====
function SeoEditor({ initialTitle, initialDescription, onSave, saving }: { initialTitle: string; initialDescription: string; onSave: (title: string, description: string) => void; saving: boolean }) {
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">SEO Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title for search engines" />
        <p className="text-[10px] text-muted-foreground">{title.length}/60 characters</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Meta Description</Label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description for search results" />
        <p className="text-[10px] text-muted-foreground">{description.length}/160 characters</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-[10px] font-medium text-muted-foreground mb-1">Search Preview</p>
        <p className="text-sm text-primary truncate">{title || 'Page title'}</p>
        <p className="text-xs text-emerald-600 truncate">creatoros.io/your-page</p>
        <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{description || 'Meta description will appear here.'}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onSave(initialTitle, initialDescription)}>Cancel</Button>
        <Button onClick={() => onSave(title, description)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
          Save SEO
        </Button>
      </DialogFooter>
    </div>
  )
}

// ===== Prebuilt Templates =====
interface PageTemplate {
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  sections: Array<{ type: string; content: Record<string, unknown> }>
}

const TEMPLATES: PageTemplate[] = [
  {
    name: 'Course Landing',
    description: 'Hero, benefits, curriculum, testimonials, pricing, FAQ, CTA',
    icon: GraduationCap,
    sections: [
      { type: 'HERO', content: { headline: 'Master [Topic] in 30 Days', subheadline: 'The complete course to take you from beginner to expert', ctaText: 'Enroll Now', ctaSecondary: 'Watch Preview', emoji: '🎓' } },
      { type: 'BENEFITS', content: { heading: 'What you\'ll learn', subheading: 'Skills and knowledge you\'ll gain', items: [
        { title: 'Fundamentals', description: 'Master the core concepts and principles' },
        { title: 'Hands-on Projects', description: 'Build real-world projects as you learn' },
        { title: 'Industry Best Practices', description: 'Learn the techniques used by professionals' },
      ] } },
      { type: 'TESTIMONIALS', content: { heading: 'What students say', items: [
        { name: 'Sarah K.', role: 'Student', quote: 'This course changed my career. I went from zero to landing a job in 3 months.' },
        { name: 'Marcus T.', role: 'Freelancer', quote: 'The best investment I\'ve made. Clear, practical, and actionable.' },
      ] } },
      { type: 'PRICING', content: { heading: 'Choose your plan', plans: [
        { name: 'Self-Paced', price: 99, interval: 'one-time', features: ['Full course access', 'Downloadable resources', 'Community access'], cta: 'Get started', highlighted: false },
        { name: 'Premium', price: 199, interval: 'one-time', features: ['Everything in Self-Paced', '1-on-1 feedback', 'Certificate of completion', 'Lifetime updates'], cta: 'Get premium', highlighted: true },
      ] } },
      { type: 'FAQ', content: { heading: 'Frequently asked questions', items: [
        { question: 'How long do I have access?', answer: 'Lifetime access. Watch at your own pace.' },
        { question: 'Do I need experience?', answer: 'No, the course starts from the basics.' },
        { question: 'Is there a refund policy?', answer: 'Yes, 30-day money-back guarantee.' },
      ] } },
      { type: 'CTA', content: { headline: 'Ready to start learning?', subtext: 'Join 2,000+ students already enrolled', ctaText: 'Enroll Now' } },
    ],
  },
  {
    name: 'Product Launch',
    description: 'Hero, features, gallery, pricing, testimonials, FAQ, CTA',
    icon: Package,
    sections: [
      { type: 'HERO', content: { headline: 'The Ultimate [Product Name]', subheadline: 'Everything you need to [achieve goal]', ctaText: 'Buy Now', ctaSecondary: 'Learn More', emoji: '🚀' } },
      { type: 'FEATURES', content: { heading: 'What\'s included', subheading: 'Everything in the package', items: [
        { icon: '📥', title: 'Instant Download', description: 'Get immediate access after purchase' },
        { icon: '🔄', title: 'Free Updates', description: 'All future updates included free' },
        { icon: '💎', title: 'Premium Quality', description: 'Professionally designed and tested' },
      ] } },
      { type: 'GALLERY', content: { heading: 'See what\'s inside', images: [{ url: '' }, { url: '' }, { url: '' }, { url: '' }] } },
      { type: 'PRICING', content: { heading: 'Get it now', plans: [
        { name: 'Standard', price: 49, interval: 'one-time', features: ['Full product', 'Email support'], cta: 'Buy now', highlighted: false },
        { name: 'Bundle', price: 79, interval: 'one-time', features: ['Full product', 'Bonus templates', 'Priority support', 'Video tutorial'], cta: 'Get bundle', highlighted: true },
      ] } },
      { type: 'TESTIMONIALS', content: { heading: 'Loved by creators', items: [
        { name: 'Emma R.', role: 'Designer', quote: 'Exactly what I needed. Saved me hours of work.' },
        { name: 'Liam J.', role: 'Entrepreneur', quote: 'Worth every penny. The quality exceeded my expectations.' },
      ] } },
      { type: 'CTA', content: { headline: 'Ready to level up?', subtext: 'Instant download. 30-day guarantee.', ctaText: 'Buy Now' } },
    ],
  },
  {
    name: 'Webinar Registration',
    description: 'Hero, benefits, speaker info, countdown, FAQ, CTA',
    icon: Calendar,
    sections: [
      { type: 'HERO', content: { headline: 'Free Webinar: [Topic]', subheadline: 'Join us live on [Date] at [Time]', ctaText: 'Save My Seat', ctaSecondary: '', emoji: '🎯' } },
      { type: 'BENEFITS', content: { heading: 'What you\'ll learn', items: [
        { title: 'Strategy #1', description: 'The exact framework used by top creators' },
        { title: 'Live Q&A', description: 'Get your questions answered in real-time' },
        { title: 'Free Template', description: 'Download our exclusive worksheet' },
      ] } },
      { type: 'COUNTDOWN', content: { heading: 'Starts in', endDate: '2025-12-31T18:00:00', ctaText: 'Register Free' } },
      { type: 'FAQ', content: { heading: 'Questions?', items: [
        { question: 'Is it really free?', answer: 'Yes! 100% free to attend live.' },
        { question: 'Will there be a recording?', answer: 'Only for those who register. Sign up to get the replay.' },
      ] } },
      { type: 'CTA', content: { headline: 'Don\'t miss out!', subtext: 'Limited to 500 attendees', ctaText: 'Save My Seat' } },
    ],
  },
  {
    name: 'Membership Sales',
    description: 'Hero, benefits, pricing, testimonials, FAQ, newsletter',
    icon: CreditCard,
    sections: [
      { type: 'HERO', content: { headline: 'Join the [Community Name]', subheadline: 'Where [audience] connect, learn, and grow together', ctaText: 'Join Now', ctaSecondary: 'Take a Tour', emoji: '👥' } },
      { type: 'FEATURES', content: { heading: 'What\'s inside', items: [
        { icon: '💬', title: 'Private Community', description: 'Connect with like-minded creators' },
        { icon: '📚', title: 'Resource Library', description: 'Templates, guides, and tutorials' },
        { icon: '🎙️', title: 'Weekly Calls', description: 'Live coaching and Q&A sessions' },
        { icon: '🏆', title: 'Challenges', description: 'Monthly challenges with prizes' },
      ] } },
      { type: 'PRICING', content: { heading: 'Choose your membership', plans: [
        { name: 'Monthly', price: 29, interval: 'mo', features: ['Full community access', 'Weekly calls', 'Resource library'], cta: 'Join monthly', highlighted: false },
        { name: 'Annual', price: 290, interval: 'yr', features: ['Everything in Monthly', '2 months free', 'Priority support', 'Exclusive events'], cta: 'Join annually', highlighted: true },
        { name: 'Lifetime', price: 990, interval: 'once', features: ['Everything in Annual', 'Lifetime access', 'Founder badge'], cta: 'Get lifetime', highlighted: false },
      ] } },
      { type: 'TESTIMONIALS', content: { heading: 'Member stories', items: [
        { name: 'Priya P.', role: 'Member since 2024', quote: 'Best community I\'ve joined. The weekly calls alone are worth 10x the price.' },
        { name: 'Marcus L.', role: 'Member since 2023', quote: 'The connections I made here led to my first $10K month.' },
      ] } },
      { type: 'FAQ', content: { heading: 'Questions', items: [
        { question: 'Can I cancel anytime?', answer: 'Yes, cancel with one click. No questions asked.' },
        { question: 'Is there a trial?', answer: 'We offer a 7-day money-back guarantee on all plans.' },
      ] } },
      { type: 'NEWSLETTER', content: { heading: 'Not ready yet?', subtext: 'Join our free newsletter for weekly tips', placeholder: 'you@email.com', ctaText: 'Subscribe' } },
    ],
  },
  {
    name: 'About Page',
    description: 'Heading, text, features, gallery, CTA',
    icon: FileText,
    sections: [
      { type: 'HEADING', content: { text: 'About [Your Name]', alignment: 'center' } },
      { type: 'TEXT', content: { text: 'Hi! I\'m [Your Name], a [title] helping [audience] achieve [goal]. With over [X] years of experience, I\'ve helped [number] of people [outcome]. My mission is to [mission statement].' } },
      { type: 'FEATURES', content: { heading: 'My approach', items: [
        { icon: '🎯', title: 'Results-Driven', description: 'Focus on actionable strategies that work' },
        { icon: '❤️', title: 'Community First', description: 'Building genuine connections with every student' },
        { icon: '📈', title: 'Always Learning', description: 'Constantly updating my knowledge and courses' },
      ] } },
      { type: 'GALLERY', content: { heading: 'Behind the scenes', images: [{ url: '' }, { url: '' }, { url: '' }] } },
      { type: 'CTA', content: { headline: 'Let\'s work together', subtext: 'Check out my courses and community', ctaText: 'View Courses' } },
    ],
  },
  {
    name: 'Contact Page',
    description: 'Heading, text, newsletter, CTA, footer',
    icon: Mail,
    sections: [
      { type: 'HEADING', content: { text: 'Get in Touch', alignment: 'center' } },
      { type: 'TEXT', content: { text: 'Have a question? Want to collaborate? I\'d love to hear from you. Fill out the form below or reach me directly at hello@yoursite.com.' } },
      { type: 'NEWSLETTER', content: { heading: 'Join my newsletter', subtext: 'Weekly tips on [your topic]. No spam, ever.', placeholder: 'you@email.com', ctaText: 'Subscribe' } },
      { type: 'CTA', content: { headline: 'Ready to connect?', subtext: 'I typically respond within 24 hours', ctaText: 'Send Message' } },
      { type: 'FOOTER', content: { brand: 'Your Brand', tagline: 'Helping creators build profitable businesses.', links: [] } },
    ],
  },
]

function TemplatesPanel({ onApply, loading }: { onApply: (template: PageTemplate) => void; loading: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Start with a prebuilt template. You can customize every section after applying.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TEMPLATES.map((tpl) => {
          const Icon = tpl.icon
          return (
            <Card key={tpl.name} className="hover:shadow-md transition cursor-pointer" onClick={() => !loading && onApply(tpl)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Badge variant="secondary" className="text-[10px]">{tpl.sections.length} sections</Badge>
                    </div>
                  </div>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
        <strong>Note:</strong> Applying a template will replace all existing sections on this page.
      </div>
    </div>
  )
}

function AIChip({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading} className="rounded px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 transition disabled:opacity-50 flex items-center gap-1">
      {loading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}{label}
    </button>
  )
}

function getSectionPreview(s: Section): string {
  const c = s.content
  if (s.type === 'HERO') return String((c as { headline?: string }).headline || 'Headline')
  if (s.type === 'HEADING') return String((c as { text?: string }).text || 'Heading')
  if (s.type === 'TEXT') return String((c as { text?: string }).text || 'Paragraph').slice(0, 60)
  if (s.type === 'CTA') return String((c as { headline?: string }).headline || 'CTA')
  if (s.type === 'FEATURES' || s.type === 'BENEFITS' || s.type === 'TESTIMONIALS' || s.type === 'FAQ') return String((c as { heading?: string }).heading || s.type)
  if (s.type === 'PRICING') return String((c as { heading?: string }).heading || 'Pricing')
  return s.type
}

// ===== Right-side section settings panel =====
function SectionSettingsPanel({ section, onUpdate, saving, onSaveAndPreview }: { section: Section; onUpdate: (c: Record<string, unknown>) => void; saving: boolean; onSaveAndPreview: () => void }) {
  const meta = SECTION_TYPES.find((t) => t.type === section.type)
  const Icon = meta?.icon || Layout
  const c = section.content
  const set = (k: string, v: unknown) => onUpdate({ ...c, [k]: v })

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{meta?.name} settings</CardTitle>
        <Badge variant="secondary" className="text-[10px]">Section {section.position + 1}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto scroll-thin">
        <SectionFields type={section.type} content={c} set={set} />
      </CardContent>
      <div className="border-t p-3 flex items-center gap-2">
        {saving ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 flex-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving changes...
          </span>
        ) : (
          <span className="text-xs text-emerald-600 flex items-center gap-1.5 flex-1">
            <Check className="h-3 w-3" /> Auto-saved
          </span>
        )}
        <Button size="sm" variant="outline" onClick={onSaveAndPreview} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
          Save & Preview
        </Button>
      </div>
    </Card>
  )
}

function Field({ k, label, textarea, content, set }: { k: string; label: string; textarea?: boolean; content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {textarea ? <Textarea className="mt-1 text-sm" rows={3} value={String(content[k] ?? '')} onChange={(e) => set(k, e.target.value)} /> : <Input className="mt-1 h-8 text-sm" value={String(content[k] ?? '')} onChange={(e) => set(k, e.target.value)} />}
    </div>
  )
}

function SectionFields({ type, content, set }: { type: string; content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  if (type === 'HERO') return <><Field k="emoji" label="Emoji" content={content} set={set} /><Field k="headline" label="Headline" content={content} set={set} /><Field k="subheadline" label="Subheadline" textarea content={content} set={set} /><Field k="ctaText" label="Primary CTA" content={content} set={set} /><Field k="ctaSecondary" label="Secondary CTA" content={content} set={set} /></>
  if (type === 'HEADING') return <><Field k="text" label="Heading text" content={content} set={set} /><div><Label className="text-xs">Alignment</Label><Select value={String(content.alignment || 'center')} onValueChange={(v) => set('alignment', v)}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></div></>
  if (type === 'TEXT') return <><Field k="text" label="Paragraph" textarea content={content} set={set} /></>
  if (type === 'CTA') return <><Field k="headline" label="Headline" content={content} set={set} /><Field k="subtext" label="Subtext" textarea content={content} set={set} /><Field k="ctaText" label="Button text" content={content} set={set} /></>
  if (type === 'NEWSLETTER') return <><Field k="heading" label="Heading" content={content} set={set} /><Field k="subtext" label="Subtext" content={content} set={set} /><Field k="placeholder" label="Input placeholder" content={content} set={set} /><Field k="ctaText" label="Button text" content={content} set={set} /></>
  if (type === 'VIDEO') return <><Field k="heading" label="Heading" content={content} set={set} /><Field k="videoUrl" label="Video URL" content={content} set={set} /><Field k="description" label="Description" textarea content={content} set={set} /></>
  if (type === 'COUNTDOWN') return <><Field k="heading" label="Heading" content={content} set={set} /><Field k="endDate" label="End date (ISO)" content={content} set={set} /><Field k="ctaText" label="CTA text" content={content} set={set} /></>
  if (type === 'FOOTER') return <><Field k="brand" label="Brand name" content={content} set={set} /><Field k="tagline" label="Tagline" content={content} set={set} /></>
  if (type === 'FEATURES' || type === 'BENEFITS') {
    const items = (content.items as { icon?: string; title?: string; description?: string }[]) || []
    return <><Field k="heading" label="Heading" content={content} set={set} />{type === 'FEATURES' && <Field k="subheading" label="Subheading" content={content} set={set} />}
      <div><Label className="text-xs">Items</Label>
        <div className="space-y-2 mt-1">{items.map((it, i) => (
          <div key={i} className="rounded-lg border p-2 space-y-1.5">
            {type === 'FEATURES' && <Input className="h-7 text-sm" placeholder="Icon (emoji)" value={it.icon || ''} onChange={(e) => { const n = [...items]; n[i] = { ...it, icon: e.target.value }; set('items', n) }} />}
            <Input className="h-7 text-sm" placeholder="Title" value={it.title || ''} onChange={(e) => { const n = [...items]; n[i] = { ...it, title: e.target.value }; set('items', n) }} />
            <Textarea className="text-sm" rows={2} placeholder="Description" value={it.description || ''} onChange={(e) => { const n = [...items]; n[i] = { ...it, description: e.target.value }; set('items', n) }} />
          </div>
        ))}<Button size="sm" variant="outline" className="mt-1" onClick={() => set('items', [...items, { icon: '✨', title: '', description: '' }])}><Plus className="h-3 w-3 mr-1" />Add item</Button></div>
      </div></>
  }
  if (type === 'PRICING') {
    const plans = (content.plans as { name?: string; price?: number; interval?: string; features?: string[]; cta?: string; highlighted?: boolean }[]) || []
    return <><Field k="heading" label="Heading" content={content} set={set} />
      <div><Label className="text-xs">Plans</Label>
        <div className="space-y-2 mt-1">{plans.map((p, i) => (
          <div key={i} className="rounded-lg border p-2 space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              <Input className="h-7 text-sm" placeholder="Name" value={p.name || ''} onChange={(e) => { const n = [...plans]; n[i] = { ...p, name: e.target.value }; set('plans', n) }} />
              <Input type="number" className="h-7 text-sm" placeholder="$" value={p.price ?? 0} onChange={(e) => { const n = [...plans]; n[i] = { ...p, price: Number(e.target.value) }; set('plans', n) }} />
              <Input className="h-7 text-sm" placeholder="/mo" value={p.interval || ''} onChange={(e) => { const n = [...plans]; n[i] = { ...p, interval: e.target.value }; set('plans', n) }} />
            </div>
            <Input className="h-7 text-sm" placeholder="CTA" value={p.cta || ''} onChange={(e) => { const n = [...plans]; n[i] = { ...p, cta: e.target.value }; set('plans', n) }} />
            <Textarea className="text-sm" rows={2} placeholder="Features (one per line)" value={(p.features || []).join('\n')} onChange={(e) => { const n = [...plans]; n[i] = { ...p, features: e.target.value.split('\n') }; set('plans', n) }} />
          </div>
        ))}</div>
      </div></>
  }
  if (type === 'TESTIMONIALS' || type === 'FAQ') {
    const items = content.items as Record<string, string>[]
    const key1 = type === 'TESTIMONIALS' ? 'quote' : 'question'
    const key2 = type === 'TESTIMONIALS' ? 'name' : 'answer'
    const key3 = type === 'TESTIMONIALS' ? 'role' : ''
    return <><Field k="heading" label="Heading" content={content} set={set} />
      <div><Label className="text-xs">Items</Label>
        <div className="space-y-2 mt-1">{items?.map((it, i) => (
          <div key={i} className="rounded-lg border p-2 space-y-1.5">
            <Textarea className="text-sm" rows={2} placeholder={key1} value={it[key1] || ''} onChange={(e) => { const n = [...items]; n[i] = { ...it, [key1]: e.target.value }; set('items', n) }} />
            {key3 ? <div className="grid grid-cols-2 gap-1.5"><Input className="h-7 text-sm" placeholder="Name" value={it[key2] || ''} onChange={(e) => { const n = [...items]; n[i] = { ...it, [key2]: e.target.value }; set('items', n) }} /><Input className="h-7 text-sm" placeholder="Role" value={it[key3] || ''} onChange={(e) => { const n = [...items]; n[i] = { ...it, [key3]: e.target.value }; set('items', n) }} /></div>
              : <Input className="h-7 text-sm" placeholder="Answer" value={it[key2] || ''} onChange={(e) => { const n = [...items]; n[i] = { ...it, [key2]: e.target.value }; set('items', n) }} />}
          </div>
        ))}<Button size="sm" variant="outline" className="mt-1" onClick={() => set('items', [...(items || []), { [key1]: '', [key2]: '', ...(key3 ? { [key3]: '' } : {}) }])}><Plus className="h-3 w-3 mr-1" />Add item</Button></div>
      </div></>
  }
  return <p className="text-xs text-muted-foreground">No editable fields for this section type.</p>
}

// ===== Navigation panel =====
function NavigationPanel() {
  return (
    <Card><CardContent className="p-5 space-y-4">
      <div><p className="text-sm font-semibold mb-1">Header Navigation</p><p className="text-xs text-muted-foreground mb-3">Menu items shown in your site header.</p>
        <div className="space-y-2">{[{ label: 'Home', url: '/' }, { label: 'Courses', url: '/courses' }, { label: 'Pricing', url: '/pricing' }, { label: 'Blog', url: '/blog' }].map((n, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border p-2"><GripVertical className="h-4 w-4 text-muted-foreground" /><Input className="h-8 text-sm flex-1" defaultValue={n.label} /><Input className="h-8 text-sm flex-1 font-mono" defaultValue={n.url} /><Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500"><Trash2 className="h-3.5 w-3.5" /></Button></div>
        ))}<Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1.5" />Add menu item</Button></div>
      </div>
      <div className="border-t pt-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium">Show login button</p><p className="text-xs text-muted-foreground">Display a "Log in" link in the header.</p></div><Switch defaultChecked /></div></div>
      <div className="border-t pt-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium">Announcement bar</p><p className="text-xs text-muted-foreground">Promotional bar at the top of your site.</p></div><Switch defaultChecked /></div><Input className="mt-2 h-8 text-sm" defaultValue="🎉 Black Friday: 50% off all annual plans!" /></div>
      <Button size="sm" onClick={() => toast.success('Navigation saved')}><Save className="h-3.5 w-3.5 mr-1.5" />Save navigation</Button>
    </CardContent></Card>
  )
}

// ===== Blog panel =====
function BlogPanel() {
  const { data, loading, refetch } = useApi<{ posts: BlogPost[]; stats: { total: number; published: number; drafts: number; totalVisits: number } }>('/api/data/blog')
  const [editing, setEditing] = useState<BlogPost | 'new' | null>(null)

  if (loading || !data) return <Skeleton className="h-96 rounded-xl" />

  if (editing) {
    return <BlogEditor post={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch() }} />
  }

  const STATUS_CLS: Record<string, string> = { PUBLISHED: 'bg-emerald-500/10 text-emerald-600', DRAFT: 'bg-amber-500/10 text-amber-600' }

  const deletePost = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/data/blog?id=${id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      toast.success('Post deleted', { description: `"${title}" has been removed.` })
      refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Posts', v: data.stats.total, i: BookOpen }, { l: 'Published', v: data.stats.published, i: Check }, { l: 'Drafts', v: data.stats.drafts, i: Pencil }, { l: 'Visits', v: formatNumber(data.stats.totalVisits, true), i: Eye }].map((s) => { const Icon = s.i; return (
          <Card key={s.l}><CardContent className="p-4 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div><div><p className="text-lg font-bold tabular-nums leading-none">{s.v}</p><p className="text-xs text-muted-foreground mt-1">{s.l}</p></div></CardContent></Card>
        )})}
      </div>
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Blog Posts</h3><Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4 mr-1.5" />New Post</Button></div>
      <Card><CardContent className="p-0">{data.posts.length === 0 ? (
        <div className="p-12 text-center"><BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm font-medium">No blog posts yet</p><p className="text-xs text-muted-foreground mt-1">Create your first post to start publishing.</p><Button size="sm" className="mt-3" onClick={() => setEditing('new')}><Plus className="h-4 w-4 mr-1.5" />New Post</Button></div>
      ) : data.posts.map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50 transition">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 shrink-0"><BookOpen className="h-5 w-5" /></div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(p)}><p className="text-sm font-medium truncate">{p.title}</p><p className="text-xs text-muted-foreground truncate">{p.excerpt}</p><div className="flex items-center gap-2 mt-0.5"><Badge variant="secondary" className="text-xs">{p.category}</Badge>{p.tags.slice(0, 2).map((t) => <Badge key={t} variant="secondary" className="text-xs bg-muted">#{t}</Badge>)}</div></div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground"><div className="text-right"><p className="font-medium text-foreground tabular-nums">{formatNumber(p.visits, true)}</p><p>visits</p></div></div>
          <Badge variant="secondary" className={cn('text-xs', STATUS_CLS[p.status])}>{p.status}</Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">{timeAgo(p.publishedAt || p.createdAt)}</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600" onClick={() => deletePost(p.id, p.title)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </motion.div>
      ))}</CardContent></Card>
    </div>
  )
}

interface BlogPost {
  id: string; title: string; slug: string; excerpt: string; content: string;
  category: string; tags: string[]; author: string; status: string;
  coverUrl: string | null; visits: number; publishedAt: string | null; createdAt: string;
}

function BlogEditor({ post, onClose, onSaved }: { post: BlogPost | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(post?.title || '')
  const [slug, setSlug] = useState(post?.slug || '')
  const [excerpt, setExcerpt] = useState(post?.excerpt || '')
  const [content, setContent] = useState(post?.content || '')
  const [category, setCategory] = useState(post?.category || 'General')
  const [tags, setTags] = useState((post?.tags || []).join(', '))
  const [status, setStatus] = useState(post?.status || 'DRAFT')
  const [coverUrl, setCoverUrl] = useState(post?.coverUrl || '')
  const [saving, setSaving] = useState(false)

  const save = async (publishNow?: boolean) => {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const finalStatus = publishNow ? 'PUBLISHED' : status
    try {
      const body = {
        ...(post ? { id: post.id } : {}),
        title: title.trim(),
        slug: slug.trim() || undefined,
        excerpt, content, category,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        status: finalStatus,
        coverUrl: coverUrl || null,
      }
      const res = await fetch('/api/data/blog', {
        method: post ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      toast.success(post ? 'Post updated' : 'Post created', { description: `"${title}" has been ${finalStatus === 'PUBLISHED' ? 'published' : 'saved as draft'}.` })
      onSaved()
    } catch (e) {
      toast.error('Failed to save', { description: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4 mr-1.5" />Back to blog</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => save(false)} disabled={saving}><Save className="h-4 w-4 mr-1.5" />{saving ? 'Saving...' : 'Save Draft'}</Button>
          <Button size="sm" onClick={() => save(true)} disabled={saving}><Send className="h-4 w-4 mr-1.5" />Publish</Button>
        </div>
      </div>
      <Card><CardContent className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Title <span className="text-destructive">*</span></Label>
          <Input className="text-lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter post title..." />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Slug</Label>
            <Input className="font-mono text-sm" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated-from-title" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Marketing" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Excerpt</Label>
          <Textarea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Short summary for SEO and previews..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Content (Markdown)</Label>
          <Textarea rows={12} className="font-mono text-sm" value={content} onChange={(e) => setContent(e.target.value)} placeholder="# Heading

Write your post content here. Markdown is supported." />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="marketing, tutorial, ai" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Featured Image URL</Label>
            <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
      </CardContent></Card>
    </div>
  )
}

// ===== Domains panel =====
function DomainsPanel() {
  return (
    <div className="space-y-4">
      <Card className="border-emerald-500/20 bg-emerald-500/5"><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600"><Check className="h-5 w-5" /></div><div className="flex-1"><p className="text-sm font-medium">creatoros.io</p><p className="text-xs text-muted-foreground">Primary domain · SSL active · Auto-renewing</p></div><Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Connected</Badge></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4 text-primary" />Connect a custom domain</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Domain name</Label><Input className="mt-1.5" placeholder="yourbrand.com" /><p className="text-[10px] text-muted-foreground mt-1">We'll automatically provision SSL and configure DNS for you.</p></div>
          <Button size="sm" onClick={() => toast.success('Domain connection started', { description: 'DNS verification may take 10-30 minutes.' })}><Server className="h-3.5 w-3.5 mr-1.5" />Connect domain</Button>
        </CardContent>
      </Card>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Redirects</CardTitle></CardHeader><CardContent className="space-y-2"><div className="flex items-center gap-2"><Input className="h-8 text-xs font-mono" defaultValue="/old-page" /><ArrowRight /><Input className="h-8 text-xs font-mono" defaultValue="/new-page" /></div><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Add redirect</Button></CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Subdomains</CardTitle></CardHeader><CardContent className="space-y-2"><div className="flex items-center justify-between rounded-lg border p-2"><span className="text-xs font-mono">app.creatoros.io</span><Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">Active</Badge></div><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Add subdomain</Button></CardContent></Card>
      </div>
    </div>
  )
}

function ArrowRight() { return <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rotate-[-90deg]" /> }

// ===== SEO panel =====
function SeoPanel() {
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><SearchIcon className="h-4 w-4 text-primary" />Global SEO Settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Default meta title</Label><Input className="mt-1.5 text-sm" defaultValue="CreatorOS — The All-in-One Platform for Creators" /></div>
          <div><Label>Default meta description</Label><Textarea className="mt-1.5 text-sm" rows={2} defaultValue="Sell courses, products, and memberships. Build a community. Create content 10x faster with AI." /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Twitter card type</Label><Select defaultValue="summary_large_image"><SelectTrigger className="mt-1.5 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="summary">Summary</SelectItem><SelectItem value="summary_large_image">Summary with large image</SelectItem></SelectContent></Select></div>
            <div><Label>Robots</Label><Input className="mt-1.5 text-sm font-mono" defaultValue="index, follow" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 pt-2"><div className="rounded-lg border p-3"><p className="text-xs font-medium">Sitemap</p><p className="text-[10px] text-muted-foreground mt-0.5">creatoros.io/sitemap.xml</p><Badge variant="secondary" className="mt-1.5 text-[10px] bg-emerald-500/10 text-emerald-600">Auto-generated</Badge></div><div className="rounded-lg border p-3"><p className="text-xs font-medium">robots.txt</p><p className="text-[10px] text-muted-foreground mt-0.5">creatoros.io/robots.txt</p><Badge variant="secondary" className="mt-1.5 text-[10px] bg-emerald-500/10 text-emerald-600">Auto-generated</Badge></div></div>
          <Button size="sm" onClick={() => toast.success('SEO settings saved')}><Save className="h-3.5 w-3.5 mr-1.5" />Save SEO settings</Button>
        </CardContent>
      </Card>
      <Card className="border-primary/20 bg-primary/5"><CardContent className="p-4 flex items-center gap-3"><Sparkles className="h-5 w-5 text-primary" /><div className="flex-1"><p className="text-sm font-medium">AI SEO Optimization</p><p className="text-xs text-muted-foreground">Let AI analyze your pages and suggest SEO improvements.</p></div><Button size="sm" variant="outline" onClick={() => toast.info('Analyzing pages...', { description: 'AI will suggest title, description, and keyword improvements.' })}><Wand2 className="h-3.5 w-3.5 mr-1.5" />Run analysis</Button></CardContent></Card>
    </div>
  )
}

// ===== Site Settings panel =====
function SiteSettingsPanel() {
  const { data, loading, refetch } = useApi<{ settings: { id: string; key: string; value: unknown; category: string }[] }>('/api/data/site-settings')
  const [edits, setEdits] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState<string | null>(null)
  if (loading || !data) return <Skeleton className="h-96 rounded-xl" />

  const byCat = (cat: string) => data.settings.filter((s) => s.category === cat)
  const getVal = (k: string) => edits[k] !== undefined ? edits[k] : data.settings.find((s) => s.key === k)?.value
  const setVal = (k: string, v: unknown) => setEdits((e) => ({ ...e, [k]: v }))
  const save = async (id: string, key: string) => { setSaving(key); try { await fetch('/api/data/site-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, value: edits[key] }) }); toast.success(`${key} saved`); setEdits((e) => { const n = { ...e }; delete n[key]; return n }); refetch() } catch { toast.error('Failed') } finally { setSaving(null) } }

  return (
    <div className="space-y-4">
      {/* Brand */}
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" />Brand</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Brand name</Label><Input className="mt-1 h-8 text-sm" value={String(getVal('brand_name') ?? '')} onChange={(e) => setVal('brand_name', e.target.value)} /></div>
          <div><Label className="text-xs">Primary color</Label><div className="flex gap-2 mt-1"><Input className="h-8 text-sm font-mono" value={String(getVal('brand_primary_color') ?? '')} onChange={(e) => setVal('brand_primary_color', e.target.value)} /><div className="h-8 w-8 rounded border" style={{ background: String(getVal('brand_primary_color') ?? '#10b981') }} /></div></div>
        </div>
        <div><Label className="text-xs">Font family</Label><Select value={String(getVal('brand_font') ?? 'Inter')} onValueChange={(v) => setVal('brand_font', v)}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{['Inter', 'Geist', 'Poppins', 'DM Sans', 'Plus Jakarta Sans'].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
        <SaveRow saving={saving === 'brand_name'} onSave={() => save(byCat('brand').find((s) => s.key === 'brand_name')?.id || '', 'brand_name')} />
      </CardContent></Card>

      {/* Announcement bar */}
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Announcement Bar</CardTitle></CardHeader><CardContent className="space-y-2">
        <div className="flex items-center justify-between"><span className="text-xs">Enabled</span><Switch defaultChecked /></div>
        <div><Label className="text-xs">Message</Label><Input className="mt-1 h-8 text-sm" defaultValue="🎉 Black Friday: 50% off all annual plans!" /></div>
        <Button size="sm" onClick={() => toast.success('Announcement bar saved')}><Save className="h-3.5 w-3.5 mr-1.5" />Save</Button>
      </CardContent></Card>

      {/* Analytics */}
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Analytics & Scripts</CardTitle></CardHeader><CardContent className="space-y-3">
        <div><Label className="text-xs">Google Analytics ID</Label><Input className="mt-1 h-8 text-sm font-mono" defaultValue="G-XXXXXXXXXX" /></div>
        <div><Label className="text-xs">Meta Pixel ID</Label><Input className="mt-1 h-8 text-sm font-mono" defaultValue="" placeholder="(optional)" /></div>
        <div><Label className="text-xs">Custom scripts (head)</Label><Textarea className="mt-1 text-xs font-mono" rows={3} placeholder="<script>...</script>" /></div>
        <Button size="sm" onClick={() => toast.success('Analytics settings saved')}><Save className="h-3.5 w-3.5 mr-1.5" />Save</Button>
      </CardContent></Card>
    </div>
  )
}

function SaveRow({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return <Button size="sm" onClick={onSave} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}Save</Button>
}
