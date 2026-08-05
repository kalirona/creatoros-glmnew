import {
  LayoutDashboard, GraduationCap, Users, ShoppingBag, Package,
  Mail, UserCircle, Link2, BarChart3, Sparkles, LifeBuoy, Settings,
  CreditCard, Globe, ShieldCheck, Award, FolderOpen, type LucideIcon,
  MessageCircle, Hash, Calendar, Zap,
} from 'lucide-react'

export type ModuleId =
  | 'dashboard' | 'courses' | 'community' | 'store' | 'products'
  | 'membership' | 'email' | 'crm' | 'affiliates' | 'analytics'
  | 'ai-studio' | 'pages-funnels' | 'support' | 'settings' | 'admin'
  | 'certificates' | 'media-library' | 'automation'

export interface NavItem {
  id: ModuleId
  label: string
  icon: LucideIcon
  description: string
  badge?: string
  accent?: string
}

// ============================================================================
// NEW NAVIGATION STRUCTURE — Business-first, not page-builder-first
// Groups: Overview → Create & Sell → Community → Customers → Website → System
// ============================================================================

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Revenue, growth, and key metrics at a glance' },
      { id: 'ai-studio', label: 'AI Studio', icon: Sparkles, description: 'Generate courses, copy, and content with AI', badge: 'AI', accent: 'text-primary' },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Deep-dive performance across your business' },
    ],
  },
  {
    title: 'Create & Sell',
    items: [
      { id: 'courses', label: 'Courses', icon: GraduationCap, description: 'Build and sell online courses' },
      { id: 'products', label: 'Digital Products', icon: Package, description: 'Build and manage digital products, templates, downloads' },
      { id: 'store', label: 'Store', icon: ShoppingBag, description: 'Storefront, orders, customers, coupons, checkout' },
    ],
  },
  {
    title: 'Community',
    items: [
      { id: 'community', label: 'Community', icon: Users, description: 'Feed, spaces, events, members, moderation' },
    ],
  },
  {
    title: 'Customers',
    items: [
      { id: 'crm', label: 'CRM', icon: UserCircle, description: 'Customers, orders, activity timeline' },
      { id: 'email', label: 'Email Marketing', icon: Mail, description: 'Broadcasts, automations, sequences' },
      { id: 'membership', label: 'Memberships', icon: CreditCard, description: 'Recurring revenue plans and tiers' },
      { id: 'affiliates', label: 'Affiliates', icon: Link2, description: 'Referral links, commissions, payouts' },
    ],
  },
  {
    title: 'Website',
    items: [
      { id: 'pages-funnels', label: 'Website', icon: Globe, description: 'Home, pages, blog, navigation, branding, SEO, domains' },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'media-library', label: 'Media Library', icon: FolderOpen, description: 'Images, videos, files, and assets' },
      { id: 'automation', label: 'Automation', icon: Zap, description: 'Funnels, workflows, and automated sequences' },
      { id: 'certificates', label: 'Certificates', icon: Award, description: 'Course completion certificates' },
      { id: 'support', label: 'Support', icon: LifeBuoy, description: 'Tickets, help center, live chat' },
      { id: 'settings', label: 'Settings', icon: Settings, description: 'Workspace, team, billing, security' },
      { id: 'admin', label: 'Super Admin', icon: ShieldCheck, description: 'Platform control center: AI, billing, feature flags', badge: 'Admin', accent: 'text-amber-500' },
    ],
  },
]

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items)

export const KEYBOARD_SHORTCUTS: { keys: string; label: string; moduleId?: ModuleId }[] = [
  { keys: '⌘K', label: 'Open command palette' },
  { keys: 'G D', label: 'Go to Dashboard', moduleId: 'dashboard' },
  { keys: 'G A', label: 'Go to AI Studio', moduleId: 'ai-studio' },
  { keys: 'G C', label: 'Go to Courses', moduleId: 'courses' },
  { keys: 'G P', label: 'Go to Products', moduleId: 'products' },
  { keys: 'G O', label: 'Go to Community', moduleId: 'community' },
  { keys: 'G E', label: 'Go to Email', moduleId: 'email' },
  { keys: 'G S', label: 'Go to Settings', moduleId: 'settings' },
  { keys: 'G W', label: 'Go to Website', moduleId: 'pages-funnels' },
  { keys: 'G X', label: 'Go to Super Admin', moduleId: 'admin' },
]
