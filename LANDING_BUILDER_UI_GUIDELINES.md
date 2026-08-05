# LANDING_BUILDER_UI_GUIDELINES.md

**Date:** 2026-08-05
**Status:** UI/UX specification (no code changes)

---

## 1. Design Philosophy

**Clean. Fast. Professional. Like Shopify or Kajabi — not WordPress or Elementor.**

The landing builder should feel like the fastest AI-powered landing page builder for creators. Every interaction must be polished, approachable, and production-ready.

### Principles

1. **AI first** — AI generates 90%, creator customizes 10%
2. **Inline everything** — No popup editors for text; click and type
3. **Minimal chrome** — The canvas is the star, not the toolbar
4. **Progressive disclosure** — Show only what's needed for the selected element
5. **Instant feedback** — Every action has visual feedback within 100ms
6. **No design decisions** — The system handles responsive, spacing, typography

---

## 2. Layout Specifications

### Fullscreen Editor

```
┌─────────────────────────────────────────────────────────────────┐
│  TOOLBAR (56px height)                                           │
├──────────┬──────────────────────────────────┬───────────────────┤
│          │                                  │                   │
│  NAV     │         CANVAS                   │    INSPECTOR      │
│  240px   │         flex-1                   │    360px          │
│          │                                  │                   │
│          │                                  │                   │
│          │                                  │                   │
│          │                                  │                   │
│          │                                  │                   │
├──────────┴──────────────────────────────────┴───────────────────┤
│  STATUS BAR (32px height)                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Dimensions

| Panel | Width | Collapsible to | Min Width |
|-------|-------|---------------|-----------|
| Navigator | 240px | 48px (icons only) | 48px |
| Canvas | flex-1 | N/A | 400px |
| Inspector | 360px | 0px (hidden) | 320px |

### Responsive Breakpoints (editor itself)

| Viewport | Navigator | Inspector | Canvas |
|----------|-----------|-----------|--------|
| Desktop (>1280px) | 240px visible | 360px visible | flex-1 |
| Laptop (1024-1280px) | 240px visible | 320px visible | flex-1 |
| Tablet (768-1024px) | Collapsed (48px) | Collapsed (overlay) | flex-1 |
| Mobile (<768px) | Hidden (hamburger) | Hidden (overlay) | full width |

---

## 3. Toolbar

### Layout

```
[← Back] [Undo] [Redo] │ Page Title /slug │ [Auto-saved ✓] │ [💻][📱][📲] │ [AI] [Preview] [Publish]
```

### Button specs

| Button | Icon | Size | Variant | Disabled state |
|--------|------|------|---------|---------------|
| Back | ArrowLeft | sm | ghost | Never |
| Undo | Undo2 | sm | ghost | `historyIndex <= 0` → opacity 30% |
| Redo | Redo2 | sm | ghost | `historyIndex >= max` → opacity 30% |
| AI | Sparkles | sm | outline | When no section selected |
| Preview | Eye | sm | outline | Never |
| Publish | Globe | sm | default | When `saving === true` |

### Auto-saved indicator

| State | Visual |
|-------|--------|
| Saving | `<Loader2 className="h-3 w-3 animate-spin" /> Saving...` (text-muted-foreground) |
| Saved | `<Check className="h-3 w-3" /> Auto-saved` (text-emerald-600) |
| Error | `<AlertCircle className="h-3 w-3" /> Save failed` (text-rose-500) |

### Responsive toggle

Three buttons in a segmented control:

```
┌───────┬───────┬───────┐
│ 💻    │ 📱    │ 📲    │
│Desktop│ Tablet│ Mobile│
└───────┴───────┴───────┘
```

Selected button has `bg-background shadow-sm`. Unselected has `text-muted-foreground`.

---

## 4. Navigator Panel (Left)

### Section tree

```
┌─────────────────────────────┐
│ NAVIGATOR              [×]  │
├─────────────────────────────┤
│ ⠿ 🏠  Hero               ⋮ │
│ ⠿ ✨  Features            ⋮ │
│ ⠿ 💰  Pricing    ← sel.  ⋮ │ ← bg-primary/10, text-primary
│ ⠿ ❓  FAQ                ⋮ │
│ ⠿ 📢  CTA               ⋮ │
│ ⠿ 👥  Testimonials       ⋮ │
│ ⠿ 📝  Footer             ⋮ │
├─────────────────────────────┤
│       [+ Add Section]       │
└─────────────────────────────┘
```

### Section node

| Element | Spec |
|---------|------|
| Drag handle | `GripVertical` icon, `cursor-grab`, `text-muted-foreground/50` |
| Section icon | 16px, from SECTION_TYPES metadata |
| Section name | `text-sm font-medium`, truncate if long |
| Visibility indicator | EyeOff icon if hidden (opacity 50%) |
| More menu (⋮) | Dropdown: Duplicate, Hide/Show, Save as Reusable, Delete |

### Interactions

| Action | Implementation |
|--------|---------------|
| Click section | Select in canvas + inspector |
| Drag section | Reorder (dnd-kit sortable) |
| Hover | `bg-muted/50` background |
| Selected | `bg-primary/10 text-primary` background |
| Hidden section | `opacity-50` + EyeOff icon |

### Collapsed state (48px)

Shows only icons. Hover shows tooltip with section name.

---

## 5. Canvas (Center)

### Section rendering

Each section is rendered in a container:

```html
<div class="group relative section-container">
  <!-- Hover action bar (appears on hover) -->
  <div class="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 rounded-lg border bg-card shadow-md px-1 py-0.5 z-10">
    <button>Edit</button>
    <button>Duplicate</button>
    <button>Hide</button>
    <button>Delete</button>
    <button>AI</button>
  </div>

  <!-- Section content -->
  <div class="section-content">
    <SectionRenderer section={s} isEditing={true} />
  </div>

  <!-- Selected ring -->
  <!-- Applied when selected: ring-2 ring-primary ring-inset -->
