# CreatorOS — Website SEO Plan

> **Document type**: SEO Strategy & Implementation Plan
> **Scope**: SEO for auto-generated public pages
> **Audience**: Engineering, Product, Marketing
> **Status**: Proposed (v1.0)

---

## 1. Goals

Every public page on a CreatorOS-powered website must be **discoverable, indexable, and rich** in search results:

1. **Auto-generated** SEO metadata from structured DB content.
2. **Valid** structured data (JSON-LD) per Schema.org.
3. **Fast** pages (LCP < 1.5s on mobile) for ranking boost.
4. **Mobile-friendly** responsive design.
5. **Comprehensive** sitemap covering all published content.
6. **Proper** robots.txt and canonical URLs.
7. **No duplicate content** issues (single canonical URL per resource).

SEO is **not an afterthought** — it is a first-class output of the website generator, alongside HTML.

---

## 2. SEO Outputs per Page Type

| Page type | SEO title | Meta description | Open Graph | JSON-LD schema | Canonical |
|---|---|---|---|---|---|
| Home (`/`) | AI-generated, editable | AI-generated, editable | Yes | `Organization` + `WebSite` | `https://domain/` |
| Course listing (`/courses`) | "Courses — {Brand}" | AI-generated | Yes | `ItemList` | `https://domain/courses` |
| Course detail (`/courses/[slug]`) | `Course.seoTitle` | `Course.seoDescription` | Yes | `Course` + `BreadcrumbList` | `https://domain/courses/[slug]` |
| Product listing (`/store`) | "Products — {Brand}" | AI-generated | Yes | `ItemList` | `https://domain/store` |
| Product detail (`/store/[slug]`) | `Product.seoTitle` | `Product.seoDescription` | Yes | `Product` + `BreadcrumbList` | `https://domain/store/[slug]` |
| Membership (`/membership`) | "Membership — {Brand}" | AI-generated | Yes | `OfferCatalog` | `https://domain/membership` |
| Community (`/community`) | "Community — {Brand}" | AI-generated | Yes | `Organization` | `https://domain/community` |
| Blog listing (`/blog`) | "Blog — {Brand}" | AI-generated | Yes | `Blog` | `https://domain/blog` |
| Blog article (`/blog/[slug]`) | `BlogPost.seoTitle` | `BlogPost.seoDescription` | Yes | `Article` + `BreadcrumbList` | `https://domain/blog/[slug]` |
| Custom page (`/[slug]`) | `Page.seoTitle` | `Page.seoDescription` | Yes | `WebPage` + `BreadcrumbList` | `https://domain/[slug]` |

---

## 3. Course SEO (auto-generated)

### 3.1 SEO title

- **Source**: `Course.seoTitle` (AI-generated, editable).
- **Fallback**: `Course.title` + " — {Brand}".
- **Length**: 50–60 characters.
- **AI rule**: Include course topic + primary keyword + benefit.

Example:
```
Course.title: "AI for Creators"
Course.seoTitle (AI): "AI for Creators: Build & Sell AI Products (2025) — CreatorOS"
```

### 3.2 Meta description

- **Source**: `Course.seoDescription` (AI-generated, editable).
- **Fallback**: First 155 chars of `Course.description`.
- **Length**: 140–160 characters.
- **AI rule**: Summarize outcome + audience + CTA.

Example:
```
Course.seoDescription: "Learn to build, market, and sell AI products as a creator. 12 video lessons, templates, and a private community. Start today."
```

