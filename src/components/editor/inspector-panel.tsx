'use client'
import { useState } from 'react'
import {
  Type, Palette, Search, Settings2, Sparkles, Loader2, Check, Pencil,
  ChevronDown, ChevronRight, PenLine, Wand2, Layout, Zap,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ============================================================================
// InspectorPanel — Right sidebar with Content / Style / SEO / Settings tabs
// ============================================================================

export interface InspectorSection {
  id: string
  type: string
  content: Record<string, unknown>
  position: number
}

export interface InspectorPanelProps {
  section: InspectorSection | null
  onUpdate: (content: Record<string, unknown>) => void
  saving: boolean
  lastSavedAt: Date | null
  onAIAction: (action: string) => void
  aiLoading: string | null
  renderContentFields: (content: Record<string, unknown>, set: (k: string, v: unknown) => void) => React.ReactNode
}

export function InspectorPanel({
  section, onUpdate, saving, lastSavedAt, onAIAction, aiLoading, renderContentFields,
}: InspectorPanelProps) {
  const [tab, setTab] = useState<'content' | 'style' | 'seo' | 'settings'>('content')

  if (!section) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2.5 border-b">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspector</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Pencil className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium">No section selected</p>
            <p className="text-xs text-muted-foreground mt-1">Click a section in the canvas or navigator to edit.</p>
          </div>
        </div>
      </div>
    )
  }

  const c = section.content
  const set = (k: string, v: unknown) => onUpdate({ ...c, [k]: v })

  // Time-ago for save indicator
  const savedLabel = saving ? 'Saving...' : lastSavedAt ? `Saved · ${timeAgoShort(lastSavedAt)}` : 'Auto-saved'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspector</p>
        <p className="text-sm font-medium mt-0.5">{section.type}</p>
        <div className="flex items-center gap-2 mt-1">
          {saving ? (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving...
            </span>
          ) : (
            <span className="text-[10px] text-emerald-600 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" /> {savedLabel}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <div className="px-2 pt-2 shrink-0">
          <TabsList className="grid grid-cols-4 w-full h-auto">
            <TabsTrigger value="content" className="text-[10px] py-1.5"><Type className="h-3 w-3 mr-0.5" />Content</TabsTrigger>
            <TabsTrigger value="style" className="text-[10px] py-1.5"><Palette className="h-3 w-3 mr-0.5" />Style</TabsTrigger>
            <TabsTrigger value="seo" className="text-[10px] py-1.5"><Search className="h-3 w-3 mr-0.5" />SEO</TabsTrigger>
            <TabsTrigger value="settings" className="text-[10px] py-1.5"><Settings2 className="h-3 w-3 mr-0.5" />Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="content" className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scroll-thin mt-0">
          {renderContentFields(c, set)}
        </TabsContent>

        <TabsContent value="style" className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scroll-thin mt-0">
          <CollapsibleGroup label="Layout" icon={Layout} defaultOpen>
            <StyleLayoutControls content={c} set={set} />
          </CollapsibleGroup>
          <CollapsibleGroup label="Appearance" icon={Palette} defaultOpen>
            <StyleAppearanceControls content={c} set={set} />
          </CollapsibleGroup>
          <CollapsibleGroup label="Animation" icon={Zap}>
            <StyleAnimationControls content={c} set={set} />
          </CollapsibleGroup>
        </TabsContent>

        <TabsContent value="seo" className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scroll-thin mt-0">
          <CollapsibleGroup label="Meta Tags" icon={Search} defaultOpen>
            <SeoMetaControls content={c} set={set} />
          </CollapsibleGroup>
          <CollapsibleGroup label="Structured Data" icon={Type}>
            <SeoSchemaControls content={c} set={set} />
          </CollapsibleGroup>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scroll-thin mt-0">
          <CollapsibleGroup label="Section Settings" icon={Settings2} defaultOpen>
            <SettingsControls content={c} set={set} />
          </CollapsibleGroup>
        </TabsContent>
      </Tabs>

      {/* AI panel — grouped cards at bottom */}
      <div className="border-t shrink-0 max-h-[40vh] overflow-y-auto scroll-thin">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" /> AI Assistant
          </p>

          {/* Writing group */}
          <AICard label="Writing" icon={PenLine}>
            <div className="grid grid-cols-2 gap-1">
              <AIBtn label="Rewrite" action="REWRITE" onAction={onAIAction} loading={aiLoading === 'REWRITE'} />
              <AIBtn label="Improve" action="IMPROVE" onAction={onAIAction} loading={aiLoading === 'IMPROVE'} />
              <AIBtn label="SEO" action="SEO" onAction={onAIAction} loading={aiLoading === 'SEO'} />
              <AIBtn label="Translate" action="TRANSLATE" onAction={onAIAction} loading={aiLoading === 'TRANSLATE'} />
            </div>
          </AICard>

          {/* Style group */}
          <AICard label="Style" icon={Wand2}>
            <div className="grid grid-cols-2 gap-1">
              <AIBtn label="Professional" action="PROFESSIONAL" onAction={onAIAction} loading={aiLoading === 'PROFESSIONAL'} />
              <AIBtn label="Luxury" action="LUXURY" onAction={onAIAction} loading={aiLoading === 'LUXURY'} />
              <AIBtn label="Startup" action="STARTUP" onAction={onAIAction} loading={aiLoading === 'STARTUP'} />
              <AIBtn label="Friendly" action="EMOTIONAL" onAction={onAIAction} loading={aiLoading === 'EMOTIONAL'} />
            </div>
          </AICard>

          {/* Content group */}
          <AICard label="Content" icon={Type}>
            <div className="grid grid-cols-2 gap-1">
              <AIBtn label="Shorten" action="SHORTEN" onAction={onAIAction} loading={aiLoading === 'SHORTEN'} />
              <AIBtn label="Expand" action="EXPAND" onAction={onAIAction} loading={aiLoading === 'EXPAND'} />
            </div>
          </AICard>
        </div>
      </div>
    </div>
  )
}

