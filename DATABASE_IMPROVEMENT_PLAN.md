# DATABASE IMPROVEMENT PLAN — CreatorOS

**Date:** 2026-08-05
**Scope:** Prioritized implementation roadmap based on findings from DATABASE_AUDIT.md, MODEL_AUDIT.md, RELATIONSHIP_MAP.md, QUERY_AUDIT.md, MULTITENANT_AUDIT.md, and SECURITY_DATABASE.md.
**Methodology:** Read-only audit complete. This document proposes the implementation order. No code has been changed.

---

## Implementation Principles

1. **Never break existing features** — every change must be backward-compatible
2. **Never delete user data** — use soft delete, not hard delete
3. **Never rename columns without migration** — add new columns, migrate data, then deprecate old
4. **Test after every phase** — browser testing, API testing, DB testing, TypeScript = 0, ESLint = 0
5. **One concern per PR** — don't mix security fixes with performance optimizations
6. **Preserve the community module** — it's the gold standard; back-port its patterns to other modules

---

## P0 — Critical (Must fix before production)

> **Estimated effort:** 3-5 days
> **Risk if not fixed:** Complete multi-tenancy failure, data leakage, privilege escalation
> **Confidence after P0:** 70%

### P0-1: Fix `getContext()` caching — remove module-level cache

**Problem:** `src/lib/community.ts:21` caches the resolved user/workspace in a module-level `let cached` variable. All requests share the same identity. Multi-tenancy is impossible.

**Fix:**
- Remove the `let cached` variable
- Resolve context per-request from a session cookie or JWT
- Until auth is implemented, resolve per-request (not cached) using the first workspace + first OWNER

**Files to change:**
- `src/lib/community.ts` — remove `cached` variable, make `getContext()` always resolve fresh

**Testing:**
- Verify all 32 community APIs still work
- Verify the dashboard still loads
- Run `bun run lint` — must be 0 errors

---

### P0-2: Add authentication to 5 admin endpoints

**Problem:** `admin/flags`, `admin/generations`, `admin/providers`, `admin/settings`, `admin/tools` have ZERO authentication. Any anonymous user can modify feature flags, view AI generations, change API keys.

**Fix:**
- Add `getContext()` call to every admin handler
- Check `ctx.user.role === 'SUPER_ADMIN'` — return 403 if not
- Write `ADMIN_ACCESS` audit log on every mutation

**Files to change:**
- `src/app/api/admin/flags/route.ts`
- `src/app/api/admin/generations/route.ts`
- `src/app/api/admin/providers/route.ts`
- `src/app/api/admin/settings/route.ts`
- `src/app/api/admin/tools/route.ts`

**Testing:**
- Verify unauthenticated requests return 401
- Verify non-SUPER_ADMIN users get 403
- Verify SUPER_ADMIN can still access all endpoints

---

### P0-3: Add authentication to 5 AI endpoints

**Problem:** `ai/chat`, `ai/generate`, `ai/landing-page`, `ai/publish-course`, `ai/section-rewrite` use `db.user.findFirst()` — any caller becomes the first user. Anyone can drain any user's credits.

**Fix:**
- Replace `db.user.findFirst()` with `getContext()`
- Use `ctx.user.id` for credit deduction
- Verify `ctx.workspaceId` for course/page creation

**Files to change:**
- `src/app/api/ai/chat/route.ts`
- `src/app/api/ai/generate/route.ts`
- `src/app/api/ai/landing-page/route.ts`
- `src/app/api/ai/publish-course/route.ts`
- `src/app/api/ai/section-rewrite/route.ts`

**Testing:**
- Verify AI endpoints still generate content
- Verify credits are deducted from the correct user
- Verify workspace scoping on course/page creation

---

### P0-4: Fix 6 IDOR APIs — add workspaceId to findUnique

**Problem:** 6 data APIs use `findUnique({ where: { id } })` without checking `workspaceId`. Any user can edit/delete any record from any workspace.

**Fix:**
- Replace `findUnique({ where: { id } })` with `findFirst({ where: { id, workspaceId: ctx.workspaceId } })`
- Add `getContext()` call to every handler
- Return 404 if record not found in the caller's workspace

