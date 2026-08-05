# CreatorOS — Website Architecture

> **Document type**: Architecture Vision
> **Scope**: Platform restructure from page-builder tool → AI-powered Creator Business Platform
> **Audience**: Engineering, Product, Design
> **Status**: Proposed (v1.0)

---

## 1. Executive Summary

CreatorOS is transforming from a **page-builder-focused tool** into an **AI-powered Creator Business Platform** — a single place where creators run their entire business: courses, digital products, community, memberships, CRM, email marketing, and a generated website.

The website is **no longer a thing a creator builds block by block**. Instead, the website is **generated from structured database content**. The creator enters their courses, products, community spaces, blog posts, branding, and pricing — and the platform assembles a fast, professional, SEO-optimized public website automatically.

Think **Shopify** for commerce, **Kajabi** for knowledge businesses, **Circle** for community, **LearnHouse** for courses, **Gumroad** for digital products, and **Skool** for community-led courses — combined into one coherent creator platform.

The drag-and-drop page editor is **retired as the primary authoring surface**. Manual section dragging, absolute positioning, and custom CSS editing are removed. The new admin experience is simple, fast, and professional — modeled on Shopify/Kajabi.

---

## 2. Why We Are Restructuring

### 2.1 Problems with the Current Model

| Problem | Impact |
|---|---|
| Page builder is the central feature | Creators spend time "building pages" instead of creating content |
| Manual section dragging is fragile | Inconsistent layouts, broken mobile, slow pages |
| Duplicated content (pages vs. courses vs. blog) | SEO conflicts, stale content, maintenance burden |
| Absolute positioning and custom CSS | Unprofessional results, slow velocity, hard to theme |
| Page editor hides the real product (courses, community, products) | Wrong product narrative |
| No AI-native authoring | Creators do everything manually |

### 2.2 What Changes

| Before | After |
|---|---|
| Page builder is the hero | AI + structured content is the hero |
| Creator builds the website manually | Creator creates content; website is generated |
| PageEditor with drag-and-drop | Section-based form editor + AI generation |
| Pages store visual layout | Pages store section content (JSON), not pixel layout |
| Funnels and Pages as one mega-module | "Website" module (clean, simple) + Marketing automations |
| Custom CSS per page | Theme-driven, brand-driven styling globally |
| SEO is manual per page | SEO is auto-generated from structured data |

---

## 3. The 10 Pillars of CreatorOS

The platform is organized around **10 pillars**. Every pillar maps to a concrete area of the admin UI, a set of Prisma models, and a set of public-facing pages.

| # | Pillar | What it does | Admin area | Public output |
|---|---|---|---|---|
| 1 | **AI** | Generate website, course pages, product pages, blog posts, emails, copy, images | AI Studio | Auto-generated pages |
| 2 | **Courses** | Create, publish, and sell online courses with curriculum, lessons, certificates | Courses | `/courses`, `/courses/[slug]` |
| 3 | **Digital Products** | Sell downloads, templates, presets, ebooks, software | Digital Products, Store | `/store`, `/store/[slug]` |
| 4 | **Store** | Storefront, checkout, orders, payments, taxes | Store | `/store` |
| 5 | **Community** | Spaces, posts, events, members, leaderboard, moderation | Community | `/community` |
| 6 | **Membership** | Recurring plans, gated content, member portal | Membership | `/membership` |
| 7 | **CRM** | Customers, students, segments, tags, notes, lifecycle | CRM | Member portal |
| 8 | **Email Marketing** | Campaigns, automations, sequences, broadcasts | Email Marketing | Email-rendered |
| 9 | **Website** | Home, pages, blog, navigation, branding, SEO, domains | Website | `/`, `/blog`, custom pages |
| 10 | **Analytics** | Revenue, enrollment, traffic, engagement, funnels | Analytics | Admin only |

These pillars are the **spine** of the platform. Sidebar navigation, API routes, Prisma models, AI workflows, and public routes all derive from these pillars.

---

## 4. Architecture Vision