### 3.3 Open Graph

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="{Course.seoTitle}" />
<meta property="og:description" content="{Course.seoDescription}" />
<meta property="og:image" content="{Course.ogImage || Course.coverImage}" />
<meta property="og:url" content="https://domain/courses/{slug}" />
<meta property="og:site_name" content="{Brand}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{Course.seoTitle}" />
<meta name="twitter:description" content="{Course.seoDescription}" />
<meta name="twitter:image" content="{Course.ogImage}" />
```

### 3.4 JSON-LD: Course schema

```json
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "{Course.title}",
  "description": "{Course.seoDescription}",
  "provider": {
    "@type": "Organization",
    "name": "{Brand}",
    "sameAs": "https://domain"
  },
  "instructor": {
    "@type": "Person",
    "name": "{Instructor.name}",
    "image": "{Instructor.avatar}"
  },
  "hasCourseInstance": {
    "@type": "CourseInstance",
    "courseMode": "online",
    "courseWorkload": "PT{totalMinutes}M"
  },
  "offers": {
    "@type": "Offer",
    "price": "{Course.price}",
    "priceCurrency": "{Course.currency}",
    "availability": "https://schema.org/InStock",
    "url": "https://domain/courses/{slug}"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "{avgRating}",
    "reviewCount": "{reviewCount}"
  }
}
```

Emitted only when the course is published and has ≥1 review.

### 3.5 BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://domain/" },
    { "@type": "ListItem", "position": 2, "name": "Courses", "item": "https://domain/courses" },
    { "@type": "ListItem", "position": 3, "name": "{Course.title}", "item": "https://domain/courses/{slug}" }
  ]
}
```

---

## 4. Product SEO (auto-generated)

### 4.1 SEO title + meta description

- **Source**: `Product.seoTitle`, `Product.seoDescription` (AI-generated, editable).
- **Fallback**: `Product.title` + " — {Brand}", first 155 chars of `Product.description`.
- **Length**: 50–60 (title), 140–160 (desc).

### 4.2 Open Graph

Same shape as Course OG, with `og:type` = `product` (or `website` if not supported).

### 4.3 JSON-LD: Product schema

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{Product.title}",
  "description": "{Product.seoDescription}",
  "image": ["{Product.images[]}"],
  "brand": { "@type": "Brand", "name": "{Brand}" },
  "offers": {
    "@type": "Offer",
    "url": "https://domain/store/{slug}",
    "price": "{Product.price}",
    "priceCurrency": "{Product.currency}",
    "availability": "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "{Brand}" }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "{avgRating}",
    "reviewCount": "{reviewCount}"
  }
}
```

### 4.4 BreadcrumbList

Home → Products → `{Product.title}`.

---

## 5. BlogPost SEO (auto-generated)

### 5.1 SEO title + meta description

- **Source**: `BlogPost.seoTitle`, `BlogPost.seoDescription` (AI-generated, editable).
- **Fallback**: `BlogPost.title`, first 155 chars of `BlogPost.excerpt` or body.
- **Length**: 50–60 (title), 140–160 (desc).

### 5.2 Open Graph

```html
<meta property="og:type" content="article" />
<meta property="og:title" content="{BlogPost.seoTitle}" />
<meta property="og:description" content="{BlogPost.seoDescription}" />
<meta property="og:image" content="{BlogPost.ogImage || BlogPost.coverImage}" />
<meta property="og:url" content="https://domain/blog/{slug}" />
<meta property="article:published_time" content="{BlogPost.publishedAt ISO}" />
<meta property="article:author" content="{Author.name}" />
<meta property="article:section" content="{BlogPost.category}" />
<meta property="article:tag" content="{BlogPost.tags[0]}" />
```

### 5.3 JSON-LD: Article schema

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{BlogPost.title}",
  "description": "{BlogPost.seoDescription}",
  "image": "{BlogPost.coverImage}",
  "datePublished": "{BlogPost.publishedAt ISO}",
  "dateModified": "{BlogPost.updatedAt ISO}",
  "author": {
    "@type": "Person",
    "name": "{Author.name}",
    "url": "https://domain/blog/author/{authorSlug}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "{Brand}",
    "logo": { "@type": "ImageObject", "url": "{Brand.logoUrl}" }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://domain/blog/{slug}"
  },
  "keywords": "{BlogPost.tags.join(', ')}",
  "articleSection": "{BlogPost.category}"
}
```

