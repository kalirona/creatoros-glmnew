# LANDING_BUILDER_ARCHITECTURE.md

**Date:** 2026-08-05
**Status:** Architecture specification (no code changes)
**Scope:** CreatorOS Landing Page Builder — Enterprise Edition

---

## 1. Product Philosophy

CreatorOS is **not** a page builder. It is an AI-first business platform where the landing builder exists solely to help creators **sell** — courses, memberships, communities, digital products, services, SaaS, coaching, and events.

**Core loop:**
```
AI generates (90%) → Creator customizes (10%) → CreatorOS publishes
```

**What we do NOT build:**
- ❌ Elementor clone
- ❌ Absolute-position canvas
- ❌ CSS / margin / pixel editor
- ❌ Layer manager
- ❌ Free drag-anywhere canvas
- ❌ Complex responsive breakpoint editor
- ❌ Hundreds of settings per element

**What we DO build:**
- ✅ Clean 3-panel fullscreen editor (Navigator | Canvas | Inspector)
- ✅ AI generation for every section
- ✅ Inline text editing (click → type → auto-saved)
- ✅ 40 premium section types (not hundreds)
- ✅ Dynamic blocks that auto-populate from DB (courses, products, blog, community)
- ✅ One-click themes
- ✅ Reusable saved blocks
- ✅ Responsive preview (desktop / tablet / mobile) — no manual responsive editing

---

## 2. Editor Layout

```
┌──────────────────────────────────────────────────────────┐
│  Toolbar: ← Back | Undo Redo | AI Assistant | Preview Publish │
├──────────┬──────────────────────────────┬────────────────┤
│          │                              │                │
│ Navigator│         Canvas               │   Inspector    │
│          │                              │                │
│ ▸ Page   │   [Live responsive preview]  │  Content       │
│ ▸ Hero   │                              │  Background    │
│ ▸ Benefits│  Hover section → actions:   │  Buttons       │
│ ▸ Features│  Edit | Duplicate | Hide    │  Spacing       │
│ ▸ Pricing│        | Delete | AI         │  Typography    │
│ ▸ FAQ    │                              │  Animation     │
│ ▸ CTA    │                              │  Visibility    │
│ ▸ Footer │                              │  SEO           │
│          │                              │                │
│ + Add    │                              │  [AI Panel]    │
│          │                              │  Rewrite       │
│          │                              │  Improve       │
│          │                              │  Shorten       │
│          │                              │  Expand        │
│          │                              │  SEO Optimize  │
│          │                              │  Translate     │
├──────────┴──────────────────────────────┴────────────────┤
│  Status: Auto-saved | DRAFT/PUBLISHED | Desktop/Tablet/Mobile │
└──────────────────────────────────────────────────────────┘
```

### Panel specifications

| Panel | Width | Behavior |
|-------|-------|----------|
| **Navigator** (left) | 240px (collapsible to 48px) | Section tree with drag-reorder, expand/collapse, duplicate, delete, hide |
| **Canvas** (center) | flex-1 | Live preview rendered from DB content; hover shows action bar; click text to edit inline |
| **Inspector** (right) | 360px (collapsible) | Context-sensitive: shows settings for selected section or element |

---

## 3. Section Architecture

### 40 Premium Section Types

| Category | Sections |
|----------|----------|
| **Hero** | Hero, Video Hero, Split Hero |
| **Content** | Heading, Text, Rich Text, Image, Video, Gallery |
| **Social Proof** | Testimonials, Logos, Stats, Reviews |
| **Conversion** | Pricing, CTA, Newsletter, Countdown, Guarantee |
| **Structure** | Features Grid, Benefits, FAQ, Accordion, Tabs, Comparison Table |
| **Business** | Team, Roadmap, Timeline, Latest Courses, Featured Products, Latest Blog, Community Feed, Upcoming Events |
| **Layout** | Spacer, Divider, Footer |

### Section data model (JSON, stored in `PageSection.content`)

```json
{
  "type": "HERO",
  "content": {
    "headline": "Master AI in 30 Days",
    "subheadline": "The complete course for creators",
    "ctaText": "Enroll Now",
    "ctaUrl": "/checkout",
    "ctaSecondary": "Watch Preview",
    "emoji": "🎓",
    "background": { "type": "gradient", "value": "from-primary to-primary/70" },
    "spacing": { "paddingY": "lg", "paddingX": "default" },
    "animation": "fade-in-up",
    "visibility": { "desktop": true, "tablet": true, "mobile": true }
  }
}
```

