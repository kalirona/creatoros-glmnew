# MODEL AUDIT — CreatorOS

**Date:** 2026-08-05
**Scope:** All 41 Prisma models. Each model analyzed for: purpose, relations, problems, missing indexes, missing constraints, missing fields, recommended improvements.
**Methodology:** Read-only. No modifications.

---

## Audit Legend

| Status | Meaning |
|--------|---------|
| ✅ | Good — meets enterprise standard |
| ⚠️ | Warning — needs improvement |
| ❌ | Critical — must fix |
| N/A | Not applicable |

---

## 1. User

**Purpose:** Platform user account. Global across all workspaces.

**Fields:** id, email (@unique), name, avatarUrl?, bio?, role (default "OWNER"), credits (default 500), createdAt, updatedAt

**Relations:** memberships, posts, comments, events, rsvps, enrollments, orders, aiConversations, creditTxns, aiGenerations

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | `@id @default(cuid())` |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ✅ | email @unique |
| Indexes | ✅ | email unique serves as index |
| Workspace isolation | N/A | Global model |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | N/A | Is the owner |
| Audit fields | ❌ | No `createdBy`/`updatedBy` (N/A — is the user) |

**Problems:**
- ❌ `role` defaults to `"OWNER"` — privilege escalation risk. Should default to `"MEMBER"`.
- ❌ No `passwordHash` field — auth not yet implemented (when added, must be nullable, never returned in API responses)
- ❌ No `status` field — cannot suspend/ban a user globally
- ❌ No `lastLoginAt` field — cannot track user activity
- ⚠️ `credits` is a denormalized counter — no transaction ensures it stays non-negative

**Missing indexes:** None (email unique is sufficient)

**Recommended improvements:**
1. Change `role` default to `"MEMBER"`
2. Add `status String @default("ACTIVE")` (ACTIVE|SUSPENDED|BANNED)
3. Add `lastLoginAt DateTime?`
4. Add `passwordHash String?` (when auth is implemented)
5. Add `deletedAt DateTime?` for soft delete

---

## 2. Workspace

**Purpose:** Top-level tenant entity. Each workspace is an isolated tenant.

**Fields:** id, name, slug (@unique), logoUrl?, plan (default "PRO"), createdAt, updatedAt

**Relations:** members, courses, products, posts, customers, emailCampaigns, affiliates, pages, memberships, communitySpaces, communityEvents, invitations

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ✅ | slug @unique |
| Indexes | ✅ | slug unique |
| Workspace isolation | N/A | Is the workspace |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `ownerId` — owner determined via WorkspaceMember.role = OWNER |

**Problems:**
- ❌ No `ownerId` field — ownership is implicit (the WorkspaceMember with role=OWNER). If that member is deleted, the workspace becomes ownerless.
- ❌ No `deletedAt` — workspace deletion is permanent and cascades to everything
- ⚠️ No `maxMembers` / `maxCourses` / `storageLimit` fields — plan limits not enforced at DB level

**Missing indexes:** None

**Recommended improvements:**
1. Add `ownerId String` with relation to User (denormalized for quick lookup)
2. Add `deletedAt DateTime?` for soft delete
3. Add `settings String @default("{}")` for workspace-level config
4. Add `@@index([plan])` for admin queries by plan

---

## 3. WorkspaceMember

**Purpose:** Join table between User and Workspace. Stores workspace-specific role and member state.

**Fields:** id, userId, workspaceId, role (default "MEMBER"), memberStatus (default "ACTIVE"), mutedUntil?, suspendedUntil?, bannedUntil?, banReason?, lastSeenAt, joinedAt, postsCount, commentsCount, likesReceived, badges (JSON), createdAt, updatedAt

**Relations:** user, workspace

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ✅ | `@@unique([userId, workspaceId])` |
| Indexes | ✅ | `@@index([workspaceId, memberStatus])` |
| Workspace isolation | ✅ | Has workspaceId |
| Soft delete | ❌ | No `deletedAt` (deletion = leaving workspace) |
| Ownership tracking | N/A | Is the membership |

**Problems:**
- ⚠️ Denormalized counters (`postsCount`, `commentsCount`, `likesReceived`) can drift — must be maintained in transactions
- ⚠️ `badges` stored as JSON string — no validation, no query support
- ⚠️ No `invitedBy` field — cannot trace who invited this member
- ❌ No `deletedAt` — cannot track former members

**Missing indexes:** None (composite index covers workspace queries)

**Recommended improvements:**
1. Add `invitedBy String?` (relation to User)
2. Add `deletedAt DateTime?` for tracking former members
3. Consider `@@index([userId])` for "list my workspaces" queries (currently covered by unique constraint)

---

## 4. Course

**Purpose:** Sellable course within a workspace.

**Fields:** id, workspaceId, title, description, thumbnailUrl?, category, price, level, status, rating, studentsCount, createdAt, updatedAt

**Relations:** workspace, sections, enrollments

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ❌ | No `@@unique([workspaceId, slug])` — no slug field at all |
| Indexes | ❌ | **NO `@@index([workspaceId])`** |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy`/`updatedBy` |

**Problems:**
- ❌ **Missing `@@index([workspaceId])`** — every `findMany({ where: { workspaceId } })` is a full table scan
- ❌ No `createdBy` field
- ❌ No `deletedAt` field
- ⚠️ No slug field — courses are referenced by ID only (bad for SEO)
- ⚠️ `rating` is a Float with no range validation (could be 999 or -1)

**Missing indexes:**
- `@@index([workspaceId])` — CRITICAL
- `@@index([workspaceId, status])` — for filtering published courses
- `@@index([workspaceId, category])` — for category filtering

**Recommended improvements:**
1. Add `@@index([workspaceId])`
2. Add `@@index([workspaceId, status])`
3. Add `slug String` with `@@unique([workspaceId, slug])`
4. Add `createdBy String?` (relation to User)
5. Add `deletedAt DateTime?`

---

## 5. Section

**Purpose:** Course curriculum section (group of lessons).

**Fields:** id, courseId, title, position

**Relations:** course, lessons

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ❌ | **No `createdAt` or `updatedAt`** |
| Unique constraint | ❌ | No `@@unique([courseId, position])` |
| Indexes | ❌ | **NO `@@index([courseId])`** |
| Workspace isolation | ⚠️ | No workspaceId — relies on parent Course |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy`/`updatedBy` |

