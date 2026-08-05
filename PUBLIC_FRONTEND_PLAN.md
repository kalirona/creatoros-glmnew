# CreatorOS — Public Frontend Plan

> **Document type**: Frontend Design & Component Architecture
> **Scope**: Public-facing website rendered from DB content
> **Inspiration**: LearnHouse (courses), Kajabi (creator business), Circle (community), Gumroad (products), Skool (community-led courses)
> **Status**: Proposed (v1.0)

---

## 1. Goals

The public frontend is the **face of every creator's business on CreatorOS**. It must:

1. Render entirely from **database content** — no manual HTML.
2. Be **fast** (SSG/ISR, server components, minimal JS).
3. Be **responsive** by default (mobile-first).
4. Be **SEO-optimized** (meta, OG, JSON-LD, sitemap).
5. Be **accessible** (WCAG AA).
6. Be **brandable** (colors, fonts, logo from `SiteSetting`).
7. Look **professional out of the box** — like Shopify/Kajabi, not like a page builder.

The public frontend is **not editable** by the creator in a pixel-level sense. The creator edits **content**; the frontend renders it.

---

## 2. Frontend Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Already in use; RSC + SSG/ISR |
| Styling | Tailwind CSS + theme tokens | Brand tokens drive global styling |
| Components | shadcn/ui (already in repo) | Consistent, accessible primitives |
| Data | Internal resolvers (not admin API) | Public reads go through cached resolvers |
| Rendering | SSG for static, ISR for dynamic, RSC for personalized | Best performance + freshness |
| Images | Next.js `<Image>` + Media Library | Optimized, responsive images |
| Fonts | `next/font` + brand fonts from SiteSetting | No layout shift |

---

## 3. Top-Level Navigation

The public site has a **single global header** and **single global footer** configured in `SiteSetting`.

### 3.1 Header

```
┌─────────────────────────────────────────────────────────────────┐
│  [LOGO]   Home  Courses  Products  Community  Blog  Pricing  About  Contact   [Login] [Cart] │
└─────────────────────────────────────────────────────────────────┘
```

| Nav item | Route | Visible when |
|---|---|---|
| Home | `/` | Always |
| Courses | `/courses` | ≥1 published Course |
| Products | `/store` | ≥1 published Product |
| Community | `/community` | Community enabled |
| Blog | `/blog` | ≥1 published BlogPost |
| Pricing | `/pricing` | Membership or paid products exist |
| About | `/about` | Custom page exists |
| Contact | `/contact` | Custom page exists |
| Login | `/login` | Always (member portal) |
| Cart | `/cart` | Store enabled |

### 3.2 Footer

```
┌─────────────────────────────────────────────────────────────────┐
│  [LOGO]                                                          │
│  Brand tagline                                                   │
│                                                                  │
│  Product        Company        Resources      Legal             │
│  Courses        About          Blog           Terms             │
│  Products       Contact        Community      Privacy           │
│  Membership     Careers        Help Center    Refund Policy     │
│                                                                  │
│  [Twitter] [YouTube] [Instagram] [LinkedIn] [TikTok]            │
│  © 2025 Brand. Powered by CreatorOS.                            │
└─────────────────────────────────────────────────────────────────┘
```

Footer columns, social links, and legal links are all configured in `SiteSetting`.

---

## 4. Route Map

| Route | Source | Rendering | Cache |
|---|---|---|---|
| `/` | `Page(slug="home")` + sections | SSG + ISR (60s) | Full CDN |
| `/courses` | `Course[]` published | SSG + ISR (300s) | Full CDN |
| `/courses/[slug]` | `Course` + curriculum | SSG + ISR (300s) | Full CDN |
| `/store` | `Product[]` published | SSG + ISR (300s) | Full CDN |
| `/store/[slug]` | `Product` + reviews | SSG + ISR (300s) | Full CDN |
| `/community` | `CommunitySpace` + feed | RSC + ISR (30s) | Edge |
| `/community/[space]` | Space-scoped feed | RSC + ISR (30s) | Edge |
| `/community/[space]/[post]` | Post + comments | RSC + ISR (10s) | Edge |
| `/membership` | `MembershipPlan[]` | SSG + ISR (300s) | Full CDN |
| `/blog` | `BlogPost[]` published | SSG + ISR (300s) | Full CDN |
| `/blog/[slug]` | `BlogPost` | SSG + ISR (600s) | Full CDN |
| `/[slug]` | Custom `Page` | SSG + ISR (600s) | Full CDN |
| `/cart`, `/checkout`, `/orders` | Store + Customer | RSC, dynamic | No cache |
| `/login`, `/signup`, `/account` | Auth | RSC, dynamic | No cache |
| `/sitemap.xml` | All published content | SSG (hourly) | Full CDN |
| `/robots.txt` | SiteSetting | Static | Full CDN |

