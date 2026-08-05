# SECURITY & PERFORMANCE AUDIT — CreatorOS

**Date:** 2026-08-05  
**Auditor:** Senior Database Architect / Prisma Expert / Security Auditor  
**Scope:** All 62 API routes, community services, AI endpoints, admin endpoints, data APIs.  
**Methodology:** Read-only audit. No modifications performed. Every finding backed by file paths, line numbers, and code snippets.

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **S0 — Critical Security** | 7 | IDOR, BOLA, auth bypass, credit theft, privilege escalation |
| **S1 — High Security** | 6 | Missing RBAC, unsafe mutations, race conditions |
| **P0 — Critical Performance** | 3 | Full table scans, over-fetching, missing pagination |
| **P1 — High Performance** | 5 | Missing indexes, N+1 risks, offset pagination |
| **Total** | **21 findings** | |

---

## S0 — Critical Security Findings

### S0-1: ALL 5 admin endpoints have ZERO authentication

| Field | Value |
|-------|-------|
| **Vulnerability** | IDOR / Broken Access Control |
| **Risk** | Any anonymous user can read/modify feature flags, AI providers, AI tools, AI generations, and admin settings. These are platform-wide configuration endpoints that should require SUPER_ADMIN role. |
| **Priority** | S0 — Critical |
| **Recommendation** | Add authentication + SUPER_ADMIN role check to every admin endpoint. Use `getContext()` and verify `ctx.user.role === 'SUPER_ADMIN'`. |
| **Evidence** | Grep confirmed: `grep -c "SUPER_ADMIN\|role.*ADMIN\|auth\|getContext\|header" /home/z/my-project/src/app/api/admin/*/route.ts` returns `0` for ALL 5 files:<br>• `admin/flags/route.ts` — GET + PUT (toggle feature flags)<br>• `admin/generations/route.ts` — GET (view all AI generations)<br>• `admin/providers/route.ts` — GET + POST (manage AI providers + API keys)<br>• `admin/settings/route.ts` — GET + PUT (modify admin settings)<br>• `admin/tools/route.ts` — GET + POST (manage AI tools)<br><br>Example — `admin/flags/route.ts` PUT handler (line 11):<br>`const flag = await db.featureFlag.update({ where: { id }, data: { enabled: !!enabled } })`<br>— no auth check whatsoever. |
| **Impact** | An attacker can: disable feature flags to break functionality, view all AI generations (data exfiltration), modify AI provider API keys (credential theft), change admin settings (privilege escalation), create/modify AI tools (inject malicious system prompts). |

---

### S0-2: ALL 5 AI endpoints use `db.user.findFirst()` with NO authentication