**Files to change:**
- `src/app/api/data/blog/route.ts` — PUT, DELETE
- `src/app/api/data/courses/route.ts` — PUT, DELETE
- `src/app/api/data/email/route.ts` — PUT, DELETE
- `src/app/api/data/funnels/route.ts` — PUT, DELETE
- `src/app/api/data/products/route.ts` — PUT, DELETE
- `src/app/api/data/page-sections/route.ts` — GET, duplicate action

**Testing:**
- Verify users can only edit/delete their own workspace's records
- Verify cross-workspace access returns 404
- Verify all existing CRUD operations still work within a workspace

---

### P0-5: Fix 15 cross-tenant data APIs — add workspaceId to findMany

**Problem:** 15 data APIs return ALL records from ALL workspaces with no `where` clause.

**Fix:**
- Add `getContext()` call to every GET handler
- Add `where: { workspaceId: ctx.workspaceId }` to every `findMany()`
- Add pagination (`take: 50`) where missing

**Files to change:**
- `src/app/api/data/affiliates/route.ts`
- `src/app/api/data/analytics/route.ts`
- `src/app/api/data/blog/route.ts`
- `src/app/api/data/courses/route.ts`
- `src/app/api/data/crm/route.ts`
- `src/app/api/data/customers/route.ts`
- `src/app/api/data/dashboard/route.ts`
- `src/app/api/data/email/route.ts`
- `src/app/api/data/funnels/route.ts`
- `src/app/api/data/membership/route.ts`
- `src/app/api/data/orders/route.ts`
- `src/app/api/data/page-sections/route.ts`
- `src/app/api/data/pages/route.ts`
- `src/app/api/data/products/route.ts`
- `src/app/api/data/site-settings/route.ts`

**Testing:**
- Verify each API only returns the caller's workspace data
- Verify dashboard still shows correct metrics
- Verify pagination works

---

### P0-6: Fix credit race condition — atomic conditional update

**Problem:** AI endpoints check `if (user.credits < cost)` then `decrement` in separate queries. Concurrent requests can all pass the check before any decrement lands.

**Fix:**
- Use `db.user.updateMany({ where: { id, credits: { gte: cost } }, data: { credits: { decrement: cost } } })`
- If `updatedCount === 0`, the user didn't have enough credits — return 402
- Wrap credit deduction + generation record in `db.$transaction()`

**Files to change:**
- `src/app/api/ai/chat/route.ts`
- `src/app/api/ai/generate/route.ts`
- `src/app/api/ai/landing-page/route.ts`
- `src/app/api/ai/section-rewrite/route.ts`

**Testing:**
- Fire 100 concurrent requests with 5 credits — verify only 1 succeeds
- Verify credit balance never goes negative
- Verify generation records are created atomically with credit deduction

---

### P0-7: Add Workspace relation to Funnel, BlogPost, Order

**Problem:** These 3 models have `workspaceId` but NO Prisma `@relation` to Workspace. Workspace deletion leaves orphan records.

**Fix:**
- Add `workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` to each
- Add `Workspace.funnels Funnel[]`, `Workspace.blogPosts BlogPost[]`, `Workspace.orders Order[]` back-relations
- Add `@@index([workspaceId])` to each
- Run `bun run db:push` to apply

**Files to change:**
- `prisma/schema.prisma` — add relations + indexes
- Verify no API breaks (relations are additive)

**Testing:**
- Verify `bun run db:push` succeeds
- Verify workspace deletion cascades to funnels, blog posts, orders
- Verify all existing APIs still work

---

### P0-8: Fix `seed-ai-platform.ts` — remove webPageBlock references

**Problem:** `prisma/seed-ai-platform.ts` references `db.webPageBlock` which doesn't exist in the schema. The seed script crashes at runtime.

**Fix:**
- Option A: Add a `WebPageBlock` model to the schema (with `pageId`, `type`, `content`, `position`, relation to Page)
- Option B: Remove the `webPageBlock` references from the seed script and use `PageSection` instead
- **Recommended: Option B** (PageSection already serves this purpose)

**Files to change:**
- `prisma/seed-ai-platform.ts` — replace `webPageBlock` with `pageSection`

**Testing:**
- Run `bun run db:seed-ai-platform` — must succeed without errors
- Verify homepage blocks are seeded into PageSection

---

