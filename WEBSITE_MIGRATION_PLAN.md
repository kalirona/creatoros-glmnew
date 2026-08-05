# CreatorOS — Website Migration Plan

> **Document type**: Migration Plan & Rollback Strategy
> **Scope**: Migrate from page-builder to website-manager (non-destructive, incremental)
> **Audience**: Engineering, QA, Product
> **Status**: Proposed (v1.0)

---

## 1. Goals

Migrate CreatorOS from a **page-builder-focused tool** to an **AI-powered Creator Business Platform** where the website is generated from structured DB content.

### 1.1 Principles

1. **Non-destructive**: No existing data is lost.
2. **Incremental**: Ship in stages; each stage is independently deployable.
3. **Backward-compatible**: Existing pages with sections continue to render.
4. **Reversible**: Every stage has a rollback path.
5. **Auditable**: Every change has a verification step.
6. **User-communicated**: Creators are notified before visible changes.

---

## 2. What Is Preserved

| Asset | Status | Notes |
|---|---|---|
| `Page` model + data | **Preserved** | Gains new SEO fields; existing data unchanged |
| `PageSection` model + data | **Preserved** | `content` JSON redefined to content-only; legacy layout JSON rendered via adapter |
| `PageVersion` model + data | **Preserved** | Version history intact |
| `Funnel` model + data | **Preserved** | Moved to Automation module; data unchanged |
| `FunnelStep` model + data | **Preserved** | Moved with Funnel |
| `BlogPost` model + data | **Preserved** | Gains SEO fields |
| `Course` model + data | **Preserved** | Gains SEO fields |
| `Product` model + data | **Preserved** | Gains SEO fields |
| `SiteSetting` model + data | **Preserved** | Gains theme/navigation/footer/SEO fields |
| All 41 Prisma models | **Preserved** | None deleted; some gain new fields |
| Existing API routes | **Preserved** | `/api/data/pages`, `/api/data/page-sections`, etc. continue working |
| Existing admin modules | **Preserved** | Refactored, not deleted |

---

## 3. What Is Replaced

| Asset | Old | New |
|---|---|---|
| `PageEditor` component | Drag-and-drop canvas with manual section reordering, absolute positioning, custom CSS | Section-based form editor (choose section type → form → AI content fill → publish) |
| "Pages & Funnels" module | 8-tab mega-module | "Website" module (7 tabs) + Funnels moved to Automation |
| Sidebar `nav.ts` | Overview / Create & Sell / Audience / System | Dashboard / AI Studio / Create & Sell / Community / Customers / Website / Analytics / Media / Automation / Settings |
| Public frontend | (none — current app is admin-only) | New `(public)` route group with auto-generated pages |

---

## 4. Migration Stages

The migration is organized into **6 stages**, each independently shippable.

### Stage 1 — Database schema additions (non-breaking)

**Goal**: Add new fields to support SEO, theme, navigation, and public rendering.

**Changes**:
- Add to `Course`: `seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl`, `keywords`.
- Add to `Product`: `seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl`.
- Add to `BlogPost`: `seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl`.
- Add to `Page`: `seoTitle`, `seoDescription`, `ogImage`, `canonicalUrl`.
- Add to `SiteSetting`: `theme` (JSON), `navigation` (JSON), `footer` (JSON), `brandName`, `logoUrl`, `faviconUrl`, `tagline`, `seoDefaultTitle`, `seoDefaultDescription`, `seoDefaultOgImage`, `primaryDomain`, `robotsAllow`.

**Migration**:
- All new fields are **nullable / optional**.
- Prisma migration runs cleanly with no data backfill required.
- Existing rows continue to work — new fields default to `null`.

**Verification**:
- `npx prisma migrate dev` succeeds.
- All existing admin screens still render.
- All existing API endpoints still respond.

**Rollback**:
- Revert Prisma migration.
- (No data loss because new fields were empty.)

**Risk**: Low.

