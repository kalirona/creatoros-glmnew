'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GripVertical, ChevronRight, Copy, EyeOff, Eye, Trash2, Plus, Loader2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// NavigatorPanel — Left sidebar section tree
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

  const handleDragStart = (i: number) => setDragIndex(i)
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    setDragOverIndex(i)
  }
  const handleDrop = (i: number) => {
    if (dragIndex !== null && dragIndex !== i) {
      onReorder(dragIndex, i)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Navigator</p>
        <span className="text-[10px] text-muted-foreground">{sections.length} sections</span>
      </div>

      {/* Section list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scroll-thin">
        {sections.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No sections yet. Click "Add" to start.
          </div>
        ) : (
          sections.map((s, i) => {
            const Icon = s.icon
            const isSelected = selectedId === s.id
            const isDragOver = dragOverIndex === i
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={() => handleDrop(i)}
                className={cn(
                  'group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 cursor-pointer transition-colors',
                  isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                  isDragOver && 'ring-2 ring-primary/40',
                  s.isHidden && 'opacity-50',
                  dragIndex === i && 'opacity-40',
                )}
                onClick={() => onSelect(s.id)}
              >
                {/* Drag handle */}
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 cursor-grab" />

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