**Problems:**
- ❌ **Missing `createdAt` and `updatedAt`** — cannot track when section was created/modified
- ❌ **Missing `@@index([courseId])`** — full table scan when fetching sections by course
- ❌ No `@@unique([courseId, position])` — duplicate positions possible
- ❌ No `deletedAt`

**Missing indexes:**
- `@@index([courseId, position])` — CRITICAL (curriculum rendering)

**Recommended improvements:**
1. Add `createdAt DateTime @default(now())`
2. Add `updatedAt DateTime @default(now()) @updatedAt`
3. Add `@@index([courseId, position])`
4. Add `@@unique([courseId, position])`

---

## 6. Lesson

**Purpose:** Individual lesson within a section.

**Fields:** id, sectionId, title, content, type, duration, position, isPreview

**Relations:** section

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ❌ | **No `createdAt` or `updatedAt`** |
| Unique constraint | ❌ | No `@@unique([sectionId, position])` |
| Indexes | ❌ | **NO `@@index([sectionId])`** |
| Workspace isolation | ⚠️ | No workspaceId — relies on parent Section → Course |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy`/`updatedBy` |

**Problems:**
- ❌ **Missing `createdAt` and `updatedAt`**
- ❌ **Missing `@@index([sectionId, position])`** — full table scan + sort when rendering curriculum
- ❌ No `@@unique([sectionId, position])` — duplicate positions possible
- ❌ No `deletedAt`
- ⚠️ `content` is a required String — no support for video URL, PDF, etc. (only `type` field distinguishes)

**Missing indexes:**
- `@@index([sectionId, position])` — CRITICAL

**Recommended improvements:**
1. Add `createdAt DateTime @default(now())`
2. Add `updatedAt DateTime @default(now()) @updatedAt`
3. Add `@@index([sectionId, position])`
4. Add `@@unique([sectionId, position])`

---

## 7. Enrollment

**Purpose:** User enrollment in a course.

**Fields:** id, userId, courseId, progress, completed, createdAt

**Relations:** user, course

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ❌ | No `@@unique([userId, courseId])` — duplicate enrollments possible |
| Indexes | ❌ | **NO indexes on userId or courseId** |
| Workspace isolation | ❌ | **No workspaceId** — cross-tenant enrollment possible |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **Missing `workspaceId`** — a user from workspace A can enroll in a course from workspace B
- ❌ **Missing `@@index([userId])`** — "my enrollments" query is a full scan
- ❌ **Missing `@@index([courseId])`** — "course students" query is a full scan
- ❌ **Missing `@@unique([userId, courseId])`** — duplicate enrollments possible
- ❌ No `updatedAt` — cannot track progress updates
- ❌ Model is unused by any API (0 files reference `db.enrollment`) but has 3 rows from seed

**Missing indexes:**
- `@@index([userId])` — CRITICAL
- `@@index([courseId])` — CRITICAL
- `@@unique([userId, courseId])` — CRITICAL

**Recommended improvements:**
1. Add `workspaceId String` + relation to Workspace
2. Add `@@index([userId])`, `@@index([courseId])`, `@@index([workspaceId])`
3. Add `@@unique([userId, courseId])`
4. Add `updatedAt DateTime @default(now()) @updatedAt`
5. Implement APIs or remove the model

---

## 8. Product

**Purpose:** Digital product for sale.

**Fields:** id, workspaceId, name, description, coverUrl?, type, price, compareAt?, fileUrl?, salesCount, rating, status, createdAt

**Relations:** workspace, orders

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ❌ | No slug field |
| Indexes | ❌ | **NO `@@index([workspaceId])`** |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy`/`updatedBy` |

**Problems:**
- ❌ **Missing `@@index([workspaceId])`**
- ❌ **Missing `updatedAt`** — cannot track product modifications
- ❌ No `createdBy`
- ❌ No `deletedAt`
- ⚠️ No slug field — products referenced by ID only
- ⚠️ `rating` has no range validation

**Missing indexes:**
- `@@index([workspaceId])` — CRITICAL
- `@@index([workspaceId, status])` — for filtering active products

**Recommended improvements:**
1. Add `@@index([workspaceId])`
2. Add `updatedAt DateTime @default(now()) @updatedAt`
3. Add `slug String` with `@@unique([workspaceId, slug])`
4. Add `createdBy String?`
5. Add `deletedAt DateTime?`

---

## 9. Order

**Purpose:** Customer order record.

**Fields:** id, userId, workspaceId, productId?, amount, currency, status, customerEmail, customerName, createdAt

**Relations:** user, product

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ❌ | None |
| Indexes | ❌ | **NO indexes on userId, workspaceId, or productId** |
| Workspace isolation | ⚠️ | Has workspaceId but **NO relation to Workspace** (orphan risk) |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **Missing Workspace relation** — workspace deletion leaves orphan orders
- ❌ **Missing `@@index([workspaceId])`** — dashboard query is full scan
- ❌ **Missing `@@index([userId])`** — "my orders" query is full scan
- ❌ **Missing `@@index([productId])`** — "product sales" query is full scan
- ❌ **Missing `updatedAt`** — cannot track status changes (e.g., PENDING → COMPLETED → REFUNDED)
- ❌ No `createdBy`
- ⚠️ `customerEmail` and `customerName` are denormalized — no relation to Customer model

**Missing indexes:**
- `@@index([workspaceId])` — CRITICAL
- `@@index([userId])` — CRITICAL
- `@@index([productId])` — CRITICAL
- `@@index([workspaceId, status])` — for dashboard revenue query
- `@@index([workspaceId, createdAt])` — for date-range queries

