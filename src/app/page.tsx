'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from '@/components/app/sidebar'
import { Topbar } from '@/components/app/topbar'
import { CommandPalette } from '@/components/app/command-palette'
import { RbacGuard } from '@/components/app/rbac-guard'
import { useAppStore } from '@/store/app-store'
import { DashboardModule } from '@/components/modules/dashboard'
import { AiStudioModule } from '@/components/modules/ai-studio'
import { CoursesModule } from '@/components/modules/courses'
import { CommunityModule } from '@/components/modules/community'
import { ProductsModule } from '@/components/modules/products'
import { StoreModule } from '@/components/modules/store'
import { MembershipModule } from '@/components/modules/membership'
import { EmailModule } from '@/components/modules/email'
import { CrmModule } from '@/components/modules/crm'
import { AffiliatesModule } from '@/components/modules/affiliates'
import { AnalyticsModule } from '@/components/modules/analytics'
import { PagesFunnelsModule } from '@/components/modules/pages-funnels'
import { SupportModule } from '@/components/modules/support'
import { SettingsModule } from '@/components/modules/settings'
import { AiSettingsModule } from '@/components/modules/ai-settings'
import { SystemSettingsModule } from '@/components/modules/system-settings'
import { CertificatesModule } from '@/components/modules/certificates'
import { MediaLibraryModule } from '@/components/modules/media-library'
import { AutomationModule } from '@/components/modules/automation'
import { CourseBuilder } from '@/components/course-builder/builder'
import type { ModuleId } from '@/lib/nav'

const MODULES: Record<ModuleId, React.ComponentType> = {
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
