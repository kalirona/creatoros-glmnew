'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronDown, Sparkles, Plus, Crown } from 'lucide-react'
import { NAV_GROUPS, ADMIN_NAV_GROUP, type NavItem, type ModuleId } from '@/lib/nav'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BuyCreditsDialog } from '@/components/app/buy-credits-dialog'

export function Sidebar() {
  const { activeModule, setActiveModule, sidebarCollapsed, toggleSidebar } = useAppStore()
  const [credits, setCredits] = useState(4280)
  const [buyOpen, setBuyOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([String(activeModule)]))

  // Check if user is platform owner (for now, always show admin — in production this would check user.role === 'SUPER_ADMIN')
  const isPlatformOwner = true

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleItemClick = (item: NavItem) => {
    setActiveModule(item.id)
    if (item.subItems && !expandedGroups.has(item.id)) {
      toggleGroup(item.id)
    }
  }

  const handleSubItemClick = (moduleId: ModuleId) => {
    setActiveModule(moduleId)
  }

  const allGroups = isPlatformOwner ? [...NAV_GROUPS, ADMIN_NAV_GROUP] : NAV_GROUPS

  return (
    <aside
      className={cn(
        'relative z-30 flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out',
        sidebarCollapsed ? 'w-[68px]' : 'w-[248px]'
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-4 border-b border-sidebar-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold tracking-tight leading-none">CreatorOS</p>
            <p className="text-[11px] text-muted-foreground mt-1">Scale Plan</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 z-40 hidden h-6 w-6 items-center justify-center rounded-full border bg-card shadow-md md:flex hover:bg-accent transition"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className={cn('h-3.5 w-3.5 transition-transform', sidebarCollapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-4">
        {allGroups.map((group, groupIdx) => (
          <div key={group.title || `group-${groupIdx}`}>
            {!sidebarCollapsed && group.title && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = activeModule === item.id
                const hasSubs = item.subItems && item.subItems.length > 0
                const isExpanded = expandedGroups.has(item.id)
                const isAdmin = item.id === 'admin'

                return (
                  <div key={item.id}>
                    <button
                      onClick={() => handleItemClick(item)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : isAdmin
                          ? 'text-amber-600/80 hover:bg-amber-500/10 hover:text-amber-600'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                        sidebarCollapsed && 'justify-center'
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary', isAdmin && !active && 'text-amber-500')} />
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold uppercase bg-primary/10 text-primary">
                              {item.badge}
                            </Badge>
                          )}
                          {hasSubs && (
                            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                          )}
                        </>
                      )}
                    </button>

                    {/* Sub-items (collapsible) */}
                    {!sidebarCollapsed && hasSubs && (
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="overflow-hidden"
                          >
                            <div className="ml-6 pl-3 border-l border-sidebar-border space-y-0.5 mt-0.5 mb-1">
                              {item.subItems!.map((sub, subIdx) => (
                                <button
                                  key={`${sub.label}-${subIdx}`}
                                  onClick={() => handleSubItemClick(sub.moduleId)}
                                  className={cn(
                                    'flex w-full items-center px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                                    activeModule === sub.moduleId
                                      ? 'text-primary bg-primary/10'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
                                  )}
                                >
                                  {sub.label}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Credits + upgrade */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {!sidebarCollapsed && (
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">AI Credits</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{credits.toLocaleString()}</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${Math.min(100, (credits / 6280) * 100)}%` }} />
            </div>
            <Button size="sm" className="mt-2.5 w-full h-7 text-xs" onClick={() => setBuyOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Buy credits
            </Button>
          </div>
        )}
        {sidebarCollapsed && (
          <Button size="icon" variant="ghost" className="w-full h-9" onClick={() => setBuyOpen(true)} title="Buy credits">
            <Crown className="h-4 w-4 text-primary" />
          </Button>
        )}
        <button
          onClick={() => setActiveModule('settings')}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg p-2 hover:bg-sidebar-accent/50 transition',
            sidebarCollapsed && 'justify-center'
          )}
        >
          <Avatar className="h-8 w-8 ring-2 ring-border">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">AR</AvatarFallback>
          </Avatar>
          {!sidebarCollapsed && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-semibold truncate">Alex Rivera</p>
              <p className="text-[10px] text-muted-foreground truncate">Owner</p>
            </div>
          )}
        </button>
      </div>
      <BuyCreditsDialog open={buyOpen} onOpenChange={setBuyOpen} currentCredits={credits} onPurchase={(c) => setCredits((prev) => prev + c)} />
    </aside>
  )
}