---

## 5. Course Website

Inspired by **LearnHouse** and **Kajabi**.

### 5.1 `/courses` (listing)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Hero: "Learn from [Creator]"]                                  │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Course  │  │ Course  │  │ Course  │  │ Course  │            │
│  │ cover   │  │ cover   │  │ cover   │  │ cover   │            │
│  │ Title   │  │ Title   │  │ Title   │  │ Title   │            │
│  │ ★ 4.8   │  │ ★ 4.7   │  │ ★ 4.9   │  │ ★ 4.6   │            │
│  │ $99     │  │ $49     │  │ $199    │  │ Free    │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│                                                                  │
│  [Filters: Category] [Sort: Popular / Newest / Price]            │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 `/courses/[slug]` (course landing)

| Section | Content |
|---|---|
| Hero | Title, subtitle, cover image/video, price, "Enroll Now" button |
| Instructor | Avatar, name, bio, social links (from `Workspace` or `User`) |
| What you'll learn | Bulleted outcomes (from Course metadata) |
| Curriculum | Sections → Lessons (collapsible tree from `Section` + `Lesson`) |
| Requirements | Prerequisites list |
| Description | Long-form description (markdown) |
| Reviews | Student reviews (from `Enrollment` + review field) |
| Pricing | Price card, discount, installment options |
| FAQ | Course-specific FAQ |
| CTA | Final enroll band |
| Related courses | 3 related courses |
| SEO footer | Breadcrumbs, structured data |

### 5.3 Course Player (authenticated)

For enrolled students:

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar: Curriculum        │  Main: Lesson video / content      │
│  ▸ Section 1               │  ──────────────────────────────     │
│    ✓ Lesson 1              │  [Video player]                     │
│    ▸ Lesson 2 (current)    │                                     │
│  ▸ Section 2               │  Lesson title                       │
│    ○ Lesson 3              │  Description / attachments          │
│                            │                                     │
│                            │  [Mark complete] [Next lesson →]    │
│                            │                                     │
│  Progress: 45%             │  [Comments / Q&A]                   │
└────────────────────────────┴─────────────────────────────────────┘
```

### 5.4 Course Page Features

| Feature | Source |
|---|---|
| Progress tracking | `Enrollment.progress` (computed from `Lesson` completions) |
| Certificate | Auto-issued on completion (configurable per Course) |
| Reviews / ratings | `Enrollment.review`, `Enrollment.rating` |
| Q&A / comments | Per-lesson comments (CommunityPost-style) |
| Notes | Per-lesson student notes (optional) |
| Bookmarks | Per-lesson bookmarks (optional) |
| Resume | Last-watched lesson (from `Enrollment.lastLessonId`) |

---

## 6. Product Website

Inspired by **Gumroad** and **Shopify**.

### 6.1 `/store` (listing)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Hero: "Digital products from [Creator]"]                       │
│                                                                  │
│  [Filters: Category] [Sort: Popular / Newest / Price]            │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                          │
│  │ cover   │  │ cover   │  │ cover   │                          │
│  │ Title   │  │ Title   │  │ Title   │                          │
│  │ $19     │  │ $29     │  │ Free    │                          │
│  │ [Buy]   │  │ [Buy]   │  │ [Get]   │                          │
│  └─────────┘  └─────────┘  └─────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 `/store/[slug]` (product page)

| Section | Content |
|---|---|
| Gallery | Multi-image carousel (cover + screenshots) |
| Title + price | Title, price, discount, "Buy Now" button |
| Short description | 1–2 sentence pitch |
| Long description | Markdown body |
| What's included | File list with sizes (post-purchase download) |
| Version history | `Product` versions table |
| Reviews | Buyer reviews |
| Related products | 3 related products |
| FAQ | Product FAQ |
| CTA | Final buy band |

### 6.3 Purchase Flow

```
/store/[slug] → /cart → /checkout → /orders/[id] → /library
                                                       │
                                                       ▼
                                              Download files