## P1 — High (Fix before scaling)

> **Estimated effort:** 5-7 days
> **Risk if not fixed:** Data integrity issues, performance degradation, audit gaps
> **Confidence after P1:** 85%

### P1-1: Add `createdBy` and `updatedBy` to all workspace-owned models

**Problem:** 0/41 models have `updatedBy`. Only 2/41 have `createdBy` (both nullable). No ownership tracking.

**Fix:**
- Add `createdBy String?` and `updatedBy String?` to all 12 workspace-owned content models
- Add `createdBy User? @relation(...)` and `updatedBy User? @relation(...)` relations
- Update APIs to set `createdBy: ctx.user.id` on create, `updatedBy: ctx.user.id` on update
- Make `EmailCampaign.createdBy` and `BannedKeyword.createdBy` non-nullable

**Models to update:** Course, Product, Order, CommunityPost, CommunitySpace, CommunityEvent, Customer, EmailCampaign, Affiliate, WebPage, MembershipPlan, Funnel, BlogPost, Page

**Testing:**
- Verify new records have `createdBy` set
- Verify updated records have `updatedBy` set
- Verify existing records still work (nullable fields)

---

### P1-2: Add `deletedAt` (soft delete) to content models

**Problem:** 0/41 models have `deletedAt`. All deletes are permanent. No GDPR compliance, no data recovery.

**Fix:**
- Add `deletedAt DateTime?` to all content models
- Update all `delete()` calls to set `deletedAt: new Date()` instead
- Add `where: { deletedAt: null }` to all `findMany()` / `findFirst()` queries (or use Prisma middleware)
- Add a "restore" API for soft-deleted records

**Models to update:** Course, Section, Lesson, Product, Order, CommunityPost, CommunityComment, CommunitySpace, CommunityEvent, Customer, EmailCampaign, Affiliate, WebPage, MembershipPlan, Page, PageSection, Funnel, FunnelStep, BlogPost

**Testing:**
- Verify "deleted" records still exist in DB with `deletedAt` set
- Verify they don't appear in normal queries
- Verify restore works

---

### P1-3: Add 28 missing FK indexes

**Problem:** 28 FK columns have no `@@index`. Queries filtering by these columns do full table scans.

**Fix:**
- Add `@@index([columnName])` for every FK listed in MODEL_AUDIT.md
- Run `bun run db:push` to apply

**Models to update:** (see MODEL_AUDIT.md "Summary: Missing Indexes" section)

**Testing:**
- Verify `bun run db:push` succeeds
- Verify query performance improves (use `EXPLAIN QUERY PLAN` on SQLite)

---

### P1-4: Add pagination to 11 data APIs

**Problem:** 11 data APIs return all records with no pagination.

**Fix:**
- Add `take: 50` (or use `paginate()` helper) to every `findMany()`
- Add `page` and `pageSize` query params
- Return `{ items, total, page, pageSize, totalPages }`

**Files to change:** (see QUERY_AUDIT.md "Missing Pagination" section)

**Testing:**
- Verify APIs return paginated results
- Verify page 2 returns different results than page 1
- Verify total count is correct

---

### P1-5: Fix dashboard over-fetching — use SQL aggregates

**Problem:** Dashboard fetches ALL orders, customers, etc. and computes revenue in JS.

**Fix:**
- Replace `db.order.findMany()` + JS reduce with `db.order.aggregate({ where: { workspaceId, status: 'COMPLETED' }, _sum: { amount: true } })`
- Replace `db.customer.findMany()` + count with `db.customer.count({ where: { workspaceId } })`
- Only fetch recent 10 records for list views

**Files to change:**
- `src/app/api/data/dashboard/route.ts`
- `src/app/api/data/analytics/route.ts`

**Testing:**
- Verify dashboard loads faster
- Verify revenue numbers are correct
- Verify recent lists show latest 10 items

---

### P1-6: Add rate limiting

**Problem:** No rate limiting on any endpoint. DoS and brute force possible.

**Fix:**
- Install `@upstash/ratelimit` or use in-memory rate limiter
- AI endpoints: 10 requests/minute per user
- Auth endpoints: 5 attempts/minute per IP
- General APIs: 100 requests/minute per user
- Return 429 with `Retry-After` header