</div>
```

### Hover action bar

```
┌──────────────────────────────────────────┐
│ ✏️ Edit  📋 Duplicate  👁 Hide  🗑 Delete  ✨ AI │
└──────────────────────────────────────────┘
```

| Button | Icon | Size | Color |
|--------|------|------|-------|
| Edit | Pencil | 14px | text-muted-foreground |
| Duplicate | Copy | 14px | text-muted-foreground |
| Hide | EyeOff | 14px | text-muted-foreground |
| Delete | Trash2 | 14px | text-rose-500 |
| AI | Sparkles | 14px | text-primary |

### Selected state

- `ring-2 ring-primary ring-inset` on the section container
- Inspector panel updates to show this section's settings

### Hidden section

- `opacity-40` on the section container
- Shows a "Hidden" badge in the top-left corner

### Empty page state

```
┌──────────────────────────────────────┐
│                                      │
│         📄                           │
│                                      │
│    No sections yet                   │
│    Add your first section to start   │
│                                      │
│    [+ Add Section]                   │
│                                      │
│    or [✨ Generate with AI]          │
│                                      │
└──────────────────────────────────────┘
```

---

## 6. Inline Text Editing

### How it works

1. User clicks any text in the canvas
2. The text element gets `contentEditable={true}`
3. A subtle blue ring appears: `ring-2 ring-primary/40 bg-primary/5`
4. User types — no popup, no toolbar, just type
5. On blur: text is saved to section content + auto-saved to API

### Visual states

| State | Style |
|-------|-------|
| Default | No outline, normal text |
| Hover | `hover:ring-1 hover:ring-primary/20` + `cursor-text` |
| Editing (focused) | `ring-2 ring-primary/40 bg-primary/5` |
| Saved | Brief `ring-2 ring-emerald-500/40` flash (200ms) |

### Implementation

```tsx
<span
  contentEditable
  suppressContentEditableWarning
  className="outline-none rounded px-0.5 transition cursor-text
    hover:ring-1 hover:ring-primary/20
    focus:ring-2 focus:ring-primary/40 focus:bg-primary/5"
  onBlur={(e) => {
    const newText = e.currentTarget.textContent || ''
    onChange(newText)
    // Flash green
    e.currentTarget.classList.add('ring-2', 'ring-emerald-500/40')
    setTimeout(() => e.currentTarget.classList.remove('ring-2', 'ring-emerald-500/40'), 200)
  }}