**Recommended improvements:**
1. Add `workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)`
2. Add all missing indexes
3. Add `updatedAt DateTime @default(now()) @updatedAt`
4. Add `customerId String?` with relation to Customer
5. Add `deletedAt DateTime?`

---

## 10. CommunityPost

**Purpose:** Community feed post.

**Fields:** id, workspaceId, spaceId?, userId, category, postType, title, content, likesCount, commentsCount, isPinned, isLocked, isArchived, isEdited, editCount, hashtags (JSON), mentions (JSON), pollOptions (JSON), attachments (JSON), reactions (JSON), createdAt, updatedAt

**Relations:** workspace, user, space, comments, history

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ❌ | None (posts don't need unique constraints) |
| Indexes | ✅ | `@@index([workspaceId, createdAt])`, `@@index([spaceId, createdAt])` |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ⚠️ | Uses `isArchived` flag (partial soft delete) |
| Ownership tracking | ⚠️ | Has `userId` but no `createdBy`/`updatedBy` |

**Problems:**
- ⚠️ 5 JSON fields (`hashtags`, `mentions`, `pollOptions`, `attachments`, `reactions`) — no DB-level validation
- ⚠️ `reactions` stores `{ type: { count, users: [] } }` — not a relation, cannot query efficiently
- ❌ No `deletedAt` — `isArchived` is not the same (archived posts still show)
- ❌ No `createdBy` field (uses `userId` which serves as creator)
- ⚠️ No `@@index([userId])` — "my posts" query is not indexed

**Missing indexes:**
- `@@index([userId, createdAt])` — for "my posts" query
- `@@index([workspaceId, isPinned, createdAt])` — for feed query with pinned first

**Recommended improvements:**
1. Add `@@index([userId, createdAt])`
2. Add `deletedAt DateTime?` for true soft delete
3. Consider a `PostReaction` model instead of JSON `reactions` field (for query support)

---

## 11. PostHistory

**Purpose:** Edit history snapshot for community posts.

**Fields:** id, postId, editedBy, title, content, version, createdAt

**Relations:** post

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, no updatedAt (immutable — correct) |
| Unique constraint | ❌ | No `@@unique([postId, version])` |
| Indexes | ✅ | `@@index([postId])` |
| Workspace isolation | ⚠️ | No workspaceId — relies on parent Post |
| Soft delete | N/A | History is immutable |
| Ownership tracking | ⚠️ | `editedBy` is a plain string, no relation to User |

**Problems:**
- ❌ `editedBy` is a plain string — no relation to User, orphan risk, no `include` support
- ❌ No `@@unique([postId, version])` — duplicate versions possible
- ⚠️ No workspaceId — requires join through Post for workspace-scoped queries

**Missing indexes:** None critical

**Recommended improvements:**
1. Add `editedBy User? @relation(fields: [editedBy], references: [id], onDelete: SetNull)`
2. Add `@@unique([postId, version])`

---

## 12. CommunityComment

**Purpose:** Comment on a community post (supports nested replies via self-relation).

**Fields:** id, postId, parentId?, userId, content, likesCount, isEdited, mentions (JSON), attachments (JSON), createdAt, updatedAt

**Relations:** post, parent (self), replies (self), user

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ❌ | None |
| Indexes | ✅ | `@@index([postId, createdAt])`, `@@index([parentId])` |
| Workspace isolation | ⚠️ | No workspaceId — relies on parent Post |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ⚠️ | Has `userId` but no `createdBy`/`updatedBy` |

**Problems:**
- ❌ **Missing `@@index([userId])`** — "my comments" query is full scan
- ❌ No `workspaceId` — moderation queries require join through Post
- ❌ No `deletedAt` — comment deletion is permanent
- ⚠️ Self-relation with `onDelete: Cascade` — deleting a parent deletes all replies (usually desired)

**Missing indexes:**
- `@@index([userId, createdAt])` — for "my comments" query

**Recommended improvements:**
1. Add `@@index([userId, createdAt])`
2. Add `workspaceId String` + `@@index([workspaceId])` for moderation queries
3. Add `deletedAt DateTime?`

---

## 13. CommunitySpace

**Purpose:** Topic-based space within community (e.g., "Marketing Tips").

**Fields:** id, workspaceId, name, slug, description, icon, color, visibility, memberCount, postCount, status, createdAt, updatedAt

**Relations:** workspace, posts

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ✅ | `@@unique([workspaceId, slug])` |
| Indexes | ✅ | `@@index([workspaceId])` |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ⚠️ | Uses `status: ARCHIVED` (partial) |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ No `createdBy` field
- ❌ No true `deletedAt` (archived spaces still exist)
- ⚠️ `memberCount` is a denormalized counter — can drift
- ⚠️ `visibility` enum stored as String — no DB validation

**Missing indexes:** None critical

**Recommended improvements:**
1. Add `createdBy String?`
2. Add `deletedAt DateTime?`
3. Add `@@index([workspaceId, status])` for active space queries

---

## 14. CommunityEvent

**Purpose:** Community event (webinar, meetup, AMA).

**Fields:** id, workspaceId, spaceId?, userId, title, description, type, location?, meetingUrl?, startTime, endTime?, bannerUrl?, maxAttendees?, status, createdAt

**Relations:** workspace, user, rsvps

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ❌ | None |
| Indexes | ✅ | `@@index([workspaceId, startTime])` |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ❌ | No `deletedAt` (uses status: CANCELLED) |
| Ownership tracking | ❌ | No `createdBy` (has `userId` as creator) |

**Problems:**
- ❌ **Missing `updatedAt`** — cannot track event modifications
- ❌ **Missing `@@index([userId])`** — "my events" query not indexed
- ❌ **Missing `@@index([spaceId])`** — events by space not indexed
- ❌ No `createdBy`
- ❌ No `deletedAt`
- ⚠️ No `@@index([workspaceId, status])` — "upcoming events" query not optimized

**Missing indexes:**
- `@@index([userId, startTime])`
- `@@index([spaceId, startTime])`
- `@@index([workspaceId, status, startTime])`

**Recommended improvements:**
1. Add `updatedAt DateTime @default(now()) @updatedAt`
2. Add missing indexes
3. Add `createdBy String?`
4. Add `deletedAt DateTime?`

---

## 15. EventRSVP

**Purpose:** User RSVP to an event.

**Fields:** id, eventId, userId, status, createdAt

**Relations:** event, user

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ✅ | `@@unique([eventId, userId])` |
| Indexes | ⚠️ | Only the unique constraint (serves as index on [eventId, userId]) |
| Workspace isolation | ❌ | **No workspaceId** |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | N/A | Has userId |

**Problems:**
- ❌ **Missing `workspaceId`** — querying RSVPs by workspace requires join through Event
- ❌ **Missing `updatedAt`** — cannot track RSVP status changes (GOING → NOT_GOING)
- ❌ No `deletedAt`
- ⚠️ No separate `@@index([userId])` — "my RSVPs" query uses unique constraint (acceptable)

**Missing indexes:**
- `@@index([userId])` — for "my RSVPs" query

**Recommended improvements:**
1. Add `workspaceId String` + `@@index([workspaceId])`
2. Add `updatedAt DateTime @default(now()) @updatedAt`

---

## 16. Invitation

**Purpose:** Workspace invitation by email/username/link.

**Fields:** id, workspaceId, invitedBy, email?, username?, token (@unique), role, status, message, expiresAt, acceptedAt?, acceptedByUserId?, revokedAt?, revokedBy?, createdAt

**Relations:** workspace

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ✅ | `token @unique` |
| Indexes | ✅ | `@@index([workspaceId, status])`, `@@index([email])` |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ❌ | No `deletedAt` (uses status: REVOKED) |
| Ownership tracking | ⚠️ | `invitedBy` is plain string, no relation |

**Problems:**
- ❌ `invitedBy`, `acceptedByUserId`, `revokedBy` are plain strings — no relations, orphan risk
- ❌ **Missing `updatedAt`** — cannot track status changes
- ❌ No `deletedAt`
- ⚠️ `token` uses `generateToken()` which has a time-based component (predictable)

**Missing indexes:** None critical

**Recommended improvements:**
1. Add relations for `invitedBy`, `acceptedByUserId`, `revokedBy` to User
2. Add `updatedAt DateTime @default(now()) @updatedAt`
3. Use `crypto.randomUUID()` for token generation

---

## 17. Notification

**Purpose:** User notification (post, comment, mention, reaction, etc.).

**Fields:** id, userId, workspaceId, type, title, body, link, actorId?, entityId?, entityType?, read, createdAt

**Relations:** None (all FKs are plain strings)

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ❌ | None |
| Indexes | ✅ | `@@index([userId, read])`, `@@index([workspaceId, createdAt])` |
| Workspace isolation | ✅ | Has workspaceId |
| Soft delete | ❌ | Deletion is permanent |
| Ownership tracking | ⚠️ | `userId` is plain string, no relation |

**Problems:**
- ❌ `userId` and `actorId` are plain strings — no relations, orphan risk
- ❌ **Missing `updatedAt`** — cannot track when notification was read
- ❌ No `deletedAt`
- ⚠️ No `@@index([userId, createdAt])` — "recent notifications" query not optimized (covered by [userId, read] partially)

**Missing indexes:**
- `@@index([userId, createdAt])` — for recent notifications query

**Recommended improvements:**
1. Add `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`
2. Add `actor User? @relation("NotificationActor", fields: [actorId], references: [id], onDelete: SetNull)`
3. Add `updatedAt DateTime @default(now()) @updatedAt`

---

## 18. ModerationReport

**Purpose:** User-reported content for moderation.

**Fields:** id, workspaceId, reporterId, targetType, targetId, reason, description, status, resolvedBy?, resolution?, createdAt, resolvedAt?

**Relations:** None (all FKs are plain strings)

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt + resolvedAt, **no updatedAt** |
| Unique constraint | ❌ | No `@@unique([reporterId, targetType, targetId])` — duplicate reports possible |
| Indexes | ✅ | `@@index([workspaceId, status])`, `@@index([targetType, targetId])` |
| Workspace isolation | ✅ | Has workspaceId |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ⚠️ | `reporterId`, `resolvedBy` are plain strings |

**Problems:**
- ❌ `reporterId` and `resolvedBy` are plain strings — no relations
- ❌ **Missing `updatedAt`**
- ❌ No `@@unique([reporterId, targetType, targetId])` — same user can report same content multiple times
- ❌ No `deletedAt`

**Missing indexes:** None critical

**Recommended improvements:**
1. Add relations for `reporterId` and `resolvedBy`
2. Add `@@unique([reporterId, targetType, targetId])`
3. Add `updatedAt DateTime @default(now()) @updatedAt`

---

## 19. BannedKeyword

**Purpose:** Workspace-level banned keyword for content moderation.

**Fields:** id, workspaceId, keyword, action, replacement?, severity, createdBy?, createdAt

**Relations:** None (workspaceId has no relation)

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ❌ | No `@@unique([workspaceId, keyword])` — duplicate keywords possible |
| Indexes | ✅ | `@@index([workspaceId])` |
| Workspace isolation | ✅ | Has workspaceId |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ⚠️ | `createdBy` is nullable plain string |

**Problems:**
- ❌ **Missing `@@unique([workspaceId, keyword])`** — same keyword can be added twice
- ❌ **Missing `updatedAt`**
- ❌ No `deletedAt`
- ⚠️ `createdBy` is nullable — should be non-nullable (creator always known)

**Missing indexes:** None critical

**Recommended improvements:**
1. Add `@@unique([workspaceId, keyword])`
2. Add `updatedAt DateTime @default(now()) @updatedAt`
3. Make `createdBy` non-nullable

---

## 20. AuditLog

**Purpose:** Immutable audit trail for administrative actions.

**Fields:** id, workspaceId, actorId, actorRole?, action, targetType?, targetId?, metadata (JSON), ip?, createdAt

**Relations:** None (all FKs are plain strings)

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, no updatedAt (immutable — correct) |
| Unique constraint | ❌ | None |
| Indexes | ✅ | `@@index([workspaceId, createdAt])`, `@@index([actorId])` |
| Workspace isolation | ✅ | Has workspaceId |
| Soft delete | N/A | Audit logs should never be deleted |
| Ownership tracking | ⚠️ | `actorId` is plain string |

**Problems:**
- ❌ `actorId` is a plain string — no relation to User, orphan risk
- ⚠️ No `@@index([action])` — filtering by action type requires scan
- ⚠️ No `@@index([targetType, targetId])` — finding all actions on a target requires scan

**Missing indexes:**
- `@@index([action, createdAt])` — for action-type filtering

**Recommended improvements:**
1. Add `actor User? @relation(fields: [actorId], references: [id], onDelete: SetNull)`
2. Add `@@index([action, createdAt])`

---

## 21. MemberWarning

**Purpose:** Warning issued to a workspace member.

**Fields:** id, memberId, workspaceId, issuedBy, reason, severity, acknowledged, createdAt

**Relations:** None (all FKs are plain strings)

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ❌ | None |
| Indexes | ⚠️ | Only `@@index([workspaceId])` — **missing `@@index([memberId])`** |
| Workspace isolation | ✅ | Has workspaceId |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ⚠️ | `memberId`, `issuedBy` are plain strings |

**Problems:**
- ❌ **Missing `@@index([memberId])`** — "warnings for a member" query is full scan
- ❌ `memberId` and `issuedBy` are plain strings — no relations
- ❌ **Missing `updatedAt`** — cannot track acknowledgment
- ❌ No `deletedAt`

**Missing indexes:**
- `@@index([memberId])` — CRITICAL
- `@@index([issuedBy])` — for "warnings I issued" query

**Recommended improvements:**
1. Add `@@index([memberId])`
2. Add relations for `memberId` (→ WorkspaceMember) and `issuedBy` (→ User)
3. Add `updatedAt DateTime @default(now()) @updatedAt`

---

## 22. Customer

**Purpose:** CRM customer record.

**Fields:** id, workspaceId, name, email, tags, ltv, ordersCount, status, createdAt

**Relations:** workspace

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ❌ | **No `@@unique([workspaceId, email])`** — duplicate customers possible |
| Indexes | ❌ | **NO `@@index([workspaceId])`** |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **Missing `@@index([workspaceId])`**
- ❌ **Missing `@@unique([workspaceId, email])`** — duplicate customers
- ❌ **Missing `updatedAt`**
- ❌ No `createdBy`
- ❌ No `deletedAt`
- ⚠️ `tags` is a comma-separated string — should be JSON array or separate Tag model

**Missing indexes:**
- `@@index([workspaceId])` — CRITICAL
- `@@index([workspaceId, status])` — for status filtering

**Recommended improvements:**
1. Add `@@index([workspaceId])`
2. Add `@@unique([workspaceId, email])`
3. Add `updatedAt DateTime @default(now()) @updatedAt`
4. Add `createdBy String?`
5. Add `deletedAt DateTime?`

---

## 23. EmailCampaign

**Purpose:** Email marketing campaign.

**Fields:** id, workspaceId, name, subject, previewText, body, type, status, audience, recipients, openRate, clickRate, sentAt?, scheduledAt?, createdBy?, createdAt, updatedAt

**Relations:** workspace

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ❌ | None |
| Indexes | ✅ | `@@index([workspaceId, status])`, `@@index([workspaceId, createdAt])` |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ⚠️ | `createdBy` is nullable |

**Problems:**
- ❌ No `deletedAt`
- ⚠️ `createdBy` is nullable — should be non-nullable
- ⚠️ No `@@index([workspaceId, type])` — filtering by type not indexed

**Missing indexes:**
- `@@index([workspaceId, type])` — for type filtering

**Recommended improvements:**
1. Add `deletedAt DateTime?`
2. Make `createdBy` non-nullable
3. Add `@@index([workspaceId, type])`

---

## 24. Affiliate

**Purpose:** Affiliate partner record.

**Fields:** id, workspaceId, name, email, code (@unique), clicks, conversions, earnings, commissionRate, status

**Relations:** workspace

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ❌ | **No `createdAt` or `updatedAt`** |
| Unique constraint | ⚠️ | `code @unique` — globally unique (should be `[workspaceId, code]`) |
| Indexes | ❌ | **NO `@@index([workspaceId])`** |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **Missing `createdAt` and `updatedAt`**
- ❌ **Missing `@@index([workspaceId])`**
- ❌ `code @unique` is global — should be `@@unique([workspaceId, code])` for multi-tenancy
- ❌ No `deletedAt`
- ⚠️ `commissionRate` defaults to 0.3 — ambiguous (30% or 0.3%?)

**Missing indexes:**
- `@@index([workspaceId])` — CRITICAL

**Recommended improvements:**
1. Add `createdAt DateTime @default(now())` and `updatedAt DateTime @default(now()) @updatedAt`
2. Add `@@index([workspaceId])`
3. Change to `@@unique([workspaceId, code])`
4. Add `deletedAt DateTime?`

---

## 25. WebPage

**Purpose:** Legacy page model — **duplicate of Page**.

**Fields:** id, workspaceId, title, slug, type, status, visits, createdAt

**Relations:** workspace

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, **no updatedAt** |
| Unique constraint | ❌ | **No unique on slug** |
| Indexes | ❌ | **NO `@@index([workspaceId])`** |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **DUPLICATE TABLE** — `Page` model has the same purpose with richer fields
- ❌ **Missing `@@index([workspaceId])`**
- ❌ **No unique constraint on slug** — duplicate slugs possible
- ❌ **Missing `updatedAt`**
- ❌ No `deletedAt`
- ❌ DB confirmed: 3 duplicate slugs exist across WebPage and Page (`home`, `about`, `ai-content-studio`)

**Missing indexes:** `@@index([workspaceId])`

**Recommended improvements:**
1. **Consolidate into `Page` model** — migrate WebPage data to Page, then remove WebPage
2. If kept: add `@@index([workspaceId])`, `@@unique([workspaceId, slug])`, `updatedAt`, `deletedAt`

---

## 26. MembershipPlan

**Purpose:** Membership tier plan.

**Fields:** id, workspaceId, name, price, interval, members, status

**Relations:** workspace

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ❌ | **No `createdAt` or `updatedAt`** |
| Unique constraint | ❌ | None |
| Indexes | ❌ | **NO `@@index([workspaceId])`** |
| Workspace isolation | ✅ | Has workspaceId + relation |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **Missing `createdAt` and `updatedAt`**
- ❌ **Missing `@@index([workspaceId])`**
- ❌ No `deletedAt`
- ❌ No `createdBy`
- ⚠️ `members` is a denormalized counter — can drift

**Missing indexes:** `@@index([workspaceId])` — CRITICAL

**Recommended improvements:**
1. Add `createdAt` and `updatedAt`
2. Add `@@index([workspaceId])`
3. Add `deletedAt DateTime?`
4. Add `createdBy String?`

---

## 27. AiConversation

**Purpose:** AI chat conversation history.

**Fields:** id, userId, tool, title, messages (JSON), createdAt, updatedAt

**Relations:** user

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ❌ | None |
| Indexes | ❌ | **NO `@@index([userId])`** |
| Workspace isolation | ❌ | **No workspaceId** |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ⚠️ | Has `userId` |

**Problems:**
- ❌ **DEAD MODEL** — 0 rows in DB, 0 API files reference it
- ❌ **Missing `@@index([userId])`**
- ❌ **Missing `workspaceId`** — AI conversations should be workspace-scoped
- ❌ No `deletedAt`
- ⚠️ `messages` stored as JSON string — no query support

**Missing indexes:** `@@index([userId, createdAt])`

**Recommended improvements:**
1. **Either implement the feature or remove the model**
2. If kept: add `workspaceId`, `@@index([userId, createdAt])`, `deletedAt`

---

## 28. CreditTransaction

**Purpose:** Credit purchase/spend ledger.

**Fields:** id, userId, amount, reason, createdAt

**Relations:** user

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, no updatedAt (immutable — correct) |
| Unique constraint | ❌ | None |
| Indexes | ❌ | **NO `@@index([userId])`** |
| Workspace isolation | ❌ | **No workspaceId** |
| Soft delete | N/A | Ledger is immutable |
| Ownership tracking | ⚠️ | Has `userId` |

**Problems:**
- ❌ **Missing `@@index([userId])`** — "my credit history" query is full scan
- ❌ **Missing `workspaceId`** — cannot scope credits to workspace
- ⚠️ No `balanceAfter` field — cannot reconstruct balance history without aggregation

**Missing indexes:**
- `@@index([userId, createdAt])` — CRITICAL

**Recommended improvements:**
1. Add `@@index([userId, createdAt])`
2. Add `workspaceId String?` + `@@index([workspaceId])`
3. Add `balanceAfter Int` (snapshot of balance after transaction)

---

## 29–30. AiProvider, AiModel

**Purpose:** AI provider/model configuration (platform-wide admin).

**Fields (AiProvider):** id, name (@unique), slug (@unique), apiKey, baseUrl, isActive, priority, createdAt, updatedAt
**Fields (AiModel):** id, providerId, name, displayName, contextWindow, isDefault, costMultiplier, isActive

| Check | AiProvider | AiModel |
|-------|-----------|---------|
| Primary key | ✅ | ✅ |
| Timestamps | ✅ | ❌ **No timestamps** |
| Unique constraint | ✅ name, slug | ❌ None |
| Indexes | ✅ via unique | ❌ **No `@@index([providerId])`** |
| Workspace isolation | N/A (global) | N/A (global) |
| Soft delete | ❌ | ❌ |

**Problems:**
- ❌ `AiModel` missing `createdAt`, `updatedAt`
- ❌ `AiModel` missing `@@index([providerId])`
- ⚠️ `AiProvider.apiKey` stored in plaintext — should be encrypted
- ⚠️ No `@@unique([providerId, name])` on AiModel — duplicate model names per provider possible

**Recommended improvements:**
1. Add timestamps to `AiModel`
2. Add `@@index([providerId])` to `AiModel`
3. Add `@@unique([providerId, name])` to `AiModel`
4. Encrypt `apiKey` at rest

---

## 31. AiTool

**Purpose:** AI tool configuration (system prompts, credit costs).

**Fields:** id, slug (@unique), name, description, icon, category, systemPrompt, userInputPrompt, creditCost, temperature, maxTokens, outputType, isVisible, isPro, outputSchema, createdAt, updatedAt

**Relations:** generations

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ✅ | slug @unique |
| Indexes | ✅ | via unique |
| Workspace isolation | N/A | Global (admin-managed) |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy`/`updatedBy` |

**Problems:**
- ❌ No `deletedAt`
- ❌ No `createdBy`/`updatedBy`
- ⚠️ `systemPrompt` is plaintext — could contain sensitive instructions

**Recommended improvements:**
1. Add `deletedAt DateTime?`
2. Add `createdBy String?` and `updatedBy String?`

---

## 32. AiGeneration

**Purpose:** AI generation output record.

**Fields:** id, userId, toolId, toolSlug, title, input, output, structured (JSON), status, creditsUsed, createdAt

**Relations:** user, tool

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, no updatedAt (immutable — correct) |
| Unique constraint | ❌ | None |
| Indexes | ❌ | **NO `@@index([userId])` or `@@index([toolId])`** |
| Workspace isolation | ❌ | **No workspaceId** |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ⚠️ | Has `userId` |

**Problems:**
- ❌ **Missing `@@index([userId, createdAt])`** — "my generations" query is full scan
- ❌ **Missing `@@index([toolId])`** — "generations by tool" query is full scan
- ❌ **Missing `workspaceId`** — cannot scope to workspace
- ❌ No `deletedAt`
- ⚠️ `toolSlug` is denormalized (also in AiTool) — can drift if tool slug changes

**Missing indexes:**
- `@@index([userId, createdAt])` — CRITICAL
- `@@index([toolId])` — CRITICAL

**Recommended improvements:**
1. Add missing indexes
2. Add `workspaceId String?` + `@@index([workspaceId])`
3. Add `deletedAt DateTime?`

---

## 33–34. FeatureFlag, AdminSetting

**Purpose:** Platform-wide configuration (admin-managed).

**Fields (FeatureFlag):** id, key (@unique), name, description, enabled, updatedAt
**Fields (AdminSetting):** id, key (@unique), value, category, updatedAt

| Check | FeatureFlag | AdminSetting |
|-------|------------|--------------|
| Primary key | ✅ | ✅ |
| Timestamps | ⚠️ **No createdAt**, has updatedAt | ⚠️ **No createdAt**, has updatedAt |
| Unique constraint | ✅ key | ✅ key |
| Indexes | ✅ via unique | ✅ via unique |
| Workspace isolation | N/A (global) | N/A (global) |
| Soft delete | ❌ | ❌ |
| Ownership tracking | ❌ No `updatedBy` | ❌ No `updatedBy` |

**Problems:**
- ❌ Both missing `createdAt`
- ❌ Both missing `updatedBy` — cannot track who changed a flag/setting
- ❌ No `deletedAt`

**Recommended improvements:**
1. Add `createdAt DateTime @default(now())` to both
2. Add `updatedBy String?` to both
3. Add `deletedAt DateTime?`

---

## 35. Page

**Purpose:** Rich page with sections, versions, and funnel integration.

**Fields:** id, workspaceId, title, slug, type, status, category, funnelId?, seoTitle, seoDescription, ogImage, schema (JSON), visits, conversions, publishedAt?, scheduledAt?, createdAt, updatedAt

**Relations:** sections, versions, funnelSteps

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ❌ | **No `@@unique([workspaceId, slug])`** |
| Indexes | ❌ | **NO `@@index([workspaceId])`** |
| Workspace isolation | ❌ | **Has workspaceId but NO relation to Workspace** |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **Missing Workspace relation** — `workspaceId` is a plain string
- ❌ **Missing `@@index([workspaceId])`**
- ❌ **Missing `@@unique([workspaceId, slug])`** — duplicate slugs possible
- ❌ No `deletedAt`
- ❌ No `createdBy`/`updatedBy`
- ⚠️ `funnelId` is a plain string with no relation to Funnel

**Missing indexes:**
- `@@index([workspaceId])` — CRITICAL
- `@@index([workspaceId, status])` — for published page queries

**Recommended improvements:**
1. Add `workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)`
2. Add `@@index([workspaceId])`
3. Add `@@unique([workspaceId, slug])`
4. Add `funnel Funnel? @relation(fields: [funnelId], references: [id], onDelete: SetNull)`
5. Add `deletedAt DateTime?`

---

## 36. PageSection

**Purpose:** Section within a page (hero, features, pricing, etc.).

**Fields:** id, pageId, type, content (JSON), position, isHidden, createdAt, updatedAt

**Relations:** page

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ❌ | No `@@unique([pageId, position])` |
| Indexes | ❌ | **NO `@@index([pageId])`** |
| Workspace isolation | ⚠️ | No workspaceId — relies on parent Page |
| Soft delete | ❌ | No `deletedAt` (uses `isHidden`) |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **Missing `@@index([pageId, position])`** — fetching sections in order is full scan + sort
- ❌ No `@@unique([pageId, position])` — duplicate positions possible
- ❌ No `deletedAt`

**Missing indexes:**
- `@@index([pageId, position])` — CRITICAL

**Recommended improvements:**
1. Add `@@index([pageId, position])`
2. Add `@@unique([pageId, position])`

---

## 37. PageVersion

**Purpose:** Page version snapshot.

**Fields:** id, pageId, version, sections (JSON), note, createdAt

**Relations:** page

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has createdAt, no updatedAt (immutable — correct) |
| Unique constraint | ❌ | No `@@unique([pageId, version])` |
| Indexes | ❌ | **NO `@@index([pageId])`** |
| Workspace isolation | ⚠️ | No workspaceId — relies on parent Page |
| Soft delete | N/A | Versions are immutable |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **DEAD MODEL** — 0 rows in DB, 0 API files reference it
- ❌ **Missing `@@index([pageId])`**
- ❌ No `@@unique([pageId, version])`

**Recommended improvements:**
1. **Either implement page version history or remove the model**
2. If kept: add `@@index([pageId])`, `@@unique([pageId, version])`

---

## 38. Funnel

**Purpose:** Sales funnel with steps.

**Fields:** id, workspaceId, name, description, type, status, visits, conversions, revenue, createdAt, updatedAt

**Relations:** steps

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ❌ | None |
| Indexes | ❌ | **NO `@@index([workspaceId])`** |
| Workspace isolation | ❌ | **Has workspaceId but NO relation to Workspace** |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **Missing Workspace relation** — orphan risk on workspace deletion
- ❌ **Missing `@@index([workspaceId])`**
- ❌ No `deletedAt`
- ❌ No `createdBy`/`updatedBy`

**Missing indexes:** `@@index([workspaceId])` — CRITICAL

**Recommended improvements:**
1. Add `workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)`
2. Add `@@index([workspaceId])`
3. Add `deletedAt DateTime?`
4. Add `createdBy String?`

---

## 39. FunnelStep

**Purpose:** Step within a funnel.

**Fields:** id, funnelId, pageId?, name, type, position, isRequired

**Relations:** funnel, page

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ❌ | **No `createdAt` or `updatedAt`** |
| Unique constraint | ❌ | No `@@unique([funnelId, position])` |
| Indexes | ❌ | **NO `@@index([funnelId])`** |
| Workspace isolation | ⚠️ | No workspaceId — relies on parent Funnel |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy` |