```

Post-purchase:
- Customer account auto-created (if not existing)
- Files available in `/library`
- Receipt emailed
- Affiliate credit (if applicable)

---

## 7. Community Website

Inspired by **Circle**, **Skool**, and **Discord** (text-first).

### 7.1 `/community` (main)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Join Community CTA — if not member]                            │
│                                                                  │
│  ┌──────────────┐  ┌─────────────────────────────────────┐     │
│  │ Spaces       │  │ Feed                                 │     │
│  │ • Announce   │  │ ┌─────────────────────────────────┐  │     │
│  │ • General    │  │ │ [Avatar] User · 2h              │  │     │
│  │ • Q&A        │  │ │ Post title                      │  │     │
│  │ • Wins       │  │ │ Post body preview...            │  │     │
│  │ • Events     │  │ │ ♥ 12  💬 4                       │  │     │
│  │              │  │ └─────────────────────────────────┘  │     │
│  │ Events       │  │ ...more posts...                     │     │
│  │ • Live Q&A   │  │                                       │     │
│  │   Mar 5      │  │                                       │     │
│  │              │  │                                       │     │
│  │ Leaderboard  │  │                                       │     │
│  │ 1. Alice 320 │  │                                       │     │
│  │ 2. Bob   290 │  │                                       │     │
│  │              │  │                                       │     │
│  │ Members      │  │                                       │     │
│  │ 1,240 total  │  │                                       │     │
│  └──────────────┘  └─────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Community Pages

| Route | Content |
|---|---|
| `/community` | Main feed + spaces sidebar + events + leaderboard |
| `/community/[space]` | Filtered feed for a space |
| `/community/[space]/[post]` | Single post + comments |
| `/community/events` | Event list + RSVPs |
| `/community/events/[id]` | Event details + RSVP + attendees |
| `/community/members` | Member directory (configurable) |
| `/community/members/[id]` | Public profile (posts, points, joined date) |
| `/community/leaderboard` | Top members by points |

### 7.3 Community Features

| Feature | Source |
|---|---|
| Feed (reverse-chronological + algorithmic) | `CommunityPost` |
| Spaces (themed channels) | `CommunitySpace` |
| Events + RSVPs | `CommunityEvent`, `EventRSVP` |
| Reactions | `CommunityPost.reactions` |
| Comments + threaded replies | `CommunityComment` |
| Pinned posts | `CommunityPost.pinned` |
| Announcements | `CommunityPost.type = "announcement"` |
| Moderation | `ModerationReport`, `BannedKeyword`, `MemberWarning` |
| Leaderboard | Computed from posts, reactions, helpful answers |
| Member directory | `WorkspaceMember` (configurable visibility) |
| Profile pages | Public profile per member |
| Join / invite | `Invitation`, public join (if open) |

### 7.4 Access Control

| Content | Visibility |
|---|---|
| Public posts | Anyone |
| Member-only spaces | Authenticated members |
| Paid spaces | Active MembershipPlan subscription |
| Course-tied spaces | Active Enrollment in linked Course |

---

## 8. Blog Website

Inspired by **Ghost** and **Substack**.

### 8.1 `/blog` (listing)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Hero: featured post]                                           │
│                                                                  │
│  [Categories: All / Marketing / Courses / Behind the scenes]     │
│  [Tags: #email #funnels #ai]                                     │
│  [Search: ____________]                                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ cover    │  │ cover    │  │ cover    │                       │
│  │ Title    │  │ Title    │  │ Title    │                       │
│  │ Author   │  │ Author   │  │ Author   │                       │
│  │ Date     │  │ Date     │  │ Date     │                       │
│  │ 3 min    │  │ 5 min    │  │ 8 min    │                       │
│  └──────────┘  └──────────┘  └──────────┘                       │
│                                                                  │
│  [Newsletter signup band]                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 `/blog/[slug]` (article)

| Section | Content |
|---|---|
| Hero | Cover image, title, author, date, reading time, category |
| Body | Markdown / rich text (with images, embeds, code) |
| Author box | Avatar, name, bio, social |
| Tags | Tag chips |
| Share buttons | Twitter, LinkedIn, Facebook, copy link |
| Comments | Threaded comments (community-style) |
| Newsletter | Inline signup band |
| Related posts | 3 related by tag/category |
| Prev / next | Article navigation |

### 8.3 Blog Features

| Feature | Source |
|---|---|
| Categories | `BlogPost.category` |
| Tags | `BlogPost.tags[]` |
| Authors | `BlogPost.authorId` → `User` or `WorkspaceMember` |
| Archives | Date-based archive `/blog/archive/2025/03` |
| Search | Full-text search over title + body |
| Newsletter | Email capture → `Customer` or `EmailCampaign` subscriber |
| Comments | `CommunityComment`-style or dedicated `BlogComment` |
| Drafts / scheduling | `BlogPost.status`, `BlogPost.publishedAt` |
| Revisions | `PostHistory` |

---

## 9. Membership Website

Inspired by **Kajabi** and **Patreon**.

### 9.1 `/membership`

| Section | Content |
|---|---|
| Hero | "Join [Creator]'s membership" |
| Pricing tiers | From `MembershipPlan[]` (name, price, features, CTA) |
| What's included | Gated content preview (courses, products, spaces) |
| Member testimonials | Social proof |
| FAQ | Membership FAQ |
| CTA | Final join band |

### 9.2 Member Portal (authenticated)

`/account` for active members:

- Active subscription status
- Access gated content (courses, products, spaces)
- Billing history
- Manage subscription (upgrade, cancel, update card)
- Community profile link

---

## 10. Custom Pages

Custom pages (home, about, contact, pricing, legal, thank-you) are built from **reusable sections**. See `WEBSITE_ARCHITECTURE.md` §6 for the section library.

### 10.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Global Header]                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Section: Hero                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Section: Features                                               │
├─────────────────────────────────────────────────────────────────┤
│  Section: Testimonials                                           │
├─────────────────────────────────────────────────────────────────┤
│  Section: Pricing                                                │
├─────────────────────────────────────────────────────────────────┤
│  Section: FAQ                                                    │
├─────────────────────────────────────────────────────────────────┤
│  Section: CTA                                                    │
├─────────────────────────────────────────────────────────────────┤
│  [Global Footer]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Sections render top-to-bottom in `order`. No grid layout, no columns, no absolute positioning.

---

## 11. Component Structure

### 11.1 App Router Tree

```
src/app/
├── (public)/                      ← Public route group
│   ├── layout.tsx                 ← Header + Footer + theme
│   ├── page.tsx                   ← Home (Page slug="home")
│   ├── courses/
│   │   ├── page.tsx               ← /courses
│   │   └── [slug]/
│   │       ├── page.tsx           ← /courses/[slug] (landing)
│   │       └── learn/
│   │           └── [lessonId]/
│   │               └── page.tsx   ← Course player
│   ├── store/
│   │   ├── page.tsx               ← /store
│   │   └── [slug]/page.tsx        ← /store/[slug]
│   ├── community/
│   │   ├── page.tsx               ← /community
│   │   ├── [space]/page.tsx       ← /community/[space]
│   │   ├── [space]/[post]/page.tsx
│   │   ├── events/page.tsx
│   │   ├── events/[id]/page.tsx
│   │   ├── members/page.tsx
│   │   └── members/[id]/page.tsx
│   ├── membership/
│   │   └── page.tsx               ← /membership
│   ├── blog/
│   │   ├── page.tsx               ← /blog
│   │   ├── [slug]/page.tsx        ← /blog/[slug]
│   │   ├── category/[cat]/page.tsx
│   │   ├── tag/[tag]/page.tsx
│   │   └── archive/[year]/[month]/page.tsx
│   ├── [slug]/page.tsx            ← Custom page (catch-all fallback)
│   ├── cart/page.tsx
│   ├── checkout/page.tsx
│   ├── orders/[id]/page.tsx
│   ├── library/page.tsx           ← Customer's purchased products
│   ├── account/page.tsx           ← Member portal
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── sitemap.ts                 ← /sitemap.xml
│   └── robots.ts                  ← /robots.txt
├── (admin)/                       ← Admin route group (existing)
│   └── ...
```

### 11.2 Component Library

```
src/components/public/
├── layout/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Breadcrumbs.tsx
│   └── CartButton.tsx
├── sections/
│   ├── HeroSection.tsx
│   ├── FeaturesSection.tsx
│   ├── TestimonialsSection.tsx
│   ├── PricingSection.tsx
│   ├── FAQSection.tsx
│   ├── CTASection.tsx
│   ├── StatisticsSection.tsx
│   ├── LogoCloudSection.tsx
│   ├── GallerySection.tsx
│   └── SectionRenderer.tsx        ← dispatches by `type`
├── courses/
│   ├── CourseCard.tsx
│   ├── CourseGrid.tsx
│   ├── CourseHero.tsx
│   ├── CurriculumAccordion.tsx
│   ├── InstructorCard.tsx
│   ├── CourseReviews.tsx
│   ├── PricingCard.tsx
│   └── RelatedCourses.tsx
├── products/
│   ├── ProductCard.tsx
│   ├── ProductGrid.tsx
│   ├── ProductGallery.tsx
│   ├── ProductPricing.tsx
│   ├── VersionHistory.tsx
│   ├── ProductReviews.tsx
│   └── RelatedProducts.tsx
├── community/
│   ├── CommunitySidebar.tsx
│   ├── Feed.tsx
│   ├── PostCard.tsx
│   ├── PostDetail.tsx
│   ├── CommentThread.tsx
│   ├── EventCard.tsx
│   ├── Leaderboard.tsx
│   ├── MemberDirectory.tsx
│   └── MemberProfile.tsx
├── blog/
│   ├── BlogList.tsx
│   ├── BlogCard.tsx
│   ├── ArticleBody.tsx
│   ├── AuthorBox.tsx
│   ├── TagCloud.tsx
│   ├── NewsletterSignup.tsx
│   └── RelatedPosts.tsx
├── membership/
│   ├── PlanCard.tsx
│   ├── PlanGrid.tsx
│   └── MemberPortal.tsx
├── commerce/
│   ├── Cart.tsx
│   ├── CheckoutForm.tsx
│   ├── OrderSummary.tsx
│   └── LibraryItem.tsx
└── seo/
    ├── JsonLd.tsx
    └── MetaHead.tsx
