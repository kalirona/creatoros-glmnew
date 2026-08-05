'use client'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// EditorLayout — Shared fullscreen editor shell
// ----------------------------------------------------------------------------
// Used by: LandingEditor, CourseBuilder, ProductEditor, EmailEditor, BlogEditor
// Provides: Toolbar (top) | Navigator (left) | Canvas (center) | Inspector (right)
// ============================================================================

export interface EditorLayoutProps {
  toolbar: ReactNode
  navigator?: ReactNode
  inspector?: ReactNode
  canvas: ReactNode
  navigatorWidth?: number
  inspectorWidth?: number
  navigatorCollapsed?: boolean
  inspectorCollapsed?: boolean
  statusBar?: ReactNode
}

export function EditorLayout({
  toolbar,
  navigator,
  inspector,
  canvas,
  navigatorCollapsed = false,
  inspectorCollapsed = false,
  statusBar,
}: EditorLayoutProps) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Toolbar (fixed height) */}
      <div className="flex h-14 shrink-0 items-center border-b bg-card px-3">
        {toolbar}
      </div>

      {/* Body (fills remaining space) */}
      <div className="flex flex-1 min-h-0">
        {/* Navigator (left) */}
        {navigator && !navigatorCollapsed && (
          <div className="w-60 shrink-0 overflow-y-auto border-r bg-card scroll-thin">
            {navigator}
          </div>
        )}

        {/* Canvas (center — fills remaining) */}
        <div className="flex-1 min-w-0 overflow-y-auto scroll-thin bg-muted/30">
          {canvas}
        </div>

        {/* Inspector (right) */}
        {inspector && !inspectorCollapsed && (
          <div className="w-80 shrink-0 overflow-y-auto border-l bg-card scroll-thin">
            {inspector}
          </div>
        )}
      </div>

      {/* Status bar (fixed height) */}
      {statusBar && (
        <div className="flex h-8 shrink-0 items-center border-t bg-card px-3 text-xs text-muted-foreground">
          {statusBar}
        </div>
      )}
    </div>
  )
}

// ─── Toolbar helpers ─────────────────────────────────────────────────────────

export function ToolbarGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-1', className)}>{children}</div>
}

export function ToolbarDivider() {
  return <div className="mx-1.5 h-6 w-px bg-border" />
}

export function ToolbarSpacer() {
  return <div className="flex-1" />
}
