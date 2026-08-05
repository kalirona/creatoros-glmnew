'use client'
import { useState } from 'react'
import {
  Type, Palette, Search, Settings2, Sparkles, Loader2, Check, Pencil,
  Eye, Calendar, Code, Hash,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  onAIAction: (action: string) => void
  aiLoading: string | null
  renderContentFields: (content: Record<string, unknown>, set: (k: string, v: unknown) => void) => React.ReactNode
}

export function InspectorPanel({
  section, onUpdate, saving, onAIAction, aiLoading, renderContentFields,
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
              <Check className="h-2.5 w-2.5" /> Auto-saved
            </span>
          )}
          <Badge variant="secondary" className="text-[9px] h-4 px-1">#{section.position + 1}</Badge>
        </div>
      </div>

      {/* Tabs — fills remaining space */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <div className="px-2 pt-2 shrink-0">
          <TabsList className="grid grid-cols-4 w-full h-auto">
            <TabsTrigger value="content" className="text-[10px] py-1.5"><Type className="h-3 w-3 mr-0.5" />Content</TabsTrigger>
            <TabsTrigger value="style" className="text-[10px] py-1.5"><Palette className="h-3 w-3 mr-0.5" />Style</TabsTrigger>
            <TabsTrigger value="seo" className="text-[10px] py-1.5"><Search className="h-3 w-3 mr-0.5" />SEO</TabsTrigger>
            <TabsTrigger value="settings" className="text-[10px] py-1.5"><Settings2 className="h-3 w-3 mr-0.5" />Settings</TabsTrigger>
          </TabsList>
        </div>

        {/* Tab content — scrollable */}
        <TabsContent value="content" className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-thin mt-0">
          {renderContentFields(c, set)}
        </TabsContent>

        <TabsContent value="style" className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scroll-thin mt-0">
          <StyleControls content={c} set={set} />
        </TabsContent>

        <TabsContent value="seo" className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-thin mt-0">
          <SeoControls content={c} set={set} />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-thin mt-0">
          <SettingsControls content={c} set={set} />
        </TabsContent>
      </Tabs>

      {/* AI panel — fixed at bottom */}
      <div className="border-t shrink-0">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" /> AI Assistant
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <AIButton label="Rewrite" action="REWRITE" onAction={onAIAction} loading={aiLoading === 'REWRITE'} />
            <AIButton label="Improve" action="IMPROVE" onAction={onAIAction} loading={aiLoading === 'IMPROVE'} />
            <AIButton label="Shorten" action="SHORTEN" onAction={onAIAction} loading={aiLoading === 'SHORTEN'} />
            <AIButton label="Expand" action="EXPAND" onAction={onAIAction} loading={aiLoading === 'EXPAND'} />
            <AIButton label="SEO Optimize" action="SEO" onAction={onAIAction} loading={aiLoading === 'SEO'} />
            <AIButton label="Translate" action="TRANSLATE" onAction={onAIAction} loading={aiLoading === 'TRANSLATE'} />
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            <AIButton label="Professional" action="PROFESSIONAL" onAction={onAIAction} loading={aiLoading === 'PROFESSIONAL'} />
            <AIButton label="Luxury" action="LUXURY" onAction={onAIAction} loading={aiLoading === 'LUXURY'} />
            <AIButton label="Startup" action="STARTUP" onAction={onAIAction} loading={aiLoading === 'STARTUP'} />
            <AIButton label="Friendly" action="EMOTIONAL" onAction={onAIAction} loading={aiLoading === 'EMOTIONAL'} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── AI Button ───────────────────────────────────────────────────────────────

function AIButton({ label, action, onAction, loading }: { label: string; action: string; onAction: (a: string) => void; loading: boolean }) {
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

// ─── Style Controls ──────────────────────────────────────────────────────────

function StyleControls({ content, set }: { content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const bg = (content.background as Record<string, unknown> | undefined) || {}
  const spacing = (content.spacing as Record<string, unknown> | undefined) || {}
  const animation = (content.animation as string | undefined) || 'none'
  const alignment = (content.alignment as string | undefined) || 'center'
  const borderRadius = (content.borderRadius as string | undefined) || 'md'

  return (
    <>
      {/* Background */}
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

      {/* Spacing */}
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

      {/* Alignment */}
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

      {/* Border Radius */}
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

      {/* Animation */}
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Animation</Label>
        <select value={animation} onChange={(e) => set('animation', e.target.value)}
          className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm">
          <option value="none">None</option>
          <option value="fade-in">Fade In</option>
          <option value="fade-in-up">Fade In Up</option>
          <option value="slide-in">Slide In</option>
          <option value="zoom-in">Zoom In</option>
        </select>
      </div>

      {/* Visibility */}
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Device Visibility</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">Show section on specific devices</p>
        <div className="space-y-2">
          {['desktop', 'tablet', 'mobile'].map((device) => {
            const visibility = (content.visibility as Record<string, boolean> | undefined) || { desktop: true, tablet: true, mobile: true }
            return (
              <div key={device} className="flex items-center justify-between">
                <span className="text-xs capitalize flex items-center gap-1.5">
                  <Eye className="h-3 w-3 text-muted-foreground" /> {device}
                </span>
                <Switch checked={visibility[device] !== false} onCheckedChange={(checked) => set('visibility', { ...visibility, [device]: checked })} />
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── SEO Controls ────────────────────────────────────────────────────────────

function SeoControls({ content, set }: { content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const headingTag = (content.headingTag as string | undefined) || 'h2'
  const schemaType = (content.schemaType as string | undefined) || 'none'
  const seoTitle = (content.seoTitle as string | undefined) || ''
  const seoDescription = (content.seoDescription as string | undefined) || ''
  const keywords = (content.seoKeywords as string | undefined) || ''
  const ogImage = (content.ogImage as string | undefined) || ''

  return (
    <>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">SEO Title</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">Override the section heading for search engines</p>
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
        <p className="text-[10px] text-muted-foreground mt-0.5">Structured data for rich snippets</p>
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
      {/* Anchor ID */}
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1.5">
          <Hash className="h-3 w-3" /> Anchor ID
        </Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">For deep links: /page#your-id</p>
        <Input className="mt-1.5 h-8 text-sm font-mono" value={anchorId} onChange={(e) => set('anchorId', e.target.value)} placeholder="pricing-section" />
      </div>

      {/* Custom CSS Class */}
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1.5">
          <Code className="h-3 w-3" /> Custom CSS Class
        </Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">Additional class name on the section wrapper</p>
        <Input className="mt-1.5 h-8 text-sm font-mono" value={customCssClass} onChange={(e) => set('customCssClass', e.target.value)} placeholder="my-custom-class" />
      </div>

      {/* Schedule */}
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1.5">
          <Calendar className="h-3 w-3" /> Schedule Visibility
        </Label>
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

      {/* Tracking */}
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Tracking ID</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">For analytics events (e.g., GA4 event name)</p>
        <Input className="mt-1.5 h-8 text-sm font-mono" value={trackingId} onChange={(e) => set('trackingId', e.target.value)} placeholder="cta_hero_click" />
      </div>
    </>
  )
}
