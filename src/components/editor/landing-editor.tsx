'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Undo2, Redo2, Eye, Globe, Sparkles, Loader2, Save, Check,
  Monitor, Tablet, Smartphone, Layout as LayoutIcon, Search as SearchIcon,
  AlertCircle, Plus, X, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'
import { EditorLayout, ToolbarGroup, ToolbarDivider, ToolbarSpacer } from '@/components/editor/editor-layout'
import { NavigatorPanel, type NavigatorSection } from '@/components/editor/navigator-panel'
import { InspectorPanel, type InspectorSection } from '@/components/editor/inspector-panel'
import { CanvasPanel, InlineText, type CanvasSection } from '@/components/editor/canvas-panel'

// ============================================================================
// LandingEditor — Fullscreen 3-panel editor for landing pages
// ============================================================================

// Re-use types from pages-funnels
interface Section { id: string; pageId: string; type: string; content: Record<string, unknown>; position: number; isHidden: boolean }
interface FullPage { id: string; title: string; slug: string; type: string; status: string; category: string; seoTitle: string; seoDescription: string; visits: number; conversions: number; sections: Section[] }

const SECTION_META: Record<string, { name: string; icon: LucideIcon; desc: string }> = {
  HERO: { name: 'Hero', icon: Sparkles, desc: 'Headline + CTA' },
  HEADING: { name: 'Heading', icon: LayoutIcon, desc: 'Section title' },
  TEXT: { name: 'Text', icon: LayoutIcon, desc: 'Paragraph' },
  BENEFITS: { name: 'Benefits', icon: LayoutIcon, desc: 'Outcome benefits' },
  FEATURES: { name: 'Features', icon: LayoutIcon, desc: 'Feature grid' },
  PRICING: { name: 'Pricing', icon: LayoutIcon, desc: 'Pricing tiers' },
  TESTIMONIALS: { name: 'Testimonials', icon: LayoutIcon, desc: 'Social proof' },
  FAQ: { name: 'FAQ', icon: LayoutIcon, desc: 'Q&A' },
  VIDEO: { name: 'Video', icon: LayoutIcon, desc: 'Embed video' },
  GALLERY: { name: 'Gallery', icon: LayoutIcon, desc: 'Image gallery' },
  COUNTDOWN: { name: 'Countdown', icon: LayoutIcon, desc: 'Timer' },
  CTA: { name: 'Call to Action', icon: LayoutIcon, desc: 'Conversion CTA' },
  NEWSLETTER: { name: 'Newsletter', icon: LayoutIcon, desc: 'Email capture' },
  FOOTER: { name: 'Footer', icon: LayoutIcon, desc: 'Page footer' },
}

const ADD_SECTION_TYPES = Object.entries(SECTION_META).map(([type, meta]) => ({ type, ...meta }))

