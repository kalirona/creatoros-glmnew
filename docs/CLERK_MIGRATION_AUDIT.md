# Clerk Authentication Migration Audit

**Date:** 2026-08-11
**Phase:** Audit only — NO code changes, NO Clerk installation, NO database changes
**Goal:** Map the current authentication architecture and plan a safe migration to Clerk

---

## 1. Current Authentication Architecture

### Summary

CreatorOS currently has **NO real authentication system**. The app runs in "demo mode" where:

- There is **no login page**
- There is **no signup page**
- There is **no session management**
- There is **no password hashing**
- There is **no OAuth**
- There is **no middleware**
- There are **no auth cookies or JWTs**
- `next-auth` is installed in `package.json` but **completely unused**

Instead, every API route calls `getDemoUser()` which returns the **first user in the database** (ordered by `createdAt`). All requests are treated as belonging to this single demo user.

### Auth entry point

```
src/lib/creator-ai.ts
  ├── getDemoUser()           → db.user.findFirst({ orderBy: { createdAt: 'asc' } })
  ├── requireSuperAdmin()     → calls getDemoUser(), checks role === 'SUPER_ADMIN'
  └── DEMO_WORKSPACE_ID = 'default'
```

### Client-side auth state

```
src/store/app-store.ts
  └── userRole: 'SUPER_ADMIN'  (hardcoded default in Zustand store, persisted to localStorage)
```

The client-side `userRole` is **hardcoded to `SUPER_ADMIN'`** in the sandbox. It's never set from a real session. The `RbacGuard` component checks this client-side value — which means it's a **UX hint, not a security boundary**.

### Security boundary

The ONLY real security boundary is `requireSuperAdmin()` in API routes. The client-side `userRole` can be modified by anyone with browser devtools — it only controls UI visibility.

---

## 2. Current User/Session Structure

### User model (Prisma)

```prisma
model User {
  id            String   @id @default(cuid())   // ← Clerk will provide its own ID
  email         String   @unique                 // ← Clerk provides this
  name          String                            // ← Clerk provides this
  avatarUrl     String?                           // ← Clerk provides this
  bio           String?                           // ← CreatorOS-owned
  role          String   @default("MEMBER")       // ← CreatorOS-owned (SUPER_ADMIN|MEMBER)
  credits       Int      @default(500)            // ← CreatorOS-owned
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  memberships   WorkspaceMember[]
  posts         CommunityPost[]
  comments      CommunityComment[]
  events        CommunityEvent[]
  rsvps         EventRSVP[]
  enrollments   Enrollment[]
  orders        Order[]
  aiConversations AiConversation[]
  creditTxns    CreditTransaction[]
  aiGenerations AiGeneration[]
}
```

### Session model

**There is NO Session model.** No session table, no JWT, no session cookie. The app is stateless — every request independently resolves `getDemoUser()`.

### Current DB state

```
Users: 5
Workspaces: 1 (id: cms33vjt00000q13wjsnmap9n, slug: "creatoros")
WorkspaceMembers: 5
Invitations: 2
AuditLogs: 11
Users with role=SUPER_ADMIN: 0   ← all users are OWNER
Users with role=OWNER: 5
Users with role=MEMBER: 0
First user: cms33vjt30001q13w3wj4oh91 (founder@creatoros.io, role=OWNER)
```

### Key finding

No user currently has `role=SUPER_ADMIN`. All 5 users have `role=OWNER`. The client-side store defaults to `SUPER_ADMIN` for sandbox convenience. In production, nobody would see the Super Admin UI unless their DB `role` is set to `SUPER_ADMIN`.

---

## 3. Current Workspace/RBAC Structure

### Workspace model

```prisma
model Workspace {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  logoUrl       String?
  plan          String   @default("PRO")  // FREE|PRO|SCALE|ENTERPRISE
  createdAt     DateTime
  updatedAt     DateTime
  // ... 10+ relations (courses, products, posts, customers, etc.)
}
```

### WorkspaceMember model

