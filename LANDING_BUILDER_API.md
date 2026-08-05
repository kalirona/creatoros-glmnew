# LANDING_BUILDER_API.md

**Date:** 2026-08-05
**Status:** API specification (no code changes)

---

## 1. Existing APIs (keep as-is)

### Pages API — `/api/data/pages`

| Method | Purpose | Status |
|--------|---------|--------|
| GET | List pages (optional `?type=LANDING`) | ✅ Exists |
| POST | Create page `{ title, slug, type, category }` | ✅ Exists |
| PUT | Update page `{ id, status, title, slug, seoTitle, seoDescription, category }` | ✅ Exists |
| DELETE | Delete page `?id={id}` | ✅ Exists |

**Enhancement needed:** Add `theme` and `analytics` to PUT body.

### Page Sections API — `/api/data/page-sections`

| Method | Purpose | Status |
|--------|---------|--------|
| GET | Get page + sections `?pageId={id}` | ✅ Exists |
| POST | Add section `{ pageId, type, content, position }` | ✅ Exists |
| PUT | Update/duplicate/move `{ id, action?, content?, isHidden? }` | ✅ Exists |
| DELETE | Delete section `?id={id}` | ✅ Exists |

**Enhancement needed:** Add batch reorder endpoint.

### AI Landing Page — `/api/ai/landing-page`

| Method | Purpose | Status |
|--------|---------|--------|
| POST | Generate full landing page `{ selling, category }` | ✅ Exists |

**Enhancement needed:** Add `style`, `primaryColor` to body.

### AI Section Rewrite — `/api/ai/section-rewrite`

| Method | Purpose | Status |
|--------|---------|--------|
| POST | AI action on section `{ action, content, sectionType }` | ✅ Exists |

**Enhancement needed:** Add new actions (PROFESSIONAL, EMOTIONAL, LUXURY, STARTUP, etc.) and `context` field.

---

## 2. New APIs

### Batch Reorder Sections — `POST /api/data/page-sections/reorder`

**Purpose:** Reorder multiple sections in one request (for drag-reorder).

**Request:**
```json
{
  "pageId": "cms...",
  "sectionIds": ["id1", "id2", "id3", "id4"]
}
```

**Response:**
```json
{ "success": true }
```

**Implementation:**
```typescript
export async function POST(req: NextRequest) {
  const { pageId, sectionIds } = await req.json()
  // Update each section's position in a transaction
  await db.$transaction(
    sectionIds.map((id: string, index: number) =>
      db.pageSection.update({ where: { id }, data: { position: index } })
    )
  )
  return NextResponse.json({ success: true })
}
```

---

### Reusable Blocks API — `/api/data/reusable-blocks`

| Method | Purpose |
|--------|---------|
| GET | List reusable blocks for workspace `?type={optional}` |
| POST | Save a section as reusable `{ name, type, content }` |
| DELETE | Delete reusable block `?id={id}` |

**GET Response:**
```json
{
  "blocks": [
    {
      "id": "cms...",
      "name": "My Hero",
      "type": "HERO",
      "content": { "headline": "...", "ctaText": "..." },
      "thumbnail": null,
      "category": "Custom",
      "createdAt": "2025-08-05T..."
    }
  ]
}
```

**POST Request:**
```json
{
  "name": "My Hero",
  "type": "HERO",
  "content": { "headline": "Build Your Empire", "ctaText": "Start Free" }
}
```

**POST Response:**
```json
{ "success": true, "block": { "id": "cms..." } }
```

---

### Dynamic Block Data — `/api/data/dynamic-blocks`

**Purpose:** Fetch data for dynamic blocks (Latest Courses, Featured Products, etc.).

| Method | Purpose |
|--------|---------|
| GET | Fetch dynamic data `?type=LATEST_COURSES&limit=3` |

**GET Response (LATEST_COURSES):**
```json
{
  "items": [
    {
      "id": "cms...",
      "title": "AI Content Studio Playbook",
      "thumbnailUrl": null,
      "price": 299,
      "rating": 4.9,
      "studentsCount": 540,
      "slug": "ai-content-studio"
    }
  ]
}
```

