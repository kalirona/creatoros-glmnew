'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronDown, ChevronRight, Sparkles, Plus, Crown,
  LogOut, Settings, CreditCard, User, Keyboard, HelpCircle,
  type LucideIcon,
} from 'lucide-react'
import { NAV_GROUPS, ADMIN_NAV_GROUP, type NavItem, type ModuleId } from '@/lib/nav'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { BuyCreditsDialog } from '@/components/app/buy-credits-dialog'

export function Sidebar() {
  const { activeModule, setActiveModule, navigateTo, sidebarCollapsed, toggleSidebar, userRole, currentUser: user } = useAppStore()
  const [credits, setCredits] = useState(user?.credits ?? 0)
  const [buyOpen, setBuyOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // RBAC — only SUPER_ADMIN sees platform modules (AI Settings, System Settings)
  const isPlatformOwner = userRole === 'SUPER_ADMIN'

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Check if any sub-item of a parent is currently active
  const isParentActive = (item: NavItem): boolean => {
    if (activeModule === item.id) return true
    if (item.subItems) {
      return item.subItems.some(sub => sub.moduleId === activeModule)
    }
    return false
  }

  const handleItemClick = (item: NavItem) => {
    // Always navigate to the parent module
    setActiveModule(item.id)

    // If has sub-items, always toggle expand/collapse
    if (item.subItems && item.subItems.length > 0) {
      toggleGroup(item.id)
    }
  }

  const handleSubItemClick = (moduleId: ModuleId, subTab?: string) => {
    navigateTo(moduleId, subTab)
  }

  const allGroups = isPlatformOwner ? [...NAV_GROUPS, ADMIN_NAV_GROUP] : NAV_GROUPS

  return (
    <aside
      className={cn(
        'relative z-30 flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out',
        sidebarCollapsed ? 'w-[68px]' : 'w-[256px]'
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-4 border-b border-sidebar-border shrink-0">
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
      <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-3 space-y-3">
        {allGroups.map((group, groupIdx) => (
          <div key={group.title || `group-${groupIdx}`}>
            {!sidebarCollapsed && group.title && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const parentActive = isParentActive(item)
                const hasSubs = item.subItems && item.subItems.length > 0
                const isExpanded = expandedGroups.has(item.id)
                const isAdmin = item.id === 'admin'

                return (
                  <div key={item.id}>
                    <button
                      onClick={() => handleItemClick(item)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                        parentActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : isAdmin
                          ? 'text-amber-600/80 hover:bg-amber-500/10 hover:text-amber-600'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                        sidebarCollapsed && 'justify-center'
                      )}
                    >
                      {parentActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', parentActive && 'text-primary', isAdmin && !parentActive && 'text-amber-500')} />
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold uppercase bg-primary/10 text-primary">
                              {item.badge}
                            </Badge>
                          )}
                          {hasSubs && (
                            <ChevronDown className={cn(
                              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                              isExpanded && 'rotate-180'
                            )} />
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
                            <div className="ml-5 pl-4 border-l border-sidebar-border/60 space-y-px mt-0.5 mb-1">
                              {item.subItems!.map((sub, subIdx) => {
                                const subActive = activeModule === sub.moduleId
                                return (
                                  <button
                                    key={`${sub.label}-${subIdx}`}
                                    onClick={() => handleSubItemClick(sub.moduleId, sub.subTab)}
                                    className={cn(
                                      'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-100',
                                      subActive
                                        ? 'text-primary bg-primary/10'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40'
                                    )}
                                  >
                                    <span className={cn(
                                      'h-1 w-1 rounded-full transition-colors',
                                      subActive ? 'bg-primary' : 'bg-muted-foreground/30'
                                    )} />
                                    {sub.label}
                                  </button>
                                )
                              })}
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

      {/* Bottom section: Credits + Profile */}
      <div className="border-t border-sidebar-border p-3 space-y-2 shrink-0">
        {/* Credits */}
        {!sidebarCollapsed ? (
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
        ) : (
          <Button size="icon" variant="ghost" className="w-full h-9" onClick={() => setBuyOpen(true)} title="Buy credits">
            <Crown className="h-4 w-4 text-primary" />
          </Button>
        )}

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg p-2 hover:bg-sidebar-accent/50 transition cursor-pointer',
                sidebarCollapsed && 'justify-center'
              )}
            >
              <Avatar className="h-8 w-8 ring-2 ring-border shrink-0">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{(user?.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold truncate">{user?.name || "User"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email || ""}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56 mb-2">
            <DropdownMenuLabel className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{(user?.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigateTo('settings', 'profile')}>
              <User className="h-4 w-4 mr-2.5" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigateTo('settings', 'workspace')}>
              <Settings className="h-4 w-4 mr-2.5" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigateTo('settings', 'billing')}>
              <CreditCard className="h-4 w-4 mr-2.5" /> Billing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigateTo('settings', 'security')}>
              <Keyboard className="h-4 w-4 mr-2.5" /> Keyboard Shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigateTo('support')}>
              <HelpCircle className="h-4 w-4 mr-2.5" /> Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10"
              onClick={() => {
                // Sign out — in production this would call /api/auth/logout
                if (typeof window !== 'undefined') {
                  window.location.href = '/'
                }
              }}
            >
              <LogOut className="h-4 w-4 mr-2.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <BuyCreditsDialog open={buyOpen} onOpenChange={setBuyOpen} currentCredits={credits} onPurchase={(c) => setCredits((prev) => prev + c)} />
    </aside>
  )
}