>
  {value}
</span>
```

### What's editable inline

| Section | Editable fields |
|---------|----------------|
| Hero | headline, subheadline, ctaText |
| Heading | text |
| Text | text |
| Features | heading, subheading, item titles + descriptions |
| Benefits | heading, item titles + descriptions |
| Pricing | heading, plan names, features |
| Testimonials | heading, names, roles, quotes |
| FAQ | heading, questions, answers |
| CTA | headline, subtext, ctaText |
| Stats | values, labels |
| Guarantee | heading, text |
| Footer | brand, tagline |

---

## 7. Inspector Panel (Right)

### Layout

```
┌─────────────────────────────┐
│ INSPECTOR              [×]  │
├─────────────────────────────┤
│ [Content] [Style] [SEO]     │ ← tabs
├─────────────────────────────┤
│                             │
│  HEADLINE                   │
│  [_____________________]    │
│                             │
│  SUBHEADLINE                │
│  [_____________________]    │
│                             │
│  CTA TEXT                   │
│  [_________]                │
│                             │
│  CTA URL                    │
│  [_________]                │
│                             │
├─────────────────────────────┤
│ AI ASSISTANT                │
│ ┌─────────────────────────┐ │
│ │ ✨ Rewrite              │ │
│ │ ✨ Improve              │ │
│ │ ✨ Shorten              │ │
│ │ ✨ Expand               │ │
│ │ ✨ SEO Optimize         │ │
│ │ ✨ Translate            │ │
│ ├─────────────────────────┤ │
│ │ STYLE                   │ │
│ │ Professional            │ │
│ │ Emotional               │ │
│ │ Luxury                  │ │
│ │ Startup                 │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### Tab: Content

Shows section-specific form fields. Each field is a labeled Input or Textarea.

**Field specs:**
- Label: `text-xs font-medium text-muted-foreground` (uppercase)
- Input: `h-8 text-sm` (compact)
- Textarea: `rows={2} text-sm`
- Spacing between fields: `space-y-3`

### Tab: Style

| Control | Type | Options |
|---------|------|---------|
| Background | Radio | None, Color, Gradient, Image |
| Padding Y | Segmented | sm, md, lg, xl |
| Animation | Select | None, Fade, Slide Up, Zoom, Bounce |
| Visibility | Checkboxes | Desktop, Tablet, Mobile |

### Tab: SEO

| Control | Type |
|---------|------|
| Heading tag | Select (h1, h2, h3, h4) |
| Alt text (for images) | Input |
| Schema type | Select (None, Product, Course, Article, FAQ) |

### When no section is selected

```
┌─────────────────────────────┐
│                             │
│         🎨                  │
│                             │
│    Select a section         │
│    to edit its content      │
│                             │
│    Or click AI to generate  │
│    content automatically    │
│                             │
└─────────────────────────────┘
```

---

## 8. AI Panel

### Location

Embedded at the bottom of the Inspector panel (below the form fields).

### Layout

```
┌─────────────────────────────┐
│ AI ASSISTANT       ✨       │
├─────────────────────────────┤
│ [✨ Rewrite              ]  │
│ [✨ Improve              ]  │
│ [✨ Shorten              ]  │
│ [✨ Expand               ]  │
│ [✨ SEO Optimize         ]  │
│ [🌐 Translate (ES)      ]  │
├─────────────────────────────┤
│ STYLE                       │
│ [Professional] [Emotional]  │
│ [Luxury] [Startup]          │
├─────────────────────────────┤
│ SECTION-SPECIFIC            │
│ [Generate Pricing]          │ ← only for PRICING
│ [Create FAQ]                │ ← only for FAQ
│ [Better Headline]           │ ← only for HERO
└─────────────────────────────┘
```