**Problems:**
- ❌ **DEAD MODEL** — 0 API files reference it (but 8 rows from seed)
- ❌ **Missing `createdAt` and `updatedAt`**
- ❌ **Missing `@@index([funnelId, position])`**
- ❌ No `@@unique([funnelId, position])`
- ❌ No `deletedAt`

**Missing indexes:**
- `@@index([funnelId, position])` — CRITICAL

**Recommended improvements:**
1. **Either implement funnel step management or remove the model + seed data**
2. If kept: add timestamps, `@@index([funnelId, position])`, `@@unique([funnelId, position])`

---

## 40. BlogPost

**Purpose:** Blog article.

**Fields:** id, workspaceId, title, slug, excerpt, content, coverUrl, category, tags, author, status, seoTitle, seoDescription, visits, publishedAt?, createdAt, updatedAt

**Relations:** None (workspaceId has no relation)

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ✅ | createdAt + updatedAt |
| Unique constraint | ❌ | **No `@@unique([workspaceId, slug])`** |
| Indexes | ❌ | **NO `@@index([workspaceId])`** |
| Workspace isolation | ❌ | **Has workspaceId but NO relation to Workspace** |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `createdBy` (has `author` string) |

**Problems:**
- ❌ **Missing Workspace relation** — orphan risk
- ❌ **Missing `@@index([workspaceId])`**
- ❌ **Missing `@@unique([workspaceId, slug])`** — duplicate slugs possible
- ❌ No `deletedAt`
- ❌ `author` defaults to `"Alex Rivera"` — hardcoded
- ⚠️ `tags` is comma-separated string — should be JSON array