// ─── Collapsible Group (Figma-style) ─────────────────────────────────────────

function CollapsibleGroup({ label, icon: Icon, defaultOpen = false, children }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b pb-2 mb-2 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground transition"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Icon className="h-3 w-3" />
        {label}
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </div>
  )
}

// ─── AI Card ─────────────────────────────────────────────────────────────────

function AICard({ label, icon: Icon, children }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="mb-2.5 last:mb-0">
      <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
        <Icon className="h-2.5 w-2.5" /> {label}
      </p>
      {children}
    </div>
  )
}

function AIBtn({ label, action, onAction, loading }: { label: string; action: string; onAction: (a: string) => void; loading: boolean }) {
  return (
    <button
      onClick={() => onAction(action)}
      disabled={loading}
      className="flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/10 transition disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {label}
    </button>
  )
}

// ─── Style: Layout Controls ──────────────────────────────────────────────────

function StyleLayoutControls({ content, set }: { content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const spacing = (content.spacing as Record<string, unknown> | undefined) || {}
  const alignment = (content.alignment as string | undefined) || 'center'

  return (
    <>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Padding (vertical)</Label>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {['sm', 'md', 'lg', 'xl'].map((p) => (
            <button key={p} onClick={() => set('spacing', { ...spacing, paddingY: p })}
              className={cn('rounded-md border px-1 py-1.5 text-[10px] font-medium uppercase transition',
                spacing.paddingY === p ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Alignment</Label>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {['left', 'center', 'right'].map((a) => (
            <button key={a} onClick={() => set('alignment', a)}
              className={cn('rounded-md border px-1 py-1.5 text-[10px] font-medium capitalize transition',
                alignment === a ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
              {a}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Style: Appearance Controls ──────────────────────────────────────────────

function StyleAppearanceControls({ content, set }: { content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const bg = (content.background as Record<string, unknown> | undefined) || {}
  const borderRadius = (content.borderRadius as string | undefined) || 'md'

  return (
    <>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Background</Label>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {['none', 'color', 'gradient', 'image'].map((bgType) => (
            <button key={bgType} onClick={() => set('background', { ...bg, type: bgType })}
              className={cn('rounded-md border px-1 py-1.5 text-[10px] font-medium capitalize transition',
                bg.type === bgType ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
              {bgType}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Border Radius</Label>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {['none', 'sm', 'md', 'lg'].map((r) => (
            <button key={r} onClick={() => set('borderRadius', r)}
              className={cn('rounded-md border px-1 py-1.5 text-[10px] font-medium capitalize transition',
                borderRadius === r ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Device Visibility</Label>
        <div className="mt-2 space-y-2">
          {['desktop', 'tablet', 'mobile'].map((device) => {
            const visibility = (content.visibility as Record<string, boolean> | undefined) || { desktop: true, tablet: true, mobile: true }
            return (
              <div key={device} className="flex items-center justify-between">
                <span className="text-xs capitalize">{device}</span>
                <Switch checked={visibility[device] !== false} onCheckedChange={(checked) => set('visibility', { ...visibility, [device]: checked })} />
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── Style: Animation Controls ───────────────────────────────────────────────

function StyleAnimationControls({ content, set }: { content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const animation = (content.animation as string | undefined) || 'none'
  return (
    <div>
      <Label className="text-xs font-medium uppercase text-muted-foreground">Entrance Animation</Label>
      <select value={animation} onChange={(e) => set('animation', e.target.value)}
        className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm">
        <option value="none">None</option>
        <option value="fade-in">Fade In</option>
        <option value="fade-in-up">Fade In Up</option>
        <option value="slide-in">Slide In</option>
        <option value="zoom-in">Zoom In</option>
      </select>
    </div>
  )
}

// ─── SEO: Meta Controls ──────────────────────────────────────────────────────

function SeoMetaControls({ content, set }: { content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const seoTitle = (content.seoTitle as string | undefined) || ''
  const seoDescription = (content.seoDescription as string | undefined) || ''
  const keywords = (content.seoKeywords as string | undefined) || ''
  const ogImage = (content.ogImage as string | undefined) || ''

  return (
    <>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">SEO Title</Label>
        <Input className="mt-1.5 h-8 text-sm" value={seoTitle} onChange={(e) => set('seoTitle', e.target.value)} placeholder="Auto from heading" />
      </div>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Meta Description</Label>
        <Textarea className="mt-1.5 text-sm" rows={2} value={seoDescription} onChange={(e) => set('seoDescription', e.target.value)} placeholder="Brief description for search results" />
        <p className="text-[10px] text-muted-foreground mt-0.5">{seoDescription.length}/160 characters</p>
      </div>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Keywords</Label>
        <Input className="mt-1.5 h-8 text-sm" value={keywords} onChange={(e) => set('seoKeywords', e.target.value)} placeholder="comma, separated, keywords" />
      </div>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">OG Image URL</Label>
        <Input className="mt-1.5 h-8 text-sm" value={ogImage} onChange={(e) => set('ogImage', e.target.value)} placeholder="/api/media/og.jpg" />
      </div>
    </>
  )
}

// ─── SEO: Schema Controls ────────────────────────────────────────────────────

function SeoSchemaControls({ content, set }: { content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const headingTag = (content.headingTag as string | undefined) || 'h2'
  const schemaType = (content.schemaType as string | undefined) || 'none'

  return (
    <>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Heading Tag</Label>
        <select value={headingTag} onChange={(e) => set('headingTag', e.target.value)}
          className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm">
          <option value="h1">H1 (main heading — hero only)</option>
          <option value="h2">H2 (section heading)</option>
          <option value="h3">H3 (subsection)</option>
          <option value="h4">H4 (minor heading)</option>
        </select>
      </div>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Schema Type</Label>
        <select value={schemaType} onChange={(e) => set('schemaType', e.target.value)}
          className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm">
          <option value="none">None</option>
          <option value="Course">Course</option>
          <option value="Product">Product</option>
          <option value="Article">Article</option>
          <option value="FAQ">FAQ</option>
          <option value="Organization">Organization</option>
        </select>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 text-xs">
        <p className="font-medium text-muted-foreground mb-1">SEO Tips</p>
        <ul className="space-y-1 text-muted-foreground">
          <li>• Use H1 only for the hero section</li>
          <li>• Use H2 for major sections (Pricing, FAQ)</li>
          <li>• Add FAQ schema to FAQ sections</li>
          <li>• Add Product schema to pricing sections</li>
        </ul>
      </div>
    </>
  )
}

// ─── Settings Controls ───────────────────────────────────────────────────────

function SettingsControls({ content, set }: { content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const anchorId = (content.anchorId as string | undefined) || ''
  const customCssClass = (content.customCssClass as string | undefined) || ''
  const scheduleStart = (content.scheduleStart as string | undefined) || ''
  const scheduleEnd = (content.scheduleEnd as string | undefined) || ''
  const trackingId = (content.trackingId as string | undefined) || ''

  return (
    <>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Anchor ID</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">For deep links: /page#your-id</p>
        <Input className="mt-1.5 h-8 text-sm font-mono" value={anchorId} onChange={(e) => set('anchorId', e.target.value)} placeholder="pricing-section" />
      </div>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Custom CSS Class</Label>
        <Input className="mt-1.5 h-8 text-sm font-mono" value={customCssClass} onChange={(e) => set('customCssClass', e.target.value)} placeholder="my-custom-class" />
      </div>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Schedule Visibility</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">Show section only during this time range</p>
        <div className="space-y-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Start (optional)</Label>
            <Input type="datetime-local" className="mt-1 h-8 text-sm" value={scheduleStart} onChange={(e) => set('scheduleStart', e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">End (optional)</Label>
            <Input type="datetime-local" className="mt-1 h-8 text-sm" value={scheduleEnd} onChange={(e) => set('scheduleEnd', e.target.value)} />
          </div>
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Tracking ID</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">For analytics events</p>
        <Input className="mt-1.5 h-8 text-sm font-mono" value={trackingId} onChange={(e) => set('trackingId', e.target.value)} placeholder="cta_hero_click" />
      </div>
    </>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgoShort(date: Date): string {
  const diff = Date.now() - date.getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}