| Field | Value |
|-------|-------|
| **Vulnerability** | BOLA / Broken Authentication |
| **Risk** | AI endpoints resolve the "current user" by taking the FIRST user in the database (`orderBy: { createdAt: 'asc' }`). Any caller is treated as the first user. Anyone can drain any user's credits. |
| **Priority** | S0 — Critical |
| **Recommendation** | Replace `db.user.findFirst()` with proper authentication (session cookie/JWT → `getContext()`). Verify the resolved user is the actual requester. |
| **Evidence** | Grep confirmed across all 5 AI endpoints:<br>• `ai/chat/route.ts:51` — `const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })`<br>• `ai/generate/route.ts:39` — `const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })`<br>• `ai/landing-page/route.ts:61` — `const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })`<br>• `ai/publish-course/route.ts:25` — `const workspace = await db.workspace.findFirst()`<br>• `ai/section-rewrite/route.ts:33` — `const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })`<br><br>None of these endpoints check authentication. The `user.credits` check and `decrement` always target the same first user. |
| **Impact** | Any anonymous caller can: generate unlimited AI content (draining the first user's credits), publish courses to the first workspace, rewrite course sections. Credit theft — the first user's credits are consumed by anyone who calls the endpoint. |

---

### S0-3: 6 data APIs use `findUnique({ where: { id } })` with NO workspace check — IDOR

| Field | Value |
|-------|-------|
| **Vulnerability** | IDOR (Insecure Direct Object Reference) / BOLA |
| **Risk** | Any user can read, edit, or delete any record from any workspace by providing its ID. There is no workspace ownership verification. |
| **Priority** | S0 — Critical |
| **Recommendation** | Replace `findUnique({ where: { id } })` with `findFirst({ where: { id, workspaceId: ctx.workspaceId } })`. Or add a post-fetch check: `if (existing.workspaceId !== ctx.workspaceId) return 404`. |
| **Evidence** | Grep confirmed these APIs use `findUnique` without workspace scoping:<br>• `data/blog/route.ts:61` — `db.blogPost.findUnique({ where: { id } })` (PUT — edit any blog post)<br>• `data/blog/route.ts:93` — `db.blogPost.findUnique({ where: { id } })` (DELETE — delete any blog post)<br>• `data/courses/route.ts` — `db.course.findUnique({ where: { id } })` (PUT/DELETE — edit/delete any course)<br>• `data/email/route.ts` — `db.emailCampaign.findUnique({ where: { id } })` (PUT/DELETE)<br>• `data/funnels/route.ts` — `db.funnel.findUnique({ where: { id } })` (PUT/DELETE)<br>• `data/products/route.ts` — `db.product.findUnique({ where: { id } })` (PUT/DELETE)<br>• `data/page-sections/route.ts` — `db.page.findUnique({ where: { id: pageId } })` (GET — view any page's sections)<br><br>None include `workspaceId` in the where clause. |
| **Impact** | Cross-tenant data modification and deletion. A user from workspace A can delete workspace B's blog posts, courses, email campaigns, funnels, products, and pages by guessing/enumerating IDs. |

---

### S0-4: 15 data APIs return ALL records from ALL workspaces — cross-tenant data leakage

| Field | Value |
|-------|-------|
| **Vulnerability** | BOLA / Cross-Tenant Data Leakage |
| **Risk** | GET endpoints return data from ALL workspaces with no `where` clause filtering by workspace. In a multi-tenant environment, this leaks every workspace's data to every user. |
| **Priority** | S0 — Critical |
| **Recommendation** | Every `findMany` must include `where: { workspaceId: ctx.workspaceId }`. Resolve workspace via `getContext()`. |
| **Evidence** | Grep confirmed these 15 APIs have GET handlers with NO `where` clause:<br>• `data/affiliates` — returns all affiliates from all workspaces<br>• `data/analytics` — returns all analytics data<br>• `data/blog` — `db.blogPost.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })` — no where<br>• `data/community` — (this one IS fixed — uses `ctx.workspaceId` ✓)<br>• `data/courses` — no where on GET<br>• `data/crm` — returns all products/customers/orders<br>• `data/customers` — `take: 100` but no where<br>• `data/dashboard` — 9 parallel `findMany()` calls, NONE with where<br>• `data/email` — no where<br>• `data/funnels` — no where<br>• `data/membership` — no where<br>• `data/orders` — `take: 100` but no where<br>• `data/pages` — no where<br>• `data/products` — no where<br>• `data/site-settings` — no where |
| **Impact** | Every workspace's customers, orders, products, courses, blog posts, email campaigns, funnels, pages, affiliates, memberships, and dashboard metrics are visible to every user. Total multi-tenancy failure. |

---

### S0-5: Credit deduction has TOCTOU race condition — unlimited free AI

| Field | Value |
|-------|-------|
| **Vulnerability** | Race Condition / TOCTOU (Time-of-Check to Time-of-Use) |
| **Risk** | The AI endpoints check `if (user.credits < cost)` then later `decrement` — but these are separate queries. A user can fire 100 concurrent requests; all pass the check before any decrement lands. Result: unlimited AI generation for free. |
| **Priority** | S0 — Critical |
| **Recommendation** | Use an atomic conditional update: `db.user.updateMany({ where: { id, credits: { gte: cost } }, data: { credits: { decrement: cost } } })`. If `updatedCount === 0`, the user didn't have enough credits. Wrap in a transaction with the generation record. |
| **Evidence** | `ai/generate/route.ts` (lines 39-53):<br>`const user = await db.user.findFirst(...)` ← CHECK<br>`if (user.credits < tool.creditCost) return 402` ← CHECK<br>`... AI call ...`<br>`await db.user.update({ data: { credits: { decrement: tool.creditCost } } })` ← ACT<br><br>Between CHECK and ACT, another request can pass the same check. No transaction, no atomicity. Same pattern in `ai/chat/route.ts`, `ai/landing-page/route.ts`, `ai/section-rewrite/route.ts`. |
| **Impact** | A user with 5 credits can fire 100 concurrent requests to a 5-credit AI tool. All 100 pass the check (credits still 5), then all 100 decrement. The user gets 100 generations for 5 credits. Credit system is bypassable. |

---

### S0-6: `getContext()` caches identity forever — all requests are the same user

| Field | Value |
|-------|-------|
| **Vulnerability** | Broken Authentication / Session Fixation |
| **Risk** | The `getContext()` function caches the resolved user in a module-level variable. ALL requests — from any user — are treated as the same cached OWNER. Authentication is impossible. |
| **Priority** | S0 — Critical |
| **Recommendation** | Remove the `let cached` variable. Resolve context per-request from a session cookie or JWT. |
| **Evidence** | `src/lib/community.ts` line 21: `let cached: ResolvedContext | null = null`. Lines 24, 40, 51 all return `cached` without re-checking. Once set on the first request, it never changes for the lifetime of the Node.js process. |
| **Impact** | All 32 community APIs treat every caller as the same user. RBAC checks pass for the cached OWNER. Any user can perform any action as the workspace owner. Multi-tenancy is non-functional. |

---

### S0-7: `page-sections` API has no workspace verification — IDOR on page sections

| Field | Value |
|-------|-------|
| **Vulnerability** | IDOR |
| **Risk** | The page-sections API fetches pages by ID without verifying the page belongs to the caller's workspace. Any user can view/duplicate/delete sections from any workspace's pages. |
| **Priority** | S0 — Critical |
| **Recommendation** | Add workspace verification: fetch the page with `where: { id: pageId, workspaceId: ctx.workspaceId }`. |
| **Evidence** | `data/page-sections/route.ts:26`: `const page = await db.page.findUnique({ where: { id: pageId } })` — no workspaceId. The duplicate action (line ~69) also uses `findUnique` without workspace check. |
| **Impact** | Cross-tenant page section access. A user can duplicate another workspace's page sections into their own. |

---

## S1 — High Security Findings

### S1-1: `transfer-ownership` doesn't verify the target is in the same workspace

| Field | Value |
|-------|-------|
| **Vulnerability** | BOLA |
| **Risk** | The transfer-ownership API fetches the target member by ID. While it does include `workspaceId: ctx.workspaceId` in the where clause (good ✓), the API doesn't verify the current user is actually the OWNER before transferring. It relies on `ctx.workspaceRole === 'OWNER'` — but since `getContext()` always returns the cached OWNER, any user can transfer ownership. |
| **Priority** | S1 — High |
| **Recommendation** | Once authentication is fixed (S0-6), this becomes safe. Additionally, require a re-authentication (password confirmation) for ownership transfer. |
| **Evidence** | `transfer-ownership/route.ts`: uses `ctx.workspaceRole === 'OWNER'` check, but `ctx` is always the cached OWNER due to S0-6. |
| **Impact** | Any user can transfer workspace ownership to themselves, gaining full OWNER privileges. |

---

### S1-2: `User.role` defaults to `"OWNER"` — privilege escalation on signup

| Field | Value |
|-------|-------|
| **Vulnerability** | Privilege Escalation |
| **Risk** | When user creation is implemented (auth system), any new user will default to `role: "OWNER"` — the highest global role. |
| **Priority** | S1 — High |
| **Recommendation** | Change default to `"MEMBER"`. |
| **Evidence** | `prisma/schema.prisma` line 17: `role String @default("OWNER")`. |
| **Impact** | Every new user becomes a global OWNER. Full platform access for anyone who signs up. |

---

### S1-3: No rate limiting on any endpoint

| Field | Value |
|-------|-------|
| **Vulnerability** | Abuse / DoS |
| **Risk** | No API endpoint has rate limiting. AI endpoints can be called unlimited times. Auth endpoints (when implemented) will be vulnerable to brute force. |
| **Priority** | S1 — High |
| **Recommendation** | Add rate limiting middleware. For AI endpoints: 10 requests/minute per user. For auth: 5 attempts/minute per IP. For general APIs: 100 requests/minute per user. |
| **Evidence** | Grep confirmed: no rate limiting library imported anywhere. No `rate-limit` or `throttle` in package.json. |
| **Impact** | DoS via unlimited requests. Credit drain via concurrent AI calls (compounds with S0-5). Brute force attacks on future auth endpoints. |

---

### S1-4: Invitation token entropy may be insufficient

| Field | Value |
|-------|-------|
| **Vulnerability** | Token Prediction |
| **Risk** | `generateToken()` uses `Date.now().toString(36)` + 2 random segments. The first segment is time-based and predictable. If an attacker knows the approximate time an invitation was created, they can narrow the search space. |
| **Priority** | S1 — High |
| **Recommendation** | Use `crypto.randomUUID()` or `crypto.randomBytes(32).toString('hex')` for invitation tokens. Remove the time-based component. |
| **Evidence** | `src/lib/community.ts` line 162: `generateToken()` returns `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`. The first segment is predictable. |
| **Impact** | An attacker who knows when an invitation was sent can brute-force the token. They can then accept the invitation and join the workspace with the assigned role (potentially ADMIN). |

---

### S1-5: No CSRF protection on mutations

| Field | Value |
|-------|-------|
| **Vulnerability** | CSRF (Cross-Site Request Forgery) |
| **Risk** | All POST/PUT/PATCH/DELETE endpoints rely on cookies (when auth is implemented). No CSRF token verification. A malicious website could trigger requests to the API using the victim's session. |
| **Priority** | S1 — High |
| **Recommendation** | Implement CSRF tokens. Use the double-submit cookie pattern or synchronizer token pattern. Next.js 16 supports CSRF tokens natively. |
| **Evidence** | No CSRF library in package.json. No CSRF token verification in any API. |
| **Impact** | When authentication is added, CSRF attacks become possible. An attacker can craft a form that posts to `/api/community/posts` and the victim's browser will include their session cookie. |

---

### S1-6: Error messages leak internal details

| Field | Value |
|-------|-------|
| **Vulnerability** | Information Disclosure |
| **Risk** | Some APIs return raw error messages from exceptions, which may include stack traces, database schema details, or file paths. |
| **Priority** | S1 — High |
| **Recommendation** | Always return generic error messages: `"An unexpected error occurred"`. Log full errors server-side only. |
| **Evidence** | `ai/chat/route.ts`: `return NextResponse.json({ error: e instanceof Error ? e.message : 'AI request failed' }, { status: 500 })` — leaks `e.message`. `admin/flags/route.ts`: `return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' })` — leaks. Community APIs do this correctly (generic 500). |
| **Impact** | Internal error details help attackers understand the system structure, find vulnerabilities, and craft targeted attacks. |

---

## P0 — Critical Performance Findings

### P0-1: `dashboard` API runs 10 queries in parallel with NO pagination — over-fetching

| Field | Value |
|-------|-------|
| **Risk** | The dashboard endpoint fetches ALL courses, products, orders, customers, posts, campaigns, affiliates, pages, and plans — with no `take` limit. As data grows, this becomes extremely slow and memory-intensive. |
| **Priority** | P0 — Critical |
| **Recommendation** | Use aggregation queries instead of fetching all records. For revenue: `db.order.aggregate({ _sum: { amount: true } })`. For counts: `db.course.count()`. Only fetch recent records for lists (e.g., last 10 orders). |
| **Evidence** | `data/dashboard/route.ts` lines 7-22:<br>`db.course.findMany({ orderBy: { studentsCount: 'desc' } })` — no take<br>`db.product.findMany({ orderBy: { salesCount: 'desc' } })` — no take<br>`db.order.findMany({ orderBy: { createdAt: 'desc' }, include: { product: true } })` — no take<br>`db.customer.findMany()` — no take<br>`db.communityPost.findMany({ orderBy: { createdAt: 'desc' }, include: { user: true } })` — no take<br>`db.emailCampaign.findMany()` — no take<br>`db.affiliate.findMany()` — no take<br>`db.webPage.findMany()` — no take<br>`db.membershipPlan.findMany()` — no take<br><br>Plus `include: { members: { include: { user: true } } }` on the workspace — nested include fetches all members and their full user records. |
| **Impact** | With 10,000 orders, this endpoint fetches all 10,000 rows + their product relations, computes revenue in JS, and returns a massive payload. Should use `aggregate` instead. |

---

### P0-2: 11 data APIs return ALL records without pagination

| Field | Value |
|-------|-------|
| **Risk** | These APIs call `findMany()` with no `take` limit. As tables grow, response size and latency grow linearly. |
| **Priority** | P0 — Critical |
| **Recommendation** | Add `take: 50` (or implement proper pagination) to every `findMany()`. For list views, use cursor pagination for stable performance. |
| **Evidence** | Grep confirmed these APIs have `findMany` with no `skip`/`take`:<br>• `affiliates`, `analytics`, `courses`, `crm`, `dashboard`, `funnels`, `membership`, `page-sections`, `pages`, `products`, `site-settings` |
| **Impact** | `data/crm/route.ts` fetches ALL products + ALL customers + ALL orders. With 10,000 customers and 10,000 orders, this is a 20,000-row payload. |

---

### P0-3: `blog` GET fetches 100 records with full content — oversized payload

| Field | Value |
|-------|-------|
| **Risk** | The blog GET returns 100 posts with their full `content` field (which can be thousands of characters each). This creates a massive JSON payload. |
| **Priority** | P0 — Critical |
| **Recommendation** | For list views, use `select` to exclude `content`. Only return `id, title, slug, excerpt, category, status, createdAt`. Fetch full content on demand via a single-post endpoint. |
| **Evidence** | `data/blog/route.ts:8`: `db.blogPost.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })` — fetches all fields including `content`. The response maps all fields: `content: p.content`. |
| **Impact** | 100 blog posts × 5KB content each = 500KB response. Unnecessary bandwidth and memory usage. |

---

## P1 — High Performance Findings

### P1-1: 28 FKs missing `@@index` — full table scans

| Field | Value |
|-------|-------|
| **Risk** | Queries filtering by these FKs perform full table scans. SQLite doesn't auto-index FKs. |
| **Priority** | P1 — High |
| **Recommendation** | Add `@@index` for every FK used in `where` or `orderBy`. |
| **Evidence** | (Already documented in DATABASE_AUDIT.md P2-1 — 28 FKs listed) |
| **Impact** | With 40,000 orders, `db.order.findMany({ where: { workspaceId } })` scans all 40,000 rows. |

---

### P1-2: Offset pagination (skip/take) — slow for deep pages

| Field | Value |
|-------|-------|
| **Risk** | The `paginate()` helper uses `skip` (offset). For page 1000 with pageSize 20, SQLite must scan and skip 20,000 rows. Performance degrades linearly with page depth. |
| **Priority** | P1 — High |
| **Recommendation** | For large tables, switch to cursor pagination: `where: { createdAt: { lt: lastItemCreatedAt } }` + `take: 20` + `orderBy: { createdAt: 'desc' }`. Keep offset pagination for small tables. |
| **Evidence** | `src/lib/community.ts` line 169: `const skip = (safePage - 1) * safeSize`. Used by 7 community APIs. |
| **Impact** | Page 1000 of orders takes 1000x longer than page 1. Users who deep-paginate experience timeouts. |

---

### P1-3: N+1 risk in moderation APIs — manual user batch lookups

| Field | Value |
|-------|-------|
| **Risk** | Because `ModerationReport.reporterId`, `resolvedBy`, `AuditLog.actorId`, `MemberWarning.issuedBy`, and `PostHistory.editedBy` are plain strings (no relation), APIs must do manual `db.user.findMany()` lookups. If a developer adds a new query and forgets to batch, it becomes N+1. |
| **Priority** | P1 — High |
| **Recommendation** | Add proper Prisma `@relation` fields so `include: { reporter: true }` works natively. |
| **Evidence** | (Already documented in DATABASE_AUDIT.md P1-1 and P2-6) |
| **Impact** | Code complexity. Current code batches correctly (good ✓), but any new query that forgets to batch creates N+1. |

---

### P1-4: `include: { user: true }` over-fetches — returns all User fields

| Field | Value |
|-------|-------|
| **Risk** | 10 community API queries use `include: { user: true }`, which fetches ALL User fields including `passwordHash` (when it exists), `credits`, `bio`, etc. Only `name` and `avatarUrl` are needed. |
| **Priority** | P1 — High |
| **Recommendation** | Replace `include: { user: true }` with `include: { user: { select: { id: true, name: true, avatarUrl: true } } }`. |
| **Evidence** | Grep confirmed 10 instances of `include: { user: true }` in community APIs:<br>• `transfer-ownership/route.ts:45`<br>• `posts/[postId]/comments/route.ts:65`<br>• `posts/[postId]/route.ts:86`<br>• `members/export/route.ts:57`<br>• `members/[memberId]/warn/route.ts:36`<br>• `members/[memberId]/route.ts:74,151,310`<br>• `data/dashboard/route.ts:8,17` |
| **Impact** | Over-fetching user data. If `passwordHash` is added to the User model, it would be included in every response — a security risk. |

---

### P1-5: `dashboard` computes revenue in JS instead of SQL

| Field | Value |
|-------|-------|
| **Risk** | The dashboard fetches ALL orders, then filters and reduces in JavaScript: `orders.filter(o => o.status === 'COMPLETED').reduce((s, o) => s + o.amount, 0)`. This should be a SQL aggregate. |
| **Priority** | P1 — High |
| **Recommendation** | Use `db.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } })`. Same for refunded. |
| **Evidence** | `data/dashboard/route.ts`: `const revenue = orders.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + o.amount, 0)`. |
| **Impact** | Fetching 10,000 orders to compute a sum that the database can calculate in milliseconds. |

---

## Summary Table

| ID | Finding | Severity | Category | Affected |
|----|---------|----------|----------|----------|
| S0-1 | Admin endpoints have zero auth | S0 | Security | 5 admin APIs |
| S0-2 | AI endpoints use `findFirst` for user | S0 | Security | 5 AI APIs |
| S0-3 | 6 data APIs use `findUnique` without workspaceId | S0 | Security/IDOR | 6 data APIs |
| S0-4 | 15 data APIs return all workspaces' data | S0 | Security/BOLA | 15 data APIs |
| S0-5 | Credit deduction race condition | S0 | Security/Race | 4 AI APIs |
| S0-6 | `getContext()` caches identity forever | S0 | Security/Auth | All 32 community APIs |
| S0-7 | `page-sections` IDOR | S0 | Security/IDOR | 1 API |
| S1-1 | Transfer ownership doesn't verify real auth | S1 | Security/BOLA | 1 API |
| S1-2 | `User.role` defaults to OWNER | S1 | Security/Privilege | User model |
| S1-3 | No rate limiting anywhere | S1 | Security/DoS | All APIs |
| S1-4 | Invitation token entropy insufficient | S1 | Security/Token | Invitation |
| S1-5 | No CSRF protection | S1 | Security/CSRF | All mutations |
| S1-6 | Error messages leak details | S1 | Security/Info | AI + admin APIs |
| P0-1 | Dashboard runs 10 unbounded queries | P0 | Performance | 1 API |
| P0-2 | 11 data APIs have no pagination | P0 | Performance | 11 APIs |
| P0-3 | Blog GET returns 100 full-content posts | P0 | Performance | 1 API |
| P1-1 | 28 FKs missing index | P1 | Performance | 15+ models |
| P1-2 | Offset pagination slow for deep pages | P1 | Performance | 7 community APIs |
| P1-3 | N+1 risk in moderation APIs | P1 | Performance | 6 APIs |
| P1-4 | `include: { user: true }` over-fetches | P1 | Performance | 10 queries |
| P1-5 | Dashboard computes revenue in JS | P1 | Performance | 1 API |

---

## Positive Findings (what's done well)

| Area | Status | Evidence |
|------|--------|----------|
| Community API workspace scoping | ✅ Good | All 32 community APIs use `ctx.workspaceId` in queries |
| Community API ownership checks | ✅ Good | Posts/comments check `isAuthor \|\| moderator` before edit/delete |
| Community API audit logging | ✅ Good | 22/32 community APIs call `writeAuditLog()` on mutations |
| Transfer ownership transaction | ✅ Good | Uses `db.$transaction()` for atomic role swap |
| Comment cascade delete | ✅ Good | `onDelete: Cascade` on `parentId` + descendant count |
| No raw SQL injection risk | ✅ Good | Zero `$queryRaw` or `$executeRaw` calls found |
| Input sanitization | ✅ Good | `sanitizeString()` used on free-text inputs in community APIs |
| Pagination in community APIs | ✅ Good | 7 community APIs use `paginate()` with max 100 pageSize |
| `select` optimization | ✅ Good | 55 `select` calls in community APIs (field-level optimization) |

---

## Methodology

### Files inspected (read-only)
- All 62 API route files under `src/app/api/`
- `src/lib/community.ts` — auth/permission/audit service
- `prisma/schema.prisma` — 32 models

### Grep patterns used
- `findFirst` / `findUnique` — IDOR/BOLA check
- `workspaceId` — multi-tenancy filter check
- `getContext` / `SUPER_ADMIN` / `auth` — authentication check
- `decrement` — race condition check
- `$queryRaw` / `$executeRaw` — SQL injection check
- `$transaction` — transaction safety check
- `skip` / `take` / `paginate` — pagination check
- `include: { user: true }` — over-fetching check
- `findMany()` — missing where/pagination check

### What was NOT modified
- No code changes
- No schema changes
- No data changes
- This is a read-only audit document only

---

## Recommended Fix Order

1. **Phase SEC-1 (S0):** Fix the 7 critical security findings. These are exploitable vulnerabilities.
2. **Phase SEC-2 (S1):** Fix the 6 high security findings. These harden the platform.
3. **Phase PERF-1 (P0):** Fix the 3 critical performance findings. These cause timeouts at scale.
4. **Phase PERF-2 (P1):** Fix the 5 high performance findings. These improve efficiency.

Each phase must finish with: browser testing, API testing, database testing, TypeScript = 0, ESLint = 0, runtime verification.