**Files to change:**
- All API route files (or add middleware)
- `package.json` — add rate limiting dependency

**Testing:**
- Verify exceeding the limit returns 429
- Verify legitimate requests still work
- Verify rate limit resets after the window

---

### P1-7: Add CSRF protection

**Problem:** No CSRF tokens. When auth is implemented, CSRF attacks are possible.

**Fix:**
- Use Next.js CSRF token middleware
- Double-submit cookie pattern
- Verify token on all POST/PUT/PATCH/DELETE

**Files to change:**
- `src/middleware.ts` (create if not exists)
- All mutation API routes

**Testing:**
- Verify requests without CSRF token are rejected
- Verify requests with valid token work
- Verify CSRF token rotates per session

---

### P1-8: Fix `User.role` default

**Problem:** `User.role` defaults to `"OWNER"` — every new user becomes a global OWNER.

**Fix:**
- Change `role String @default("OWNER")` to `role String @default("MEMBER")`
- Run `bun run db:push`

**Files to change:**
- `prisma/schema.prisma` — line 17

**Testing:**
- Verify new users default to MEMBER
- Verify existing OWNER users keep their role
- Verify the seed script still creates an OWNER explicitly

---

### P1-9: Add unique constraints on slug fields

**Problem:** `WebPage.slug`, `Page.slug`, `BlogPost.slug` have no unique constraint. Duplicate slugs possible.

**Fix:**
- Add `@@unique([workspaceId, slug])` to `Page` and `BlogPost`
- For `WebPage`: consolidate into `Page` (see P1-10) OR add the constraint
- Handle existing duplicates before applying (rename duplicates with suffix)

**Files to change:**
- `prisma/schema.prisma`

**Testing:**
- Verify creating a duplicate slug returns 409
- Verify existing pages with unique slugs still work

---

### P1-10: Consolidate WebPage into Page

**Problem:** `WebPage` and `Page` are duplicate tables. Both contain "Homepage" with slug "home".

**Fix:**
- Migrate `WebPage` data into `Page` (map fields, generate slugs)
- Update `dashboard` and `analytics` APIs to query `Page` instead of `WebPage`
- Remove `WebPage` model from schema
- Run `bun run db:push`

**Files to change:**
- `prisma/schema.prisma` — remove WebPage
- `src/app/api/data/dashboard/route.ts` — use Page
- `src/app/api/data/analytics/route.ts` — use Page
- Migration script to copy WebPage → Page

**Testing:**
- Verify dashboard still shows page count
- Verify no data is lost (all WebPage records migrated)
- Verify `bun run lint` passes

---

## P2 — Medium (Performance & maintainability)

> **Estimated effort:** 3-5 days
> **Risk if not fixed:** Slow queries at scale, maintainability debt
> **Confidence after P2:** 92%

### P2-1: Add Prisma relations for 13 plain-string FKs

**Problem:** 13 FK columns are stored as plain strings with no `@relation`. No referential integrity, no `include` support, orphan risk.

**Fix:**
- Add `@relation` declarations with appropriate `onDelete` rules
- For audit tables (AuditLog, Notification): use `onDelete: SetNull`
- For content tables (PostHistory, MemberWarning): use `onDelete: Cascade` or `SetNull`

**Models to update:** (see MODEL_AUDIT.md — 13 plain-string FKs listed)

**Testing:**
- Verify `include: { reporter: true }` works
- Verify user deletion doesn't crash related records
- Verify no orphan data

---

### P2-2: Fix over-fetching — replace `include: { user: true }` with `select`

**Problem:** 10 community API queries use `include: { user: true }`, fetching all User fields.

**Fix:**
- Replace with `include: { user: { select: { id: true, name: true, avatarUrl: true } } }`

**Files to change:** (see QUERY_AUDIT.md "Over-fetching" section — 10 instances)

**Testing:**
- Verify API responses still contain author name + avatar
- Verify response payload is smaller
- Verify no `passwordHash` or sensitive fields are returned

---

### P2-3: Switch to cursor pagination for large tables

**Problem:** Offset pagination (skip/take) is slow for deep pages. Page 1000 = 1000x slower than page 1.