---

### Stage 2 — Update sidebar navigation (`nav.ts`)

**Goal**: Restructure the admin sidebar per `WEBSITE_NAVIGATION.md`.

**Changes**:
1. Rewrite `src/lib/nav.ts` with new structure:
   - Top-level: Dashboard, AI Studio, Analytics, Media Library, Automation.
   - Groups: Create & Sell, Community, Customers, Website, Settings.
2. Move "Pages & Funnels" module → "Website" module (rename file `pages-funnels.tsx` → `website.tsx`).
3. Update tabs in Website module: Home, Pages, Blog, Navigation, Branding, SEO, Domains.
4. Move Funnels tab → new Automation module.
5. Move Memberships → Customers group.
6. Move Certificates → Settings (templates); keep per-course issuance in Courses.
7. Move Support → Settings.
8. Move Super Admin → Settings (bottom, role-gated).
9. Update keyboard shortcuts in `command-palette.tsx`.
10. Add URL redirects for old admin URLs (see `WEBSITE_NAVIGATION.md` §15).

**Verification**:
- Every sidebar item leads to a working page.
- No dead buttons, no dead routes.
- Old admin URLs 308-redirect to new URLs.
- Keyboard shortcuts work.
- Role-gated items hidden for unauthorized users.
- Mobile drawer works.

**Rollback**:
- Revert `nav.ts`.
- Re-add old URL redirects to point back to old paths.

**Risk**: Medium. High surface area; need full click-test.

**Backward compatibility**:
- Old module component `pages-funnels.tsx` is renamed but kept functionally equivalent until Stage 4.
- Funnels tab is removed from Website but `Funnel` model + API unchanged.

---

### Stage 3 — Replace PageEditor with section-based form editor

**Goal**: Replace the drag-and-drop `PageEditor` with a form-based section editor.

**Changes**:
1. Build new `SectionEditor` component (form-based):
   - Choose section type from library (Hero, Features, Testimonials, Pricing, FAQ, CTA, Statistics, Logo Cloud, Gallery, Footer).
   - Form fields per section type.
   - Inline AI "✨ Generate" buttons per field.
   - Reorder sections via up/down arrows (not drag-and-drop).
   - Delete section.
   - Live preview pane (read-only, no editing in preview).
2. Update `PageSection.content` JSON schema to **content-only** (no layout fields).
3. Add **legacy adapter** that detects old layout JSON and renders it via the old `PageEditor` render path (read-only) so existing pages continue to display.
4. Add migration script: existing `PageSection.content` JSON is preserved as-is; new sections use content-only schema.
5. Add "Convert to new format" button on legacy pages (optional, creator-initiated).

**Legacy adapter rules**:
- If `PageSection.content` contains layout fields (`x`, `y`, `width`, `height`, `css`, `columnSpan`), render via legacy renderer (read-only).
- If `PageSection.content` contains only content fields, render via `SectionRenderer`.
- Editor shows a banner on legacy pages: "This page uses the legacy page builder. Convert to the new section editor."

**Verification**:
- Existing pages render unchanged on public site (Stage 5) and admin preview.
- New pages created with section editor save and render correctly.
- "Convert to new format" produces equivalent rendering.
- No data loss in conversion.

**Rollback**:
- Re-enable `PageEditor` component.
- Hide `SectionEditor`.
- Legacy adapter remains; no data lost.

**Risk**: High. Core UX change; needs thorough QA.

**Backward compatibility**:
- Existing `PageSection` rows with legacy layout JSON continue to render.
- `PageVersion` snapshots are preserved.
- No data migration required for existing content.

---

### Stage 4 — Rename "Pages & Funnels" module to "Website" module

**Goal**: Complete the rename and tab restructure.

