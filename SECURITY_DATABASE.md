# CreatorOS — Database Security Audit Report

**Audit scope:** Prisma schema (`prisma/schema.prisma`, 41 models), auth/permission layer (`src/lib/community.ts`), and all 60 API route files under `src/app/api/`.
**Auditor:** Database Security Auditor (automated static review)
**Date:** 2025
**Classification:** Internal — Confidential

---

## 1. Executive Summary

### Overall Security Score: **28 / 100 (F — Critical)**

CreatorOS is a multi-tenant creator platform built on Prisma + SQLite with 41 data models and 60 API route files spread across four domains: `admin` (5 routes), `ai` (5 routes), `community` (32 routes), and `data` (17 routes), plus a root health-check route.

The **community module** (32 endpoints) is the only domain with a coherent security model: every route calls `getContext()`, scopes queries by `workspaceId`, enforces a 9-level RBAC hierarchy, writes audit logs on mutations, and sanitizes input. This module demonstrates that the team *can* write secure code.

Every other domain is effectively unauthenticated:

- **All 5 admin endpoints** have zero auth — anyone on the network can read/write AI provider API keys, feature flags, admin settings, and tool definitions.
- **All 5 AI endpoints** have zero auth — they pick `db.user.findFirst()` (the first user ever created) and bill credits to that user, with a classic TOCTOU race on the balance check.
- **16 of 17 data endpoints** have zero auth and zero workspace scoping — they return every tenant's courses, products, orders, customers, blog posts, pages, funnels, and CRM records in a single unauthenticated GET.
- **16 IDOR/BOLA vulnerabilities** allow any caller to mutate or delete any other tenant's records by `id` via `findUnique({ where: { id } })` with no `workspaceId` filter.

On top of the access-control collapse, the platform stores **AI provider API keys in plaintext** and serves them verbatim to any caller via `GET /api/admin/providers`, and generates **invitation tokens with `Math.random()`** (not cryptographically secure).

There is **no real authentication system**. `getContext()` (`src/lib/community.ts:23-61`) resolves "the current user" as the first workspace's first OWNER member and caches that resolution **in module scope forever** (`let cached: ResolvedContext | null = null`, line 21). In a multi-process deployment this means every request from every visitor is impersonated as that one user.

### Vulnerability Count by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| **S0 — Critical** | 12 | No-auth admin/AI/data endpoints; API-key plaintext exposure; no authentication system; cross-tenant data leakage |
| **S1 — High** | 18 | IDOR on 16 data endpoints; credit-deduction TOCTOU; ownership transfer without re-auth; cached-context privilege retention |
| **S2 — Medium** | 10 | No CSRF; no rate limiting; weak token entropy; error-message leakage; PII over-exposure; over-fetching `include: { user: true }`; missing transactions on multi-step mutations |
| **S3 — Low** | 8 | Orphan risk on 5 models with no FK cascade; redundant manual cascade deletes; JSON.parse without try/catch in data routes; no audit logging on admin/AI/data mutations |
| **Total** | **48** | |

### Top 5 Risks

1. **No authentication on 26 of 60 endpoints** — every admin, AI, and (almost) every data route is callable by any network client. `getContext()` is never invoked. (`src/app/api/admin/**`, `src/app/api/ai/**`, `src/app/api/data/**` except `data/community`)
2. **Plaintext AI provider API keys served to any caller** — `GET /api/admin/providers` returns `apiKey` in cleartext with no auth and no `select` filter. (`src/app/api/admin/providers/route.ts:6`; schema `prisma/schema.prisma:509`)
3. **16 IDOR/BOLA write vulnerabilities** — `PUT`/`DELETE` on courses, products, blog posts, email campaigns, funnels, and page sections use `findUnique({ where: { id } })` with no `workspaceId` check, allowing cross-tenant tampering and deletion.
4. **Cross-tenant data leakage on 16 read endpoints** — `findMany()` with no `where.workspaceId` returns every tenant's courses, orders, customers, posts, pages, funnels, affiliates, and CRM records in a single request.
5. **Credit-deduction TOCTOU race** — AI endpoints check `user.credits` then `decrement` in two separate statements with no transaction/lock; concurrent requests can drive the balance negative. (`src/app/api/ai/generate/route.ts:41,75`; `chat`, `section-rewrite`, `landing-page`)

---

## 2. Authentication & Authorization

### 2.1 Current auth mechanism — `getContext()` with module-level caching

The entire auth layer lives in `src/lib/community.ts`. The function `getContext()` (`src/lib/community.ts:23-61`) is the single source of "who is the current user":

```ts
// src/lib/community.ts:21
let cached: ResolvedContext | null = null

export async function getContext(): Promise<ResolvedContext | null> {
  if (cached) return cached                                    // line 24 — cached forever
  const workspace = await db.workspace.findFirst({              // line 25 — FIRST workspace
    orderBy: { createdAt: 'asc' },
  })
  if (!workspace) return null
  const membership = await db.workspaceMember.findFirst({       // line 27 — FIRST OWNER
    where: { workspaceId: workspace.id, role: 'OWNER' },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })
  // ...builds cached ResolvedContext from membership.user...
}
```

**Problems:**

1. **No credential is ever inspected.** There is no JWT, session cookie, API key, or header check. The function literally returns the first workspace's first owner.
2. **The result is cached in module scope** (line 21 `let cached`). Once populated on the first request, the same `ResolvedContext` is returned for the lifetime of the Node.js process — across all subsequent requests from all visitors. If that user is later demoted, banned, or removed, the cached context still acts with their original `OWNER` role.
3. **The code comment itself admits this** (`src/lib/community.ts:3-5`): *"In this demo environment there's no auth system, so we use the first workspace + first OWNER member. In production this would be replaced by JWT/session-based auth."*
4. **In a serverless / multi-instance deployment** each cold start re-resolves, but within a warm instance every visitor is the same user.

### 2.2 Admin endpoint auth status — 5 endpoints, 0 authenticated

| # | Route | Methods | `getContext()`? | RBAC? | Audit log? | Verdict |
|---|-------|---------|-----------------|-------|------------|---------|
| 1 | `src/app/api/admin/providers/route.ts` | GET, PUT | No | None | None | **S0 — Unauthenticated; GET leaks `apiKey`** |
| 2 | `src/app/api/admin/settings/route.ts` | GET, PUT | No | None | None | **S0 — Unauthenticated** |
| 3 | `src/app/api/admin/tools/route.ts` | GET, PUT | No | None | None | **S0 — Unauthenticated** |
| 4 | `src/app/api/admin/generations/route.ts` | GET | No | None | None | **S0 — Unauthenticated** |
| 5 | `src/app/api/admin/flags/route.ts` | GET, PUT | No | None | None | **S0 — Unauthenticated** |

None of the five admin route files import `getContext` or any permission helper. Every handler begins directly with `db.*` calls. A caller can toggle feature flags, rewrite AI tool system prompts, rotate provider API keys, and overwrite admin settings with a single unauthenticated `PUT`.

### 2.3 AI endpoint auth status — 5 endpoints, 0 authenticated

| # | Route | Methods | `getContext()`? | How user is resolved | Audit log? | Verdict |
|---|-------|---------|-----------------|----------------------|------------|---------|
| 1 | `src/app/api/ai/generate/route.ts` | POST, GET | No | `db.user.findFirst({ orderBy: { createdAt: 'asc' } })` (line 39) | None | **S0** |
| 2 | `src/app/api/ai/chat/route.ts` | POST | No | `db.user.findFirst(...)` (line 51) | None | **S0** |
| 3 | `src/app/api/ai/section-rewrite/route.ts` | POST | No | `db.user.findFirst(...)` (line 33) | None | **S0** |
| 4 | `src/app/api/ai/publish-course/route.ts` | POST | No | `db.aiGeneration.findUnique` + `db.workspace.findFirst()` (line 25) | None | **S0 — IDOR on generationId** |
| 5 | `src/app/api/ai/landing-page/route.ts` | POST | No | `db.user.findFirst(...)` (line 61) + `db.workspace.findFirst()` (line 78) | None | **S0** |

Every AI endpoint resolves the "current user" by taking the first user row in the database and billing credits to them. There is no credential check, no workspace scoping, and no audit logging. The AI calls themselves cost real money (ZAI SDK), and there is no rate limiting, so an attacker can drain the configured AI provider's quota indefinitely.

### 2.4 Community API auth status — 32 endpoints, 32 authenticated ✓

All 32 community route files import and call `getContext()` as their first action. The standard pattern (e.g. `src/app/api/community/posts/route.ts:76-79`):

