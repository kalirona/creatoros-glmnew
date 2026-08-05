# CreatorOS — Website Database Flow

> **Document type**: Data Flow & Model Mapping
> **Scope**: How every public website page is generated from Prisma models
> **Audience**: Engineering, Backend, Data
> **Status**: Proposed (v1.0)

---

## 1. Purpose

This document defines exactly **how every public website page is generated from database content**. There is no duplicated content, no manual HTML, no copy-paste between models. Each piece of content lives in exactly one model and renders at exactly one canonical URL.

The public frontend is a **read projection** of the structured database. The admin is the **write surface**. AI is the **authoring accelerator**. The database is the **single source of truth**.

---

## 2. Source Models at a Glance

| Source model | Contributes to | Public routes |
|---|---|---|
| `Workspace` | Brand, domain, identity | All pages (header/footer) |
| `SiteSetting` | Navigation, footer, branding, SEO defaults | All pages |
| `Course` + `Section` + `Lesson` | Course catalog + course pages | `/courses`, `/courses/[slug]` |
| `Product` + `Order` | Product catalog + product pages | `/store`, `/store/[slug]` |
| `MembershipPlan` | Membership tiers | `/membership` |
| `CommunitySpace` + `CommunityPost` + `CommunityComment` + `CommunityEvent` + `EventRSVP` | Community | `/community`, sub-routes |
| `BlogPost` + `PostHistory` | Blog | `/blog`, `/blog/[slug]` |
| `Page` + `PageSection` + `PageVersion` | Custom pages (home, about, contact, pricing, legal) | `/`, `/[slug]` |
| `Funnel` + `FunnelStep` | Marketing funnels | `/go/[funnel-slug]` (or under `/f/`) |
| `Customer` + `User` + `WorkspaceMember` | Authenticated views, member portal | `/account`, `/library` |
| `Enrollment` | Course progress, certificates | Course player |
| `Invitation` | Community join flow | `/join/[token]` |
| `AiGeneration` | Generated content history | Admin only |

---

## 3. The Single Source of Truth Principle

**Rule**: Each piece of content has exactly one canonical storage location.

| Content | Lives in | NOT duplicated to |
|---|---|---|
| Course title | `Course.title` | Not in `Page` or `BlogPost` |
| Course description | `Course.description` | Not copied into a landing `Page` |
| Product price | `Product.price` | Not in `Page` |
| Instructor bio | `User.bio` or `Workspace.bio` | Not in multiple pages |
| Brand colors | `SiteSetting.theme.colors` | Not hardcoded per section |
| Navigation links | `SiteSetting.navigation` | Not in `Page` sections |
| Footer links | `SiteSetting.footer` | Not in `Page` sections |
| SEO title for a course | `Course.seoTitle` (or AI-generated, stored on Course) | Not in a separate SEO table |
| Home page hero copy | `PageSection.content` on `Page(slug="home")` | Not in `SiteSetting` |

This means:

- A creator edits a course title **once** → it updates on `/courses`, `/courses/[slug]`, sitemap, JSON-LD, navigation, search index, and any card that references it.
- A creator changes brand color **once** → the entire site re-themes.
- A creator edits navigation **once** → header + footer + mobile menu all update.

---

