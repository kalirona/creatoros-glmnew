# DATABASE AUDIT — CreatorOS Enterprise Multi-Tenant SaaS

**Date:** 2026-08-05  
**Auditor:** Senior Database Architect / Prisma Expert / PostgreSQL Architect / Security Auditor  
**Scope:** Complete Prisma schema (32 models), all 62 API routes, community services, seed scripts, SQLite database state.  
**Methodology:** Read-only audit. No modifications performed. Every finding backed by evidence (schema line numbers, API file paths, DB query results, code grep output).  

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **P0 — Critical** | 5 | Production-breaking: broken multi-tenancy, orphan risks, missing model, cross-tenant leakage |
| **P1 — High** | 12 | Data integrity: missing relations, timestamps, constraints, ownership tracking |
| **P2 — Medium** | 10 | Performance: missing indexes, N+1 risks, dead models, missing soft delete |
| **P3 — Low** | 8 | Naming, enums, ambiguity, convention |
| **Total** | **35 findings** |

### Models audited: 32
### API routes audited: 62
### Seed scripts audited: 3
### Database tables with data: 31

---

## P0 — Critical Findings (Production-Breaking)

### P0-1: `getContext()` caches a single user/workspace forever — multi-tenancy broken

| Field | Value |
|-------|-------|
| **Risk** | ALL requests act as the SAME user. If a second workspace is created, it will never be accessible. Session/auth context is impossible. RBAC checks pass for the cached OWNER regardless of the actual requesting user. |
| **Priority** | P0 — Critical |
| **Recommendation** | Remove the module-level `cached` variable. Resolve context per-request from a session cookie/JWT. Never cache identity in a long-lived process. |
| **Evidence** | `src/lib/community.ts` line 21: `let cached: ResolvedContext | null = null` — set once on first call, returned forever. Lines 24, 40, 51 all return `cached` without re-checking. Every community API calls `getContext()` (all 32 routes). |
| **Impact** | Multi-tenancy is non-functional. All 32 community APIs are affected. Any future authentication system will be bypassed because the cached context never changes. |

---

### P0-2: `Funnel`, `BlogPost`, and `Order` have `workspaceId` but NO Prisma relation to `Workspace`

| Field | Value |
|-------|-------|
| **Risk** | Orphan data. If a `Workspace` is deleted, its `Funnel`, `BlogPost`, and `Order` records remain with dangling `workspaceId` values. No cascade delete. No referential integrity. No `include: { workspace: true }` support. |
| **Priority** | P0 — Critical |
| **Recommendation** | Add `workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` and `@@index([workspaceId])` to all three models. |
| **Evidence** | Schema grep confirmed:<br>• `Funnel` (lines 637–651): has `workspaceId String` but only `steps FunnelStep[]` relation — no `workspace` field.<br>• `BlogPost` (lines 666–684): has `workspaceId String` but zero relation fields.<br>• `Order` (lines 157–171): has `workspaceId String` but only `user` and `product` relations — no `workspace` field.<br>• DB query confirmed: 2 funnels, 6 blog posts, 40 orders — all with valid workspaceId, but the FK is not enforced at the Prisma level. SQLite `PRAGMA foreign_keys` returns `1` (enabled), but since Prisma didn't create the FK constraint, the DB can't protect against orphans. |
| **Impact** | Workspace deletion leaves 48+ orphan records (2 funnels + 6 blog posts + 40 orders). Queries like `db.funnel.findMany({ where: { workspaceId } })` work but have no integrity guarantee. |

---

### P0-3: `WebPage` and `Page` are duplicate tables with overlapping schema

| Field | Value |
|-------|-------|
| **Risk** | Two tables store the same conceptual data (title, slug, type, status, visits, workspaceId). DB confirmed: 3 duplicate slugs exist across both tables (`home`, `about`, `ai-content-studio`). Confusing for developers, risk of data divergence, wasted storage, ambiguous API contracts. |
| **Priority** | P0 — Critical |
| **Recommendation** | Consolidate into a single `Page` model (which has richer fields: seoTitle, seoDescription, ogImage, schema, conversions, publishedAt, scheduledAt, sections, versions, funnelSteps). Migrate `WebPage` data into `Page`, then remove `WebPage`. Update `dashboard` and `analytics` APIs to query `Page` instead of `WebPage`. |
| **Evidence** | DB query results:<br>• `WebPage` count: 6 — samples: `{title: "Homepage", slug: "home", type: "HOME"}`, `{title: "AI Content Course — Sales Page", slug: "ai-content-studio", type: "SALES"}`<br>• `Page` count: 12 — samples: `{title: "Homepage", slug: "home", type: "HOME"}`, `{title: "About", slug: "about", type: "ABOUT"}`<br>• Both tables have identical columns: `id, workspaceId, title, slug, type, status, visits, createdAt`<br>• `WebPage` is used in: `src/app/api/data/dashboard/route.ts`, `src/app/api/data/analytics/route.ts`<br>• `Page` is used in: `src/app/api/data/pages/route.ts`, `src/app/api/data/page-sections/route.ts`, `src/app/api/ai/landing-page/route.ts` |
| **Impact** | Duplicate "Homepage", "About", and "AI Content Studio" records exist in both tables. Developers don't know which table is canonical. Analytics may double-count pages. Adding a new page requires deciding which table to use. |

---

### P0-4: 9 data APIs perform NO workspace filtering — cross-tenant data leakage