### 5.4 BreadcrumbList

Home → Blog → `{BlogPost.title}`.

---

## 6. Organization + WebSite schema (site-wide)

Emitted on every page (in `<head>`):

### 6.1 Organization

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "{Brand}",
  "url": "https://domain",
  "logo": "https://domain/{logoUrl}",
  "sameAs": [
    "https://twitter.com/{handle}",
    "https://youtube.com/{channel}",
    "https://instagram.com/{handle}"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "{supportEmail}"
  }
}
```

### 6.2 WebSite

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://domain",
  "name": "{Brand}",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://domain/blog?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

---

## 7. Sitemap.xml Generation

The sitemap is **generated from published content** and includes every indexable public URL.

### 7.1 Sitemap structure

Single sitemap index + segmented sitemaps:

```
/sitemap.xml              ← sitemap index
/sitemap-courses.xml      ← all published courses
/sitemap-products.xml     ← all published products
/sitemap-blog.xml         ← all published blog posts
/sitemap-pages.xml        ← all published custom pages
/sitemap-community.xml    ← public community spaces + posts
/sitemap-listing.xml      ← listing pages (/courses, /store, /blog, etc.)
```

### 7.2 Sitemap entry shape

```xml
<url>
  <loc>https://domain/courses/ai-for-creators</loc>
  <lastmod>2025-03-01T14:30:00Z</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
```

### 7.3 Priority rules

| Route | Priority |
|---|---|
| `/` (home) | 1.0 |
| `/courses`, `/store`, `/blog`, `/community`, `/membership` | 0.9 |
| `/courses/[slug]`, `/store/[slug]`, `/blog/[slug]` | 0.8 |
| `/[slug]` (custom pages) | 0.6 |
| `/blog/category/[cat]`, `/blog/tag/[tag]` | 0.4 |

### 7.4 Exclusion rules

| Content | Excluded from sitemap |
|---|---|
| `status != "published"` | Yes |
| `publishedAt > now()` (scheduled) | Yes |
| Member-only community spaces | Yes |
| Draft pages | Yes |
| `/cart`, `/checkout`, `/orders`, `/account`, `/login`, `/signup` | Yes (noindex) |
| Paginated `/blog?page=2` | Yes (use `rel="next"`, `rel="prev"` instead) |

### 7.5 Implementation

Next.js `sitemap.ts`:

```
src/app/sitemap.ts
  → reads all published content
  → returns sitemap index
```

Each segmented sitemap is generated via a route handler with ISR (1 hour revalidate).

### 7.6 Sitemap pinging

On publish of any content, ping:

- `https://www.google.com/ping?sitemap=https://domain/sitemap.xml`
- `https://www.bing.com/ping?sitemap=https://domain/sitemap.xml`

(Both are best-effort; Google prefers Search Console submission.)

---

## 8. robots.txt

Generated dynamically from `SiteSetting`:

```
User-agent: *
Allow: /
Disallow: /cart
Disallow: /checkout
Disallow: /orders
Disallow: /account
Disallow: /login
Disallow: /signup
Disallow: /api/
Disallow: /admin/
Disallow: /app/
Disallow: /preview
Disallow: /*?token=
Disallow: /*?utm_

Sitemap: https://domain/sitemap.xml
Host: https://domain
```

### 8.1 Rules

- All **content** routes are crawlable.
- All **app/admin/auth** routes are disallowed.
- **Preview URLs** (signed tokens) are disallowed.
- **UTM-tagged URLs** are disallowed to prevent duplicate-content noise.
- Sitemap location is declared.

### 8.2 Per-page noindex

| Page | `noindex` reason |
|---|---|
| Paginated listing `?page=2` | Duplicate content |
| Tag pages with < 3 posts | Thin content |
| Member-only community pages | Behind auth |
| Draft previews | Not for public |
| Thank-you pages | Conversion-only |
| Search results | No value to index |

