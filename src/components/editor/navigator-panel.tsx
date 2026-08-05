'use client'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  GripVertical, Copy, EyeOff, Eye, Trash2, Plus, Loader2, Search, X,
  ChevronsDownUp, ChevronsUpDown,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// NavigatorPanel — Left sidebar section tree with search, drag, context menu
// ============================================================================

export interface NavigatorSection {
  id: string
  type: string
  name: string
  icon: LucideIcon
  isHidden: boolean
  preview: string
}

export interface NavigatorPanelProps {
  sections: NavigatorSection[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onDuplicate: (id: string) => void
  onHide: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  busy?: string | null
}

export function NavigatorPanel({
  sections, selectedId, onSelect, onReorder, onDuplicate, onHide, onDelete, onAdd, busy,
}: NavigatorPanelProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [dragOverPos, setDragOverPos] = useState<'before' | 'after' | null>(null)

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections.map((s, i) => ({ ...s, originalIndex: i }))
    const lower = search.toLowerCase()
    return sections
      .map((s, i) => ({ ...s, originalIndex: i }))
      .filter(s => s.name.toLowerCase().includes(lower) || s.type.toLowerCase().includes(lower) || s.preview.toLowerCase().includes(lower))
  }, [sections, search])

  const handleDragStart = (originalIndex: number) => setDragIndex(originalIndex)
  const handleDragOver = (e: React.DragEvent, originalIndex: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === originalIndex) return
    setDragOverIndex(originalIndex)
    // Determine position based on mouse Y
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOverPos(e.clientY < midY ? 'before' : 'after')
  }
  const handleDrop = (originalIndex: number) => {
    if (dragIndex !== null && dragIndex !== originalIndex) {
      let targetIndex = originalIndex
      if (dragOverPos === 'after' && dragIndex < originalIndex) targetIndex = originalIndex
      else if (dragOverPos === 'before' && dragIndex > originalIndex) targetIndex = originalIndex - 1
      else if (dragOverPos === 'after') targetIndex = originalIndex + 1
      else targetIndex = originalIndex
      onReorder(dragIndex, targetIndex > dragIndex ? targetIndex - 1 : targetIndex)
    }
    setDragIndex(null)
    setDragOverIndex(null)
    setDragOverPos(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Navigator</p>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-1">{sections.length}</span>
            <IconBtn icon={ChevronsDownUp} title="Collapse all" onClick={() => {}} />
            <IconBtn icon={ChevronsUpDown} title="Expand all" onClick={() => {}} />
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sections..."
            className="w-full h-7 rounded-md border bg-background pl-7 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Section list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scroll-thin">
        {filteredSections.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {search ? 'No matching sections' : 'No sections yet. Click "Add" to start.'}
          </div>
        ) : (
          filteredSections.map((s) => {
            const Icon = s.icon
            const isSelected = selectedId === s.id
            const isDragOver = dragOverIndex === s.originalIndex
            const isDragging = dragIndex === s.originalIndex
            return (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: isDragging ? 0.4 : 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                draggable
                onDragStart={() => handleDragStart(s.originalIndex)}
                onDragOver={(e) => handleDragOver(e, s.originalIndex)}
                onDragLeave={() => { setDragOverIndex(null); setDragOverPos(null) }}
                onDrop={() => handleDrop(s.originalIndex)}
                className={cn(
                  'group relative flex items-center gap-1.5 rounded-md px-1.5 py-1.5 cursor-pointer transition-colors',
                  isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                  s.isHidden && 'opacity-50',
                )}
                onClick={() => onSelect(s.id)}
              >
                {/* Drop indicator line */}
                {isDragOver && dragOverPos === 'before' && (
                  <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
                {isDragOver && dragOverPos === 'after' && (
                  <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}

                {/* Drag handle */}
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 cursor-grab active:cursor-grabbing" />

                {/* Section number */}
                <span className="text-[9px] font-mono text-muted-foreground/60 w-4 text-center shrink-0">{s.originalIndex + 1}</span>

                {/* Icon */}
                <div className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.preview || s.type}</p>
                </div>

                {/* Hidden indicator */}
                {s.isHidden && <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />}

                {/* Hover actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <NavIconBtn icon={Copy} onClick={(e) => { e.stopPropagation(); onDuplicate(s.id) }} disabled={busy === s.id} title="Duplicate" />
                  <NavIconBtn icon={s.isHidden ? Eye : EyeOff} onClick={(e) => { e.stopPropagation(); onHide(s.id) }} disabled={busy === s.id} title={s.isHidden ? 'Show' : 'Hide'} />
                  <NavIconBtn icon={Trash2} onClick={(e) => { e.stopPropagation(); onDelete(s.id) }} disabled={busy === s.id} title="Delete" danger />
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Add button */}
      <div className="p-2 border-t">
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
        >
          <Plus className="h-3.5 w-3.5" /> Add Section
        </button>
      </div>
    </div>
  )
}

function NavIconBtn({ icon: Icon, onClick, disabled, title, danger }: {
  icon: LucideIcon
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  title: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded transition',
        danger ? 'text-rose-500 hover:bg-rose-500/10' : 'text-muted-foreground hover:bg-muted',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {disabled ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
    </button>
  )
}

function IconBtn({ icon: Icon, title, onClick }: { icon: LucideIcon; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition">
      <Icon className="h-3 w-3" />
    </button>
  )
}