### 4.1 High-Level Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         CREATOR (admin)                           │
│  ┌────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐   │
│  │ Courses│ │Products│ │Community│ │ Email MKT│ │ Website Mgr│   │
│  └───┬────┘ └───┬────┘ └────┬────┘ └────┬─────┘ └─────┬──────┘   │
│      │          │           │           │             │          │
│      └──────────┴───────────┴───────────┴─────────────┘          │
│                             │                                     │
│                             ▼                                     │
│                    ┌────────────────┐                             │
│                    │  AI Generation │  (AI Studio → brand voice)  │
│                    └────────┬───────┘                             │
│                             │                                     │
│                             ▼                                     │
│                    ┌────────────────┐                             │
│                    │  Structured DB │  (Prisma models)            │
│                    └────────┬───────┘                             │
└─────────────────────────────┼─────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       PUBLIC WEBSITE                             │
│  /            → generated home (Hero + sections)                 │
│  /courses     → auto from Course model                           │
│  /courses/x   → auto from Course + Sections + Lessons            │
│  /store       → auto from Product model                          │
│  /store/x     → auto from Product + Orders + Reviews             │
│  /community   → auto from CommunitySpace + CommunityPost         │
│  /membership  → auto from MembershipPlan                         │
│  /blog        → auto from BlogPost                               │
│  /blog/x      → auto from BlogPost                               │
│  /about, etc. → auto from Page + PageSection                     │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Principles

1. **Content-first, layout-second.** The creator enters content; the platform chooses layout.
2. **Generated, not hand-built.** Public pages are generated from DB content + theme.
3. **No drag-and-drop.** No absolute positioning. No manual section dragging. No custom CSS editing.
4. **AI-native.** AI generates copy, sections, images, SEO, and full pages on demand.
5. **Single source of truth.** Each piece of content lives in one model and renders in one canonical URL.
6. **SEO by default.** Every public page auto-emits meta, Open Graph, JSON-LD, sitemap entries.
7. **Fast by default.** SSG/ISR for public pages; server components for dynamic content.
8. **Shopify-simple admin.** The creator should never feel like a web designer.

---

## 5. How the Website Is Generated

The website is **generated from DB content**, not built block by block.

### 5.1 Inputs to the Generator

| Source model | What it contributes |
|---|---|
| `Workspace` | Brand name, logo, colors, fonts, domain |
| `SiteSetting` | Navigation, footer, social links, SEO defaults |
| `Course` + `Section` + `Lesson` | `/courses`, `/courses/[slug]`, curriculum, instructor, pricing |
| `Product` + `Order` | `/store`, `/store/[slug]`, gallery, pricing, reviews |
| `MembershipPlan` | `/membership`, pricing tiers, gated content |
| `CommunitySpace` + `CommunityPost` + `CommunityEvent` | `/community`, feed, spaces, events |
| `BlogPost` | `/blog`, `/blog/[slug]`, categories, tags, authors |
| `Page` + `PageSection` | Custom pages: `/about`, `/contact`, `/pricing`, `/thank-you` |
| `Funnel` + `FunnelStep` | Marketing funnels (kept under Website or Marketing) |

### 5.2 Generator Pipeline

```
DB content → Resolver (per route) → Section assembler → Theme renderer → HTML/SSG
```

1. **Resolver**: Given a route, decides which models to read.
2. **Section assembler**: Maps content to a set of canonical sections.
3. **Theme renderer**: Renders sections using the active theme + brand settings.
4. **Output**: SSG HTML (or ISR for dynamic pages).

### 5.3 What "No Page Builder" Means

| Removed | Replaced with |
|---|---|
| Drag-and-drop section reordering | Choose section type → form-based editing |
| Absolute positioning | Theme-driven responsive layout |
| Custom CSS per section | Global brand theme (colors, fonts, spacing) |
| Manual column / row layout | Predesigned section templates |
| Pixel-level editing | Content + AI generation |

---

## 6. Landing Pages with Reusable Sections

Custom landing pages (home, marketing pages, sales pages) are built from a **fixed library of reusable section types**. The creator does **not** drag sections; they **choose** a section type, fill in a form (or ask AI to fill it), and publish.