## 4. High-Level Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         ADMIN (writes)                            │
│   Courses │ Products │ Community │ Blog │ Pages │ Settings        │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Prisma writes
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                          DATABASE (SQLite)                        │
│   41 Prisma models — single source of truth                      │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Prisma reads (resolvers)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     PUBLIC PAGE RESOLVERS                         │
│   Route → Resolver → Model reads → Section assembly              │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Resolved props
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PUBLIC PAGE COMPONENTS                         │
│   RSC + theme tokens → HTML                                      │
└──────────────────────────┬───────────────────────────────────────┘
                           │ SSG / ISR
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                       PUBLIC WEBSITE (CDN)                        │
│   / │ /courses │ /store │ /community │ /blog │ /[slug]           │
└──────────────────────────────────────────────────────────────────┘
```

### 4.1 Resolver Layer

The resolver layer sits between the database and the public components. It is **not** the admin REST API. It is an internal TypeScript module that:

1. Takes a route + tenant context.
2. Reads the minimum necessary models via Prisma.
3. Assembles a typed props object for the page component.
4. Returns props + cache hints.

```
src/lib/public-resolvers/
├── home.ts            ← resolves Page(slug="home") + sections
├── courses-list.ts    ← resolves Course[] published
├── course-detail.ts   ← resolves Course + Section + Lesson + reviews
├── store-list.ts      ← resolves Product[] published
├── product-detail.ts  ← resolves Product + reviews
├── community.ts       ← resolves CommunitySpace[] + feed
├── membership.ts      ← resolves MembershipPlan[]
├── blog-list.ts       ← resolves BlogPost[] published
├── blog-detail.ts     ← resolves BlogPost + author
├── custom-page.ts     ← resolves Page + PageSection[] by slug
└── site-shell.ts      ← resolves Workspace + SiteSetting for header/footer
```

### 4.2 Why a Separate Resolver Layer?

| Reason | Explanation |
|---|---|
| **Performance** | Public reads can be cached/optimized independently of admin API |
| **Security** | Public resolvers only expose public fields; no admin leakage |
| **Stability** | Admin API can change without breaking public site |
| **Caching** | Resolvers emit cache hints (ISR `revalidate`, tags) |
| **Typed props** | Each resolver returns a typed shape consumed by RSC |

---

## 5. Data Flow Diagram: DB → API → Public Page

### 5.1 Home Page (`/`)

```
┌───────────────┐
│ Page(slug=    │
│   "home")     │
│  - id         │
│  - title      │
│  - slug       │
│  - status     │
└───────┬───────┘
        │
        │ 1:N
        ▼
┌───────────────┐
│ PageSection[] │
│  - pageId     │
│  - type       │ ← "hero", "features", etc.
│  - content    │ ← JSON (fields only, no layout)
│  - order      │
└───────┬───────┘
        │
        ▼
┌───────────────────────────┐
│ home.ts resolver          │
│  - reads Page             │
│  - reads PageSection[]    │
│  - reads SiteSetting      │
│  - reads Workspace        │
│  - returns HomeProps      │
└───────┬───────────────────┘
        │
        ▼
┌───────────────────────────┐
│ (public)/page.tsx         │
│  - <Header/>              │
│  - <SectionRenderer       │
│      sections={sections}  │
│  - <Footer/>              │
└───────────────────────────┘
        │
        ▼
        SSG → CDN → User
```

### 5.2 Course Page (`/courses/[slug]`)

```
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│ Course         │───▶│ Section[]      │───▶│ Lesson[]       │
│  - slug        │    │  - courseId    │    │  - sectionId   │
│  - title       │    │  - title       │    │  - title       │
│  - description │    │  - order       │    │  - duration    │
│  - coverImage  │    └────────────────┘    │  - videoUrl    │
│  - price       │                          │  - previewable │
│  - instructorId│──────────┐               └────────────────┘
│  - category    │          │
│  - status      │          │
│  - seoTitle    │          ▼
│  - seoDesc     │    ┌────────────────┐
│  - publishedAt │    │ User           │
└────────────────┘    │  (instructor)  │
        │             │  - name        │
        │             │  - bio         │
        │             │  - avatar      │
        │             └────────────────┘
        │
        ▼
┌────────────────────────────┐
│ course-detail.ts resolver  │
│  - reads Course by slug    │
│  - reads Section + Lesson  │
│  - reads instructor User   │
│  - reads Enrollment[]      │
│  - reads reviews           │
│  - returns CourseProps     │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ /courses/[slug]/page.tsx   │
│  - <CourseHero/>           │
│  - <InstructorCard/>       │
│  - <CurriculumAccordion/>  │
│  - <PricingCard/>          │
│  - <CourseReviews/>        │
│  - <RelatedCourses/>       │
│  - <JsonLd schema="Course"/>│
└────────────────────────────┘
              │
              ▼
        SSG → CDN → User
