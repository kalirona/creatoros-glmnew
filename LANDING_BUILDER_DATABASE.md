# LANDING_BUILDER_DATABASE.md

**Date:** 2026-08-05
**Status:** Schema specification (no changes applied yet)

---

## 1. Existing Models (keep as-is)

### Page

```prisma
model Page {
  id           String   @id @default(cuid())
  workspaceId  String
  title        String
  slug         String
  type         String   @default("PAGE")    // PAGE | LANDING
  status       String   @default("DRAFT")   // DRAFT | PUBLISHED | SCHEDULED
  category     String   @default("General")
  seoTitle     String   @default("")
  seoDescription String @default("")
  ogImage      String   @default("")
  schema       String   @default("{}")
  visits       Int      @default(0)
  conversions  Int      @default(0)
  publishedAt  DateTime?
  // ... timestamps, relations, indexes
}
```

### PageSection

```prisma
model PageSection {
  id          String   @id @default(cuid())
  pageId      String
  type        String   // HERO | FEATURES | PRICING | ...
  content     String   @default("{}")  // JSON
  position    Int      @default(0)
  isHidden    Boolean  @default(false)
  // ... timestamps, relation, index
}
```

### PageVersion

```prisma
model PageVersion {
  id          String   @id @default(cuid())
  pageId      String
  version     Int
  sections    String   @default("[]")  // JSON snapshot
  note        String   @default("")
  // ... timestamps, relation, indexes
}
```

---

## 2. New Models (additive only)

### ReusableBlock

Stores user-saved sections that can be inserted into any page.

```prisma
model ReusableBlock {
  id          String   @id @default(cuid())
  workspaceId String
  name        String                    // "My Hero", "Pricing v2"
  type        String                    // HERO | PRICING | CTA | ...
  content     String   @default("{}")   // JSON content (same shape as PageSection.content)
  thumbnail   String?                   // Optional preview image URL
  category    String   @default("Custom") // Custom | Hero | Pricing | ...
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([workspaceId, type])
}
```

**Usage:**
- User clicks "Save as Reusable" on any section → creates ReusableBlock
- User clicks "Insert Reusable" → lists all ReusableBlocks for the workspace
- Selecting one clones `content` into a new PageSection

---

## 3. Schema Additions to Existing Models

### Page — add `theme` and `analytics` fields

```prisma
// Add to existing Page model (additive — nullable with defaults)
  theme       String   @default("{}")    // JSON: { name, primaryColor, background, font, radius }
  analytics   String   @default("{}")    // JSON: { gaId, fbPixel, gtmId, customHead, customBody }
```

These are **additive** — existing rows get the default `"{}"` value automatically. No data loss.

### PageSection — add `isDynamic` field

```prisma
// Add to existing PageSection model (additive)
  isDynamic   Boolean  @default(false)   // true for dynamic blocks (LATEST_COURSES, etc.)
```

Existing sections default to `false` (static). Dynamic blocks set this to `true`.

### Workspace — add `reusableBlocks` back-relation

```prisma
// Add to existing Workspace model
  reusableBlocks ReusableBlock[]
```

---

## 4. Content JSON Schemas

Every section type stores its content as a JSON object in `PageSection.content`. Below are the schemas for all 40 section types.

### Hero

```json
{
  "headline": "Master AI in 30 Days",
  "subheadline": "The complete course for creators",
  "ctaText": "Enroll Now",
  "ctaUrl": "/checkout",
  "ctaSecondary": "Watch Preview",
  "ctaSecondaryUrl": "#preview",
  "emoji": "🎓",
  "background": { "type": "gradient", "value": "from-primary to-primary/70" },
  "spacing": { "paddingY": "lg" },
  "animation": "fade-in-up"
}
```

### Video Hero

```json
{
  "headline": "Transform Your Business",
  "subheadline": "Watch the 2-minute demo",
  "videoUrl": "https://youtube.com/...",
  "ctaText": "Get Started",
  "background": { "type": "dark" }
}
```

### Split Hero

```json
{
  "headline": "Build Your Creator Empire",
  "subheadline": "All-in-one platform",
  "ctaText": "Start Free",
  "imageUrl": "/api/media/hero.jpg",
  "imagePosition": "right"
}
```

### Features Grid

```json
{
  "heading": "Everything you need",
  "subheading": "Stop juggling 12 tools",
  "columns": 3,
  "items": [
    { "icon": "🎓", "title": "Courses", "description": "Build and sell courses" },
    { "icon": "📦", "title": "Products", "description": "Sell digital downloads" }
  ]
}
```

