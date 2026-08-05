# CreatorOS — Website Navigation

> **Document type**: Sidebar & Admin Navigation Restructure
> **Scope**: New admin sidebar for the AI-powered Creator Business Platform
> **Audience**: Product, Design, Engineering
> **Status**: Proposed (v1.0)

---

## 1. Goals

Restructure the admin sidebar so that:

1. The **Website** is a clean, simple module (no longer "Pages & Funnels" mega-module).
2. The 10 pillars of the platform are clearly represented.
3. No dead buttons, no dead routes, no orphan tabs.
4. The admin feels like **Shopify/Kajabi** — simple, fast, professional.
5. Keyboard shortcuts are updated to match the new structure.

---

## 2. Current Sidebar (Before)

```
Overview
  ├── Dashboard
  ├── Analytics
  └── AI Studio

Create & Sell
  ├── Courses
  ├── Digital Products
  ├── Store
  ├── Memberships
  ├── Certificates
  ├── Media Library
  └── Pages & Funnels  ← mega-module (Pages, Landing Pages, Funnels, Navigation, Blog, Domains, SEO, Site Settings)

Audience
  ├── Community
  ├── Email Marketing
  ├── CRM
  └── Affiliates

System
  ├── Support
  ├── Settings
  └── Super Admin
```

### Problems

- "Pages & Funnels" is overloaded — 8 tabs that try to be the whole website.
- "Certificates" is buried under Create & Sell but logically belongs to Courses.
- "Media Library" is between "Certificates" and "Pages & Funnels" — no logical home.
- "Support" is a top-level System item but should be inside Settings.
- "Analytics" is under Overview, but deserves its own top-level slot.
- No "Automation" surface despite the platform supporting workflows.
- "Audience" group mixes community (CRM, Email) with revenue (Affiliates).

---

## 3. New Sidebar (After)

```
Dashboard

AI Studio

Create & Sell
  ├── Courses
  ├── Digital Products
  └── Store

Community
  ├── Feed
  ├── Spaces
  ├── Events
  └── Members

Customers
  ├── CRM
  ├── Email Marketing
  ├── Membership
  └── Affiliates

Website
  ├── Home
  ├── Pages
  ├── Blog
  ├── Navigation
  ├── Branding
  ├── SEO
  └── Domains

Analytics

Media Library

Automation

Settings
  ├── Workspace
  ├── Team
  ├── Billing
  ├── Integrations
  ├── Certificates
  ├── Support
  └── Super Admin
```

---

## 4. Top-Level Items (Detailed)

### 4.1 Dashboard

- Default landing after login.
- Snapshot: revenue (30d), new students, new customers, top courses, traffic, AI tips.
- Quick actions: "Generate page", "New course", "Send campaign".

### 4.2 AI Studio

- Generate Website (full multi-page).
- Generate Page, Section, Copy, Image.
- Generate Email campaign.
- Generate SEO (per page or bulk).
- Brand voice settings.
- AI generations history + credit usage.

### 4.3 Create & Sell (group)

| Item | Purpose |
|---|---|
| Courses | CRUD courses, curriculum, lessons, certificates (per-course) |
| Digital Products | CRUD products, files, versions |
| Store | Storefront config, orders, checkout, taxes, payouts |