```

### 5.3 Product Page (`/store/[slug]`)

```
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│ Product        │    │ Order[]        │    │ Customer[]     │
│  - slug        │    │  - productId   │    │  (reviewers)   │
│  - title       │    │  - customerId  │    └────────────────┘
│  - description │    │  - rating      │
│  - price       │    │  - review      │
│  - images[]    │    └────────────────┘
│  - files[]     │
│  - version     │    ┌────────────────┐
│  - category    │    │ Product[]      │
│  - status      │    │  (related,     │
│  - seoTitle    │    │   same category│
│  - seoDesc     │    │   excluding    │
└────────────────┘    │   current)     │
        │             └────────────────┘
        ▼
┌────────────────────────────┐
│ product-detail.ts resolver │
│  - reads Product by slug   │
│  - reads Order[] (reviews) │
│  - reads related Products  │
│  - returns ProductProps    │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ /store/[slug]/page.tsx     │
│  - <ProductGallery/>       │
│  - <ProductPricing/>       │
│  - <ArticleBody/>          │
│  - <VersionHistory/>       │
│  - <ProductReviews/>       │
│  - <RelatedProducts/>      │
│  - <JsonLd schema="Product"/>│
└────────────────────────────┘
```

### 5.4 Community Page (`/community`)

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ CommunitySpace[] │  │ CommunityPost[]  │  │ CommunityEvent[] │
│  - id            │  │  - spaceId       │  │  - title         │
│  - name          │  │  - authorId      │  │  - startsAt      │
│  - slug          │  │  - title         │  │  - RSVPs[]       │
│  - description   │  │  - body          │  └──────────────────┘
│  - visibility    │  │  - pinned        │
│  - order         │  │  - reactions     │  ┌──────────────────┐
└──────────────────┘  │  - comments[]    │  │ WorkspaceMember[]│
                      └──────────────────┘  │  (for leaderboard │
                            │                │   + directory)   │
                            ▼                └──────────────────┘
                ┌──────────────────────────────┐
                │ community.ts resolver        │
                │  - reads Spaces (visible)    │
                │  - reads Posts (paginated)   │
                │  - reads Events (upcoming)   │
                │  - reads Leaderboard (top N) │
                │  - returns CommunityProps    │
                └─────────────┬────────────────┘
                              │
                              ▼
                ┌──────────────────────────────┐
                │ /community/page.tsx          │
                │  - <CommunitySidebar/>       │
                │  - <Feed/>                   │
                │  - <EventCard/>              │
                │  - <Leaderboard/>            │
                └──────────────────────────────┘
                              │
                              ▼
                    RSC + ISR (30s) → Edge → User
```

### 5.5 Blog Page (`/blog/[slug]`)

```
┌────────────────┐    ┌────────────────┐
│ BlogPost       │    │ User / Member  │
│  - slug        │───▶│  (author)      │
│  - title       │    │  - name        │
│  - body        │    │  - avatar      │
│  - coverImage  │    │  - bio         │
│  - excerpt     │    └────────────────┘
│  - category    │
│  - tags[]      │    ┌────────────────┐
│  - authorId    │    │ BlogPost[]     │
│  - publishedAt │    │  (related by   │
│  - status      │    │   tag/category)│
│  - seoTitle    │    └────────────────┘
│  - seoDesc     │
└────────────────┘
        │
        ▼
┌────────────────────────────┐
│ blog-detail.ts resolver    │
│  - reads BlogPost by slug  │
│  - reads author            │
│  - reads related posts     │
│  - reads comments          │
│  - returns BlogProps       │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ /blog/[slug]/page.tsx      │
│  - <ArticleBody/>          │
│  - <AuthorBox/>            │
│  - <TagCloud/>             │
│  - <CommentThread/>        │
│  - <NewsletterSignup/>     │
│  - <RelatedPosts/>         │
│  - <JsonLd schema="Article"/>│
└────────────────────────────┘
```

### 5.6 Custom Page (`/[slug]`)

```
┌────────────────┐
│ Page           │
│  - slug        │  ← e.g. "about", "contact", "pricing"
│  - title       │
│  - status      │
└───────┬────────┘
        │ 1:N
        ▼
┌────────────────────────┐
│ PageSection[]          │
│  - type                │  ← "hero", "features", ...
│  - content (JSON)      │  ← fields only, NOT layout
│  - order               │
└───────┬────────────────┘
        │
        ▼
┌────────────────────────────┐
│ custom-page.ts resolver    │
│  - reads Page by slug      │
│  - reads PageSection[]     │
│  - reads SiteSetting       │
│  - returns CustomPageProps │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ /[slug]/page.tsx           │
│  - <SectionRenderer        │
│      sections={sections}   │
│  - <JsonLd schema="WebPage"/>│
└────────────────────────────┘
```

