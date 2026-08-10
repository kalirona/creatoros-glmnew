'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, CornerDownLeft } from 'lucide-react'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command'
import { useAppStore } from '@/store/app-store'
import { ALL_NAV_GROUPS, KEYBOARD_SHORTCUTS, type ModuleId } from '@/lib/nav'

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setActiveModule } = useAppStore()
  const [query, setQuery] = useState('')

  const go = (m: ModuleId) => {
    setActiveModule(m)
    setCommandOpen(false)
    setQuery('')
  }

  // g-key chord navigation
  useEffect(() => {
    let firstKey = ''
    let timer: ReturnType<typeof setTimeout>
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(true)
        return
      }
      if (e.key === 'g') {
        firstKey = 'g'
        clearTimeout(timer)
        timer = setTimeout(() => (firstKey = ''), 700)
        return
      }
      if (firstKey === 'g') {
        const map: Record<string, ModuleId> = {
          d: 'dashboard', a: 'ai-studio', c: 'courses', p: 'products',
          o: 'community', s: 'settings',
          r: 'crm', f: 'pages-funnels',
        }
        const target = map[e.key.toLowerCase()]
        if (target) {
          e.preventDefault()
          go(target)
        }
        firstKey = ''
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandOpen, setActiveModule])

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search modules, create content, run commands..." value={query} onValueChange={setQuery} />
      <CommandList className="scroll-thin">
        <CommandEmpty>No results found.</CommandEmpty>
        {ALL_NAV_GROUPS.map((group) => (
          <CommandGroup key={group.title} heading={group.title}>
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem key={item.id} value={`${item.label} ${item.description}`} onSelect={() => go(item.id)} className="group">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{item.badge}</span>
                  )}
                  <CornerDownLeft className="h-3 w-3 opacity-0 group-aria-selected:opacity-100" />
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => go('ai-studio')}><Search className="h-4 w-4" /> Generate content with AI</CommandItem>
          <CommandItem onSelect={() => go('courses')}>Create a new course</CommandItem>
          <CommandItem onSelect={() => go('products')}>Add a digital product</CommandItem>
          <CommandItem onSelect={() => go('community')}>Post in community</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Keyboard Shortcuts">
          {KEYBOARD_SHORTCUTS.map((s) => (
            <CommandItem key={s.label} value={s.label} onSelect={() => s.moduleId && go(s.moduleId)}>
              <span className="flex-1">{s.label}</span>
              <kbd className="text-[11px] text-muted-foreground">{s.keys}</kbd>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