### Dynamic Blocks

Dynamic blocks are special section types that auto-populate from the database:

| Section Type | Data Source | Auto-Updates |
|-------------|-------------|-------------|
| `LATEST_COURSES` | `Course` where `status=PUBLISHED` | Yes — new courses appear automatically |
| `FEATURED_PRODUCTS` | `Product` where `status=ACTIVE` | Yes |
| `LATEST_BLOG` | `BlogPost` where `status=PUBLISHED` | Yes |
| `COMMUNITY_FEED` | `CommunityPost` (latest 5) | Yes |
| `UPCOMING_EVENTS` | `CommunityEvent` where `startTime > now` | Yes |
| `TESTIMONIALS_AUTO` | Reviews from `Order`/`CommunityPost` | Yes |

Dynamic blocks store a **query config** in `content`, not hardcoded data:

```json
{
  "type": "LATEST_COURSES",
  "content": {
    "heading": "Popular Courses",
    "limit": 3,
    "layout": "grid",
    "showPrice": true,
    "showRating": true
  }
}
```

---

## 4. Themes

One-click theme switch. Themes override CSS variables globally for the landing page.

| Theme | Primary | Background | Font | Style |
|-------|---------|------------|------|-------|
| Modern | emerald | white | sans | clean, rounded |
| Minimal | gray-900 | white | sans | no borders, lots of whitespace |
| Glass | violet | dark | sans | glassmorphism, blur |
| Corporate | blue | white | serif | structured, formal |
| Creative | amber | cream | display | playful, bold |
| Luxury | gold | dark | serif | elegant, premium |
| Dark | emerald | dark | sans | dark mode default |
| Startup | blue | light | sans | energetic, gradient |

Theme is stored on the `Page` model as a `theme` field (JSON with CSS variable overrides).

---

## 5. Reusable Blocks

Users can save any section as a reusable block:

```
Save Section → "My Hero" → stored in ReusableBlock model
Create new page → Insert → My Hero → clones content into new section
```

Schema addition needed: `ReusableBlock` model (see LANDING_BUILDER_DATABASE.md).

---

## 6. Undo / Redo

Client-side history stack (not server-side). Each content change pushes a snapshot.

```
State 1: original
State 2: edited headline → push snapshot
State 3: added section → push snapshot
Undo → pop to State 2
Redo → push State 3 back
```

History is lost on page refresh (acceptable for v1). Max 50 states.

---

## 7. Responsive Strategy

**No manual responsive editing.** All sections are responsive by default using Tailwind responsive classes.

The responsive preview toggles viewport width:
- Desktop: 1440px
- Tablet: 768px
- Mobile: 375px

The canvas renders the same content at different widths. Tailwind's `sm:`, `md:`, `lg:` breakpoints handle the layout automatically.

---

## 8. Publish Flow

```
Draft → Save → Preview → Publish → Live URL → Analytics
```

| State | What happens |
|-------|-------------|
| **Draft** | Page is editable, not publicly visible |
| **Preview** | Opens modal with rendered sections (current working state) |
| **Publish** | Sets `status=PUBLISHED`, sets `publishedAt`, generates SEO metadata |
| **Live URL** | Page accessible at `/p/{slug}` (public route) |
| **Analytics** | Tracks visits, conversions (via `Page.visits` and `Page.conversions`) |

---

## 9. Integration with CreatorOS Modules

The landing builder integrates with existing modules:

| Module | Integration |
|--------|------------|
| **Courses** | Dynamic block `LATEST_COURSES` auto-lists published courses; course pages auto-generate at `/courses/[slug]` |
| **Products** | Dynamic block `FEATURED_PRODUCTS` auto-lists active products |
| **Community** | Dynamic block `COMMUNITY_FEED` shows latest posts |
| **Blog** | Dynamic block `LATEST_BLOG` shows latest published posts |
| **Events** | Dynamic block `UPCOMING_EVENTS` shows future events |
| **AI Studio** | AI generation powered by `z-ai-web-dev-sdk` (same as existing AI endpoints) |
| **Media Library** | Image picker for Hero/Gallery sections |
| **CRM** | Form submissions from Newsletter/CTA sections create Customer records |

---

## 10. What Exists vs What Needs Building

### Already exists (keep, enhance)