---

## 6. Site Shell: Branding, Navigation, Footer

Every public page is wrapped by a **site shell** — header + footer — resolved from `Workspace` + `SiteSetting`.

### 6.1 SiteSetting Fields (used by public site)

| Field | Type | Used for |
|---|---|---|
| `brandName` | string | Header logo text, footer, OG |
| `logoUrl` | string | Header logo |
| `faviconUrl` | string | Browser tab |
| `tagline` | string | Footer tagline |
| `theme` | JSON | Colors, fonts, spacing tokens |
| `navigation` | JSON | Header nav links |
| `footer` | JSON | Footer columns + links |
| `socialLinks` | JSON | Social media URLs |
| `seoDefaultTitle` | string | Fallback `<title>` |
| `seoDefaultDescription` | string | Fallback meta description |
| `seoOgImage` | string | Default OG image |
| `robotsAllow` | boolean | robots.txt |
| `domain` | string | Canonical domain |
| `analyticsId` | string | Analytics script |

### 6.2 Navigation JSON Shape

```json
{
  "items": [
    { "label": "Home", "href": "/" },
    { "label": "Courses", "href": "/courses" },
    { "label": "Products", "href": "/store" },
    { "label": "Community", "href": "/community" },
    { "label": "Blog", "href": "/blog" },
    { "label": "Pricing", "href": "/pricing" }
  ]
}
```

### 6.3 Footer JSON Shape

```json
{
  "columns": [
    {
      "title": "Product",
      "links": [
        { "label": "Courses", "href": "/courses" },
        { "label": "Products", "href": "/store" }
      ]
    }
  ],
  "social": [
    { "label": "Twitter", "href": "https://twitter.com/...", "icon": "twitter" }
  ],
  "legal": [
    { "label": "Terms", "href": "/terms" },
    { "label": "Privacy", "href": "/privacy" }
  ]
}
```

### 6.4 Shell Resolution

```
site-shell.ts resolver
  ├─ reads Workspace (by domain)
  ├─ reads SiteSetting (by workspaceId)
  ├─ returns ShellProps {
  │     brand, logo, nav, footer, theme, seoDefaults
  │   }
  └─
```

The shell is resolved once per request and passed to `(public)/layout.tsx`.

---

## 7. The Page + PageSection Model

### 7.1 What PageSection Stores

The `PageSection` model stores **content**, not visual layout.

| Field | Type | Purpose |
|---|---|---|
| `id` | string | PK |
| `pageId` | string | FK → Page |
| `type` | string | Discriminator: `hero`, `features`, etc. |
| `content` | JSON | **Content fields only** (text, images, items) |
| `order` | int | Render order (top to bottom) |
| `status` | string | `draft` / `published` |
| `version` | int | Versioning for `PageVersion` |

### 7.2 What PageSection Does NOT Store

| Not stored | Why |
|---|---|
| `x`, `y` coordinates | No absolute positioning |
| `width`, `height` | Theme controls sizing |
| `columnSpan`, `rowSpan` | No grid layout per section |
| `css`, `customStyles` | No custom CSS |
| `mobileLayout` | Theme controls responsive behavior |
| `html` | No raw HTML injection |
| `script` | No JS injection |

### 7.3 Content JSON Examples

#### Hero section

```json
{
  "headline": "Build your creator business in one place.",
  "subheadline": "Courses, products, community, and a beautiful website — powered by AI.",
  "ctaLabel": "Start free",
  "ctaHref": "/signup",
  "mediaUrl": "/media/hero.jpg",
  "mediaAlt": "Creator working on laptop"
}
```

#### Features section

```json
{
  "title": "Everything you need",
  "items": [
    {
      "icon": "graduation-cap",
      "title": "Courses",
      "description": "Sell online courses with video lessons."
    },
    {
      "icon": "shopping-bag",
      "title": "Products",
      "description": "Sell digital downloads and templates."
    }
  ]
}
```