**Missing indexes:**
- `@@index([workspaceId])` — CRITICAL
- `@@index([workspaceId, status, publishedAt])` — for published blog queries

**Recommended improvements:**
1. Add `workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)`
2. Add `@@index([workspaceId])`
3. Add `@@unique([workspaceId, slug])`
4. Change `author` default to `""`
5. Add `deletedAt DateTime?`

---

## 41. SiteSetting

**Purpose:** Workspace site settings (brand, header, footer, analytics, SEO).

**Fields:** id, key (@unique), value, category, updatedAt

**Relations:** None

| Check | Status | Notes |
|-------|--------|-------|
| Primary key | ✅ | cuid |
| Timestamps | ⚠️ | Has updatedAt, **no createdAt** |
| Unique constraint | ⚠️ | `key @unique` — global, should be `[workspaceId, key]` |
| Indexes | ✅ | via unique |
| Workspace isolation | ❌ | **NO `workspaceId`** — all workspaces share the same settings! |
| Soft delete | ❌ | No `deletedAt` |
| Ownership tracking | ❌ | No `updatedBy` |

**Problems:**
- ❌ **Missing `workspaceId`** — despite the name "SiteSetting", all workspaces share settings
- ❌ **Missing `createdAt`**
- ❌ `key @unique` is global — should be `@@unique([workspaceId, key])` if workspace-scoped
- ❌ No `updatedBy`
- ⚠️ Near-duplicate of `AdminSetting` (which is correctly global)