### 6.1 Section Library

| Section | Purpose | Default fields |
|---|---|---|
| `Hero` | Headline, subheadline, CTA, hero image/video | `headline`, `subheadline`, `ctaLabel`, `ctaHref`, `mediaUrl` |
| `Features` | 3–6 feature cards | `title`, `items[]` (icon, title, description) |
| `Testimonials` | Social proof | `title`, `items[]` (quote, author, avatar, role) |
| `Pricing` | Pricing tiers | `title`, `tiers[]` (name, price, features, cta) |
| `FAQ` | Frequently asked questions | `title`, `items[]` (question, answer) |
| `CTA` | Call-to-action band | `headline`, `ctaLabel`, `ctaHref` |
| `Statistics` | Numbers / metrics | `title`, `items[]` (value, label) |
| `Logo Cloud` | Trusted-by logos | `title`, `logos[]` (url, href) |
| `Gallery` | Image grid | `title`, `images[]` (url, caption) |
| `Footer` | Links, social, legal | `columns[]`, `social[]`, `legal[]` |

### 6.2 Landing Page Authoring Flow

```
Choose section type
       │
       ▼
┌──────────────────┐
│ Form-based editor│  ← fields per section type
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  AI content fill │  ← "Generate copy", "Generate image"
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Edit text/img  │  ← inline editing of fields
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│     Publish      │  ← goes live on chosen route
└──────────────────┘
```

### 6.3 Storage

Sections are stored as rows in `PageSection` with a `type` discriminator and a `content` JSON column. **The JSON stores content, not visual layout.** Order is determined by an `order` integer — no x/y coordinates, no per-section CSS, no layout JSON.

---

## 7. Auto-Generated Pages

The platform generates **canonical pages** automatically from primary content models. These pages are not authored — they are rendered.

| Route | Source model | Generated content |
|---|---|---|
| `/courses` | `Course` (published) | Grid of course cards |
| `/courses/[slug]` | `Course` + `Section` + `Lesson` + `Enrollment` + reviews | Hero, instructor, curriculum, pricing, enroll button, reviews, FAQ, SEO |
| `/store` | `Product` (published) | Grid of product cards |
| `/store/[slug]` | `Product` + `Order` + reviews | Gallery, description, pricing, buy button, version history, related, SEO |
| `/community` | `CommunitySpace` + `CommunityPost` + `CommunityEvent` | Feed, spaces sidebar, events, leaderboard, members, announcements |
| `/community/[space]` | `CommunitySpace` + `CommunityPost` | Filtered feed for space |
| `/membership` | `MembershipPlan` | Pricing tiers, features, gated content preview, join button |
| `/blog` | `BlogPost` (published) | Article list, categories, tags, search |
| `/blog/[slug]` | `BlogPost` | Article body, author, related posts, comments, newsletter signup, SEO |
| `/` (home) | `Page` where `slug = "home"` + sections | Custom landing page |
| `/[slug]` | `Page` (custom) | Sections render in order |

### 7.1 Auto-Generation Rules

- A published `Course` automatically appears at `/courses` and gets its own `/courses/[slug]`.
- A published `Product` automatically appears at `/store` and gets its own `/store/[slug]`.
- A published `BlogPost` automatically appears at `/blog` and gets its own `/blog/[slug]`.
- Custom pages (`Page` model) get `/{slug}` — e.g. `/about`, `/contact`, `/pricing`.
- There is **one canonical URL per content item**. No duplicate routes.

---

## 8. AI Generation Flow

AI is the **primary authoring surface** for the website. The creator can generate an entire website, or generate individual pages, sections, copy, and images.

### 8.1 Website Generation Flow