**GET Response (FEATURED_PRODUCTS):**
```json
{
  "items": [
    {
      "id": "cms...",
      "name": "Notion Creator OS",
      "coverUrl": null,
      "price": 99,
      "rating": 4.9,
      "type": "DIGITAL"
    }
  ]
}
```

**GET Response (LATEST_BLOG):**
```json
{
  "items": [
    {
      "id": "cms...",
      "title": "10 AI Prompts for Creators",
      "slug": "10-ai-prompts",
      "excerpt": "...",
      "coverUrl": "",
      "publishedAt": "2025-08-01T..."
    }
  ]
}
```

**GET Response (UPCOMING_EVENTS):**
```json
{
  "items": [
    {
      "id": "cms...",
      "title": "Weekly Q&A Session",
      "startTime": "2025-08-10T18:00:00Z",
      "type": "ONLINE"
    }
  ]
}
```

**GET Response (COMMUNITY_FEED):**
```json
{
  "items": [
    {
      "id": "cms...",
      "title": "Just hit $10K MRR!",
      "author": "Alex Rivera",
      "likesCount": 89,
      "createdAt": "2025-08-04T..."
    }
  ]
}
```

---

### Page Themes — `/api/data/pages/theme`

| Method | Purpose |
|--------|---------|
| PUT | Update page theme `{ id, theme }` |

**Request:**
```json
{
  "id": "cms...",
  "theme": {
    "name": "modern",
    "primaryColor": "oklch(0.62 0.15 162)",
    "background": "oklch(0.99 0.005 160)",
    "font": "sans",
    "radius": "0.75rem"
  }
}
```

**Response:**
```json
{ "success": true }
```

---

### Page Analytics — `/api/data/pages/analytics`

| Method | Purpose |
|--------|---------|
| PUT | Update page analytics `{ id, analytics }` |

**Request:**
```json
{
  "id": "cms...",
  "analytics": {
    "gaId": "G-XXXXXXXXXX",
    "fbPixel": "1234567890",
    "gtmId": "",
    "customHead": "",
    "customBody": "",
    "noindex": false,
    "canonical": ""
  }
}
```

---

### Page Versions — `/api/data/page-versions`

| Method | Purpose |
|--------|---------|
| GET | List versions `?pageId={id}` |
| POST | Create version snapshot `{ pageId, note? }` |
| POST | Restore version `{ pageId, versionId }` |

**GET Response:**
```json
{
  "versions": [
    { "id": "cms...", "version": 3, "note": "Before AI rewrite", "createdAt": "..." },
    { "id": "cms...", "version": 2, "note": "Auto-saved before publish", "createdAt": "..." },
    { "id": "cms...", "version": 1, "note": "Initial AI generation", "createdAt": "..." }
  ]
}
```

**Restore:**
```json
{
  "pageId": "cms...",
  "versionId": "cms..."
}
```

This deletes all current sections and recreates them from the version snapshot.

---

### Enhanced AI Landing Page — `/api/ai/landing-page` (enhanced)

**Enhanced Request:**
```json
{
  "selling": "An AI course for creators who want to 10x their output",
  "category": "Course",
  "style": "modern",
  "primaryColor": "#10b981"
}
```

**Enhanced System Prompt (additions):**
```
- Style: {style} — adapt tone accordingly
  - Minimal: clean, concise, no fluff
  - Modern: fresh, energetic, tech-savvy
  - Startup: bold, innovative, fast-paced
  - Luxury: elegant, premium, exclusive
  - Dark: moody, dramatic, high-contrast
  - Apple: simple, elegant, premium-minimal
  - Corporate: professional, structured, trustworthy
- Primary color: {primaryColor} — influences background/emoji suggestions
```

**Response (unchanged):**
```json
{
  "pageId": "cms...",
  "pageSlug": "landing-...",
  "creditsUsed": 7
}
```

---

### Enhanced AI Section Rewrite — `/api/ai/section-rewrite` (enhanced)

**Enhanced Request:**
```json
{
  "action": "PROFESSIONAL",
  "content": { "headline": "Master AI in 30 Days" },
  "sectionType": "HERO",
  "context": {
    "selling": "An AI course for creators",
    "category": "Course",
    "style": "modern"
  }
}
```