```prisma
model WorkspaceMember {
  id              String   @id @default(cuid())
  userId          String   // FK → User
  workspaceId     String   // FK → Workspace
  role            String   @default("MEMBER")  // OWNER|ADMIN|MANAGER|INSTRUCTOR|MODERATOR|MEMBER|STUDENT|AFFILIATE|GUEST
  memberStatus    String   @default("ACTIVE")   // ACTIVE|SUSPENDED|BANNED|MUTED
  // ... moderation fields, stats, badges
}
```

### Two-tier role system

1. **User.role** (global account role): `SUPER_ADMIN | MEMBER`
   - Only `SUPER_ADMIN` can access platform admin settings
   - Stored on the User table
2. **WorkspaceMember.role** (workspace-scoped role): `OWNER | ADMIN | MANAGER | INSTRUCTOR | MODERATOR | MEMBER | STUDENT | AFFILIATE | GUEST`
   - Controls what a user can do within a specific workspace
   - Stored on the WorkspaceMember table

### Active workspace

**There is NO active workspace concept.** The app uses a hardcoded `DEMO_WORKSPACE_ID = 'default'` constant (57 usages across the codebase). There is no workspace switching. All data belongs to the single `default` workspace.

### RBAC enforcement

| Layer | Mechanism | Security Level |
|-------|-----------|----------------|
| API (admin) | `requireSuperAdmin()` checks `User.role === 'SUPER_ADMIN'` | Real security |
| API (creator) | `getDemoUser()` returns first user — **no role check** | None |
| Client UI | `useAppStore.userRole` (hardcoded `SUPER_ADMIN`) | UX hint only |
| Client routing | `RbacGuard` checks `canAccessModule(moduleId, userRole)` | UX hint only |
| Sidebar | `isPlatformOwner = userRole === 'SUPER_ADMIN'` | UX hint only |

---

## 4. All Authentication Entry Points

### Server-side auth resolution

| Location | Function | Called By |
|----------|----------|-----------|
| `src/lib/creator-ai.ts:17` | `getDemoUser()` | 12 creator AI routes + `requireSuperAdmin()` |
| `src/lib/creator-ai.ts:44` | `requireSuperAdmin()` | 31 admin routes |

### Client-side auth state

| Location | Purpose |
|----------|---------|
| `src/store/app-store.ts:63` | `userRole: 'SUPER_ADMIN'` (hardcoded default) |
| `src/store/app-store.ts:68` | `partialize` persists `userRole` to localStorage |
| `src/components/app/rbac-guard.tsx` | Checks `userRole` for platform modules |
| `src/components/app/sidebar.tsx:28` | `isPlatformOwner = userRole === 'SUPER_ADMIN'` |
| `src/lib/nav.ts:208` | `canAccessModule(moduleId, role)` |

### Auth-related files

| File | Purpose |
|------|---------|
| `src/lib/creator-ai.ts` | `getDemoUser()`, `requireSuperAdmin()`, `DEMO_WORKSPACE_ID` |
| `src/store/app-store.ts` | Client-side `userRole` state |
| `src/components/app/rbac-guard.tsx` | Client-side RBAC guard |
| `src/components/app/sidebar.tsx` | Sidebar visibility based on `userRole` |
| `src/lib/nav.ts` | `PLATFORM_MODULES`, `canAccessModule()`, `UserRole` type |

### What does NOT exist

- ❌ No `src/middleware.ts`
- ❌ No `src/app/login/page.tsx`
- ❌ No `src/app/signup/page.tsx`
- ❌ No `src/app/auth/` directory
- ❌ No `src/lib/auth.ts` or `src/lib/session.ts`
- ❌ No `SessionProvider` wrapper in layout
- ❌ No `getServerSession()` calls
- ❌ No `useSession()` calls
- ❌ No cookie-based session
- ❌ No JWT verification
- ❌ No password hashing
- ❌ No OAuth flow
- ❌ No email verification
- ❌ No password reset flow

---

## 5. All Protected API Routes

### Category 1: Super Admin routes (31 routes — properly guarded)

All 31 routes under `/api/admin/` call `requireSuperAdmin()` at the top of each handler. Returns 403 if `User.role !== 'SUPER_ADMIN'`.