```

### 11.3 Section Renderer

The `SectionRenderer` component is the **single entry point** for rendering a `PageSection`:

```
type Section = { id, type, content: JSON, order }

SectionRenderer
  ├── switch (type)
  │     case "hero"         → <HeroSection content={content} />
  │     case "features"     → <FeaturesSection content={content} />
  │     case "testimonials" → <TestimonialsSection content={content} />
  │     case "pricing"      → <PricingSection content={content} />
  │     case "faq"          → <FAQSection content={content} />
  │     case "cta"          → <CTASection content={content} />
  │     case "statistics"   → <StatisticsSection content={content} />
  │     case "logoCloud"    → <LogoCloudSection content={content} />
  │     case "gallery"      → <GallerySection content={content} />
  │     case "footer"       → <FooterSection content={content} />
  │     default             → <UnknownSection />
  └──
```

Each section component **reads `content` JSON** and renders with the active theme. No layout JSON, no x/y, no CSS.

---

## 12. Theme System

### 12.1 Theme Tokens

Stored in `SiteSetting.theme`:

| Token | Example |
|---|---|
| `colors.primary` | `#4F46E5` |
| `colors.secondary` | `#10B981` |
| `colors.background` | `#FFFFFF` |
| `colors.text` | `#0F172A` |
| `fonts.heading` | `Inter` |
| `fonts.body` | `Inter` |
| `radius` | `0.5rem` |
| `containerWidth` | `1200px` |
| `spacing` | `1rem` base unit |

