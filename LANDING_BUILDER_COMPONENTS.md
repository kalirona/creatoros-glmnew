# LANDING_BUILDER_COMPONENTS.md

**Date:** 2026-08-05
**Status:** Component specification (no code changes)

---

## 1. Component Tree

```
PagesFunnelsModule (existing, updated)
├── WebsiteTabs (existing)
│   ├── HomePanel (existing)
│   ├── PagesList (existing)
│   │   └── LandingEditor (NEW — replaces PageEditor for LANDING type)
│   │       ├── EditorToolbar
│   │       │   ├── BackButton
│   │       │   ├── UndoRedoButtons
│   │       │   ├── AIAssistantButton
│   │       │   ├── ResponsiveToggle (Desktop/Tablet/Mobile)
│   │       │   ├── PreviewButton
│   │       │   ├── PublishButton
│   │       │   └── SaveStatusIndicator
│   │       ├── EditorBody (3-panel grid)
│   │       │   ├── NavigatorPanel (left)
│   │       │   │   ├── SectionTree
│   │       │   │   │   └── SectionNode (drag-reorder, expand/collapse)
│   │       │   │   └── AddSectionButton
│   │       │   ├── CanvasPanel (center)
│   │       │   │   ├── SectionRenderer (renders each section type)
│   │       │   │   │   ├── HeroRenderer
│   │       │   │   │   ├── FeaturesRenderer
│   │       │   │   │   ├── PricingRenderer
│   │       │   │   │   ├── TestimonialsRenderer
│   │       │   │   │   ├── FAQRenderer
│   │       │   │   │   ├── CTARenderer
│   │       │   │   │   ├── ... (40 renderers)
│   │       │   │   │   └── DynamicBlockRenderer
│   │       │   │   ├── SectionHoverActions (Edit/Duplicate/Hide/Delete/AI)
│   │       │   │   └── InlineTextEditor (contentEditable)
│   │       │   └── InspectorPanel (right)
│   │       │       ├── SectionInspector
│   │       │       │   ├── ContentTab
│   │       │       │   ├── BackgroundTab
│   │       │       │   ├── SpacingTab
│   │       │       │   ├── TypographyTab
│   │       │       │   ├── AnimationTab
│   │       │       │   ├── VisibilityTab
│   │       │       │   └── SEOTab
│   │       │       └── AIPanel
│   │       │           ├── AIActionButtons (Rewrite/Improve/Shorten/Expand/SEO/Translate)
│   │       │           └── AIStyleButtons (Professional/Emotional/Luxury/Startup)
│   │       ├── PreviewModal (existing, enhanced)
│   │       ├── TemplatesModal (existing)
│   │       ├── SEOEditorDialog (existing)
│   │       ├── ThemeSwitcher (NEW)
│   │       ├── AddSectionModal (existing, expanded to 40 types)
│   │       └── LandingWizard (NEW — replaces LandingGenerator)
│   ├── NavigationPanel (existing)
│   ├── BlogPanel (existing)
│   ├── BrandingPanel (existing)
│   ├── SeoPanel (existing)
│   └── DomainsPanel (existing)
```

---

## 2. Component Specifications

### LandingEditor (NEW — replaces PageEditor for LANDING pages)

**Purpose:** Fullscreen 3-panel editor for landing pages.

**Props:**
```tsx
interface LandingEditorProps {
  page: { id: string; title: string; slug: string }
  onBack: () => void
}
```

**State:**
```tsx
const [sections, setSections] = useState<Section[]>([])        // Local working copy
const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
const [history, setHistory] = useState<Section[][]>([])        // Undo stack
const [historyIndex, setHistoryIndex] = useState(-1)           // Current position
const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
const [saving, setSaving] = useState(false)
const [showPreview, setShowPreview] = useState(false)
const [showTemplates, setShowTemplates] = useState(false)
const [showAddSection, setShowAddSection] = useState(false)
const [showSEO, setShowSEO] = useState(false)
const [showTheme, setShowTheme] = useState(false)
```

**Data flow:**
1. On mount: fetch page + sections from `/api/data/page-sections?pageId={id}`
2. Store in local `sections` state (working copy)
3. On edit: update local state + push to history + debounced auto-save to API
4. On preview: render from local `sections` (not from API — shows latest changes)
5. On publish: save all → set status PUBLISHED

**Key difference from existing PageEditor:**
- Existing editor: edits save to API immediately, preview reads from API (stale)
- New editor: edits update local state first, auto-save to API in background, preview reads from local state (always latest)

---

### EditorToolbar

**Purpose:** Top toolbar with undo/redo, AI, preview, publish.

