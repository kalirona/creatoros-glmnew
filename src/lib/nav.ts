import {
  LayoutDashboard, GraduationCap, Users, ShoppingBag, Package,
  Mail, UserCircle, Link2, BarChart3, Sparkles, LifeBuoy, Settings,
  CreditCard, Globe, ShieldCheck, Award, FolderOpen, type LucideIcon,
  Zap, ChevronDown,
} from 'lucide-react'

// ============================================================================
// CreatorOS Navigation — Creator-first workflow structure
// ----------------------------------------------------------------------------
// 10 primary modules organized by how creators actually work:
// Dashboard → AI Studio → Courses → Sell → Website → Community → Marketing → Analytics → Settings
// Super Admin is platform-owner-only (hidden for creators)
// ============================================================================

export type ModuleId =
  | 'dashboard' | 'courses' | 'community' | 'store' | 'products'
  | 'membership' | 'email' | 'crm' | 'affiliates' | 'analytics'
  | 'ai-studio' | 'pages-funnels' | 'support' | 'settings' | 'admin'
  | 'certificates' | 'media-library' | 'automation'

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
        id: 'ai-studio', label: 'AI Studio', icon: Sparkles, description: 'Generate courses, copy, and content with AI', badge: 'AI', accent: 'text-primary',
        subItems: [
          { label: 'AI Chat', moduleId: 'ai-studio', subTab: 'chat' },
          { label: 'AI Documents', moduleId: 'ai-studio', subTab: 'documents' },
          { label: 'AI Images', moduleId: 'ai-studio', subTab: 'images' },
          { label: 'AI Courses', moduleId: 'ai-studio', subTab: 'courses' },
        ],
      },
      {
        id: 'courses', label: 'Courses', icon: GraduationCap, description: 'Build and sell online courses',
        subItems: [
          { label: 'Courses', moduleId: 'courses' },
          { label: 'Students', moduleId: 'courses', subTab: 'students' },
          { label: 'Certificates', moduleId: 'certificates' },
        ],
      },
    ],
  },
  {
    title: 'Sell',
    items: [
      {
        id: 'store', label: 'Sell', icon: ShoppingBag, description: 'Products, sales, memberships, orders',
        subItems: [
          { label: 'Products', moduleId: 'products' },
          { label: 'Sales', moduleId: 'store' },
          { label: 'Memberships', moduleId: 'membership' },
          { label: 'Orders', moduleId: 'store', subTab: 'orders' },
        ],
      },
    ],
  },
  {
    title: 'Presence',
    items: [
      {
        id: 'pages-funnels', label: 'Website', icon: Globe, description: 'Pages, landing pages, blog, SEO, domains',
        subItems: [
          { label: 'Pages', moduleId: 'pages-funnels', subTab: 'pages' },
          { label: 'Landing Pages', moduleId: 'pages-funnels', subTab: 'landing' },
          { label: 'Blog', moduleId: 'pages-funnels', subTab: 'blog' },
          { label: 'Navigation', moduleId: 'pages-funnels', subTab: 'navigation' },
          { label: 'Branding', moduleId: 'pages-funnels', subTab: 'branding' },
          { label: 'SEO', moduleId: 'pages-funnels', subTab: 'seo' },
          { label: 'Domains', moduleId: 'pages-funnels', subTab: 'domains' },
        ],
      },
      {
        id: 'community', label: 'Community', icon: Users, description: 'Feed, spaces, events, members',
        subItems: [
          { label: 'Feed', moduleId: 'community', subTab: 'feed' },
          { label: 'Spaces', moduleId: 'community', subTab: 'spaces' },
          { label: 'Events', moduleId: 'community', subTab: 'events' },
          { label: 'Members', moduleId: 'community', subTab: 'members' },
          { label: 'Leaderboard', moduleId: 'community', subTab: 'leaderboard' },
        ],
      },
    ],
  },
  {
    title: 'Grow',
    items: [
      {
        id: 'email', label: 'Marketing', icon: Mail, description: 'Campaigns, contacts, customers, affiliates, automations',
        subItems: [
          { label: 'Campaigns', moduleId: 'email' },
          { label: 'Contacts', moduleId: 'crm' },
          { label: 'Affiliates', moduleId: 'affiliates' },
          { label: 'Automations', moduleId: 'automation' },
        ],
      },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Deep-dive performance across your business' },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'media-library', label: 'Media', icon: FolderOpen, description: 'Images, videos, files, and assets' },
      { id: 'settings', label: 'Settings', icon: Settings, description: 'Workspace, team, billing, security',
        subItems: [
          { label: 'Workspace', moduleId: 'settings', subTab: 'workspace' },
          { label: 'Team', moduleId: 'settings', subTab: 'team' },
          { label: 'Billing', moduleId: 'settings', subTab: 'billing' },
          { label: 'Security', moduleId: 'settings', subTab: 'security' },
        ],
      },
      { id: 'support', label: 'Support', icon: LifeBuoy, description: 'Tickets, help center, live chat' },
    ],
  },
]

// ─── Super Admin Navigation (platform owner only) ────────────────────────────

export const ADMIN_NAV_GROUP: NavGroup = {
  title: 'Platform',
  items: [
    {
      id: 'admin', label: 'Super Admin', icon: ShieldCheck, description: 'Platform control center', badge: 'Admin', accent: 'text-amber-500',
      subItems: [
        { label: 'Dashboard', moduleId: 'admin' },
        { label: 'Workspaces', moduleId: 'admin' },
        { label: 'Users', moduleId: 'admin' },
        { label: 'Plans', moduleId: 'admin' },
        { label: 'AI Providers', moduleId: 'admin' },
        { label: 'Feature Flags', moduleId: 'admin' },
        { label: 'Audit Logs', moduleId: 'admin' },
      ],
    },
  ],
}

// Combined groups (admin appended at end)
export const ALL_NAV_GROUPS: NavGroup[] = [...NAV_GROUPS, ADMIN_NAV_GROUP]

export const ALL_NAV_ITEMS: NavItem[] = ALL_NAV_GROUPS.flatMap(g => g.items)

// ─── Keyboard Shortcuts ─────────────────────────────────────────────────────

export const KEYBOARD_SHORTCUTS: { keys: string; label: string; moduleId?: ModuleId }[] = [
  { keys: '⌘K', label: 'Open command palette' },
  { keys: 'G D', label: 'Go to Dashboard', moduleId: 'dashboard' },
  { keys: 'G A', label: 'Go to AI Studio', moduleId: 'ai-studio' },
  { keys: 'G C', label: 'Go to Courses', moduleId: 'courses' },
  { keys: 'G S', label: 'Go to Sell', moduleId: 'store' },
  { keys: 'G W', label: 'Go to Website', moduleId: 'pages-funnels' },
  { keys: 'G O', label: 'Go to Community', moduleId: 'community' },
  { keys: 'G M', label: 'Go to Marketing', moduleId: 'email' },
  { keys: 'G N', label: 'Go to Analytics', moduleId: 'analytics' },
  { keys: 'G T', label: 'Go to Settings', moduleId: 'settings' },
]