| Route | Current Auth | Workspace Check | Role Check | Clerk Migration Requirement |
|-------|-------------|-----------------|------------|---------------------------|
| `GET /api/admin/monitoring` | `requireSuperAdmin()` | None | SUPER_ADMIN | Replace `getDemoUser()` with Clerk `auth()`, then check `User.role === 'SUPER_ADMIN'` |
| `GET/POST/PUT /api/admin/providers` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET/POST/PUT/DELETE /api/admin/approved-models` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET/PUT /api/admin/routing` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET /api/admin/logs` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET /api/admin/costs` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET /api/admin/credits` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET/POST/PUT/DELETE /api/admin/prompts` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET/PUT /api/admin/settings` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET/PUT /api/admin/flags` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET/PATCH /api/admin/security` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET/PUT /api/admin/tools` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET /api/admin/jobs` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET/PATCH/DELETE /api/admin/jobs/[id]` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET /api/admin/storage` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET /api/admin/system-metrics` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET /api/admin/generations` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET /PUT /api/admin/ai-features` | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |
| `GET/POST/PUT/PATCH/DELETE /api/admin/providers/[id]/*` (7 sub-routes) | `requireSuperAdmin()` | None | SUPER_ADMIN | Same pattern |

### Category 2: Creator AI routes (12 routes — authenticated but NO role check)

These routes call `getDemoUser()` to resolve the user, but **do not check any role**. Any user (including the first user returned by the DB) can access them.

| Route | Current Auth | Workspace Check | Role Check | Clerk Migration Requirement |
|-------|-------------|-----------------|------------|---------------------------|
| `POST /api/ai/chat` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Replace with Clerk `auth()`, resolve user mapping, keep workspace check |
| `GET /api/ai/dashboard` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Same |
| `GET /api/ai/history` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Same |
| `POST /api/ai/generate` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Same |
| `POST /api/ai/images` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Same |
| `POST /api/ai/videos` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Same |
| `GET /api/ai/videos/[id]` | None | `DEMO_WORKSPACE_ID` | None | **Add auth** + Clerk |
| `POST /api/ai/videos/[id]/retry` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Same |
| `POST /api/ai/images/[id]/actions` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Same |
| `POST /api/ai/landing-page` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Same |
| `POST /api/ai/section-rewrite` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Same |
| `GET/POST /api/ai/projects` | `getDemoUser()` | `DEMO_WORKSPACE_ID` | None | Same |
| `GET /api/n8n/health` | `getDemoUser()` | None | SUPER_ADMIN (inline check) | Replace with Clerk `auth()` + check `User.role` |

### Category 3: AI routes with NO auth (10 routes — SECURITY GAP)

These routes have **NO authentication at all**. They trust whatever parameters are passed.

| Route | Current Auth | Workspace Check | Role Check | Clerk Migration Requirement |
|-------|-------------|-----------------|------------|---------------------------|
| `GET /api/ai/assets` | None | None | None | **Add Clerk auth** + workspace filter |
| `GET/PATCH /api/ai/assets/[id]` | None | None | None | **Add Clerk auth** + ownership check |
| `POST /api/ai/assets/[id]/use` | None | None | None | **Add Clerk auth** + ownership check |
| `GET /api/ai/brand-profile` | None | None | None | **Add Clerk auth** |
| `GET /api/ai/features` | None | None | None | **Add Clerk auth** (or make public) |
| `GET /api/ai/generations` | None | None | None | **Add Clerk auth** + ownership check |
| `GET /api/ai/images/[id]` | None | None | None | **Add Clerk auth** + ownership check |
| `GET/POST /api/ai/projects/[id]` | None | None | None | **Add Clerk auth** + ownership check |
| `POST /api/ai/publish-course` | None | None | None | **Add Clerk auth** + ownership check |

### Category 4: Data routes (17 routes — NO auth at all — SECURITY GAP)

All `/api/data/*` routes have **zero authentication**. They return data from the single workspace to anyone who calls them.

| Route | Current Auth | Clerk Migration Requirement |
|-------|-------------|---------------------------|
| `GET /api/data/dashboard` | None | **Add Clerk auth** + workspace filter |
| `GET /api/data/courses` | None | Same |
| `GET /api/data/products` | None | Same |
| `GET /api/data/orders` | None | Same |
| `GET /api/data/customers` | None | Same |
| `GET /api/data/crm` | None | Same |
| `GET /api/data/analytics` | None | Same |
| `GET /api/data/community` | None | Same |
| `GET /api/data/membership` | None | Same |
| `GET /api/data/email` | None | Same |
| `GET /api/data/affiliates` | None | Same |
| `GET /api/data/blog` | None | Same |
| `GET /api/data/funnels` | None | Same |
| `GET /api/data/pages` | None | Same |
| `GET /api/data/page-sections` | None | Same |
| `GET /api/data/site-settings` | None | Same |
| `POST /api/data/courses/duplicate` | None | Same |