### 12.2 Theme Application

- Tokens injected as CSS variables at the `(public)/layout.tsx` level.
- Tailwind config maps tokens → utility classes.
- All section components use tokens — no hardcoded colors.

### 12.3 Preset Themes

Ship with **4 preset themes** (Light, Dark, Bold, Minimal). Creators pick a preset, then customize tokens. No code-level theming.

---

## 13. Responsive Design

### 13.1 Breakpoints

| Breakpoint | Width | Target |
|---|---|---|
| `xs` | < 480px | Small phones |
| `sm` | 480–639px | Phones |
| `md` | 640–1023px | Tablets |
| `lg` | 1024–1279px | Laptops |
| `xl` | ≥ 1280px | Desktops |

### 13.2 Mobile-First Rules

- All sections stack vertically on mobile.
- Header collapses to hamburger menu < `md`.
- Footer stacks vertically < `md`.
- Course player: curriculum becomes a drawer < `md`.
- Community sidebar becomes a tab bar < `md`.
- Blog grid becomes single column < `md`.
- Product gallery becomes swipeable carousel < `md`.
- Pricing cards stack < `md`.

### 13.3 Touch

- All interactive elements ≥ 44px tap target.
- No hover-only interactions.
- Swipeable carousels use native touch events.

---

## 14. Performance