```
Creator: "Generate my website"
            │
            ▼
   ┌────────────────────┐
   │ 1. Read Workspace  │  (brand, domain, industry)
   └─────────┬──────────┘
             ▼
   ┌────────────────────┐
   │ 2. Generate Home   │  (Hero, Features, Testimonials, Pricing, FAQ, CTA)
   └─────────┬──────────┘
             ▼
   ┌────────────────────┐
   │ 3. Generate Course │  for each published Course
   │    landing pages   │   (instructor, curriculum, pricing, reviews)
   └─────────┬──────────┘
             ▼
   ┌────────────────────┐
   │ 4. Generate Product│  for each published Product
   │    pages           │   (gallery, description, pricing)
   └─────────┬──────────┘
             ▼
   ┌────────────────────┐
   │ 5. Generate Blog   │  (seed posts from brand voice + topics)
   └─────────┬──────────┘
             ▼
   ┌────────────────────┐
   │ 6. Generate SEO    │  (meta, OG, JSON-LD per page, sitemap)
   └─────────┬──────────┘
             ▼
   ┌────────────────────┐
   │ 7. Publish         │  (set pages live, regenerate SSG)
   └────────────────────┘
```

### 8.2 AI Capabilities

| Capability | Trigger | Output |
|---|---|---|
| Generate Website | "Generate my website" | Full multi-page website |
| Generate Page | "Generate /about" | Sections for one custom page |
| Generate Section | "Add a testimonials section" | One section with AI copy |
| Generate Copy | Inline "✨ Generate" button | Field-level text |
| Generate Image | Inline "✨ Image" button | Image URL (stored in Media Library) |
| Generate SEO | Per-page action | Title, meta description, OG, JSON-LD |
| Generate Email | Email Marketing | Campaign draft |

### 8.3 Brand Voice