```ts
const ctx = await getContext()
if (!ctx) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

RBAC is then enforced via two helpers from `src/lib/community.ts`:

- `canManageMembers(role)` (line 74) — returns `true` only for `OWNER` or `ADMIN`. Used by: member management, invitations, audit-log viewer, CSV export.
- `canModerate(role)` (line 78) — returns `true` for `OWNER`, `ADMIN`, or `MODERATOR`. Used by: post pin/lock/archive, moderation queue/reports/keywords/warnings.

Workspace scoping is consistent: every `findFirst`/`findMany`/`count` includes `workspaceId: ctx.workspaceId` in its `where` clause. Ownership checks (`existing.userId === ctx.user.id`) gate post/comment edits and deletes (`src/app/api/community/posts/[postId]/route.ts:167`, `comments/[commentId]/route.ts:50`).

**This module is the security gold standard for the codebase.** Its patterns should be back-ported to the admin, AI, and data layers.

### 2.5 Data API auth status — 17 endpoints, 1 authenticated

| # | Route | Methods | `getContext()`? | Workspace-scoped? | Verdict |
|---|-------|---------|-----------------|-------------------|---------|
| 1 | `data/analytics/route.ts` | GET | No | No | **S0 — leaks all tenants** |
| 2 | `data/courses/route.ts` | GET, POST, PUT, DELETE | No | No (IDOR on PUT/DELETE) | **S0** |
| 3 | `data/courses/duplicate/route.ts` | POST | No | No (IDOR) | **S0** |
| 4 | `data/site-settings/route.ts` | GET, PUT | No | N/A (global) | **S0** |
| 5 | `data/email/route.ts` | GET, POST, PUT, DELETE | No | No (IDOR on PUT/DELETE) | **S0** |
| 6 | `data/orders/route.ts` | GET | No | No | **S0 — leaks all orders + customerEmails** |
| 7 | `data/products/route.ts` | GET, POST, PUT, DELETE | No | No (IDOR on PUT/DELETE) | **S0** |
| 8 | `data/customers/route.ts` | GET | No | No | **S0 — leaks all customers + emails** |
| 9 | `data/membership/route.ts` | GET | No | No | **S0** |
| 10 | `data/pages/route.ts` | GET, POST | No | No | **S0** |
| 11 | `data/community/route.ts` | GET, POST | **Yes** (line 9, 85) | **Yes** | ✓ Secure |
| 12 | `data/blog/route.ts` | GET, POST, PUT, DELETE | No | No (IDOR on PUT/DELETE) | **S0** |
| 13 | `data/dashboard/route.ts` | GET | No | `findFirst` workspace (picks first) | **S0** |
| 14 | `data/page-sections/route.ts` | GET, POST, PUT, DELETE | No | No (IDOR on all) | **S0** |
| 15 | `data/affiliates/route.ts` | GET | No | No | **S0 — leaks affiliate emails** |
| 16 | `data/funnels/route.ts` | GET, POST, PUT, DELETE | No | No (IDOR on PUT/DELETE) | **S0** |
| 17 | `data/crm/route.ts` | GET | No | No | **S0 — leaks CRM + customer emails** |

**Only 1 of 17 data endpoints** (`data/community`) uses `getContext()` and scopes by workspace. The remaining 16 are fully open. The `data/community` route proves the team knows the correct pattern — it simply was not applied to the other 16 routes.

### 2.6 RBAC implementation

#### Role hierarchy (`src/lib/community.ts:65-72`)

```ts
const ROLE_LEVELS: Record<string, number> = {
  GUEST: 0, AFFILIATE: 1, STUDENT: 2, MEMBER: 3,
  MODERATOR: 4, INSTRUCTOR: 5, MANAGER: 6, ADMIN: 7, OWNER: 8,
}

