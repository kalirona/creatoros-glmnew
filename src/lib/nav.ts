import {
  LayoutDashboard, GraduationCap, Users, ShoppingBag, Package,
  UserCircle, Sparkles, LifeBuoy, Settings,
  Globe, FolderOpen, type LucideIcon,
  Cpu, ServerCog,
} from 'lucide-react'

// ============================================================================
// CreatorOS Navigation — Simplified creator-first structure
// ----------------------------------------------------------------------------
// Focus: Courses, Community, Digital Products, Website, Customers/CRM,
// and a simple AI Assistant.
//
// Secondary features (AI Images, AI Video, Marketing, Affiliates, Automation,
// Analytics, Memberships, Certificates) are hidden from the creator sidebar
// but their code/routes/DB models remain intact for future re-enablement.
//
// Platform modules (SUPER_ADMIN only): AI Settings + System Settings
// Business owners, admins, instructors, members, customers NEVER see platform modules.
// ============================================================================

export type ModuleId =
  | 'dashboard' | 'courses' | 'community' | 'store' | 'products'
  | 'membership' | 'email' | 'crm' | 'affiliates' | 'analytics'
  | 'ai-studio' | 'pages-funnels' | 'support' | 'settings' | 'admin'
  | 'certificates' | 'media-library' | 'automation'
  | 'ai-settings' | 'system-settings'

export interface NavSubItem {
  label: string
  moduleId: ModuleId
  /** The tab to activate within the module (e.g., 'blog', 'billing', 'profile') */
  subTab?: string
}

export interface NavItem {
  id: ModuleId
  label: string
  icon: LucideIcon
  description: string
  badge?: string
  accent?: string
  subItems?: NavSubItem[]
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

// ─── Creator Navigation (visible to all workspace members) ──────────────────
// Simplified to core modules only. Hidden modules (analytics, email, affiliates,
// automation, membership, certificates, ai-studio sub-tabs) are NOT listed here
// but remain accessible via direct moduleId navigation and their code is intact.

export const NAV_GROUPS: NavGroup[] = [
  {
    title: '',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Revenue, growth, and key metrics at a glance' },
    ],
  },
  {
    title: 'Create',
    items: [
      {
        id: 'courses', label: 'Courses', icon: GraduationCap, description: 'Build and sell online courses',
        subItems: [
          { label: 'Courses', moduleId: 'courses' },
          { label: 'Students', moduleId: 'courses', subTab: 'students' },
        ],
      },
      { id: 'products', label: 'Digital Products', icon: Package, description: 'Sell digital downloads and products' },
      {
        id: 'pages-funnels', label: 'Website', icon: Globe, description: 'Pages, landing pages, blog, SEO',
        subItems: [
          { label: 'Pages', moduleId: 'pages-funnels', subTab: 'pages' },
          { label: 'Landing Pages', moduleId: 'pages-funnels', subTab: 'landing' },
          { label: 'Blog', moduleId: 'pages-funnels', subTab: 'blog' },
        ],
      },
    ],
  },
  {
    title: 'Community',
    items: [
      {
        id: 'community', label: 'Community', icon: Users, description: 'Feed, spaces, events, members',
        subItems: [
          { label: 'Feed', moduleId: 'community', subTab: 'feed' },
          { label: 'Spaces', moduleId: 'community', subTab: 'spaces' },
          { label: 'Events', moduleId: 'community', subTab: 'events' },
          { label: 'Members', moduleId: 'community', subTab: 'members' },
        ],
      },
    ],
  },
  {
    title: 'Business',
    items: [
      {
        id: 'crm', label: 'Customers', icon: UserCircle, description: 'Customer relationships and contacts',
      },
      {
        id: 'store', label: 'Orders', icon: ShoppingBag, description: 'Orders, sales, and transactions',
        subItems: [
          { label: 'Orders', moduleId: 'store', subTab: 'orders' },
          { label: 'Sales', moduleId: 'store' },
        ],
      },
    ],
  },
  {
    title: 'AI',
    items: [
      {
        id: 'ai-studio', label: 'AI Assistant', icon: Sparkles, description: 'AI writing, rewriting, and content assistance', badge: 'AI', accent: 'text-primary',
        subItems: [
          { label: 'AI Chat', moduleId: 'ai-studio', subTab: 'chat' },
          { label: 'AI Documents', moduleId: 'ai-studio', subTab: 'documents' },
        ],
      },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'media-library', label: 'Media Library', icon: FolderOpen, description: 'Images, videos, files, and assets' },
      { id: 'support', label: 'Support', icon: LifeBuoy, description: 'Tickets, help center, live chat' },
      {
        id: 'settings', label: 'Settings', icon: Settings, description: 'Workspace, team, billing, security',
        subItems: [
          { label: 'Workspace', moduleId: 'settings', subTab: 'workspace' },
          { label: 'Team', moduleId: 'settings', subTab: 'team' },
          { label: 'Billing', moduleId: 'settings', subTab: 'billing' },
          { label: 'Security', moduleId: 'settings', subTab: 'security' },
        ],
      },
    ],
  },
]