**Fix:**
- For tables expected to exceed 10K rows (Notification, AuditLog, Order, CommunityPost): use cursor pagination
- `where: { createdAt: { lt: cursor } }` + `take: 20` + `orderBy: { createdAt: 'desc' }`
- Keep offset pagination for small tables

**Files to change:**
- `src/lib/community.ts` — add `cursorPaginate()` helper
- `src/app/api/community/notifications/route.ts`
- `src/app/api/community/moderation/audit-log/route.ts`
- `src/app/api/community/posts/route.ts`

**Testing:**
- Verify deep pagination is fast
- Verify cursor pagination returns correct results
- Verify backward compatibility (offset still works for small tables)

---

### P2-4: Remove dead models

**Problem:** `PageVersion` and `AiConversation` have 0 rows and 0 API usage. `Enrollment` and `FunnelStep` have seed data but 0 API usage.

**Fix:**
- Option A: Implement the features (page version history, AI conversation persistence)
- Option B: Remove the models + seed data
- **Recommended:** Keep `Enrollment` and `FunnelStep` (will be used), remove `PageVersion` and `AiConversation` if not planned

**Files to change:**
- `prisma/schema.prisma` — remove dead models (if Option B)
- Remove related seed data

**Testing:**
- Verify `bun run db:push` succeeds
- Verify no API references the removed models
- Verify `bun run lint` passes

---

### P2-5: Fix N+1 in moderation APIs

**Problem:** Moderation APIs do manual `db.user.findMany()` batch lookups for reporter/resolver names because of missing Prisma relations.

**Fix:**
- Add `@relation` for `reporterId` and `resolvedBy` (see P2-1)
- Replace manual batch lookups with `include: { reporter: { select: { name: true, avatarUrl: true } } }`

**Files to change:**
- `src/app/api/community/moderation/reports/route.ts`
- `src/app/api/community/moderation/queue/route.ts`
- `src/app/api/community/moderation/audit-log/route.ts`
- `src/app/api/community/moderation/warnings/route.ts`
- `src/app/api/community/posts/[postId]/history/route.ts`

**Testing:**
- Verify moderation APIs still return reporter/resolver names
- Verify fewer DB queries per request (use Prisma query logging)

---

### P2-6: Add audit logging to data APIs

**Problem:** 0/17 data APIs write audit logs. Course creation, product updates, order refunds — none are audited.

**Fix:**
- Add `writeAuditLog(ctx, action, targetType, targetId)` to every data API mutation
- Define action names: `COURSE_CREATE`, `COURSE_UPDATE`, `COURSE_DELETE`, `PRODUCT_CREATE`, etc.

**Files to change:** All 17 data API route files

**Testing:**
- Verify audit log entries are created for every mutation
- Verify the audit log viewer shows data API actions

---

### P2-7: Fix `Affiliate.code` to be workspace-scoped

**Problem:** `code @unique` is global — two workspaces can't use the same code.

**Fix:**
- Change to `@@unique([workspaceId, code])`
- Remove `@unique` from `code`
- Run `bun run db:push`

**Testing:**
- Verify two workspaces can use the same code
- Verify duplicate codes within a workspace are rejected

---

### P2-8: Add `Customer.email` unique constraint

**Problem:** `Customer.email` has no unique constraint — duplicate customers possible.

**Fix:**
- Add `@@unique([workspaceId, email])`
- Handle existing duplicates before applying (merge or rename)

**Testing:**
- Verify duplicate customer emails are rejected
- Verify existing unique customers still work

---

## P3 — Future (Polish & scalability)

> **Estimated effort:** 5-10 days
> **Risk if not fixed:** No immediate risk; improves scalability and maintainability
> **Confidence after P3:** 95%+

### P3-1: Migrate from SQLite to PostgreSQL

**Problem:** SQLite doesn't support concurrent writes, replication, or point-in-time recovery.

**Fix:**
- Change `datasource db { provider = "sqlite" }` to `provider = "postgresql"`
- Provision a PostgreSQL instance
- Migrate data using `pgloader` or custom script
- Switch from `db push` to `prisma migrate dev` for versioned migrations
- Add Prisma enums for all String-enum fields
- Add CHECK constraints for rating ranges

**Testing:**
- Verify all APIs work with PostgreSQL
- Verify concurrent writes don't block
- Verify migrations are versioned

---