#### Pricing section

```json
{
  "title": "Simple pricing",
  "tiers": [
    {
      "name": "Starter",
      "price": "$29/mo",
      "features": ["1 course", "Community access"],
      "ctaLabel": "Choose Starter",
      "ctaHref": "/checkout?plan=starter"
    }
  ]
}
```

### 7.4 PageVersion

`PageVersion` stores snapshots of `Page` + its `PageSection[]` for version history and rollback. This is the replacement for the old "manual edit + undo" model of the page builder.

---

## 8. Auto-Generation Rules (Detailed)

### 8.1 Course → `/courses/[slug]`

When a `Course` with `status = "published"` exists:

1. `/courses` listing includes it (sorted by `publishedAt` desc).
2. `/courses/[course.slug]` resolves to the course landing page.
3. Sitemap includes `/courses/[course.slug]`.
4. JSON-LD `Course` schema is emitted on the course page.
5. If the course is unpublished, the route returns 410 Gone and is removed from sitemap.

### 8.2 Product → `/store/[slug]`

When a `Product` with `status = "published"` exists:

1. `/store` listing includes it.
2. `/store/[product.slug]` resolves to the product page.
3. Sitemap includes it.
4. JSON-LD `Product` schema is emitted.

### 8.3 BlogPost → `/blog/[slug]`

When a `BlogPost` with `status = "published"` and `publishedAt <= now()` exists:

1. `/blog` listing includes it.
2. `/blog/[post.slug]` resolves to the article.
3. `/blog/category/[cat]` and `/blog/tag/[tag]` include it.
4. Sitemap includes it.
5. JSON-LD `Article` schema is emitted.

### 8.4 MembershipPlan → `/membership`

When ≥1 `MembershipPlan` exists:

1. `/membership` page renders pricing tiers.
2. Each tier links to `/checkout?plan=[planId]`.
3. Sitemap includes `/membership`.

### 8.5 CommunitySpace → `/community/[space]`

When a `CommunitySpace` exists:

1. `/community` sidebar lists it (if visible to viewer).
2. `/community/[space.slug]` shows the space's feed.
3. Spaces are not in sitemap if member-only.

### 8.6 Custom Page → `/[slug]`

When a `Page` with `status = "published"` and a slug that **does not collide** with reserved routes exists:

1. `/[page.slug]` renders its sections in order.
2. Sitemap includes it.

**Reserved slugs** (cannot be used by custom pages): `courses`, `store`, `community`, `membership`, `blog`, `cart`, `checkout`, `orders`, `library`, `account`, `login`, `signup`, `api`, `admin`, `preview`, `sitemap.xml`, `robots.txt`.

---

## 9. Cache Invalidation

Each public route declares ISR tags. When content changes, the admin invalidates the relevant tags.

| Change | Tags invalidated | Routes refreshed |
|---|---|---|
| `Course` updated | `course:{id}`, `courses-list` | `/courses/[slug]`, `/courses` |
| `Product` updated | `product:{id}`, `store-list` | `/store/[slug]`, `/store` |
| `BlogPost` updated | `post:{id}`, `blog-list` | `/blog/[slug]`, `/blog` |
| `Page` or `PageSection` updated | `page:{slug}` | `/[slug]` (or `/` for home) |
| `SiteSetting` updated | `shell` | All routes |
| `MembershipPlan` updated | `membership` | `/membership` |
| `CommunityPost` created | `community-feed` | `/community` |

Implementation: `revalidateTag()` from Next.js, called from admin write endpoints.

---

## 10. Read Performance

| Pattern | Strategy |
|---|---|
| Course landing page | Single Prisma query with `include: { sections: { include: { lessons: true } }, instructor: true }` |
| Course listing | Paginated, indexed on `(workspaceId, status, publishedAt)` |
| Product listing | Paginated, indexed on `(workspaceId, status, publishedAt)` |
| Blog listing | Paginated, indexed on `(workspaceId, status, publishedAt)` |
| Community feed | Cursor pagination, indexed on `(spaceId, createdAt)` |
| Site shell | Cached per workspace (5 min TTL) |

---