The creator sets a **brand voice** once (tone, audience, keywords, do/don'ts). Every AI generation respects the brand voice. This is stored in `SiteSetting` (or a dedicated `BrandProfile` field on `Workspace`).

---

## 9. Admin Experience

### 9.1 Philosophy

The admin is **modeled on Shopify/Kajabi**: simple, fast, professional. The creator should never feel like a web developer.

### 9.2 Admin Surface

| Screen | Purpose |
|---|---|
| Dashboard | Snapshot of business (revenue, students, traffic, AI tips) |
| AI Studio | Generate website, pages, copy, images, emails |
| Courses | CRUD courses, curriculum, lessons, certificates |
| Digital Products | CRUD products, files, versions |
| Store | Storefront settings, orders, checkout |
| Community | Feed, spaces, events, members |
| CRM | Customers, segments, tags, lifecycle |
| Email Marketing | Campaigns, automations, sequences |
| Membership | Plans, gated content, member portal |
| Affiliates | Affiliates, payouts, links |
| Website | Home, Pages, Blog, Navigation, Branding, SEO, Domains |
| Analytics | Revenue, traffic, engagement |
| Media Library | Images, videos, files |
| Automation | Workflows, triggers, actions |
| Settings | Workspace, billing, integrations, team, super admin |

### 9.3 No-Builder Rules

- No drag-and-drop canvas
- No absolute positioning
- No custom CSS editor
- No "design mode"
- No per-section layout JSON
- No "preview" vs "edit" toggle confusion

Editing is always **form-based** with live preview. Themes control layout.

---

## 10. Data Model Alignment

The existing 41 Prisma models map cleanly onto the new architecture. No models are deleted; their roles are refined.

| Model | Role in new architecture |
|---|---|
| `User`, `Workspace`, `WorkspaceMember` | Multi-tenant identity (unchanged) |
| `Course`, `Section`, `Lesson`, `Enrollment` | Source of `/courses/[slug]` |
| `Product`, `Order`, `Customer` | Source of `/store/[slug]` |
| `MembershipPlan` | Source of `/membership` |
| `CommunitySpace`, `CommunityPost`, `CommunityComment`, `CommunityEvent`, `EventRSVP` | Source of `/community` |
| `BlogPost`, `PostHistory` | Source of `/blog/[slug]` |
| `Page`, `PageSection`, `PageVersion` | Custom pages — **content JSON, not layout** |
| `Funnel`, `FunnelStep` | Marketing funnels (kept) |
| `SiteSetting` | Navigation, footer, branding, SEO defaults |
| `WebPage` | (Review — likely consolidated into `Page`) |
| `Invitation`, `Notification`, `ModerationReport`, `BannedKeyword`, `AuditLog`, `MemberWarning` | Community ops (unchanged) |
| `EmailCampaign`, `Affiliate` | Marketing (unchanged) |
| `AiConversation`, `AiGeneration`, `AiProvider`, `AiModel`, `AiTool`, `CreditTransaction` | AI infrastructure (unchanged) |
| `FeatureFlag`, `AdminSetting` | System (unchanged) |

See `WEBSITE_DATABASE_FLOW.md` for the full data-flow mapping.

---

## 11. Public Frontend

The public frontend is **server-rendered** (Next.js App Router) with SSG/ISR where possible. It consumes DB content via internal resolvers (not the admin API).

See `PUBLIC_FRONTEND_PLAN.md` for the full frontend design.

---

## 12. SEO

SEO is **auto-generated** from structured content. Every public page emits:

- Canonical URL
- SEO title + meta description (AI-generated, editable)
- Open Graph (image, title, description)
- JSON-LD structured data (Course, Product, Article, Organization, WebSite, BreadcrumbList)
- Sitemap entry
- robots.txt respect

See `WEBSITE_SEO_PLAN.md` for the full SEO plan.

---

## 13. Migration

The migration from page-builder to website-manager is **incremental and non-destructive**:

1. Existing `Page` + `PageSection` data is preserved.
2. Existing `Funnel` + `FunnelStep` data is preserved.
3. The drag-and-drop `PageEditor` is replaced with a section-based form editor.
4. Backward compatibility: existing pages with sections continue to render.
5. Sidebar navigation is updated.

See `WEBSITE_MIGRATION_PLAN.md` for the full migration plan.

---

## 14. Success Criteria

| Criterion | How we measure |
|---|---|
| Creator can publish a website in < 10 minutes | Time-to-publish metric |
| No drag-and-drop anywhere in admin | UI audit |
| Every public page has valid JSON-LD | Structured data validator |
| Sitemap covers all published content | Coverage report |
| Public pages load < 1.5s LCP on mobile | Lighthouse |
| Admin has zero dead routes | Route audit |
| Existing pages continue to render | Regression test |

---

## 15. Non-Goals

- We are **not** building a general-purpose website builder.
- We are **not** supporting custom themes via code (themes are admin-configurable only).
- We are **not** supporting third-party page-builder plugins.
- We are **not** supporting per-section custom CSS.
- We are **not** supporting absolute positioning or free-form canvas editing.

---

## 16. Glossary

| Term | Definition |
|---|---|
| **Generated page** | A public page rendered automatically from DB content |
| **Custom page** | A page authored from reusable sections (home, about, contact) |
| **Section** | A reusable content block (Hero, Features, etc.) stored as JSON |
| **Brand voice** | Creator-defined tone/audience/keywords used by AI |
| **Theme** | Global visual config (colors, fonts, spacing) applied to all pages |
| **Canonical URL** | The single, official URL for a piece of content |

---

## 17. Open Questions

1. Should `WebPage` model be consolidated into `Page`, or kept separate for legacy reasons?
2. Should funnels live under **Website** or **Marketing/Automation**? (Recommendation: Marketing/Automation.)
3. Should certificates live under **Courses** or **Settings**? (Recommendation: Courses.)
4. Should the public frontend be a separate Next.js app, or a route group inside the admin app? (Recommendation: route group `/public/[...]` for shared code; separate domain via Next.js rewrites.)

---

## 18. Related Documents

| Document | Purpose |
|---|---|
| `PUBLIC_FRONTEND_PLAN.md` | Public-facing design and component structure |
| `WEBSITE_DATABASE_FLOW.md` | Data-flow from DB to public pages |
| `WEBSITE_NAVIGATION.md` | Sidebar and admin navigation restructure |
| `WEBSITE_SEO_PLAN.md` | SEO strategy for generated pages |
| `WEBSITE_MIGRATION_PLAN.md` | Migration steps and rollback plan |

---

**End of document.**