### Button states

| State | Style |
|-------|-------|
| Default | `text-primary hover:bg-primary/10` |
| Loading | `Loader2 animate-spin` + disabled |
| Success | Brief `bg-emerald-500/10` flash |

### Loading state

When an AI action is running:
- The button shows a spinner
- All other AI buttons are disabled
- The section in the canvas shows a subtle shimmer overlay

---

## 9. Landing Wizard

### Multi-step flow

```
┌──────────────────────────────────────────┐
│  Step 1 of 5: What are you selling?      │
│  ┌──────────────────────────────────────┐│
│  │ An AI course for creators who want  ││
│  │ to 10x their output...              ││
│  └──────────────────────────────────────┘│
│                                          │
│  Try: [AI course] [Canva templates]      │
│       [Coaching] [Membership]            │
│                                          │
│                          [Continue →]    │
└──────────────────────────────────────────┘
```

### Step indicators

```
●───●───○───○───○
 1   2   3   4   5
```

Filled dots = completed. Current dot = `bg-primary`. Future dots = `bg-muted`.

### Transitions

Each step transition uses `framer-motion`:
- Enter: `initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}`
- Exit: `exit={{ opacity: 0, x: -20 }}`

### Final step (Generate)

```
┌──────────────────────────────────────────┐
│  Generating your landing page...         │
│                                          │
│  ✅ Writing headline & hero              │
│  ✅ Crafting benefits & features         │
│  ⏳ Generating pricing & testimonials    │
│  ○ Building FAQ & CTA                    │
│  ○ Optimizing SEO                        │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ████████████░░░░░░░░░░  60%       │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

Progress steps animate in sequence with `delay: i * 1.5s`.

---

## 10. Theme Switcher

### Layout (modal)

```
┌──────────────────────────────────────┐
│ CHOOSE A THEME                  [×]  │
├──────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │ Modern │ │ Minimal│ │  Glass │    │
│ │  ████  │ │  ████  │ │  ████  │    │
│ │ #10b981│ │ #1e293b│ │ #8b5cf6│    │
│ └────────┘ └────────┘ └────────┘    │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │  Corp  │ │Creative│ │ Luxury │    │
│ │  ████  │ │  ████  │ │  ████  │    │
│ │ #2563eb│ │ #f59e0b│ │ #d4af37│    │
│ └────────┘ └────────┘ └────────┘    │
│ ┌────────┐ ┌────────┐               │
│ │  Dark  │ │Startup │               │
│ │  ████  │ │  ████  │               │
│ │ #10b981│ │ #3b82f6│               │
│ └────────┘ └────────┘               │
├──────────────────────────────────────┤
│ Selected: Modern                     │
│              [Apply Theme]           │
└──────────────────────────────────────┘
```

Each theme card shows:
- Theme name
- Color swatch (primary color)
- Mini preview (3-line gradient bar)

---

## 11. Add Section Modal

### Layout

```
┌──────────────────────────────────────────────┐
│ Add a Section                           [×]  │
├──────────────────────────────────────────────┤
│ [All] [Hero] [Content] [Social] [CTA] [Layout]│
├──────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │ 🏠   │ │ 🎬   │ │ ↔️   │ │ ✨   │         │
│ │ Hero │ │Video │ │Split │ │Feat. │         │
│ └──────┘ └──────┘ └──────┘ └──────┘         │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │ 💰   │ │ ❓   │ │ 📢   │ │ ⭐   │         │
│ │Price │ │ FAQ  │ │ CTA  │ │Testi.│         │
│ └──────┘ └──────┘ └──────┘ └──────┘         │
│ ...                                          │
├──────────────────────────────────────────────┤
│ DYNAMIC BLOCKS                               │
│ ┌──────┐ ┌──────┐ ┌──────┐                  │
│ │ 🎓   │ │ 📦   │ │ 📝   │                  │
│ │Latest│ │Featur│ │Latest│                  │
│ │Course│ │Prod. │ │Blog  │                  │
│ └──────┘ └──────┘ └──────┘                  │
├──────────────────────────────────────────────┤
│ REUSABLE BLOCKS                              │
│ ┌──────┐ ┌──────┐                           │
│ │ 💾   │ │ 💾   │                           │
│ │My Hero│ │My CTA│                          │
│ └──────┘ └──────┘                           │
└──────────────────────────────────────────────┘
```

### Section card

```
┌──────┐
│  🏠   │  ← icon (32px, centered)
│ Hero  │  ← name (text-xs font-medium)
│Headline│ ← description (text-[10px] text-muted-foreground)
└──────┘
```

Size: ~100px × 100px. Hover: `border-primary/40 bg-primary/5 scale-105`.

---

## 12. Color & Typography

### Colors (use existing Tailwind/shadcn variables)

| Element | Color |
|---------|-------|
| Primary actions | `bg-primary text-primary-foreground` |
| Secondary actions | `bg-secondary text-secondary-foreground` |
| Destructive | `bg-destructive text-destructive-foreground` |
| Canvas background | `bg-background` |
| Panel background | `bg-card` |
| Borders | `border-border` |
| Muted text | `text-muted-foreground` |
| Selected item | `bg-primary/10 text-primary` |

### Typography

| Element | Size | Weight |
|---------|------|--------|
| Page title | text-2xl | font-bold |
| Panel title | text-sm | font-semibold |
| Section name | text-sm | font-medium |
| Form label | text-xs | font-medium (uppercase) |
| Form input | text-sm | normal |
| Helper text | text-[10px] | normal |
| Button text | text-sm | font-medium |

### Spacing

| Element | Padding |
|---------|---------|
| Panel content | `p-3` |
| Card content | `p-4` |
| Form field gap | `space-y-3` |
| Button gap | `gap-2` |
| Section gap (canvas) | `gap-0` (sections are stacked, no gap) |

---

## 13. Animations

| Element | Animation | Duration |
|---------|-----------|----------|
| Section enter | `opacity: 0 → 1, y: 4 → 0` | 200ms |
| Hover action bar | `opacity: 0 → 1` | 150ms |
| Panel collapse/expand | `width: 240px → 48px` | 300ms ease-in-out |
| Step transition (wizard) | `opacity + x: 20 → 0` | 200ms |
| AI loading shimmer | `background-position` animation | 2s infinite |
| Publish success | `scale: 0.95 → 1` + confetti emoji 🎉 | 400ms |

---

## 14. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation | All buttons are `<button>` with proper `aria-label` |
| Focus rings | `focus:ring-2 focus:ring-primary` on all interactive elements |
| Screen reader labels | `sr-only` text on icon-only buttons |
| Color contrast | All text meets WCAG AA (4.5:1) |
| Reduced motion | `prefers-reduced-motion` disables animations |
| ARIA roles | Navigator = `role="tree"`, sections = `role="treeitem"` |

---

## 15. What NOT to Build

| Feature | Why |
|---------|-----|
| Absolute positioning | Users don't need pixel control — sections stack vertically |
| CSS editor | Users don't need to write CSS |
| Margin/padding number inputs | Use segmented controls (sm/md/lg/xl) instead |
| Layer manager | The navigator IS the layer manager |
| Free canvas | Sections are vertically stacked — no free positioning |
| Responsive breakpoint editor | Layouts adapt automatically via Tailwind responsive classes |
| Custom fonts uploader | Themes handle fonts — users don't upload |
| Custom CSS classes | Themes handle styling — users don't write CSS |
| Code injection (per section) | Security risk; analytics go at page level only |