| Metric | Target |
|---|---|
| LCP (mobile) | < 1.5s |
| FID / INP | < 200ms |
| CLS | < 0.1 |
| JS bundle (public) | < 100KB initial |
| Images | WebP/AVIF, responsive `srcset`, lazy below fold |
| Fonts | `next/font` with `display: swap` |
| Cache | SSG full CDN, ISR for dynamic |

### 14.1 Techniques

- Server Components for all public pages (zero client JS by default).
- Client islands only for: cart, search, video player, comments, RSVP.
- Image optimization via `next/image`.
- Route segment config for ISR `revalidate` per route.
- Prefetch on hover for internal links.

---

## 15. Accessibility

| Requirement | Standard |
|---|---|
| Color contrast | WCAG AA (4.5:1 text, 3:1 large) |
| Keyboard navigation | All interactive elements reachable |
| Focus states | Visible focus ring on all elements |
| ARIA | Semantic HTML + ARIA where needed |
| Alt text | All images require alt (creator can mark decorative) |
| Forms | Labels, error messages, fieldset/legend |
| Video | Captions + transcript |
| Skip links | "Skip to content" on every page |

---

## 16. Personalization

Public pages are **mostly static**. Personalization is layered on:

| Surface | Personalization |
|---|---|
| Header | "Hi, [Name]" + avatar if logged in |
| Course page | "Continue learning" if enrolled + progress |
| Product page | "You own this" if purchased |
| Community | Authenticated feed, joined spaces |
| Pricing | Show member discount if logged in |

Personalized content is rendered client-side via RSC + suspense islands, so the static shell stays cacheable.

---

## 17. Internationalization (Future)

Not in scope for v1, but the architecture supports it:

- All content strings come from DB (translatable).
- Route prefix `/[locale]/...` reserved.
- Theme tokens are locale-agnostic.

---

## 18. Analytics Instrumentation

The public frontend emits events to the platform's analytics:

| Event | Trigger |
|---|---|
| `page_view` | Every route |
| `course_view` | `/courses/[slug]` |
| `enroll_click` | Enroll button |
| `product_view` | `/store/[slug]` |
| `buy_click` | Buy button |
| `community_join` | Join community |
| `blog_view` | `/blog/[slug]` |
| `newsletter_signup` | Newsletter form |
| `search` | Blog/community search |

Events flow into the `Analytics` pillar for the creator's dashboard.

---

## 19. Error Handling

| Error | Handling |
|---|---|
| 404 (page not found) | Branded 404 page with search + popular links |
| 410 (content unpublished) | Branded "This content is no longer available" |
| 403 (gated content) | Redirect to login / membership upgrade |
| 500 | Branded error page + report to admin |
| Draft preview | Signed preview URLs for creator only |

---

## 20. Preview & Drafts

Creators can preview unpublished content via signed URLs:

```
/preview?token=<signed-token>&route=/courses/new-course
```

- Token signed with workspace secret.
- Expires in 24h.
- Shows draft content + "Preview mode" banner.
- Not indexed by search engines.

---

## 21. Open Questions

1. Should the public frontend live in the same Next.js app as admin, or a separate app? **Recommendation**: same app, route group `(public)`.
2. Should we use Next.js Middleware for tenant resolution by domain? **Recommendation**: yes.
3. Should comments on blog posts reuse `CommunityComment` or a dedicated `BlogComment` model? **Recommendation**: reuse `CommunityComment` with `postType = "blog"`.

---

## 22. Related Documents

- `WEBSITE_ARCHITECTURE.md` — overall architecture
- `WEBSITE_DATABASE_FLOW.md` — data flow from DB to public pages
- `WEBSITE_NAVIGATION.md` — admin navigation restructure
- `WEBSITE_SEO_PLAN.md` — SEO strategy
- `WEBSITE_MIGRATION_PLAN.md` — migration plan

---

**End of document.**