**New actions added to `ACTION_PROMPTS`:**
```typescript
PROFESSIONAL: 'Rewrite in a professional, authoritative, B2B tone.',
EMOTIONAL: 'Rewrite to be more emotional and storytelling.',
LUXURY: 'Rewrite in an elegant, premium, luxury tone.',
STARTUP: 'Rewrite in an energetic, modern startup tone.',
BETTER_HEADLINE: 'Generate a better headline. Replace only the "headline" field.',
INCREASE_CONVERSIONS: 'Optimize for maximum conversion. Add urgency and social proof.',
GENERATE_PRICING: 'Generate 3 realistic pricing tiers.',
IMPROVE_PRICING: 'Optimize pricing for conversion.',
CREATE_FAQ: 'Generate 5 objection-handling FAQ questions.',
BETTER_CTA: 'Generate a stronger, more urgent CTA.',
GENERATE_TESTIMONIALS: 'Generate 3 realistic testimonials.',
GENERATE_FEATURES: 'Generate 4 compelling features.',
GENERATE_BENEFITS: 'Generate 3 outcome-focused benefits.',
```

**Credit costs by action:**
```typescript
const CREDIT_COSTS: Record<string, number> = {
  REWRITE: 2, IMPROVE: 2, SHORTEN: 2, EXPAND: 2, TRANSLATE: 2, SEO: 2,
  PROFESSIONAL: 2, EMOTIONAL: 2, LUXURY: 2, STARTUP: 2,
  BETTER_HEADLINE: 2, INCREASE_CONVERSIONS: 2, BETTER_CTA: 2,
  GENERATE_PRICING: 3, IMPROVE_PRICING: 3, CREATE_FAQ: 3,
  GENERATE_TESTIMONIALS: 3, GENERATE_FEATURES: 3, GENERATE_BENEFITS: 2,
}
```

---

## 3. API Summary Table

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/api/data/pages` | GET | ✅ Exists | List pages |
| `/api/data/pages` | POST | ✅ Exists | Create page |
| `/api/data/pages` | PUT | ✅ Exists | Update page (add theme, analytics) |
| `/api/data/pages` | DELETE | ✅ Exists | Delete page |
| `/api/data/pages/theme` | PUT | 🆕 New | Update theme only |
| `/api/data/pages/analytics` | PUT | 🆕 New | Update analytics only |
| `/api/data/page-sections` | GET | ✅ Exists | Get page + sections |
| `/api/data/page-sections` | POST | ✅ Exists | Add section |
| `/api/data/page-sections` | PUT | ✅ Exists | Update/duplicate/move |
| `/api/data/page-sections` | DELETE | ✅ Exists | Delete section |
| `/api/data/page-sections/reorder` | POST | 🆕 New | Batch reorder |
| `/api/data/page-versions` | GET | 🆕 New | List versions |
| `/api/data/page-versions` | POST | 🆕 New | Create version / restore |
| `/api/data/reusable-blocks` | GET | 🆕 New | List reusable blocks |
| `/api/data/reusable-blocks` | POST | 🆕 New | Save reusable block |
| `/api/data/reusable-blocks` | DELETE | 🆕 New | Delete reusable block |
| `/api/data/dynamic-blocks` | GET | 🆕 New | Fetch dynamic data |
| `/api/ai/landing-page` | POST | ✅ Enhanced | Generate full page (add style, color) |
| `/api/ai/section-rewrite` | POST | ✅ Enhanced | AI section action (add new actions, context) |

**Total: 19 endpoints (10 existing + 9 new)**

---

## 4. Request/Response Patterns

All APIs follow the existing pattern:

- **Success:** `{ success: true, ...data }` or just the data object
- **Error:** `{ error: "Message" }` with appropriate HTTP status
- **Auth:** Uses `db.workspace.findFirst()` (existing pattern — will be replaced with proper auth later)
- **Content-Type:** `application/json`
- **Dynamic:** `export const dynamic = 'force-dynamic'`

---

## 5. Rate Limiting (recommended)

| Endpoint | Rate Limit |
|----------|-----------|
| `/api/ai/landing-page` | 5 requests/minute per user |
| `/api/ai/section-rewrite` | 20 requests/minute per user |
| `/api/data/page-sections` (PUT) | 60 requests/minute per user |
| All other APIs | 100 requests/minute per user |

Not implemented in v1 — documented for future.
