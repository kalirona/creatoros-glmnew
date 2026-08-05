# DATABASE AUDIT — CreatorOS

**Date:** 2026-08-05  
**Auditor:** Senior Database Architect  
**Scope:** Complete Prisma schema, all 62 API routes, community services, frontend field references, SQLite database state.  
**Methodology:** Read-only audit. No modifications performed. Every finding backed by evidence (schema line numbers, API file paths, DB query results, code grep output).

---

## Executive Summary

| Severity | Count |
|----------|-------|
| **P0 — Critical (production-breaking)** | 4 |
| **P1 — High (data integrity risk)** | 9 |
| **P2 — Medium (performance / maintainability)** | 8 |
| **P3 — Low (naming / convention)** | 6 |
| **Total findings** | **27** |

The schema has **32 models** with **62 API routes**. The most severe issues are: (1) multi-tenancy is effectively broken because `getContext()` caches a single user forever, (2) two models (`Funnel`, `BlogPost`) have `workspaceId` columns with **no Prisma relation** to `Workspace`, meaning workspace deletion leaves orphan data, (3) `WebPage` and `Page` are **duplicate tables** with overlapping fields and both contain "Homepage" with slug "home", and (4) 9 data APIs perform **no workspace filtering at all**, leaking cross-tenant data.

---

## P0 — Critical Findings (Production-Breaking)

### P0-1: `getContext()` caches a single user/workspace forever — multi-tenancy broken

| Field | Value |
|-------|-------|
| **Risk** | All requests act as the same user. If a second workspace is created, it will never be accessible. Session/auth context is impossible. |
| **Priority** | P0 — Critical |
| **Recommendation** | Remove the module-level `cached` variable. Either resolve context per-request from a session cookie/JWT, or accept the demo-only limitation and document it. Never cache identity in a long-lived process. |
| **Evidence** | `src/lib/community.ts` line 21: `let cached: ResolvedContext | null = null` — set once, returned forever. Lines 24, 40, 51 all return `cached` without re-checking. |
| **Impact** | Multi-tenancy is non-functional. RBAC checks pass for the cached OWNER regardless of the actual requesting user. Every API that calls `getContext()` is affected (all 32 community routes). |

---

### P0-2: `Funnel` and `BlogPost` have `workspaceId` but NO relation to `Workspace`

| Field | Value |
|-------|-------|
| **Risk** | Orphan data. If a `Workspace` is deleted, its `Funnel` and `BlogPost` records remain in the database with a dangling `workspaceId`. No cascade delete. No referential integrity. |
| **Priority** | P0 — Critical |
| **Recommendation** | Add `workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` to both models. Add `@@index([workspaceId])` to both. |
| **Evidence** | `prisma/schema.prisma`:<br>• `Funnel` (line 637–651): has `workspaceId String` but the only relations are `steps FunnelStep[]`. No `workspace` field.<br>• `BlogPost` (line 666–684): has `workspaceId String` but zero relation fields.<br>• DB query confirmed: `Funnel` table has 2 rows with valid `workspaceId`, but the FK is not enforced at the Prisma level. SQLite `PRAGMA foreign_keys` returns `1` (enabled), but since Prisma didn't create the FK constraint, the DB can't protect against orphans. |
| **Impact** | Workspace deletion leaves orphan funnels and blog posts. Queries like `db.funnel.findMany({ where: { workspaceId } })` work but have no integrity guarantee. A workspace ID change would silently break all associated funnels/blog posts. |

---

### P0-3: `WebPage` and `Page` are duplicate tables with overlapping schema