**Changes**:
1. Rename `src/components/modules/pages-funnels.tsx` → `src/components/modules/website.tsx`.
2. Update internal tabs:
   - Remove: Landing Pages, Funnels, Site Settings (consolidated).
   - Add: Home (new), Branding (from Site Settings), SEO (from Site Settings).
   - Keep: Pages, Blog, Navigation, Domains.
3. Update breadcrumb + page title.
4. Update `create-dialog.tsx` to offer "New Page", "New Blog Post", "Generate Homepage".
5. Update command palette entries.
6. Remove "Edit CSS" button, "Design Mode" toggle, drag handles from any remaining UI.

**Verification**:
- All 7 Website tabs work.
- No "Landing Pages" tab anywhere.
- No drag-and-drop UI anywhere in Website module.
- No "Edit CSS" button.
- Branding tab edits `SiteSetting.theme` and applies globally.
- SEO tab edits `SiteSetting.seoDefault*` + per-route overrides.

**Rollback**:
- Restore old filename + tabs.

**Risk**: Medium.

---

### Stage 5 — Add public frontend + auto-generation APIs

**Goal**: Add the public-facing website that renders from DB content.

**Changes**:
1. Create `(public)` route group in `src/app/(public)/`.
2. Add public layout with `Header` + `Footer` from `SiteSetting`.
3. Add public resolvers in `src/lib/public-resolvers/`:
   - `home.ts`, `courses-list.ts`, `course-detail.ts`, `store-list.ts`, `product-detail.ts`, `community.ts`, `membership.ts`, `blog-list.ts`, `blog-detail.ts`, `custom-page.ts`, `site-shell.ts`.
4. Add public routes:
   - `/` (home)
   - `/courses`, `/courses/[slug]`
   - `/store`, `/store/[slug]`
   - `/community`, `/community/[space]`, `/community/[space]/[post]`
   - `/membership`
   - `/blog`, `/blog/[slug]`, `/blog/category/[cat]`, `/blog/tag/[tag]`
   - `/[slug]` (custom page catch-all)
   - `/sitemap.xml`, `/robots.txt`
5. Add auto-generation APIs (server-side, called by resolvers):
   - `src/app/api/public/courses/[slug]/route.ts` (read-only, cached)
   - `src/app/api/public/products/[slug]/route.ts`
   - `src/app/api/public/blog/[slug]/route.ts`
   - `src/app/api/public/community/route.ts`
   - `src/app/api/public/page/[slug]/route.ts`
6. Add JSON-LD components (`src/components/public/seo/JsonLd.tsx`).
7. Add `sitemap.ts` and `robots.ts` generators.
8. Configure ISR per route via `export const revalidate`.
9. Configure Next.js rewrites for custom domains → `(public)` route group.

**Admin route conflict resolution**:
- Admin routes move to `/app/*` prefix (e.g. `/app/courses`, `/app/website/home`).
- Public routes stay at root (`/courses`, `/store`, `/blog`).
- This cleanly separates admin and public.
- Existing admin URLs 308-redirect to `/app/*`.

**Verification**:
- Public home page renders from `Page(slug="home")`.
- `/courses/[slug]` renders from `Course` data.
- `/store/[slug]` renders from `Product` data.
- `/blog/[slug]` renders from `BlogPost` data.
- `/[slug]` renders custom pages.
- Sitemap includes all published content.
- robots.txt blocks `/app/*` and `/api/*`.
- JSON-LD validates on all detail pages.
- Lighthouse SEO ≥ 95 on home + a sample course/product/blog.
- LCP < 1.5s on mobile.

**Rollback**:
- Disable `(public)` route group (remove from build).
- Restore old admin route paths.
- Public site returns 404 (acceptable rollback — no public site existed before).

**Risk**: High. Largest single stage; new code surface.

**Backward compatibility**:
- Admin functionality unchanged (just moved to `/app/*`).
- All existing API endpoints continue working.
- All existing data continues to render.

---

### Stage 6 — Verify, polish, communicate

**Goal**: Final verification and rollout.