// ─── Platform Navigation (SUPER_ADMIN only — RBAC enforced) ────────────────
// Only SUPER_ADMIN role can access these. Everyone else gets 403 + hidden sidebar.

export const ADMIN_NAV_GROUP: NavGroup = {
  title: 'Platform',
  items: [
    {
      id: 'ai-settings', label: 'AI Settings', icon: Cpu, description: 'AI providers, models, routing, credits, logs', badge: 'Admin', accent: 'text-amber-500',
      subItems: [
        { label: 'Overview', moduleId: 'ai-settings' },
        { label: 'Providers', moduleId: 'ai-settings', subTab: 'providers' },
        { label: 'Models', moduleId: 'ai-settings', subTab: 'models' },
        { label: 'Routing', moduleId: 'ai-settings', subTab: 'routing' },
        { label: 'Prompts', moduleId: 'ai-settings', subTab: 'prompts' },
        { label: 'Credits', moduleId: 'ai-settings', subTab: 'credits' },
        { label: 'Usage', moduleId: 'ai-settings', subTab: 'usage' },
        { label: 'Logs', moduleId: 'ai-settings', subTab: 'logs' },
      ],
    },
    {
      id: 'system-settings', label: 'System Settings', icon: ServerCog, description: 'Platform, auth, billing, email, storage, security', badge: 'Admin', accent: 'text-amber-500',
      subItems: [
        { label: 'General', moduleId: 'system-settings' },
        { label: 'Authentication', moduleId: 'system-settings', subTab: 'auth' },
        { label: 'Workspaces', moduleId: 'system-settings', subTab: 'workspaces' },
        { label: 'Billing', moduleId: 'system-settings', subTab: 'billing' },
        { label: 'Email', moduleId: 'system-settings', subTab: 'email' },
        { label: 'Storage', moduleId: 'system-settings', subTab: 'storage' },
        { label: 'Domains', moduleId: 'system-settings', subTab: 'domains' },
        { label: 'Security', moduleId: 'system-settings', subTab: 'security' },
        { label: 'Integrations', moduleId: 'system-settings', subTab: 'integrations' },
        { label: 'Jobs', moduleId: 'system-settings', subTab: 'jobs' },
        { label: 'Database', moduleId: 'system-settings', subTab: 'database' },
        { label: 'Monitoring', moduleId: 'system-settings', subTab: 'monitoring' },
        { label: 'Feature Flags', moduleId: 'system-settings', subTab: 'flags' },
        { label: 'Backups', moduleId: 'system-settings', subTab: 'backups' },
      ],
    },
  ],
}

// Combined groups (admin appended at end)
export const ALL_NAV_GROUPS: NavGroup[] = [...NAV_GROUPS, ADMIN_NAV_GROUP]

export const ALL_NAV_ITEMS: NavItem[] = ALL_NAV_GROUPS.flatMap(g => g.items)

// ─── RBAC ───────────────────────────────────────────────────────────────────
// Only SUPER_ADMIN can access platform modules. Everyone else gets 403.

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'INSTRUCTOR' | 'MEMBER' | 'CUSTOMER'

export const PLATFORM_MODULES: ModuleId[] = ['ai-settings', 'system-settings', 'admin']

export function isPlatformModule(moduleId: ModuleId): boolean {
  return PLATFORM_MODULES.includes(moduleId)
}

export function canAccessModule(moduleId: ModuleId, role: UserRole): boolean {
  if (!isPlatformModule(moduleId)) return true
  return role === 'SUPER_ADMIN'
}

// ─── Keyboard Shortcuts ─────────────────────────────────────────────────────

export const KEYBOARD_SHORTCUTS: { keys: string; label: string; moduleId?: ModuleId }[] = [
  { keys: '⌘K', label: 'Open command palette' },
  { keys: 'G D', label: 'Go to Dashboard', moduleId: 'dashboard' },
  { keys: 'G A', label: 'Go to AI Assistant', moduleId: 'ai-studio' },
  { keys: 'G C', label: 'Go to Courses', moduleId: 'courses' },
  { keys: 'G P', label: 'Go to Digital Products', moduleId: 'products' },
  { keys: 'G W', label: 'Go to Website', moduleId: 'pages-funnels' },
  { keys: 'G O', label: 'Go to Community', moduleId: 'community' },
  { keys: 'G U', label: 'Go to Customers', moduleId: 'crm' },
  { keys: 'G O', label: 'Go to Orders', moduleId: 'store' },
  { keys: 'G T', label: 'Go to Settings', moduleId: 'settings' },
]