| Field | Value |
|-------|-------|
| **Risk** | Two tables store the same conceptual data (title, slug, type, status, visits, workspaceId). Both contain "Homepage" with slug "home". Confusing for developers, risk of data divergence, wasted storage, ambiguous API contracts. |
| **Priority** | P0 — Critical |
| **Recommendation** | Consolidate into a single `Page` model (which has richer fields: seoTitle, seoDescription, ogImage, schema, conversions, publishedAt, scheduledAt). Migrate `WebPage` data into `Page`, then remove `WebPage`. Update `dashboard` and `analytics` APIs to query `Page` instead of `WebPage`. |
| **Evidence** | DB query results:<br>• `WebPage` count: 6 — samples: `{title: "Homepage", slug: "home", type: "HOME"}`, `{title: "AI Content Course — Sales Page", slug: "ai-content-studio", type: "SALES"}`<br>• `Page` count: 12 — samples: `{title: "Homepage", slug: "home", type: "HOME"}`, `{title: "About", slug: "about", type: "ABOUT"}`<br>• Both tables have the same columns: `id, workspaceId, title, slug, type, status, visits, createdAt`<br>• `WebPage` is used in: `src/app/api/data/dashboard/route.ts`, `src/app/api/data/analytics/route.ts`<br>• `Page` is used in: `src/app/api/data/pages/route.ts`, `src/app/api/data/page-sections/route.ts`, `src/app/api/ai/landing-page/route.ts` |
| **Impact** | Duplicate "Homepage" records exist in both tables. Developers don't know which table is canonical. Analytics may double-count pages. Adding a new page requires deciding which table to use. Maintenance burden and data inconsistency risk. |

---

### P0-4: 9 data APIs perform NO workspace filtering — cross-tenant data leakage

