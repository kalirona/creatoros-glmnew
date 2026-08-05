'use client'
import { useRef, useState, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pencil, Copy, EyeOff, Eye, Trash2, Sparkles, Loader2,
  ArrowUp, ArrowDown, MoreVertical,
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
  onMove: (id: string, dir: 'up' | 'down') => void
  onInlineEdit: (id: string, field: string, value: string) => void
  busy?: string | null
  viewport?: 'desktop' | 'tablet' | 'mobile'
  renderSection: (section: CanvasSection, isEditing: boolean) => React.ReactNode
}

export function CanvasPanel({
  sections, selectedId, onSelect, onDuplicate, onHide, onDelete, onAI, onMove, onInlineEdit, busy, viewport = 'desktop', renderSection,
}: CanvasPanelProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sectionId: string } | null>(null)

  const viewportWidth = {
    desktop: 'max-w-none',
    tablet: 'max-w-[768px] mx-auto',
    mobile: 'max-w-[375px] mx-auto',
  }[viewport]

  const handleContextMenu = useCallback((e: React.MouseEvent, sectionId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, sectionId })
  }, [])

  // Close context menu on click anywhere
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  if (sections.length === 0) {
    return (
      <div className={cn('min-h-full p-8', viewportWidth)} onClick={closeContextMenu}>
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
    <div className={cn('min-h-full p-4 md:p-8 transition-all duration-300', viewportWidth)} onClick={closeContextMenu}>
      <div className="rounded-xl overflow-hidden border bg-white shadow-sm">
        {sections.map((s, i) => (
          <MemoizedSectionWrapper
            key={s.id}
            section={s}
            index={i}
            totalSections={sections.length}
            isSelected={selectedId === s.id}
            busy={busy}
            onSelect={() => onSelect(selectedId === s.id ? null : s.id)}
            onDuplicate={() => onDuplicate(s.id)}
            onHide={() => onHide(s.id)}
            onDelete={() => onDelete(s.id)}
            onAI={() => onAI(s.id)}
            onMoveUp={() => onMove(s.id, 'up')}
            onMoveDown={() => onMove(s.id, 'down')}
            onContextMenu={(e) => handleContextMenu(e, s.id)}
            renderSection={() => renderSection(s, selectedId === s.id)}
          />
        ))}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          sectionId={contextMenu.sectionId}
          sections={sections}
          onDuplicate={onDuplicate}
          onHide={onHide}
          onDelete={onDelete}
          onAI={onAI}
          onMove={onMove}
          onClose={closeContextMenu}
        />
      )}
    </div>
  )
}

// ─── Memoized Section Wrapper (prevents unnecessary re-renders) ──────────────