| Feature | Current State | Enhancement Needed |
|---------|--------------|-------------------|
| Page model | ✅ Has `Page` with sections, SEO, status | Add `theme` field, `analytics` field |
| PageSection model | ✅ Has type, content (JSON), position, isHidden | Add `isDynamic` field for dynamic blocks |
| Page API | ✅ GET/POST/PUT/DELETE | Add batch reorder endpoint |
| PageSection API | ✅ GET/POST/PUT/DELETE + duplicate/move | Add batch reorder endpoint |
| AI Landing Generator | ✅ `/api/ai/landing-page` generates 7 sections | Add style/theme/logo inputs to wizard |
| AI Section Rewrite | ✅ `/api/ai/section-rewrite` with 6 actions | Add more actions (Professional, Emotional, Luxury, Startup) |
| Page Editor | ✅ Section list, settings panel, preview modal | Upgrade to fullscreen 3-panel editor with inline editing |
| Templates | ✅ 6 prebuilt templates | Expand to 10+ with category-specific templates |
| Preview | ✅ Modal preview with rendered sections | Add responsive preview (desktop/tablet/mobile toggle) |
| Publish/Unpublish | ✅ API + buttons | Keep as-is |
| SEO Editor | ✅ Dialog with title/description + search preview | Keep as-is |
| Save & Preview | ✅ Saves then opens preview | Keep as-is |
| Auto-save | ✅ Section content saves on edit | Add visual "Saving..."/"Auto-saved" indicator (already done) |

### Needs building (new)

| Feature | Priority | Effort |
|---------|----------|--------|
| Fullscreen 3-panel editor layout | P0 | Medium |
| Navigator panel (drag-reorder, expand/collapse) | P0 | Medium |
| Canvas with hover actions (Edit/Duplicate/Hide/Delete/AI) | P0 | Medium |
| Inline text editing (click → type → auto-save) | P0 | High |
| Inspector panel (context-sensitive settings) | P0 | Medium |
| AI panel per section (expanded actions) | P1 | Medium |
| Undo/Redo | P1 | Medium |
| Responsive preview toggle | P1 | Low |
| Dynamic blocks (Latest Courses, Featured Products, etc.) | P1 | High |
| Reusable blocks (save/insert) | P2 | Medium |
| Theme switcher | P2 | Low |
| Landing page wizard (Business → Goal → Style → Color → Generate) | P1 | Medium |
| Expanded section library (40 types) | P1 | Medium |
| Page settings panel (SEO, OG, analytics, domain, tracking) | P2 | Low |
| Public route `/p/[slug]` for published pages | P1 | Medium |
| Sitemap generation | P3 | Low |

---

## 11. Technical Constraints

- **Framework:** Next.js 16 App Router (existing)
- **Database:** Prisma + SQLite (existing; PostgreSQL for production)
- **AI:** `z-ai-web-dev-sdk` (existing)
- **UI:** shadcn/ui + Tailwind CSS 4 (existing)
- **Animation:** Framer Motion (existing)
- **State:** React hooks (no new state library needed for v1)
- **Storage:** Section content stored as JSON string in `PageSection.content` (existing pattern)
- **No HTML blobs:** All content is structured JSON — the renderer converts to React components

---

## 12. Success Criteria

| Criterion | Verification |
|-----------|-------------|
| Create landing page | User can create a blank landing page |
| Generate AI landing | Wizard generates a complete 7-section page in <30s |
| Edit text inline | Click any text in canvas → type → auto-saved |
| Duplicate section | One click duplicates any section |
| Delete section | One click deletes (with confirm) |
| Reorder section | Drag in navigator or arrow buttons |
| Preview | Opens modal showing rendered page |
| Publish | Sets status to PUBLISHED, page accessible at `/p/{slug}` |
| Edit existing | Reopen editor with all sections loaded |
| Autosave | Visual indicator shows "Saving..." then "Auto-saved" |
| Undo/Redo | Buttons in toolbar undo/redo content changes |
| Responsive preview | Toggle desktop/tablet/mobile |
| SEO | Edit title, description, see search preview |
| Dynamic blocks | Insert "Latest Courses" block that auto-populates |
| Theme switch | One click changes entire page style |
| Reusable blocks | Save a section, insert on another page |
| No dead buttons | Every button calls an API or opens a panel |
| No console errors | Zero runtime errors |
| No broken navigation | Editor opens/closes cleanly |