| Field | Value |
|-------|-------|
| **Risk** | APIs return data from ALL workspaces. In a multi-tenant environment, workspace A's data is visible to workspace B. This is a critical data isolation failure. |
| **Priority** | P0 — Critical |
| **Recommendation** | Every `findMany` / `findFirst` / `count` query must include `where: { workspaceId: ctx.workspaceId }`. Use `getContext()` to resolve the active workspace. |
| **Evidence** | Grep confirmed these 9 API files contain ZERO occurrences of `workspaceId`:<br>• `src/app/api/data/affiliates/route.ts`<br>• `src/app/api/data/analytics/route.ts`<br>• `src/app/api/data/crm/route.ts`<br>• `src/app/api/data/customers/route.ts`<br>• `src/app/api/data/dashboard/route.ts`<br>• `src/app/api/data/membership/route.ts`<br>• `src/app/api/data/orders/route.ts`<br>• `src/app/api/data/page-sections/route.ts`<br>• `src/app/api/data/site-settings/route.ts`<br><br>Additionally, 9 APIs call `db.workspace.findFirst()` with no scoping (returns the first workspace in the DB):<br>• `funnels/route.ts:35`, `dashboard/route.ts:7`, `blog/route.ts:27`, `pages/route.ts:32`, `products/route.ts:29`, `email/route.ts:44`, `courses/route.ts:37`, `ai/landing-page/route.ts:78`, `ai/publish-course/route.ts:25` |
| **Impact** | Any user can see any workspace's affiliates, analytics, CRM data, customers, dashboard metrics, memberships, orders, page sections, and site settings. Violates core multi-tenancy requirement. |

---

### P0-5: `seed-ai-platform.ts` references `db.webPageBlock` — model does NOT exist in schema

| Field | Value |
|-------|-------|
| **Risk** | The seed script `prisma/seed-ai-platform.ts` calls `db.webPageBlock.create()` and `db.webPageBlock.deleteMany()` and `db.webPageBlock.count()`, but there is NO `WebPageBlock` model in `prisma/schema.prisma`. This seed script will crash at runtime with a TypeError. |
| **Priority** | P0 — Critical |
| **Recommendation** | Either add a `WebPageBlock` model to the schema (with `pageId String`, `type String`, `content String`, `position Int`, relation to `WebPage` or `Page`), OR remove the `webPageBlock` references from the seed script. |
| **Evidence** | `prisma/seed-ai-platform.ts` lines 335, 344, 356 reference `db.webPageBlock`. Schema grep: `grep -c "model WebPageBlock" prisma/schema.prisma` returns `0`. The model does not exist. |
| **Impact** | The AI platform seed script cannot run. Any deployment that runs `bun run db:seed-ai-platform` will crash. The homepage blocks (hero, features, testimonials, pricing) cannot be seeded. |

---

## P1 — High Findings (Data Integrity Risk)

### P1-1: 13 plain-string FKs without Prisma relations — no referential integrity

| Field | Value |
|-------|-------|
| **Risk** | Foreign keys stored as plain `String` with no `@relation`. Prisma cannot enforce referential integrity. If a referenced record is deleted, the FK column retains a dangling ID. No cascade deletes. No `include` support (requires manual N+1 joins). |
| **Priority** | P1 — High |
| **Recommendation** | Add proper `@relation` declarations with `onDelete` rules. For audit-style tables (AuditLog, Notification), use `onDelete: SetNull` or `Cascade` depending on retention requirements. |
| **Evidence** | Schema grep confirmed these FK columns have NO relation:<br>• `Invitation.invitedBy` (line 304) — should → WorkspaceMember<br>• `Invitation.acceptedByUserId` (line 313) — should → User<br>• `Invitation.revokedBy` (line 315) — should → User<br>• `Notification.userId` (line 326) — should → User<br>• `Notification.actorId` (line 332) — should → User<br>• `ModerationReport.reporterId` (line 345) — should → User<br>• `ModerationReport.resolvedBy` (line 351) — should → User<br>• `BannedKeyword.createdBy` (line 367) — should → User<br>• `AuditLog.actorId` (line 376) — should → User<br>• `MemberWarning.memberId` (line 391) — should → WorkspaceMember<br>• `MemberWarning.issuedBy` (line 393) — should → User<br>• `PostHistory.editedBy` (line 210) — should → User<br>• `EmailCampaign.createdBy` (line 431) — should → User |
| **Impact** | Orphan records accumulate when users/members are deleted. The moderation API already works around this with manual `db.user.findMany({ where: { id: { in: ids } } })` batch lookups — a code smell. If a user is deleted, their audit logs, notifications, warnings, reports, and post history all become unreferenced junk. |

---

### P1-2: `User.role` defaults to `"OWNER"` — privilege escalation risk

| Field | Value |
|-------|-------|
| **Risk** | Every new `User` record gets `role: "OWNER"` by default. If an API creates a user without explicitly setting the role, that user becomes a global OWNER with full access. |
| **Priority** | P1 — High |
| **Recommendation** | Change default to `"MEMBER"`. Require explicit role assignment on user creation. The `WorkspaceMember.role` field correctly defaults to `"MEMBER"`, but `User.role` (global account role) should not default to OWNER. |
| **Evidence** | `prisma/schema.prisma` line 17: `role String @default("OWNER")`. Contrast with `WorkspaceMember.role` line 61: `role String @default("MEMBER")` — correct. |
| **Impact** | Any future user-creation code that forgets to set `role` silently creates an OWNER. When auth is implemented this will be a critical vulnerability. |

---

### P1-3: 14 models missing `updatedAt` timestamp

