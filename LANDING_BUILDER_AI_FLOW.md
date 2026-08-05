# LANDING_BUILDER_AI_FLOW.md

**Date:** 2026-08-05
**Status:** AI flow specification (no code changes)

---

## 1. AI Generation Philosophy

**AI generates 90% of the page. Creator customizes 10%.**

The AI is the signature feature of the landing builder. Every interaction should feel like the AI is a co-pilot, not a tool.

---

## 2. Full Page Generation Flow

```
User opens Landing Wizard
        │
        ▼
Step 1: Business description
   "What are you selling?"
   (textarea — freeform text)
        │
        ▼
Step 2: Goal selection
   Lead Gen | Sales | Course | Product | Agency
   Newsletter | Webinar | Event | Coaching
        │
        ▼
Step 3: Style selection
   Minimal | Modern | Startup | Luxury | Dark | Apple | Corporate
        │
        ▼
Step 4: Primary color
   Preset swatches + custom color picker
        │
        ▼
Step 5: Logo (optional)
   Upload or skip
        │
        ▼
Step 6: Generate
   ┌─────────────────────────────────┐
   │ POST /api/ai/landing-page       │
   │ Body: {                          │
   │   selling: "An AI course for...",│
   │   category: "Course",           │
   │   style: "modern",              │
   │   primaryColor: "#10b981"       │
   │ }                                │
   └─────────────────────────────────┘
        │
        ▼
AI generates JSON:
{
  "seo": { "title": "...", "description": "..." },
  "sections": [
    { "type": "HERO", "content": {...} },
    { "type": "BENEFITS", "content": {...} },
    { "type": "FEATURES", "content": {...} },
    { "type": "TESTIMONIALS", "content": {...} },
    { "type": "PRICING", "content": {...} },
    { "type": "FAQ", "content": {...} },
    { "type": "CTA", "content": {...} }
  ]
}
        │
        ▼
API persists:
1. Create Page (type=LANDING, status=DRAFT, theme={style, primaryColor})
2. Create 7 PageSection records (position 0-6)
3. Deduct credits (7 credits)
4. Return { pageId, pageSlug, creditsUsed }
        │
        ▼
Frontend:
1. Close wizard
2. Open LandingEditor with new page
3. Show toast "Landing page generated! -7 credits"
```

---

## 3. Section-Level AI Actions

Every section has AI actions accessible from the AI Panel (right sidebar) and the hover action bar (canvas).

### Standard Actions (all section types)

| Action | Prompt | Credits | Description |
|--------|--------|---------|-------------|
| Rewrite | "Rewrite to be clearer and more compelling" | 2 | Improves clarity |
| Improve | "Improve to be more persuasive and conversion-focused" | 2 | Boosts conversion |
| Shorten | "Shorten to be more concise" | 2 | Reduces length |
| Expand | "Expand with more detail and specificity" | 2 | Adds detail |
| SEO Optimize | "Optimize for SEO with relevant keywords" | 2 | Search-friendly |
| Translate | "Translate all text to Spanish" | 2 | Localization |

### Style Actions (all section types)

| Action | Prompt | Credits | Description |
|--------|--------|---------|-------------|
| More Professional | "Rewrite in a professional, authoritative tone" | 2 | B2B / corporate |
| More Emotional | "Rewrite to be more emotional and storytelling" | 2 | Connection |
| Luxury Style | "Rewrite in an elegant, premium, luxury tone" | 2 | High-ticket |
| Startup Style | "Rewrite in an energetic, modern startup tone" | 2 | Tech / SaaS |

### Section-Specific Actions

| Section Type | Action | Prompt | Credits |
|-------------|--------|--------|---------|
| HERO | Better Headline | "Generate 3 alternative headlines. Pick the best one." | 2 |
| HERO | Increase Conversions | "Optimize the hero for maximum conversion. Stronger CTA, urgency." | 2 |
| PRICING | Generate Pricing | "Generate 3 realistic pricing tiers for this product." | 3 |
| PRICING | Improve Conversion | "Optimize pricing for conversion. Add anchors, urgency, guarantees." | 3 |
| FAQ | Create FAQ | "Generate 5 objection-handling FAQ questions and answers." | 3 |
| FAQ | Add Guarantee | "Add a guarantee-related FAQ to reduce purchase anxiety." | 2 |
| CTA | Better CTA | "Generate a stronger, more urgent call-to-action." | 2 |
| CTA | Increase Urgency | "Add urgency and scarcity to the CTA." | 2 |
| TESTIMONIALS | Generate Testimonials | "Generate 3 realistic testimonials for this product." | 3 |
| FEATURES | Generate Features | "Generate 4 compelling features based on the product description." | 3 |
| BENEFITS | Generate Benefits | "Generate 3 outcome-focused benefits." | 2 |

---

## 4. AI Request/Response Format

### Request (to `/api/ai/section-rewrite`)

```json
{
  "action": "REWRITE",
  "content": {
    "headline": "Master AI in 30 Days",
    "subheadline": "The complete course for creators"
  },
  "sectionType": "HERO"
}
```

### Enhanced request (new actions)

```json
{
  "action": "PROFESSIONAL",
  "content": { ... },
  "sectionType": "HERO",
  "context": {
    "selling": "AI course for creators",
    "category": "Course",
    "style": "modern"
  }
}
```

The `context` field is optional — when provided, the AI uses it to make the output more relevant.

### Response

