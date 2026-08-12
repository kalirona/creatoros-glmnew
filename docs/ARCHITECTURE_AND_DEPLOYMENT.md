# CreatorOS — Architecture & Deployment Guide

**Version:** 2026-08-12
**Status:** Production-ready with caveats (see below)

---

## Table of Contents

1. [Database Architecture](#1-database-architecture)
2. [Authentication Architecture](#2-authentication-architecture)
3. [AI Engine Architecture](#3-ai-engine-architecture)
4. [n8n Integration](#4-n8n-integration)
5. [Security Architecture](#5-security-architecture)
6. [Development vs Production](#6-development-vs-production)
7. [Docker Deployment](#7-docker-deployment)
8. [Environment Variables Reference](#8-environment-variables-reference)
9. [Production Checklist](#9-production-checklist)
10. [Known Limitations](#10-known-limitations)

---

## 1. Database Architecture

### Technology

- **ORM:** Prisma 6.x (`@prisma/client`)
- **Database:** SQLite (development) / PostgreSQL (recommended for production)
- **Schema file:** `prisma/schema.prisma`
- **Client file:** `src/lib/db.ts`

### How Data Is Stored

**Development (SQLite):**
```
DATABASE_URL=file:/home/z/my-project/db/custom.db
```
- Single file at `db/custom.db`
- No separate database server
- Data is lost if the file is deleted

**Production (Docker):**
```
DATABASE_URL=file:/app/db/custom.db
```
- SQLite file stored in a Docker volume (`creatoros-db:/app/db`)
- Volume persists across container restarts
- **For scaling:** Switch to PostgreSQL (see below)

### Database Initialization

The Docker entrypoint (`docker-entrypoint.sh`) runs on every container start:

```bash
npx prisma db push --accept-data-loss
```

This creates all tables if they don't exist. On subsequent starts, it's a no-op (idempotent). The Prisma CLI is available at runtime because the Docker image includes the full `node_modules`.

### Switching to PostgreSQL (Recommended for Production)

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Set the environment variable:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/creatoros?schema=public
   ```

3. Run `prisma db push` to create tables in PostgreSQL

4. Migrate existing SQLite data using `prisma db pull` + `prisma db push` or a custom script

### Schema Overview

The database has 60+ models organized into:

| Category | Key Models |
|----------|-----------|
| **Users & Workspaces** | User, Workspace, WorkspaceMember, Invitation |
| **Courses** | Course, Section, Lesson, Enrollment |
| **Products** | Product, Order, Customer, MembershipPlan |
| **Community** | CommunityPost, CommunityComment, CommunitySpace, CommunityEvent |
| **Website** | WebPage, PageSection, Funnel, BlogPost |
| **AI** | AiProvider, AiModel, ApprovedModel, AiRoute, AiTool, AiGeneration, AiJob, AiAsset, AiLog, AiCost |
| **System** | AdminSetting, FeatureFlag, AuditLog, SiteSetting |

### Prisma binaryTargets

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x", "debian-openssl-1.1.x"]
}
```

This ensures the Prisma query engine works in both:
- `oven/bun:1.3` (OpenSSL 1.1.x — build stage)
- `node:20-slim` (OpenSSL 3.0.x — runtime stage)

---

## 2. Authentication Architecture

### Current State: Dual Auth System

CreatorOS currently has **two authentication systems** running in parallel:

#### System A: Demo Auth (Active — used by all API routes)

```
getDemoUser() → db.user.findFirst({ orderBy: { createdAt: 'asc' } })
```

- Returns the **first user** in the database
- No login required
- No session management
- Used by ALL existing API routes (`/api/ai/*`, `/api/admin/*`, `/api/data/*`)

**File:** `src/lib/creator-ai.ts`

```typescript
export async function getDemoUser() {
  return db.user.findFirst({ orderBy: { createdAt: 'asc' } })
}
```

#### System B: Clerk Auth (Foundation — not yet enforcing)

- Clerk is installed and configured
- `/sign-in` and `/sign-up` pages render
- `getCurrentUser()` in `src/lib/auth.ts` resolves Clerk users to CreatorOS users
- `/api/auth/me` endpoint exists
- **NOT yet wired into existing API routes** (that's Phase D)

**Files:**
- `src/lib/auth.ts` — Clerk → CreatorOS identity bridge
- `src/proxy.ts` — Clerk middleware (passthrough, not enforcing)
- `src/app/layout.tsx` — ClerkProvider wrapper
- `src/app/sign-in/[[...sign-in]]/page.tsx` — Clerk SignIn
- `src/app/sign-up/[[...sign-up]]/page.tsx` — Clerk SignUp

### Super Admin Authorization

```
requireSuperAdmin()
  → getDemoUser()
  → if user.role !== 'SUPER_ADMIN' → return 403
```

- **File:** `src/lib/creator-ai.ts`
- All 31 admin API routes call `requireSuperAdmin()` at the top of every handler
- Returns 403 for non-super-admin users
- The client-side `userRole` in Zustand store is a **UX hint only** — not a security boundary

### User Linking (Phase C — implemented but not active)

When Clerk is fully enabled (Phase D+), the linking flow is:

```
Clerk user signs in
  → getCurrentUser()
  → look up User by clerkId
    → found: return existing User (Case A)
    → not found: look up by email
      → found: link clerkId (Case B)
      → not found: create new User (Case C)
```

**Key invariant:** CreatorOS `User.id` is NEVER replaced by Clerk's userId. Clerk's ID is stored only in `User.clerkId`.

### RBAC (Role-Based Access Control)

Two-tier role system:

| Level | Field | Values | Where |
|-------|-------|--------|-------|
| Global | `User.role` | `SUPER_ADMIN`, `MEMBER` | User table |
| Workspace | `WorkspaceMember.role` | `OWNER`, `ADMIN`, `MANAGER`, `INSTRUCTOR`, `MODERATOR`, `MEMBER`, `STUDENT`, `AFFILIATE`, `GUEST` | WorkspaceMember table |

**Files:**
- `src/lib/nav.ts` — `canAccessModule()`, `PLATFORM_MODULES`
- `src/components/app/rbac-guard.tsx` — Client-side guard (UX only)
- `src/lib/creator-ai.ts` — `requireSuperAdmin()` (real security)

### What to Focus On for Production

1. **Complete Clerk migration (Phase D)** — replace `getDemoUser()` with `getCurrentUser()` in all API routes
2. **Set `User.role = 'SUPER_ADMIN'`** for at least one user after Clerk migration
3. **Remove `next-auth`** package (unused, will be done in Phase E)
4. **Remove hardcoded `userRole: 'SUPER_ADMIN'`** from `src/store/app-store.ts`
5. **Set real Clerk keys** in environment variables

---

## 3. AI Engine Architecture

### Overview

```
Creator (UI)
  ↓
API Route (/api/ai/chat, /api/ai/images, /api/ai/videos)
  ↓
getDemoUser() → resolve user
  ↓
generateText() / generateImage() / generateVideo()
  ↓
resolveRoute() → pick provider + model from ApprovedModel table
  ↓
checkRateLimit() + checkCredits()
  ↓
Adapter (ZaiAdapter or N8nAdapter)
  ↓
Provider API (z.ai SDK or n8n → OpenRouter)
  ↓
Save AiGeneration + deductCredits + trackUsage + writeLog
  ↓
Return creator-safe response
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/ai-engine/engine.ts` | `generateText()`, `generateImage()`, `generateVideo()` |
| `src/lib/ai-engine/providers.ts` | `ZaiAdapter`, `N8nAdapter`, `StubAdapter` |
| `src/lib/ai-engine/router.ts` | `resolveRoute()` — picks provider + model |
| `src/lib/ai-engine/cost.ts` | `checkCredits()`, `deductCredits()`, `checkRateLimit()`, `writeLog()` |
| `src/lib/ai-engine/types.ts` | Types, `ASPECT_RATIOS`, `IMAGE_STYLES` |
| `src/lib/creator-ai.ts` | `getDemoUser()`, `requireSuperAdmin()`, `mapEngineError()` |

### AI Providers

| Provider | Status | Uses |
|----------|--------|------|
| **z.ai (ZAI)** | ✅ Active | Text + Image generation via `z-ai-web-dev-sdk` |
| **GLM** | ✅ Active | Aliased to z.ai adapter |
| **OpenRouter** | ⚠️ Stub (throws) | Will use N8nAdapter when n8n is enabled |
| **Fal AI** | ⚠️ Stub (throws) | Image/Video (not implemented) |
| **Others** | ❌ Inactive | Not configured |

### Credit System

- Each AI tool has a `creditCost` (e.g., AI_CHAT=2, IMAGE_GEN=3, VIDEO_GEN=15)
- `User.credits` is decremented atomically after successful generation
- `CreditTransaction` records every deduction
- Credits are checked BEFORE generation — insufficient credits → 402 error

### Rate Limiting

- Per-user, per-route-category, per-minute
- Video has additional concurrent-job check (1 video at a time) + 60s cooldown
- Stored in `AiRateLimit` table

---

## 4. n8n Integration

### Current State: Phase 2.3 (Text generation wired, not yet tested with real n8n)

```
CreatorOS → N8nAdapter → n8n webhook → OpenRouter → response → CreatorOS
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/n8n/client.ts` | `N8nClient` — HMAC-signed HTTP calls to n8n |
| `src/lib/n8n/types.ts` | Request/response contracts, `N8nError` |
| `src/lib/n8n/schemas.ts` | Zod validation schemas |
| `src/lib/n8n/workflows.ts` | Workflow registry (HEALTH_TEST, TEXT_GENERATION) |
| `src/lib/n8n/feature-flag.ts` | `isN8nEnabledAsync()` — env + DB flag |
| `src/lib/n8n/health.ts` | `checkN8nHealth()` |
| `src/lib/n8n/logging.ts` | AuditLog integration |
| `src/lib/ai-engine/providers.ts` | `N8nAdapter` class |

### Feature Flag

n8n is enabled only if BOTH are true:
1. `N8N_AI_ENABLED=true` (env var)
2. `n8n_ai_enabled` FeatureFlag DB row = `true`

**Default: OFF** — existing AI engine works without n8n.

### Model Verification

The N8nAdapter enforces **explicit model verification**:
- Sends `{ provider: "openrouter", model: "exact-model-id" }` to n8n
- n8n must return `{ data: { model: "same-model-id" } }`
- If models don't match → `MODEL_MISMATCH` error (no silent fallback)

---

## 5. Security Architecture

### API Route Protection

| Route Category | Auth Check | Method |
|---------------|-----------|--------|
| `/api/admin/*` (31 routes) | ✅ Super Admin only | `requireSuperAdmin()` → 403 if not SUPER_ADMIN |
| `/api/ai/chat` | ✅ User resolution | `getDemoUser()` (will be `getCurrentUser()` in Phase D) |
| `/api/ai/images` | ✅ User resolution | `getDemoUser()` |
| `/api/ai/videos` | ✅ User + concurrent check | `getDemoUser()` + 409 if job in progress |
| `/api/ai/features` | ❌ None | Public (returns feature flags) |
| `/api/ai/assets/*` | ❌ None | **Security gap — fix in Phase D** |
| `/api/data/*` (17 routes) | ❌ None | **Security gap — fix in Phase D** |
| `/api/community/*` (32 routes) | ❌ None | **Security gap — fix in Phase D** |
| `/api/support/*` (3 routes) | ❌ None | **Security gap — fix in Phase D** |
| `/api/auth/me` | ✅ Clerk auth | `getCurrentUser()` → 401 if not authenticated |
| `/api/n8n/health` | ✅ Super Admin | `getDemoUser()` + role check |

### Security Gaps to Fix Before Production

1. **62 API routes have no authentication** — anyone can access creator data
2. **Client-side `userRole` is hardcoded** to `'SUPER_ADMIN'` in Zustand store
3. **No middleware-level route protection** — Clerk middleware is passthrough only
4. **`getDemoUser()` returns the first user** — no real authentication

### What's Secure

- Admin routes (31) properly reject non-super-admins with 403
- API keys are stored in DB, masked in UI (`maskApiKey()`)
- No secrets in environment variables are exposed to the browser
- `.env*` is gitignored
- HMAC signatures on n8n requests
- Prisma parameterized queries (no SQL injection)
- Input validation on all AI routes (prompt length, aspect ratios, etc.)

---

## 6. Development vs Production

### Key Differences

| Aspect | Development | Production |
|--------|------------|------------|
| **Database** | SQLite at `db/custom.db` | SQLite in Docker volume (or PostgreSQL) |
| **Auth** | `getDemoUser()` (no login) | Clerk (Phase D) + `getCurrentUser()` |
| **Prisma logging** | `['query']` (all queries logged) | `[]` (disabled for performance) |
| **Build** | `next dev` (Turbopack, hot reload) | `next build --webpack` + `next start` |
| **Port** | 3000 | 3012 (configurable) |
| **Clerk** | Empty env vars (development mode) | Real Clerk keys required |
| **n8n** | Disabled | Optional (set `N8N_AI_ENABLED=true`) |
| **HTTPS** | None (localhost) | Via Dokploy/Traefik reverse proxy |
| **Process manager** | `bun run dev` | Docker (restart: unless-stopped) |

### Development Setup

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Database
bun run db:push    # create/update tables
bun run db:generate # regenerate Prisma client

# Lint
bun run lint
```

### Production Setup (Docker)

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f creatoros

# Rebuild after code changes
docker-compose up -d --build
```

---

## 7. Docker Deployment

### Dockerfile Architecture

```
Stage 1: oven/bun:1.3     → bun install (fast, correct lockfile format)
Stage 2: node:20-slim     → prisma generate + next build --webpack
Stage 3: node:20-slim     → Full runtime (node_modules + .next + prisma)
```

### docker-compose.yml

- **Port:** 3012 (configurable)
- **Volume:** `creatoros-db:/app/db` (persistent SQLite)
- **Health check:** `wget http://localhost:3012/api/ai/features`
- **Restart:** `unless-stopped`

### docker-entrypoint.sh

Runs on every container start:
1. `npx prisma db push` — creates tables if missing
2. `npx next start --port 3012` — starts the production server

### Dokploy-Specific Notes

1. **Compose file:** Dokploy looks for `docker-compose.yml`, `compose.yml`, or `docker-compose.yaml` — all three are in the repo
2. **Port:** Set Dokploy to proxy to port 3012
3. **Environment variables:** Set in Dokploy's service settings (see below)
4. **Volume:** The `creatoros-db` volume persists SQLite data across deploys

---

## 8. Environment Variables Reference

### Required

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:/app/db/custom.db` | SQLite path or PostgreSQL URL |
| `NODE_ENV` | `production` | Node environment |
| `PORT` | `3012` | Server port |

### Clerk Authentication (Required for login)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key (safe for browser) |
| `CLERK_SECRET_KEY` | Clerk secret key (server-only) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Default: `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Default: `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Default: `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Default: `/` |

### n8n Integration (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_BASE_URL` | (empty) | n8n instance URL |
| `N8N_API_KEY` | (empty) | n8n API key |
| `N8N_WEBHOOK_SECRET` | (empty) | HMAC signing secret |
| `N8N_TIMEOUT_MS` | `30000` | Request timeout |
| `N8N_AI_ENABLED` | `false` | Master switch |

---

## 9. Production Checklist

### Before Going Live

- [ ] **Set real Clerk keys** in environment variables
- [ ] **Complete Phase D** — migrate all API routes from `getDemoUser()` to `getCurrentUser()`
- [ ] **Add auth to 62 unprotected routes** (`/api/data/*`, `/api/community/*`, `/api/support/*`, `/api/ai/assets/*`)
- [ ] **Set at least one user's role to `SUPER_ADMIN`** in the database
- [ ] **Remove hardcoded `userRole: 'SUPER_ADMIN'`** from `src/store/app-store.ts`
- [ ] **Switch to PostgreSQL** if expecting >100 concurrent users
- [ ] **Configure HTTPS** via Dokploy/Traefik
- [ ] **Set up backups** for the SQLite volume (or PostgreSQL database)
- [ ] **Remove `next-auth`** package (unused)
- [ ] **Test Clerk sign-in/sign-up** end-to-end
- [ ] **Test credit deduction** works correctly
- [ ] **Test rate limiting** works correctly
- [ ] **Monitor AiLog table** for errors

### Docker-Specific

- [ ] **Persistent volume** is mounted (`creatoros-db:/app/db`)
- [ ] **Port 3012** is not conflicting with other services
- [ ] **Health check** passes (`/api/ai/features` returns 200)
- [ ] **Container restarts** on failure (`restart: unless-stopped`)
- [ ] **Environment variables** are set in Dokploy

---

## 10. Known Limitations

### Database

- **SQLite** — works for small-scale deployments but has write concurrency limitations
- **No automated migrations** — `prisma db push` is used (fine for now, but `prisma migrate` is better for production schema evolution)
- **No database backups** — the Docker volume is the only copy of data

### Authentication

- **Demo auth is active** — `getDemoUser()` returns the first user; no real login required
- **62 API routes have no auth** — data is accessible without authentication
- **Client-side role is hardcoded** — `userRole: 'SUPER_ADMIN'` in Zustand store

### AI Engine

- **Only z.ai provider works** — OpenRouter/Fal AI are stubs that throw
- **Video generation rate-limited** — z.ai allows ~1 concurrent video job
- **Image sizes** — z.ai API rejects `1440x720` and `720x1440` (720 is not a multiple of 32)

### n8n Integration

- **Not yet tested with real n8n** — the workflow JSON exists but hasn't been deployed
- **Feature flag defaults to OFF** — existing AI engine is unaffected

### Docker

- **Full build (not standalone)** — larger image (~500MB) but reliable DB init
- **No health check for DB** — only checks if the HTTP server responds

---

## Migration Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| A | ✅ Complete | Add `clerkId` + `activeWorkspaceId` to User schema |
| B | ✅ Complete | Install Clerk, create middleware + sign-in/sign-up pages |
| C | ✅ Complete | Create `getCurrentUser()` identity bridge + `/api/auth/me` |
| D | ⏳ Pending | Migrate all API routes from `getDemoUser()` to `getCurrentUser()` |
| E | ⏳ Pending | Remove old auth code, uninstall `next-auth` |
| F | ⏳ Pending | Workspace switching (use `activeWorkspaceId`) |

---

## Quick Reference

### File Locations

```
src/lib/db.ts              → Prisma client (production-safe logging)
src/lib/auth.ts            → Clerk identity bridge (getCurrentUser)
src/lib/creator-ai.ts      → Demo auth (getDemoUser, requireSuperAdmin)
src/lib/ai-engine/         → AI engine (routing, adapters, credits)
src/lib/n8n/               → n8n integration (client, workflows, health)
src/lib/nav.ts             → Navigation + RBAC (canAccessModule)
src/proxy.ts               → Clerk middleware (passthrough)
src/app/layout.tsx         → Root layout (ClerkProvider)
src/app/sign-in/           → Clerk sign-in page
src/app/sign-up/           → Clerk sign-up page
src/app/api/auth/me/       → Current user endpoint
prisma/schema.prisma       → Database schema (60+ models)
Dockerfile                 → Multi-stage build (bun → node → node:slim)
docker-compose.yml         → Dokploy service definition
docker-entrypoint.sh       → DB init + server start
```

### Commands

```bash
# Development
bun run dev          # Start dev server (port 3000)
bun run lint         # ESLint
bun run db:push      # Create/update DB tables
bun run db:generate  # Regenerate Prisma client

# Production (Docker)
docker-compose up -d           # Start
docker-compose logs -f         # View logs
docker-compose up -d --build   # Rebuild
docker-compose down            # Stop
```