## 11. Multi-Tenant Isolation

Every public read is **scoped by `workspaceId`** resolved from the request domain:

```
domain → Workspace → workspaceId → all reads scoped
```

No cross-workspace data ever leaks. This is enforced at the resolver layer, not at the component layer.

---

## 12. Data Integrity Rules

| Rule | Enforcement |
|---|---|
| Slugs unique per workspace per model type | DB unique index `(workspaceId, slug)` on Course, Product, BlogPost, Page |
| Reserved slugs blocked | Validator on Page.create |
| `status = "draft"` never appears on public site | Resolver filters |
| `publishedAt` in future never appears | Resolver filters `publishedAt <= now()` |
| Soft-deleted content never appears | Resolver filters `deletedAt IS NULL` |
| Orphan sections never render | FK + cascade rules |

---

## 13. Audit Trail

All public-affecting writes go through admin endpoints that emit `AuditLog` entries:

| Action | Audited |
|---|---|
| Publish / unpublish Course | Yes |
| Publish / unpublish Product | Yes |
| Publish / unpublish BlogPost | Yes |
| Edit Page sections | Yes (with `PageVersion` snapshot) |
| Update SiteSetting | Yes |
| Update theme | Yes |
| Domain change | Yes |

---

## 14. AI-Generated Content Storage

AI-generated content is **written back to the same models** as manually created content. There is no separate "AI content" table.

| AI action | Writes to |
|---|---|
| Generate website | `Page` (home) + `PageSection[]` |
| Generate course page | `Course.seoTitle`, `Course.seoDesc`, `Course.description` |
| Generate product page | `Product.seoTitle`, `Product.seoDesc` |
| Generate blog post | `BlogPost` (full draft) |
| Generate section | `PageSection.content` |
| Generate copy | Field on parent model |
| Generate image | Media Library → URL stored on parent field |

`AiGeneration` records the **provenance** (prompt, model, tokens, cost) for traceability and credit accounting, but the **content itself lives in the canonical model**.

---

## 15. Relationship to Existing APIs

The existing admin API routes (`/api/data/pages`, `/api/data/courses`, etc.) remain the **write surface** for admin. The new public resolvers are a **separate read path** that does not go through these REST endpoints.

| Layer | Purpose |
|---|---|
| `/api/data/*` | Admin writes + admin reads (auth required) |
| `/api/ai/*` | AI generation (auth required) |
| `/api/community/*` | Community mutations (auth required) |
| `src/lib/public-resolvers/*` | Public reads (no auth, cached) |

This separation is intentional — admin API can evolve without breaking the public site, and public reads can be aggressively cached.

---

## 16. Migration from Current Schema

The current schema already has the right models. **No models are deleted.** Changes are:

1. `PageSection.content` JSON is **redefined** to store content fields only (not layout). Existing layout JSON continues to render via a legacy adapter during migration.
2. `SiteSetting` gains new fields: `theme`, `navigation`, `footer`, `brandName`, `logoUrl`, `seoDefaultTitle`, etc.
3. `Course`, `Product`, `BlogPost` gain SEO fields: `seoTitle`, `seoDescription`, `ogImage`.
4. New internal resolvers are added (`src/lib/public-resolvers/*`).
5. Public route group `(public)` is added to the app router.

See `WEBSITE_MIGRATION_PLAN.md` for the full migration plan.

---

## 17. Open Questions

1. Should `WebPage` model be consolidated into `Page`? **Recommendation**: yes, with a migration script that copies `WebPage` rows into `Page`.
2. Should public resolvers read directly from SQLite or via a read replica? **Recommendation**: direct SQLite for v1 (workload is read-heavy but cacheable).
3. Should we add a `View` materialized table for community feed? **Recommendation**: no, cursor pagination on indexed columns is sufficient.

---

## 18. Related Documents

- `WEBSITE_ARCHITECTURE.md` — overall architecture
- `PUBLIC_FRONTEND_PLAN.md` — public frontend design
- `WEBSITE_NAVIGATION.md` — admin navigation
- `WEBSITE_SEO_PLAN.md` — SEO strategy
- `WEBSITE_MIGRATION_PLAN.md` — migration plan

---

**End of document.**