const MemoizedSectionWrapper = memo(function CanvasSectionWrapper({
  section, index, totalSections, isSelected, busy, onSelect, onDuplicate, onHide, onDelete, onAI, onMoveUp, onMoveDown, onContextMenu, renderSection,
}: {
  section: CanvasSection
  index: number
  totalSections: number
  isSelected: boolean
  busy?: string | null
  onSelect: () => void
  onDuplicate: () => void
  onHide: () => void
  onDelete: () => void
  onAI: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onContextMenu: (e: React.MouseEvent) => void
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
      onContextMenu={onContextMenu}
    >
      {/* Floating hover toolbar — centered, larger buttons */}
      <div
        className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-xl border bg-card shadow-lg px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <HoverBtn icon={Pencil} label="Edit" onClick={onSelect} />
        <HoverBtn icon={Sparkles} label="AI" onClick={onAI} disabled={busy === section.id + 'AI'} primary />
        <Divider />
        <HoverBtn icon={ArrowUp} label="Up" onClick={onMoveUp} disabled={index === 0} />
        <HoverBtn icon={ArrowDown} label="Down" onClick={onMoveDown} disabled={index === totalSections - 1} />
        <Divider />
        <HoverBtn icon={Copy} label="Copy" onClick={onDuplicate} disabled={busy === section.id} />
        <HoverBtn icon={section.isHidden ? Eye : EyeOff} label={section.isHidden ? 'Show' : 'Hide'} onClick={onHide} disabled={busy === section.id} />
        <HoverBtn icon={Trash2} label="Delete" onClick={onDelete} disabled={busy === section.id} danger />
      </div>

      {/* Section number badge */}
      <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition">
        <span className="rounded bg-black/60 text-white px-1.5 py-0.5 text-[10px] font-mono">{index + 1}</span>
      </div>

      {/* Hidden badge */}
      {section.isHidden && (
        <div className="absolute top-2 right-2 z-10">
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Hidden</span>
        </div>
      )}

      {/* Section content */}
      <div className="relative">
        {busy === section.id && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {renderSection()}
      </div>
    </div>
  )
})

// ─── Hover Button (larger, better spacing) ───────────────────────────────────

function HoverBtn({ icon: Icon, label, onClick, disabled, danger, primary }: {
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
        'flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed',
        danger ? 'text-rose-500 hover:bg-rose-500/10' :
        primary ? 'text-primary hover:bg-primary/10' :
        'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {disabled && busyLabel(label) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
    </button>
  )
}

function busyLabel(label: string) {
  return label === 'AI' || label === 'Copy'
}

function Divider() {
  return <div className="h-5 w-px bg-border mx-0.5" />
}

// ─── Right-click Context Menu ────────────────────────────────────────────────

function ContextMenu({ x, y, sectionId, sections, onDuplicate, onHide, onDelete, onAI, onMove, onClose }: {
  x: number
  y: number
  sectionId: string
  sections: CanvasSection[]
  onDuplicate: (id: string) => void
  onHide: (id: string) => void
  onDelete: (id: string) => void
  onAI: (id: string) => void
  onMove: (id: string, dir: 'up' | 'down') => void
  onClose: () => void
}) {
  const section = sections.find(s => s.id === sectionId)
  if (!section) return null
  const index = sections.findIndex(s => s.id === sectionId)

  // Adjust position to stay in viewport
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 350)

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        className="fixed z-50 w-48 rounded-xl border bg-card shadow-xl py-1.5"
        style={{ left: adjustedX, top: adjustedY }}
        onClick={(e) => e.stopPropagation()}
      >
        <ContextItem icon={Sparkles} label="AI Rewrite" onClick={() => { onAI(sectionId); onClose() }} primary />
        <ContextItem icon={Copy} label="Duplicate" shortcut="⌘D" onClick={() => { onDuplicate(sectionId); onClose() }} />
        <ContextItem icon={section.isHidden ? Eye : EyeOff} label={section.isHidden ? 'Show' : 'Hide'} onClick={() => { onHide(sectionId); onClose() }} />
        <ContextSeparator />
        <ContextItem icon={ArrowUp} label="Move Up" disabled={index === 0} onClick={() => { onMove(sectionId, 'up'); onClose() }} />
        <ContextItem icon={ArrowDown} label="Move Down" disabled={index === sections.length - 1} onClick={() => { onMove(sectionId, 'down'); onClose() }} />
        <ContextSeparator />
        <ContextItem icon={Trash2} label="Delete" shortcut="Del" danger onClick={() => { onDelete(sectionId); onClose() }} />
      </div>
    </>
  )
}

function ContextItem({ icon: Icon, label, shortcut, onClick, disabled, danger, primary }: {
  icon: LucideIcon
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-1.5 text-xs font-medium transition disabled:opacity-30 disabled:cursor-not-allowed',
        danger ? 'text-rose-500 hover:bg-rose-500/10' :
        primary ? 'text-primary hover:bg-primary/10' :
        'text-foreground hover:bg-muted'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-[10px] text-muted-foreground">{shortcut}</span>}
    </button>
  )
}

function ContextSeparator() {
  return <div className="my-1 h-px bg-border" />
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
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { (e.currentTarget as HTMLElement).blur() }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { (e.currentTarget as HTMLElement).blur() }
      }}
      className={cn(
        className,
        'outline-none rounded px-0.5 transition cursor-text',
        editing ? 'ring-2 ring-primary/40 bg-primary/5' : 'hover:ring-1 hover:ring-primary/20'
      )}
    >
      {value}
    </Tag>
  )
}
