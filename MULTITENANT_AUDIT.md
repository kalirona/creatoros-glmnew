# CreatorOS — Multi-Tenancy Workspace Isolation Audit

**Audit date:** 2025
**Scope:** `prisma/schema.prisma` (41 models) + `src/lib/community.ts` + 60 API route files under `src/app/api/`
**Auditor type:** Multi-tenancy isolation review
**Repository root:** `/home/z/my-project`

---

## 1. Executive Summary

CreatorOS is a multi-tenant creator platform whose data model is built around a `Workspace` tenant boundary. The community module (`src/app/api/community/**`) was clearly written with multi-tenancy in mind: every route resolves the active workspace via `getContext()`, every Prisma query filters by `ctx.workspaceId`, and every mutation verifies ownership via `findFirst({ where: { id, workspaceId } })`. This represents a **gold-standard pattern** that the rest of the codebase should follow.

Unfortunately, **the same discipline was not applied to the rest of the API surface.** The `/api/data/**`, `/api/ai/**`, and `/api/admin/**` route groups almost universally:

- Call `db.<Model>.findMany()` with **no `where` clause**, returning every row from every tenant.
- Call `db.<Model>.findUnique({ where: { id } })` on mutations, allowing Insecure Direct Object Reference (IDOR) across tenants.
- Resolve "the current workspace" by calling `db.workspace.findFirst()` (returns the **first** workspace in the DB, alphabetically/chronologically) instead of `getContext()`.
- Resolve "the current user" with `db.user.findFirst({ orderBy: { createdAt: 'asc' } })`, which always charges credits from the **first user that ever signed up** — even for an unauthenticated cross-tenant caller.

On top of this, `getContext()` itself has a **module-level cache** (`let cached: ResolvedContext | null = null`, line 21 of `src/lib/community.ts`) that pins the resolved tenant to whatever was first computed. In production with real auth, this would silently make every user act as the first workspace's OWNER for the lifetime of the Node process.

### Overall compliance score: **42 / 100** — ❌ **FAIL**

| Category | Score | Notes |
|---|---|---|
| Schema-level tenant boundaries | 70 / 100 | 20 models have `workspaceId`, but 8 of them lack `@@index([workspaceId])` and 7 lack a `Workspace @relation` |
| Community APIs (`/api/community/**`) | 98 / 100 | Exemplary — every route uses `getContext()` + `workspaceId` filter |
| Data APIs (`/api/data/**`) | 8 / 100 | Almost no route filters by workspace; 11 routes have IDOR |
| AI APIs (`/api/ai/**`) | 5 / 100 | All 5 routes pick `findFirst()` user/workspace |
| Admin APIs (`/api/admin/**`) | 30 / 100 | Models are intentionally global, but no auth checks |
| `getContext()` design | 25 / 100 | Module-level cache breaks per-request isolation |

### Key violations count

| # | Violation class | Count |
|---|---|---|
| 1 | APIs that leak data from ALL workspaces (no `where` clause) | **15** |
| 2 | IDOR vulnerabilities (`findUnique({ where: { id } })` without `workspaceId`) | **20** |
| 3 | APIs that resolve the tenant with `db.workspace.findFirst()` | **8** |
| 4 | APIs that resolve the actor with `db.user.findFirst()` | **5** |
| 5 | Models missing `@@index([workspaceId])` despite having the column | **8** |
| 6 | Models missing the `Workspace @relation` despite having `workspaceId` | **7** |
| 7 | Models that SHOULD be workspace-scoped but aren't | **4** |
| 8 | `getContext()` caches a single tenant at module scope | **1** (architectural) |

**Total individual violation findings:** ~64 distinct issues across 25 routes.

---

## 2. Workspace Isolation Model-by-Model

The schema defines **41 models**. Of those, **20 models** carry a `workspaceId String` field. The table below audits each one for: (a) Prisma `@relation` to `Workspace`, (b) `@@index([workspaceId])` for query performance, (c) whether APIs filter by it, and (d) overall status.

### 2.1 Models WITH a `workspaceId` field (20)

| # | Model | `@relation` to Workspace? | `@@index([workspaceId])`? | API filters by it? | Status |
|---|---|---|---|---|---|
| 1 | `WorkspaceMember` | ✅ Yes (line 77) | ✅ Yes `[workspaceId, memberStatus]` (line 80) | ✅ Yes — `/api/community/members` filters `where: { workspaceId: ctx.workspaceId }` | ✅ Compliant |
| 2 | `Course` | ✅ Yes (line 98) | ❌ **No** | ❌ No — `/api/data/courses` calls `db.course.findMany()` with no `where` | ❌ Violation |
| 3 | `Order` | ❌ **No relation** | ❌ **No** | ❌ No — `/api/data/orders` calls `db.order.findMany()` with no `where` | ❌ Violation |
| 4 | `CommunityPost` | ✅ Yes (line 197) | ✅ Yes `[workspaceId, createdAt]` (line 203) | ✅ Yes — `/api/community/posts` filters by `ctx.workspaceId` | ✅ Compliant |
| 5 | `CommunitySpace` | ✅ Yes (line 257) | ✅ Yes `[workspaceId]` (line 261), `@@unique([workspaceId, slug])` (line 260) | ✅ Yes — `/api/community/spaces` filters by `ctx.workspaceId` | ✅ Compliant |
| 6 | `CommunityEvent` | ✅ Yes (line 281) | ✅ Yes `[workspaceId, startTime]` (line 285) | ✅ Yes — `/api/community/events` filters by `ctx.workspaceId` | ✅ Compliant |
| 7 | `Invitation` | ✅ Yes (line 318) | ✅ Yes `[workspaceId, status]` (line 320) | ✅ Yes — `/api/community/invitations` filters by `ctx.workspaceId` | ✅ Compliant |
| 8 | `Notification` | ❌ **No relation** | ✅ Yes `[workspaceId, createdAt]` (line 339) | ✅ Yes — `/api/community/notifications` filters by `ctx.workspaceId` AND `ctx.user.id` | ⚠️ Partial (no FK) |
| 9 | `ModerationReport` | ❌ **No relation** | ✅ Yes `[workspaceId, status]` (line 356) | ✅ Yes — `/api/community/moderation/reports` filters by `ctx.workspaceId` | ⚠️ Partial (no FK) |
| 10 | `BannedKeyword` | ❌ **No relation** | ✅ Yes `[workspaceId]` (line 370) | ✅ Yes — `/api/community/moderation/keywords` filters by `ctx.workspaceId` | ⚠️ Partial (no FK) |
| 11 | `AuditLog` | ❌ **No relation** | ✅ Yes `[workspaceId, createdAt]` (line 385) | ✅ Yes — `/api/community/moderation/audit-log` filters by `ctx.workspaceId` | ⚠️ Partial (no FK) |
| 12 | `MemberWarning` | ❌ **No relation** | ✅ Yes `[workspaceId]` (line 399) | ✅ Yes — `/api/community/members/[memberId]/warn` writes `workspaceId: ctx.workspaceId` | ⚠️ Partial (no FK) |
| 13 | `Customer` | ✅ Yes (line 413) | ❌ **No** | ❌ No — `/api/data/customers` calls `db.customer.findMany()` with no `where` | ❌ Violation |
| 14 | `EmailCampaign` | ✅ Yes (line 435) | ✅ Yes `[workspaceId, status]`, `[workspaceId, createdAt]` (lines 437–438) | ❌ No — `/api/data/email` calls `db.emailCampaign.findMany()` with no `where` | ❌ Violation |
| 15 | `Affiliate` | ✅ Yes (line 453) | ❌ **No** | ❌ No — `/api/data/affiliates` calls `db.affiliate.findMany()` with no `where` | ❌ Violation |
| 16 | `WebPage` | ✅ Yes (line 466) | ❌ **No** | ❌ No — leaked via `/api/data/analytics` (`db.webPage.findMany()`) and `/api/data/dashboard` | ❌ Violation |
| 17 | `MembershipPlan` | ✅ Yes (line 478) | ❌ **No** | ❌ No — `/api/data/membership` calls `db.membershipPlan.findMany()` with no `where` | ❌ Violation |
| 18 | `Page` | ❌ **No relation** | ❌ **No** | ❌ No — `/api/data/pages` calls `db.page.findMany()` with no `where` | ❌ Violation |
| 19 | `Funnel` | ❌ **No relation** | ❌ **No** | ❌ No — `/api/data/funnels` calls `db.funnel.findMany()` with no `where` | ❌ Violation |
| 20 | `BlogPost` | ❌ **No relation** | ❌ **No** | ❌ No — `/api/data/blog` calls `db.blogPost.findMany()` with no `where` | ❌ Violation |

