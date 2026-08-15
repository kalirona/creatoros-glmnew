'use client'
import { Search, Bell, Sun, Moon, Command, Plus, GraduationCap, Package, Users, FileText, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { ALL_NAV_ITEMS } from '@/lib/nav'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { ModuleId } from '@/lib/nav'
import { useUser, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export function Topbar() {
  const { setCommandOpen, theme, toggleTheme, activeModule, setActiveModule, triggerCreateDialog } = useAppStore()
  const { isSignedIn, isLoaded, user } = useUser()
  const current = ALL_NAV_ITEMS.find((i) => i.id === activeModule)

  const create = (label: string, target: ModuleId) => {
    triggerCreateDialog(target)
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 backdrop-blur-xl px-4 md:px-6">
      <div className="hidden md:block min-w-0">
        <h1 className="text-sm font-semibold tracking-tight truncate">{current?.label}</h1>
        <p className="text-[11px] text-muted-foreground truncate">{current?.description}</p>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => setCommandOpen(true)}
        className="group hidden sm:flex items-center gap-2 h-9 w-full max-w-[280px] rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground hover:bg-muted transition"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search or jump to...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border bg-background px-1.5 text-[10px] font-medium">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setCommandOpen(true)}>
        <Search className="h-4 w-4" />
      </Button>

      {/* Create dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="hidden md:inline-flex h-9 shadow-sm">
            <Plus className="h-4 w-4 mr-1" /> Create
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Create new</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => create('New Course', 'courses')}>
              <GraduationCap className="h-4 w-4 mr-2" /> New Course
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => create('New Product', 'products')}>
              <Package className="h-4 w-4 mr-2" /> Digital Product
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => create('New Post', 'community')}>
              <Users className="h-4 w-4 mr-2" /> Community Post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => create('New Page', 'pages-funnels')}>
              <FileText className="h-4 w-4 mr-2" /> Landing Page
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setActiveModule('ai-studio')}>
            <Sparkles className="h-4 w-4 mr-2 text-primary" /> Generate with AI
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            Notifications <Badge variant="secondary" className="text-[10px]">3 new</Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { t: 'New sale: Pro Membership', d: '2 min ago', a: '$199.00', action: () => { setActiveModule('store'); toast.info('Opening Orders') } },
            { t: 'Marcus Lee posted in Community', d: '12 min ago', action: () => { setActiveModule('community'); toast.info('Opening Community') } },
            { t: 'AI Assistant finished', d: '1 hour ago', action: () => { setActiveModule('ai-studio'); toast.info('Opening AI Assistant') } },
          ].map((n, i) => (
            <DropdownMenuItem key={i} className="flex-col items-start gap-0.5 py-2.5 cursor-pointer" onClick={n.action}>
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium">{n.t}</span>
                {n.a && <span className="text-xs font-semibold text-primary">{n.a}</span>}
              </div>
              <span className="text-[11px] text-muted-foreground">{n.d}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clerk Auth Controls */}
      <div className="flex items-center gap-2">
        {isLoaded && isSignedIn ? (
          /* Signed in: show user button (avatar + dropdown) */
          <div className="[&>div]:!h-8 [&>div]:!w-8">
            <UserButton />
          </div>
        ) : isLoaded && !isSignedIn ? (
          /* Signed out: show sign-in + sign-up buttons */
          <>
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="h-8 text-xs">Sign in</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="h-8 text-xs">Sign up</Button>
            </Link>
          </>
        ) : null}
      </div>
    </header>
  )
}