### P3-2: Add caching layer (Redis)

**Problem:** Every request hits the database. No query caching.

**Fix:**
- Install `ioredis` or `@upstash/redis`
- Cache dashboard metrics (TTL: 60s)
- Cache workspace member list (TTL: 30s, invalidate on member change)
- Cache AI tool configuration (TTL: 300s, invalidate on admin change)
- Use Redis for rate limiting (P1-6)

**Testing:**
- Verify cache hits reduce DB queries
- Verify cache invalidation works on mutations
- Verify stale data is not served

---

### P3-3: Add background job queue

**Problem:** Email sending and AI generation are synchronous. Long-running operations block the request.

**Fix:**
- Install `bullmq` or use Upstash QStash
- Move email sending to background jobs
- Move AI generation to background jobs (return job ID, poll for status)
- Move analytics aggregation to scheduled jobs

**Testing:**
- Verify email sending doesn't block the API response
- Verify AI generation status can be polled
- Verify failed jobs are retried

---

### P3-4: Add full-text search

**Problem:** Search uses `contains` (LIKE) which is slow on large tables.

**Fix:**
- For PostgreSQL: use `tsvector` columns + GIN indexes
- For SQLite: consider external search index (ElasticSearch, Meilisearch)
- Add search to: CommunityPost, Course, Product, BlogPost, Customer

**Testing:**
- Verify search results are relevant
- Verify search performance is fast on 100K+ rows

---

### P3-5: Add Prisma middleware for automatic workspace filtering

**Problem:** Every API must manually add `where: { workspaceId }`. Easy to forget → IDOR.

**Fix:**
- Add Prisma middleware that automatically injects `workspaceId` into all queries on workspace-owned models
- Use AsyncLocalStorage to propagate the workspace context
- This prevents future IDOR regressions

**Testing:**
- Verify queries without explicit workspaceId still get filtered
- Verify the middleware doesn't break global models (User, AiProvider, etc.)

---

### P3-6: Add read replicas

**Problem:** All reads hit the primary database. Analytics queries compete with user queries.

**Fix:**
- Configure Prisma with read replica URLs
- Route analytics/dashboard queries to read replica
- Route user mutations to primary

**Testing:**
- Verify read replica is used for analytics
- Verify replication lag is acceptable (< 1s)
- Verify failover works if replica is down

---

### P3-7: Standardize naming conventions

**Problem:** Inconsistent model naming (`CommunityPost` vs `PostHistory` vs `EventRSVP`).

**Fix:**
- Document the convention: `Community` prefix for community module models
- Apply to future models
- Do NOT rename existing models (would require migration + API changes)

---

### P3-8: Add database-level enums (PostgreSQL only)

**Problem:** All enums stored as String. Invalid values can be written.

**Fix:**
- After migrating to PostgreSQL (P3-1), convert all String-enum fields to Prisma `enum` types
- Add CHECK constraints for rating ranges
- Add CHECK constraints for commissionRate (0-1)

**Testing:**
- Verify invalid enum values are rejected at DB level
- Verify valid enum values work

---

## Implementation Order Summary

| Phase | Items | Effort | Confidence After |
|-------|-------|--------|-----------------|
| **P0** | 8 critical fixes | 3-5 days | 70% |
| **P1** | 10 high fixes | 5-7 days | 85% |
| **P2** | 8 medium fixes | 3-5 days | 92% |
| **P3** | 8 future improvements | 5-10 days | 95%+ |
| **Total** | 34 improvements | 16-27 days | 95%+ |

---

## Phase Gate Criteria

Each phase is NOT complete until ALL of the following pass:

### P0 Gate
- [ ] `getContext()` does not cache
- [ ] All 5 admin endpoints return 401 for unauthenticated requests
- [ ] All 5 AI endpoints deduct credits from the correct user
- [ ] All 6 IDOR APIs return 404 for cross-workspace access
- [ ] All 15 data APIs only return the caller's workspace data
- [ ] Credit race condition fixed (100 concurrent requests → only valid ones succeed)
- [ ] Funnel, BlogPost, Order have Workspace relation
- [ ] `seed-ai-platform.ts` runs without errors
- [ ] `bun run lint` = 0 errors
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] Browser test: all existing features still work
- [ ] Browser test: community module fully functional
- [ ] Browser test: dashboard loads with correct data
- [ ] Browser test: AI studio generates content
- [ ] API test: cross-workspace access returns 404
- [ ] DB test: no orphan records after workspace deletion