**Tally of the 20 workspace-owned models:**

- ✅ Compliant: **6** (WorkspaceMember, CommunityPost, CommunitySpace, CommunityEvent, Invitation, EmailCampaign-**at the schema level only**)
- ⚠️ Partial (no FK relation, but indexed and filtered): **5** (Notification, ModerationReport, BannedKeyword, AuditLog, MemberWarning)
- ❌ Violation (API leaks / no index / no relation): **9** (Course, Order, Customer, Affiliate, WebPage, MembershipPlan, Page, Funnel, BlogPost)

### 2.2 Models WITHOUT a `workspaceId` field (21)

These models are either tenant-root (`Workspace`), user-global (`User`, `CreditTransaction`, `AiConversation`), configuration (`AdminSetting`, `FeatureFlag`, `SiteSetting`), or owned transitively via a parent that IS scoped (`Section → Course`, `Lesson → Section`, `CommunityComment → CommunityPost`, `EventRSVP → CommunityEvent`, `PostHistory → CommunityPost`, `PageSection → Page`, `PageVersion → Page`, `FunnelStep → Funnel`). The globally-owned ones are evaluated in §6.

---

## 3. API Isolation Audit (all 60 route files)

Convention:
- ✅ Safe — properly workspace-scoped (calls `getContext()` and filters by `ctx.workspaceId`, or operates on a global model that doesn't need it).
- ❌ Violation — leaks data across tenants or allows IDOR.
- ⚠️ Partial — model is global-by-design but the route lacks auth.

### 3.1 Community APIs (`/api/community/**` — 33 route files, 56 endpoints)

All 33 community route files import and call `getContext()`, all filter by `ctx.workspaceId`, all verify ownership on mutations. This is the gold-standard pattern.

| # | Route path | Method | `getContext()`? | Filters by `ctx.workspaceId`? | Ownership verified on mutation? | Status |
|---|---|---|---|---|---|---|
| 1 | `/api/community/members` | GET | ✅ L60 | ✅ L80 `where = { workspaceId: ctx.workspaceId }` | n/a | ✅ Safe |
| 2 | `/api/community/members` | DELETE | ✅ L149 | ✅ L165 `findFirst({ where: { id: memberId, workspaceId } })` | ✅ OWNER guard, role check | ✅ Safe |
| 3 | `/api/community/members/[memberId]` | GET | ✅ L65 | ✅ L73 `findFirst({ where: { id: memberId, workspaceId } })` | n/a | ✅ Safe |
| 4 | `/api/community/members/[memberId]` | PATCH | ✅ L138 | ✅ L150 `findFirst({ where: { id: memberId, workspaceId } })` | ✅ `canManageMembers`, `canActOnMember` | ✅ Safe |
| 5 | `/api/community/members/[memberId]/warn` | POST | ✅ L23 | ✅ L35 `findFirst({ where: { id: memberId, workspaceId } })` | ✅ `canManageMembers`, `canActOnMember('warn')` | ✅ Safe |
| 6 | `/api/community/members/export` | GET | ✅ L22 | ✅ L42 `where = { workspaceId: ctx.workspaceId }` | ✅ `canManageMembers` | ✅ Safe |
| 7 | `/api/community/notifications` | GET | ✅ L42 | ✅ L56 `where = { userId, workspaceId }` | n/a | ✅ Safe |
| 8 | `/api/community/notifications` | POST | ✅ L129 | ✅ L137 `updateMany({ where: { userId, workspaceId, read: false } })` | n/a | ✅ Safe |
| 9 | `/api/community/notifications` | DELETE | ✅ L155 | ✅ L162 `deleteMany({ where: { userId, workspaceId, read: true } })` | n/a | ✅ Safe |
| 10 | `/api/community/notifications/[notificationId]` | PATCH | ✅ L14 | ✅ L22 `findFirst({ where: { id, userId, workspaceId } })` | ✅ matches `ctx.user.id` | ✅ Safe |
| 11 | `/api/community/notifications/[notificationId]` | DELETE | ✅ L73 | ✅ L81 `findFirst({ where: { id, userId, workspaceId } })` | ✅ matches `ctx.user.id` | ✅ Safe |
| 12 | `/api/community/notifications/unread-count` | GET | ✅ L11 | ✅ L17 `count({ where: { userId, workspaceId, read: false } })` | n/a | ✅ Safe |
| 13 | `/api/community/posts` | GET | ✅ L76 | ✅ L98 `where = { workspaceId: ctx.workspaceId }` | n/a | ✅ Safe |
| 14 | `/api/community/posts` | POST | ✅ L158 | ✅ L235 writes `workspaceId: ctx.workspaceId`; L201 validates `spaceId` belongs to workspace | ✅ author = ctx.user.id | ✅ Safe |
| 15 | `/api/community/posts/[postId]` | GET | ✅ L59 | ✅ L67 `findFirst({ where: { id: postId, workspaceId } })` | n/a | ✅ Safe |
| 16 | `/api/community/posts/[postId]` | PATCH | ✅ L153 | ✅ L161 `findFirst({ where: { id: postId, workspaceId } })` | ✅ `isAuthor \|\| canModerate` | ✅ Safe |
| 17 | `/api/community/posts/[postId]` | DELETE | ✅ L265 | ✅ L273 `findFirst({ where: { id: postId, workspaceId } })` | ✅ `isAuthor \|\| canModerate` | ✅ Safe |
| 18 | `/api/community/posts/[postId]/pin` | POST | ✅ L14 | ✅ L26 `findFirst({ where: { id: postId, workspaceId } })` | ✅ `canModerate` | ✅ Safe |
| 19 | `/api/community/posts/[postId]/lock` | POST | ✅ L14 | ✅ L26 `findFirst({ where: { id: postId, workspaceId } })` | ✅ `canModerate` | ✅ Safe |
| 20 | `/api/community/posts/[postId]/history` | GET | ✅ L14 | ✅ L23 `findFirst({ where: { id: postId, workspaceId } })` (post ownership verified before querying PostHistory) | n/a | ✅ Safe |
| 21 | `/api/community/posts/[postId]/comments` | GET | ✅ L82 | ✅ L90 `findFirst({ where: { id: postId, workspaceId } })` (post verified before querying comments) | n/a | ✅ Safe |
| 22 | `/api/community/posts/[postId]/comments` | POST | ✅ L143 | ✅ L151 `findFirst({ where: { id: postId, workspaceId } })`; L186 parent comment validated `where: { id, postId }` | ✅ locked-post guard | ✅ Safe |
| 23 | `/api/community/posts/[postId]/comments/[commentId]` | PATCH | ✅ L35 | ✅ L43 `findFirst({ where: { id: commentId, postId }, include: { post: { select: { workspaceId } } } })` + L46 explicit `existing.post.workspaceId !== ctx.workspaceId` guard | ✅ `existing.userId === ctx.user.id` | ✅ Safe |
| 24 | `/api/community/posts/[postId]/comments/[commentId]` | DELETE | ✅ L106 | ✅ Same pattern as #23 | ✅ `isAuthor \|\| canModerate` | ✅ Safe |
| 25 | `/api/community/posts/[postId]/archive` | POST | ✅ L14 | ✅ L26 `findFirst({ where: { id: postId, workspaceId } })` | ✅ `canModerate` | ✅ Safe |
| 26 | `/api/community/posts/[postId]/report` | POST | ✅ L16 | ✅ L24 `findFirst({ where: { id: postId, workspaceId } })` | n/a (creates report scoped to workspace) | ✅ Safe |
| 27 | `/api/community/posts/[postId]/react` | POST | ✅ L22 | ✅ L47 `findFirst({ where: { id: postId, workspaceId } })` | n/a | ✅ Safe |
| 28 | `/api/community/invitations` | GET | ✅ L62 | ✅ L77 `where = { workspaceId: ctx.workspaceId }` | ✅ `canManageMembers` | ✅ Safe |
| 29 | `/api/community/invitations` | POST | ✅ L129 | ✅ L184 duplicate check `where: { workspaceId, email, status: 'PENDING' }`; L204 writes `workspaceId: ctx.workspaceId` | ✅ `canManageMembers` + role-level check | ✅ Safe |
| 30 | `/api/community/invitations` | DELETE | ✅ L235 | ✅ L251 `findFirst({ where: { id: invitationId, workspaceId } })` | ✅ `canManageMembers` | ✅ Safe |
| 31 | `/api/community/invitations/[invitationId]/resend` | POST | ✅ L18 | ✅ L30 `findFirst({ where: { id: invitationId, workspaceId } })` | ✅ `canManageMembers` | ✅ Safe |
| 32 | `/api/community/invitations/[invitationId]/link` | GET | ✅ L17 | ✅ L29 `findFirst({ where: { id: invitationId, workspaceId } })` | ✅ `canManageMembers` | ✅ Safe |
| 33 | `/api/community/transfer-ownership` | POST | ✅ L16 | ✅ L44 `findFirst({ where: { id: targetMemberId, workspaceId } })`; L101 broadcast notification filtered `where: { workspaceId, userId: { notIn: [...] } }` | ✅ requires `ctx.workspaceRole === 'OWNER'` | ✅ Safe |
| 34 | `/api/community/events` | GET | ✅ L18 | ✅ L25 `where: { workspaceId, status: { not: 'CANCELLED' } }` | n/a | ✅ Safe |
| 35 | `/api/community/events` | POST | ✅ L75 | ✅ L124 validates `spaceId` belongs to workspace; L135 writes `workspaceId: ctx.workspaceId` | n/a | ✅ Safe |
| 36 | `/api/community/events` | DELETE | ✅ L172 | ✅ L183 `findFirst({ where: { id: eventId, workspaceId } })` | n/a (only cancels) | ✅ Safe |
| 37 | `/api/community/events/rsvp` | POST | ✅ L14 | ✅ L41 `findFirst({ where: { id: eventId, workspaceId } })` | n/a | ✅ Safe |
| 38 | `/api/community/spaces` | GET | ✅ L16 | ✅ L22 `where: { workspaceId, status: 'ACTIVE' }` | n/a | ✅ Safe |
| 39 | `/api/community/spaces` | POST | ✅ L55 | ✅ L82 writes `workspaceId: ctx.workspaceId` | n/a | ✅ Safe |
| 40 | `/api/community/spaces/[spaceId]` | GET | ✅ L18 | ✅ L26 `findFirst({ where: { id: spaceId, workspaceId } })` | n/a | ✅ Safe |
| 41 | `/api/community/spaces/[spaceId]` | PATCH | ✅ L91 | ✅ L99 `findFirst({ where: { id: spaceId, workspaceId } })` | n/a (no role check — see note) | ✅ Safe* |
| 42 | `/api/community/spaces/[spaceId]` | DELETE | ✅ L176 | ✅ L184 `findFirst({ where: { id: spaceId, workspaceId } })` | n/a (no role check — see note) | ✅ Safe* |
| 43 | `/api/community/moderation/queue` | GET | ✅ L60 | ✅ L79/L107 `where: { workspaceId: ctx.workspaceId, status: ... }` | ✅ `canModerate` | ✅ Safe |
| 44 | `/api/community/moderation/keywords` | GET | ✅ L36 | ✅ L48 `where = { workspaceId: ctx.workspaceId }` | ✅ `canModerate` | ✅ Safe |
| 45 | `/api/community/moderation/keywords` | POST | ✅ L67 | ✅ L124 dedup check `where: { workspaceId, keyword }`; L136 writes `workspaceId: ctx.workspaceId` | ✅ `canModerate` | ✅ Safe |
| 46 | `/api/community/moderation/keywords` | DELETE | ✅ L162 | ✅ L180 `findFirst({ where: { id, workspaceId } })` | ✅ `canModerate` | ✅ Safe |
| 47 | `/api/community/moderation/warnings` | GET | ✅ L13 | ✅ L32 `findFirst({ where: { id: memberId, workspaceId } })`; L40 `findMany({ where: { memberId, workspaceId } })` | ✅ `canModerate` | ✅ Safe |
| 48 | `/api/community/moderation/check` | POST | ✅ L30 | ✅ L52 `findMany({ where: { workspaceId: ctx.workspaceId } })` (loads only this workspace's keywords) | n/a | ✅ Safe |
| 49 | `/api/community/moderation/audit-log` | GET | ✅ L12 | ✅ L30 `where = { workspaceId: ctx.workspaceId }` | ✅ `canManageMembers` | ✅ Safe |
| 50 | `/api/community/moderation/reports` | GET | ✅ L116 | ✅ L136 `where = { workspaceId: ctx.workspaceId }` | ✅ `canModerate` | ✅ Safe |
| 51 | `/api/community/moderation/reports` | POST | ✅ L205 | ✅ L252 duplicate check `where: { workspaceId, reporterId, targetType, targetId }`; L268 writes `workspaceId: ctx.workspaceId`; L245 target preview validates within workspace | n/a | ✅ Safe |
| 52 | `/api/community/moderation/reports/[reportId]` | GET | ✅ L64 | ✅ L75 `findFirst({ where: { id: reportId, workspaceId } })` | ✅ `canModerate` | ✅ Safe |
| 53 | `/api/community/moderation/reports/[reportId]` | PATCH | ✅ L131 | ✅ L142 `findFirst({ where: { id: reportId, workspaceId } })` | ✅ `canModerate` | ✅ Safe |

\* *Note on routes #41 and #42: space PATCH/DELETE don't check role, but they DO filter by workspace so cross-tenant IDOR is impossible. Internal role escalation (e.g. a STUDENT archiving a space) is a separate RBAC issue, not a multi-tenancy issue.*

### 3.2 Data APIs (`/api/data/**` — 15 route files, 32 endpoints)

These are the most serious violations. Almost none call `getContext()` or filter by workspace.

| # | Route path | Method | `getContext()`? | Filters by `ctx.workspaceId`? | Ownership verified? | Status | Violation (line) |
|---|---|---|---|---|---|---|---|
| 54 | `/api/data/analytics` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L6-9 `findMany()` on courses, products, orders, customers, posts, campaigns, affiliates, pages, plans with no `where` |
| 55 | `/api/data/courses` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L8 `db.course.findMany({ orderBy: { createdAt: 'desc' } })` |
| 56 | `/api/data/courses` | POST | ❌ No | ❌ No (uses `db.workspace.findFirst()`) | ❌ No | ❌ Violation | L37 `const workspace = await db.workspace.findFirst()` — assigns new course to whichever workspace is first in the DB |
| 57 | `/api/data/courses` | PUT | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L66 `db.course.findUnique({ where: { id } })` — any user can edit any course across tenants |
| 58 | `/api/data/courses` | DELETE | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L93 `db.course.findUnique({ where: { id } })` — any user can delete any course |
| 59 | `/api/data/courses/duplicate` | POST | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L13 `db.course.findUnique({ where: { id } })` — duplicates any tenant's course (including sections/lessons) into the original's workspace — but caller may not be a member |
| 60 | `/api/data/site-settings` | GET | ❌ No | n/a (global model) | ❌ No auth | ⚠️ Partial | L6 `db.siteSetting.findMany()` — `SiteSetting` has no `workspaceId`; should be per-tenant for branding |
| 61 | `/api/data/site-settings` | PUT | ❌ No | n/a | ❌ No | ⚠️ Partial | L22 `db.siteSetting.update({ where: { id } })` — no auth |
| 62 | `/api/data/email` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L7 `db.emailCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })` — returns every tenant's campaigns |
| 63 | `/api/data/email` | POST | ❌ No | ❌ No (uses `db.workspace.findFirst()`) | ❌ No | ❌ Violation | L44 `const workspace = await db.workspace.findFirst()` |
| 64 | `/api/data/email` | PUT | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L77 `db.emailCampaign.findUnique({ where: { id } })` |
| 65 | `/api/data/email` | DELETE | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L118 `db.emailCampaign.findUnique({ where: { id } })` |
| 66 | `/api/data/orders` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L8 `db.order.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })` |
| 67 | `/api/data/products` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L8 `db.product.findMany({ orderBy: { createdAt: 'desc' } })` |
| 68 | `/api/data/products` | POST | ❌ No | ❌ No (uses `db.workspace.findFirst()`) | ❌ No | ❌ Violation | L29 `const workspace = await db.workspace.findFirst()` |
| 69 | `/api/data/products` | PUT | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L60 `db.product.findUnique({ where: { id } })` |
| 70 | `/api/data/products` | DELETE | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L88 `db.product.findUnique({ where: { id } })` |
| 71 | `/api/data/customers` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L8 `db.customer.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })` |
| 72 | `/api/data/membership` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L5 `db.membershipPlan.findMany({ orderBy: { price: 'asc' } })` |
| 73 | `/api/data/pages` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L9 `db.page.findMany({ where, ... })` — `where` only filters by `type`, never by `workspaceId` |
| 74 | `/api/data/pages` | POST | ❌ No | ❌ No (uses `db.workspace.findFirst()`) | ❌ No | ❌ Violation | L32 `const workspace = await db.workspace.findFirst()` |
| 75 | `/api/data/community` | GET | ✅ L9 | ✅ L14/L23/L27/L34 filter by `ctx.workspaceId` | n/a | ✅ Safe |
| 76 | `/api/data/community` | POST | ✅ L85 | ✅ L98 writes `workspaceId: ctx.workspaceId` | n/a | ✅ Safe |
| 77 | `/api/data/blog` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L8 `db.blogPost.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })` |
| 78 | `/api/data/blog` | POST | ❌ No | ❌ No (uses `db.workspace.findFirst()`) | ❌ No | ❌ Violation | L27 `const workspace = await db.workspace.findFirst()` |
| 79 | `/api/data/blog` | PUT | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L61 `db.blogPost.findUnique({ where: { id } })` |
| 80 | `/api/data/blog` | DELETE | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L93 `db.blogPost.findUnique({ where: { id } })` |
| 81 | `/api/data/dashboard` | GET | ❌ No | ❌ No (uses `db.workspace.findFirst()` then doesn't filter the rest) | ❌ No | ❌ Violation | L7-22 picks first workspace, then `findMany()` on courses/products/orders/customers/posts/campaigns/affiliates/pages/plans with no `where` |
| 82 | `/api/data/page-sections` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L26 `db.page.findUnique({ where: { id: pageId } })` — returns sections of any tenant's page |
| 83 | `/api/data/page-sections` | POST | ❌ No | ❌ No | ❌ No | ❌ Violation | L40 `db.pageSection.create({ data: { pageId, ... } })` — no check that `pageId` belongs to caller's workspace |
| 84 | `/api/data/page-sections` | PUT (duplicate) | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L56 `db.pageSection.findUnique({ where: { id } })` |
| 85 | `/api/data/page-sections` | PUT (move) | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L65/L69 `db.pageSection.findUnique/findFirst` without `workspaceId` |
| 86 | `/api/data/page-sections` | PUT (default) | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L80 `db.pageSection.update({ where: { id } })` |
| 87 | `/api/data/page-sections` | DELETE | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L92 `db.pageSection.findUnique({ where: { id } })` then L93 `delete({ where: { id } })` |
| 88 | `/api/data/affiliates` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L5 `db.affiliate.findMany({ orderBy: { earnings: 'desc' } })` |
| 89 | `/api/data/funnels` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L7 `db.funnel.findMany({ ... })` |
| 90 | `/api/data/funnels` | POST | ❌ No | ❌ No (uses `db.workspace.findFirst()`) | ❌ No | ❌ Violation | L35 `const workspace = await db.workspace.findFirst()` |
| 91 | `/api/data/funnels` | PUT | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L62 `db.funnel.findUnique({ where: { id } })` |
| 92 | `/api/data/funnels` | DELETE | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L86 `db.funnel.findUnique({ where: { id } })` |
| 93 | `/api/data/crm` | GET | ❌ No | ❌ No | ❌ No | ❌ Violation | L5-9 `findMany()` on orders, customers, products with no `where` |

### 3.3 AI APIs (`/api/ai/**` — 5 route files, 6 endpoints)

All five AI routes use `db.user.findFirst({ orderBy: { createdAt: 'asc' } })` (or similar) to resolve "the current user" — i.e. **the very first user that ever signed up to the platform**. Credits are deducted from that user, generations are persisted to that user, and no workspace scoping is applied.

| # | Route path | Method | `getContext()`? | Filters by workspace? | Ownership verified? | Status | Violation (line) |
|---|---|---|---|---|---|---|---|
| 94 | `/api/ai/chat` | POST | ❌ No | ❌ No | ❌ No | ❌ Violation | L51 `const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })` — credits deducted from the first user in the DB |
| 95 | `/api/ai/landing-page` | POST | ❌ No | ❌ No | ❌ No | ❌ Violation | L58 `db.aiTool.findUnique({ where: { slug: 'LANDING_PAGE_GENERATOR' } })`; L61 `db.user.findFirst({ orderBy: { createdAt: 'asc' } })`; L78 `db.workspace.findFirst()` — generates a Page and saves it to whichever workspace comes first in the DB |
| 96 | `/api/ai/generate` | POST | ❌ No | ❌ No | ❌ No | ❌ Violation | L32 `db.aiTool.findUnique({ where: { slug: toolSlug } })`; L39 `db.user.findFirst({ orderBy: { createdAt: 'asc' } })` — credit cost charged to first user; generation persisted under first user |
| 97 | `/api/ai/generate` | GET | ❌ No | n/a (global tools list) | ❌ No auth | ⚠️ Partial | L96 `db.aiTool.findMany({ where: { isVisible: true } })` — tool list is intentionally global, but no auth |
| 98 | `/api/ai/publish-course` | POST | ❌ No | ❌ No | ❌ No | ❌ Violation (IDOR) | L13 `db.aiGeneration.findUnique({ where: { id: generationId } })` — any caller can publish any generation (from any user) into a course; L25 `db.workspace.findFirst()` for the new course's `workspaceId` |
| 99 | `/api/ai/section-rewrite` | POST | ❌ No | ❌ No | ❌ No | ❌ Violation | L33 `db.user.findFirst({ orderBy: { createdAt: 'asc' } })` — credits deducted from first user |

### 3.4 Admin APIs (`/api/admin/**` — 5 route files, 9 endpoints)

These operate on intentionally-global models (`AdminSetting`, `FeatureFlag`, `AiProvider`, `AiModel`, `AiTool`, `AiGeneration`). Multi-tenancy doesn't strictly apply, **but no authentication or role check is performed**, so any anonymous caller can rewrite system prompts, disable AI providers, or read all generations across all users.

| # | Route path | Method | Auth check? | Status | Notes |
|---|---|---|---|---|---|
| 100 | `/api/admin/providers` | GET | ❌ No | ⚠️ Partial | Returns all AI providers including `apiKey` |
| 101 | `/api/admin/providers` | PUT | ❌ No | ⚠️ Partial | L18 `db.aiProvider.update({ where: { id } })` — anonymous API key rewrite |
| 102 | `/api/admin/settings` | GET | ❌ No | ⚠️ Partial | Returns all admin settings |
| 103 | `/api/admin/settings` | PUT | ❌ No | ⚠️ Partial | L15 `db.adminSetting.update({ where: { id } })` |
| 104 | `/api/admin/tools` | GET | ❌ No | ⚠️ Partial | Returns all tools including `systemPrompt` |
| 105 | `/api/admin/tools` | PUT | ❌ No | ⚠️ Partial | L32 `db.aiTool.update({ where: { id } })` — anonymous prompt rewrite |
| 106 | `/api/admin/generations` | GET | ❌ No | ⚠️ Partial | L6 `db.aiGeneration.findMany()` — returns every user's AI generations |
| 107 | `/api/admin/flags` | GET | ❌ No | ⚠️ Partial | Returns all feature flags |
| 108 | `/api/admin/flags` | PUT | ❌ No | ⚠️ Partial | L15 `db.featureFlag.update({ where: { id } })` — anonymous flag toggle |

### 3.5 Root API (`/api/route.ts` — 1 route, 1 endpoint)

| # | Route path | Method | Status | Notes |
|---|---|---|---|---|
| 109 | `/api` | GET | ✅ Safe | L4 returns `{ message: "Hello, world!" }` — no DB queries |

### 3.6 Tally

| Status | Route count (files) | Endpoint count |
|---|---|---|
| ✅ Safe | 34 (33 community + 1 data/community + 1 root) | 58 |
| ❌ Violation | 20 (15 data + 5 ai) | 38 |
| ⚠️ Partial | 5 (all admin) | 9 |
| **Total** | **60 route files** | **~106 endpoints** |

---

## 4. Cross-Tenant Data Leakage

Every API in this section calls `db.<Model>.findMany()` (or `findUnique`) with **no `workspaceId` in the `where` clause**, returning rows belonging to ALL tenants in the database.

| # | API path | Leaky query (file:line) | Data leaked | Severity |
|---|---|---|---|---|
| 1 | `GET /api/data/analytics` | `src/app/api/data/analytics/route.ts:5-9` — `Promise.all([db.course.findMany(), db.product.findMany(), db.order.findMany(...), db.customer.findMany(), db.communityPost.findMany(), db.emailCampaign.findMany(), db.affiliate.findMany(), db.webPage.findMany(), db.membershipPlan.findMany()])` | Every tenant's courses, products, orders, customers, community posts, email campaigns, affiliates, web pages, and membership plans — plus synthesized revenue/MRR/ARR metrics | 🔴 Critical |
| 2 | `GET /api/data/courses` | `src/app/api/data/courses/route.ts:8` — `db.course.findMany({ orderBy: { createdAt: 'desc' }, include: { sections: { include: { lessons: true } } } })` | Every tenant's courses, including full section + lesson content (potential paid courseware) | 🔴 Critical |
| 3 | `GET /api/data/email` | `src/app/api/data/email/route.ts:7` — `db.emailCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })` | Every tenant's email campaign bodies, subject lines, open rates, click rates | 🔴 Critical |
| 4 | `GET /api/data/orders` | `src/app/api/data/orders/route.ts:8-12` — `db.order.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { product: { select: { name: true } } } })` | Every tenant's order customer names, emails, amounts, statuses | 🔴 Critical (PII) |
| 5 | `GET /api/data/products` | `src/app/api/data/products/route.ts:8` — `db.product.findMany({ orderBy: { createdAt: 'desc' } })` | Every tenant's products, including `fileUrl` (digital download URLs) | 🔴 Critical |
| 6 | `GET /api/data/customers` | `src/app/api/data/customers/route.ts:8-11` — `db.customer.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })` | Every tenant's customer names, emails, tags, LTV | 🔴 Critical (PII) |
| 7 | `GET /api/data/membership` | `src/app/api/data/membership/route.ts:5` — `db.membershipPlan.findMany({ orderBy: { price: 'asc' } })` | Every tenant's membership plans, pricing, member counts, MRR | 🟠 High |
| 8 | `GET /api/data/pages` | `src/app/api/data/pages/route.ts:9` — `db.page.findMany({ where, ... })` (where only filters by `type`) | Every tenant's landing pages, slugs, visit counts, conversion rates | 🟠 High |
| 9 | `GET /api/data/blog` | `src/app/api/data/blog/route.ts:8` — `db.blogPost.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })` | Every tenant's blog posts (incl. drafts, content, cover URLs) | 🟠 High |
| 10 | `GET /api/data/dashboard` | `src/app/api/data/dashboard/route.ts:7-22` — `db.workspace.findFirst()` then 9 unfiltered `findMany()` calls | Picks the first workspace but returns its own and every other tenant's data in the same response — also exposes `workspace.members` with user emails | 🔴 Critical (PII) |
| 11 | `GET /api/data/affiliates` | `src/app/api/data/affiliates/route.ts:5` — `db.affiliate.findMany({ orderBy: { earnings: 'desc' } })` | Every tenant's affiliates, their emails, earnings, commission rates | 🟠 High |
| 12 | `GET /api/data/funnels` | `src/app/api/data/funnels/route.ts:7` — `db.funnel.findMany({ ... include: { steps: { ... include: { page: ... } } } })` | Every tenant's funnels, steps, revenue, linked page slugs | 🟠 High |
| 13 | `GET /api/data/crm` | `src/app/api/data/crm/route.ts:5-9` — `Promise.all([db.order.findMany(...), db.customer.findMany(...), db.product.findMany()])` | Every tenant's orders + customers + products (full CRM) | 🔴 Critical (PII) |
| 14 | `GET /api/data/page-sections` | `src/app/api/data/page-sections/route.ts:26` — `db.page.findUnique({ where: { id: pageId }, include: { sections: ... } })` | Returns the full page-section content of ANY page by ID (cross-tenant) | 🟠 High |
| 15 | `GET /api/admin/generations` | `src/app/api/admin/generations/route.ts:6` — `db.aiGeneration.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })` | Every user's AI generations across all tenants (admin route, but no auth) | 🟠 High |

**Aggregated impact:** A single anonymous `GET /api/data/analytics` request returns the entire commercial dataset of every tenant on the platform — including PII (customer emails), paid courseware (lesson content), and revenue figures. This is a severe, exploitable breach.

---

## 5. IDOR Vulnerabilities

Insecure Direct Object Reference: the API looks up a record by its primary key (`id`) without also constraining the query to the caller's `workspaceId`. An attacker who guesses or harvests a CUID can read, mutate, or delete another tenant's record.

| # | API path + line | Vulnerable query | Attacker capability |
|---|---|---|---|
| 1 | `/api/data/courses` PUT — `src/app/api/data/courses/route.ts:66` | `db.course.findUnique({ where: { id } })` then `db.course.update({ where: { id } })` | Edit the title, description, price, status, or thumbnail of ANY course in ANY workspace |
| 2 | `/api/data/courses` DELETE — `src/app/api/data/courses/route.ts:93-98` | `db.course.findUnique({ where: { id } })` then `db.section.deleteMany({ where: { courseId: id } })` + `db.course.delete({ where: { id } })` | Wipe ANY tenant's course (and all its sections) |
| 3 | `/api/data/courses/duplicate` POST — `src/app/api/data/courses/duplicate/route.ts:13-16` | `db.course.findUnique({ where: { id }, include: { sections: { include: { lessons: true } } } })` then `db.course.create({ data: { workspaceId: original.workspaceId, ... } })` | Read full content of any course (incl. paid lessons) and create a copy in the original owner's workspace |
| 4 | `/api/data/email` PUT — `src/app/api/data/email/route.ts:77` | `db.emailCampaign.findUnique({ where: { id } })` then `db.emailCampaign.update({ where: { id } })` | Hijack another tenant's email campaign (rename, change body, force status='SENT' at L91 which also sets fake `recipients: 12400`, `openRate: 0.43`) |
| 5 | `/api/data/email` DELETE — `src/app/api/data/email/route.ts:118-121` | `db.emailCampaign.findUnique({ where: { id } })` then `db.emailCampaign.delete({ where: { id } })` | Delete another tenant's email campaign |
| 6 | `/api/data/products` PUT — `src/app/api/data/products/route.ts:60` | `db.product.findUnique({ where: { id } })` then `db.product.update({ where: { id } })` | Edit price, file URL, or status of any product across tenants — could be used to drop prices to 0 and exfiltrate digital downloads |
| 7 | `/api/data/products` DELETE — `src/app/api/data/products/route.ts:88-91` | `db.product.findUnique({ where: { id } })` then `db.product.delete({ where: { id } })` | Delete any tenant's product |
| 8 | `/api/data/blog` PUT — `src/app/api/data/blog/route.ts:61` | `db.blogPost.findUnique({ where: { id } })` then `db.blogPost.update({ where: { id } })` | Edit any tenant's blog post (incl. drafts) |
| 9 | `/api/data/blog` DELETE — `src/app/api/data/blog/route.ts:93-96` | `db.blogPost.findUnique({ where: { id } })` then `db.blogPost.delete({ where: { id } })` | Delete any tenant's blog post |
| 10 | `/api/data/funnels` PUT — `src/app/api/data/funnels/route.ts:62` | `db.funnel.findUnique({ where: { id } })` then `db.funnel.update({ where: { id } })` | Hijack another tenant's funnel (status, revenue, conversion counts) |
| 11 | `/api/data/funnels` DELETE — `src/app/api/data/funnels/route.ts:86-89` | `db.funnel.findUnique({ where: { id } })` then `db.funnel.delete({ where: { id } })` | Delete any tenant's funnel |
| 12 | `/api/data/page-sections` GET — `src/app/api/data/page-sections/route.ts:26` | `db.page.findUnique({ where: { id: pageId }, include: { sections: ... } })` | Read full section JSON of any page (cross-tenant) |
| 13 | `/api/data/page-sections` PUT (duplicate) — `src/app/api/data/page-sections/route.ts:56-58` | `db.pageSection.findUnique({ where: { id } })` then `db.pageSection.create({ data: { pageId: orig.pageId, ... } })` | Duplicate any tenant's section into their own page |
| 14 | `/api/data/page-sections` PUT (moveUp/moveDown) — `src/app/api/data/page-sections/route.ts:65,69` | `db.pageSection.findUnique({ where: { id } })` + `db.pageSection.findFirst({ where: { pageId, position: newPos } })` | Reorder any tenant's sections |
| 15 | `/api/data/page-sections` PUT (default) — `src/app/api/data/page-sections/route.ts:80` | `db.pageSection.update({ where: { id }, data })` (no pre-check at all) | Rewrite the content of any tenant's section by ID |
| 16 | `/api/data/page-sections` DELETE — `src/app/api/data/page-sections/route.ts:92-93` | `db.pageSection.findUnique({ where: { id } })` then `db.pageSection.delete({ where: { id } })` | Delete any tenant's section by ID |
| 17 | `/api/data/site-settings` PUT — `src/app/api/data/site-settings/route.ts:22` | `db.siteSetting.update({ where: { id }, data: { value } })` (no pre-check) | Rewrite any site setting (brand, header, footer, analytics, SEO) for any tenant — note `SiteSetting` is global per §6 |
| 18 | `/api/admin/providers` PUT — `src/app/api/admin/providers/route.ts:18` | `db.aiProvider.update({ where: { id }, data })` (no pre-check, no auth) | Anonymous attacker can rewrite `apiKey`, `baseUrl`, `priority` of any AI provider |
| 19 | `/api/admin/settings` PUT — `src/app/api/admin/settings/route.ts:15` | `db.adminSetting.update({ where: { id }, data: { value } })` | Anonymous attacker rewrites platform admin settings |
| 20 | `/api/admin/tools` PUT — `src/app/api/admin/tools/route.ts:32` | `db.aiTool.update({ where: { id }, data })` | Anonymous attacker rewrites AI tool system prompts, credit costs, output types — could be used to make `creditCost: 0` for expensive tools or inject prompt-injection payloads |
| 21 | `/api/admin/flags` PUT — `src/app/api/admin/flags/route.ts:15` | `db.featureFlag.update({ where: { id }, data: { enabled } })` | Anonymous attacker toggles any feature flag |
| 22 | `/api/ai/publish-course` POST — `src/app/api/ai/publish-course/route.ts:13` | `db.aiGeneration.findUnique({ where: { id: generationId } })` then `db.course.create({ data: { workspaceId: workspace.id /* from findFirst */ } })` | Any caller can take ANY user's AI generation (even another tenant's) and publish it as a course — `workspaceId` is then assigned from `db.workspace.findFirst()` (L25), so the new course is created in the first workspace in the DB, not the caller's |

### IDOR pattern (canonical example)

```ts
// src/app/api/data/courses/route.ts (PUT, line 66)
const existing = await db.course.findUnique({ where: { id } })
if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
// ... no check that existing.workspaceId === ctx.workspaceId ...
const course = await db.course.update({ where: { id }, data })
```

The community module demonstrates the correct pattern (see `src/app/api/community/posts/[postId]/route.ts:160-165`):

```ts
const existing = await db.communityPost.findFirst({
  where: { id: postId, workspaceId: ctx.workspaceId },
})
if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
```

---

## 6. Missing `workspaceId` (models that SHOULD be scoped but aren't)

| # | Model | Current state | Risk | Recommendation |
|---|---|---|---|---|
| 1 | `Enrollment` (`schema.prisma:126-136`) | Has `userId` + `courseId`, no `workspaceId`. | A user enrolled in a course in Workspace A has no FK back to that workspace. There is no `/api/data/enrollments` route today, but the moment one is added it will be temptingly easy to write `db.enrollment.findMany({ where: { userId } })` and leak enrollments across tenants. Also prevents per-workspace revenue reporting. | Add `workspaceId String` + `@@index([workspaceId])` + `Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)`. Backfill from `course.workspaceId`. |
| 2 | `AiConversation` (`schema.prisma:481-491`) | Has only `userId`. AI conversations are user-global. | An AI conversation started in Workspace A is visible/continuable from Workspace B (or from a global AI route like `/api/ai/chat` once persistence is added). Currently `/api/ai/chat` doesn't persist conversations, but the model is ready for it. | Add `workspaceId String` + relation + index. All AI routes should pass `ctx.workspaceId` when persisting. |
| 3 | `CreditTransaction` (`schema.prisma:493-501`) | Has only `userId` + `amount`. Credits are tracked on `User.credits` (global). | If a creator is a member of two workspaces, their credit balance is shared — they can burn credits earned in Workspace A on Workspace B's AI tools. This may or may not be intended. Cross-workspace credit reporting is impossible. | Decide product intent. If credits are workspace-scoped (typical for white-label), add `workspaceId` to both `CreditTransaction` and the credit balance (move `User.credits` to `WorkspaceMember.credits`). If global, document explicitly. |
| 4 | `SiteSetting` (`schema.prisma:686-692`) | Global `key/value` table with `category` ∈ brand\|header\|footer\|analytics\|seo\|domains. No `workspaceId`. | Every tenant shares the same brand colors, header, footer, analytics IDs, SEO defaults, and custom domains. This makes the platform **not actually multi-tenant for white-label use**. `/api/data/site-settings` and `/api/data/dashboard` confirm this — they read/write globally. | Add `workspaceId String` + `@@unique([workspaceId, key])` + relation + index. Update `GET/PUT /api/data/site-settings` to filter by `ctx.workspaceId`. |

### Related: transitive children of scoped models

These don't need their own `workspaceId` because they cascade through a parent that IS scoped, but they DO need API-level care because every `findUnique({ where: { id } })` on them is implicitly IDOR if the parent isn't checked.

- `Section` (parent: `Course`) — accessed via `/api/data/courses` and `/api/ai/publish-course`
- `Lesson` (parent: `Section → Course`)
- `PageSection` (parent: `Page`) — directly IDOR-vulnerable in `/api/data/page-sections` (see §5)
- `PageVersion` (parent: `Page`)
- `FunnelStep` (parent: `Funnel`) — accessed via `/api/data/funnels`
- `PostHistory` (parent: `CommunityPost`) — **correctly** gated by `findFirst({ where: { id: postId, workspaceId } })` in `/api/community/posts/[postId]/history`
- `CommunityComment` (parent: `CommunityPost`) — **correctly** gated via `include: { post: { select: { workspaceId } } }` + explicit check in `/api/community/posts/[postId]/comments/[commentId]`
- `EventRSVP` (parent: `CommunityEvent`) — **correctly** gated via event's `findFirst({ where: { id: eventId, workspaceId } })` in `/api/community/events/rsvp`

---

## 7. `getContext()` Analysis

### 7.1 How it works

`src/lib/community.ts`:

```ts
// L21
let cached: ResolvedContext | null = null

// L23-61
export async function getContext(): Promise<ResolvedContext | null> {
  if (cached) return cached                                              // L24
  const workspace = await db.workspace.findFirst({                       // L25
    orderBy: { createdAt: 'asc' },
  })
  if (!workspace) return null                                            // L26
  const membership = await db.workspaceMember.findFirst({                // L27-31
    where: { workspaceId: workspace.id, role: 'OWNER' },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) {
    // fallback: first member                                           // L33
    const fallback = await db.workspaceMember.findFirst({
      where: { workspaceId: workspace.id },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!fallback) return null
    cached = { /* …fallback.user…, workspaceId: workspace.id, … */ }     // L40-49
    return cached
  }
  cached = { /* …membership.user…, workspaceId: workspace.id, … */ }     // L51-60
  return cached
}
```

The function resolves a `ResolvedContext` containing:
- `user` — id, email, name, avatarUrl, role, credits
- `workspaceId` — the first workspace by `createdAt`
- `workspaceRole` — the role of the first OWNER membership in that workspace
- `memberId` — the WorkspaceMember row id

Once computed, the result is stored in the module-level `cached` variable and returned verbatim on every subsequent call for the lifetime of the Node.js process.

### 7.2 Why it breaks multi-tenancy

The `cached` variable lives at **module scope**, not request scope. In a long-running Next.js server (or even in development with HMR retaining modules), the following happens:

1. **First request** (from any caller): `getContext()` runs the DB queries, picks `workspace.findFirst({ orderBy: { createdAt: 'asc' } })` — i.e. the **chronologically oldest workspace in the entire database** — and the first OWNER of that workspace. Stores the result in `cached`.
2. **Every subsequent request** — regardless of who the caller is, what JWT/session they present, or which workspace they intend to act on — hits `if (cached) return cached` at L24 and gets the **same** `user.id`, `workspaceId`, `workspaceRole`, and `memberId`.

Even if the rest of the auth system were perfect (JWT verified, session looked up, active workspace header parsed), `getContext()` would **override all of it** with the cached value. The community module would then attribute every action to "the OWNER of the first workspace."

### 7.3 Impact

- **Single-tenant masquerade:** Every community API call acts as the first workspace's OWNER. In a multi-tenant deployment, all users silently share one identity.
- **Audit log poisoning:** `writeAuditLog(ctx, ...)` records `actorId: cached.user.id` and `workspaceId: cached.workspaceId` for every community mutation — meaning audit logs blame one user for everything.
- **Notification routing:** `sendNotification(targetUserId, ctx.workspaceId, ...)` would create notifications tied to the wrong workspace.
- **RBAC bypass:** Even when `canManageMembers(ctx.workspaceRole)` is called, `ctx.workspaceRole` is `'OWNER'` (the cached role), so every caller passes the check.
- **Hides the bigger problem:** Because the cache returns instantly and always succeeds, the broken data-isolation in `/api/data/**` and `/api/ai/**` is masked in development (where there's typically only one workspace and one user anyway).

### 7.4 Recommendation

Replace the module-level cache with **per-request resolution** driven by real auth:

```ts
// Conceptual sketch — do NOT cache at module scope.
export async function getContext(req: NextRequest): Promise<ResolvedContext | null> {
  // 1. Verify JWT/session → resolve userId
  const session = await getSession(req)
  if (!session) return null

  // 2. Resolve the active workspace (header, cookie, or session)
  const activeWorkspaceId = req.headers.get('x-workspace-id') ?? session.defaultWorkspaceId

  // 3. Load the membership row — this is the source of truth for role + memberId
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.userId, workspaceId: activeWorkspaceId, memberStatus: 'ACTIVE' },
    include: { user: true, workspace: true },
  })
  if (!membership) return null

  return {
    user: { /* …membership.user… */ },
    workspaceId: membership.workspaceId,
    workspaceRole: membership.role,
    memberId: membership.id,
  }
}
```

Key changes:
1. **Remove the module-level `let cached`** (delete L21, L24, L40-49, L51-60). Caching at request scope (e.g. via React's `cache()` or AsyncLocalStorage) is fine; caching at module scope is not.
2. **Take the request as input** so the workspace can be selected per-call.
3. **Filter by `userId` AND `workspaceId` AND `memberStatus: 'ACTIVE'`** when looking up the membership — this is the actual tenant-boundary check.
4. **Reject suspended/banned members** by checking `memberStatus`.

---

## 8. Compliance Matrix

Every model that carries a `workspaceId` field, scored across five dimensions. The rightmost column flags the overall verdict.

| Model | `workspaceId` field | `Workspace @relation` | `@@index([workspaceId])` | `createdBy`-style actor field | API workspace filtering | Verdict |
|---|---|---|---|---|---|---|
| `WorkspaceMember` | ✅ L60 | ✅ L77 | ✅ L80 (composite) | `userId` L59 | ✅ all `/api/community/members` routes | ✅ Compliant |
| `Course` | ✅ L85 | ✅ L98 | ❌ Missing | ❌ Missing | ❌ `/api/data/courses` no filter | ❌ Violation |
| `Order` | ✅ L160 | ❌ Missing | ❌ Missing | `userId` L159 | ❌ `/api/data/orders` no filter | ❌ Violation |
| `CommunityPost` | ✅ L175 | ✅ L197 | ✅ L203 (composite) | `userId` L177 | ✅ all `/api/community/posts` routes | ✅ Compliant |
| `CommunitySpace` | ✅ L244 | ✅ L257 | ✅ L261 + unique L260 | ❌ Missing | ✅ all `/api/community/spaces` routes | ✅ Compliant |
| `CommunityEvent` | ✅ L266 | ✅ L281 | ✅ L285 (composite) | `userId` L268 | ✅ all `/api/community/events` routes | ✅ Compliant |
| `Invitation` | ✅ L303 | ✅ L318 | ✅ L320 (composite) | `invitedBy` L304 | ✅ all `/api/community/invitations` routes | ✅ Compliant |
| `Notification` | ✅ L327 | ❌ Missing | ✅ L339 (composite) | `actorId` L332 | ✅ all `/api/community/notifications` routes | ⚠️ Partial (no FK) |
| `ModerationReport` | ✅ L344 | ❌ Missing | ✅ L356 (composite) | `reporterId` L345, `resolvedBy` L351 | ✅ all `/api/community/moderation/reports` routes | ⚠️ Partial (no FK) |
| `BannedKeyword` | ✅ L362 | ❌ Missing | ✅ L370 | `createdBy` L367 | ✅ all `/api/community/moderation/keywords` routes | ⚠️ Partial (no FK) |
| `AuditLog` | ✅ L375 | ❌ Missing | ✅ L385 (composite) | `actorId` L376 | ✅ `/api/community/moderation/audit-log` | ⚠️ Partial (no FK) |
| `MemberWarning` | ✅ L392 | ❌ Missing | ✅ L399 | `issuedBy` L393 | ✅ `/api/community/members/[memberId]/warn` | ⚠️ Partial (no FK) |
| `Customer` | ✅ L404 | ✅ L413 | ❌ Missing | ❌ Missing | ❌ `/api/data/customers` no filter | ❌ Violation |
| `EmailCampaign` | ✅ L418 | ✅ L435 | ✅ L437 + L438 | `createdBy` L431 | ❌ `/api/data/email` no filter | ❌ Violation |
| `Affiliate` | ✅ L443 | ✅ L453 | ❌ Missing | ❌ Missing | ❌ `/api/data/affiliates` no filter | ❌ Violation |
| `WebPage` | ✅ L458 | ✅ L466 | ❌ Missing | ❌ Missing | ❌ leaked via `/api/data/analytics` + `/api/data/dashboard` | ❌ Violation |
| `MembershipPlan` | ✅ L471 | ✅ L478 | ❌ Missing | ❌ Missing | ❌ `/api/data/membership` no filter | ❌ Violation |
| `Page` | ✅ L590 | ❌ Missing | ❌ Missing | ❌ Missing | ❌ `/api/data/pages` no filter | ❌ Violation |
| `Funnel` | ✅ L639 | ❌ Missing | ❌ Missing | ❌ Missing | ❌ `/api/data/funnels` no filter | ❌ Violation |
| `BlogPost` | ✅ L668 | ❌ Missing | ❌ Missing | `author` L676 (string) | ❌ `/api/data/blog` no filter | ❌ Violation |

**Summary:**
- ✅ Fully compliant: **6** models
- ⚠️ Partial (no FK relation): **5** models
- ❌ Violation (missing relation, missing index, or no API filter): **9** models

---

## 9. Positive Findings

The community module (`/api/community/**`) is **exemplary** and should be the template for fixing the rest of the codebase. Specific positives:

### 9.1 Universal `getContext()` adoption
Every single route file under `src/app/api/community/**` (33 files, 53 endpoints) imports and calls `getContext()` as its first action, and returns 401 if it returns null. There is no community route that bypasses tenant resolution. (See e.g. `src/app/api/community/members/route.ts:60-63`, `src/app/api/community/posts/route.ts:76-79`, `src/app/api/community/moderation/reports/route.ts:116-122`.)

### 9.2 Universal `workspaceId` filter on read queries
Every `findMany` and `findFirst` in the community module constrains by `workspaceId: ctx.workspaceId`. Examples:
- `src/app/api/community/posts/route.ts:98` — `where: { workspaceId: ctx.workspaceId }`
- `src/app/api/community/members/route.ts:80` — `where = { workspaceId: ctx.workspaceId }`
- `src/app/api/community/moderation/audit-log/route.ts:30` — `where = { workspaceId: ctx.workspaceId }`
- `src/app/api/community/notifications/route.ts:56` — `where = { userId: ctx.user.id, workspaceId: ctx.workspaceId }`

### 9.3 Universal ownership verification on mutations
Every mutation that takes an `id` parameter uses `findFirst({ where: { id, workspaceId } })` (not `findUnique({ where: { id } })`), so cross-tenant IDOR is impossible. Examples:
- `src/app/api/community/posts/[postId]/route.ts:161` — `findFirst({ where: { id: postId, workspaceId: ctx.workspaceId } })`
- `src/app/api/community/posts/[postId]/comments/[commentId]/route.ts:42-48` — `findFirst({ where: { id: commentId, postId }, include: { post: { select: { workspaceId } } } })` **plus** an explicit `existing.post.workspaceId !== ctx.workspaceId` guard. This is the gold-standard pattern for a child model (`CommunityComment`) whose parent (`CommunityPost`) is the workspace-scoped root.
- `src/app/api/community/invitations/route.ts:251` — `findFirst({ where: { id: invitationId, workspaceId: ctx.workspaceId } })`

### 9.4 RBAC layering on top of tenancy
The `canManageMembers`, `canModerate`, and `canActOnMember` helpers in `src/lib/community.ts:74-96` enforce role-based access control **on top of** workspace scoping. Examples:
- `src/app/api/community/members/route.ts:154-156` — DELETE requires `canManageMembers(ctx.workspaceRole)`
- `src/app/api/community/posts/[postId]/pin/route.ts:19-21` — POST requires `canModerate(ctx.workspaceRole)`
- `src/app/api/community/members/[memberId]/route.ts:176-179` — DELETE checks `canActOnMember(ctx.workspaceRole, target.role, 'remove')` to prevent equal/higher-role actions

### 9.5 Audit logging on every state-changing action
The `writeAuditLog(ctx, action, targetType, targetId, metadata)` helper (defined at `src/lib/community.ts:100-122`) is invoked from every community mutation route. It writes a row to the `AuditLog` model **with the resolved `ctx.workspaceId` and `ctx.user.id`**, giving per-tenant audit trails. Examples:
- `src/app/api/community/posts/route.ts:266` — `POST_CREATE`
- `src/app/api/community/members/[memberId]/route.ts:200-206` — `MEMBER_PROMOTE` / `MEMBER_DEMOTE`
- `src/app/api/community/moderation/reports/[reportId]/route.ts:185-190` — `REPORT_RESOLVE` / `REPORT_DISMISS`

### 9.6 Notification routing is workspace-bound
`sendNotification(userId, workspaceId, ...)` (`src/lib/community.ts:126-149`) always writes `workspaceId` into the `Notification` row, ensuring notifications never leak across tenants. Used consistently across community routes (e.g. `src/app/api/community/posts/[postId]/comments/route.ts:235-258`).

### 9.7 Aggregate community API (`/api/data/community`) is also correctly scoped
Unlike its sibling `/api/data/*` routes, `/api/data/community` (`src/app/api/data/community/route.ts`) calls `getContext()` (L9, L85) and filters every query by `ctx.workspaceId` (L14, L23, L27, L34, L98). It returns the current workspace's posts, spaces, events, and member count — proving that the data-route pattern can be made safe when the community pattern is followed.

### 9.8 Schema indexes on the most active community tables
The four highest-traffic community tables (`CommunityPost`, `CommunitySpace`, `CommunityEvent`, `Invitation`) all carry `@@index([workspaceId, …])` composites tuned for their actual access patterns (`createdAt`, `startTime`, `status`, `slug`). See `schema.prisma` lines 203, 261, 285, 320.

### 9.9 Cascade deletes
Every `@relation` from a workspace-owned model to `Workspace` (and from child to parent) carries `onDelete: Cascade` (e.g. `schema.prisma:77, 98, 197, 257, 281, 318, 413, 435, 453, 466, 478`). This means deleting a workspace cleanly removes all of its posts, spaces, events, invitations, customers, products, campaigns, affiliates, web pages, and membership plans — no orphaned rows survive.

### 9.10 RBAC + ownership combined for child-resource mutations
The deepest pattern in the codebase is in `src/app/api/community/posts/[postId]/comments/[commentId]/route.ts`: it joins through the parent (`post`) to verify workspace scoping AND checks authorship (`existing.userId === ctx.user.id`) OR moderator role. This is exactly how every `/api/data/**` mutation should look once fixed.

---

## Appendix A — Quick fix checklist

For the team fixing the issues identified above, in priority order:

1. **Remove the `getContext()` module-level cache** (`src/lib/community.ts:21, 24, 40-49, 51-60`). Replace with per-request resolution driven by real auth.
2. **Add `getContext()` + `where: { workspaceId: ctx.workspaceId }`** to every `/api/data/**` route. Refactor mutations to `findFirst({ where: { id, workspaceId } })` (eliminates 11 IDORs).
3. **Replace `db.workspace.findFirst()` with `ctx.workspaceId`** in POST handlers for `/api/data/courses`, `/api/data/email`, `/api/data/products`, `/api/data/pages`, `/api/data/blog`, `/api/data/funnels`, `/api/ai/landing-page`, `/api/ai/publish-course`.
4. **Replace `db.user.findFirst()` with `ctx.user.id`** in `/api/ai/chat`, `/api/ai/landing-page`, `/api/ai/generate`, `/api/ai/section-rewrite`. Charge credits against the real caller.
5. **Add admin auth** to `/api/admin/**` (e.g. require `ctx.user.role === 'ADMIN'` or a platform-level admin flag).
6. **Add `@@index([workspaceId])`** to `Course`, `Order`, `Customer`, `Affiliate`, `WebPage`, `MembershipPlan`, `Page`, `Funnel`, `BlogPost` (8 models).
7. **Add `Workspace @relation` + `onDelete: Cascade`** to `Order`, `Notification`, `ModerationReport`, `BannedKeyword`, `AuditLog`, `MemberWarning`, `Page`, `Funnel`, `BlogPost` (9 models). Don't forget the matching `members/pages/etc.` back-relation on `Workspace`.
8. **Add `workspaceId`** to `Enrollment`, `AiConversation`, `SiteSetting` (and optionally `CreditTransaction`) per §6.
9. **Lock down `/api/ai/publish-course` POST** — verify `gen.userId === ctx.user.id` AND `gen.workspaceId === ctx.workspaceId` before publishing.
10. **Write a Prisma middleware or client extension** that injects `workspaceId` into every `findMany`/`findUnique`/`update`/`delete` on workspace-scoped models, so this class of bug can't recur.

---

*End of audit.*