**Missing indexes:** N/A (key unique covers it)

**Recommended improvements:**
1. Add `workspaceId String` + `@@index([workspaceId])`
2. Change to `@@unique([workspaceId, key])`
3. Add `createdAt DateTime @default(now())`
4. Add `updatedBy String?`
5. Clarify distinction from `AdminSetting` (global vs workspace-scoped)

---

## Summary: Missing Fields Across All Models

| Field | Models Missing It | Count |
|-------|-------------------|-------|
| `deletedAt` (soft delete) | All 41 models | 41 |
| `updatedBy` | All 41 models | 41 |
| `createdBy` | 35 models (only EmailCampaign, BannedKeyword have it, both nullable) | 35 |
| `updatedAt` | 14 models | 14 |
| `createdAt` | 4 models (FeatureFlag, AdminSetting, Affiliate, MembershipPlan) | 4 |
| `workspaceId` | 9 models that should have it | 9 |

## Summary: Missing Indexes (CRITICAL)

| Model | Missing Index | Impact |
|-------|--------------|--------|
| Course | `@@index([workspaceId])` | Full scan on course list |
| Section | `@@index([courseId, position])` | Full scan on curriculum |
| Lesson | `@@index([sectionId, position])` | Full scan on lessons |
| Enrollment | `@@index([userId])`, `@@index([courseId])` | Full scan on enrollments |
| Product | `@@index([workspaceId])` | Full scan on product list |
| Order | `@@index([workspaceId])`, `@@index([userId])`, `@@index([productId])` | Full scan on orders |
| Customer | `@@index([workspaceId])` | Full scan on customers |
| Affiliate | `@@index([workspaceId])` | Full scan on affiliates |
| WebPage | `@@index([workspaceId])` | Full scan on pages |
| MembershipPlan | `@@index([workspaceId])` | Full scan on plans |
| CreditTransaction | `@@index([userId, createdAt])` | Full scan on credit history |
| AiGeneration | `@@index([userId, createdAt])`, `@@index([toolId])` | Full scan on generations |
| AiModel | `@@index([providerId])` | Full scan on models |
| Page | `@@index([workspaceId])` | Full scan on pages |
| PageSection | `@@index([pageId, position])` | Full scan on sections |
| PageVersion | `@@index([pageId])` | Full scan on versions |
| Funnel | `@@index([workspaceId])` | Full scan on funnels |
| FunnelStep | `@@index([funnelId, position])` | Full scan on steps |
| BlogPost | `@@index([workspaceId])` | Full scan on blog posts |
| CommunityComment | `@@index([userId, createdAt])` | Full scan on user comments |
| CommunityEvent | `@@index([userId])`, `@@index([spaceId])` | Full scan on events |
| MemberWarning | `@@index([memberId])` | Full scan on warnings |
| PostHistory | (has index ✓) | — |

**Total missing indexes: 28+ (some models need multiple)**