**Layout:**
```
[← Back] [Undo] [Redo] | Page Title + slug | [Auto-saved ✓] | [Desktop][Tablet][Mobile] | [AI] [Preview] [Publish]
```

**Buttons:**

| Button | Action | Disabled when |
|--------|--------|---------------|
| Back | `onBack()` | Never |
| Undo | Pop history stack | `historyIndex <= 0` |
| Redo | Push history forward | `historyIndex >= history.length - 1` |
| AI Assistant | Opens AI panel for selected section | No section selected |
| Preview | Opens PreviewModal | Never |
| Publish | Save all + set status PUBLISHED | `saving === true` |

---

### NavigatorPanel (left sidebar)

**Purpose:** Section tree with drag-reorder and quick actions.

**Layout:**
```
┌─────────────────────┐
│ NAVIGATOR        [×]│
├─────────────────────┤
│ ⠿ 🏠 Hero         ⋮ │ ← drag handle + section icon + name + menu
│ ⠿ ✨ Features      ⋮ │
│ ⠿ 💰 Pricing       ⋮ │ ← selected (highlighted)
│ ⠿ ❓ FAQ           ⋮ │
│ ⠿ 📢 CTA          ⋮ │
│ ⠿ 📝 Footer        ⋮ │
├─────────────────────┤
│ [+ Add Section]     │
└─────────────────────┘
```

**Each SectionNode has:**

| Action | Icon | Implementation |
|--------|------|---------------|
| Drag reorder | GripVertical | HTML5 drag-and-drop or `@dnd-kit/sortable` (already in deps) |
| Click select | Section name | `setSelectedSectionId(id)` |
| Duplicate | Copy icon | API: `PUT /api/data/page-sections { id, action: 'duplicate' }` |
| Hide/Show | Eye/EyeOff icon | API: `PUT /api/data/page-sections { id, isHidden: !isHidden }` |
| Delete | Trash icon | API: `DELETE /api/data/page-sections?id={id}` (with confirm) |

**Drag reorder implementation:**
- Use `@dnd-kit/sortable` (already in `package.json`)
- On drop: call `POST /api/data/page-sections/reorder` with new order
- Optimistic update: reorder local state immediately, rollback on error

---

### CanvasPanel (center)

**Purpose:** Live preview of the page with hover actions and inline editing.

**Layout:**
```
┌──────────────────────────────────┐
│                                  │
│    [Section 1: Hero]             │ ← hover shows action bar
│    ┌────────────────────────┐    │
│    │ Edit | Duplicate | Hide│    │
│    │ Delete | AI            │    │
│    └────────────────────────┘    │
│                                  │
│    [Section 2: Features]         │
│                                  │
│    [Section 3: Pricing]          │ ← selected (ring-2 ring-primary)
│                                  │
└──────────────────────────────────┘
```

**Viewport widths:**

| Mode | Width | CSS |
|------|-------|-----|
| Desktop | 100% | `max-w-none` |
| Tablet | 768px | `max-w-[768px] mx-auto` |
| Mobile | 375px | `max-w-[375px] mx-auto` |

**Section hover actions:**
Appear as a floating toolbar above the section on hover:

| Action | Icon | Behavior |
|--------|------|----------|
| Edit | Pencil | Selects section + scrolls to it in Inspector |
| Duplicate | Copy | API duplicate + insert after |
| Hide | EyeOff | Toggle `isHidden` |
| Delete | Trash | Confirm → API delete |
| AI | Sparkles | Opens AI panel for this section |

**Inline text editing:**
- Any text element in the canvas has `contentEditable={true}`
- On blur: extract text → update section content → auto-save
- Visual feedback: subtle blue outline on hover, solid blue on focus
- No popup editors — type directly in the canvas

```tsx
function InlineText({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [editing, setEditing] = useState(false)

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => { onChange(e.currentTarget.textContent || ''); setEditing(false) }}
      onFocus={() => setEditing(true)}
      className={cn(className, 'outline-none rounded px-0.5 transition', editing ? 'ring-2 ring-primary/40 bg-primary/5' : 'hover:ring-1 hover:ring-primary/20')}
    >
      {value}
    </span>
  )
}
```

---

### SectionRenderer

**Purpose:** Renders a section based on its type.

**Switch on `section.type`:**

