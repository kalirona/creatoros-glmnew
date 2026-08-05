'use client'
import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pencil, Copy, EyeOff, Trash2, Sparkles, Loader2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// CanvasPanel — Center panel with live preview, hover actions, inline editing
// ============================================================================

export interface CanvasSection {
  id: string
  type: string
  content: Record<string, unknown>
  position: number
  isHidden: boolean
}

export interface CanvasPanelProps {
  sections: CanvasSection[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onDuplicate: (id: string) => void
  onHide: (id: string) => void
  onDelete: (id: string) => void
  onAI: (id: string) => void
  onInlineEdit: (id: string, field: string, value: string) => void
  busy?: string | null
  viewport?: 'desktop' | 'tablet' | 'mobile'
  renderSection: (section: CanvasSection, isEditing: boolean) => React.ReactNode
}

export function CanvasPanel({
  sections, selectedId, onSelect, onDuplicate, onHide, onDelete, onAI, onInlineEdit, busy, viewport = 'desktop', renderSection,
}: CanvasPanelProps) {
  const viewportWidth = {
    desktop: 'max-w-none',
    tablet: 'max-w-[768px] mx-auto',
    mobile: 'max-w-[375px] mx-auto',
  }[viewport]

  if (sections.length === 0) {
    return (
      <div className={cn('min-h-full p-8', viewportWidth)}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Pencil className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="mt-4 text-sm font-medium">No sections yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first section from the navigator to start building.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-full p-4 md:p-8', viewportWidth)}>
      <div className="rounded-xl overflow-hidden border bg-white shadow-sm">
        {sections.map((s, i) => (
          <CanvasSectionWrapper
            key={s.id}
            section={s}
            index={i}
            isSelected={selectedId === s.id}
            busy={busy}
            onSelect={() => onSelect(selectedId === s.id ? null : s.id)}
            onDuplicate={() => onDuplicate(s.id)}
            onHide={() => onHide(s.id)}
            onDelete={() => onDelete(s.id)}
            onAI={() => onAI(s.id)}
            renderSection={() => renderSection(s, selectedId === s.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Section wrapper with hover actions ──────────────────────────────────────

function CanvasSectionWrapper({
  section, index, isSelected, busy, onSelect, onDuplicate, onHide, onDelete, onAI, renderSection,
}: {
  section: CanvasSection
  index: number
  isSelected: boolean
  busy?: string | null
  onSelect: () => void
  onDuplicate: () => void
  onHide: () => void
  onDelete: () => void
  onAI: () => void
  renderSection: () => React.ReactNode
}) {
  return (
    <div
      className={cn(
        'group relative transition-all',
        isSelected && 'ring-2 ring-primary ring-inset',
        section.isHidden && 'opacity-40',
      )}
      onClick={onSelect}
    >
      {/* Hover action bar */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -top-9 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 rounded-lg border bg-card shadow-md px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <CanvasActionBtn icon={Pencil} label="Edit" onClick={onSelect} />
          <CanvasActionBtn icon={Copy} label="Duplicate" onClick={onDuplicate} disabled={busy === section.id} />
          <CanvasActionBtn icon={EyeOff} label={section.isHidden ? 'Show' : 'Hide'} onClick={onHide} disabled={busy === section.id} />
          <CanvasActionBtn icon={Trash2} label="Delete" onClick={onDelete} disabled={busy === section.id} danger />
          <CanvasActionBtn icon={Sparkles} label="AI" onClick={onAI} disabled={busy === section.id + 'AI'} primary />
        </motion.div>
      </AnimatePresence>

      {/* Hidden badge */}
      {section.isHidden && (
        <div className="absolute top-2 left-2 z-10">
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Hidden</span>
        </div>
      )}

      {/* Section content */}
      <div className="relative">
        {busy === section.id && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {renderSection()}
      </div>
    </div>
  )
}

function CanvasActionBtn({ icon: Icon, label, onClick, disabled, danger, primary }: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'flex h-7 items-center gap-1 rounded px-1.5 text-[10px] font-medium transition disabled:opacity-30',
        danger ? 'text-rose-500 hover:bg-rose-500/10' :
        primary ? 'text-primary hover:bg-primary/10' :
        'text-muted-foreground hover:bg-muted'
      )}
    >
      {disabled ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      {label}
    </button>
  )
}

// ─── Inline Text Editor ──────────────────────────────────────────────────────

export function InlineText({
  value, onChange, className, as: Tag = 'span',
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'p'
}) {
  const ref = useRef<HTMLElement>(null)
  const [editing, setEditing] = useState(false)

  return (
    <Tag
      // @ts-expect-error — ref works on all these tags
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setEditing(true)}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const newText = e.currentTarget.textContent || ''
        if (newText !== value) onChange(newText)
        setEditing(false)
      }}
      className={cn(
        className,
        'outline-none rounded transition cursor-text',
        editing ? 'ring-2 ring-primary/40 bg-primary/5' : 'hover:ring-1 hover:ring-primary/20'
      )}
    >
      {value}
    </Tag>
  )
}