```json
{
  "success": true,
  "content": {
    "headline": "Transform Your Career with AI Mastery",
    "subheadline": "The definitive 30-day course for forward-thinking creators"
  },
  "creditsUsed": 2,
  "remainingCredits": 4275
}
```

---

## 5. AI System Prompts

### Full Page Generation (enhanced)

```
You are CreatorOS Landing Page AI, an expert at generating high-converting landing pages.

Generate a COMPLETE landing page as a single JSON object. Respond with ONLY the JSON.

The JSON shape must be:
{
  "seo": { "title": "string (under 60 chars)", "description": "string (under 160 chars)" },
  "sections": [ ... ]
}

Rules:
- Include exactly 7 sections: HERO, BENEFITS, FEATURES, TESTIMONIALS, PRICING, FAQ, CTA
- Style: {style} — adapt tone and language accordingly
- Primary color: {primaryColor} — not used in content, but influences emoji/background suggestions
- Category: {category} — tailor content to this business type
- Make all copy specific to what the user is selling
- Use emojis sparingly but effectively
- Include realistic, specific numbers and outcomes
```

### Section Rewrite (enhanced)

```
You are an expert copywriter for creator businesses.
You improve {sectionType} section content.

Action: {action}
{actionSpecificPrompt}

Keep the same JSON structure and keys.
Respond with ONLY the JSON. No markdown, no commentary.

Context (if provided):
- Business: {context.selling}
- Category: {context.category}
- Style: {context.style}
```

### Action-specific prompts

```typescript
const ACTION_PROMPTS = {
  // Existing
  REWRITE: 'Rewrite the content to be clearer and more compelling.',
  IMPROVE: 'Improve the content to be more persuasive, specific, and conversion-focused.',
  SHORTEN: 'Shorten the content to be more concise while keeping the key message.',
  EXPAND: 'Expand the content with more detail, specificity, and persuasive language.',
  TRANSLATE: 'Translate all text values to Spanish.',
  SEO: 'Optimize the content for SEO. Make headlines search-friendly. Add relevant keywords naturally.',

  // New — Style
  PROFESSIONAL: 'Rewrite in a professional, authoritative, B2B tone. Use industry terminology.',
  EMOTIONAL: 'Rewrite to be more emotional and storytelling. Use sensory language and personal narratives.',
  LUXURY: 'Rewrite in an elegant, premium, luxury tone. Use sophisticated language. Emphasize exclusivity.',
  STARTUP: 'Rewrite in an energetic, modern, startup tone. Use tech-friendly language. Emphasize innovation and speed.',

  // New — Section-specific
  BETTER_HEADLINE: 'Generate 3 alternative headlines. Pick the best one. Replace the "headline" field only.',
  INCREASE_CONVERSIONS: 'Optimize for maximum conversion. Add urgency, social proof, and a stronger CTA.',
  GENERATE_PRICING: 'Generate 3 realistic pricing tiers based on the product. Include features list for each.',
  IMPROVE_PRICING: 'Optimize pricing for conversion. Add price anchors, urgency, and guarantees.',
  CREATE_FAQ: 'Generate 5 objection-handling FAQ questions and answers based on the product.',
  ADD_GUARANTEE: 'Add a guarantee-related FAQ to reduce purchase anxiety.',
  BETTER_CTA: 'Generate a stronger, more urgent call-to-action.',
  INCREASE_URGENCY: 'Add urgency and scarcity to the CTA without being pushy.',
  GENERATE_TESTIMONIALS: 'Generate 3 realistic, specific testimonials for this product.',
  GENERATE_FEATURES: 'Generate 4 compelling features based on the product description.',
  GENERATE_BENEFITS: 'Generate 3 outcome-focused benefits (not features).',
}
```

---

## 6. Credit Costs

| Action | Credits | Rationale |
|--------|---------|-----------|
| Full page generation | 7 | 7 sections × ~1 credit each |
| Section rewrite | 2 | Single section, moderate output |
| Section generate (pricing/FAQ/testimonials) | 3 | Generates new content arrays |
| Section style change | 2 | Modifies tone only |

---

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| AI returns invalid JSON | Show toast "AI failed to generate valid content. Please try again." |
| AI timeout (>55s) | Abort request, show "AI request timed out. Please try again." |
| Insufficient credits | Return 402, show "Insufficient credits. You need X credits." |
| AI service unavailable | Return 503, show "AI service is temporarily unavailable." |
| Rate limit | Return 429, show "Too many AI requests. Please wait a moment." |

---

## 8. Loading States

| State | Visual |
|-------|--------|
| Generating full page | Wizard shows progress steps: "Writing headline → Crafting benefits → ..." |
| Section AI action | Button shows spinner, section shows subtle shimmer overlay |
| AI panel | Dim other actions, show spinner on active action |

---

## 9. AI Context Propagation

When the user generates a full page, the business description and category are stored on the `Page` model (in `schema` field or a new `aiContext` field). This context is passed to all section-level AI actions so the AI maintains consistency.

```json
// Page.schema or Page.aiContext
{
  "selling": "An AI course for creators",
  "category": "Course",
  "style": "modern"
}
```

When calling `/api/ai/section-rewrite`, the frontend includes this context:

```json
{
  "action": "REWRITE",
  "content": { ... },
  "sectionType": "HERO",
  "context": {
    "selling": "An AI course for creators",
    "category": "Course",
    "style": "modern"
  }
}
```

This ensures that when the user clicks "Rewrite" on a section 3 days later, the AI still knows what the page is about.