### Category 5: Community routes (32 routes — NO auth at all — SECURITY GAP)

All 32 `/api/community/*` routes have **zero authentication**. Anyone can create posts, comments, moderate, ban users, etc.

### Category 6: Support routes (3 routes — NO auth)

| Route | Current Auth | Clerk Migration Requirement |
|-------|-------------|---------------------------|
| `GET/POST /api/support/tickets` | None | **Add Clerk auth** |
| `GET/POST /api/support/tickets/[id]/*` | None | Same |

---

## 6. Super Admin Authorization Mechanism

### How Super Admin is determined

```
Server-side (real security):
  requireSuperAdmin()
    → getDemoUser() → db.user.findFirst()
    → if user.role !== 'SUPER_ADMIN' → return 403

Client-side (UX hint only):
  useAppStore.userRole (hardcoded 'SUPER_ADMIN' in sandbox)
    → RbacGuard checks canAccessModule(moduleId, userRole)
    → Sidebar shows/hides admin items based on isPlatformOwner
```

### Critical gap

The client-side `userRole` is **not derived from the server**. It's hardcoded in the Zustand store and persisted to localStorage. A user with browser devtools can set `userRole: 'SUPER_ADMIN'` in localStorage and see the admin UI — but the admin APIs would still return 403 because `requireSuperAdmin()` checks the real DB `User.role`.

### Clerk migration plan for Super Admin

1. Clerk authenticates the user
2. CreatorOS looks up the `User` row by Clerk user ID
3. `requireSuperAdmin()` checks `User.role === 'SUPER_ADMIN'` (unchanged)
4. Client-side `userRole` is set from the real `User.role` via an API call (e.g., `GET /api/auth/me`)
5. `RbacGuard` and sidebar use the real role from the server

**Never** make Super Admin access depend only on a frontend role. The `requireSuperAdmin()` API guard is the security boundary.

---

## 7. Clerk Replacement Map

| Current Component | Classification | Clerk Replacement |
|-------------------|---------------|-------------------|
| `getDemoUser()` | **REPLACE WITH CLERK** | `clerkUsers()` from `@clerk/nextjs/server` → get Clerk user ID → look up CreatorOS `User` by `clerkId` |
| `requireSuperAdmin()` | **ADAPT** | Keep the function, but change `getDemoUser()` inside it to use Clerk auth. The `User.role === 'SUPER_ADMIN'` check stays the same. |
| `DEMO_WORKSPACE_ID = 'default'` | **ADAPT** | Replace with `user.activeWorkspaceId` from the User record (new field). During migration, keep 'default' as fallback. |
| `User.id` (cuid) | **KEEP** | CreatorOS keeps its own user IDs. Add a `clerkId` column to link Clerk users. |
| `User.email` | **ADAPT** | Sync from Clerk (read-only). Clerk is the source of truth for email. |
| `User.name` | **ADAPT** | Sync from Clerk (read-only). |
| `User.avatarUrl` | **ADAPT** | Sync from Clerk (read-only). |
| `User.role` | **KEEP** | CreatorOS-owned. Not synced from Clerk. |
| `User.credits` | **KEEP** | CreatorOS-owned. |
| `User.bio` | **KEEP** | CreatorOS-owned. |
| `User.password` | N/A | No password field exists. Clerk handles passwords. |
| `Session` model | N/A | No session model exists. Clerk handles sessions. |
| `Workspace` model | **KEEP** | CreatorOS-owned. |
| `WorkspaceMember` model | **KEEP** | CreatorOS-owned. |
| `WorkspaceMember.role` | **KEEP** | CreatorOS-owned. |
| `Invitation` model | **KEEP** | CreatorOS-owned. Clerk has its own invitation system for orgs, but CreatorOS workspace invitations are separate. |
| `AuditLog` model | **KEEP** | CreatorOS-owned. `actorId` will map to CreatorOS User ID (resolved from Clerk). |
| Client `useAppStore.userRole` | **ADAPT** | Set from `GET /api/auth/me` response (which uses Clerk auth). Remove hardcoded default. |
| `RbacGuard` component | **KEEP** | No change — still checks `userRole` from store. |
| `src/components/app/sidebar.tsx` `isPlatformOwner` | **KEEP** | No change. |
| `src/lib/nav.ts` `canAccessModule()` | **KEEP** | No change. |
| No login page | **REPLACE WITH CLERK** | Clerk `<SignIn />` component |
| No signup page | **REPLACE WITH CLERK** | Clerk `<SignUp />` component |
| No middleware | **REPLACE WITH CLERK** | `clerkMiddleware()` in `src/middleware.ts` |
| No session provider | **REPLACE WITH CLERK** | `<ClerkProvider>` in `src/app/layout.tsx` |
| `next-auth` dependency | **REMOVE LATER** | Uninstall after Clerk is verified working |