### P1 Gate
- [ ] All workspace-owned models have `createdBy`/`updatedBy`
- [ ] All content models have `deletedAt`
- [ ] 28 FK indexes added
- [ ] 11 data APIs paginated
- [ ] Dashboard uses SQL aggregates
- [ ] Rate limiting enforced on all endpoints
- [ ] CSRF protection on all mutations
- [ ] `User.role` defaults to `"MEMBER"`
- [ ] Slug fields have `@@unique([workspaceId, slug])`
- [ ] `WebPage` consolidated into `Page`
- [ ] `bun run lint` = 0 errors
- [ ] Browser test: soft delete works (deleted records don't appear)
- [ ] API test: rate limiting returns 429
- [ ] API test: CSRF rejects missing tokens

### P2 Gate
- [ ] 13 plain-string FKs have Prisma relations
- [ ] No `include: { user: true }` — all use `select`
- [ ] Cursor pagination on large tables
- [ ] Dead models removed or implemented
- [ ] N+1 eliminated in moderation APIs
- [ ] All data APIs write audit logs
- [ ] `Affiliate.code` is workspace-scoped
- [ ] `Customer.email` has unique constraint
- [ ] `bun run lint` = 0 errors
- [ ] Performance test: dashboard loads < 500ms with 10K records
- [ ] Performance test: deep pagination < 100ms

### P3 Gate
- [ ] PostgreSQL migration complete
- [ ] Redis caching layer operational
- [ ] Background job queue operational
- [ ] Full-text search operational
- [ ] Prisma middleware for auto workspace filtering
- [ ] Read replicas configured
- [ ] Database-level enums (PostgreSQL)
- [ ] All phase gates pass
- [ ] Load test: 1000 concurrent users
- [ ] Security penetration test passed

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| P0 changes break existing features | Medium | High | Test after each item; use feature flags |
| Soft delete (P1-2) misses a query | High | Medium | Add Prisma middleware to auto-filter `deletedAt: null` |
| WebPage → Page migration loses data | Low | High | Backup DB before migration; verify row counts |
| PostgreSQL migration (P3-1) fails | Medium | High | Test on staging first; use pgloader; verify data integrity |
| Rate limiting (P1-6) blocks legitimate users | Medium | Medium | Set generous limits; add whitelist for internal tools |
| Prisma middleware (P3-5) breaks global models | Medium | High | Exclude User, AiProvider, AiModel, AiTool, FeatureFlag, AdminSetting, SiteSetting from auto-filtering |

---

## Dependencies

```
P0-1 (getContext) → P0-2, P0-3, P0-4, P0-5 (all depend on working getContext)
P0-7 (Workspace relations) → P1-1 (createdBy needs relations)
P1-1 (createdBy/updatedBy) → P1-2 (soft delete)
P1-3 (indexes) — no dependencies, can be done anytime
P1-6 (rate limiting) → P1-7 (CSRF) — both are middleware
P1-10 (WebPage consolidation) → P2-4 (dead model removal)
P3-1 (PostgreSQL) → P3-2 (Redis), P3-4 (FTS), P3-8 (enums)
```

---

## Methodology

This plan is based on findings from:
- `DATABASE_AUDIT.md` — 35 findings (5 P0, 12 P1, 10 P2, 8 P3)
- `MODEL_AUDIT.md` — 41 models audited, 28 missing indexes, 41 missing `deletedAt`
- `RELATIONSHIP_MAP.md` — 38 relations, 24 plain-string FKs, 0 circular dependencies
- `QUERY_AUDIT.md` — 8 N+1 risks, 21 slow queries, 18 unsafe queries, 12 missing transactions
- `MULTITENANT_AUDIT.md` — 15 cross-tenant leaks, 20 IDOR vulnerabilities, score 42/100
- `SECURITY_DATABASE.md` — 48 vulnerabilities (12 S0, 18 S1, 10 S2, 8 S3), score 28/100

### What was NOT modified
- No code changes
- No schema changes
- No data changes
- This is a **planning document only**
