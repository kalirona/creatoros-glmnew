'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Star, Users, Clock, PlayCircle, Lock, FileText, Video, FileQuestion,
  ArrowLeft, Plus, GraduationCap, Sparkles, CheckCircle2, Circle, BookOpen,
  MoreVertical, Pencil, Copy, Trash2, Eye, BarChart3, Rocket, Archive, Loader2,
  Settings, Save
} from 'lucide-react'
import { useApi, formatCurrency, formatNumber } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { CreateDialog } from '@/components/app/create-dialog'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Lesson { id: string; title: string; type: string; duration: number; isPreview: boolean; content: string }
interface Section { id: string; title: string; position: number; lessons: Lesson[] }
interface Course {
  id: string; title: string; description: string; category: string; price: number; level: string;
  rating: number; studentsCount: number; status: string; sections: Section[];
  totalLessons: number; totalDuration: number; thumbnailUrl?: string | null; createdBy?: string | null;
}

const LEVEL_STYLES: Record<string, string> = {
  BEGINNER: 'bg-emerald-500/10 text-emerald-600',
  INTERMEDIATE: 'bg-amber-500/10 text-amber-600',
  ADVANCED: 'bg-rose-500/10 text-rose-600',
}

const COVER_GRADIENTS = [
  'from-emerald-500/20 to-teal-500/10',
  'from-violet-500/20 to-fuchsia-500/10',
  'from-amber-500/20 to-orange-500/10',
  'from-sky-500/20 to-cyan-500/10',
  'from-rose-500/20 to-pink-500/10',
  'from-indigo-500/20 to-purple-500/10',
]

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: 'Published', cls: 'bg-emerald-500/10 text-emerald-600' },
  DRAFT: { label: 'Draft', cls: 'bg-amber-500/10 text-amber-600' },
  ARCHIVED: { label: 'Archived', cls: 'bg-muted text-muted-foreground' },
}