---

## 8. Data Migration Requirements

### New schema field needed (NOT in this phase)

```prisma
model User {
  // ... existing fields
  clerkId    String?  @unique   // ← NEW: links Clerk user to CreatorOS user
}
```

### Existing data to preserve

| Data | Count | Migration Action |
|------|-------|-----------------|
| Users | 5 | Link each to a Clerk user via `clerkId`. Users must sign up in Clerk with the same email. |
| Workspaces | 1 | No change. Workspace ID stays `cms33vjt00000q13wjsnmap9n`. |
| WorkspaceMembers | 5 | No change. `userId` still references CreatorOS User ID. |
| Invitations | 2 | No change. |
| AuditLogs | 11 | No change. `actorId` still references CreatorOS User ID. |
| Courses | existing | No change. |
| Products | existing | No change. |
| Orders | existing | No change. |
| CommunityPosts | existing | No change. `userId` references CreatorOS User ID. |
| AiGenerations | 52 | No change. `userId` references CreatorOS User ID. |
| AiAssets | existing | No change. |
| CreditTransactions | existing | No change. `userId` references CreatorOS User ID. |

### User linking strategy

1. Add `clerkId` column to User table (nullable initially)
2. Deploy Clerk (login/signup pages)
3. When a user signs up in Clerk, check if a User with their email exists
   - If yes → set `clerkId` on the existing User row
   - If no → create a new User row with `clerkId`, `email`, `name` from Clerk
4. Once all users are linked, make `clerkId` required

### ID preservation

**CreatorOS User IDs must NOT change.** All foreign keys (WorkspaceMember.userId, AiGeneration.userId, CommunityPost.userId, etc.) reference the CreatorOS User ID. Clerk provides a separate `clerkId` that is stored alongside but does not replace the CreatorOS ID.

---

## 9. Risks

### Critical risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **User ID changes** | All FK relationships break (courses, posts, orders, credits, AI generations) | Never change CreatorOS User IDs. Add `clerkId` as a separate column. |
| **Orphaned workspace memberships** | Users can't access their workspaces | Link Clerk users to existing User rows by email before enabling Clerk auth. |
| **Broken foreign keys** | Data integrity failure | Use nullable `clerkId` during migration. Don't make it required until all users are linked. |
| **Session invalidation** | All current "sessions" (none) are lost | No impact — there are no sessions to invalidate. |
| **Super Admin access risks** | Unauthorized admin access | Keep `requireSuperAdmin()` checking `User.role`. Never trust client-side role. Set `User.role = 'SUPER_ADMIN'` manually for admins after Clerk migration. |
| **API authorization regressions** | Routes that currently have no auth become accessible | Add Clerk auth to ALL routes during migration — especially the 62 routes with zero auth. |

### Medium risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Password migration** | Users can't log in | No passwords exist. Users must sign up fresh in Clerk with the same email. |
| **Workspace isolation** | Users see other users' data | Replace `DEMO_WORKSPACE_ID` with real `activeWorkspaceId` from User record. This is a bigger change that can be deferred. |
| **Invitation problems** | Pending invitations become invalid | Invitation tokens are CreatorOS-owned and don't depend on auth. They'll still work if the invited email matches a Clerk user. |
| **Existing login dependencies** | Code that assumes `getDemoUser()` | 12 creator routes + 31 admin routes call `getDemoUser()`. All need to switch to Clerk auth. |