---

## 9. Canonical URLs

Every public page emits:

```html
<link rel="canonical" href="https://domain{path}" />
```

### 9.1 Rules

- Canonical is the **absolute URL** with the primary domain.
- Trailing slash policy: **no trailing slash** (or always trailing slash — pick one, be consistent).
- Query parameters stripped from canonical (except pagination which uses `rel="next"`/`prev"`).
- UTM parameters stripped.
- HTTP → HTTPS canonical.
- Non-primary domain → primary domain canonical (for custom domain setups).

### 9.2 hreflang (multi-language, future)

When i18n is enabled:

```html
<link rel="alternate" hreflang="en" href="https://domain/en{path}" />
<link rel="alternate" hreflang="es" href="https://domain/es{path}" />
<link rel="alternate" hreflang="x-default" href="https://domain{path}" />
```

---

## 10. Mobile-Friendly Responsive Design

### 10.1 Requirements

| Requirement | Implementation |
|---|---|
| Responsive viewport | `<meta name="viewport" content="width=device-width, initial-scale=1">` |
| No horizontal scroll | Mobile-first CSS, no fixed widths |
| Tap targets ≥ 44px | Tailwind base + audit |
| Font size ≥ 16px body | Theme tokens |
| Mobile-friendly test pass | Google Mobile-Friendly Test |

### 10.2 Google Core Web Vitals targets

| Metric | Target |
|---|---|
| LCP (Largest Contentful Paint) | < 1.5s on mobile |
| INP (Interaction to Next Paint) | < 200ms |
| CLS (Cumulative Layout Shift) | < 0.1 |
| FCP (First Contentful Paint) | < 1.0s |
| TTFB (Time to First Byte) | < 600ms |

---

## 11. Page Speed Optimization

### 11.1 Rendering strategy

| Route | Strategy | Reason |
|---|---|---|
| Home, custom pages | SSG + ISR (600s) | Static content, fast |
| Course listing/detail | SSG + ISR (300s) | Mostly static |
| Product listing/detail | SSG + ISR (300s) | Mostly static |
| Blog listing/detail | SSG + ISR (600s) | Static content |
| Membership | SSG + ISR (300s) | Static content |
| Community feed | RSC + ISR (30s) | Dynamic but cacheable |
| Cart, checkout, account | RSC dynamic | Personalized |

### 11.2 Techniques

- **Server Components** for all public pages (zero client JS by default).
- **Client islands** only for: cart, search, video player, comments, RSVP, forms.
- **Image optimization** via `next/image` (WebP/AVIF, responsive `srcset`, lazy load).
- **Font optimization** via `next/font` with `display: swap`.
- **Code splitting** per route.
- **Prefetch** on hover for internal links.
- **CDN** at the edge (Vercel / Caddy with cache headers).
- **HTTP/2** push for critical CSS (where supported).
- **Brotli** compression.

### 11.3 Image strategy

| Image type | Optimization |
|---|---|
| Hero / cover | `next/image` with `priority`, responsive `srcset` |
| Below-fold images | Lazy load, blurred placeholder |
| OG image | Pre-generated 1200×630 PNG/JPG |
| Logo | SVG inline |
| Icons | SVG inline (no icon font) |
| User uploads | Auto-resized to 16:9 / 1:1 / 4:3 variants on upload |

### 11.4 OG image generation

- Auto-generate OG image per Course, Product, BlogPost from title + brand logo + cover.
- Stored at `/api/og?route=/courses/[slug]` with caching.
- Pre-generated at publish time and cached in Media Library.

---

## 12. Schema.org Structured Data Catalog

Full list of structured data types emitted:

| Schema type | Where emitted | Purpose |
|---|---|---|
| `Organization` | Every page (site-wide) | Brand entity |
| `WebSite` | Every page (site-wide) | Site entity + search action |
| `WebPage` | Custom pages | Generic page entity |
| `Course` | `/courses/[slug]` | Course rich result |
| `Product` | `/store/[slug]` | Product rich result |
| `Article` | `/blog/[slug]` | Article rich result |
| `BreadcrumbList` | All detail pages | Breadcrumb rich result |
| `ItemList` | Listing pages | List rich result |
| `Offer` | Inside Course/Product | Pricing rich result |
| `AggregateRating` | Course/Product with reviews | Rating rich result |
| `Person` | Instructor / author | Person entity |
| `FAQPage` | Pages with FAQ section | FAQ rich result |
| `OfferCatalog` | `/membership` | Membership plans |

### 12.1 FAQPage schema

When a `PageSection` of type `faq` is present on a page, also emit:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{question}",
      "acceptedAnswer": { "@type": "Answer", "text": "{answer}" }
    }
  ]
}
```

### 12.2 Validation

- All JSON-LD validated against Schema.org types via `@google/structured-data-testing-tool` (or equivalent) in CI.
- Rich Results Test: 0 errors, 0 warnings on all primary pages.

---

## 13. Per-Route SEO Metadata Storage

Each content model gains SEO fields:

| Model | New fields |
|---|---|
| `Course` | `seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl` (optional override) |
| `Product` | `seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl` |
| `BlogPost` | `seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl` |
| `Page` | `seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl` |
| `SiteSetting` | `seoDefaultTitle`, `seoDefaultDescription`, `seoDefaultOgImage`, `robotsAllow`, `primaryDomain` |

### 13.1 AI auto-fill

On create/publish of any content:

1. AI generates `seoTitle` (50–60 chars) from title + brand.
2. AI generates `seoDescription` (140–160 chars) from description.
3. AI generates `ogImage` from cover + brand (if no custom OG).
4. Creator can edit any field.
5. If creator leaves blank, fallback is used at render time.

---

## 14. SEO Workflow

```
Creator creates Course
        │
        ▼
AI auto-generates SEO fields
        │
        ▼
Creator reviews / edits SEO fields
        │
        ▼
Creator clicks Publish
        │
        ├──▶ Page rendered with SEO meta + JSON-LD
        ├──▶ Sitemap regenerated (ISR)
        ├──▶ Google pinged
        └──▶ Search Console notified (if integrated)
```

---

## 15. Internal Linking

### 15.1 Automatic internal links

| From | To | When |
|---|---|---|
| Course page | Related courses | Always (3 related) |
| Product page | Related products | Always (3 related) |
| Blog post | Related posts | Always (3 related by tag) |
| Blog post | Author profile | Always |
| Course page | Instructor profile | Always |
| All pages | Home | Header logo |
| All pages | Listing pages | Header nav |

### 15.2 Breadcrumbs

Visual breadcrumbs on detail pages:

```
Home › Courses › AI for Creators
Home › Products › Notion Templates Pack
Home › Blog › How to launch a course
```

Also emitted as `BreadcrumbList` JSON-LD.

---

## 16. Pagination SEO

For listing pages (`/blog`, `/courses` if paginated):

```html
<link rel="prev" href="https://domain/blog?page=1" />
<link rel="next" href="https://domain/blog?page=3" />
```

- Page 1 canonical: `https://domain/blog` (not `?page=1`).
- Page 2+ canonical: `https://domain/blog?page=2`.
- Page 2+ has `noindex,follow` to avoid thin-content indexation but preserve link equity flow.

---

## 17. Image SEO

| Rule | Implementation |
|---|---|
| Alt text | Required on all `<img>`, sourced from `alt` field on upload |
| File names | Slug-based: `ai-for-creators-cover.jpg` |
| Image sitemap | `/sitemap-images.xml` with `image:title`, `image:caption` |
| Lazy load | `loading="lazy"` below fold |
| Responsive | `srcset` with 480/768/1200/1920 variants |
| Format | WebP/AVIF via `next/image` |

---

## 18. SEO Audit & Monitoring

### 18.1 CI checks

