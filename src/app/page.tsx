'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from '@/components/app/sidebar'
import { Topbar } from '@/components/app/topbar'
import { CommandPalette } from '@/components/app/command-palette'
import { RbacGuard } from '@/components/app/rbac-guard'
import { useAppStore } from '@/store/app-store'
import { DashboardModule } from '@/components/modules/dashboard'
import type { ModuleId } from '@/lib/nav'

// Lazy-load all modules EXCEPT dashboard (which is the default landing page).
// This dramatically reduces initial bundle size and memory usage,
// preventing OOM kills in the sandbox.
const AiStudioModule = dynamic(() => import('@/components/modules/ai-studio').then(m => m.AiStudioModule), { loading: () => <Skeleton /> })
const CoursesModule = dynamic(() => import('@/components/modules/courses').then(m => m.CoursesModule), { loading: () => <Skeleton /> })
const CommunityModule = dynamic(() => import('@/components/modules/community').then(m => m.CommunityModule), { loading: () => <Skeleton /> })
const ProductsModule = dynamic(() => import('@/components/modules/products').then(m => m.ProductsModule), { loading: () => <Skeleton /> })
const StoreModule = dynamic(() => import('@/components/modules/store').then(m => m.StoreModule), { loading: () => <Skeleton /> })
const MembershipModule = dynamic(() => import('@/components/modules/membership').then(m => m.MembershipModule), { loading: () => <Skeleton /> })
const EmailModule = dynamic(() => import('@/components/modules/email').then(m => m.EmailModule), { loading: () => <Skeleton /> })
const CrmModule = dynamic(() => import('@/components/modules/crm').then(m => m.CrmModule), { loading: () => <Skeleton /> })
const AffiliatesModule = dynamic(() => import('@/components/modules/affiliates').then(m => m.AffiliatesModule), { loading: () => <Skeleton /> })
const AnalyticsModule = dynamic(() => import('@/components/modules/analytics').then(m => m.AnalyticsModule), { loading: () => <Skeleton /> })
const PagesFunnelsModule = dynamic(() => import('@/components/modules/pages-funnels').then(m => m.PagesFunnelsModule), { loading: () => <Skeleton /> })
const SupportModule = dynamic(() => import('@/components/modules/support').then(m => m.SupportModule), { loading: () => <Skeleton /> })
const SettingsModule = dynamic(() => import('@/components/modules/settings').then(m => m.SettingsModule), { loading: () => <Skeleton /> })
const AiSettingsModule = dynamic(() => import('@/components/modules/ai-settings').then(m => m.AiSettingsModule), { loading: () => <Skeleton /> })
const SystemSettingsModule = dynamic(() => import('@/components/modules/system-settings').then(m => m.SystemSettingsModule), { loading: () => <Skeleton /> })
const CertificatesModule = dynamic(() => import('@/components/modules/certificates').then(m => m.CertificatesModule), { loading: () => <Skeleton /> })
const MediaLibraryModule = dynamic(() => import('@/components/modules/media-library').then(m => m.MediaLibraryModule), { loading: () => <Skeleton /> })
const AutomationModule = dynamic(() => import('@/components/modules/automation').then(m => m.AutomationModule), { loading: () => <Skeleton /> })
const CourseBuilder = dynamic(() => import('@/components/course-builder/builder').then(m => m.CourseBuilder), { loading: () => <Skeleton /> })

const MODULES: Partial<Record<ModuleId, React.ComponentType>> = {
  'dashboard': DashboardModule,
  'ai-studio': AiStudioModule,
  'courses': CoursesModule,
  'community': CommunityModule,
  'products': ProductsModule,
  'store': StoreModule,
  'membership': MembershipModule,
  'email': EmailModule,
  'crm': CrmModule,
  'affiliates': AffiliatesModule,
  'analytics': AnalyticsModule,
  'pages-funnels': PagesFunnelsModule,
  'support': SupportModule,
  'settings': SettingsModule,
  'admin': AiSettingsModule, // backward compat: old 'admin' route → AI Settings
  'ai-settings': AiSettingsModule,
  'system-settings': SystemSettingsModule,
  'certificates': CertificatesModule,
  'media-library': MediaLibraryModule,
  'automation': AutomationModule,
}

// Platform modules that require RBAC guard
const PLATFORM_MODULES: ModuleId[] = ['admin', 'ai-settings', 'system-settings']

function Skeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-24 rounded-xl bg-muted animate-pulse" />
      <div className="h-48 rounded-xl bg-muted animate-pulse" />
      <div className="h-48 rounded-xl bg-muted animate-pulse" />
    </div>
  )
}

export default function Home() {
  const activeModule = useAppStore((s) => s.activeModule)
  const builderCourseId = useAppStore((s) => s.builderCourseId)
  const Active = MODULES[activeModule] ?? DashboardModule
  const isPlatformModule = PLATFORM_MODULES.includes(activeModule)

  // ── Full-screen Course Builder (overrides entire dashboard layout) ──
  if (builderCourseId) {
    return <CourseBuilder courseId={builderCourseId} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto scroll-thin bg-grid">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8"
            >
              {isPlatformModule ? (
                <RbacGuard moduleId={activeModule}>
                  <Active />
                </RbacGuard>
              ) : (
                <Active />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
      <CommandPalette />
    </div>
  )
}

function Footer() {
  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-background/60 px-4 md:px-6 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="font-medium text-foreground/70">CreatorOS</span>
        <span className="hidden sm:inline">v2.4.0</span>
        <span className="hidden md:inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          All systems operational
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden sm:inline">Press <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd> for commands</span>
        <span>© 2025 CreatorOS</span>
      </div>
    </footer>
  )
}