### Low risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **next-auth removal** | Unused dependency | Safe to uninstall — it's not imported anywhere. |
| **Client-side userRole** | UI shows wrong role | Replace hardcoded `'SUPER_ADMIN'` with real role from `/api/auth/me`. |

---

## 10. Recommended Migration Sequence

### Phase A — Prepare schema (no Clerk yet)
1. Add `clerkId String? @unique` to User model
2. Add `activeWorkspaceId String?` to User model (for future workspace switching)
3. Run `db:push` — no data loss (nullable fields)
4. No code changes to auth logic yet

### Phase B — Install Clerk + create auth pages
1. `bun add @clerk/nextjs`
2. Add Clerk env vars to `.env`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
3. Create `src/middleware.ts` with `clerkMiddleware()`
4. Wrap `src/app/layout.tsx` with `<ClerkProvider>`
5. Create `src/app/sign-in/[[...sign-in]]/page.tsx` with `<SignIn />`
6. Create `src/app/sign-up/[[...sign-up]]/page.tsx` with `<SignUp />`
7. **Keep `getDemoUser()` working alongside Clerk** — don't break existing auth yet

### Phase C — Create Clerk-to-CreatorOS user sync
1. Create `src/lib/auth.ts` with `getCurrentUser()`:
   - Get Clerk user via `auth()`
   - Look up CreatorOS User by `clerkId`
   - If not found, look up by `email` (and set `clerkId`)
   - If still not found, create new User from Clerk data
2. Create `GET /api/auth/me` endpoint that returns `{ id, email, name, role, credits, activeWorkspaceId }`
3. Update `useAppStore` to fetch `userRole` from `/api/auth/me` on mount (remove hardcoded `'SUPER_ADMIN'`)

### Phase D — Migrate API routes
1. Replace `getDemoUser()` with `getCurrentUser()` (from `src/lib/auth.ts`) in:
   - 12 creator AI routes
   - `requireSuperAdmin()` in `src/lib/creator-ai.ts` (this propagates to all 31 admin routes)
2. Add Clerk auth to the 62 routes that currently have NO auth:
   - 10 AI routes
   - 17 data routes
   - 32 community routes
   - 3 support routes
3. Replace `DEMO_WORKSPACE_ID` with `user.activeWorkspaceId || 'default'` in routes

### Phase E — Remove old auth code
1. Remove `getDemoUser()` function (replaced by `getCurrentUser()`)
2. Uninstall `next-auth`
3. Remove hardcoded `userRole: 'SUPER_ADMIN'` from app-store
4. Clean up any remaining `DEMO_WORKSPACE_ID` references

### Phase F — Workspace switching (future)
1. Add workspace switcher UI
2. Implement `activeWorkspaceId` in User record
3. Add workspace membership validation to all data queries

---

## 11. Files That Will Need Modification

### Must modify for Clerk migration

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `clerkId` and `activeWorkspaceId` to User model |
| `src/middleware.ts` | **NEW FILE** — `clerkMiddleware()` |
| `src/app/layout.tsx` | Wrap with `<ClerkProvider>` |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | **NEW FILE** — `<SignIn />` |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | **NEW FILE** — `<SignUp />` |
| `src/lib/auth.ts` | **NEW FILE** — `getCurrentUser()` using Clerk |
| `src/lib/creator-ai.ts` | Update `getDemoUser()` → `getCurrentUser()`, update `requireSuperAdmin()` |
| `src/store/app-store.ts` | Remove hardcoded `userRole: 'SUPER_ADMIN'`, fetch from `/api/auth/me` |
| `src/app/api/auth/me/route.ts` | **NEW FILE** — returns current user info |
| `.env` | Add Clerk env vars |
| `package.json` | Add `@clerk/nextjs` |

### Must modify to add auth to unprotected routes (62 routes)

