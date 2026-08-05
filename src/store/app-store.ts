import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ModuleId } from '@/lib/nav'

interface AppState {
  activeModule: ModuleId
  setActiveModule: (m: ModuleId) => void
  /** When set, the target module should switch to this tab (e.g., 'blog', 'billing', 'profile') */
  activeSubTab: string | null
  setActiveSubTab: (tab: string | null) => void
  /** Navigate to a module AND set a sub-tab in one call */
  navigateTo: (module: ModuleId, subTab?: string | null) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  commandOpen: boolean
  setCommandOpen: (v: boolean) => void
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void
  toggleTheme: () => void
  /** When set, the target module should auto-open its create dialog */
  createDialogFor: ModuleId | null
  triggerCreateDialog: (m: ModuleId) => void
  clearCreateDialog: () => void
  /** When set, the full-screen Course Builder is rendered (overrides dashboard layout) */
  builderCourseId: string | null
  openBuilder: (courseId: string) => void
  closeBuilder: () => void
  /** When set, the full-screen Course Player (student preview) is rendered */
  previewCourseId: string | null
  openPreview: (courseId: string) => void
  closePreview: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeModule: 'dashboard',
      setActiveModule: (m) => set({ activeModule: m, activeSubTab: null }),
      activeSubTab: null,
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),
      navigateTo: (module, subTab) => set({ activeModule: module, activeSubTab: subTab ?? null }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      commandOpen: false,
      setCommandOpen: (v) => set({ commandOpen: v }),
      theme: 'dark',
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      createDialogFor: null,
      triggerCreateDialog: (m) => set({ activeModule: m, createDialogFor: m }),
      clearCreateDialog: () => set({ createDialogFor: null }),
      builderCourseId: null,
      openBuilder: (courseId) => set({ builderCourseId: courseId }),
      closeBuilder: () => set({ builderCourseId: null }),
      previewCourseId: null,
      openPreview: (courseId) => set({ previewCourseId: courseId }),
      closePreview: () => set({ previewCourseId: null }),
    }),
    {
      name: 'creatoros-app',
      partialize: (s) => ({ activeModule: s.activeModule, sidebarCollapsed: s.sidebarCollapsed, theme: s.theme }),
    }
  )
)