```tsx
function SectionRenderer({ section, isEditing }: { section: Section; isEditing: boolean }) {
  switch (section.type) {
    case 'HERO': return <HeroRenderer content={section.content} isEditing={isEditing} />
    case 'VIDEO_HERO': return <VideoHeroRenderer content={section.content} isEditing={isEditing} />
    case 'SPLIT_HERO': return <SplitHeroRenderer content={section.content} isEditing={isEditing} />
    case 'FEATURES': return <FeaturesRenderer content={section.content} isEditing={isEditing} />
    case 'BENEFITS': return <BenefitsRenderer content={section.content} isEditing={isEditing} />
    case 'PRICING': return <PricingRenderer content={section.content} isEditing={isEditing} />
    case 'TESTIMONIALS': return <TestimonialsRenderer content={section.content} isEditing={isEditing} />
    case 'FAQ': return <FAQRenderer content={section.content} isEditing={isEditing} />
    case 'CTA': return <CTARenderer content={section.content} isEditing={isEditing} />
    case 'NEWSLETTER': return <NewsletterRenderer content={section.content} isEditing={isEditing} />
    case 'COUNTDOWN': return <CountdownRenderer content={section.content} isEditing={isEditing} />
    case 'GUARANTEE': return <GuaranteeRenderer content={section.content} isEditing={isEditing} />
    case 'STATS': return <StatsRenderer content={section.content} isEditing={isEditing} />
    case 'LOGOS': return <LogosRenderer content={section.content} isEditing={isEditing} />
    case 'GALLERY': return <GalleryRenderer content={section.content} isEditing={isEditing} />
    case 'VIDEO': return <VideoRenderer content={section.content} isEditing={isEditing} />
    case 'TEAM': return <TeamRenderer content={section.content} isEditing={isEditing} />
    case 'COMPARISON': return <ComparisonRenderer content={section.content} isEditing={isEditing} />
    case 'TIMELINE': return <TimelineRenderer content={section.content} isEditing={isEditing} />
    case 'ROADMAP': return <RoadmapRenderer content={section.content} isEditing={isEditing} />
    case 'ACCORDION': return <AccordionRenderer content={section.content} isEditing={isEditing} />
    case 'FEATURES_TABS': return <FeaturesTabsRenderer content={section.content} isEditing={isEditing} />
    case 'LATEST_COURSES': return <DynamicBlockRenderer type="LATEST_COURSES" content={section.content} />
    case 'FEATURED_PRODUCTS': return <DynamicBlockRenderer type="FEATURED_PRODUCTS" content={section.content} />
    case 'LATEST_BLOG': return <DynamicBlockRenderer type="LATEST_BLOG" content={section.content} />
    case 'COMMUNITY_FEED': return <DynamicBlockRenderer type="COMMUNITY_FEED" content={section.content} />
    case 'UPCOMING_EVENTS': return <DynamicBlockRenderer type="UPCOMING_EVENTS" content={section.content} />
    case 'HEADING': return <HeadingRenderer content={section.content} isEditing={isEditing} />
    case 'TEXT': return <TextRenderer content={section.content} isEditing={isEditing} />
    case 'SPACER': return <SpacerRenderer content={section.content} />
    case 'DIVIDER': return <DividerRenderer content={section.content} />
    case 'FOOTER': return <FooterRenderer content={section.content} isEditing={isEditing} />
    default: return <div>Unknown section: {section.type}</div>
  }
}
```

Each renderer:
- Reads `content` fields
- When `isEditing` is true: wraps text in `<InlineText>` components
- When `isEditing` is false: renders as plain HTML (for preview/published)

---

### InspectorPanel (right sidebar)

**Purpose:** Context-sensitive settings for the selected section.

**Tabs:**

| Tab | Content |
|-----|---------|
| Content | Section-specific fields (headline, items, plans, etc.) |
| Style | Background, spacing, animation |
| SEO | Section-level SEO (heading tags, alt text) |

**Content tab example (Hero):**
```
Content
├── Headline:     [_____________________]
├── Subheadline:  [_____________________]
├── CTA Text:     [________]  CTA URL: [________]
├── CTA Secondary:[________]  URL:     [________]
└── Emoji:        [____]
```

**Style tab:**
```
Style
├── Background: ○ None ○ Color ○ Gradient ○ Image
├── Padding Y:  [sm] [md] [lg] [xl]
├── Animation:  [None] [Fade] [Slide Up] [Zoom]
└── Visibility: ☑ Desktop  ☑ Tablet  ☑ Mobile
```

---

### AIPanel

**Purpose:** AI actions for the selected section.

**Layout:**
```
┌─────────────────────────┐
│ AI ASSISTANT            │
├─────────────────────────┤
│ Rewrite                 │
│ Improve                 │
│ Shorten                 │
│ Expand                  │
│ SEO Optimize            │
│ Translate (ES)          │
├─────────────────────────┤
│ STYLE                   │
│ More Professional       │
│ More Emotional          │
│ Luxury Style            │
│ Startup Style           │
├─────────────────────────┤
│ [Generate Pricing]      │ ← section-specific actions
│ [Create FAQ]            │
│ [Write Guarantee]       │
└─────────────────────────┘
```