export function CoursesModule() {
  const { data: courses, loading, refetch } = useApi<Course[]>('/api/data/courses')
  const [query, setQuery] = useState('')
  const [previewingCourse, setPreviewingCourse] = useState<Course | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const { activeSubTab, setActiveModule, openBuilder, createDialogFor, clearCreateDialog } = useAppStore()

  // Auto-open create dialog when triggered from topbar
  useEffect(() => {
    if (createDialogFor === 'courses') {
      const t = setTimeout(() => { setCreateOpen(true); clearCreateDialog() }, 0)
      return () => clearTimeout(t)
    }
  }, [createDialogFor, clearCreateDialog])

  // If "students" sub-tab is active, show Students view
  if (activeSubTab === 'students') {
    return <StudentsView onBack={() => { setActiveModule('courses') }} />
  }

  // If previewing, show the student preview
  if (previewingCourse) {
    return <CoursePreview course={previewingCourse} onBack={() => setPreviewingCourse(null)} />
  }

  const filtered = (courses || []).filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  )

  // Course actions
  const deleteCourse = async (course: Course) => {
    if (!confirm(`Delete "${course.title}"? This will permanently remove the course and all its lessons. This cannot be undone.`)) return
    setActionLoading(course.id)
    try {
      const res = await fetch(`/api/data/courses?id=${course.id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      toast.success('Course deleted', { description: `"${course.title}" has been permanently removed.` })
      refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setActionLoading(null) }
  }

  const duplicateCourse = async (course: Course) => {
    setActionLoading(course.id)
    try {
      const res = await fetch(`/api/data/courses/duplicate?id=${course.id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('Course duplicated', { description: `"${course.title} (Copy)" has been created as a draft.` })
      refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setActionLoading(null) }
  }

  const togglePublish = async (course: Course) => {
    const newStatus = course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    setActionLoading(course.id)
    try {
      const res = await fetch('/api/data/courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: course.id, status: newStatus }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      toast.success(newStatus === 'PUBLISHED' ? 'Course published' : 'Course unpublished', {
        description: `"${course.title}" is now ${newStatus === 'PUBLISHED' ? 'live and visible to students' : 'a draft'}.`
      })
      refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setActionLoading(null) }
  }

  const archiveCourse = async (course: Course) => {
    setActionLoading(course.id)
    try {
      const res = await fetch('/api/data/courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: course.id, status: 'ARCHIVED' }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      toast.success('Course archived', { description: `"${course.title}" has been archived.` })
      refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setActionLoading(null) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setActiveModule('ai-studio')}>
            <Sparkles className="h-4 w-4 mr-1.5 text-primary" /> Generate with AI
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New Course</Button>
        </div>
      </div>

      {/* Stats strip */}
      {!loading && courses && courses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Courses', value: courses.length, icon: GraduationCap },
            { label: 'Total Students', value: formatNumber(courses.reduce((s, c) => s + c.studentsCount, 0), true), icon: Users },
            { label: 'Avg Rating', value: `${(courses.reduce((s, c) => s + c.rating, 0) / courses.length).toFixed(1)}★`, icon: Star },
            { label: 'Total Lessons', value: courses.reduce((s, c) => s + c.totalLessons, 0), icon: BookOpen },
          ].map((s) => {
            const Icon = s.icon
            return (
              <Card key={s.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-lg font-bold tabular-nums leading-none">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
              <GraduationCap className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold">{query ? 'No courses match your search' : 'No courses yet'}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">{query ? 'Try a different search term.' : 'Create your first course to start teaching.'}</p>
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New Course</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => {
            const sm = STATUS_META[c.status] || STATUS_META.DRAFT
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="group overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all flex flex-col h-full">
                  {/* Cover */}
                  <div className={cn('relative h-32 bg-gradient-to-br cursor-pointer', COVER_GRADIENTS[i % COVER_GRADIENTS.length])} onClick={() => openBuilder(c.id)}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <GraduationCap className="h-12 w-12 text-foreground/30" />
                    </div>
                    <Badge className="absolute top-3 left-3" variant="secondary">{c.category}</Badge>
                    <Badge className={cn('absolute top-3 right-3', LEVEL_STYLES[c.level])} variant="secondary">{c.level}</Badge>
                    <Badge className={cn('absolute bottom-3 right-3 text-xs', sm.cls)} variant="secondary">{sm.label}</Badge>
                  </div>

                  <CardContent className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition cursor-pointer" onClick={() => openBuilder(c.id)}>{c.title}</h3>
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 flex-1">{c.description}</p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{c.rating}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{formatNumber(c.studentsCount, true)}</span>
                      <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{c.totalLessons}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <span className="text-sm font-bold text-primary">{c.price === 0 ? 'Free' : formatCurrency(c.price)}</span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => openBuilder(c.id)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={actionLoading === c.id}>
                              {actionLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreVertical className="h-3.5 w-3.5" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setPreviewingCourse(c)}><Eye className="h-4 w-4 mr-2" /> Preview</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { toast.info('Opening analytics', { description: `Loading analytics for "${c.title}"` }); setActiveModule('analytics') }}><BarChart3 className="h-4 w-4 mr-2" /> View Analytics</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateCourse(c)}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {c.status === 'PUBLISHED' ? (
                              <DropdownMenuItem onClick={() => togglePublish(c)}><Archive className="h-4 w-4 mr-2" /> Unpublish</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => togglePublish(c)}><Rocket className="h-4 w-4 mr-2" /> Publish</DropdownMenuItem>
                            )}
                            {c.status !== 'ARCHIVED' && (
                              <DropdownMenuItem onClick={() => archiveCourse(c)}><Archive className="h-4 w-4 mr-2" /> Archive</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => deleteCourse(c)} className="text-rose-600 focus:text-rose-700"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={(v) => { setCreateOpen(v); if (!v) refetch() }}
        config={{
          title: 'New Course',
          description: 'Create a new course. You can add lessons and sections after creation.',
          aiHint: 'Want AI to design the full course outline for you? Use the Course Generator.',
          submitLabel: 'Create course',
          apiEndpoint: '/api/data/courses',
          entityName: 'Course',
          onCreated: (data) => {
            if (data?.id) {
              // Auto-open the builder for the newly created course
              setTimeout(() => openBuilder(data.id as string), 300)
            }
          },
          fields: [
            { name: 'title', label: 'Course title', type: 'text', placeholder: 'e.g. Mastering Notion for Creators', required: true },
            { name: 'description', label: 'Short description', type: 'textarea', placeholder: 'What will students learn?' },
            { name: 'category', label: 'Category', type: 'select', defaultValue: 'Marketing', options: [
              { value: 'Marketing', label: 'Marketing' }, { value: 'YouTube', label: 'YouTube' }, { value: 'Community', label: 'Community' },
              { value: 'Email', label: 'Email' }, { value: 'Productivity', label: 'Productivity' }, { value: 'AI', label: 'AI' },
            ] },
            { name: 'level', label: 'Level', type: 'select', defaultValue: 'BEGINNER', options: [
              { value: 'BEGINNER', label: 'Beginner' }, { value: 'INTERMEDIATE', label: 'Intermediate' }, { value: 'ADVANCED', label: 'Advanced' },
            ] },
            { name: 'price', label: 'Price (USD)', type: 'number', defaultValue: '99', placeholder: '99' },
          ],
        }}
      />
    </div>
  )
}

// ============================================================================
// COURSE EDITOR (admin view — not the student player)
// ============================================================================
function CourseEditor({ course, onBack }: { course: Course; onBack: () => void }) {
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(course.description)
  const [category, setCategory] = useState(course.category)
  const [level, setLevel] = useState(course.level)
  const [price, setPrice] = useState(String(course.price))
  const [status, setStatus] = useState(course.status)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'outline' | 'settings' | 'pricing'>('outline')

  const save = async () => {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/data/courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: course.id, title: title.trim(), description, category, level, price: parseFloat(price) || 0, status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('Course saved', { description: `"${title}" has been updated.` })
    } catch (e) {
      toast.error('Failed to save', { description: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async () => {
    const newStatus = status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    setSaving(true)
    try {
      const res = await fetch('/api/data/courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: course.id, status: newStatus }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      setStatus(newStatus)
      toast.success(newStatus === 'PUBLISHED' ? 'Course published!' : 'Course unpublished', {
        description: `"${title}" is now ${newStatus === 'PUBLISHED' ? 'live' : 'a draft'}.`
      })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1.5" /> Courses</Button>
          <Badge variant="secondary" className={cn('text-xs', (STATUS_META[status] || STATUS_META.DRAFT).cls)}>{status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-1.5" /> {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" onClick={togglePublish} disabled={saving}>
            {status === 'PUBLISHED' ? <><Archive className="h-4 w-4 mr-1.5" /> Unpublish</> : <><Rocket className="h-4 w-4 mr-1.5" /> Publish</>}
          </Button>
        </div>
      </div>

      {/* Title */}
      <div>
        <Input
          className="text-2xl font-bold border-none px-0 focus-visible:ring-0 bg-transparent"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Course title"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['outline', 'settings', 'pricing'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition border-b-2 -mb-px capitalize',
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'outline' ? 'Curriculum' : tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'outline' && (
        <CourseOutline course={course} />
      )}

      {activeTab === 'settings' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will students learn?" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Marketing', 'YouTube', 'Community', 'Email', 'Productivity', 'AI'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Level</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BEGINNER">Beginner</SelectItem>
                    <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                    <SelectItem value="ADVANCED">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'pricing' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Price (USD)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
              <p className="text-xs text-muted-foreground">Set to 0 for a free course</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Pricing Summary</p>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Current price</span><span className="font-bold text-primary">{parseFloat(price) === 0 ? 'Free' : formatCurrency(parseFloat(price) || 0)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Students enrolled</span><span>{formatNumber(course.studentsCount)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total revenue</span><span>{formatCurrency(course.studentsCount * course.price)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// COURSE OUTLINE (editable sections & lessons)
// ============================================================================
function CourseOutline({ course }: { course: Course }) {
  return (
    <div className="space-y-4">
      {course.sections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
              <BookOpen className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold">No sections yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">Add your first section to start building the curriculum.</p>
            <Button size="sm" className="mt-4" onClick={() => toast.info('Section builder coming soon', { description: 'Use the full Course Builder for section management.' })}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Section
            </Button>
          </CardContent>
        </Card>
      ) : (
        course.sections.map((section, sIdx) => (
          <Card key={section.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">{sIdx + 1}</span>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <Badge variant="secondary" className="text-xs ml-auto">{section.lessons.length} lessons</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {section.lessons.map((lesson, lIdx) => {
                const Icon = lesson.type === 'VIDEO' ? Video : lesson.type === 'PDF' ? FileText : lesson.type === 'QUIZ' ? FileQuestion : FileText
                return (
                  <div key={lesson.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition">
                    <span className="text-xs text-muted-foreground w-6 shrink-0">{lIdx + 1}.</span>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{lesson.title}</span>
                    {lesson.isPreview && <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600">Free Preview</Badge>}
                    <span className="text-xs text-muted-foreground shrink-0">{lesson.duration}m</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

// ============================================================================
// COURSE PREVIEW (student view — read-only)
// ============================================================================
function CoursePreview({ course, onBack }: { course: Course; onBack: () => void }) {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(course.sections[0]?.lessons[0] || null)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Courses</Button>
        <Badge variant="secondary" className="text-xs bg-sky-500/10 text-sky-600"><Eye className="h-3 w-3 mr-1" /> Preview Mode</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Main */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className={cn('relative aspect-video bg-gradient-to-br', COVER_GRADIENTS[0])}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background/80 backdrop-blur hover:scale-110 transition cursor-pointer">
                  <PlayCircle className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-4">
                <Badge variant="secondary" className="mb-1">{activeLesson?.type || 'VIDEO'}</Badge>
                <p className="text-white font-medium text-sm">{activeLesson?.title}</p>
              </div>
            </div>
          </Card>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{course.category}</Badge>
              <Badge variant="secondary" className={LEVEL_STYLES[course.level]}>{course.level}</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{course.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{course.rating} rating</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{formatNumber(course.studentsCount)} students</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{Math.floor(course.totalDuration / 60)}h {course.totalDuration % 60}m</span>
              <span className="flex items-center gap-1.5"><PlayCircle className="h-4 w-4" />{course.totalLessons} lessons</span>
            </div>
          </div>

          {activeLesson && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-2">{activeLesson.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{activeLesson.content}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: curriculum */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3 pb-3 border-b">
              <span className="text-2xl font-bold text-primary">{course.price === 0 ? 'Free' : formatCurrency(course.price)}</span>
            </div>
            <ScrollArea className="h-[420px] scroll-thin -mr-2 pr-2">
              <div className="space-y-4">
                {course.sections.map((s) => (
                  <div key={s.id}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{s.title}</p>
                    <div className="space-y-0.5">
                      {s.lessons.map((l) => {
                        const Icon = l.type === 'VIDEO' ? Video : l.type === 'PDF' ? FileText : l.type === 'QUIZ' ? FileQuestion : FileText
                        const isActive = activeLesson?.id === l.id
                        return (
                          <button key={l.id} onClick={() => setActiveLesson(l)}
                            className={cn('group flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm transition',
                              isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}>
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate text-xs">{l.title}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{l.duration}m</span>
                            {l.isPreview ? <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">Free</Badge>
                              : <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Students View ───────────────────────────────────────────────────────────

function StudentsView({ onBack }: { onBack: () => void }) {
  const { data, loading, refetch } = useApi<{
    members: Array<{
      id: string; userId: string; name: string; email: string; avatarUrl?: string | null;
      bio?: string | null; role: string; memberStatus: string;
      joinedAt: string; lastSeenAt: string;
      postsCount: number; commentsCount: number; likesReceived: number;
    }>
    total: number; page: number; pageSize: number; totalPages: number
  }>('/api/community/members?page=1&pageSize=50&sort=joinedAt&order=desc')
  const [search, setSearch] = useState('')

  const members = data?.members || []
  const filtered = members.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground mt-1">All enrolled students across your courses and community.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Courses</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{data?.total || 0}</p><p className="text-xs text-muted-foreground">Total Students</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-emerald-500">{filtered.filter(m => m.memberStatus === 'ACTIVE').length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-amber-500">{filtered.filter(m => m.memberStatus !== 'ACTIVE').length}</p><p className="text-xs text-muted-foreground">Restricted</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-primary">{filtered.filter(m => Date.now() - new Date(m.lastSeenAt).getTime() < 3600000).length}</p><p className="text-xs text-muted-foreground">Online (1h)</p></CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students by name or email..." className="pl-9" />
      </div>

      {/* Students table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No students found.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-4 hover:bg-muted/50 transition">
                  <Avatar className="h-10 w-10">
                    {m.avatarUrl ? <img src={m.avatarUrl} alt={m.name} className="h-full w-full rounded-full object-cover" /> : null}
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">{m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                      <Badge variant="outline" className={cn('text-[10px]', m.memberStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>{m.memberStatus}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="text-right"><p className="font-medium text-foreground">{m.postsCount}</p><p>posts</p></div>
                    <div className="text-right"><p className="font-medium text-foreground">{m.commentsCount}</p><p>comments</p></div>
                    <div className="text-right"><p className="font-medium text-foreground">{m.likesReceived}</p><p>likes</p></div>
                    <div className="text-right"><p className="font-medium text-foreground">{new Date(m.joinedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p><p>joined</p></div>
                    <div className="text-right"><p className="font-medium text-foreground">{new Date(m.lastSeenAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p><p>last seen</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