### Benefits

```json
{
  "heading": "What you'll achieve",
  "items": [
    { "title": "Save 20 hours/week", "description": "Automate your workflow" },
    { "title": "10x your revenue", "description": "Built-in sales funnels" }
  ]
}
```

### Pricing

```json
{
  "heading": "Simple pricing",
  "subheading": "Choose your plan",
  "plans": [
    {
      "name": "Starter",
      "price": 49,
      "interval": "/mo",
      "features": ["1 course", "50 members", "Email support"],
      "cta": "Get Started",
      "ctaUrl": "/checkout/starter",
      "highlighted": false
    },
    {
      "name": "Pro",
      "price": 99,
      "interval": "/mo",
      "features": ["Unlimited courses", "1,000 members", "Priority support", "AI Studio"],
      "cta": "Start Pro Trial",
      "ctaUrl": "/checkout/pro",
      "highlighted": true
    }
  ]
}
```

### Testimonials

```json
{
  "heading": "Loved by 10,000+ creators",
  "layout": "grid",
  "items": [
    { "name": "Sarah K.", "role": "YouTuber, 240K subs", "quote": "I replaced 5 tools with CreatorOS.", "avatar": "" },
    { "name": "Marcus T.", "role": "Course Creator", "quote": "The AI generator built my $297 course in 10 minutes." }
  ]
}
```

### FAQ

```json
{
  "heading": "Frequently asked questions",
  "layout": "accordion",
  "items": [
    { "question": "Is there a free trial?", "answer": "Yes, 14 days free. No credit card required." },
    { "question": "Can I cancel anytime?", "answer": "Yes, cancel with one click." }
  ]
}
```

### CTA

```json
{
  "headline": "Ready to start?",
  "subtext": "Join 10,000+ creators",
  "ctaText": "Get Started Free",
  "ctaUrl": "/signup",
  "background": { "type": "gradient", "value": "from-primary to-primary/70" }
}
```

### Newsletter

```json
{
  "heading": "Subscribe to our newsletter",
  "subtext": "Weekly tips for creators. No spam.",
  "placeholder": "you@email.com",
  "ctaText": "Subscribe",
  "ctaUrl": "/api/newsletter/subscribe"
}
```

### Countdown

```json
{
  "heading": "Limited time offer",
  "endDate": "2025-12-31T23:59:59",
  "ctaText": "Get Deal",
  "ctaUrl": "/checkout"
}
```

### Guarantee

```json
{
  "heading": "30-Day Money-Back Guarantee",
  "text": "Try CreatorOS risk-free. If you're not happy within 30 days, we'll refund every penny.",
  "icon": "🛡️"
}
```

### Stats

```json
{
  "heading": "Trusted by creators worldwide",
  "items": [
    { "value": "10,000+", "label": "Active creators" },
    { "value": "$50M+", "label": "Revenue generated" },
    { "value": "4.9/5", "label": "Average rating" }
  ]
}
```

### Logos

```json
{
  "heading": "As seen in",
  "logos": [
    { "name": "TechCrunch", "url": "/api/media/tc.png" },
    { "name": "Product Hunt", "url": "/api/media/ph.png" }
  ]
}
```

### Gallery

```json
{
  "heading": "See it in action",
  "columns": 4,
  "images": [
    { "url": "/api/media/1.jpg", "alt": "Dashboard" },
    { "url": "/api/media/2.jpg", "alt": "Course builder" }
  ]
}
```

### Video

```json
{
  "heading": "Watch the demo",
  "videoUrl": "https://youtube.com/watch?v=...",
  "description": "2-minute product walkthrough"
}
```

### Team

```json
{
  "heading": "Meet the team",
  "members": [
    { "name": "Alex Rivera", "role": "Founder & CEO", "avatar": "", "bio": "Built 3 successful SaaS companies." }
  ]
}
```

### Comparison Table

```json
{
  "heading": "CreatorOS vs. The Competition",
  "features": ["Courses", "Community", "Email Marketing", "AI Studio", "Affiliates"],
  "competitors": [
    { "name": "CreatorOS", "values": [true, true, true, true, true] },
    { "name": "Kajabi", "values": [true, false, true, false, true] },
    { "name": "Teachable", "values": [true, false, false, false, false] }
  ]
}
```

### Timeline