| Check | Tool |
|---|---|
| Valid JSON-LD | `structured-data-testing-tool` |
| Meta title length | Lint |
| Meta description length | Lint |
| Canonical present | Lint |
| OG tags present | Lint |
| Sitemap reachable | Smoke test |
| robots.txt reachable | Smoke test |

### 18.2 Runtime monitoring

| Metric | Source |
|---|---|
| Google Search Console | Impressions, clicks, CTR, position |
| Bing Webmaster | Impressions, clicks |
| Core Web Vitals | `web-vitals` library → analytics |
| Index coverage | Search Console |
| Crawl errors | Search Console |

### 18.3 Creator-facing SEO dashboard

In **Website → SEO**:

- Sitemap status.
- Pages indexed (from Search Console API).
- Top queries (from Search Console API).
- Pages with missing SEO fields.
- Bulk "Generate SEO with AI" action.

---

## 19. International SEO (Future)

Not in v1, but designed for:

- `hreflang` tags per locale.
- Locale-prefixed URLs: `/en/...`, `/es/...`.
- Per-locale sitemap.
- Per-locale `SiteSetting` overrides.

---

## 20. Common SEO Pitfalls Avoided

| Pitfall | How we avoid |
|---|---|
| Duplicate content | Single canonical URL per resource |
| Thin content | Auto-generated descriptions + AI content assist |
| Slow pages | SSG/ISR + RSC + image optimization |
| Missing alt text | Required field on upload |
| Missing structured data | Auto-generated JSON-LD per page |
| Orphan pages | Auto internal linking + sitemap |
| Broken links | Sitemap + link audit in CI |
| Indexing auth pages | robots.txt + noindex |
| Pagination duplicate | `rel="next"`/`prev"` + canonical |
| UTM duplication | robots.txt disallow + canonical strip |

---

## 21. Migration from Current SEO

The current `SiteSetting` model has basic SEO fields. Migration:

1. Add new fields to `Course`, `Product`, `BlogPost`, `Page` (migration script).
2. Backfill `seoTitle` / `seoDescription` for existing content via AI bulk job.
3. Add JSON-LD components to public page layouts.
4. Generate sitemap on first deploy.
5. Submit sitemap to Google Search Console.

See `WEBSITE_MIGRATION_PLAN.md` for the full migration steps.

---

## 22. Success Criteria

| Criterion | How to verify |
|---|---|
| Every public page has `<title>` | Crawl + lint |
| Every public page has meta description | Crawl + lint |
| Every public page has canonical | Crawl + lint |
| Every public page has OG tags | Crawl + lint |
| Every detail page has JSON-LD | Structured Data Test |
| JSON-LD validates with 0 errors | CI check |
| Sitemap covers all published content | Coverage report |
| robots.txt blocks app/admin | Smoke test |
| Lighthouse SEO score ≥ 95 | Lighthouse CI |
| Mobile-Friendly Test passes | Per-page test |
| LCP < 1.5s on mobile | Web Vitals |

---

## 23. Open Questions

1. Should we generate OG images dynamically at request time or pre-generate at publish? **Recommendation**: pre-generate at publish (faster, cacheable).
2. Should we submit sitemap to Search Console automatically? **Recommendation**: yes, if creator has connected Search Console API.
3. Should we support `noindex` per-page toggle? **Recommendation**: yes, on Course/Product/BlogPost/Page SEO settings.
4. Should we support programmatic SEO (auto-generate 100s of pages from data)? **Recommendation**: future v2, not v1.

---

## 24. Related Documents

- `WEBSITE_ARCHITECTURE.md` — overall architecture
- `PUBLIC_FRONTEND_PLAN.md` — public frontend design
- `WEBSITE_DATABASE_FLOW.md` — data flow
- `WEBSITE_NAVIGATION.md` — admin navigation
- `WEBSITE_MIGRATION_PLAN.md` — migration plan

---

**End of document.**
