'use client'
import { useState } from 'react'
import { Type, Palette, Search, Sparkles, Loader2, Check, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ============================================================================
// InspectorPanel — Right sidebar with Content / Style / SEO tabs
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
  onSaveAndPreview: () => void
  // AI actions
  onAIAction: (action: string) => void
  aiLoading: string | null
  // Content fields renderer (passed from parent — section-specific)
  renderContentFields: (content: Record<string, unknown>, set: (k: string, v: unknown) => void) => React.ReactNode
}

export function InspectorPanel({
  section, onUpdate, saving, onSaveAndPreview, onAIAction, aiLoading, renderContentFields,
}: InspectorPanelProps) {
  const [tab, setTab] = useState<'content' | 'style' | 'seo'>('content')

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
            <p className="text-xs text-muted-foreground mt-1">Click a section in the canvas or navigator to edit its content.</p>
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
      <div className="px-3 py-2.5 border-b">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspector</p>
        <p className="text-sm font-medium mt-0.5">{section.type}</p>
      </div>

      {/* Tabs */}
      <div className="px-2 pt-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="content" className="text-xs"><Type className="h-3 w-3 mr-1" />Content</TabsTrigger>
            <TabsTrigger value="style" className="text-xs"><Palette className="h-3 w-3 mr-1" />Style</TabsTrigger>
            <TabsTrigger value="seo" className="text-xs"><Search className="h-3 w-3 mr-1" />SEO</TabsTrigger>
          </TabsList>

          {/* Content tab */}
          <TabsContent value="content" className="mt-3">
            <div className="space-y-3 px-1 pb-4">
              {renderContentFields(c, set)}
            </div>
          </TabsContent>

          {/* Style tab */}
          <TabsContent value="content" className="mt-3">
          </TabsContent>
        </Tabs>
      </div>

      {/* Content tab content (always visible when tab=content) */}
      {tab === 'content' && (
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3 scroll-thin">
          {renderContentFields(c, set)}

          {/* Save status + Save & Preview */}
          <div className="border-t pt-3 flex items-center gap-2">
            {saving ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 flex-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            ) : (
              <span className="text-xs text-emerald-600 flex items-center gap-1.5 flex-1">
                <Check className="h-3 w-3" /> Auto-saved
              </span>
            )}
          </div>
        </div>
      )}

      {/* Style tab content */}
      {tab === 'style' && (
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4 scroll-thin">
          <StyleControls content={c} set={set} />
        </div>
      )}

      {/* SEO tab content */}
      {tab === 'seo' && (
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3 scroll-thin">
          <SeoControls content={c} set={set} />
        </div>
      )}

      {/* AI panel (always visible at bottom) */}
      <div className="border-t">
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
      className="flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition disabled:opacity-50"
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

  return (
    <>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Background</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {['none', 'color', 'gradient', 'image'].map((bgType) => (
            <button
              key={bgType}
              onClick={() => set('background', { ...bg, type: bgType })}
              className={cn(
                'rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition',
                bg.type === bgType ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {bgType}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Padding (vertical)</Label>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {['sm', 'md', 'lg', 'xl'].map((p) => (
            <button
              key={p}
              onClick={() => set('spacing', { ...spacing, paddingY: p })}
              className={cn(
                'rounded-md border px-1 py-1.5 text-xs font-medium uppercase transition',
                spacing.paddingY === p ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Animation</Label>
        <select
          value={animation}
          onChange={(e) => set('animation', e.target.value)}
          className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="none">None</option>
          <option value="fade-in">Fade In</option>
          <option value="fade-in-up">Fade In Up</option>
          <option value="slide-in">Slide In</option>
          <option value="zoom-in">Zoom In</option>
        </select>
      </div>

      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Visibility</Label>
        <div className="mt-1.5 space-y-1.5">
          {['desktop', 'tablet', 'mobile'].map((device) => {
            const visibility = (content.visibility as Record<string, boolean> | undefined) || { desktop: true, tablet: true, mobile: true }
            return (
              <label key={device} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibility[device] !== false}
                  onChange={(e) => set('visibility', { ...visibility, [device]: e.target.checked })}
                  className="h-3.5 w-3.5 rounded"
                />
                <span className="capitalize">{device}</span>
              </label>
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

  return (
    <>
      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Heading Tag</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">Semantic HTML tag for the section heading</p>
        <select
          value={headingTag}
          onChange={(e) => set('headingTag', e.target.value)}
          className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="h1">H1 (main heading)</option>
          <option value="h2">H2 (section heading)</option>
          <option value="h3">H3 (subsection)</option>
          <option value="h4">H4 (minor heading)</option>
        </select>
      </div>

      <div>
        <Label className="text-xs font-medium uppercase text-muted-foreground">Schema Type</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">Structured data for search engines</p>
        <select
          value={schemaType}
          onChange={(e) => set('schemaType', e.target.value)}
          className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
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
          <li>• Use H2 for major sections (Pricing, FAQ, etc.)</li>
          <li>• Add FAQ schema to FAQ sections for rich snippets</li>
          <li>• Add Product schema to pricing sections</li>
        </ul>
      </div>
    </>
  )
}