**Checks**:
1. **No broken navigation**: Click every sidebar item.
2. **No dead buttons**: Click every button on every admin screen.
3. **No dead routes**: Crawl all `/app/*` and public routes.
4. **Old URLs redirect**: Test all redirects in `WEBSITE_NAVIGATION.md` §15.
5. **Existing pages render**: Visit every existing `Page` and confirm it renders.
6. **Existing funnels work**: Visit every existing `Funnel` and confirm it works.
7. **SEO validates**: Run Structured Data Test on home + 1 course + 1 product + 1 blog.
8. **Performance**: Lighthouse on home + sample course + sample blog.
9. **Mobile**: Test sidebar drawer, public pages on mobile viewport.
10. **Role gating**: Test as member, admin, super-admin.
11. **AI generation**: Test "Generate Website", "Generate Page", "Generate Section".
12. **Keyboard shortcuts**: Test all `g <key>` combos.

**Communication**:
- In-app banner 2 weeks before: "CreatorOS is evolving — your content is safe."
- Email to creators 1 week before with summary of changes.
- On launch day: dashboard announcement + link to changelog.
- Support docs updated with new screenshots.

**Rollback**:
- Feature-flag the entire migration (`FEATURE_FLAG_NEW_WEBSITE`).
- If critical issues, flip flag → reverts to old UI.
- Database changes (new fields) remain (they're additive and unused by old UI).

---

## 5. Detailed Migration Steps (Per Stage)

### Stage 1 — Detailed steps

1. Create branch `feature/website-stage-1-schema`.
2. Edit `prisma/schema.prisma`:
   - Add fields to `Course`, `Product`, `BlogPost`, `Page`, `SiteSetting`.
   - All new fields optional.
3. Run `npx prisma migrate dev --name website_stage1_schema`.
4. Run `npx prisma generate`.
5. Update API endpoints to accept new fields (all optional):
   - `/api/data/courses/route.ts`
   - `/api/data/products/route.ts`
   - `/api/data/blog/route.ts`
   - `/api/data/pages/route.ts`
   - `/api/data/site-settings/route.ts`
6. Add Zod validators for new fields.
7. Run existing test suite — all should pass (additive change).
8. Deploy.

### Stage 2 — Detailed steps

1. Create branch `feature/website-stage-2-nav`.
2. Rewrite `src/lib/nav.ts` per `WEBSITE_NAVIGATION.md` §9.1.
3. Rename `src/components/modules/pages-funnels.tsx` → `src/components/modules/website.tsx` (keep functionality for now).
4. Update `src/components/app/sidebar.tsx` to render new structure.
5. Update `src/components/app/command-palette.tsx` with new shortcuts.
6. Add redirect map in `next.config.ts`:
   - `/pages-funnels` → `/app/website/home`
   - `/pages-funnels?tab=blog` → `/app/website/blog`
   - (etc., per §15 of WEBSITE_NAVIGATION.md)
7. Move `certificates.tsx` access to Settings (update nav only).
8. Move `support.tsx` access to Settings.
9. Move `admin.tsx` (super admin) to Settings → Super Admin.
10. Add role-gating in nav renderer.
11. Click-test every sidebar item.
12. Deploy.

### Stage 3 — Detailed steps

1. Create branch `feature/website-stage-3-section-editor`.
2. Build `src/components/website/SectionEditor.tsx`:
   - Section type picker.
   - Form per section type (in `section-forms/`).
   - AI generate buttons per field.
   - Up/down/delete controls.
   - Live preview pane.
3. Build `src/components/public/SectionRenderer.tsx` (renderer, no editing).
4. Build legacy adapter `src/components/public/LegacySectionAdapter.tsx`.
5. Add `convertToNewFormat` server action.
6. Replace `PageEditor` usage in `website.tsx` with `SectionEditor`.
7. Keep `PageEditor.tsx` file in repo for legacy render path (read-only).
8. Add tests for both new and legacy rendering.
9. Deploy behind `FEATURE_FLAG_SECTION_EDITOR` flag.
10. Enable for internal workspace; QA.
11. Enable for all.

### Stage 4 — Detailed steps

1. Create branch `feature/website-stage-4-module-rename`.
2. Update `website.tsx` tabs: Home, Pages, Blog, Navigation, Branding, SEO, Domains.
3. Build `Home` tab (edit `Page(slug="home")` sections).
4. Build `Branding` tab (edit `SiteSetting.theme`, logo, colors, fonts).
5. Build `SEO` tab (edit `SiteSetting.seoDefault*`, per-route overrides, sitemap status).
6. Remove `Landing Pages`, `Funnels`, `Site Settings` tabs.
7. Remove drag handles, "Edit CSS" buttons, "Design Mode" toggles.
8. Update `create-dialog.tsx`.
9. Update command palette.
10. Click-test all 7 tabs.
11. Deploy.

### Stage 5 — Detailed steps

1. Create branch `feature/website-stage-5-public-frontend`.
2. Move admin routes to `/app/*`:
   - Update `src/app/(admin)/` → `src/app/app/*` (or use route group `(admin)` mounted at `/app`).
   - Update all internal links.
   - Add redirects from old paths to `/app/*`.
3. Create `src/app/(public)/`:
   - `layout.tsx` (header + footer + theme).
   - `page.tsx` (home).
   - `courses/page.tsx`, `courses/[slug]/page.tsx`.
   - `store/page.tsx`, `store/[slug]/page.tsx`.
   - `community/page.tsx`, etc.
   - `membership/page.tsx`.
   - `blog/page.tsx`, `blog/[slug]/page.tsx`, etc.
   - `[slug]/page.tsx` (catch-all custom page).
   - `sitemap.ts`, `robots.ts`.
4. Create `src/lib/public-resolvers/` modules.
5. Create `src/components/public/` components (per `PUBLIC_FRONTEND_PLAN.md` §11.2).
6. Configure ISR per route.
7. Configure multi-tenant domain resolution in middleware.
8. Add JSON-LD components.
9. Test all public routes locally.
10. Deploy to staging.
11. Lighthouse + Structured Data Test on staging.
12. Deploy to production behind `FEATURE_FLAG_PUBLIC_SITE` flag.
13. Enable per-workspace (gradual rollout).

### Stage 6 — Detailed steps

1. Run full QA checklist (see Stage 6 §Checks).
2. Fix any issues found.
3. Update support docs + screenshots.
4. Schedule launch email.
5. Enable feature flag for all workspaces.
6. Monitor error rate, support tickets, Lighthouse scores for 1 week.
7. After 1 week stable, remove old code paths (legacy `PageEditor` can stay as adapter).

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Existing pages break on public site | Medium | High | Legacy adapter; full QA on Stage 3 + 5 |
| Sidebar dead links | Medium | Medium | Click-test in Stage 2 |
| SEO regression | Low | High | Lighthouse + Structured Data Test in CI |
| Performance regression | Medium | High | Lighthouse gating in CI; SSG/ISR |
| Creator confusion | Medium | Medium | In-app banner + email + docs |
| Data loss | Very Low | Critical | All schema changes additive; no destructive migrations |
| AI generates poor SEO | Medium | Low | Creator can edit; AI is suggestion, not final |
| Domain resolution breaks | Low | High | Middleware tested in staging; gradual rollout |
| Old URLs not redirected | Medium | Medium | Redirect map tested in Stage 2 + 5 |
| Mobile UI breaks | Medium | Medium | Mobile testing in Stage 6 |

---

## 7. Rollback Plan

### 7.1 Per-stage rollback

| Stage | Rollback action | Data impact |
|---|---|---|
| 1 (schema) | Revert Prisma migration | None (additive only) |
| 2 (nav) | Revert `nav.ts`; restore old redirects | None |
| 3 (section editor) | Disable `FEATURE_FLAG_SECTION_EDITOR`; re-enable `PageEditor` | None |
| 4 (module rename) | Revert tab changes | None |
| 5 (public frontend) | Disable `FEATURE_FLAG_PUBLIC_SITE`; restore old admin paths | None |
| 6 (verify/launch) | Flip feature flags off | None |

### 7.2 Full rollback

If the entire migration must be rolled back:

1. Flip `FEATURE_FLAG_PUBLIC_SITE = false`.
2. Flip `FEATURE_FLAG_SECTION_EDITOR = false`.
3. Revert `nav.ts` to pre-migration state.
4. Restore old admin URL paths (remove `/app/*` prefix).
5. Re-enable `PageEditor` drag-and-drop.
6. Database schema additions remain (additive, harmless).

**No data is lost.** The migration is fully reversible.

### 7.3 Feature flag strategy

| Flag | Default | Controls |
|---|---|---|
| `FEATURE_FLAG_NEW_NAV` | Off → On (Stage 2) | New sidebar |
| `FEATURE_FLAG_SECTION_EDITOR` | Off → On (Stage 3) | New section editor |
| `FEATURE_FLAG_WEBSITE_MODULE` | Off → On (Stage 4) | Renamed Website module |
| `FEATURE_FLAG_PUBLIC_SITE` | Off → On (Stage 5) | Public frontend |
| `FEATURE_FLAG_AI_WEBSITE_GEN` | Off → On (Stage 6) | AI website generation |

Flags are stored in `FeatureFlag` model (already exists). Can be toggled per-workspace for gradual rollout.

---

## 8. Testing Strategy

### 8.1 Unit tests

- `SectionEditor` form validation per section type.
- Public resolvers return correct props.
- JSON-LD components emit valid schemas.
- Sitemap generator includes all published content.
- Legacy adapter correctly detects old layout JSON.

### 8.2 Integration tests

- Create Course → publish → appears at `/courses/[slug]` with JSON-LD.
- Create Page with sections → renders at `/[slug]` via SectionRenderer.
- Legacy Page with layout JSON → renders via LegacySectionAdapter.
- Update SiteSetting.theme → all pages re-theme.
- Update Course.title → sitemap + JSON-LD + listing update.

### 8.3 E2E tests (Playwright)

- Creator logs in → navigates new sidebar → reaches every module.
- Creator creates a Course → publishes → views public course page.
- Creator edits homepage sections via SectionEditor → publishes → views public home.
- Creator edits Branding → public site re-themes.
- Creator edits Navigation → public header updates.
- Creator clicks "Generate Website" in AI Studio → multi-page site generated.

### 8.4 Visual regression

- Snapshot public home, course, product, blog, custom page before and after each stage.
- No unintended visual changes.

### 8.5 Performance regression

- Lighthouse CI on every PR affecting public routes.
- Block merge if LCP > 2s or SEO < 90.

### 8.6 SEO validation

- Structured Data Test on every PR affecting JSON-LD.
- Sitemap reachable in smoke tests.
- robots.txt reachable in smoke tests.

---

## 9. Communication Plan

| When | Audience | Channel | Message |
|---|---|---|---|
| T-2 weeks | All creators | In-app banner | "CreatorOS is evolving into an AI-powered Creator Business Platform. Your content is safe." |
| T-1 week | All creators | Email | Summary of changes + new sidebar preview + FAQ |
| T-3 days | All creators | In-app banner | "Migration in 3 days. Preview the new look." |
| Launch day | All creators | Dashboard announcement | "Welcome to the new CreatorOS" + changelog link |
| T+1 day | Support | Internal | Common questions + escalation paths |
| T+1 week | All creators | Email | "How's the new CreatorOS?" + feedback survey |

---

## 10. Timeline (Indicative)

| Stage | Duration | Dependencies |
|---|---|---|
| Stage 1 — Schema | 1–2 days | None |
| Stage 2 — Nav | 2–3 days | Stage 1 |
| Stage 3 — Section editor | 5–7 days | Stage 2 |
| Stage 4 — Module rename | 2–3 days | Stage 3 |
| Stage 5 — Public frontend | 7–10 days | Stage 4 |
| Stage 6 — Verify & launch | 3–5 days | Stage 5 |
| **Total** | **20–30 days** | |

Stages 1–4 can overlap with Stage 5 development (different teams).

---

## 11. Success Criteria

| Criterion | How to verify |
|---|---|
| Zero data loss | DB diff before/after |
| All existing pages render | E2E test on every existing Page |
| All existing funnels work | E2E test on every existing Funnel |
| No dead sidebar items | Click-test |
| No dead routes | Crawl |
| Old URLs redirect | Redirect test |
| Public site live | Visit `/` on production domain |
| SEO validates | Structured Data Test |
| Lighthouse SEO ≥ 95 | Lighthouse CI |
| LCP < 1.5s mobile | Web Vitals |
| Creator NPS not drop | Post-launch survey |
| Support tickets < 2x baseline | T+1 week metric |

---

## 12. Post-Migration Cleanup (T+30 days)

After 30 days of stable operation:

1. Remove `PageEditor.tsx` drag-and-drop code (legacy adapter remains for old data).
2. Remove old admin URL redirects (keep 308 for SEO link equity).
3. Remove feature flags (all enabled by default).
4. Consolidate `WebPage` model into `Page` (if applicable).
5. Remove legacy layout JSON support from new pages (legacy adapter stays for old pages).
6. Deprecate unused fields on `PageSection` (if any).

---

## 13. Open Questions

1. Should we migrate admin to `/app/*` in Stage 2 or Stage 5? **Recommendation**: Stage 5 (only needed when public site goes live).
2. Should we auto-convert legacy pages to new format or let creators do it manually? **Recommendation**: manual, with prominent "Convert" button + AI assist.
3. Should the public frontend be a separate Next.js app? **Recommendation**: same app, route group, for shared code + simpler deploys.
4. Should we keep `WebPage` model? **Recommendation**: consolidate into `Page` in post-migration cleanup.
5. Should we support both drag-and-drop and section editor during transition? **Recommendation**: no — clean break, but legacy pages render via adapter.

---

## 14. Related Documents

- `WEBSITE_ARCHITECTURE.md` — overall architecture
- `PUBLIC_FRONTEND_PLAN.md` — public frontend design
- `WEBSITE_DATABASE_FLOW.md` — data flow
- `WEBSITE_NAVIGATION.md` — admin navigation
- `WEBSITE_SEO_PLAN.md` — SEO strategy

---

## 15. Appendix — Migration Checklist

- [ ] Stage 1: Schema additions deployed
- [ ] Stage 2: Sidebar restructured
- [ ] Stage 2: Old URLs redirect
- [ ] Stage 2: Keyboard shortcuts updated
- [ ] Stage 3: SectionEditor built
- [ ] Stage 3: Legacy adapter built
- [ ] Stage 3: Existing pages render via adapter
- [ ] Stage 3: New pages created via SectionEditor
- [ ] Stage 4: Website module renamed
- [ ] Stage 4: 7 tabs functional
- [ ] Stage 4: Drag-and-drop removed everywhere
- [ ] Stage 5: Admin moved to `/app/*`
- [ ] Stage 5: Public route group created
- [ ] Stage 5: All public routes render
- [ ] Stage 5: Sitemap + robots.txt generated
- [ ] Stage 5: JSON-LD validates
- [ ] Stage 5: Lighthouse SEO ≥ 95
- [ ] Stage 6: Full QA checklist passed
- [ ] Stage 6: Communication sent
- [ ] Stage 6: Feature flags enabled for all
- [ ] T+30: Cleanup completed

---

**End of document.**