export function LandingEditor({ page, onBack, onOpenTemplates, onOpenSEO, onOpenPreview }: {
  page: { id: string; title: string; slug: string }
  onBack: () => void
  onOpenTemplates: () => void
  onOpenSEO: () => void
  onOpenPreview: () => void
}) {
  const { data, loading, refetch } = useApi<{ page: FullPage }>(`/api/data/page-sections?pageId=${page.id}`)
  const pageData = data?.page

  // Local working copy of sections (for instant updates)
  const [localSections, setLocalSections] = useState<Section[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [savingSection, setSavingSection] = useState<string | null>(null)

  // Undo/Redo
  const [history, setHistory] = useState<Section[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const skipHistoryRef = useRef(false)

  // Viewport
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  // Add section modal
  const [showAdd, setShowAdd] = useState(false)

  // Sync local sections when data loads
  useEffect(() => {
    if (pageData?.sections) {
      setLocalSections(pageData.sections)
      // Initialize history
      if (history.length === 0) {
        setHistory([pageData.sections])
        setHistoryIndex(0)
      }
    }
  }, [pageData])

  // Push to history when sections change (but not on undo/redo)
  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false
      return
    }
    if (localSections.length > 0 && history.length > 0) {
      const last = history[historyIndex]
      if (JSON.stringify(last) !== JSON.stringify(localSections)) {
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push(localSections)
        // Cap at 50 states
        if (newHistory.length > 50) newHistory.shift()
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)
      }
    }
  }, [localSections])

  // API helper
  const callApi = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const raw = await res.text()
    if (!res.ok) { let m = 'Failed'; try { const j = JSON.parse(raw); m = j.error } catch {} throw new Error(m) }
    try { return JSON.parse(raw) } catch { return {} }
  }

  // Auto-save section content (debounced via useEffect in parent)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateSectionContent = useCallback((id: string, content: Record<string, unknown>) => {
    // Update local state immediately
    setLocalSections(prev => prev.map(s => s.id === id ? { ...s, content } : s))

    // Debounced API save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setSavingSection(id)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await callApi('/api/data/page-sections', 'PUT', { id, content })
      } catch {
        toast.error('Save failed')
      } finally {
        setSavingSection(null)
      }
    }, 800)
  }, [])

  // Actions
  const addSection = async (type: string) => {
    setBusy('add')
    try {
      const d = await callApi('/api/data/page-sections', 'POST', { pageId: page.id, type })
      const newSection: Section = { id: d.section.id, pageId: page.id, type, content: d.section.content, position: localSections.length, isHidden: false }
      setLocalSections(prev => [...prev, newSection])
      setShowAdd(false)
      setSelectedId(newSection.id)
      toast.success(`${type} section added`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(null) }
  }

  const duplicateSection = async (id: string) => {
    setBusy(id)
    try {
      const d = await callApi('/api/data/page-sections', 'PUT', { id, action: 'duplicate' })
      const orig = localSections.find(s => s.id === id)
      if (!orig) return
      const newSection: Section = { id: d.section.id, pageId: page.id, type: orig.type, content: d.section.content, position: orig.position + 1, isHidden: false }
      setLocalSections(prev => {
        const next = [...prev]
        next.splice(orig.position + 1, 0, newSection)
        // Reindex positions
        return next.map((s, i) => ({ ...s, position: i }))
      })
      toast.success('Section duplicated')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(null) }
  }

  const deleteSection = async (id: string) => {
    if (!confirm('Delete this section?')) return
    setBusy(id)
    try {
      await callApi(`/api/data/page-sections?id=${id}`, 'DELETE')
      setLocalSections(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, position: i })))
      if (selectedId === id) setSelectedId(null)
      toast.success('Section deleted')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(null) }
  }

  const toggleHide = async (id: string) => {
    const section = localSections.find(s => s.id === id)
    if (!section) return
    setBusy(id)
    try {
      await callApi('/api/data/page-sections', 'PUT', { id, isHidden: !section.isHidden })
      setLocalSections(prev => prev.map(s => s.id === id ? { ...s, isHidden: !s.isHidden } : s))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(null) }
  }

  const reorderSection = async (fromIndex: number, toIndex: number) => {
    // Optimistic reorder
    const reordered = [...localSections]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const reindexed = reordered.map((s, i) => ({ ...s, position: i }))
    skipHistoryRef.current = true
    setLocalSections(reindexed)

    // Save to API
    try {
      await callApi('/api/data/page-sections', 'PUT', { id: moved.id, action: 'moveUp' })
      // For simplicity, just refetch to sync positions
      refetch()
    } catch {
      toast.error('Reorder failed')
      setLocalSections(localSections) // rollback
    }
  }

  const undo = () => {
    if (historyIndex > 0) {
      skipHistoryRef.current = true
      const prev = history[historyIndex - 1]
      setLocalSections(prev)
      setHistoryIndex(historyIndex - 1)
      toast.info('Undo')
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      skipHistoryRef.current = true
      const next = history[historyIndex + 1]
      setLocalSections(next)
      setHistoryIndex(historyIndex + 1)
      toast.info('Redo')
    }
  }

  // Publish
  const publish = async () => {
    setBusy('publish')
    try {
      await callApi('/api/data/pages', 'PUT', { id: page.id, status: 'PUBLISHED' })
      toast.success('Page published', { description: 'Your changes are now live.' })
      refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(null) }
  }

  const aiAction = async (action: string) => {
    if (!selectedId) return
    const section = localSections.find(s => s.id === selectedId)
    if (!section) return
    setBusy(selectedId + action)
    try {
      const d = await callApi('/api/ai/section-rewrite', 'POST', { action, content: section.content, sectionType: section.type })
      updateSectionContent(section.id, d.content)
      toast.success(`AI ${action.toLowerCase()} done! -${d.creditsUsed} credits`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(null) }
  }

  // Inline edit handler
  const handleInlineEdit = (id: string, field: string, value: string) => {
    const section = localSections.find(s => s.id === id)
    if (!section) return
    updateSectionContent(id, { ...section.content, [field]: value })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [historyIndex, history])

  if (loading || !pageData) return <Skeleton className="h-screen rounded-none" />

  const selectedSection = localSections.find(s => s.id === selectedId) || null

  // Build navigator sections
  const navSections: NavigatorSection[] = localSections.map(s => {
    const meta = SECTION_META[s.type] || { name: s.type, icon: LayoutIcon, desc: '' }
    const preview = getPreview(s)
    return { id: s.id, type: s.type, name: meta.name, icon: meta.icon, isHidden: s.isHidden, preview }
  })

  // Build canvas sections
  const canvasSections: CanvasSection[] = localSections

  return (
    <>
    <EditorLayout
      // ─── Toolbar ──────────────────────────────────────────────
      toolbar={
        <>
          <ToolbarGroup>
            <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
          </ToolbarGroup>
          <ToolbarDivider />
          <ToolbarGroup>
            <div>
              <p className="text-sm font-semibold leading-none">{pageData.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">/{pageData.slug}</p>
            </div>
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={historyIndex <= 0} title="Undo (⌘Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (⌘⇧Z)">
              <Redo2 className="h-4 w-4" />
            </Button>
          </ToolbarGroup>

          <ToolbarSpacer />

          {/* Save status */}
          <ToolbarGroup>
            {savingSection ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            ) : (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <Check className="h-3 w-3" /> Auto-saved
              </span>
            )}
          </ToolbarGroup>

          <ToolbarDivider />

          {/* Status badge */}
          <Badge variant="secondary" className={cn('text-[10px]', pageData.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>
            {pageData.status}
          </Badge>

          <ToolbarDivider />

          {/* Responsive toggle */}
          <ToolbarGroup>
            <div className="flex items-center rounded-md bg-muted p-0.5">
              <ViewportBtn icon={Monitor} label="desktop" current={viewport} onClick={setViewport} />
              <ViewportBtn icon={Tablet} label="tablet" current={viewport} onClick={setViewport} />
              <ViewportBtn icon={Smartphone} label="mobile" current={viewport} onClick={setViewport} />
            </div>
          </ToolbarGroup>

          <ToolbarDivider />

          {/* Templates, SEO, Preview, Publish */}
          <ToolbarGroup>
            <Button size="sm" variant="ghost" onClick={onOpenTemplates} title="Templates">
              <LayoutIcon className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onOpenSEO} title="SEO Settings">
              <SearchIcon className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenPreview}>
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
            </Button>
            <Button size="sm" onClick={publish} disabled={busy === 'publish'}>
              {busy === 'publish' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
              Publish
            </Button>
          </ToolbarGroup>
        </>
      }

      // ─── Navigator ─────────────────────────────────────────────
      navigator={
        <NavigatorPanel
          sections={navSections}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onReorder={reorderSection}
          onDuplicate={duplicateSection}
          onHide={toggleHide}
          onDelete={deleteSection}
          onAdd={() => setShowAdd(true)}
          busy={busy}
        />
      }

      // ─── Canvas ────────────────────────────────────────────────
      canvas={
        <CanvasPanel
          sections={canvasSections}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDuplicate={duplicateSection}
          onHide={toggleHide}
          onDelete={deleteSection}
          onAI={(id) => { setSelectedId(id); aiAction('REWRITE') }}
          onInlineEdit={handleInlineEdit}
          busy={busy}
          viewport={viewport}
          renderSection={(s, isEditing) => (
            <CanvasSectionRenderer section={s} isEditing={isEditing} onInlineEdit={handleInlineEdit} />
          )}
        />
      }

      // ─── Inspector ─────────────────────────────────────────────
      inspector={
        <InspectorPanel
          section={selectedSection ? { id: selectedSection.id, type: selectedSection.type, content: selectedSection.content, position: selectedSection.position } : null}
          onUpdate={(c) => updateSectionContent(selectedSection!.id, c)}
          saving={savingSection === selectedSection?.id}
          onSaveAndPreview={() => { onOpenPreview() }}
          onAIAction={aiAction}
          aiLoading={busy?.replace(selectedId || '', '') || null}
          renderContentFields={(content, set) => (
            <SectionContentFields type={selectedSection?.type || ''} content={content} set={set} />
          )}
        />
      }

      // ─── Status bar ────────────────────────────────────────────
      statusBar={
        <>
          <span className="font-medium">{localSections.length} sections</span>
          <span className="mx-2">·</span>
          <span>{selectedSection ? `Editing: ${selectedSection.type}` : 'No section selected'}</span>
          <ToolbarSpacer />
          <span className="text-[10px]">⌘Z Undo · ⌘⇧Z Redo</span>
        </>
      }
    />

    {/* ─── Add Section Modal ──────────────────────────────────── */}
    <AnimatePresence>
      {showAdd && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowAdd(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl"
          >
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold">Add a section</h3>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ADD_SECTION_TYPES.map((t) => {
                    const Icon = t.icon
                    return (
                      <button
                        key={t.type}
                        onClick={() => addSection(t.type)}
                        disabled={busy === 'add'}
                        className="group flex flex-col items-start gap-1.5 rounded-xl border p-3 hover:border-primary/40 hover:bg-primary/5 transition disabled:opacity-50"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary group-hover:scale-110 transition">
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="text-xs font-medium">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}

// ─── Viewport button ─────────────────────────────────────────────────────────

function ViewportBtn({ icon: Icon, label, current, onClick }: {
  icon: LucideIcon
  label: 'desktop' | 'tablet' | 'mobile'
  current: string
  onClick: (v: 'desktop' | 'tablet' | 'mobile') => void
}) {
  return (
    <button
      onClick={() => onClick(label)}
      className={cn(
        'flex h-6 w-7 items-center justify-center rounded transition',
        current === label ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
      )}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

// ─── Canvas Section Renderer (renders section content with inline editing) ────

function CanvasSectionRenderer({ section, isEditing, onInlineEdit }: {
  section: CanvasSection
  isEditing: boolean
  onInlineEdit: (id: string, field: string, value: string) => void
}) {
  const c = section.content as Record<string, any>

  if (section.type === 'HERO') {
    return (
      <div className="px-6 py-16 text-center bg-gradient-to-br from-primary/5 to-transparent">
        {c.emoji && <div className="text-4xl mb-3">{c.emoji}</div>}
        {isEditing ? (
          <InlineText as="h1" value={c.headline || 'Your headline'} onChange={(v) => onInlineEdit(section.id, 'headline', v)} className="text-3xl font-bold text-gray-900 mb-2 block" />
        ) : (
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{c.headline || 'Your headline'}</h1>
        )}
        {isEditing ? (
          <InlineText as="p" value={c.subheadline || ''} onChange={(v) => onInlineEdit(section.id, 'subheadline', v)} className="text-lg text-gray-600 mb-4 block" />
        ) : (
          <p className="text-lg text-gray-600 mb-4">{c.subheadline}</p>
        )}
        <div className="flex justify-center gap-2">
          {c.ctaText && <span className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">{c.ctaText}</span>}
          {c.ctaSecondary && <span className="rounded-lg border px-4 py-2 text-sm font-medium">{c.ctaSecondary}</span>}
        </div>
      </div>
    )
  }

  if (section.type === 'HEADING') {
    return (
      <div className="px-6 py-8">
        {isEditing ? (
          <InlineText as="h2" value={c.text || 'Heading'} onChange={(v) => onInlineEdit(section.id, 'text', v)} className={cn('text-2xl font-bold text-gray-900 block', c.alignment === 'center' && 'text-center')} />
        ) : (
          <h2 className={cn('text-2xl font-bold text-gray-900', c.alignment === 'center' && 'text-center')}>{c.text}</h2>
        )}
      </div>
    )
  }

  if (section.type === 'TEXT') {
    return (
      <div className="px-6 py-4">
        {isEditing ? (
          <InlineText as="p" value={c.text || ''} onChange={(v) => onInlineEdit(section.id, 'text', v)} className="text-gray-600 leading-relaxed block" />
        ) : (
          <p className="text-gray-600 leading-relaxed">{c.text}</p>
        )}
      </div>
    )
  }

  if (section.type === 'FEATURES' || section.type === 'BENEFITS') {
    const items = Array.isArray(c.items) ? c.items : []
    return (
      <div className="px-6 py-12">
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-1 text-center">{c.heading}</h3>}
        {c.subheading && <p className="text-sm text-gray-500 mb-6 text-center">{c.subheading}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {items.map((item: any, i: number) => (
            <div key={i} className="rounded-lg border p-4">
              {item.icon && <div className="text-2xl mb-2">{item.icon}</div>}
              <p className="font-semibold text-sm">{item.title}</p>
              <p className="text-xs text-gray-500 mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (section.type === 'TESTIMONIALS') {
    const items = Array.isArray(c.items) ? c.items : []
    return (
      <div className="px-6 py-12 bg-gray-50">
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">{c.heading}</h3>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {items.map((item: any, i: number) => (
            <div key={i} className="rounded-lg border bg-white p-4">
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

  if (section.type === 'PRICING') {
    const plans = Array.isArray(c.plans) ? c.plans : []
    return (
      <div className="px-6 py-12">
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">{c.heading}</h3>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {plans.map((plan: any, i: number) => (
            <div key={i} className={cn('rounded-lg border p-5', plan.highlighted && 'border-primary ring-2 ring-primary/20')}>
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

  if (section.type === 'FAQ') {
    const items = Array.isArray(c.items) ? c.items : []
    return (
      <div className="px-6 py-12 max-w-3xl mx-auto">
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">{c.heading}</h3>}
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

  if (section.type === 'CTA') {
    return (
      <div className="px-6 py-12">
        <div className="text-center py-8 rounded-lg bg-gradient-to-br from-primary/10 to-card max-w-3xl mx-auto">
          <h3 className="text-xl font-bold mb-1">{c.headline || 'Ready?'}</h3>
          {c.subtext && <p className="text-sm text-gray-500 mb-3">{c.subtext}</p>}
          <span className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">{c.ctaText || 'Start now'}</span>
        </div>
      </div>
    )
  }

  if (section.type === 'NEWSLETTER') {
    return (
      <div className="px-6 py-12 text-center">
        <h3 className="text-xl font-bold mb-1">{c.heading || 'Subscribe'}</h3>
        {c.subtext && <p className="text-sm text-gray-500 mb-3">{c.subtext}</p>}
        <div className="flex justify-center gap-2 max-w-xs mx-auto">
          <input className="flex-1 rounded-lg border px-3 py-2 text-sm" placeholder={c.placeholder || 'you@email.com'} disabled />
          <span className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">{c.ctaText || 'Subscribe'}</span>
        </div>
      </div>
    )
  }

  if (section.type === 'FOOTER') {
    return (
      <div className="px-6 py-8 border-t bg-gray-50">
        <p className="font-bold text-sm">{c.brand || 'Brand'}</p>
        <p className="text-xs text-gray-500 mt-1">{c.tagline || ''}</p>
      </div>
    )
  }

  if (section.type === 'VIDEO') {
    return (
      <div className="px-6 py-12 text-center max-w-3xl mx-auto">
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-3">{c.heading}</h3>}
        {c.videoUrl ? (
          <div className="aspect-video rounded-lg bg-black flex items-center justify-center">
            <span className="text-white/40 text-sm">Video: {c.videoUrl}</span>
          </div>
        ) : <p className="text-sm text-gray-500">No video URL set</p>}
      </div>
    )
  }

  if (section.type === 'GALLERY') {
    const images = Array.isArray(c.images) ? c.images : []
    return (
      <div className="px-6 py-12 max-w-5xl mx-auto">
        {c.heading && <h3 className="text-xl font-bold text-gray-900 mb-3">{c.heading}</h3>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {images.length > 0 ? images.map((img: any, i: number) => (
            <div key={i} className="aspect-square rounded-lg bg-muted flex items-center justify-center border">
              <span className="text-xs text-muted-foreground">Image {i + 1}</span>
            </div>
          )) : <p className="text-sm text-gray-500 col-span-full text-center">No images</p>}
        </div>
      </div>
    )
  }

  if (section.type === 'COUNTDOWN') {
    return (
      <div className="px-6 py-12 text-center">
        <div className="rounded-lg bg-amber-500/10 py-8 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold mb-2">{c.heading || 'Limited time'}</h3>
          {c.endDate && <p className="text-3xl font-bold tabular-nums mb-2">{c.endDate}</p>}
          <span className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">{c.ctaText || 'Get access'}</span>
        </div>
      </div>
    )
  }

  return <div className="p-6 text-sm text-muted-foreground">Unknown section: {section.type}</div>
}

// ─── Section Content Fields (for Inspector Content tab) ──────────────────────

function SectionContentFields({ type, content, set }: { type: string; content: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  if (type === 'HERO') {
    return (
      <>
        <Field label="Headline" k="headline" content={content} set={set} />
        <Field label="Subheadline" k="subheadline" content={content} set={set} />
        <Field label="CTA Text" k="ctaText" content={content} set={set} />
        <Field label="CTA Secondary" k="ctaSecondary" content={content} set={set} />
        <Field label="Emoji" k="emoji" content={content} set={set} />
      </>
    )
  }
  if (type === 'HEADING' || type === 'TEXT') {
    return <Field label="Text" k="text" content={content} set={set} textarea={type === 'TEXT'} />
  }
  if (type === 'CTA') {
    return (
      <>
        <Field label="Headline" k="headline" content={content} set={set} />
        <Field label="Subtext" k="subtext" content={content} set={set} />
        <Field label="CTA Text" k="ctaText" content={content} set={set} />
      </>
    )
  }
  if (type === 'NEWSLETTER') {
    return (
      <>
        <Field label="Heading" k="heading" content={content} set={set} />
        <Field label="Subtext" k="subtext" content={content} set={set} />
        <Field label="Placeholder" k="placeholder" content={content} set={set} />
        <Field label="CTA Text" k="ctaText" content={content} set={set} />
      </>
    )
  }
  if (type === 'FOOTER') {
    return (
      <>
        <Field label="Brand" k="brand" content={content} set={set} />
        <Field label="Tagline" k="tagline" content={content} set={set} />
      </>
    )
  }
  // Default: show heading field (most sections have one)
  return (
    <>
      <Field label="Heading" k="heading" content={content} set={set} />
      <p className="text-xs text-muted-foreground">More fields available in the canvas via inline editing.</p>
    </>
  )
}

function Field({ label, k, content, set, textarea }: { label: string; k: string; content: Record<string, unknown>; set: (k: string, v: unknown) => void; textarea?: boolean }) {
  return (
    <div>
      <Label className="text-xs font-medium uppercase text-muted-foreground">{label}</Label>
      {textarea ? (
        <Textarea className="mt-1 text-sm" rows={3} value={String(content[k] ?? '')} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <Input className="mt-1 h-8 text-sm" value={String(content[k] ?? '')} onChange={(e) => set(k, e.target.value)} />
      )}
    </div>
  )
}

// ─── Preview helper ──────────────────────────────────────────────────────────

function getPreview(s: Section): string {
  const c = s.content as Record<string, any>
  if (s.type === 'HERO') return String(c.headline || 'Headline')
  if (s.type === 'HEADING') return String(c.text || 'Heading')
  if (s.type === 'TEXT') return String(c.text || 'Paragraph').slice(0, 60)
  if (s.type === 'CTA') return String(c.headline || 'CTA')
  if (s.type === 'FEATURES' || s.type === 'BENEFITS' || s.type === 'TESTIMONIALS' || s.type === 'FAQ') return String(c.heading || s.type)
  if (s.type === 'PRICING') return String(c.heading || 'Pricing')
  return s.type
}