Each button calls `POST /api/ai/section-rewrite` with the appropriate action.

---

### LandingWizard (NEW — replaces LandingGenerator)

**Purpose:** Multi-step wizard for AI landing page generation.

**Steps:**
1. **Business** — "What are you selling?" (textarea)
2. **Goal** — Lead Generation | Sales | Course | Product | Agency | Newsletter | Webinar | Event | Coaching
3. **Style** — Minimal | Modern | Startup | Luxury | Dark | Apple | Corporate
4. **Color** — Primary color picker (preset swatches + custom)
5. **Logo** — Optional logo upload (or skip)
6. **Generate** — AI creates the page with selected style + color

**Implementation:**
- Multi-step form with `framer-motion` transitions
- On "Generate": calls `POST /api/ai/landing-page` with `{ selling, category, style, primaryColor }`
- API generates 7 sections + applies theme
- On success: opens LandingEditor with the new page

---

### ThemeSwitcher

**Purpose:** One-click theme switch.

**Layout:**
```
┌─────────────────────────┐
│ CHOOSE A THEME           │
├─────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐│
│ │Modern│ │Mini │ │Glass││
│ └─────┘ └─────┘ └─────┘│
│ ┌─────┐ ┌─────┐ ┌─────┐│
│ │Corp │ │Create│ │Luxry││
│ └─────┘ └─────┘ └─────┘│
│ ┌─────┐ ┌─────┐        │
│ │Dark │ │Start│        │
│ └─────┘ └─────┘        │
└─────────────────────────┘
```

Clicking a theme:
1. Updates `Page.theme` via `PUT /api/data/pages { id, theme: JSON.stringify(themeObj) }`
2. Updates CSS variables on the canvas wrapper
3. All sections re-render with the new theme

---

### AddSectionModal (enhanced)

**Purpose:** Browse and insert from 40 section types.

**Layout:**
```
┌──────────────────────────────────────┐
│ Add a Section                    [×] │
├──────────────────────────────────────┤
│ [All] [Hero] [Content] [Social] [CTA]│ ← category filters
├──────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐          │
│ │ Hero │ │Video │ │Split │          │
│ │      │ │Hero  │ │Hero  │          │
│ └──────┘ └──────┘ └──────┘          │
│ ┌──────┐ ┌──────┐ ┌──────┐          │
│ │Feature│ │Benefit│ │Pricing│        │
│ └──────┘ └──────┘ └──────┘          │
│ ...                                  │
├──────────────────────────────────────┤
│ DYNAMIC BLOCKS                       │
│ ┌──────┐ ┌──────┐ ┌──────┐          │
│ │Latest│ │Feature│ │Latest│          │
│ │Course│ │Product│ │Blog  │          │
│ └──────┘ └──────┘ └──────┘          │
├──────────────────────────────────────┤
│ REUSABLE BLOCKS                      │
│ ┌──────┐ ┌──────┐                   │
│ │My Hero│ │My CTA│                   │
│ └──────┘ └──────┘                   │
└──────────────────────────────────────┘
```

---

## 3. Existing Components (keep, no changes)

| Component | Status |
|-----------|--------|
| PreviewModal | ✅ Keep — renders sections in modal |
| TemplatesModal | ✅ Keep — 6 prebuilt templates |
| SEOEditorDialog | ✅ Keep — title/description + search preview |
| SeoPanel | ✅ Keep |
| DomainsPanel | ✅ Keep |
| BlogPanel | ✅ Keep |
| NavigationPanel | ✅ Keep |
| SiteSettingsPanel | ✅ Keep (Branding tab) |
| HomePanel | ✅ Keep |

---

## 4. New Components Summary

| Component | Priority | Lines (est.) |
|-----------|----------|-------------|
| LandingEditor | P0 | ~400 |
| EditorToolbar | P0 | ~80 |
| NavigatorPanel | P0 | ~150 |
| CanvasPanel | P0 | ~100 |
| SectionRenderer | P0 | ~100 (switch) |
| 40 Section Renderers | P0/P1 | ~2000 (50 each avg) |
| InspectorPanel | P0 | ~200 |
| AIPanel | P1 | ~100 |
| InlineText | P0 | ~30 |
| LandingWizard | P1 | ~200 |
| ThemeSwitcher | P2 | ~80 |
| DynamicBlockRenderer | P1 | ~150 |
| ReusableBlocksPanel | P2 | ~100 |

**Total estimated:** ~3,800 lines of new component code