| Route Category | Count | Action |
|----------------|-------|--------|
| `/api/ai/assets/*` | 3 | Add Clerk auth + ownership check |
| `/api/ai/brand-profile` | 1 | Add Clerk auth |
| `/api/ai/features` | 1 | Add Clerk auth (or make public) |
| `/api/ai/generations` | 1 | Add Clerk auth + ownership check |
| `/api/ai/images/[id]` | 1 | Add Clerk auth + ownership check |
| `/api/ai/projects/[id]` | 1 | Add Clerk auth + ownership check |
| `/api/ai/publish-course` | 1 | Add Clerk auth + ownership check |
| `/api/ai/videos/[id]` | 1 | Add Clerk auth + ownership check |
| `/api/data/*` | 17 | Add Clerk auth + workspace filter |
| `/api/community/*` | 32 | Add Clerk auth + workspace filter |
| `/api/support/*` | 3 | Add Clerk auth |

### Existing files that adapt (not replaced)

| File | Change |
|------|--------|
| `src/components/app/rbac-guard.tsx` | No code change — still reads `userRole` from store |
| `src/components/app/sidebar.tsx` | No code change — still checks `isPlatformOwner` |
| `src/lib/nav.ts` | No code change — `canAccessModule()` unchanged |
| `src/app/page.tsx` | Add redirect to `/sign-in` if not authenticated |

---

## 12. Files That Must NOT Be Modified Initially

| File | Reason |
|------|--------|
| `src/lib/n8n/*` | n8n integration is separate from auth. Keep as-is. |
| `src/lib/ai-engine/*` | AI engine logic is auth-agnostic. It receives `userId` and `workspaceId` as params. |
| `prisma/schema.prisma` (existing models) | Don't change existing model definitions. Only ADD new fields. |
| `src/components/modules/*` | UI modules don't need changes — they call APIs that handle auth. |
| `src/components/app/sidebar.tsx` | Works as-is with `userRole` from store. |
| `src/components/app/rbac-guard.tsx` | Works as-is. |
| `src/components/app/topbar.tsx` | Works as-is. |
| `src/components/app/command-palette.tsx` | Works as-is. |
| `src/lib/nav.ts` | Works as-is. |

---

## 13. Estimated Migration Phases

| Phase | Description | Effort | Risk |
|-------|-------------|--------|------|
| **A** | Add `clerkId` + `activeWorkspaceId` to schema | 1 hour | Low — nullable fields, no data loss |
| **B** | Install Clerk + auth pages + middleware | 2-3 hours | Low — additive, doesn't break existing |
| **C** | Create user sync + `/api/auth/me` + update app store | 3-4 hours | Medium — user linking logic |
| **D** | Migrate all API routes to Clerk auth | 4-6 hours | High — 74 routes to update, must test each |
| **E** | Remove old auth code + uninstall next-auth | 1 hour | Low — cleanup |
| **F** | Workspace switching (future) | 4-6 hours | Medium — affects all data queries |

**Total estimated effort for Phases A-E:** 11-15 hours

---

## 14. Duplicate/Unused Auth Systems

| System | Status |
|--------|--------|
| `next-auth` package | Installed but **completely unused** — no imports, no config, no session calls. Safe to uninstall. |
| Client-side `userRole` | Hardcoded `'SUPER_ADMIN'` — not a real auth system, just a UX hint. |
| `DEMO_WORKSPACE_ID` | Hardcoded `'default'` — not an auth system, just a constant. 57 usages across the codebase. |

---

## Summary

CreatorOS has **no real authentication**. The current "auth" is:
1. `getDemoUser()` → returns the first user from the DB (no login required)
2. `requireSuperAdmin()` → checks `User.role === 'SUPER_ADMIN'` (the only real security boundary)
3. Client-side `userRole: 'SUPER_ADMIN'` hardcoded in Zustand store (UX hint only)

**62 API routes have zero authentication** — this is the biggest security gap. Clerk migration must add auth to ALL of these.

**The migration is straightforward** because there's no existing auth to untangle. Clerk becomes the sole auth provider, CreatorOS keeps its own User IDs and adds a `clerkId` column to link them. The `requireSuperAdmin()` pattern stays unchanged — it just gets the user from Clerk instead of `getDemoUser()`.

**Key constraint:** Never change CreatorOS User IDs. All foreign keys depend on them. Clerk's `clerkId` is stored alongside, not as a replacement.