| Field | Value |
|-------|-------|
| **Risk** | Cannot track when records were last modified. Audit trails incomplete. Prevents optimistic concurrency control. Makes cache invalidation impossible. |
| **Priority** | P1 — High |
| **Recommendation** | Add `updatedAt DateTime @default(now()) @updatedAt` to all models that can be modified. |
| **Evidence** | Schema grep confirmed these 14 models have NO `updatedAt`:<br>• `Section`, `Lesson`, `Enrollment`, `Order`, `EventRSVP`, `Invitation`, `Notification`, `ModerationReport`, `BannedKeyword`, `AuditLog`, `MemberWarning`, `Customer`, `Affiliate`, `WebPage` |
| **Impact** | When a `ModerationReport` is resolved, there's no `updatedAt` to show when it changed. When a `Customer`'s LTV is updated, there's no timestamp. When an `Invitation` status changes, `acceptedAt` is set but `updatedAt` is not. |

---

### P1-4: `FeatureFlag` and `AdminSetting` missing `createdAt` timestamp

| Field | Value |
|-------|-------|
| **Risk** | Cannot determine when a feature flag or admin setting was first created. Makes change tracking impossible. |
| **Priority** | P1 — High |
| **Recommendation** | Add `createdAt DateTime @default(now)` to both models. |
| **Evidence** | `FeatureFlag` (lines 569–576): has `updatedAt` only, no `createdAt`. `AdminSetting` (lines 578–584): has `updatedAt` only, no `createdAt`. DB confirmed: both tables have 8 rows each, but no creation timestamp. |
| **Impact** | Admins cannot see when a feature flag was added. Audit trails incomplete for admin actions. |

---

### P1-5: 3 slug fields have NO unique constraint — duplicate slugs possible

| Field | Value |
|-------|-------|
| **Risk** | `WebPage.slug`, `Page.slug`, and `BlogPost.slug` have no unique constraint. Two pages in the same workspace can have the same slug, causing routing ambiguity. DB confirmed: `home`, `about`, `ai-content-studio` exist in BOTH `WebPage` and `Page` tables. |
| **Priority** | P1 — High |
| **Recommendation** | Add `@@unique([workspaceId, slug])` to `Page` and `BlogPost`. For `WebPage`, consolidate with `Page` (see P0-3). |
| **Evidence** | Schema grep:<br>• `WebPage` (line 456–467): `slug String` — no `@@unique`<br>• `Page` (line 588–611): `slug String` — no `@@unique`<br>• `BlogPost` (line 666–684): `slug String` — no `@@unique`<br>• Contrast: `CommunitySpace` (line 260): `@@unique([workspaceId, slug])` — correct ✓<br>• DB confirmed: 3 duplicate slugs across `WebPage` and `Page` tables. |
| **Impact** | Duplicate slugs cause unpredictable routing. The first page with a given slug wins; the second becomes unreachable. SEO harmed by duplicate URLs. |

---

### P1-6: `Affiliate.code` is globally unique — should be workspace-scoped

| Field | Value |
|-------|-------|
| **Risk** | Two workspaces cannot use the same affiliate code (e.g., "SUMMER2025"). If workspace A uses code "PROMO10", workspace B cannot use it. Incorrect for multi-tenancy. |
| **Priority** | P1 — High |
| **Recommendation** | Change `code String @unique` to `@@unique([workspaceId, code])`. This allows each workspace to have its own code namespace. |
| **Evidence** | `prisma/schema.prisma` line 446: `code String @unique` — global uniqueness. Contrast with `CommunitySpace` which correctly uses `@@unique([workspaceId, slug])`. |
| **Impact** | Affiliate code collisions across workspaces. A new workspace cannot use common promo codes like "WELCOME10" if another workspace already claimed it. |

---

### P1-7: `Customer.email` has NO unique constraint — duplicate customers possible

| Field | Value |
|-------|-------|
| **Risk** | The same customer email can be added multiple times to the same workspace, creating duplicate records. CRM data becomes unreliable. |
| **Priority** | P1 — High |
| **Recommendation** | Add `@@unique([workspaceId, email])` to prevent duplicate customers within a workspace. |
| **Evidence** | `prisma/schema.prisma` lines 402–414: `Customer` has `email String` with no unique constraint. DB has 24 customer rows. |
| **Impact** | Duplicate customer records skew LTV calculations, order counts, and CRM analytics. Marketing emails may be sent multiple times to the same address. |

---

### P1-8: 12 workspace-owned models missing `createdBy` field — no ownership tracking

| Field | Value |
|-------|-------|
| **Risk** | Enterprise multi-tenant SaaS requires ownership tracking. Every workspace-owned record should track who created it. Currently, 12 models have `workspaceId` but NO `createdBy` field. |
| **Priority** | P1 — High |
| **Recommendation** | Add `createdBy String?` (nullable for backward compat with existing data) and `updatedBy String?` to all 12 models. Add relation to `User` with `onDelete: SetNull`. |
| **Evidence** | Schema grep confirmed these models have `workspaceId` but NO `createdBy`:<br>• `Course`, `Product`, `Order`, `CommunityPost`, `CommunitySpace`, `CommunityEvent`, `Affiliate`, `WebPage`, `MembershipPlan`, `Funnel`, `BlogPost`, `Page`<br>• Only `EmailCampaign` and `BannedKeyword` have `createdBy` (both nullable). |
| **Impact** | Cannot determine who created a course, product, post, event, page, etc. Audit trails incomplete. No accountability for content creation. |

---

### P1-9: NO `updatedBy` field anywhere — no modification tracking

| Field | Value |
|-------|-------|
| **Risk** | Enterprise requires tracking who last modified a record. Currently, no model in the entire schema has an `updatedBy` field. |
| **Priority** | P1 — High |
| **Recommendation** | Add `updatedBy String?` to all workspace-owned models. Update on every `update()` call. |
| **Evidence** | `grep -c "updatedBy" prisma/schema.prisma` returns `0`. No model has this field. |
| **Impact** | Cannot determine who modified any record. Full audit trail impossible. |

