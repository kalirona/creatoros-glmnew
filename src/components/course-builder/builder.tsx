'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent, DragStartEvent, DragOverlay,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft, Plus, GripVertical, ChevronDown, ChevronRight, MoreVertical, Pencil, Copy,
  Trash2, Eye, Save, Rocket, Archive, Undo2, Redo2, PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen, Loader2, CheckCircle2, AlertCircle, CircleDot,
  BookOpen, FileText, Video, FileQuestion, Download, Type, FileEdit, Clock,
  Keyboard, X, Settings, Sparkles, Image as ImageIcon, Code, PlayCircle,
  DollarSign, Users, Lock, Globe, Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Lesson {
  id: string; title: string; type: string; duration: number; isPreview: boolean; content: string
}
interface Section {
  id: string; title: string; position: number; lessons: Lesson[]
}
interface CourseFull {
  id: string; title: string; description: string; category: string; price: number
  level: string; status: string; rating: number; studentsCount: number
  sections: Section[]; totalLessons: number
}
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const LESSON_TYPE_ICONS: Record<string, React.ElementType> = {
  LESSON: FileEdit, VIDEO: Video, QUIZ: FileQuestion, ASSIGNMENT: FileText,
  DOWNLOAD: Download, TEXT: Type,
}

// ─── Main CourseBuilder ─────────────────────────────────────────────────────
export function CourseBuilder({ courseId }: { courseId: string }) {
  const closeBuilder = useAppStore((s) => s.closeBuilder)
  const [showPreview, setShowPreview] = useState(false)

  const [course, setCourse] = useState<CourseFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Local editing state (for autosave)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sections, setSections] = useState<Section[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Fetch course ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/data/courses`)
      .then((r) => r.json())
      .then((data: CourseFull[]) => {
        if (cancelled) return
        const found = data.find((c) => c.id === courseId)
        if (found) {
          setCourse(found)
          setTitle(found.title)
          setDescription(found.description)
          setSections(found.sections)
          setActiveLessonId(found.sections[0]?.lessons[0]?.id || null)
        }
      })
      .catch(() => toast.error('Failed to load course'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [courseId])

  // ─── Autosave ──────────────────────────────────────────────────────────────
  const save = useCallback(async (showToast = false) => {
    if (!course) return
    setSaveState('saving')
    try {
      const res = await fetch('/api/data/courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: course.id, title, description,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaveState('saved')
      setLastSavedAt(Date.now())
      setHasUnsavedChanges(false)
      if (showToast) toast.success('All changes saved')
    } catch {
      setSaveState('error')
      if (showToast) toast.error('Save failed', { description: 'Please try again.' })
    }
  }, [course, title, description])

  // Debounced autosave
  useEffect(() => {
    if (!course) return
    if (title === course.title && description === course.description) return
    setHasUnsavedChanges(true)
    setSaveState('idle')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(), 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [title, description, course, save])

  // ─── Unsaved changes warning ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(true) }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); setLeftOpen(v => !v) }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '\\') { e.preventDefault(); setRightOpen(v => !v) }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); setShortcutsOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  // ─── Section CRUD ──────────────────────────────────────────────────────────
  const addSection = () => {
    const newSection: Section = {
      id: `sec-${Date.now()}`, title: `Section ${sections.length + 1}`, position: sections.length, lessons: []
    }
    setSections([...sections, newSection])
    toast.success('Section added')
  }

  const renameSection = (id: string, newTitle: string) => {
    setSections(sections.map(s => s.id === id ? { ...s, title: newTitle } : s))
  }

  const deleteSection = (id: string) => {
    if (!confirm('Delete this section and all its lessons?')) return
    setSections(sections.filter(s => s.id !== id))
    toast.success('Section deleted')
  }

  const duplicateSection = (id: string) => {
    const section = sections.find(s => s.id === id)
    if (!section) return
    const copy: Section = {
      ...section, id: `sec-${Date.now()}`, title: `${section.title} (Copy)`,
      lessons: section.lessons.map(l => ({ ...l, id: `les-${Date.now()}-${Math.random()}` }))
    }
    const idx = sections.findIndex(s => s.id === id)
    const next = [...sections]
    next.splice(idx + 1, 0, copy)
    setSections(next)
    toast.success('Section duplicated')
  }

  const reorderSections = (sourceId: string, targetId: string) => {
    const oldIdx = sections.findIndex(s => s.id === sourceId)
    const newIdx = sections.findIndex(s => s.id === targetId)
    if (oldIdx < 0 || newIdx < 0) return
    setSections(arrayMove(sections, oldIdx, newIdx))
  }

  // ─── Lesson CRUD ───────────────────────────────────────────────────────────
  const addLesson = (sectionId: string) => {
    const newLesson: Lesson = {
      id: `les-${Date.now()}`, title: 'Untitled lesson', type: 'VIDEO', duration: 10, isPreview: false, content: ''
    }
    setSections(sections.map(s => s.id === sectionId ? { ...s, lessons: [...s.lessons, newLesson] } : s))
    setActiveLessonId(newLesson.id)
    toast.success('Lesson added')
  }

  const renameLesson = (id: string, newTitle: string) => {
    setSections(sections.map(s => ({
      ...s, lessons: s.lessons.map(l => l.id === id ? { ...l, title: newTitle } : l)
    })))
  }

  const deleteLesson = (id: string) => {
    setSections(sections.map(s => ({ ...s, lessons: s.lessons.filter(l => l.id !== id) })))
    if (activeLessonId === id) setActiveLessonId(null)
    toast.success('Lesson deleted')
  }

  const duplicateLesson = (id: string) => {
    for (const s of sections) {
      const lesson = s.lessons.find(l => l.id === id)
      if (lesson) {
        const copy: Lesson = { ...lesson, id: `les-${Date.now()}`, title: `${lesson.title} (Copy)` }
        const idx = s.lessons.findIndex(l => l.id === id)
        const newLessons = [...s.lessons]
        newLessons.splice(idx + 1, 0, copy)
        setSections(sections.map(sec => sec.id === s.id ? { ...sec, lessons: newLessons } : sec))
        toast.success('Lesson duplicated')
        return
      }
    }
  }

  const moveLesson = (id: string, dir: -1 | 1) => {
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const section = sections[sIdx]
      const lIdx = section.lessons.findIndex(l => l.id === id)
      if (lIdx >= 0) {
        const newLessons = [...section.lessons]
        const swapIdx = lIdx + dir
        if (swapIdx >= 0 && swapIdx < newLessons.length) {
          ;[newLessons[lIdx], newLessons[swapIdx]] = [newLessons[swapIdx], newLessons[lIdx]]
          setSections(sections.map(s => s.id === section.id ? { ...s, lessons: newLessons } : s))
        }
        return
      }
    }
  }

  // ─── Publish ───────────────────────────────────────────────────────────────
  const togglePublish = async () => {
    if (!course) return
    const newStatus = course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    try {
      const res = await fetch('/api/data/courses', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: course.id, status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed')
      setCourse({ ...course, status: newStatus })
      toast.success(newStatus === 'PUBLISHED' ? 'Course published!' : 'Course unpublished')
    } catch { toast.error('Failed to publish') }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading || !course) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading course builder…</p>
        </div>
      </div>
    )
  }

  const activeLesson = sections.flatMap(s => s.lessons).find(l => l.id === activeLessonId) || null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ═══ Top Toolbar ═══════════════════════════════════════════════════════ */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 shadow-sm">
        <Button variant="ghost" size="sm" onClick={closeBuilder} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Courses</span>
        </Button>
        <div className="h-6 w-px bg-border" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            className="h-9 border-none bg-transparent px-0 text-base font-semibold focus-visible:ring-0"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Course title"
          />
          <Badge variant="secondary" className={cn(
            'text-xs shrink-0',
            course.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
          )}>
            {course.status === 'PUBLISHED' ? 'Published' : 'Draft'}
          </Badge>
        </div>
        {/* Save indicator */}
        <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts (Ctrl+/)">
          <Keyboard className="h-4 w-4" />
        </Button>
        <div className="h-6 w-px bg-border" />
        <Button variant="outline" size="sm" onClick={() => save(true)} className="gap-1.5">
          <Save className="h-4 w-4" /> <span className="hidden sm:inline">Save</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} className="gap-1.5">
          <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Preview</span>
        </Button>
        <Button size="sm" onClick={togglePublish} className={cn('gap-1.5', course.status === 'PUBLISHED' ? '' : 'bg-emerald-600 hover:bg-emerald-700 text-white')}>
          {course.status === 'PUBLISHED' ? <><Archive className="h-4 w-4" /> <span className="hidden sm:inline">Unpublish</span></> : <><Rocket className="h-4 w-4" /> <span className="hidden sm:inline">Publish</span></>}
        </Button>
      </header>

      {/* ═══ Three-panel layout ════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0">
        {/* ─── Left Sidebar: Course Outline ──────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {leftOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col border-r bg-muted/30 overflow-hidden shrink-0"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b bg-background/50 shrink-0">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Course Outline</p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-sm gap-1.5" onClick={addSection}>
                    <Plus className="h-4 w-4" /> Section
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLeftOpen(false)} title="Collapse (Ctrl+\)">
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scroll-thin min-h-0">
                <div className="p-3">
                  {sections.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center">
                      <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No sections yet. Add your first section to get started.</p>
                    </div>
                  ) : (
                    <OutlineSections
                      sections={sections}
                      activeLessonId={activeLessonId}
                      onSelectLesson={setActiveLessonId}
                      onAddLesson={addLesson}
                      onRenameSection={renameSection}
                      onDeleteSection={deleteSection}
                      onDuplicateSection={duplicateSection}
                      onRenameLesson={renameLesson}
                      onDeleteLesson={deleteLesson}
                      onDuplicateLesson={duplicateLesson}
                      onMoveLesson={moveLesson}
                      onReorderSections={reorderSections}
                    />
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ─── Collapsed left panel — expand button ─────────────────────────── */}
        {!leftOpen && (
          <button
            onClick={() => setLeftOpen(true)}
            className="flex items-center gap-1 border-r bg-muted/30 px-2 py-3 text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0"
            title="Show outline (Ctrl+\)"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* ─── Center: Lesson Editor ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scroll-thin min-w-0 bg-grid">
          {activeLesson ? (
            <LessonEditor key={activeLesson.id} lesson={activeLesson} onUpdate={(patch) => {
              setSections(sections.map(s => ({
                ...s,
                lessons: s.lessons.map(l => l.id === activeLesson.id ? { ...l, ...patch } : l)
              })))
            }} />
          ) : (
            <div className="flex h-full items-center justify-center p-12">
              <div className="text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground mx-auto mb-4">
                  <FileEdit className="h-8 w-8" />
                </div>
                <p className="text-base font-semibold">Select a lesson to edit</p>
                <p className="text-sm text-muted-foreground mt-1">Choose a lesson from the outline on the left, or create a new one.</p>
                <Button size="sm" className="mt-4" onClick={addSection}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Section
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Right: Settings Panel ─────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {rightOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden md:flex flex-col border-l bg-muted/30 overflow-hidden shrink-0"
            >
              <RightPanel lesson={activeLesson} course={course} onClose={() => setRightOpen(false)} onUpdateCourse={(patch) => {
                if (!course) return
                setCourse({ ...course, ...patch })
                // Trigger save
                if (patch.title !== undefined) setTitle(patch.title)
                if (patch.description !== undefined) setDescription(patch.description)
              }} onUpdateLesson={(patch) => {
                if (!activeLesson) return
                setSections(sections.map(s => ({
                  ...s,
                  lessons: s.lessons.map(l => l.id === activeLesson.id ? { ...l, ...patch } : l)
                })))
              }} />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ─── Collapsed right panel — expand button ────────────────────────── */}
        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            className="hidden md:flex items-center gap-1 border-l bg-muted/30 px-2 py-3 text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0"
            title="Show inspector (Ctrl+Shift+\)"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ═══ Keyboard shortcuts dialog ═════════════════════════════════════════ */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>Speed up your workflow with these shortcuts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {[
              { keys: 'Ctrl+S', desc: 'Save course' },
              { keys: 'Ctrl+\\', desc: 'Toggle outline sidebar' },
              { keys: 'Ctrl+Shift+\\', desc: 'Toggle settings panel' },
              { keys: 'Ctrl+/', desc: 'Show this help' },
            ].map((s) => (
              <div key={s.keys} className="flex items-center justify-between rounded-lg border p-2.5">
                <span className="text-sm">{s.desc}</span>
                <kbd className="rounded border bg-muted px-2 py-1 text-xs font-mono">{s.keys}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Preview overlay ═══════════════════════════════════════════════════ */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /> Student Preview</DialogTitle>
            <DialogDescription>This is how students will see your course.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto scroll-thin">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              </div>
              {sections.map((s, sIdx) => (
                <div key={s.id} className="rounded-lg border p-4">
                  <p className="text-sm font-semibold mb-2">{sIdx + 1}. {s.title}</p>
                  <div className="space-y-1">
                    {s.lessons.map((l, lIdx) => {
                      const Icon = LESSON_TYPE_ICONS[l.type] || FileEdit
                      return (
                        <div key={l.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50 transition">
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-sm">{lIdx + 1}. {l.title}</span>
                          {l.isPreview && <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600">Free</Badge>}
                          <span className="text-xs text-muted-foreground">{l.duration}m</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPreview(false)}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Save Indicator ──────────────────────────────────────────────────────────
function SaveIndicator({ state, lastSavedAt }: { state: SaveState; lastSavedAt: number | null }) {
  const [, setNow] = useState(Date.now())
  useEffect(() => {
    if (state !== 'idle') return
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [state])

  let label = 'All changes saved'
  let icon: React.ReactNode = <CircleDot className="h-3.5 w-3.5" />
  let color = 'text-muted-foreground'

  if (state === 'saving') { label = 'Saving…'; icon = <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />; color = 'text-amber-600' }
  else if (state === 'saved') { label = 'Saved'; icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />; color = 'text-emerald-600' }
  else if (state === 'error') { label = 'Save failed'; icon = <AlertCircle className="h-3.5 w-3.5 text-rose-500" />; color = 'text-rose-600' }
  else if (lastSavedAt) {
    const sec = Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000))
    if (sec < 5) label = 'Saved just now'
    else if (sec < 60) label = `Saved ${sec}s ago`
    else { const min = Math.round(sec / 60); label = min < 60 ? `Saved ${min}m ago` : `Saved ${Math.round(min / 60)}h ago` }
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </div>
  )
}

// ─── Outline Sections (with drag-and-drop) ───────────────────────────────────
function OutlineSections({
  sections, activeLessonId, onSelectLesson, onAddLesson,
  onRenameSection, onDeleteSection, onDuplicateSection,
  onRenameLesson, onDeleteLesson, onDuplicateLesson, onMoveLesson, onReorderSections,
}: {
  sections: Section[]
  activeLessonId: string | null
  onSelectLesson: (id: string) => void
  onAddLesson: (sectionId: string) => void
  onRenameSection: (id: string, title: string) => void
  onDeleteSection: (id: string) => void
  onDuplicateSection: (id: string) => void
  onRenameLesson: (id: string, title: string) => void
  onDeleteLesson: (id: string) => void
  onDuplicateLesson: (id: string) => void
  onMoveLesson: (id: string, dir: -1 | 1) => void
  onReorderSections: (sourceId: string, targetId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleSection = (id: string) => {
    setCollapsed((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function handleDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)) }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    onReorderSections(String(active.id), String(over.id))
  }

  const activeSection = activeId ? sections.find(s => s.id === activeId) : null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {sections.map((section, sIdx) => (
            <SortableSection
              key={section.id}
              section={section}
              index={sIdx}
              collapsed={collapsed.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              activeLessonId={activeLessonId}
              onSelectLesson={onSelectLesson}
              onAddLesson={() => onAddLesson(section.id)}
              onRename={(t) => onRenameSection(section.id, t)}
              onDelete={() => onDeleteSection(section.id)}
              onDuplicate={() => onDuplicateSection(section.id)}
              onRenameLesson={onRenameLesson}
              onDeleteLesson={onDeleteLesson}
              onDuplicateLesson={onDuplicateLesson}
              onMoveLesson={onMoveLesson}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeSection ? (
          <div className="rounded-lg border bg-background px-3 py-2 shadow-lg text-sm font-medium opacity-90">
            {activeSection.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Sortable Section ────────────────────────────────────────────────────────
function SortableSection({
  section, index, collapsed, onToggle, activeLessonId, onSelectLesson, onAddLesson,
  onRename, onDelete, onDuplicate, onRenameLesson, onDeleteLesson, onDuplicateLesson, onMoveLesson,
}: {
  section: Section; index: number
  collapsed: boolean; onToggle: () => void
  activeLessonId: string | null
  onSelectLesson: (id: string) => void
  onAddLesson: () => void
  onRename: (t: string) => void; onDelete: () => void
  onDuplicate: () => void
  onRenameLesson: (id: string, t: string) => void
  onDeleteLesson: (id: string) => void
  onDuplicateLesson: (id: string) => void
  onMoveLesson: (id: string, dir: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.title)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-xl border bg-background transition-all hover:shadow-sm',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/40',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing p-1.5 -ml-1 text-muted-foreground/50 hover:text-foreground transition touch-none rounded-md hover:bg-muted/50"
          aria-label="Drag section"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={onToggle} className="p-1 text-muted-foreground hover:text-foreground transition rounded-md hover:bg-muted/50">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span className="text-xs font-mono font-bold text-muted-foreground/50 w-5 shrink-0 text-center">{index + 1}</span>
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { onRename(draft.trim() || section.title); setEditing(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onRename(draft.trim() || section.title); setEditing(false) } if (e.key === 'Escape') { setDraft(section.title); setEditing(false) } }}
            className="h-8 text-sm flex-1"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="flex-1 truncate text-left text-sm font-semibold hover:text-primary transition">
            {section.title}
          </button>
        )}
        <span className="text-xs text-muted-foreground font-medium shrink-0 px-2 py-0.5 rounded-full bg-muted/60 min-w-[28px] text-center">{section.lessons.length}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-foreground transition rounded-md hover:bg-muted/50 focus:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setEditing(true)} className="gap-2"><Pencil className="h-4 w-4" /> Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={onAddLesson} className="gap-2"><Plus className="h-4 w-4" /> Add lesson</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate} className="gap-2"><Copy className="h-4 w-4" /> Duplicate section</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-rose-600 focus:text-rose-700 gap-2"><Trash2 className="h-4 w-4" /> Delete section</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="space-y-1 pl-10 pr-2 pb-2">
              {section.lessons.length === 0 && (
                <p className="py-1.5 px-2 text-xs text-muted-foreground italic">No lessons yet</p>
              )}
              {section.lessons.map((lesson, lIdx) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  active={lesson.id === activeLessonId}
                  onSelect={() => onSelectLesson(lesson.id)}
                  onRename={(t) => onRenameLesson(lesson.id, t)}
                  onDelete={() => onDeleteLesson(lesson.id)}
                  onDuplicate={() => onDuplicateLesson(lesson.id)}
                  onMoveUp={() => onMoveLesson(lesson.id, -1)}
                  onMoveDown={() => onMoveLesson(lesson.id, 1)}
                  canMoveUp={lIdx > 0}
                  canMoveDown={lIdx < section.lessons.length - 1}
                />
              ))}
              <button
                onClick={onAddLesson}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition border border-dashed border-transparent hover:border-border"
              >
                <Plus className="h-4 w-4" /> Add lesson
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Lesson Row ──────────────────────────────────────────────────────────────
function LessonRow({
  lesson, active, onSelect, onRename, onDelete, onDuplicate, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: {
  lesson: Lesson; active: boolean
  onSelect: () => void
  onRename: (t: string) => void; onDelete: () => void
  onDuplicate: () => void
  onMoveUp: () => void; onMoveDown: () => void
  canMoveUp: boolean; canMoveDown: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(lesson.title)
  const Icon = LESSON_TYPE_ICONS[lesson.type] || FileEdit

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition cursor-pointer',
        active ? 'bg-primary/10 text-primary ring-1 ring-primary/30 font-medium' : 'hover:bg-muted/60 text-foreground/80',
      )}
      onClick={onSelect}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
      title="Double-click to rename"
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { onRename(draft.trim() || lesson.title); setEditing(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { onRename(draft.trim() || lesson.title); setEditing(false) } if (e.key === 'Escape') { setDraft(lesson.title); setEditing(false) } }}
          className="h-7 text-sm flex-1 min-w-0"
        />
      ) : (
        <span className="flex-1 truncate text-sm min-w-0">{lesson.title}</span>
      )}
      {lesson.isPreview && <Eye className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
      <span className="text-xs text-muted-foreground shrink-0 font-medium tabular-nums">{lesson.duration}m</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition rounded-md hover:bg-muted/50 focus:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditing(true) }} className="gap-2"><Pencil className="h-4 w-4" /> Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate() }} className="gap-2"><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveUp() }} disabled={!canMoveUp} className="gap-2"><ChevronRight className="h-4 w-4 rotate-[-90deg]" /> Move up</DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveDown() }} disabled={!canMoveDown} className="gap-2"><ChevronRight className="h-4 w-4 rotate-90" /> Move down</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete() }} className="text-rose-600 focus:text-rose-700 gap-2"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ─── Lesson Editor (center) ──────────────────────────────────────────────────
function LessonEditor({ lesson, onUpdate }: { lesson: Lesson; onUpdate: (patch: Partial<Lesson>) => void }) {
  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [showVideoInput, setShowVideoInput] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [showImageInput, setShowImageInput] = useState(false)
  const [imageUrl, setImageUrl] = useState('')

  const BLOCK_TYPES = [
    { label: 'Heading', icon: Type, template: '\n\n## New Heading\n\n' },
    { label: 'Text', icon: FileText, template: '\n\nWrite your text here...\n\n' },
    { label: 'YouTube', icon: Video, action: 'youtube' },
    { label: 'Video URL', icon: PlayCircle, action: 'video' },
    { label: 'Image', icon: ImageIcon, action: 'image' },
    { label: 'Document', icon: FileText, action: 'document' },
    { label: 'Quiz', icon: FileQuestion, template: '\n\n### Quiz\n**Question:** Type your question here?\n- [ ] Option A\n- [ ] Option B\n- [x] Option C (correct)\n\n**Explanation:** Add your explanation here.\n\n' },
    { label: 'Callout', icon: AlertCircle, template: '\n\n> 💡 **Tip:** Add an important callout here.\n\n' },
    { label: 'Code', icon: Code, template: '\n\n```\n// Your code here\n```\n\n' },
    { label: 'Divider', icon: BookOpen, template: '\n\n---\n\n' },
  ]

  const addBlock = (block: typeof BLOCK_TYPES[number]) => {
    if (block.action === 'youtube') {
      setShowVideoInput(true)
      setShowBlockPicker(false)
      return
    }
    if (block.action === 'video') {
      setShowVideoInput(true)
      setShowBlockPicker(false)
      return
    }
    if (block.action === 'image') {
      setShowImageInput(true)
      setShowBlockPicker(false)
      return
    }
    if (block.action === 'document') {
      // Add a document download block
      const newContent = (lesson.content || '') + '\n\n📄 **Download:** [Click here to download](paste-your-document-url-here)\n\n'
      onUpdate({ content: newContent })
      setShowBlockPicker(false)
      toast.success('Document block added — paste your file URL')
      return
    }
    if (block.template) {
      const newContent = (lesson.content || '') + block.template
      onUpdate({ content: newContent })
      setShowBlockPicker(false)
      toast.success('Block added')
    }
  }

  const insertVideoBlock = () => {
    if (!videoUrl.trim()) { toast.error('Please enter a video URL'); return }
    let embedUrl = videoUrl.trim()
    // Convert YouTube URL to embed format
    const ytMatch = embedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    if (ytMatch) {
      embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`
    }
    // Convert Vimeo URL
    const vimeoMatch = embedUrl.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) {
      embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`
    }
    const newContent = (lesson.content || '') + `\n\n<video src="${embedUrl}" controls></video>\n\n[▶ Watch: ${embedUrl}](${embedUrl})\n\n`
    onUpdate({ content: newContent })
    setVideoUrl('')
    setShowVideoInput(false)
    toast.success('Video block added')
  }

  const insertImageBlock = () => {
    if (!imageUrl.trim()) { toast.error('Please enter an image URL'); return }
    const newContent = (lesson.content || '') + `\n\n![Image description](${imageUrl.trim()})\n\n`
    onUpdate({ content: newContent })
    setImageUrl('')
    setShowImageInput(false)
    toast.success('Image block added')
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-6 py-8 md:px-10 md:py-10">
      {/* Lesson title */}
      <Input
        className="text-3xl font-bold border-none px-0 focus-visible:ring-0 bg-transparent mb-2"
        value={lesson.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        placeholder="Lesson title"
      />
      <div className="flex items-center gap-3 mb-6">
        <Badge variant="secondary" className="text-xs">{lesson.type}</Badge>
        <span className="text-sm text-muted-foreground">{lesson.duration} min</span>
        {lesson.isPreview && <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600">Free Preview</Badge>}
      </div>

      {/* Content editor */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Lesson Content</Label>
        <Textarea
          rows={16}
          className="text-sm leading-relaxed"
          value={lesson.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Write your lesson content here. You can use markdown for formatting.

# Introduction
Explain what students will learn in this lesson.

## Key Points
- Point 1
- Point 2

## Exercise
Complete the following exercise to practice what you've learned."
        />
      </div>

      {/* Add block button + picker */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={() => setShowBlockPicker(!showBlockPicker)}
          className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:scale-105 hover:border-primary hover:text-primary hover:shadow-md"
        >
          <Plus className="h-4 w-4" /> Add block
        </button>

        <AnimatePresence>
          {showBlockPicker && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-3 shadow-lg">
                {BLOCK_TYPES.map((bt) => {
                  const Icon = bt.icon
                  return (
                    <button
                      key={bt.label}
                      onClick={() => addBlock(bt)}
                      className="group flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center hover:border-primary/40 hover:bg-primary/5 transition"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted group-hover:bg-primary/10 transition">
                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <span className="text-xs font-medium">{bt.label}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video URL input */}
        <AnimatePresence>
          {showVideoInput && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg space-y-3"
            >
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Add Video</p>
                <button onClick={() => setShowVideoInput(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Input
                autoFocus
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste YouTube, Vimeo, or direct video URL..."
                onKeyDown={(e) => e.key === 'Enter' && insertVideoBlock()}
              />
              <p className="text-xs text-muted-foreground">Supports YouTube, Vimeo, and direct video URLs (MP4, WebM)</p>
              <Button size="sm" onClick={insertVideoBlock} className="w-full">Add Video</Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image URL input */}
        <AnimatePresence>
          {showImageInput && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg space-y-3"
            >
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Add Image</p>
                <button onClick={() => setShowImageInput(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Input
                autoFocus
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste image URL..."
                onKeyDown={(e) => e.key === 'Enter' && insertImageBlock()}
              />
              <p className="text-xs text-muted-foreground">Paste a direct image URL (JPG, PNG, GIF, WebP)</p>
              <Button size="sm" onClick={insertImageBlock} className="w-full">Add Image</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Right Panel (settings) ──────────────────────────────────────────────────
function RightPanel({ lesson, course, onUpdateLesson, onUpdateCourse, onClose }: {
  lesson: Lesson | null
  course: CourseFull
  onUpdateLesson: (patch: Partial<Lesson>) => void
  onUpdateCourse: (patch: Partial<CourseFull>) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'lesson' | 'course'>('lesson')

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/50 shrink-0">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setTab('lesson')}
            className={cn('rounded-md px-3 py-1 text-sm font-medium transition', tab === 'lesson' ? 'bg-background shadow-sm' : 'text-muted-foreground')}
          >
            Lesson
          </button>
          <button
            onClick={() => setTab('course')}
            className={cn('rounded-md px-3 py-1 text-sm font-medium transition', tab === 'course' ? 'bg-background shadow-sm' : 'text-muted-foreground')}
          >
            Course
          </button>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Collapse (Ctrl+Shift+\)">
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin min-h-0">
        <div className="p-4 space-y-5">
          {tab === 'lesson' && lesson ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Lesson title</Label>
                <Input value={lesson.title} onChange={(e) => onUpdateLesson({ title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Duration (minutes)</Label>
                <Input type="number" value={lesson.duration} onChange={(e) => onUpdateLesson({ duration: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Type</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={lesson.type}
                  onChange={(e) => onUpdateLesson({ type: e.target.value })}
                >
                  <option value="VIDEO">Video</option>
                  <option value="TEXT">Text</option>
                  <option value="QUIZ">Quiz</option>
                  <option value="PDF">PDF</option>
                  <option value="DOWNLOAD">Download</option>
                </select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Free preview</p>
                  <p className="text-xs text-muted-foreground">Allow non-enrolled users to preview</p>
                </div>
                <button
                  onClick={() => onUpdateLesson({ isPreview: !lesson.isPreview })}
                  className={cn('relative h-6 w-11 rounded-full transition', lesson.isPreview ? 'bg-primary' : 'bg-muted')}
                >
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition', lesson.isPreview ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
            </>
          ) : tab === 'lesson' && !lesson ? (
            <div className="text-center py-12">
              <Settings className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">No lesson selected</p>
              <p className="text-xs text-muted-foreground mt-1">Select a lesson to edit its settings.</p>
            </div>
          ) : (
            <>
              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Course description</Label>
                <Textarea
                  rows={3}
                  value={course.description}
                  onChange={(e) => onUpdateCourse({ description: e.target.value })}
                  placeholder="What will students learn?"
                />
              </div>

              {/* Category & Level */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Category</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={course.category}
                    onChange={(e) => onUpdateCourse({ category: e.target.value })}
                  >
                    {['Marketing', 'YouTube', 'Community', 'Email', 'Productivity', 'AI', 'Business', 'Design', 'Finance'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Level</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={course.level}
                    onChange={(e) => onUpdateCourse({ level: e.target.value })}
                  >
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-muted-foreground" /> Pricing</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={course.price}
                    onChange={(e) => onUpdateCourse({ price: parseFloat(e.target.value) || 0 })}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">USD</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onUpdateCourse({ price: 0 })}
                    className={cn('flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition', course.price === 0 ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}
                  >
                    <Globe className="h-3 w-3 inline mr-1" />Free
                  </button>
                  <button
                    onClick={() => onUpdateCourse({ price: course.price === 0 ? 99 : course.price })}
                    className={cn('flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition', course.price > 0 ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}
                  >
                    <Lock className="h-3 w-3 inline mr-1" />Paid
                  </button>
                </div>
                {course.price === 0 ? (
                  <p className="text-xs text-emerald-600 flex items-center gap-1"><Globe className="h-3 w-3" /> Free course — anyone can enroll</p>
                ) : (
                  <p className="text-xs text-amber-600 flex items-center gap-1"><Lock className="h-3 w-3" /> Paid course — ${course.price} to enroll</p>
                )}
              </div>

              {/* Access control */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5"><Users className="h-4 w-4 text-muted-foreground" /> Access</Label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/50 transition">
                    <input type="radio" name="access" defaultChecked className="accent-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Public</p>
                      <p className="text-xs text-muted-foreground">Anyone can purchase this course</p>
                    </div>
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/50 transition">
                    <input type="radio" name="access" className="accent-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Community members only</p>
                      <p className="text-xs text-muted-foreground">Only community members can access</p>
                    </div>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/50 transition">
                    <input type="radio" name="access" className="accent-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Private (invite only)</p>
                      <p className="text-xs text-muted-foreground">Only invited students can access</p>
                    </div>
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </label>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onUpdateCourse({ status: 'DRAFT' })}
                    className={cn('flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition', course.status === 'DRAFT' ? 'border-amber-500 bg-amber-500/10 text-amber-600' : 'hover:bg-muted')}
                  >
                    Draft
                  </button>
                  <button
                    onClick={() => onUpdateCourse({ status: 'PUBLISHED' })}
                    className={cn('flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition', course.status === 'PUBLISHED' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'hover:bg-muted')}
                  >
                    Published
                  </button>
                  <button
                    onClick={() => onUpdateCourse({ status: 'ARCHIVED' })}
                    className={cn('flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition', course.status === 'ARCHIVED' ? 'border-muted bg-muted text-muted-foreground' : 'hover:bg-muted')}
                  >
                    Archived
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stats</p>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Students</span><span className="font-medium">{course.studentsCount.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Lessons</span><span className="font-medium">{course.totalLessons}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Rating</span><span className="font-medium">{course.rating}★</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Revenue</span><span className="font-medium">${(course.studentsCount * course.price).toLocaleString()}</span></div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default CourseBuilder