> Note: "Certificates" is **moved out** of this group → into Settings (templates) and Courses (issuance). See §6.3.
> Note: "Memberships" is **moved out** of this group → into Customers (because it's a customer-facing recurring relationship). See §6.4.
> Note: "Media Library" is **moved out** → top-level. See §6.5.
> Note: "Pages & Funnels" is **transformed** into "Website" group (top-level). See §5.

### 4.4 Community (group)

| Item | Purpose |
|---|---|
| Feed | All posts across spaces, moderation queue |
| Spaces | CRUD CommunitySpace |
| Events | CRUD CommunityEvent, RSVPs |
| Members | Member directory, warnings, bans, invitations |

### 4.5 Customers (group)

| Item | Purpose |
|---|---|
| CRM | Customers, students, segments, tags, notes, lifecycle |
| Email Marketing | Campaigns, automations, sequences, broadcasts |
| Membership | Plans, gated content, member portal, churn |
| Affiliates | Affiliates, payouts, links, referrals |

### 4.6 Website (group) — NEW

This group replaces the old "Pages & Funnels" module.

| Item | Purpose | Old equivalent |
|---|---|---|
| Home | Edit homepage sections (Hero, Features, Testimonials, Pricing, FAQ, CTA) | Pages tab → home page |
| Pages | CRUD custom pages (`/about`, `/contact`, `/pricing`, `/legal`) | Pages tab |
| Blog | CRUD BlogPost, categories, tags, authors | Blog tab |
| Navigation | Edit header nav + footer columns + mobile menu | Navigation tab |
| Branding | Logo, colors, fonts, theme preset, tagline | Site Settings tab (branding part) |
| SEO | Default SEO, sitemap, robots.txt, OG defaults, per-route overrides | SEO tab + Site Settings (SEO part) |
| Domains | Custom domains, SSL, primary domain | Domains tab |

> Note: "Landing Pages" tab is **removed** — landing pages are now either (a) the homepage, (b) a custom `Page` with sections, or (c) a `Funnel`. See §6.6.
> Note: "Funnels" tab is **removed from Website** — Funnels move to **Automation**. See §6.7.
> Note: "Site Settings" tab is **split** into Branding, SEO, Domains, Navigation — all under Website. Workspace-level settings stay in Settings.

### 4.7 Analytics (top-level)

- Revenue (30d / 90d / YTD).
- Enrollments, students, churn.
- Traffic, top pages, sources.
- Email performance.
- Community engagement.
- Funnel conversion.

### 4.8 Media Library (top-level)

- Images, videos, files.
- Folders, tags, search.
- Upload, generate (AI), reuse across courses/products/pages/emails.
- Usage tracking (where is this asset used?).

> Rationale: Media is used everywhere (courses, products, pages, emails, community). A top-level home makes it universally accessible.

### 4.9 Automation (top-level)

- Workflows (trigger → action).
- Funnels (Funnel + FunnelStep).
- Email sequences.
- Webhooks.
- Integrations (Zapier, Make, native).

> Rationale: Funnels are automations (sequence of steps a user goes through). They belong with workflows, not with static pages.

### 4.10 Settings (group)

| Item | Purpose |
|---|---|
| Workspace | Name, domain, plan, branding basics |
| Team | WorkspaceMember CRUD, roles, invitations |
| Billing | Subscription, invoices, payment method |
| Integrations | Stripe, Mailchimp, Zoom, etc. |
| Certificates | Certificate templates (global) |
| Support | Help center, contact, status |
| Super Admin | Platform-level admin (multi-tenant) |

> Note: "Certificates" moves here as **template management**. Per-course certificate issuance stays in Courses.
> Note: "Support" moves here from top-level System.
> Note: "Super Admin" moves here as the last item, accessible only to super-admin role.

---

## 5. "Pages & Funnels" → "Website" Transformation

### 5.1 Before (8 tabs, overloaded)

```
Pages & Funnels
  ├── Pages
  ├── Landing Pages
  ├── Funnels
  ├── Navigation
  ├── Blog
  ├── Domains
  ├── SEO
  └── Site Settings
```

### 5.2 After (Website group, focused)

```
Website
  ├── Home
  ├── Pages
  ├── Blog
  ├── Navigation
  ├── Branding
  ├── SEO
  └── Domains
```

### 5.3 Tab Mapping

| Old tab | New location |
|---|---|
| Pages | Website → Pages |
| Landing Pages | Removed (use Home, Pages, or Funnels in Automation) |
| Funnels | Automation → Funnels |
| Navigation | Website → Navigation |
| Blog | Website → Blog |
| Domains | Website → Domains |
| SEO | Website → SEO |
| Site Settings (branding part) | Website → Branding |
| Site Settings (SEO part) | Website → SEO |
| Site Settings (workspace part) | Settings → Workspace |

---

## 6. What Happens To…?

### 6.1 "Landing Pages" tab

**Decision**: Removed.

**Rationale**: A landing page is either:
- The **homepage** (most common) — edit via Website → Home.
- A **custom Page** with sections — edit via Website → Pages.
- A **Funnel** step (for marketing campaigns) — edit via Automation → Funnels.

There is no separate "Landing Pages" concept. The three options above cover all use cases.

### 6.2 "Site Settings" tab

**Decision**: Split.

- Branding (logo, colors, fonts, tagline) → **Website → Branding**
- SEO defaults (meta, OG, sitemap, robots) → **Website → SEO**
- Domains → **Website → Domains**
- Navigation → **Website → Navigation**
- Workspace name, plan, team → **Settings → Workspace** / **Settings → Team**

The `SiteSetting` Prisma model still exists; its fields are exposed across multiple admin screens.

### 6.3 "Certificates"

**Decision**: Split.

- **Certificate templates** (global, reusable) → **Settings → Certificates**
- **Per-course certificate issuance** (auto-issue on completion) → **Courses → [Course] → Settings** (toggle + template picker)

**Rationale**: Certificates are issued by courses, but templates are reusable assets. Templates belong in Settings; issuance belongs in Courses.

### 6.4 "Memberships"

**Decision**: Move to **Customers → Membership**.

**Rationale**: A membership is a recurring customer relationship. It belongs with CRM, Email Marketing, and Affiliates — all customer-facing revenue surfaces. Moving it out of "Create & Sell" clarifies that "Create & Sell" is for one-time digital products (courses, products), while "Customers" is for ongoing relationships.

### 6.5 "Media Library"

**Decision**: Top-level item.

**Rationale**: Media is used by courses, products, pages, emails, community. Burying it inside "Create & Sell" made it hard to find. Top-level makes it universally accessible — like Shopify's "Content > Files".

### 6.6 "Funnels"

**Decision**: Move to **Automation → Funnels**.

**Rationale**: A funnel is a sequence of steps a user goes through (opt-in → sales page → upsell → thank-you). It is an **automation**, not a static page. Grouping it with workflows, email sequences, and webhooks is more accurate.

**Alternative considered**: Keep Funnels under Website. Rejected because Funnels are behavior (a flow), not content (a page).

**Backward compatibility**: The `Funnel` + `FunnelStep` models are unchanged. Only the admin location moves.

### 6.7 "Support"

**Decision**: Move to **Settings → Support**.

**Rationale**: Support is a help resource, not a daily workflow. Top-level placement wasted sidebar space. Moving it into Settings (alongside Billing, Integrations) is more honest about its role.

### 6.8 "Super Admin"

**Decision**: Keep at **bottom of Settings**, visible only to super-admin role.

**Rationale**: Super Admin is platform-level (cross-workspace) admin. It is rarely used by creators. Bottom of Settings, role-gated, keeps it accessible without cluttering the sidebar.

### 6.9 "Analytics"

**Decision**: Promote to **top-level**.

**Rationale**: Analytics is a daily-check surface for serious creators. Burying it under "Overview" undersold its importance. Top-level placement matches Shopify (Analytics) and Kajabi (Dashboard → Analytics).

### 6.10 "AI Studio"

**Decision**: Promote to **top-level** (already is, keep it).

**Rationale**: AI is a core pillar. It must be one click away from anywhere.

---

## 7. Sidebar Visual Layout

```
┌─────────────────────────────────────┐
│  [Logo]  CreatorOS                   │
│  Workspace ▾                         │
├─────────────────────────────────────┤
│  🏠  Dashboard                ⌘D    │
│  ✨  AI Studio                 ⌘A    │
│                                     │
│  ▾  Create & Sell                   │
│     📚  Courses                ⌘C    │
│     📦  Digital Products       ⌘P    │
│     🛒  Store                  ⌘S    │
│                                     │
│  ▾  Community                       │
│     💬  Feed                   ⌘F    │
│     🗂️  Spaces                 ⌘1    │
│     📅  Events                 ⌘2    │
│     👥  Members                ⌘3    │
│                                     │
│  ▾  Customers                       │
│     👤  CRM                    ⌘R    │
│     ✉️  Email Marketing        ⌘E    │
│     💳  Membership             ⌘M    │
│     🤝  Affiliates             ⌘X    │
│                                     │
│  ▾  Website                         │
│     🏠  Home                   ⌘H    │
│     📄  Pages                  ⌘G    │
│     📝  Blog                   ⌘B    │
│     🧭  Navigation             ⌘N    │
│     🎨  Branding               ⌘B    │
│     🔍  SEO                    ⌘O    │
│     🌐  Domains                ⌘D    │
│                                     │
│  📊  Analytics                ⌘Y    │
│  🖼️  Media Library            ⌘L    │
│  ⚡  Automation                ⌘U    │
│                                     │
│  ▾  Settings                        │
│     ⚙️  Workspace             ⌘W    │
│     👥  Team                  ⌘T    │
│     💳  Billing               ⌘$    │
│     🔌  Integrations          ⌘I    │
│     📜  Certificates          ⌘K    │
│     🆘  Support               ⌘?    │
│     🛡️  Super Admin           ⌘0    │
└─────────────────────────────────────┘
```

> Note: Shortcut letters above are illustrative; see §8 for the canonical table.

---

## 8. Keyboard Shortcuts (Updated)

### 8.1 Global

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘/` | Open keyboard shortcuts help |
| `⌘\` | Toggle sidebar |
| `g` then `d` | Go to Dashboard |
| `g` then `a` | Go to AI Studio |
| `g` then `y` | Go to Analytics |
| `g` then `l` | Go to Media Library |
| `g` then `u` | Go to Automation |
| `?` | Help / Support |

### 8.2 Module shortcuts (g then letter)

| Shortcut | Module |
|---|---|
| `g` `c` | Courses |
| `g` `p` | Digital Products |
| `g` `s` | Store |
| `g` `f` | Community → Feed |
| `g` `1` | Community → Spaces |
| `g` `2` | Community → Events |
| `g` `3` | Community → Members |
| `g` `r` | CRM |
| `g` `e` | Email Marketing |
| `g` `m` | Membership |
| `g` `x` | Affiliates |
| `g` `h` | Website → Home |
| `g` `g` | Website → Pages |
| `g` `b` | Website → Blog |
| `g` `n` | Website → Navigation |
| `g` `j` | Website → Branding |
| `g` `o` | Website → SEO |
| `g` `d` | Website → Domains |
| `g` `w` | Settings → Workspace |
| `g` `t` | Settings → Team |
| `g` `i` | Settings → Integrations |
| `g` `k` | Settings → Certificates |
| `g` `0` | Settings → Super Admin |

### 8.3 In-context

| Shortcut | Action |
|---|---|
| `c` | Create new (context-aware: new course, new product, new post...) |
| `e` | Edit selected |
| `Delete` | Delete selected (with confirm) |
| `⌘S` | Save |
| `⌘P` | Publish |
| `⌘.` | Open AI menu (generate) |
| `Esc` | Close dialog / cancel |

### 8.4 Removed shortcuts

| Old shortcut | Reason |
|---|---|
| Drag-and-drop keyboard nav | Drag-and-drop removed |
| "Toggle design mode" | Design mode removed |
| "Edit CSS" | Custom CSS removed |

---

## 9. Implementation in `nav.ts`

The current sidebar is defined in `src/lib/nav.ts`. The new structure is a refactor of this file.

### 9.1 New `nav.ts` shape (pseudocode)

```ts
export const nav = [
  { type: "item", label: "Dashboard", href: "/dashboard", shortcut: "g d", icon: "home" },
  { type: "item", label: "AI Studio", href: "/ai-studio", shortcut: "g a", icon: "sparkles" },

  {
    type: "group", label: "Create & Sell", icon: "store",
    items: [
      { label: "Courses", href: "/courses", shortcut: "g c", icon: "graduation-cap" },
      { label: "Digital Products", href: "/products", shortcut: "g p", icon: "package" },
      { label: "Store", href: "/store", shortcut: "g s", icon: "shopping-cart" },
    ],
  },

  {
    type: "group", label: "Community", icon: "users",
    items: [
      { label: "Feed", href: "/community/feed", shortcut: "g f", icon: "message-square" },
      { label: "Spaces", href: "/community/spaces", shortcut: "g 1", icon: "folder" },
      { label: "Events", href: "/community/events", shortcut: "g 2", icon: "calendar" },
      { label: "Members", href: "/community/members", shortcut: "g 3", icon: "users" },
    ],
  },

  {
    type: "group", label: "Customers", icon: "user-circle",
    items: [
      { label: "CRM", href: "/crm", shortcut: "g r", icon: "contact" },
      { label: "Email Marketing", href: "/email", shortcut: "g e", icon: "mail" },
      { label: "Membership", href: "/membership", shortcut: "g m", icon: "credit-card" },
      { label: "Affiliates", href: "/affiliates", shortcut: "g x", icon: "handshake" },
    ],
  },

  {
    type: "group", label: "Website", icon: "globe",
    items: [
      { label: "Home", href: "/website/home", shortcut: "g h", icon: "home" },
      { label: "Pages", href: "/website/pages", shortcut: "g g", icon: "file" },
      { label: "Blog", href: "/website/blog", shortcut: "g b", icon: "pen-tool" },
      { label: "Navigation", href: "/website/navigation", shortcut: "g n", icon: "menu" },
      { label: "Branding", href: "/website/branding", shortcut: "g j", icon: "palette" },
      { label: "SEO", href: "/website/seo", shortcut: "g o", icon: "search" },
      { label: "Domains", href: "/website/domains", shortcut: "g d", icon: "globe" },
    ],
  },

  { type: "item", label: "Analytics", href: "/analytics", shortcut: "g y", icon: "bar-chart" },
  { type: "item", label: "Media Library", href: "/media", shortcut: "g l", icon: "image" },
  { type: "item", label: "Automation", href: "/automation", shortcut: "g u", icon: "zap" },

  {
    type: "group", label: "Settings", icon: "settings",
    items: [
      { label: "Workspace", href: "/settings/workspace", shortcut: "g w", icon: "building" },
      { label: "Team", href: "/settings/team", shortcut: "g t", icon: "users" },
      { label: "Billing", href: "/settings/billing", shortcut: "g $", icon: "credit-card" },
      { label: "Integrations", href: "/settings/integrations", shortcut: "g i", icon: "plug" },
      { label: "Certificates", href: "/settings/certificates", shortcut: "g k", icon: "award" },
      { label: "Support", href: "/settings/support", shortcut: "g ?", icon: "life-buoy" },
      { label: "Super Admin", href: "/settings/super-admin", shortcut: "g 0", icon: "shield", role: "super-admin" },
    ],
  },
];
```

### 9.2 Role-based visibility

- Most items visible to all workspace members.
- `Super Admin` visible only to users with `super-admin` role.
- `Billing` visible only to `owner` / `admin` roles.
- `Team` visible only to `owner` / `admin` roles.

---

## 10. Module Component Mapping

Each sidebar item maps to a module component in `src/components/modules/`. The current set:

| Module component | New role |
|---|---|
| `dashboard.tsx` | Dashboard (unchanged) |
| `ai-studio.tsx` | AI Studio (unchanged) |
| `courses.tsx` | Courses (unchanged) |
| `products.tsx` | Digital Products (unchanged) |
| `store.tsx` | Store (unchanged) |
| `community.tsx` | Community (split into Feed, Spaces, Events, Members sub-views) |
| `crm.tsx` | CRM (unchanged) |
| `email.tsx` | Email Marketing (unchanged) |
| `membership.tsx` | Membership (moved to Customers group) |
| `affiliates.tsx` | Affiliates (moved to Customers group) |
| `pages-funnels.tsx` | **Renamed + refactored** → `website.tsx` (with sub-tabs: Home, Pages, Blog, Navigation, Branding, SEO, Domains) |
| `analytics.tsx` | Analytics (promoted to top-level) |
| `media-library.tsx` | Media Library (promoted to top-level) |
| *(new)* `automation.tsx` | Automation (workflows, funnels, sequences) |
| `certificates.tsx` | Moved into Settings (templates only) |
| `support.tsx` | Moved into Settings |
| `admin.tsx` | Super Admin (moved to Settings → Super Admin) |
| `settings.tsx` | Settings (expanded with sub-items) |

---

## 11. URL Structure

Each sidebar item gets a clean URL:

| Item | URL |
|---|---|
| Dashboard | `/dashboard` |
| AI Studio | `/ai-studio` |
| Courses | `/courses` |
| Digital Products | `/products` |
| Store | `/store` |
| Community → Feed | `/community/feed` |
| Community → Spaces | `/community/spaces` |
| Community → Events | `/community/events` |
| Community → Members | `/community/members` |
| CRM | `/crm` |
| Email Marketing | `/email` |
| Membership | `/membership` |
| Affiliates | `/affiliates` |
| Website → Home | `/website/home` |
| Website → Pages | `/website/pages` |
| Website → Blog | `/website/blog` |
| Website → Navigation | `/website/navigation` |
| Website → Branding | `/website/branding` |
| Website → SEO | `/website/seo` |
| Website → Domains | `/website/domains` |
| Analytics | `/analytics` |
| Media Library | `/media` |
| Automation | `/automation` |
| Settings → Workspace | `/settings/workspace` |
| Settings → Team | `/settings/team` |
| Settings → Billing | `/settings/billing` |
| Settings → Integrations | `/settings/integrations` |
| Settings → Certificates | `/settings/certificates` |
| Settings → Support | `/settings/support` |
| Settings → Super Admin | `/settings/super-admin` |

> **Conflict note**: `/courses`, `/store`, `/community`, `/membership`, `/blog` are also used as **public** routes. The admin routes are under a different path prefix — recommendation: admin uses `/app/...` prefix (e.g. `/app/courses`) OR admin uses route group `(admin)` while public uses `(public)`. This is resolved in `WEBSITE_MIGRATION_PLAN.md` §3.

---

## 12. Mobile Sidebar

On mobile (< `md`):

- Sidebar collapses to a slide-out drawer.
- Hamburger menu in topbar.
- Groups expand/collapse on tap.
- Search at top of drawer.
- Quick actions at bottom (AI generate, new course, new post).

---

## 13. Empty States

Each sidebar item has a branded empty state with a clear CTA:

| Item | Empty state CTA |
|---|---|
| Courses | "Create your first course" / "Generate a course with AI" |
| Digital Products | "Add a product" / "Generate with AI" |
| Community → Feed | "Create your first space" |
| CRM | "Import customers" / "Connect Stripe" |
| Email Marketing | "Create a campaign" / "Generate with AI" |
| Website → Home | "Generate your homepage with AI" |
| Website → Pages | "Add a page" / "Generate /about with AI" |
| Website → Blog | "Write a post" / "Generate with AI" |
| Analytics | "Connect your data" / "View demo" |

Every empty state offers an **AI-powered** first action.

---

## 14. Command Palette

The command palette (`⌘K`) is the **fast path** for power users. It surfaces:

- All navigation items.
- Recent items (recently edited course, page, post).
- Quick actions ("New course", "Generate homepage", "Send campaign").
- Search across courses, products, pages, posts, customers.

### 14.1 Commands

| Command | Action |
|---|---|
| `> courses` | Go to Courses |
| `> new course` | Create course |
| `> generate homepage` | AI: generate homepage |
| `> generate about page` | AI: generate /about |
| `> generate blog post` | AI: generate blog post |
| `> publish` | Publish current draft |
| `> search [query]` | Full-text search |

---

## 15. Migration of Existing Tabs

| Old URL | New URL | Redirect? |
|---|---|---|
| `/pages-funnels` | `/website/home` | Yes, 308 |
| `/pages-funnels?tab=pages` | `/website/pages` | Yes |
| `/pages-funnels?tab=blog` | `/website/blog` | Yes |
| `/pages-funnels?tab=navigation` | `/website/navigation` | Yes |
| `/pages-funnels?tab=domains` | `/website/domains` | Yes |
| `/pages-funnels?tab=seo` | `/website/seo` | Yes |
| `/pages-funnels?tab=funnels` | `/automation/funnels` | Yes |
| `/pages-funnels?tab=site-settings` | `/website/branding` | Yes |
| `/certificates` | `/settings/certificates` | Yes |
| `/support` | `/settings/support` | Yes |
| `/admin` | `/settings/super-admin` | Yes |
| `/memberships` | `/membership` | Yes |
| `/media-library` | `/media` | Yes |

All old URLs redirect to their new homes — no dead links.

---

## 16. Accessibility

- Sidebar is a `<nav aria-label="Main">`.
- Groups are `<button aria-expanded>` collapsibles.
- Items are `<a>` with `aria-current="page"` when active.
- Keyboard navigable: Tab to move, Enter to activate.
- `role="super-admin"` items hidden via `aria-hidden` when not authorized.
- Shortcut hints visible via `title` attribute.

---

## 17. Success Criteria

| Criterion | How to verify |
|---|---|
| No dead buttons in sidebar | Click every item → reaches a working page |
| No dead routes | Crawl all `/app/*` routes |
| Old URLs redirect | Test all redirects from §15 |
| Shortcuts work | Test all `g <key>` combos |
| Role gating works | Log in as member vs admin vs super-admin |
| Mobile drawer works | Test < `md` breakpoint |

---

## 18. Open Questions

1. Should "Automation" include "Workflows" (visual trigger-action builder) in v1, or just Funnels? **Recommendation**: Funnels + email sequences in v1; visual workflows in v2.
2. Should "AI Studio" be a top-level item or a button in the topbar? **Recommendation**: top-level item (it's a pillar).
3. Should "Media Library" be top-level or under Settings? **Recommendation**: top-level (used everywhere).
4. Should admin URLs use `/app/...` prefix to avoid collision with public `/courses`, `/store`? **Recommendation**: yes, route group `(admin)` mounted at `/app/*`.

---

## 19. Related Documents

- `WEBSITE_ARCHITECTURE.md` — overall architecture
- `PUBLIC_FRONTEND_PLAN.md` — public frontend
- `WEBSITE_DATABASE_FLOW.md` — data flow
- `WEBSITE_SEO_PLAN.md` — SEO strategy
- `WEBSITE_MIGRATION_PLAN.md` — migration plan (incl. nav.ts refactor)

---

**End of document.**