---

### P1-10: NO soft delete (`deletedAt`) anywhere — all deletes are permanent

| Field | Value |
|-------|-------|
| **Risk** | Enterprise SaaS requires soft delete for compliance, audit, and data recovery. Currently, every `delete()` call permanently removes the record. If an admin accidentally deletes a course, product, or customer, the data is gone forever. |
| **Priority** | P1 — High |
| **Recommendation** | Add `deletedAt DateTime?` to all workspace-owned models. Update all delete operations to set `deletedAt` instead of actually deleting. Add `where: { deletedAt: null }` to all queries (or use Prisma middleware). |
| **Evidence** | `grep -c "deletedAt" prisma/schema.prisma` returns `0`. No model has this field. All 32 community APIs that delete records use hard deletes. |
| **Impact** | Accidental data loss. No compliance with GDPR "right to be forgotten" (which often requires soft delete with later purge). No audit trail for deleted records. |

---

### P1-11: `Enrollment` model has NO `workspaceId` — cross-tenant enrollment possible

| Field | Value |
|-------|-------|
| **Risk** | A user from workspace A could enroll in a course from workspace B. There is no workspace-level isolation on enrollments. |
| **Priority** | P1 — High |
| **Recommendation** | Add `workspaceId String` field with `@@index([workspaceId])` and a relation to `Workspace`. Validate enrollment creation against the course's workspace. |
| **Evidence** | `prisma/schema.prisma` lines 126–136: `Enrollment` has `userId` and `courseId` only. No `workspaceId` field. The model is currently unused by any API (0 files), but the DB has 3 enrollment rows from the seed script. |
| **Impact** | Cross-tenant data leakage when course enrollment is implemented. Even though unused now, it has data and will be used. |

---

### P1-12: 8 community APIs have mutations but NO audit logging