| Field | Value |
|-------|-------|
| **Risk** | APIs return data from ALL workspaces. In a multi-tenant environment, workspace A's data is visible to workspace B. This is a critical data isolation failure. |
| **Priority** | P0 — Critical |
| **Recommendation** | Every `findMany` / `findFirst` / `count` query in these APIs must include `where: { workspaceId: ctx.workspaceId }`. Use `getContext()` to resolve the active workspace. |
| **Evidence** | Grep confirmed these API files contain ZERO occurrences of `workspaceId`:<br>• `src/app/api/data/affiliates/route.ts`<br>• `src/app/api/data/analytics/route.ts`<br>• `src/app/api/data/crm/route.ts`<br>• `src/app/api/data/customers/route.ts`<br>• `src/app/api/data/dashboard/route.ts`<br>• `src/app/api/data/membership/route.ts`<br>• `src/app/api/data/orders/route.ts`<br>• `src/app/api/data/page-sections/route.ts`<br>• `src/app/api/data/site-settings/route.ts`<br><br>Additionally, 9 APIs call `db.workspace.findFirst()` with no scoping (returns the first workspace in the DB regardless of who's asking):<br>• `funnels/route.ts:35`, `dashboard/route.ts:7`, `blog/route.ts:27`, `pages/route.ts:32`, `products/route.ts:29`, `email/route.ts:44`, `courses/route.ts:37`, `ai/landing-page/route.ts:78`, `ai/publish-course/route.ts:25` |
| **Impact** | Any user can see any workspace's affiliates, analytics, CRM data, customers, dashboard metrics, memberships, orders, page sections, and site settings. This violates the core multi-tenancy requirement. |

---

## P1 — High Findings (Data Integrity Risk)

### P1-1: 17+ plain-string FKs without Prisma relations — no referential integrity

| Field | Value |
|-------|-------|
| **Risk** | Foreign keys stored as plain `String` columns with no `@relation` declaration. Prisma cannot enforce referential integrity. If a referenced record is deleted, the FK column retains a dangling ID. No cascade deletes possible. No `include` support (must do manual N+1 joins). |
| **Priority** | P1 — High |
| **Recommendation** | Add proper `@relation` declarations with `onDelete` rules for each. For audit-style tables (AuditLog, Notification), use `onDelete: SetNull` or `Cascade` depending on retention requirements. |
| **Evidence** | Schema grep confirmed these FK columns have NO relation:<br>• `Invitation.invitedBy` (should → WorkspaceMember)<br>• `Invitation.acceptedByUserId` (should → User)<br>• `Invitation.revokedBy` (should → User)<br>• `Notification.userId` (should → User)<br>• `Notification.actorId` (should → User)<br>• `ModerationReport.reporterId` (should → User)<br>• `ModerationReport.resolvedBy` (should → User)<br>• `BannedKeyword.createdBy` (should → User)<br>• `AuditLog.actorId` (should → User)<br>• `MemberWarning.memberId` (should → WorkspaceMember)<br>• `MemberWarning.issuedBy` (should → User)<br>• `PostHistory.editedBy` (should → User)<br>• `EmailCampaign.createdBy` (should → User)<br>• `Order.workspaceId` (should → Workspace — has `workspaceId String` but only `user` and `product` relations)<br>• `CommunityEvent.spaceId` (has relation ✓ but no index)<br>• `CommunityPost.spaceId` (has relation ✓, has index ✓ — correct) |
| **Impact** | Orphan records accumulate when users/members are deleted. The moderation API already works around this by doing manual `db.user.findMany({ where: { id: { in: ids } } })` batch lookups — a code smell indicating missing relations. If a user is deleted, their audit logs, notifications, warnings, reports, and post history all become unreferenced junk data. |

---

### P1-2: `Enrollment` model has NO `workspaceId` — cross-tenant enrollment possible

| Field | Value |
|-------|-------|
| **Risk** | A user from workspace A could enroll in a course from workspace B. There is no workspace-level isolation on enrollments. |
| **Priority** | P1 — High |
| **Recommendation** | Add `workspaceId String` field with `@@index([workspaceId])` and a relation to `Workspace`. Validate enrollment creation against the course's workspace. |
| **Evidence** | `prisma/schema.prisma` lines 126–136: `Enrollment` has `userId` and `courseId` only. No `workspaceId` field. The model is also unused by any API (0 files reference `db.enrollment`), but the DB has 3 enrollment rows from the seed script. |
| **Impact** | Cross-tenant data leakage. A user with access to multiple workspaces could enroll in courses across workspace boundaries. Even though the model is currently unused by APIs, it has data and will be used when course enrollment is implemented. |

---

### P1-3: `User.role` defaults to `"OWNER"` — privilege escalation risk

| Field | Value |
|-------|-------|
| **Risk** | Every new `User` record gets `role: "OWNER"` by default. If an API creates a user without explicitly setting the role, that user becomes a global OWNER with full access. |
| **Priority** | P1 — High |
| **Recommendation** | Change default to `"MEMBER"`. Require explicit role assignment on user creation. The `WorkspaceMember.role` field (which controls workspace-level access) correctly defaults to `"MEMBER"`, but `User.role` (global account role) should not default to OWNER. |
| **Evidence** | `prisma/schema.prisma` line 17: `role String @default("OWNER")`. Contrast with `WorkspaceMember.role` line 61: `role String @default("MEMBER")` — correct. |
| **Impact** | Any future user-creation code that forgets to set `role` silently creates an OWNER. In the current codebase, no API creates users (only the seed script does), but when auth is implemented this will be a critical vulnerability. |

---

### P1-4: 14 models missing `updatedAt` timestamp

| Field | Value |
|-------|-------|
| **Risk** | Cannot track when records were last modified. Makes audit trails incomplete. Prevents optimistic concurrency control. Makes cache invalidation impossible. |
| **Priority** | P1 — High |
| **Recommendation** | Add `updatedAt DateTime @default(now()) @updatedAt` to all models that can be modified. |
| **Evidence** | Schema grep confirmed these models have NO `updatedAt`:<br>• `Section`, `Lesson`, `Enrollment`, `Order`, `EventRSVP`, `Invitation`, `Notification`, `ModerationReport`, `BannedKeyword`, `AuditLog`, `MemberWarning`, `Customer`, `Affiliate`, `WebPage` |
| **Impact** | When a `ModerationReport` is resolved, there's no `updatedAt` to show when it changed. When a `Customer`'s LTV is updated, there's no timestamp. When an `Invitation` status changes from PENDING to ACCEPTED, `acceptedAt` is set but `updatedAt` is not — making it impossible to detect if the invitation was modified after acceptance. |

---

### P1-5: `FeatureFlag` and `AdminSetting` missing `createdAt` timestamp

| Field | Value |
|-------|-------|
| **Risk** | Cannot determine when a feature flag or admin setting was first created. Makes change tracking impossible. |
| **Priority** | P1 — High |
| **Recommendation** | Add `createdAt DateTime @default(now)` to both models. |
| **Evidence** | `prisma/schema.prisma`:<br>• `FeatureFlag` (lines 569–576): has `updatedAt` only, no `createdAt`<br>• `AdminSetting` (lines 578–584): has `updatedAt` only, no `createdAt`<br>• DB confirmed: both tables have 8 rows each, but no creation timestamp. |
| **Impact** | Admins cannot see when a feature flag was added. Audit trails are incomplete for admin actions. |

---

### P1-6: 3 slug fields have NO unique constraint — duplicate slugs possible

| Field | Value |
|-------|-------|
| **Risk** | `WebPage.slug`, `Page.slug`, and `BlogPost.slug` have no unique constraint. Two pages in the same workspace can have the same slug, causing routing ambiguity. |
| **Priority** | P1 — High |
| **Recommendation** | Add `@@unique([workspaceId, slug])` to `Page` and `BlogPost`. For `WebPage`, either add the constraint or consolidate with `Page` (see P0-3). |
| **Evidence** | Schema grep:<br>• `WebPage` (line 456–467): `slug String` — no `@@unique`<br>• `Page` (line 588–611): `slug String` — no `@@unique`<br>• `BlogPost` (line 666–684): `slug String` — no `@@unique`<br>• Contrast: `CommunitySpace` (line 260): `@@unique([workspaceId, slug])` — correct ✓ |
| **Impact** | Duplicate slugs cause unpredictable routing. The first page with a given slug wins, but the second page becomes unreachable. SEO is harmed by duplicate URLs. |

---

### P1-7: `Affiliate.code` is globally unique — should be workspace-scoped

| Field | Value |
|-------|-------|
| **Risk** | Two workspaces cannot use the same affiliate code (e.g., "SUMMER2025"). If workspace A uses code "PROMO10", workspace B cannot use it. This is incorrect for multi-tenancy. |
| **Priority** | P1 — High |
| **Recommendation** | Change `code String @unique` to `@@unique([workspaceId, code])`. This allows each workspace to have its own code namespace. |
| **Evidence** | `prisma/schema.prisma` line 446: `code String @unique` — global uniqueness. Contrast with `CommunitySpace` which correctly uses `@@unique([workspaceId, slug])`. |
| **Impact** | Affiliate code collisions across workspaces. A new workspace cannot use common promo codes like "WELCOME10" if another workspace already claimed it. |

---

### P1-8: `Customer.email` has NO unique constraint — duplicate customers possible

| Field | Value |
|-------|-------|
| **Risk** | The same customer email can be added multiple times to the same workspace, creating duplicate records. CRM data becomes unreliable. |
| **Priority** | P1 — High |
| **Recommendation** | Add `@@unique([workspaceId, email])` to prevent duplicate customers within a workspace. |
| **Evidence** | `prisma/schema.prisma` lines 402–414: `Customer` has `email String` with no unique constraint. DB has 24 customer rows. |
| **Impact** | Duplicate customer records skew LTV calculations, order counts, and CRM analytics. Marketing emails may be sent multiple times to the same address. |

---

### P1-9: `Order` model has `workspaceId` but NO relation to `Workspace`

| Field | Value |
|-------|-------|
| **Risk** | Same as P0-2 but for `Order`. If a workspace is deleted, its orders remain as orphans. No cascade delete. No referential integrity. |
| **Priority** | P1 — High (elevated from P0 because `Order` has a relation to `User` which cascades, and the `workspaceId` is somewhat redundant — but still a integrity gap) |
| **Recommendation** | Add `workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` and `@@index([workspaceId])`. |
| **Evidence** | `prisma/schema.prisma` lines 157–171: `Order` has `workspaceId String` but only `user` and `product` relations. No `workspace` field. DB has 40 order rows. |
| **Impact** | Workspace deletion leaves 40 orphan orders. Orders cannot be eagerly loaded with workspace via `include: { workspace: true }`. |

---

## P2 — Medium Findings (Performance / Maintainability)

### P2-1: 19 foreign keys missing `@@index` — query performance degradation

| Field | Value |
|-------|-------|
| **Risk** | Queries that filter by these FK columns perform full table scans. As data grows, performance degrades linearly. SQLite creates indexes automatically for `@unique` and `@@unique` fields, but NOT for plain FK columns. |
| **Priority** | P2 — Medium |
| **Recommendation** | Add `@@index([columnName])` for every FK column that is used in `where` clauses or `orderBy`. |
| **Evidence** | Schema grep + DB index list confirmed these FKs have NO index:<br>• `Section.courseId`<br>• `Lesson.sectionId`<br>• `Enrollment.userId`, `Enrollment.courseId`<br>• `Order.userId`, `Order.workspaceId`, `Order.productId`<br>• `Customer.workspaceId`<br>• `Affiliate.workspaceId`<br>• `WebPage.workspaceId`<br>• `MembershipPlan.workspaceId`<br>• `CreditTransaction.userId`<br>• `AiGeneration.userId`, `AiGeneration.toolId`<br>• `PageSection.pageId`<br>• `PageVersion.pageId`<br>• `FunnelStep.funnelId`<br>• `BlogPost.workspaceId`<br>• `CommunityComment.userId`<br>• `CommunityEvent.userId`, `CommunityEvent.spaceId`<br>• `MemberWarning.memberId`, `MemberWarning.issuedBy`<br>• `Course.workspaceId`<br>• `Product.workspaceId`<br><br>DB confirmed: SQLite index list does not contain these columns. |
| **Impact** | With 40 orders, a scan is fast. With 40,000 orders, `db.order.findMany({ where: { workspaceId } })` does a full table scan. Same applies to all listed tables. Prisma does NOT auto-index FKs in SQLite. |

---

### P2-2: Dead models — `PageVersion` and `AiConversation` have 0 rows and 0 API usage

| Field | Value |
|-------|-------|
| **Risk** | Dead code. Schema complexity. Confusion for developers who think these features exist. Migration overhead. |
| **Priority** | P2 — Medium |
| **Recommendation** | Either implement the feature (page version history, AI conversation persistence) or remove the models from the schema. Do not leave unused models in a production schema. |
| **Evidence** | • `PageVersion`: 0 rows in DB, 0 API files reference `db.pageVersion`<br>• `AiConversation`: 0 rows in DB, 0 API files reference `db.aiConversation`<br>• Both models have full field definitions and relations in the schema (lines 626–635 and 481–491). |
| **Impact** | Developers may build features against these models assuming they work. Schema migrations take longer. Prisma client includes unnecessary types. |

---

### P2-3: `Enrollment` and `FunnelStep` models have data but 0 API usage

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
| **Recommendation** | This is acceptable for SQLite (which doesn't have a native JSON type). For production with PostgreSQL, switch to `Json` type. Always use `safeJsonParse()` on read (already done in community APIs). Add Zod validation on write. |
| **Evidence** | Fields storing JSON as String:<br>• `CommunityPost`: hashtags, mentions, pollOptions, attachments, reactions<br>• `CommunityComment`: mentions, attachments<br>• `WorkspaceMember`: badges<br>• `AuditLog`: metadata<br>• `PageSection`: content<br>• `PageVersion`: sections<br>• `Page`: schema<br>• `AiConversation`: messages<br>• `AiGeneration`: structured<br>• `EmailCampaign`: (none, but body is plain text) |
| **Impact** | Invalid JSON in any of these fields causes a runtime crash when parsed. The `safeJsonParse()` helper mitigates this, but a single API that forgets to use it creates a vulnerability. |

---

### P2-5: `CommunityComment` and `EventRSVP` missing `workspaceId` — requires join for workspace queries

| Field | Value |
|-------|-------|
| **Risk** | To query all comments in a workspace, you must join through `CommunityPost`: `where: { post: { workspaceId } }`. This is less efficient than a direct `workspaceId` filter and makes the query more complex. Same for `EventRSVP` (must join through `CommunityEvent`). |
| **Priority** | P2 — Medium |
| **Recommendation** | Add `workspaceId String` to both models (denormalized for query performance). Keep the relation to the parent for cascade deletes. Add `@@index([workspaceId])`. |
| **Evidence** | `CommunityComment` (lines 220–240): has `postId` but no `workspaceId`. The moderation API already works around this: `db.communityComment.findFirst({ where: { id: targetId, post: { workspaceId } } })` — a nested filter that could be simplified to `where: { id: targetId, workspaceId }`.<br>`EventRSVP` (lines 288–299): has `eventId` and `userId` but no `workspaceId`. |
| **Impact** | Every workspace-scoped comment query requires a join. With large datasets, this is slower than a direct index lookup on `workspaceId`. |

---

### P2-6: `PostHistory.editedBy` is a plain string — cannot resolve editor via Prisma `include`

| Field | Value |
|-------|-------|
| **Risk** | The post history API must do a manual `db.user.findMany()` to resolve editor names/avatars. This is an N+1 risk if not batched properly. |
| **Priority** | P2 — Medium |
| **Recommendation** | Add `editedByUser User @relation(fields: [editedBy], references: [id], onDelete: SetNull)` to enable `include: { editedByUser: true }`. |
| **Evidence** | `prisma/schema.prisma` line 210: `editedBy String` — no relation. The posts history API at `src/app/api/community/posts/[postId]/history/route.ts` must batch-resolve editors manually. |
| **Impact** | N+1 query risk. Code complexity. If a user is deleted, their post history entries retain a dangling `editedBy` ID with no way to resolve the name. |

---

### P2-7: Inconsistent cascade rules — `Order.productId` uses `SetNull` but `Order` has no `workspace` relation

| Field | Value |
|-------|-------|
| **Risk** | `Order.productId` uses `onDelete: SetNull` — if a product is deleted, the order's `productId` becomes null but the order remains. This is intentional (preserve order history). However, `Order.workspaceId` has NO cascade rule at all (no relation), so if a workspace is deleted, orders remain as orphans. |
| **Priority** | P2 — Medium |
| **Recommendation** | Add `workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` to `Order`. This ensures workspace deletion cleans up orders. |
| **Evidence** | `prisma/schema.prisma` lines 157–171: `Order` has `product Product? @relation(..., onDelete: SetNull)` but no `workspace` relation. |
| **Impact** | Orphan orders after workspace deletion. Inconsistent with `CommunityPost`, `Course`, `Product`, etc. which all cascade-delete on workspace deletion. |

---

### P2-8: `Section` and `Lesson` missing `position` index — reordering queries are slow

| Field | Value |
|-------|-------|
| **Risk** | Course builder queries like `db.lesson.findMany({ where: { sectionId }, orderBy: { position: 'asc' } })` require sorting. Without an index on `[sectionId, position]`, this is a full scan + sort. |
| **Priority** | P2 — Medium |
| **Recommendation** | Add `@@index([sectionId, position])` to `Lesson` and `@@index([courseId, position])` to `Section`. |
| **Evidence** | `Lesson` (lines 113–124): has `sectionId` and `position` but no composite index. `Section` (lines 103–111): has `courseId` and `position` but no composite index. |
| **Impact** | Course curriculum rendering is slow with many lessons (88 lessons in DB currently). |

---

## P3 — Low Findings (Naming / Convention)

### P3-1: Inconsistent model naming — some use "Community" prefix, others don't

| Field | Value |
|-------|-------|
| **Risk** | `CommunityPost`, `CommunityComment`, `CommunitySpace`, `CommunityEvent` use the "Community" prefix. But `EventRSVP`, `PostHistory`, `ModerationReport`, `BannedKeyword`, `MemberWarning`, `AuditLog`, `Notification`, `Invitation` do not — despite all being community-related. |
| **Priority** | P3 — Low |
| **Recommendation** | No action needed — renaming would require a migration. Document the convention going forward. |
| **Evidence** | Schema model names: `CommunityPost` vs `PostHistory`, `CommunityComment` vs `EventRSVP`, `CommunitySpace` vs `ModerationReport`. |
| **Impact** | Minor developer confusion. No functional impact. |

---

### P3-2: Enum values stored as plain `String` — no DB-level validation

| Field | Value |
|-------|-------|
| **Risk** | SQLite doesn't support native enums, so all "enum" fields (role, status, type, visibility, etc.) are stored as `String`. Invalid values can be written (e.g., `memberStatus: "HACKED"`). |
| **Priority** | P3 — Low |
| **Recommendation** | This is a SQLite limitation. For production with PostgreSQL, switch to Prisma `enum` types. In the meantime, validate enum values in API code (already done in community APIs via `VALID_ROLES`, `VALID_STATUSES`, etc.). |
| **Evidence** | Schema comments document valid values (e.g., `// ACTIVE|SUSPENDED|BANNED|MUTED`) but they're not enforced. The community members API validates: `const VALID_ROLES = ['OWNER', 'ADMIN', ...]` — good ✓. |
| **Impact** | Invalid enum values can be written if an API forgets to validate. No DB-level protection. |

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

### P3-4: `EmailCampaign.createdBy` and `BannedKeyword.createdBy` are nullable — audit gap

| Field | Value |
|-------|-------|
| **Risk** | `createdBy String?` — nullable means a campaign/keyword can be created without tracking who created it. For audit purposes, this should be non-nullable (the creator is always known at creation time). |
| **Priority** | P3 — Low |
| **Recommendation** | Make non-nullable. If migrating existing nulls, set to a system user ID or the workspace owner. |
| **Evidence** | `EmailCampaign.createdBy String?` (line 431), `BannedKeyword.createdBy String?` (line 367). |
| **Impact** | Audit trail gap. Cannot determine who created a campaign or banned keyword if `createdBy` is null. |

---

### P3-5: `SiteSetting` and `AdminSetting` are near-duplicate key-value tables

| Field | Value |
|-------|-------|
| **Risk** | Both models store key-value pairs with `key String @unique`, `value String`, `category String`, `updatedAt DateTime`. `SiteSetting` is workspace-scoped (has `workspaceId`... actually it doesn't!). `AdminSetting` is global. The distinction is unclear. |
| **Priority** | P3 — Low |
| **Recommendation** | Clarify: `AdminSetting` = platform-wide (SUPER_ADMIN only). `SiteSetting` = workspace-scoped (but currently has NO `workspaceId` — this is a bug if workspace-scoped settings are intended). Either add `workspaceId` to `SiteSetting` or document that it's global. |
| **Evidence** | `SiteSetting` (lines 686–692): NO `workspaceId` field — despite the name implying workspace-level settings. `AdminSetting` (lines 578–584): also no `workspaceId` — correct for platform-wide settings. Both have 8–20 rows in DB. |
| **Impact** | If `SiteSetting` is intended to be workspace-scoped (e.g., "site title" per workspace), it's broken — all workspaces share the same settings. If it's intended to be global, the name is misleading. |

---

### P3-6: `Course.rating` and `Product.rating` are `Float` with no range validation

| Field | Value |
|-------|-------|
| **Risk** | Rating should be 0–5 (or 0–10), but nothing prevents a value of 999 or -1. |
| **Priority** | P3 — Low |
| **Recommendation** | Add API-level validation: `if (rating < 0 || rating > 5) throw error`. For PostgreSQL, add a CHECK constraint. |
| **Evidence** | `Course.rating Float @default(0)` (line 93), `Product.rating Float @default(0)` (line 149) — no constraints. |
| **Impact** | Invalid ratings could appear in the UI if an API writes them. Low risk since no API currently updates ratings. |

---

## Summary Table

| ID | Finding | Priority | Model(s) Affected |
|----|---------|----------|-------------------|
| P0-1 | `getContext()` caches single user forever | P0 | All community APIs |
| P0-2 | `Funnel` & `BlogPost` missing Workspace relation | P0 | Funnel, BlogPost |
| P0-3 | `WebPage` & `Page` are duplicate tables | P0 | WebPage, Page |
| P0-4 | 9 data APIs have no workspace filtering | P0 | 9 API routes |
| P1-1 | 17+ plain-string FKs without relations | P1 | Invitation, Notification, ModerationReport, BannedKeyword, AuditLog, MemberWarning, PostHistory, EmailCampaign, Order |
| P1-2 | `Enrollment` missing `workspaceId` | P1 | Enrollment |
| P1-3 | `User.role` defaults to "OWNER" | P1 | User |
| P1-4 | 14 models missing `updatedAt` | P1 | Section, Lesson, Enrollment, Order, EventRSVP, Invitation, Notification, ModerationReport, BannedKeyword, AuditLog, MemberWarning, Customer, Affiliate, WebPage |
| P1-5 | `FeatureFlag` & `AdminSetting` missing `createdAt` | P1 | FeatureFlag, AdminSetting |
| P1-6 | 3 slug fields have no unique constraint | P1 | WebPage, Page, BlogPost |
| P1-7 | `Affiliate.code` globally unique (should be workspace-scoped) | P1 | Affiliate |
| P1-8 | `Customer.email` no unique constraint | P1 | Customer |
| P1-9 | `Order` missing Workspace relation | P1 | Order |
| P2-1 | 19 FKs missing `@@index` | P2 | 15+ models |
| P2-2 | Dead models: `PageVersion`, `AiConversation` | P2 | PageVersion, AiConversation |
| P2-3 | Data exists but 0 API usage: `Enrollment`, `FunnelStep` | P2 | Enrollment, FunnelStep |
| P2-4 | 11 JSON fields stored as String | P2 | 6 models |
| P2-5 | `CommunityComment` & `EventRSVP` missing `workspaceId` | P2 | CommunityComment, EventRSVP |
| P2-6 | `PostHistory.editedBy` plain string (no relation) | P2 | PostHistory |
| P2-7 | `Order` cascade rules inconsistent | P2 | Order |
| P2-8 | `Section` & `Lesson` missing position index | P2 | Section, Lesson |
| P3-1 | Inconsistent model naming | P3 | Multiple |
| P3-2 | Enums stored as String | P3 | All enum fields |
| P3-3 | `commissionRate` ambiguous | P3 | Affiliate |
| P3-4 | `createdBy` nullable (audit gap) | P3 | EmailCampaign, BannedKeyword |
| P3-5 | `SiteSetting` vs `AdminSetting` near-duplicate | P3 | SiteSetting, AdminSetting |
| P3-6 | Rating fields no range validation | P3 | Course, Product |

---

## Methodology

### Files inspected
- `prisma/schema.prisma` — all 32 models, 694 lines
- `src/lib/community.ts` — workspace resolver, permissions, audit, notifications
- `src/lib/db.ts` — Prisma client
- All 62 API route files under `src/app/api/`
- `src/components/modules/community.tsx` — frontend field references
- `prisma/seed.ts`, `prisma/seed-ai-platform.ts`, `prisma/seed-pages-funnels.ts`

### Database queries executed (read-only)
- Row counts for all 32 tables
- Orphan checks: `CommunityPost.workspaceId`, `Funnel.workspaceId`, `BlogPost.workspaceId`
- `PRAGMA foreign_keys` — returns `1` (enabled)
- `sqlite_master` index listing — 32 indexes confirmed
- Duplicate workspace owner check — passed (1 owner per workspace)
- `WebPage` vs `Page` overlap check — confirmed duplicate "Homepage" with slug "home"

### Code grep patterns used
- `db\.\w+` — model usage count across all source files
- `findFirst` — workspace isolation violations
- `workspaceId` — multi-tenancy filter check
- `@@index` / `@@unique` — constraint check
- `onDelete` — cascade rule check
- `updatedAt` / `createdAt` — timestamp check

### What was NOT modified
- No schema changes
- No API changes
- No data changes
- No migration files created
- This is a read-only audit document only

---

## Next Steps

**Do not attempt to fix all 27 findings at once.** Recommended phase order:

1. **Phase DB-2 (P0 only):** Fix the 4 critical findings. These break production.
2. **Phase DB-3 (P1):** Fix the 9 high findings. These risk data integrity.
3. **Phase DB-4 (P2):** Fix the 8 medium findings. These improve performance.
4. **Phase DB-5 (P3):** Address the 6 low findings during routine maintenance.

Each phase must finish with: browser testing, API testing, database testing, TypeScript = 0, ESLint = 0, runtime verification.