```json
{
  "heading": "Your journey",
  "items": [
    { "title": "Day 1", "description": "Set up your workspace" },
    { "title": "Week 1", "description": "Launch your first course" },
    { "title": "Month 1", "description": "Build your community" }
  ]
}
```

### Roadmap

```json
{
  "heading": "What's coming",
  "items": [
    { "title": "Q1 2025", "description": "Mobile app launch", "status": "planned" },
    { "title": "Q2 2025", "description": "Webinar platform", "status": "in-progress" }
  ]
}
```

### Accordion

```json
{
  "heading": "Learn more",
  "items": [
    { "title": "How does it work?", "content": "Simply create content and the website updates automatically." }
  ]
}
```

### Features Tabs

```json
{
  "heading": "Powerful features",
  "tabs": [
    { "name": "Courses", "content": "Build and sell unlimited courses with drip content." },
    { "name": "Community", "content": "A thriving paid community that keeps members engaged." }
  ]
}
```

### Dynamic Blocks

#### Latest Courses

```json
{
  "type": "LATEST_COURSES",
  "heading": "Popular Courses",
  "limit": 3,
  "layout": "grid",
  "showPrice": true,
  "showRating": true,
  "showStudents": true
}
```

#### Featured Products

```json
{
  "type": "FEATURED_PRODUCTS",
  "heading": "Featured Products",
  "limit": 4,
  "layout": "grid"
}
```

#### Latest Blog

```json
{
  "type": "LATEST_BLOG",
  "heading": "From the Blog",
  "limit": 3,
  "layout": "list"
}
```

#### Community Feed

```json
{
  "type": "COMMUNITY_FEED",
  "heading": "Community Highlights",
  "limit": 5
}
```

#### Upcoming Events

```json
{
  "type": "UPCOMING_EVENTS",
  "heading": "Upcoming Events",
  "limit": 3
}
```

### Layout Sections

#### Spacer

```json
{ "height": "md" }
```

#### Divider

```json
{ "style": "solid" }
```

#### Footer

```json
{
  "brand": "CreatorOS",
  "tagline": "All-in-one creator platform",
  "links": [
    { "label": "Courses", "url": "/courses" },
    { "label": "Pricing", "url": "/pricing" },
    { "label": "About", "url": "/about" }
  ],
  "socials": [
    { "icon": "twitter", "url": "https://twitter.com/creatoros" },
    { "icon": "youtube", "url": "https://youtube.com/@creatoros" }
  ]
}
```

---

## 5. Theme JSON Schema

Stored in `Page.theme`:

```json
{
  "name": "modern",
  "primaryColor": "oklch(0.62 0.15 162)",
  "background": "oklch(0.99 0.005 160)",
  "font": "sans",
  "radius": "0.75rem",
  "maxWidth": "1200px"
}
```

When applied, the renderer sets CSS variables on the page wrapper:
```css
--primary: var(--theme-primary);
--background: var(--theme-background);
--radius: var(--theme-radius);
```

---

## 6. Analytics JSON Schema

Stored in `Page.analytics`:

```json
{
  "gaId": "G-XXXXXXXXXX",
  "fbPixel": "1234567890",
  "gtmId": "GTM-XXXXXXX",
  "customHead": "<script>...</script>",
  "customBody": "<script>...</script>",
  "noindex": false,
  "canonical": "https://mysite.com/landing"
}
```

---

## 7. Version History

`PageVersion` stores snapshots of all sections as a JSON array:

```json
{
  "version": 3,
  "sections": [
    { "type": "HERO", "content": { "headline": "v3 headline" } },
    { "type": "CTA", "content": { "ctaText": "Buy Now" } }
  ],
  "note": "Changed headline and CTA text"
}
```

A version is created on:
- Manual "Save Version" action
- Publish (auto-snapshot before publishing)
- AI generation (auto-snapshot before AI replaces content)

---

## 8. Migration Safety

All changes are **additive**:

| Change | Type | Existing Data Impact |
|--------|------|---------------------|
| `Page.theme` | New field, default `"{}"` | ✅ None — existing rows get default |
| `Page.analytics` | New field, default `"{}"` | ✅ None |
| `PageSection.isDynamic` | New field, default `false` | ✅ None — existing sections are static |
| `ReusableBlock` model | New model | ✅ None — new table, no existing data |
| `Workspace.reusableBlocks` | New back-relation | ✅ None — additive |

**No existing columns removed. No existing types changed. No data loss.**