| Field | Value |
|-------|-------|
| **Risk** | Enterprise requires audit trails for all administrative actions. 8 community API routes perform mutations (create/update/delete) but do NOT call `writeAuditLog()`. |
| **Priority** | P1 — High |
| **Recommendation** | Add `writeAuditLog()` calls to every mutation in these 8 routes. |
| **Evidence** | Grep confirmed these community APIs have mutations but NO `writeAuditLog`:<br>• `moderation/audit-log/route.ts` — read-only, but has mutations (acceptable — it's the audit log viewer)<br>• `moderation/check/route.ts` — content check (no mutation, acceptable)<br>• `moderation/warnings/route.ts` — has mutations, NO audit ⚠️<br>• `moderation/queue/route.ts` — read-only (acceptable)<br>• `posts/[postId]/react/route.ts` — reaction toggle, NO audit ⚠️<br>• `posts/[postId]/history/route.ts` — read-only (acceptable)<br>• `notifications/[notificationId]/route.ts` — mark read/delete, NO audit ⚠️<br>• `notifications/route.ts` — mark all read/clear, NO audit ⚠️<br><br>Additionally, ALL 17 `data/` APIs have ZERO audit logging (`grep -rl "writeAuditLog" src/app/api/data/` returns 0 files). |
| **Impact** | Moderation warnings, post reactions, and notification changes are not auditable. Course creation, product updates, order refunds — none are audited. |

---

## P2 — Medium Findings (Performance / Maintainability)

### P2-1: 28 foreign keys missing `@@index` — query performance degradation

| Field | Value |
|-------|-------|
| **Risk** | Queries that filter by these FK columns perform full table scans. As data grows, performance degrades. SQLite creates indexes automatically for `@unique` and `@@unique` fields, but NOT for plain FK columns. |
| **Priority** | P2 — Medium |
| **Recommendation** | Add `@@index([columnName])` for every FK column used in `where` clauses or `orderBy`. |
| **Evidence** | Schema grep + DB index list confirmed 28 FKs with NO index:<br>• `Section.courseId`<br>• `Lesson.sectionId`<br>• `Enrollment.userId`, `Enrollment.courseId`<br>• `Order.userId`, `Order.workspaceId`, `Order.productId`<br>• `Customer.workspaceId`<br>• `Affiliate.workspaceId`<br>• `WebPage.workspaceId`<br>• `MembershipPlan.workspaceId`<br>• `CreditTransaction.userId`<br>• `AiGeneration.userId`, `AiGeneration.toolId`<br>• `AiModel.providerId`<br>• `PageSection.pageId`<br>• `PageVersion.pageId`<br>• `FunnelStep.funnelId`, `FunnelStep.pageId`<br>• `BlogPost.workspaceId`<br>• `Funnel.workspaceId`<br>• `CommunityComment.userId`<br>• `CommunityEvent.userId`, `CommunityEvent.spaceId`<br>• `MemberWarning.memberId`, `MemberWarning.issuedBy`<br>• `Course.workspaceId`<br>• `Product.workspaceId`<br>• `PostHistory.editedBy` |
| **Impact** | With 40 orders, a scan is fast. With 40,000 orders, `db.order.findMany({ where: { workspaceId } })` does a full table scan. Same applies to all 28 listed FKs. DB confirmed: 74 indexes exist, but these 28 FKs are not among them. |

---

### P2-2: Dead models — `PageVersion` and `AiConversation` have 0 rows and 0 API usage

| Field | Value |
|-------|-------|
| **Risk** | Dead code. Schema complexity. Confusion for developers who think these features exist. Migration overhead. |
| **Priority** | P2 — Medium |
| **Recommendation** | Either implement the features (page version history, AI conversation persistence) or remove the models from the schema. Do not leave unused models in a production schema. |
| **Evidence** | • `PageVersion`: 0 rows in DB, 0 API files reference `db.pageVersion`<br>• `AiConversation`: 0 rows in DB, 0 API files reference `db.aiConversation`<br>• Both models have full field definitions and relations in the schema (lines 626–635 and 481–491). |
| **Impact** | Developers may build features against these models assuming they work. Schema migrations take longer. Prisma client includes unnecessary types. |

---

### P2-3: `Enrollment` and `FunnelStep` have data but 0 API usage

| Field | Value |
|-------|-------|
| **Risk** | Data exists in the DB (from seed script) but no API reads or writes it. The features appear to exist (seeded data) but are non-functional. |
| **Priority** | P2 — Medium |
| **Recommendation** | Either implement the APIs for enrollment management and funnel step management, or remove the seed data and mark the models as planned. |
| **Evidence** | • `Enrollment`: 3 rows in DB, 0 API files reference `db.enrollment`<br>• `FunnelStep`: 8 rows in DB, 0 API files reference `db.funnelStep` |
| **Impact** | Seed data creates an illusion of working features. Course enrollment and funnel builder appear to have data but no UI or API can access it. |

---

### P2-4: JSON fields stored as `String` — no DB-level validation

| Field | Value |
|-------|-------|
| **Risk** | 11 fields across 6 models store JSON as plain strings. No schema validation at the DB level. A buggy API could write invalid JSON, causing parse errors on read. No query support for JSON keys. |
| **Priority** | P2 — Medium |
| **Recommendation** | Acceptable for SQLite (no native JSON type). For production with PostgreSQL, switch to `Json` type. Always use `safeJsonParse()` on read (already done in community APIs). Add Zod validation on write. |
| **Evidence** | Fields storing JSON as String:<br>• `CommunityPost`: hashtags, mentions, pollOptions, attachments, reactions<br>• `CommunityComment`: mentions, attachments<br>• `WorkspaceMember`: badges<br>• `AuditLog`: metadata<br>• `PageSection`: content<br>• `PageVersion`: sections<br>• `Page`: schema<br>• `AiConversation`: messages<br>• `AiGeneration`: structured |
| **Impact** | Invalid JSON in any field causes a runtime crash when parsed. The `safeJsonParse()` helper mitigates this, but a single API that forgets to use it creates a vulnerability. |

---

### P2-5: `CommunityComment` and `EventRSVP` missing `workspaceId` — requires join for workspace queries

| Field | Value |
|-------|-------|
| **Risk** | To query all comments in a workspace, you must join through `CommunityPost`: `where: { post: { workspaceId } }`. This is less efficient than a direct `workspaceId` filter and makes queries more complex. Same for `EventRSVP`. |
| **Priority** | P2 — Medium |
| **Recommendation** | Add `workspaceId String` to both models (denormalized for query performance). Keep the relation to the parent for cascade deletes. Add `@@index([workspaceId])`. |
| **Evidence** | `CommunityComment` (lines 220–240): has `postId` but no `workspaceId`. The moderation API works around this: `db.communityComment.findFirst({ where: { id: targetId, post: { workspaceId } } })` — a nested filter.<br>`EventRSVP` (lines 288–299): has `eventId` and `userId` but no `workspaceId`. |
| **Impact** | Every workspace-scoped comment query requires a join. With large datasets, slower than a direct index lookup on `workspaceId`. |

---

### P2-6: N+1 query risks in moderation APIs — manual user batch lookups

| Field | Value |
|-------|-------|
| **Risk** | Because `ModerationReport.reporterId`, `resolvedBy`, `AuditLog.actorId`, `MemberWarning.issuedBy`, and `PostHistory.editedBy` are plain strings (no relation), the APIs must do manual `db.user.findMany()` lookups. If not batched properly, this becomes N+1. |
| **Priority** | P2 — Medium |
| **Recommendation** | The current code already batches these lookups (good ✓). But adding proper Prisma relations would eliminate the need entirely and enable `include: { reporter: true }`. |
| **Evidence** | Grep confirmed manual batch lookups in:<br>• `moderation/reports/route.ts:162` — `db.user.findMany()` for reporters<br>• `moderation/reports/route.ts:166` — `db.user.findMany()` for resolvers<br>• `moderation/audit-log/route.ts:52` — `db.user.findMany()` for actors<br>• `moderation/warnings/route.ts:50` — `db.user.findMany()` for issuers<br>• `moderation/queue/route.ts:123,127` — `db.user.findMany()` for reporters/resolvers<br>• `posts/[postId]/history/route.ts:36-38` — `db.user.findMany()` for editors |
| **Impact** | Code complexity. If a developer adds a new query and forgets to batch, it becomes N+1. |

---

### P2-7: `Order.productId` uses `SetNull` — inconsistent cascade pattern

| Field | Value |
|-------|-------|
| **Risk** | `Order.productId` uses `onDelete: SetNull` — if a product is deleted, the order's `productId` becomes null but the order remains. This is intentional (preserve order history). However, `Order.workspaceId` has NO cascade rule at all (no relation), so workspace deletion leaves orders as orphans. |
| **Priority** | P2 — Medium |
| **Recommendation** | Add `workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` to `Order`. This ensures workspace deletion cleans up orders. Keep `productId` as `SetNull`. |
| **Evidence** | `prisma/schema.prisma` lines 157–171: `Order` has `product Product? @relation(..., onDelete: SetNull)` but no `workspace` relation. |
| **Impact** | Orphan orders after workspace deletion. Inconsistent with `CommunityPost`, `Course`, `Product`, etc. which all cascade-delete on workspace deletion. |

---

### P2-8: `Section` and `Lesson` missing `position` composite index

| Field | Value |
|-------|-------|
| **Risk** | Course builder queries like `db.lesson.findMany({ where: { sectionId }, orderBy: { position: 'asc' } })` require sorting. Without a composite index on `[sectionId, position]`, this is a full scan + sort. |
| **Priority** | P2 — Medium |
| **Recommendation** | Add `@@index([sectionId, position])` to `Lesson` and `@@index([courseId, position])` to `Section`. |
| **Evidence** | `Lesson` (lines 113–124): has `sectionId` and `position` but no composite index. `Section` (lines 103–111): has `courseId` and `position` but no composite index. DB has 88 lessons and 22 sections. |
| **Impact** | Course curriculum rendering is slow with many lessons. |

---

### P2-9: `SiteSetting` vs `AdminSetting` — near-duplicate key-value tables

| Field | Value |
|-------|-------|
| **Risk** | Both models store key-value pairs with `key String @unique`, `value String`, `category String`, `updatedAt DateTime`. The distinction is unclear. `SiteSetting` has NO `workspaceId` — despite the name implying workspace-level settings. |
| **Priority** | P2 — Medium |
| **Recommendation** | Clarify: `AdminSetting` = platform-wide (SUPER_ADMIN only) — correct. `SiteSetting` = should be workspace-scoped but currently has NO `workspaceId` — this is a bug. Either add `workspaceId` to `SiteSetting` or document that it's global. |
| **Evidence** | `SiteSetting` (lines 686–692): NO `workspaceId` field — despite the name. `AdminSetting` (lines 578–584): also no `workspaceId` — correct for platform-wide. Both have 8–20 rows in DB. |
| **Impact** | If `SiteSetting` is intended to be workspace-scoped (e.g., "site title" per workspace), it's broken — all workspaces share the same settings. |

---

### P2-10: `EmailCampaign.createdBy` and `BannedKeyword.createdBy` are nullable — audit gap

| Field | Value |
|-------|-------|
| **Risk** | `createdBy String?` — nullable means a campaign/keyword can be created without tracking who created it. For audit purposes, this should be non-nullable (the creator is always known at creation time). |
| **Priority** | P2 — Medium |
| **Recommendation** | Make non-nullable. If migrating existing nulls, set to a system user ID or the workspace owner. |
| **Evidence** | `EmailCampaign.createdBy String?` (line 431), `BannedKeyword.createdBy String?` (line 367). |
| **Impact** | Audit trail gap. Cannot determine who created a campaign or banned keyword if `createdBy` is null. |

---

## P3 — Low Findings (Naming / Convention)

### P3-1: Inconsistent model naming — some use "Community" prefix, others don't

| Field | Value |
|-------|-------|
| **Risk** | `CommunityPost`, `CommunityComment`, `CommunitySpace`, `CommunityEvent` use the "Community" prefix. But `EventRSVP`, `PostHistory`, `ModerationReport`, `BannedKeyword`, `MemberWarning`, `AuditLog`, `Notification`, `Invitation` do not — despite all being community-related. |
| **Priority** | P3 — Low |
| **Recommendation** | No action needed — renaming would require a migration. Document the convention going forward. |
| **Evidence** | Schema model names: `CommunityPost` vs `PostHistory`, `CommunityComment` vs `EventRSVP`. |
| **Impact** | Minor developer confusion. No functional impact. |

---

### P3-2: Enum values stored as plain `String` — no DB-level validation

| Field | Value |
|-------|-------|
| **Risk** | SQLite doesn't support native enums, so all "enum" fields (role, status, type, visibility, etc.) are stored as `String`. Invalid values can be written (e.g., `memberStatus: "HACKED"`). |
| **Priority** | P3 — Low |
| **Recommendation** | This is a SQLite limitation. For production with PostgreSQL, switch to Prisma `enum` types. In the meantime, validate enum values in API code (already done in community APIs via `VALID_ROLES`, `VALID_STATUSES`, etc.). |
| **Evidence** | Schema comments document valid values (e.g., `// ACTIVE|SUSPENDED|BANNED|MUTED`) but they're not enforced. |
| **Impact** | Invalid enum values can be written if an API forgets to validate. |

---

### P3-3: `Affiliate.commissionRate` defaults to `0.3` — ambiguous (percentage vs decimal)

| Field | Value |
|-------|-------|
| **Risk** | Is 0.3 = 30% or 0.3%? The default is 0.3, which likely means 30% (decimal). But there's no documentation or validation. |
| **Priority** | P3 — Low |
| **Recommendation** | Add a comment: `// 0.3 = 30% commission (decimal, not percentage)`. Add validation in API code to ensure the rate is between 0 and 1. |
| **Evidence** | `prisma/schema.prisma` line 450: `commissionRate Float @default(0.3)` — no comment. |
| **Impact** | A developer might interpret 0.3 as 0.3% and set `commissionRate: 0.003`, resulting in 100x lower commissions. |

---

### P3-4: `Course.rating` and `Product.rating` are `Float` with no range validation

| Field | Value |
|-------|-------|
| **Risk** | Rating should be 0–5 (or 0–10), but nothing prevents a value of 999 or -1. |
| **Priority** | P3 — Low |
| **Recommendation** | Add API-level validation: `if (rating < 0 || rating > 5) throw error`. For PostgreSQL, add a CHECK constraint. |
| **Evidence** | `Course.rating Float @default(0)` (line 93), `Product.rating Float @default(0)` (line 149) — no constraints. |
| **Impact** | Invalid ratings could appear in the UI if an API writes them. Low risk since no API currently updates ratings. |

---

### P3-5: `BlogPost.author` defaults to `"Alex Rivera"` — hardcoded name

| Field | Value |
|-------|-------|
| **Risk** | The default author is hardcoded as "Alex Rivera". In a multi-tenant system, this should default to the creating user's name or be null. |
| **Priority** | P3 — Low |
| **Recommendation** | Change default to `""` and require the API to set it to the current user's name. |
| **Evidence** | `prisma/schema.prisma` line 676: `author String @default("Alex Rivera")`. |
| **Impact** | Blog posts created without specifying an author will be attributed to "Alex Rivera" regardless of who created them. |

---

### P3-6: `CommunityComment` self-relation is correct but complex

| Field | Value |
|-------|-------|
| **Risk** | `CommunityComment` has a self-relation (`parent` / `replies`) for nested comments. This is correct, but the `onDelete: Cascade` on `parentId` means deleting a parent comment cascades to all replies. This is usually desired but should be documented. |
| **Priority** | P3 — Low |
| **Recommendation** | No action needed. Document the cascade behavior. |
| **Evidence** | `prisma/schema.prisma` line 234: `parent CommunityComment? @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)`. |
| **Impact** | Deleting a top-level comment deletes all nested replies. This is expected behavior. |

---

### P3-7: `Page → FunnelStep → Page` circular relation

| Field | Value |
|-------|-------|
| **Risk** | `Page` has `funnelSteps FunnelStep[]` and `FunnelStep` has `page Page? @relation(..., onDelete: SetNull)`. This is a circular relation, broken by `SetNull` on `FunnelStep.pageId`. Correct but complex. |
| **Priority** | P3 — Low |
| **Recommendation** | No action needed. The `SetNull` correctly handles the cycle. |
| **Evidence** | `Page` line 610: `funnelSteps FunnelStep[]`. `FunnelStep` line 663: `page Page? @relation(..., onDelete: SetNull)`. |
| **Impact** | None — the `SetNull` prevents infinite recursion. |

---

### P3-8: Missing `FeatureFlag` and `AdminSetting` back-relations

| Field | Value |
|-------|-------|
| **Risk** | `FeatureFlag` and `AdminSetting` are global (no workspace). They have `key String @unique` but no relation to any user. There's no way to track who last toggled a flag or changed a setting. |
| **Priority** | P3 — Low |
| **Recommendation** | Add `updatedBy String?` to both models to track who made the last change. |
| **Evidence** | Both models have `updatedAt` but no `updatedBy`. |
| **Impact** | Cannot determine who changed a feature flag or admin setting. |

---

## Multi-Tenancy Compliance Matrix

Every workspace-owned model MUST contain: `workspaceId`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt`.

| Model | workspaceId | createdBy | updatedBy | createdAt | updatedAt | deletedAt | Status |
|-------|:-----------:|:---------:|:---------:|:---------:|:---------:|:---------:|--------|
| Workspace | N/A (owner) | ❌ | ❌ | ✅ | ✅ | ❌ | P1 |
| WorkspaceMember | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | P1 |
| Course | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | P1 |
| Section | ❌ (parent) | ❌ | ❌ | ❌ | ❌ | ❌ | P1+P2 |
| Lesson | ❌ (parent) | ❌ | ❌ | ❌ | ❌ | ❌ | P1+P2 |
| Enrollment | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | P1 |
| Product | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | P1 |
| Order | ✅ (no rel) | ❌ | ❌ | ✅ | ❌ | ❌ | P0+P1 |
| CommunityPost | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | P1 |
| PostHistory | ❌ (parent) | ❌ | ❌ | ✅ | ❌ | ❌ | P2 |
| CommunityComment | ❌ (parent) | ❌ | ❌ | ✅ | ✅ | ❌ | P2 |
| CommunitySpace | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | P1 |
| CommunityEvent | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | P1 |
| EventRSVP | ❌ (parent) | ❌ | ❌ | ✅ | ❌ | ❌ | P2 |
| Invitation | ✅ | ❌ (invitedBy) | ❌ | ✅ | ❌ | ❌ | P1 |
| Notification | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | P1 |
| ModerationReport | ✅ | ❌ (reporterId) | ❌ (resolvedBy) | ✅ | ❌ | ❌ | P1 |
| BannedKeyword | ✅ | ⚠️ (nullable) | ❌ | ✅ | ❌ | ❌ | P1+P2 |
| AuditLog | ✅ | ❌ (actorId) | N/A | ✅ | ❌ | ❌ | P1 |
| MemberWarning | ✅ | ❌ (issuedBy) | ❌ | ✅ | ❌ | ❌ | P1 |
| Customer | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | P1 |
| EmailCampaign | ✅ | ⚠️ (nullable) | ❌ | ✅ | ✅ | ❌ | P2 |
| Affiliate | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | P1 |
| WebPage | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | P0+P1 |
| MembershipPlan | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | P1 |
| AiConversation | ❌ | N/A | N/A | ✅ | ✅ | ❌ | P2 (dead) |
| CreditTransaction | ❌ (user) | N/A | N/A | ✅ | ❌ | ❌ | P3 |
| Page | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | P1 |
| PageSection | ❌ (parent) | ❌ | ❌ | ✅ | ✅ | ❌ | P2 |
| PageVersion | ❌ (parent) | ❌ | ❌ | ✅ | ❌ | ❌ | P2 (dead) |
| Funnel | ✅ (no rel) | ❌ | ❌ | ✅ | ✅ | ❌ | P0+P1 |
| FunnelStep | ❌ (parent) | ❌ | ❌ | ❌ | ❌ | ❌ | P2 |
| BlogPost | ✅ (no rel) | ❌ | ❌ | ✅ | ✅ | ❌ | P0+P1 |

### Compliance Summary
- **0/32** models are fully compliant with enterprise multi-tenancy requirements
- **0/32** models have `deletedAt` (soft delete)
- **0/32** models have `updatedBy`
- **2/32** models have `createdBy` (both nullable)
- **14/32** models missing `updatedAt`
- **3/32** models have `workspaceId` but NO relation to `Workspace` (orphan risk)

---

## Summary Table

| ID | Finding | Priority | Models Affected |
|----|---------|----------|-----------------|
| P0-1 | `getContext()` caches single user forever | P0 | All 32 community APIs |
| P0-2 | `Funnel`, `BlogPost`, `Order` missing Workspace relation | P0 | 3 models |
| P0-3 | `WebPage` & `Page` are duplicate tables | P0 | WebPage, Page |
| P0-4 | 9 data APIs have no workspace filtering | P0 | 9 API routes |
| P0-5 | `seed-ai-platform.ts` references non-existent `webPageBlock` model | P0 | seed-ai-platform.ts |
| P1-1 | 13 plain-string FKs without relations | P1 | 8 models |
| P1-2 | `User.role` defaults to "OWNER" | P1 | User |
| P1-3 | 14 models missing `updatedAt` | P1 | 14 models |
| P1-4 | `FeatureFlag` & `AdminSetting` missing `createdAt` | P1 | 2 models |
| P1-5 | 3 slug fields have no unique constraint | P1 | WebPage, Page, BlogPost |
| P1-6 | `Affiliate.code` globally unique | P1 | Affiliate |
| P1-7 | `Customer.email` no unique constraint | P1 | Customer |
| P1-8 | 12 models missing `createdBy` | P1 | 12 models |
| P1-9 | No `updatedBy` field anywhere | P1 | All models |
| P1-10 | No `deletedAt` (soft delete) anywhere | P1 | All models |
| P1-11 | `Enrollment` missing `workspaceId` | P1 | Enrollment |
| P1-12 | 8 community APIs + all data APIs missing audit logging | P1 | 25 API routes |
| P2-1 | 28 FKs missing `@@index` | P2 | 15+ models |
| P2-2 | Dead models: `PageVersion`, `AiConversation` | P2 | 2 models |
| P2-3 | Data exists but 0 API usage: `Enrollment`, `FunnelStep` | P2 | 2 models |
| P2-4 | 11 JSON fields stored as String | P2 | 6 models |
| P2-5 | `CommunityComment` & `EventRSVP` missing `workspaceId` | P2 | 2 models |
| P2-6 | N+1 risks in moderation APIs (manual user lookups) | P2 | 6 API routes |
| P2-7 | `Order` cascade rules inconsistent | P2 | Order |
| P2-8 | `Section` & `Lesson` missing position index | P2 | Section, Lesson |
| P2-9 | `SiteSetting` vs `AdminSetting` near-duplicate | P2 | SiteSetting, AdminSetting |
| P2-10 | `createdBy` nullable (audit gap) | P2 | EmailCampaign, BannedKeyword |
| P3-1 | Inconsistent model naming | P3 | Multiple |
| P3-2 | Enums stored as String | P3 | All enum fields |
| P3-3 | `commissionRate` ambiguous | P3 | Affiliate |
| P3-4 | Rating fields no range validation | P3 | Course, Product |
| P3-5 | `BlogPost.author` hardcoded default | P3 | BlogPost |
| P3-6 | `CommunityComment` self-relation cascade | P3 | CommunityComment |
| P3-7 | `Page → FunnelStep → Page` circular | P3 | Page, FunnelStep |
| P3-8 | `FeatureFlag` & `AdminSetting` no `updatedBy` | P3 | FeatureFlag, AdminSetting |

---

## Methodology

### Files inspected (read-only, no modifications)
- `prisma/schema.prisma` — all 32 models, 694 lines
- `src/lib/community.ts` — workspace resolver, permissions, audit, notifications
- `src/lib/db.ts` — Prisma client
- All 62 API route files under `src/app/api/`
- `src/components/modules/community.tsx` — frontend field references
- `prisma/seed.ts`, `prisma/seed-ai-platform.ts`, `prisma/seed-pages-funnels.ts`
- `/references/` directory — **does not exist** (checked, not found)

### Database queries executed (read-only)
- Row counts for all 32 tables
- Orphan checks: `Funnel.workspaceId`, `BlogPost.workspaceId`, `Order.workspaceId`
- `PRAGMA foreign_keys` — returns `1` (enabled)
- Index inventory: 74 indexes confirmed
- Duplicate workspace owner check — passed (1 owner per workspace)
- `WebPage` vs `Page` overlap check — 3 duplicate slugs confirmed (`home`, `about`, `ai-content-studio`)

### Code grep patterns used
- `db\.\w+` — model usage count across all source files (32 models tracked)
- `findFirst` — workspace isolation violations (9 found)
- `workspaceId` — multi-tenancy filter check (9 APIs missing)
- `@@index` / `@@unique` — constraint check
- `onDelete` — cascade rule check
- `updatedAt` / `createdAt` — timestamp check
- `createdBy` / `updatedBy` / `deletedAt` — ownership tracking check
- `writeAuditLog` — audit logging coverage
- `webPageBlock` — missing model reference

### What was NOT modified
- No schema changes
- No API changes
- No data changes
- No migration files created
- This is a read-only audit document only

---

## Recommended Fix Order

**Do not attempt to fix all 35 findings at once.** Recommended phase order:

1. **Phase DB-2 (P0 only):** Fix the 5 critical findings. These break production.
2. **Phase DB-3 (P1):** Fix the 12 high findings. These risk data integrity.
3. **Phase DB-4 (P2):** Fix the 10 medium findings. These improve performance.
4. **Phase DB-5 (P3):** Address the 8 low findings during routine maintenance.

Each phase must finish with: browser testing, API testing, database testing, TypeScript = 0, ESLint = 0, runtime verification.