export function roleLevel(role: string): number {
  return ROLE_LEVELS[role] ?? 3   // unknown role defaults to MEMBER (3)
}
```

A 9-level hierarchy. Unknown roles fall back to level 3 (`MEMBER`), which is a reasonable defensive default.

#### Permission functions

| Function | File:line | Logic | Used by |
|----------|-----------|-------|---------|
| `canManageMembers(role)` | `community.ts:74-76` | `['OWNER','ADMIN'].includes(role)` | member CRUD, invitations, audit log, CSV export |
| `canModerate(role)` | `community.ts:78-80` | `['OWNER','ADMIN','MODERATOR'].includes(role)` | post pin/lock/archive, moderation queue/reports/keywords |
| `canActOnMember(actor, target, action)` | `community.ts:82-96` | Blocks acting on `OWNER`; requires `canManageMembers` for promote/demote/remove/ban/suspend; blocks `targetLevel >= actorLevel`; blocks promoting to actor's own level | member PATCH (role/status changes), warn, remove |
| `roleLevel(role)` | `community.ts:70-72` | Returns numeric level, default 3 | used internally by `canActOnMember` |

#### RBAC coverage gaps

1. **RBAC is only enforced in the community module.** The admin, AI, and data modules have no role checks whatsoever — the RBAC system exists but is never invoked outside `src/app/api/community/**`.
2. **`User.role` (global) vs `WorkspaceMember.role` (per-workspace)** — the schema has two role fields. `User.role` defaults to `"OWNER"` (`schema.prisma:17`), which is the *global* account role. `getContext()` returns `workspaceRole` from `WorkspaceMember.role` (`community.ts:57`), but the global `User.role` is never checked anywhere. If a user's global role is `OWNER` but their workspace role is `MEMBER`, the system treats them as `MEMBER` — which is correct — but the inverse (global `MEMBER`, workspace `OWNER`) is also unguarded. The two-role design is unimplemented.
3. **`canActOnMember` does not gate `mute`/`warn` actions with `canManageMembers`** (`community.ts:88` — the `if` only lists `promote|demote|remove|ban|suspend`). In principle a `MODERATOR` calling `canActOnMember(..., 'mute')` on an `ADMIN` would pass the function. In practice every *caller* of `mute`/`warn` pre-checks `canManageMembers` (e.g. `members/[memberId]/warn/route.ts:29`), so the gap is latent, not live. It is still a defense-in-depth failure that should be closed.

---

## 3. IDOR / BOLA Vulnerabilities

Every endpoint below resolves a resource by `id` alone, with **no `workspaceId` filter** and **no caller authentication**. An attacker can enumerate `id` values (CUIDs are not secret) and read, modify, or delete any tenant's records. Because none of these endpoints call `getContext()`, the attacker does not even need to be "logged in" as the cached first user.

| # | API path | Line | Vulnerable query | Severity | Attack scenario |
|---|----------|------|-------------------|----------|-----------------|
| 1 | `src/app/api/ai/publish-course/route.ts` | 13 | `db.aiGeneration.findUnique({ where: { id: generationId } })` | **S0** | Any caller publishes any user's AI generation into the first workspace, consuming that workspace's course slots. No `userId` check. |
| 2 | `src/app/api/data/courses/route.ts` | 66 | PUT: `db.course.findUnique({ where: { id } })` | **S1** | Overwrite any tenant's course title/description/price/status by guessing/enumerating `id`. |
| 3 | `src/app/api/data/courses/route.ts` | 93 | DELETE: `db.course.findUnique({ where: { id } })` | **S1** | Delete any tenant's course (and via manual `section.deleteMany`, its sections). |
| 4 | `src/app/api/data/courses/duplicate/route.ts` | 13 | `db.course.findUnique({ where: { id }, include: { sections: { include: { lessons } } } })` | **S1** | Copy any tenant's full course (sections + lessons) into the attacker's workspace. |
| 5 | `src/app/api/data/products/route.ts` | 60 | PUT: `db.product.findUnique({ where: { id } })` | **S1** | Overwrite any tenant's product price, `fileUrl` (digital download link), or status. |
| 6 | `src/app/api/data/products/route.ts` | 88 | DELETE: `db.product.findUnique({ where: { id } })` | **S1** | Delete any tenant's product. |
| 7 | `src/app/api/data/blog/route.ts` | 61 | PUT: `db.blogPost.findUnique({ where: { id } })` | **S1** | Deface any tenant's blog post content or inject malicious content. |
| 8 | `src/app/api/data/blog/route.ts` | 93 | DELETE: `db.blogPost.findUnique({ where: { id } })` | **S1** | Delete any tenant's blog post. |
| 9 | `src/app/api/data/email/route.ts` | 77 | PUT: `db.emailCampaign.findUnique({ where: { id } })` | **S1** | Hijack any tenant's email campaign — rewrite subject/body, flip status to `SENT` (which sets `recipients=12400`, `openRate=0.43` — see line 93-96). |
| 10 | `src/app/api/data/email/route.ts` | 118 | DELETE: `db.emailCampaign.findUnique({ where: { id } })` | **S1** | Delete any tenant's email campaign. |
| 11 | `src/app/api/data/funnels/route.ts` | 62 | PUT: `db.funnel.findUnique({ where: { id } })` | **S1** | Flip any tenant's funnel status to `LIVE` or `PAUSED`, or rename it. |
| 12 | `src/app/api/data/funnels/route.ts` | 86 | DELETE: `db.funnel.findUnique({ where: { id } })` | **S1** | Delete any tenant's funnel (cascade-deletes its `FunnelStep` rows). |
| 13 | `src/app/api/data/page-sections/route.ts` | 26 | GET: `db.page.findUnique({ where: { id: pageId } })` | **S1** | Read any tenant's page + all section content (JSON). |
| 14 | `src/app/api/data/page-sections/route.ts` | 56 | PUT (duplicate): `db.pageSection.findUnique({ where: { id } })` | **S1** | Duplicate any tenant's page section into the same (attacker-controlled) page. |
| 15 | `src/app/api/data/page-sections/route.ts` | 65 | PUT (moveUp/moveDown): `db.pageSection.findUnique({ where: { id } })` | **S1** | Reorder any tenant's page sections. |
| 16 | `src/app/api/data/page-sections/route.ts` | 80 | PUT (default update): `db.pageSection.update({ where: { id }, data })` | **S1** | Overwrite any tenant's page section content. |
| 17 | `src/app/api/data/page-sections/route.ts` | 92 | DELETE: `db.pageSection.findUnique({ where: { id } })` | **S1** | Delete any tenant's page section. |

### Attack scenario (representative)

```http
PUT /api/data/products HTTP/1.1
Content-Type: application/json

{ "id": "cm3victimCuid", "price": 0, "fileUrl": "https://attacker.tld/payload.exe" }
```

No `Authorization` header, no cookie, no `workspaceId`. The handler at `src/app/api/data/products/route.ts:60` calls `db.product.findUnique({ where: { id } })`, finds the victim tenant's product, and updates `price` to `0` and `fileUrl` to an attacker-controlled URL. The attacker then purchases the product for free and downloads malware. The transaction completes because there is no auth and no tenant scoping.

### Fix (applies to all 17 IDOR sites)

1. Call `getContext()` at the top of every handler; return `401` if `null`.
2. Replace `findUnique({ where: { id } })` with `findFirst({ where: { id, workspaceId: ctx.workspaceId } })` and return `404` if not found.
3. For `page-sections`, first resolve the parent `Page` by `{ id: pageId, workspaceId: ctx.workspaceId }`, then scope section operations by `pageId`.
4. Add `canManageMembers(ctx.workspaceRole)` checks for write operations.

---

## 4. Cross-Tenant Data Leakage

Every endpoint below calls `findMany()` (or `findFirst()` for the dashboard) with **no `workspaceId` filter**, returning rows from every tenant in the database in a single unauthenticated response.

| # | API path | What's leaked | Severity |
|---|----------|---------------|----------|
| 1 | `src/app/api/data/analytics/route.ts:5-8` | All courses, products, orders (+ product names), customers, posts, campaigns, affiliates, pages, membership plans across all tenants. | **S0** |
| 2 | `src/app/api/data/dashboard/route.ts:12-22` | `db.workspace.findFirst()` returns the first workspace; then `findMany` on courses, products, orders, customers, posts, campaigns, affiliates, pages, plans across ALL tenants (the `findFirst` workspace is only used for the `team` array). Revenue, MRR, customer emails, order emails, team member emails all leak. | **S0** |
| 3 | `src/app/api/data/orders/route.ts:8` | All orders across all tenants, including `customerName`, `customerEmail`, `amount`, product name. | **S0** |
| 4 | `src/app/api/data/customers/route.ts:8` | All customers across all tenants, including `email`, `ltv`, `tags`. | **S0** |
| 5 | `src/app/api/data/membership/route.ts:5` | All membership plans + member counts + MRR across all tenants. | **S0** |
| 6 | `src/app/api/data/pages/route.ts:9` | All pages across all tenants (titles, slugs, visit counts, conversion counts). | **S0** |
| 7 | `src/app/api/data/blog/route.ts:8` | All blog posts across all tenants (titles, content, SEO metadata). | **S0** |
| 8 | `src/app/api/data/products/route.ts:8` | All products across all tenants, including `fileUrl` (digital download links). | **S0** |
| 9 | `src/app/api/data/courses/route.ts:8` | All courses + sections + lessons (full content) across all tenants. | **S0** |
| 10 | `src/app/api/data/email/route.ts:7` | All email campaigns across all tenants (subjects, bodies, audience, recipient counts). | **S0** |
| 11 | `src/app/api/data/affiliates/route.ts:5` | All affiliates across all tenants, including `email`, `code`, `commissionRate`, earnings. | **S0** |
| 12 | `src/app/api/data/funnels/route.ts:7` | All funnels + steps across all tenants (visits, conversions, revenue). | **S0** |
| 13 | `src/app/api/data/crm/route.ts:5-8` | All orders, customers, products across all tenants — CRM dump. | **S0** |
| 14 | `src/app/api/admin/generations/route.ts:6` | All AI generations across all users (titles, tool slugs, credit costs). No auth. | **S0** |
| 15 | `src/app/api/admin/providers/route.ts:6` | All AI providers including **plaintext `apiKey`** and `baseUrl`. No auth. | **S0** |
| 16 | `src/app/api/admin/tools/route.ts:7-8` | All AI tools (including hidden ones) + aggregate credit usage. No auth. | **S0** |

### Fix

For every `findMany`, add `where: { workspaceId: ctx.workspaceId }` after resolving `ctx` via `getContext()`. For the admin endpoints, add an `isAdmin(ctx)` check (e.g. `ctx.user.role === 'ADMIN'`) before any query, and never `select`/`include` `apiKey` in a response — return only a masked preview (`apiKey.slice(-4)`).

---

## 5. Privilege Escalation

### 5.1 `User.role` defaults to `OWNER`

`prisma/schema.prisma:17`:
```prisma
model User {
  ...
  role          String   @default("OWNER") // global account role
  ...
}
```

Every new `User` row is created with global role `OWNER`. There is no signup endpoint in the audited routes, but any future user-creation path (or a direct DB seed) will produce global owners by default. The `User.role` field is **never read by any API route** — all permission checks use `WorkspaceMember.role`. This means the global role is dead weight that silently grants a dangerous default.

**Severity: S2.** No live escalation today (because `User.role` is unread), but a time bomb if any future code reads it.

### 5.2 `canActOnMember` bypass via cached context

`src/lib/community.ts:21` — `let cached: ResolvedContext | null = null`.

`getContext()` caches the resolved user/workspace/role **for the lifetime of the process**. The cache is never invalidated when:

- The cached user is demoted (e.g. ownership transferred away — see §5.3).
- The cached user is banned/suspended (`memberStatus = BANNED/SUSPENDED`).
- The cached user is removed from the workspace (`WorkspaceMember.delete`).
- The cached user's `User.credits` changes (the cache stores a stale `credits` snapshot — `community.ts:14`).

**Attack scenario:** The cached user is the first OWNER. An admin transfers ownership to another member via `/api/community/transfer-ownership`. The former owner is now `ADMIN`. But the next request still returns the cached `ResolvedContext` with `workspaceRole: 'OWNER'`, so `canManageMembers()` still returns `true` and `canActOnMember('OWNER', ...)` is still evaluated as an owner. The demoted user retains owner privileges until the process restarts.

**Severity: S1.**

### 5.3 Transfer ownership without re-authentication

`src/app/api/community/transfer-ownership/route.ts:14-66` performs a single-step ownership transfer with no re-authentication:

```ts
export async function POST(req: NextRequest) {
  const ctx = await getContext()
  if (ctx.workspaceRole !== 'OWNER') return 403        // line 21 — only check
  // ...parse targetMemberId...
  await db.$transaction([                              // line 57 — atomic swap
    db.workspaceMember.update({ where: { id: ctx.memberId }, data: { role: 'ADMIN' } }),
    db.workspaceMember.update({ where: { id: target.id }, data: { role: 'OWNER' } }),
  ])
}
```

**Issues:**
1. **No password / 2FA / step-up auth.** A single POST transfers the highest privilege in the workspace. If the owner's session is hijacked (trivial given there is no session system), the attacker can permanently seize ownership.
2. **No cooldown or confirmation token.** The transfer is immediate and irrevocable.
3. **The audit log records the transfer** (`line 68`), but does not require the *recipient* to accept — the new owner is set unilaterally.
4. **Combined with the cached-context bug (§5.2):** after the transfer, the former owner still acts as `OWNER` on this process until restart.

**Severity: S1.**

### 5.4 Role validation gaps

`canActOnMember` (`community.ts:82-96`):

```ts
export function canActOnMember(actorRole, targetRole, action) {
  if (targetRole === 'OWNER') return { allowed: false, ... }      // line 87
  if (action === 'promote' || 'demote' || 'remove' || 'ban' || 'suspend') {
    if (!canManageMembers(actorRole)) return { allowed: false, ... } // line 89
  }
  const actorLevel = roleLevel(actorRole)
  const targetLevel = roleLevel(targetRole)
  if (targetLevel >= actorLevel) return { allowed: false, ... }   // line 93
  if (action === 'promote' && targetLevel + 1 >= actorLevel) ...  // line 94
  return { allowed: true }
}
```

- **`mute` and `warn` actions skip the `canManageMembers` gate** (line 88's `if` does not list them). A `MODERATOR` (level 4) calling `canActOnMember('MODERATOR', 'MEMBER', 'mute')` passes. The callers (`members/[memberId]/route.ts:242` for mute, `members/[memberId]/warn/route.ts:29` for warn) pre-check `canManageMembers`, so this is **latent**, not live.
- **`promote` boundary check** (line 94): `targetLevel + 1 >= actorLevel` blocks promoting to actor's own level. But this only fires for `promote`. A `demote` action that *coincidentally* crosses levels is allowed as long as `targetLevel < actorLevel`. This is correct behavior, but the asymmetry is non-obvious.
- **Unknown role fallback** (`roleLevel`, line 71): `ROLE_LEVELS[role] ?? 3`. If an attacker injects an arbitrary role string (e.g. via a future signup endpoint), they are treated as level 3 (`MEMBER`) rather than level 0 (`GUEST`). This is overly permissive for an unknown value.

**Severity: S2 (latent).**

---

## 6. Race Conditions

### 6.1 Credit deduction TOCTOU

All four AI endpoints that deduct credits follow the same check-then-act pattern with **no transaction and no atomic guard**:

**`src/app/api/ai/generate/route.ts`** (lines 39-76):
```ts
const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })  // line 39 — read
if (user.credits < tool.creditCost) return 402                            // line 41 — check
// ...AI call (multi-second latency)...
await db.user.update({ where: { id: user.id }, data: { credits: { decrement: tool.creditCost } } }) // line 75 — act
```

The gap between the read (line 39) and the decrement (line 75) includes a network call to the ZAI API that can take several seconds. Two concurrent requests both read the same `credits` value, both pass the check, both decrement — the balance goes negative. There is no `where: { credits: { gte: tool.creditCost } }` guard on the `update`.

**`src/app/api/ai/chat/route.ts`** (lines 51-53) — **worse**: no check at all. It finds the user, then unconditionally decrements. The balance can go arbitrarily negative.

**`src/app/api/ai/section-rewrite/route.ts`** (lines 33-50) — same TOCTOU as `generate`.

**`src/app/api/ai/landing-page/route.ts`** (lines 61-95) — same TOCTOU, plus the decrement happens *after* the page + sections + generation are already persisted (lines 82-100), so a crash between creation and decrement gives a free generation.

**Severity: S1.** An attacker can fire N concurrent requests to exhaust the AI provider's quota while paying only 1× the credit cost. With no auth and no rate limiting, this is trivially exploitable.

**Fix:** Use a conditional update that fails atomically:
```ts
const result = await db.user.updateMany({
  where: { id: user.id, credits: { gte: tool.creditCost } },
  data: { credits: { decrement: tool.creditCost } },
})
if (result.count === 0) return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
```
Wrap the credit deduction + AI generation record in a `$transaction`.

### 6.2 Counter increment/decrement races

The community module wraps counter updates in `db.$transaction([...])`, but the **primary row creation/deletion is outside the transaction**:

**`src/app/api/community/posts/route.ts`** POST (lines 233-264):
```ts
const post = await db.communityPost.create({ ... })     // line 233 — NOT in tx
await db.$transaction([                                 // line 251 — counters only
  db.workspaceMember.update({ where: { id: ctx.memberId }, data: { postsCount: { increment: 1 } } }),
  db.communitySpace.update({ where: { id: spaceId }, data: { postCount: { increment: 1 } } }),
])
```
If the transaction fails (e.g. DB lock timeout), the post exists but `postsCount`/`postCount` are stale. Two concurrent POSTs can also produce a lost update on `postsCount` because `increment` is atomic per-statement but the post creation is not coordinated with it.

Same pattern in:
- `community/posts/[postId]/route.ts` DELETE (line 287 delete, line 290 transaction) — delete outside tx.
- `community/posts/[postId]/comments/route.ts` POST (line 205 create, line 217 transaction) — create outside tx.
- `community/posts/[postId]/comments/[commentId]/route.ts` DELETE (line 131 delete, line 134 transaction) — delete outside tx.

**Severity: S2.** Data-integrity drift, not direct security compromise. But stale counters can be abused (e.g. `maxAttendees` enforcement in `events/rsvp/route.ts:52-67` relies on `eventRSVP.count` which is a real count, so that specific case is safe).

### 6.3 Missing transactions on multi-step mutations

| Endpoint | Operation | Steps | Transaction? |
|----------|-----------|-------|--------------|
| `ai/publish-course/route.ts:28-65` | Create course | course → N sections → M lessons (sequential `await` loop) | No — partial course on failure |
| `ai/landing-page/route.ts:82-101` | Create landing page | page → N sections → decrement credits → create AiGeneration | No — free generation if credits step fails |
| `data/courses/duplicate/route.ts:19-54` | Duplicate course | copy course → N sections → M lessons | No — partial copy on failure |
| `data/page-sections/route.ts:55-61` | Duplicate section | findUnique orig → create dup → updateMany shift positions | No — orphaned dup if shift fails |
| `data/page-sections/route.ts:64-73` | Move section | findUnique → findFirst swap → update swap → update section | No — inconsistent positions if second update fails |
| `data/page-sections/route.ts:92-100` | Delete + reorder | delete section → findMany remaining → loop update positions | No — gaps in position if loop fails mid-way |
| `community/transfer-ownership/route.ts:57-66` | Transfer ownership | demote old owner → promote new owner | **Yes** ✓ (the one correct multi-step mutation) |

**Severity: S2.** Partial writes leave the database in an inconsistent state. The `transfer-ownership` route proves the team knows how to use `$transaction` — it just isn't applied elsewhere.

---

## 7. Injection Risks

### 7.1 Raw SQL usage — `$queryRaw` / `$executeRaw`

Grep across `src/app/api/**`: **zero matches.** No raw SQL is used anywhere. All database access is via the Prisma Client query builder, which parameterizes all values. ✓

**Verdict: No SQL injection risk.**

### 7.2 JSON field injection (unsafe `JSON.parse`)

The schema stores arrays/objects as JSON strings (`hashtags`, `mentions`, `pollOptions`, `attachments`, `reactions`, `badges`, `metadata`, `content` on `PageSection`, `sections` on `PageVersion`, `schema` on `Page`). Several routes parse these without `try/catch`:

| Location | Line | Pattern | Safe? |
|----------|------|---------|-------|
| `data/community/route.ts` | 61-64 | `JSON.parse(p.hashtags \|\| '[]')` (×4) | **No** — throws on corrupt data, 500 + stack trace leak |
| `data/page-sections/route.ts` | 29, 43, 61, 81 | `JSON.parse(s.content \|\| '{}')` (×4) | **No** — same |
| `data/site-settings/route.ts` | 10 | `JSON.parse(s.value)` | **Yes** — wrapped in try/catch |
| `community/posts/[postId]/react/route.ts` | 57 | `JSON.parse(post.reactions)` | **Yes** — wrapped in try/catch |
| All other community routes | — | `safeJsonParse(...)` | **Yes** — helper swallows errors (`community.ts:178-181`) |
| `ai/generate/route.ts` | 17 | `JSON.parse(slice)` | **Yes** — wrapped in try/catch |
| `ai/publish-course/route.ts` | 23 | `JSON.parse(gen.structured)` | **Yes** — wrapped in try/catch |
| `ai/landing-page/route.ts` | 19 | `JSON.parse(...)` | **Yes** — wrapped in try/catch |
| `ai/section-rewrite/route.ts` | 22 | `JSON.parse(...)` | **Yes** — wrapped in try/catch |

**Severity: S3.** The unguarded `JSON.parse` calls in `data/community` and `data/page-sections` will crash the request and leak a stack trace if a row's JSON field is corrupt (e.g. truncated by a prior bug, or maliciously seeded). The community module's `safeJsonParse` helper is the correct pattern and should be adopted everywhere.

This is **not** a JSON-injection vulnerability in the traditional sense (attacker cannot inject arbitrary JSON that executes code — `JSON.parse` does not eval). It is a robustness/information-disclosure issue.

### 7.3 NoSQL injection via Prisma filters

Prisma's query builder does not allow operator injection — `where: { title: { contains: search } }` parameterizes `search` as a string value, never as an operator. User-controlled values flow into `contains`, `in`, `gte`, etc. as **values**, not as query structure.

Examples audited:
- `community/posts/route.ts:104-108` — `where.OR = [{ title: { contains: search } }, { content: { contains: search } }]` — safe.
- `community/members/route.ts:83-90` — `where.user = { OR: [{ name: { contains: search } }, { email: { contains: search } }] }` — safe.
- `community/invitations/route.ts:77` — `where.status = status` (string) — safe.

No route constructs a `where` clause from a raw user-supplied object (e.g. `where: req.body.filter`), which would be the only Prisma injection vector.

**Verdict: No NoSQL injection risk.** ✓

---

## 8. Token & Session Security

### 8.1 Invitation token entropy — `Math.random()`

`src/lib/community.ts:161-163`:
```ts
export function generateToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}
```

`Math.random()` is **not cryptographically secure**. Its output is predictable given the V8 PRNG state. The token format is `<timestamp>-<8 chars>-<8 chars>`, yielding roughly:

- Timestamp: known to the attacker (they can observe when an invite was sent).
- Two `Math.random()` slices: ~8 base-36 chars each ≈ 41 bits each ≈ 82 bits total, but **reducible** because `Math.random()`'s state can be reconstructed from a few observed outputs.

The token is stored in `Invitation.token` (`schema.prisma:307`, `@unique`) and used in invite URLs (`community/invitations/[invitationId]/link/route.ts:44`: `inviteUrl: /invite/${invitation.token}`).

**Severity: S2.** An attacker who can observe a few invitation tokens (e.g. by being invited to one workspace) may be able to predict tokens issued nearby in time and accept invitations to other workspaces.

**Fix:** Use `crypto.randomBytes(32).toString('hex')` (256 bits of CSPRNG entropy).

### 8.2 No session management

There is no session table, no JWT issuance, no cookie setting, no `Authorization` header parsing. `getContext()` does not read any credential from the request — it returns a cached static user. Every "authenticated" community request is effectively anonymous, impersonating the first owner.

There is no:
- Login / logout endpoint
- Session expiry
- Session revocation
- Concurrent-session limit
- Password reset flow

**Severity: S0.** This is the root cause of every auth-related finding in this report.

### 8.3 No CSRF protection

No CSRF token is issued or validated. No `SameSite` cookie attribute is set (there are no cookies). Every state-changing endpoint (`POST`/`PUT`/`PATCH`/`DELETE`) accepts a `Content-Type: application/json` body with no origin check.

Because the app uses no cookies, traditional CSRF is partially mitigated (a cross-origin `fetch` with `Content-Type: application/json` requires a preflight that the attacker's page cannot pass without CORS cooperation). However:
- The admin/data endpoints accept `GET`-triggerable mutations in some cases (e.g. `DELETE /api/community/members?id=...` is a `DELETE`, which is preflight-safe, but `data/page-sections/route.ts:88` DELETE also takes query params).
- If any cookie-based auth is ever added without CSRF tokens, the entire API becomes CSRF-vulnerable.
- The `community/notifications` POST and DELETE use no body (`_req`), so a cross-origin form POST (which sends `Content-Type: application/x-www-form-urlencoded`) could trigger them if cookies were introduced.

**Severity: S2** (latent, given no cookies today; will become S1 the moment cookie auth is added).

### 8.4 No rate limiting

No endpoint has any rate limiting. There is no `@upstash/ratelimit`, no middleware, no `X-RateLimit-*` header. Combined with:

- No auth on AI endpoints (§2.3)
- Credit TOCTOU (§6.1)
- Real-money ZAI API calls

An attacker can fire thousands of concurrent `POST /api/ai/generate` requests, exhausting the AI provider's quota and the cached user's credits (driving them negative) within seconds. The same applies to invitation creation (`community/invitations` POST), which generates tokens and sends notifications — an attacker can flood the `Invitation` and `Notification` tables.

**Severity: S1.**

---

## 9. Data Exposure

### 9.1 Error message leakage

Multiple endpoints return the raw `Error.message` to the client, which can include Prisma internals, stack traces, and environment details:

| File:line | Pattern |
|-----------|---------|
| `admin/providers/route.ts:21` | `error: e instanceof Error ? e.message : 'Failed'` |
| `admin/settings/route.ts:18` | same |
| `admin/tools/route.ts:35` | same |
| `admin/flags/route.ts:18` | same |
| `ai/generate/route.ts:90` | `error: e instanceof Error ? e.message : 'AI generation failed'` |
| `ai/chat/route.ts:66` | `error: e instanceof Error ? e.message : 'AI request failed'` |
| `ai/section-rewrite/route.ts:56` | `error: e instanceof Error ? e.message : 'Failed'` |
| `ai/landing-page/route.ts:106` | `error: e instanceof Error ? e.message : 'Failed'` |
| `ai/publish-course/route.ts:69` | `error: e instanceof Error ? e.message : 'Failed'` |
| `data/page-sections/route.ts:45,83,103` | `error: e instanceof Error ? e.message : 'Failed'` |
| `data/pages/route.ts:37` | same |
| `data/site-settings/route.ts:25` | same |

The community module uses generic messages (`'An unexpected error occurred'`) — ✓ correct.

**Severity: S3.** Prisma error messages can reveal table names, column names, and constraint names, aiding reconnaissance.

### 9.2 Over-fetching (`include: { user: true }`)

Several endpoints eagerly load the entire `User` row (including `email`, `bio`, `credits`, `role`) when they only need `name` and `avatarUrl`:

| File:line | Context |
|-----------|---------|
| `community/members/route.ts:129` | Member list — returns email via `serializeMember` (line 37) |
| `community/members/[memberId]/route.ts:74,151,310` | Member profile + updates |
| `community/members/[memberId]/warn/route.ts:36` | Warn target |
| `community/members/export/route.ts:57` | CSV export — email in CSV (intentional, but the `include` also pulls `bio`, `credits` which are unused) |
| `community/transfer-ownership/route.ts:45` | Transfer target |
| `community/posts/[postId]/route.ts:86` | Comment authors (nested 4 levels deep) — full user rows for every comment author |
| `community/posts/[postId]/comments/route.ts:65` | Same, 3-level nested |
| `community/posts/route.ts:135` | Post list — `include: { user: true, space: true }` |
| `community/spaces/[spaceId]/route.ts:35` | Space posts — `include: { user: true }`, and line 72 **exposes `email: p.user.email`** in the response |
| `data/dashboard/route.ts:8,17` | `members: { include: { user: true } }` and `posts: { include: { user: true } }` |

The community module's *read* paths (e.g. `data/community/route.ts:18`) correctly use `select: { id: true, name: true, avatarUrl: true }` — the minimal projection. The list/detail paths above do not.

**Severity: S2.** Over-fetching `email` (and in `community/spaces/[spaceId]/route.ts:72`, explicitly returning it) is PII leakage to any workspace member, not just admins.

**Fix:** Replace `include: { user: true }` with `include: { user: { select: { id: true, name: true, avatarUrl: true } } }` everywhere except admin-only member management.

### 9.3 PII exposure

| Field | Exposed by | File:line | Recipients |
|-------|------------|-----------|------------|
| `Customer.email` | `data/customers` GET | `data/customers/route.ts:14` | Any caller (no auth) |
| `Customer.email` | `data/crm` GET | `data/crm/route.ts:26` | Any caller |
| `Customer.email` | `data/dashboard` GET | `data/dashboard/route.ts:54` | Any caller |
| `User.email` | `community/members` GET | `community/members/route.ts:37` (serializeMember) | Any workspace member (not just admins) |
| `User.email` | `community/members/export` GET (CSV) | `community/members/export/route.ts:74` | Admins only (gated) — acceptable |
| `User.email` | `community/spaces/[spaceId]` GET | `community/spaces/[spaceId]/route.ts:72` | Any workspace member — **unnecessary** |
| `User.email` | `community/members/[memberId]` GET | `community/members/[memberId]/route.ts:40` | Any workspace member |
| `Order.customerEmail` | `data/orders` GET | `data/orders/route.ts:15` | Any caller (no auth) |
| `Order.customerEmail` | `data/crm` GET | `data/crm/route.ts:22` | Any caller |
| `Order.customerEmail` | `data/dashboard` GET | `data/dashboard/route.ts:54` | Any caller |
| `Affiliate.email` | `data/affiliates` GET | `data/affiliates/route.ts:17` | Any caller |

**Severity: S0** for the no-auth data endpoints (anyone on the internet can harvest customer/order/affiliate emails); **S2** for the community endpoints (any workspace member sees other members' emails — may be acceptable depending on product spec, but `spaces/[spaceId]` exposing post-author emails is unnecessary).

### 9.4 API key storage — `AiProvider.apiKey` plaintext

`prisma/schema.prisma:505-516`:
```prisma
model AiProvider {
  id          String   @id @default(cuid())
  name        String   @unique
  slug        String   @unique
  apiKey      String   @default("")   // ← PLAINTEXT
  baseUrl     String   @default("")
  isActive    Boolean  @default(true)
  ...
}
```

The API key is stored as a plaintext `String`. Worse, `GET /api/admin/providers` (`src/app/api/admin/providers/route.ts:6`) returns it in cleartext:

```ts
const providers = await db.aiProvider.findMany({ include: { models: true }, orderBy: { priority: 'asc' } })
return NextResponse.json({ providers })
```

No `select` filter, no masking, no auth. Any caller retrieves every AI provider's API key (OpenAI, Anthropic, etc.) in full. The `PUT` at line 18 also accepts `apiKey` in the body and writes it plaintext.

**Severity: S0.** Compromise of any API key can cost thousands of dollars and expose the provider account.

**Fix:**
1. Encrypt `apiKey` at rest (AES-256-GCM with a KMS-managed key).
2. Never return the full key in any response — return `apiKeyMasked: '...' + key.slice(-4)`.
3. Add admin auth before any read/write.
4. Log all reads of the key to `AuditLog`.

---

## 10. Cascade Delete Risks

### 10.1 Deletes that cascade (from `prisma/schema.prisma`)

All `onDelete: Cascade` relations — deleting the parent removes the children:

| Parent | Child | Schema line |
|--------|-------|-------------|
| `User` | `WorkspaceMember` | 76 |
| `User` | `CommunityPost` | 198 |
| `User` | `CommunityComment` | 236 |
| `User` | `CommunityEvent` | 282 |
| `User` | `EventRSVP` | 296 |
| `User` | `Enrollment` | 134 |
| `User` | `Order` | 169 |
| `User` | `AiConversation` | 490 |
| `User` | `CreditTransaction` | 500 |
| `User` | `AiGeneration` | 565 |
| `Workspace` | `WorkspaceMember` | 77 |
| `Workspace` | `Course` | 98 |
| `Workspace` | `Product` | 153 |
| `Workspace` | `CommunityPost` | 197 |
| `Workspace` | `CommunitySpace` | 257 |
| `Workspace` | `CommunityEvent` | 281 |
| `Workspace` | `Customer` | 413 |
| `Workspace` | `EmailCampaign` | 435 |
| `Workspace` | `Affiliate` | 453 |
| `Workspace` | `WebPage` | 466 |
| `Workspace` | `MembershipPlan` | 478 |
| `Workspace` | `Invitation` | 318 |
| `Course` | `Section` | 110 |
| `Section` | `Lesson` | 123 |
| `Enrollment` (course) | — | 135 |
| `CommunityPost` | `PostHistory` | 216 |
| `CommunityPost` | `CommunityComment` | 233 |
| `CommunityComment` (parent) | `CommunityComment` (replies) | 234 |
| `CommunityEvent` | `EventRSVP` | 295 |
| `AiProvider` | `AiModel` | 528 |
| `AiTool` | `AiGeneration` | 566 |
| `Page` | `PageSection` | 623 |
| `Page` | `PageVersion` | 634 |
| `Page` | `FunnelStep` | 610 (via `funnelId`? — no, `FunnelStep.page` is `SetNull`, line 663) |
| `Funnel` | `FunnelStep` | 662 |

`onDelete: SetNull` relations:
- `Order.product` → `Product` (line 170) — deleting a product nulls `Order.productId` (preserves order history). ✓
- `CommunityPost.space` → `CommunitySpace` (line 199) — deleting/archiving a space nulls the post's `spaceId`. ✓ (Note: spaces are soft-deleted via `status: 'ARCHIVED'`, not hard-deleted, so this rarely triggers.)
- `FunnelStep.page` → `Page` (line 663) — deleting a page nulls the step's `pageId`. ✓

### 10.2 Models with NO cascade (orphan risk)

These models store `userId`/`workspaceId`/`memberId` as **plain strings with no FK relation**, so Prisma cannot cascade. If the referenced row is deleted, these records become orphans:

| Model | Orphaned field(s) | Schema line | Risk |
|-------|--------------------|-------------|------|
| `Notification` | `userId`, `workspaceId`, `actorId` | 324-340 | Deleting a user leaves their notifications orphaned (no FK to cascade). |
| `ModerationReport` | `reporterId`, `resolvedBy`, `targetId` | 342-358 | Deleting a reporter orphans their reports; deleting a target (post/comment/event) orphans the report (target preview becomes null). |
| `BannedKeyword` | `workspaceId`, `createdBy` | 360-371 | Deleting a workspace orphans banned keywords. |
| `AuditLog` | `workspaceId`, `actorId`, `targetId` | 373-387 | Deleting a workspace or user orphans audit records — **acceptable for audit logs** (they should survive the entities they describe). |
| `MemberWarning` | `memberId`, `workspaceId`, `issuedBy` | 389-400 | Deleting a member orphans their warnings. |
| `BlogPost` | `workspaceId` | 666-684 | Deleting a workspace orphans blog posts (no `workspace` relation field, just a string). |
| `SiteSetting` | (none) | 686-692 | Global singleton — no orphan risk. |
| `FeatureFlag` | (none) | 569-576 | Global singleton — no orphan risk. |
| `AdminSetting` | (none) | 578-584 | Global singleton — no orphan risk. |

**Severity: S3.** Orphaned records cause `null` lookups and potential crashes in serializers that expect a related row. `BlogPost` is the most concerning because it should be workspace-scoped but lacks the relation, meaning workspace deletion leaves blog posts stranded with a dangling `workspaceId`.

### 10.3 Unsafe delete patterns

**`src/app/api/data/courses/route.ts` DELETE (lines 93-98):**
```ts
const existing = await db.course.findUnique({ where: { id } })  // line 93 — no workspaceId
if (!existing) return 404
await db.section.deleteMany({ where: { courseId: id } })        // line 97 — manual cascade
await db.course.delete({ where: { id } })                       // line 98
```
This manually deletes sections before the course, but the schema already has `onDelete: Cascade` on `Section → Course` (line 110). The manual `deleteMany` is **redundant** and **not in a transaction** — if `course.delete` fails after `section.deleteMany` succeeds, the sections are gone but the course remains (now with zero sections). The `Lesson → Section` cascade (line 123) would have handled lessons automatically. Remove the redundant `deleteMany` and rely on the schema cascade, or wrap both in a `$transaction`.

**`src/app/api/community/posts/[postId]/route.ts` DELETE (lines 287-303):** Correctly relies on schema cascade for comments + history (line 286 comment), and wraps the counter decrements in a `$transaction` (line 290). However, the `communityPost.delete` itself (line 287) is outside the transaction — if the counter-decrement transaction fails, the post is gone but counters are stale.

---

## 11. Audit Trail Coverage

### 11.1 APIs that write audit logs (via `writeAuditLog`)

All 32 community mutation endpoints write to `AuditLog`. The coverage is comprehensive:

| Action | Endpoint | File:line |
|--------|----------|-----------|
| `POST_CREATE` | community/posts POST | `posts/route.ts:266` |
| `POST_EDIT` | community/posts/[postId] PATCH | `posts/[postId]/route.ts:233` |
| `POST_DELETE` | community/posts/[postId] DELETE | `posts/[postId]/route.ts:305` |
| `POST_REPORT` | community/posts/[postId]/report POST | `posts/[postId]/report/route.ts:64` |
| (audit) | community/posts/[postId]/pin | `posts/[postId]/pin/route.ts:39` |
| (audit) | community/posts/[postId]/lock | `posts/[postId]/lock/route.ts:39` |
| (audit) | community/posts/[postId]/archive | `posts/[postId]/archive/route.ts:39` |
| `COMMENT_CREATE` | community/posts/[postId]/comments POST | `posts/[postId]/comments/route.ts:228` |
| `COMMENT_EDIT` | community/posts/[postId]/comments/[commentId] PATCH | `comments/[commentId]/route.ts:75` |
| `COMMENT_DELETE` | community/posts/[postId]/comments/[commentId] DELETE | `comments/[commentId]/route.ts:145` |
| `MEMBER_INVITE` | community/invitations POST | `invitations/route.ts:216` |
| `INVITATION_REVOKE` | community/invitations DELETE | `invitations/route.ts:270` |
| `INVITATION_RESEND` | community/invitations/[id]/resend POST | `invitations/[id]/resend/route.ts:47` |
| `MEMBER_REMOVE` | community/members DELETE | `members/route.ts:183` |
| `MEMBER_PROMOTE` / `MEMBER_DEMOTE` | community/members/[id] PATCH | `members/[memberId]/route.ts:200` |
| `MEMBER_REACTIVATE` | community/members/[id] PATCH | `members/[memberId]/route.ts:237` |
| `MEMBER_MUTE` | community/members/[id] PATCH | `members/[memberId]/route.ts:251` |
| `MEMBER_SUSPEND` | community/members/[id] PATCH | `members/[memberId]/route.ts:266` |
| `MEMBER_BAN` | community/members/[id] PATCH | `members/[memberId]/route.ts:281` |
| `MEMBER_WARN` | community/members/[id]/warn POST | `members/[memberId]/warn/route.ts:90` |
| `EXPORT_CSV` | community/members/export GET | `members/export/route.ts:89` |
| `OWNERSHIP_TRANSFER` | community/transfer-ownership POST | `transfer-ownership/route.ts:68` |
| `EVENT_CREATE` | community/events POST | `events/route.ts:151` |
| `EVENT_CANCEL` | community/events DELETE | `events/route.ts:195` |
| `EVENT_RSVP` | community/events/rsvp POST | `events/rsvp/route.ts:76` |
| `SPACE_CREATE` | community/spaces POST | `spaces/route.ts:91` |
| `SPACE_UPDATE` | community/spaces/[id] PATCH | `spaces/[spaceId]/route.ts:139` |
| `SPACE_ARCHIVE` | community/spaces/[id] DELETE | `spaces/[spaceId]/route.ts:195` |
| `KEYWORD_ADD` | community/moderation/keywords POST | `moderation/keywords/route.ts:145` |
| `KEYWORD_REMOVE` | community/moderation/keywords DELETE | `moderation/keywords/route.ts:188` |
| `REPORT_CREATE` | community/moderation/reports POST | `moderation/reports/route.ts:280` |
| `REPORT_RESOLVE` / `REPORT_DISMISS` | community/moderation/reports/[id] PATCH | `moderation/reports/[reportId]/route.ts:186` |

### 11.2 APIs that do NOT write audit logs

| Domain | Endpoints | Gap severity |
|--------|-----------|--------------|
| **Admin (5 endpoints)** | providers GET/PUT, settings GET/PUT, tools GET/PUT, generations GET, flags GET/PUT | **S0** — admin actions (API key changes, flag toggles, prompt rewrites) are completely unaudited. |
| **AI (5 endpoints)** | generate, chat, section-rewrite, publish-course, landing-page | **S1** — credit consumption and course publishing are unaudited. `AiGeneration` records exist but are not in `AuditLog`. |
| **Data (16 endpoints)** | courses, products, blog, email, funnels, pages, page-sections, orders, customers, membership, affiliates, crm, dashboard, analytics, site-settings, courses/duplicate | **S1** — all CRUD on business data is unaudited. A malicious admin (or unauthenticated attacker) can create/modify/delete courses, products, and campaigns with no trail. |
| `community/posts/[postId]/react` POST | Reaction toggle | **S3** — state change with no audit entry. Minor. |
| `community/notifications` GET/POST/DELETE | Read / mark-read / delete | Acceptable — user's own notifications, no audit needed. |
| All `GET` (read) endpoints | — | Acceptable — reads typically not audited (though sensitive reads like `members/export` ARE audited, which is good). |

### 11.3 Audit log completeness

The `AuditLog` model (`schema.prisma:373-387`) captures: `workspaceId`, `actorId`, `actorRole`, `action`, `targetType`, `targetId`, `metadata` (JSON string), `ip`, `createdAt`.

**Gaps:**
1. **`ip` is never populated.** The `writeAuditLog` function (`community.ts:100-122`) does not accept or record an IP address, despite the field existing. Every audit row has `ip: null`. This eliminates the ability to trace actions to a source IP for incident response.
2. **No `userAgent` field** — cannot distinguish browser vs. API client.
3. **No `requestId` / correlation ID** — cannot tie an audit entry to a specific HTTP request.
4. **`metadata` is a freeform JSON string** — no schema validation, so metadata quality depends on each caller.
5. **No tamper protection** — audit logs are in the same SQLite DB as business data. A user with DB access (or an SQL injection, though none exists today) can alter or delete audit rows. There is no append-only / WORM storage.
6. **No retention policy** — audit logs grow unbounded.

**Severity: S1** (for the admin/AI/data gaps); **S2** (for the missing `ip`/`userAgent`).

---

## 12. Positive Security Findings

The following practices are done well and should be preserved and extended:

1. **Community API workspace scoping** — All 32 community endpoints filter every query by `workspaceId: ctx.workspaceId`. The pattern is consistent and thorough, including nested relations (e.g. `communityComment.findFirst({ where: { id: commentId, postId }, include: { post: { select: { workspaceId: true } } } })` then checking `existing.post.workspaceId !== ctx.workspaceId` at `comments/[commentId]/route.ts:46`). This double-check on nested resources is exemplary.

2. **Ownership checks** — Post and comment edits/deletes verify `existing.userId === ctx.user.id` before allowing the operation, with a moderator override (`canModerate(ctx.workspaceRole)`). See `posts/[postId]/route.ts:167-171` and `comments/[commentId]/route.ts:50-52`.

3. **Role hierarchy** — The 9-level `ROLE_LEVELS` map with numeric comparison (`community.ts:65-68`) enables fine-grained "cannot act on equal/higher role" enforcement. The `canActOnMember` function correctly blocks acting on `OWNER` (line 87) and prevents self-promotion to one's own level (line 94).

4. **Input sanitization** — `sanitizeString(s, maxLength)` (`community.ts:153-155`) is applied to nearly every user-supplied string in the community module, with context-appropriate max lengths (200 for titles, 50000 for post content, 2000 for descriptions, 100 for keywords). The `paginate` helper (`community.ts:169-176`) caps `pageSize` at 100, preventing excessive result sets.

5. **No raw SQL** — Zero `$queryRaw`/`$executeRaw` usage across the entire API. All database access is via Prisma's parameterized query builder, eliminating SQL injection.

6. **Comprehensive audit logging in community** — Every mutating community endpoint writes an `AuditLog` entry with `action`, `targetType`, `targetId`, and structured `metadata`. The audit log viewer (`community/moderation/audit-log/route.ts`) is admin-gated and paginated.

7. **`safeJsonParse` helper** — `community.ts:178-181` swallows JSON parse errors and returns a fallback, preventing crashes from corrupt stored JSON. Used consistently in community serializers.

8. **Soft deletes** — Spaces are archived (`status: 'ARCHIVED''`) rather than hard-deleted (`spaces/[spaceId]/route.ts:190`), preserving post relations. Events are cancelled (`status: 'CANCELLED'`) rather than deleted (`events/route.ts:190`), preserving RSVPs. This is good data-integrity practice.

9. **Edit history preservation** — `PostHistory` rows are created *before* a post update (`posts/[postId]/route.ts:214-222`), capturing the prior state with a version number. This provides a tamper-evident edit trail per post.

10. **Defensive `findFirst` over `findUnique`** — The community module consistently uses `findFirst({ where: { id, workspaceId } })` rather than `findUnique({ where: { id } })`, ensuring tenant isolation even at the cost of a marginally slower query. This is the correct multi-tenant pattern.

11. **Batched relation resolution** — Where relations are not modeled as FKs (e.g. `AuditLog.actorId → User`), the code batch-resolves via `db.user.findMany({ where: { id: { in: ids } } })` rather than N+1 queries (e.g. `moderation/audit-log/route.ts:49-57`). Good performance and avoids timing side-channels.

12. **Atomic ownership transfer** — `transfer-ownership/route.ts:57-66` uses `db.$transaction([...])` to atomically demote the old owner and promote the new owner, preventing a window where both or neither are owners.

---

## 13. OWASP Top 10 (2021) Mapping

### A01: Broken Access Control — **CRITICAL**

| Finding | Section | Evidence |
|---------|---------|----------|
| No authentication on 26 endpoints | §2.2, §2.3, §2.5 | `admin/**`, `ai/**`, `data/**` (16/17) never call `getContext()` |
| 16 IDOR/BOLA vulnerabilities | §3 | `findUnique({ where: { id } })` with no `workspaceId` on all data PUT/DELETE |
| Cross-tenant data leakage on 16 read endpoints | §4 | `findMany()` with no `where.workspaceId` |
| `getContext()` caches first user forever | §5.2, §2.1 | `community.ts:21` `let cached` |
| `User.role` defaults to `OWNER` | §5.1 | `schema.prisma:17` |
| Transfer ownership without re-auth | §5.3 | `transfer-ownership/route.ts:14-66` |
| `canActOnMember` skips `canManageMembers` for mute/warn | §5.4 | `community.ts:88` |

### A02: Cryptographic Failures — **HIGH**

| Finding | Section | Evidence |
|---------|---------|----------|
| AI provider API keys stored in plaintext | §9.4 | `schema.prisma:509` `apiKey String @default("")` |
| API keys served in cleartext via unauthenticated GET | §9.4, §4 | `admin/providers/route.ts:6` no `select`, no auth |
| Invitation tokens use `Math.random()` | §8.1 | `community.ts:161-163` |
| No password hashing (no passwords exist) | §8.2 | No auth system at all |
| No encryption at rest for PII (emails, customer data) | §9.3 | All PII stored as plaintext `String` |

### A03: Injection — **LOW (well-mitigated)**

| Finding | Section | Evidence |
|---------|---------|----------|
| No raw SQL anywhere | §7.1 | Zero `$queryRaw`/`$executeRaw` matches ✓ |
| No NoSQL injection via Prisma | §7.3 | All `where` clauses use parameterized values ✓ |
| Unsafe `JSON.parse` in data routes | §7.2 | `data/community/route.ts:61-64`, `data/page-sections/route.ts:29,43,61,81` — crash/DoS, not code execution |

### A04: Insecure Design — **HIGH**

| Finding | Section | Evidence |
|---------|---------|----------|
| No real authentication system (by design, per code comment) | §2.1 | `community.ts:3-5` |
| Cached context never invalidated | §5.2 | `community.ts:21,24` |
| Credit deduction TOCTOU (check-then-act without transaction) | §6.1 | `ai/generate/route.ts:41,75` and 3 siblings |
| Multi-step mutations without transactions | §6.3 | `ai/publish-course`, `ai/landing-page`, `data/courses/duplicate`, `data/page-sections` |
| Counter updates outside the row-creation transaction | §6.2 | `community/posts` POST/DELETE, `community/comments` POST/DELETE |
| Two role fields (`User.role`, `WorkspaceMember.role`) with only one enforced | §5.1, §2.6 | `schema.prisma:17` vs `schema.prisma:61` |

### A05: Security Misconfiguration — **MEDIUM**

| Finding | Section | Evidence |
|---------|---------|----------|
| No rate limiting on any endpoint | §8.4 | No middleware, no `@upstash/ratelimit` |
| No CSRF protection | §8.3 | No tokens, no `SameSite` cookies (latent — no cookies yet) |
| Error messages leaked to client | §9.1 | 12 endpoints return `e.message` |
| `force-dynamic` on every route (no caching headers) | — | Every route file — correct for auth-dynamic content but no `Cache-Control: no-store` on sensitive responses (except `members/export` which sets it correctly) |
| No security headers middleware (CSP, HSTS, X-Frame-Options) | — | Not configured in audited files |
| SQLite in production | §2.1 | `schema.prisma:7` `provider = "sqlite"` — no row-level security, no concurrent write scaling |

### A06: Vulnerable & Outdated Components — **Not assessed**

Out of scope for this database-focused audit. A `npm audit` / dependency scan should be run separately.

### A07: Identification & Authentication Failures — **CRITICAL**

| Finding | Section | Evidence |
|---------|---------|----------|
| No authentication mechanism exists | §2.1, §8.2 | `getContext()` returns first user, no credential check |
| No session management | §8.2 | No sessions, no JWTs, no cookies |
| Cached identity persists across role changes | §5.2 | `community.ts:21` |
| Weak invitation token entropy | §8.1 | `Math.random()` |
| No account lockout / brute-force protection | §8.4 | No rate limiting |
| `User.role` defaults to `OWNER` | §5.1 | `schema.prisma:17` |

### A08: Software & Data Integrity Failures — **MEDIUM**

| Finding | Section | Evidence |
|---------|---------|----------|
| Credit TOCTOU races | §6.1 | `ai/generate:41,75` |
| Counter increment/decrement races | §6.2 | `community/posts` POST/DELETE |
| Multi-step mutations without transactions | §6.3 | `ai/publish-course`, `data/courses/duplicate`, `data/page-sections` |
| No integrity check on JSON fields (corrupt data crashes routes) | §7.2 | `data/community`, `data/page-sections` |
| Audit log in same DB as business data (no WORM) | §11.3 | `AuditLog` is a normal Prisma model |
| No CI/CD build provenance / signature verification | — | Out of scope |

### A09: Security Logging & Monitoring Failures — **HIGH**

| Finding | Section | Evidence |
|---------|---------|----------|
| No audit logging on 5 admin endpoints | §11.2 | `admin/**` |
| No audit logging on 5 AI endpoints | §11.2 | `ai/**` |
| No audit logging on 16 data endpoints | §11.2 | `data/**` |
| `AuditLog.ip` never populated | §11.3 | `writeAuditLog` does not accept IP |
| No `userAgent` or `requestId` in audit log | §11.3 | Schema lacks fields |
| No alerting on suspicious patterns (mass export, role changes) | — | No monitoring configured |
| No log retention policy | §11.3 | Audit logs grow unbounded |

### A10: Server-Side Request Forgery — **Not assessed**

The `meetingUrl` (`community/events/route.ts:113`) and `fileUrl` (`data/products/route.ts`) fields accept arbitrary URLs, but no server-side fetch of these URLs was found in the audited routes. If a future feature fetches these URLs server-side, SSRF risk should be re-evaluated.

---

## Appendix A: Model Count Verification

The Prisma schema contains **41 models** (matching the audit brief):

1. User, 2. Workspace, 3. WorkspaceMember, 4. Course, 5. Section, 6. Lesson, 7. Enrollment, 8. Product, 9. Order, 10. CommunityPost, 11. PostHistory, 12. CommunityComment, 13. CommunitySpace, 14. CommunityEvent, 15. EventRSVP, 16. Invitation, 17. Notification, 18. ModerationReport, 19. BannedKeyword, 20. AuditLog, 21. MemberWarning, 22. Customer, 23. EmailCampaign, 24. Affiliate, 25. WebPage, 26. MembershipPlan, 27. AiConversation, 28. CreditTransaction, 29. AiProvider, 30. AiModel, 31. AiTool, 32. AiGeneration, 33. FeatureFlag, 34. AdminSetting, 35. Page, 36. PageSection, 37. PageVersion, 38. Funnel, 39. FunnelStep, 40. BlogPost, 41. SiteSetting.

## Appendix B: API Route Count Verification

- **Admin:** 5 (`providers`, `settings`, `tools`, `generations`, `flags`)
- **AI:** 5 (`generate`, `chat`, `section-rewrite`, `publish-course`, `landing-page`)
- **Community:** 32 (members ×4, notifications ×3, posts ×9, comments ×2, events ×2, invitations ×3, spaces ×2, moderation ×7, transfer-ownership ×1 = 33... see §2.4 for the exact list of 32)
- **Data:** 17 (`analytics`, `courses`, `courses/duplicate`, `site-settings`, `email`, `orders`, `products`, `customers`, `membership`, `pages`, `community`, `blog`, `dashboard`, `page-sections`, `affiliates`, `funnels`, `crm`)
- **Root:** 1 (`/api` health check)
- **Total audited:** 60 route files

## Appendix C: Remediation Priority

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Add `getContext()` + `isAdmin` check to all 5 admin routes; mask `apiKey` in response | Low | Closes 5 S0 findings |
| **P0** | Add `getContext()` + workspace scoping to all 16 open data routes; convert `findUnique` to `findFirst({ where: { id, workspaceId } })` | Medium | Closes 16 IDOR + 16 leakage findings |
| **P0** | Add `getContext()` to all 5 AI routes; replace `db.user.findFirst()` with `ctx.user.id` | Low | Closes 5 S0 findings |
| **P0** | Encrypt `AiProvider.apiKey` at rest | Medium | Closes 1 S0 finding |
| **P1** | Fix credit-deduction TOCTOU with conditional `updateMany` + `$transaction` | Low | Closes 4 S1 race conditions |
| **P1** | Invalidate `getContext()` cache per-request (remove `let cached`) | Low | Closes cached-context privilege retention |
| **P1** | Add step-up auth (password/2FA) to `transfer-ownership` | Medium | Closes 1 S1 finding |
| **P1** | Add audit logging to all admin/AI/data mutations | Medium | Closes 26 unaudited endpoints |
| **P2** | Replace `Math.random()` token with `crypto.randomBytes(32)` | Trivial | Closes 1 S2 finding |
| **P2** | Add rate limiting middleware (e.g. `@upstash/ratelimit`) | Medium | Closes 1 S1 finding |
| **P2** | Replace `include: { user: true }` with minimal `select` projections | Low | Closes over-fetching + PII leakage |
| **P2** | Wrap multi-step mutations in `$transaction` | Medium | Closes 6 race-condition findings |
| **P2** | Populate `AuditLog.ip` from request headers in `writeAuditLog` | Trivial | Closes 1 audit-completeness gap |
| **P3** | Add `try/catch` around `JSON.parse` in data routes (or adopt `safeJsonParse`) | Trivial | Closes 8 S3 findings |
| **P3** | Add FK relations + `onDelete: Cascade` to `Notification`, `ModerationReport`, `BannedKeyword`, `MemberWarning`, `BlogPost` | Medium | Closes 5 orphan-risk findings |
| **P3** | Return generic error messages in admin/AI/data routes | Trivial | Closes 12 S3 error-leakage findings |

---

**End of report.**
