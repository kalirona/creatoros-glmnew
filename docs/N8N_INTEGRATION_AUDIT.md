# N8N Integration Audit — CreatorOS AI Architecture

**Date:** 2026-08-07
**Phase:** 1 (Foundation — no changes to existing AI flow)
**Status:** Read-only audit, no code modified

---

## 1. Current AI Architecture

### Core modules

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/ai-engine/types.ts` | Shared types, ASPECT_RATIOS, IMAGE_STYLES, RouteCategory, route/tool maps | ~183 |
| `src/lib/ai-engine/router.ts` | `resolveRoute(category)` — picks provider + model from ApprovedModel table | — |
| `src/lib/ai-engine/providers.ts` | `ProviderAdapter` interface, `ZaiAdapter` (z.ai SDK), `StubAdapter` (throws), registry | ~298 |
| `src/lib/ai-engine/engine.ts` | `generateText()`, `generateImage()`, `generateVideo()`, `nudgeVideoJob()` — orchestrates routing + credits + logging | ~816 |
| `src/lib/ai-engine/cost.ts` | `checkCredits`, `deductCredits`, `trackUsage`, `trackCost`, `writeLog`, `checkRateLimit`, `estimateCost` | — |
| `src/lib/ai-engine/index.ts` | Barrel exports | ~16 |
| `src/lib/creator-ai.ts` | `getDemoUser()`, `DEMO_WORKSPACE_ID`, `mapEngineError()`, `safeJsonParse()`, `serializeCreatorAsset()`, pagination helpers | ~196 |

### Database tables involved in AI

```
AiProvider          — 12 providers (z.ai, glm, openrouter, fal-ai, openai, elevenlabs, deepgram, anthropic, gemini, deepseek, replicate, together, runpod, custom)
AiModel             — provider catalog (synced from provider APIs)
ApprovedModel       — admin-curated models creators can use (modality, isDefault, isEnabled, workspaceVisible, priority, creditsMultiplier, capability flags, cost fields)
AiProviderKey       — encrypted API key storage per provider
AiRoute             — 14 route categories (WRITING, MARKETING, COURSE, WEBSITE, SEO, EMAIL, BLOG, CRM, AUTOMATION, IMAGE, VIDEO, VOICE, STT, EMBEDDING) → provider + fallback + strategy
AiTool              — per-tool credit costs (IMAGE_GEN, VIDEO_GEN, AI_CHAT, etc.)
AiRateLimit         — per-user-per-minute-per-category limits
AiProviderHealth    — provider health status (isHealthy, lastChecked)
AiProviderSyncHistory — model sync audit trail
AiJob               — async jobs (VIDEO_GEN) with status, progress, resultUrl, resultMeta
AiAsset             — generated assets (images, videos) saved to media library
AiGeneration        — text generation records
AiUsage             — usage tracking per user/workspace/tool
AiLog               — detailed request logs (provider, model, status, duration, tokens, cost)
AiCost              — daily cost aggregation per provider
AiStorage           — storage usage tracking
AiWebhook           — incoming webhook tracking (for provider callbacks)
AiBrandProfile      — brand voice/profile for AI generation
AiProject           — AI project grouping
```

---

## 2. Existing AI Request Flow

```
Creator clicks "Generate" in AI Studio UI
  ↓
POST /api/ai/{chat|images|videos|generate}  (Next.js API route)
  ↓
getDemoUser()  →  resolves User from DB (first user by createdAt)
  ↓
[Image/Video only] Validate prompt length, style, aspect ratio, preset, duration, resolution
  ↓
[Video only] Concurrent-job check (409 if job in progress) + 60s cooldown check (429)
  ↓
generateText() / generateImage() / generateVideo()  (engine.ts)
  ↓
resolveRoute(routeCategory)  →  ApprovedModel + AiRoute lookup
  ↓
checkRateLimit(workspaceId, userId, routeCategory)
  ↓
checkCredits(userId, creditCost)
  ↓
getAdapter(providerSlug).generateText/Image/submitVideoJob()
  ↓
[Video] Background promise: simulateJobProgress() → poll provider → save asset
[Image] Synchronous: adapter returns base64 → save asset
[Text] Synchronous: adapter returns text → save generation record
  ↓
deductCredits() + trackUsage() + trackCost() + writeLog()
  ↓
Return creator-safe response (strips providerSlug, modelId, costUsd)
```

---

## 3. Existing Provider Flow

### Routing

`resolveRoute(category)` in `router.ts`:
1. Queries `AiRoute` table for the category
2. Resolves `providerId` + `fallbackProviderId`
3. Returns `{ providerId, providerSlug, providerName, modelId, modelName, strategy }`

### Adapter selection

`getAdapter(slug)` in `providers.ts`:
- Returns the adapter for the slug from a static registry
- All non-z.ai adapters are `StubAdapter` subclasses that throw (no real API keys)
- z.ai aliases: `anthropic`, `gemini`, `deepseek`, `glm`, `replicate`, `together`, `runpod`, `custom` → all use `ZaiAdapter`

### Failover

- **Text/Image:** Primary adapter fails → no automatic failover in `generateText()`/`generateImage()` (throws to caller). Image route has its own failover loop trying other approved IMAGE providers.
- **Video:** Primary adapter fails (Fal AI stub throws) → falls back to `zaiAdapter` with retry logic (30s/90s/180s with jitter for 429s).

### Credentials

- API keys stored in `AiProviderKey` table (encrypted with `maskApiKey()` for display)
- `ZaiAdapter` uses `z-ai-web-dev-sdk` which reads from environment (`ZAI_API_KEY` etc.)
- Stub adapters throw — they have no keys

---

## 4. Existing Credit Flow

1. `AiTool.creditCost` defines cost per tool (IMAGE_GEN=3, VIDEO_GEN=15, etc.)
2. `checkCredits(userId, cost)` → verifies `User.credits >= cost`
3. `deductCredits(userId, cost, reason)` → atomic decrement + `CreditTransaction` record
4. Credits returned in API response as `remainingCredits` + `creditsUsed`
5. Frontend updates `onCreditsUpdate(remainingCredits)` callback

---

## 5. Existing Job Flow (Video only)

```
POST /api/ai/videos
  ↓
generateVideo() creates AiJob (status=QUEUED, creditsUsed, costUsd)
  ↓
deductCredits() + trackUsage() + trackCost() + writeLog()
  ↓
simulateJobProgress(jobId) launched as background promise
  ↓
[Background] Mark RENDERING → submitVideoJob() to z.ai → get taskId
  ↓
[Background] Store taskId in resultMeta
  ↓
[Background] Poll every 5s for 10 min max
  ↓
[Background] On SUCCESS: update job COMPLETED + create AiAsset
[Background] On FAIL: update job FAILED + errorMessage
  ↓
Frontend polls GET /api/ai/videos/:id every 2s
  ↓
GET handler calls nudgeVideoJob() — self-healing: if background promise died,
the GET handler polls the provider once and finalizes the job
```

---

## 6. Existing Asset Flow

```
[Image] adapter returns base64 → data:image/png;base64 URL
[Video] provider returns remote URL (https://aigc-files.bigmodel.cn/...)
  ↓
AiAsset.create({
  workspaceId, userId, generationId, type (IMAGE|VIDEO),
  folder (AI Images | AI Videos | ...), name, description, url,
  thumbnailUrl, mimeType, width, height, duration, prompt, tags
})
  ↓
GET /api/ai/assets?folder=AI%20Images  →  list assets
GET /api/ai/assets?type=VIDEO  →  list videos
  ↓
AI Studio Media Library / Images tab / Videos tab renders assets
```

---

## 7. Existing Security Controls

### Authentication

- **Current:** `getDemoUser()` returns the first user from the DB — NO real auth in the sandbox
- **Production:** The app has `UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'INSTRUCTOR' | 'MEMBER' | 'CUSTOMER'` and `WorkspaceMember.role` for workspace-level RBAC
- `canAccessModule(moduleId, role)` in `src/lib/nav.ts` gates platform modules (AI Settings, System Settings, Admin) to `SUPER_ADMIN` only
- **Gap:** API routes do NOT currently check auth — they all call `getDemoUser()`. This is a known demo limitation (documented in previous security audit).

### Workspace isolation

- `DEMO_WORKSPACE_ID = 'default'` — all data is in a single workspace
- Queries filter by `workspaceId: DEMO_WORKSPACE_ID`
- **Gap:** No multi-workspace enforcement in the sandbox

### Input validation

- Prompt length capped (image: ≤2000 chars, video: ≤1000 chars, chat: ≤50 messages / ≤20000 chars)
- Enum validation for styles, aspect ratios, presets, durations, resolutions
- `pageSize` capped at 100 on list endpoints
- No SQL injection risk (Prisma parameterized queries)
- No `dangerouslySetInnerHTML` with user input

### Rate limiting

- `checkRateLimit(workspaceId, userId, routeCategory)` in `cost.ts`
- Per-user-per-minute-per-category
- Video has additional concurrent-job check (409) + 60s cooldown (429)

### Credential security

- `.env` is gitignored (`.env*` pattern)
- No `NEXT_PUBLIC_` env vars expose secrets
- API keys stored in `AiProviderKey` table, masked in UI via `maskApiKey()`
- No secrets logged in `writeLog()` (only `inputPreview` first 500 chars, sanitized)

---

## 8. Recommended N8N Integration Points

### What should eventually call n8n (Phase 2+)

| Function | Current implementation | n8n replacement | Notes |
|----------|----------------------|-----------------|-------|
| `ZaiAdapter.generateText()` | Calls `zai.chat.completions.create()` | n8n "AI Agent" / "OpenAI" node | Keep credits/rate-limit/job-tracking in CreatorOS |
| `ZaiAdapter.generateImage()` | Calls `zai.images.generations.create()` | n8n HTTP node → Fal AI / z.ai | Keep asset-saving in CreatorOS |
| `ZaiAdapter.submitVideoJob()` | Calls `zai.video.generations.create()` | n8n HTTP node → z.ai video API | Keep `simulateJobProgress()` polling in CreatorOS (or move to n8n callback) |
| `ZaiAdapter.pollVideoJob()` | Calls `zai.async.result.query()` | n8n HTTP node | Keep `nudgeVideoJob()` self-healing in CreatorOS |
| `TOOL_SYSTEM_PROMPTS` (chat route) | Hardcoded in `src/app/api/ai/chat/route.ts` | n8n Set node / workflow variables | Editable without redeploy |
| `resolveRoute()` | DB query → ApprovedModel | n8n Switch node / workflow branching | Visual routing |

### What must stay in CreatorOS (never moves to n8n)

| Function | Why |
|----------|-----|
| `getDemoUser()` / auth | CreatorOS is authoritative for users |
| `checkCredits()` / `deductCredits()` | Atomic DB transactions, billing |
| `checkRateLimit()` | Per-user limits need DB |
| `AiJob` creation + status updates | Job tracking is CreatorOS business logic |
| `AiAsset` creation | Asset library belongs to CreatorOS |
| `writeLog()` / `trackUsage()` / `trackCost()` | Analytics + audit |
| `mapEngineError()` | Translates provider errors to creator-safe messages |
| `nudgeVideoJob()` self-healing | Resilient polling needs DB access |
| Concurrent-job check (video 409) | Business rule, not orchestration |
| 60s cooldown check (video 429) | Business rule, not orchestration |

---

## 9. Files That Will Eventually Be Changed (Phase 2+)

| File | Change | Phase |
|------|--------|-------|
| `src/lib/ai-engine/providers.ts` | Add `N8nAdapter` alongside `ZaiAdapter` | 2 |
| `src/lib/ai-engine/engine.ts` | `generateText/Image/Video` check feature flag → route to n8n or existing adapter | 2 |
| `src/app/api/ai/chat/route.ts` | Move `TOOL_SYSTEM_PROMPTS` to n8n workflow | 3 |
| `src/lib/ai-engine/router.ts` | Optional: `resolveRoute()` can return an n8n workflow name | 3 |
| `src/components/modules/ai-settings.tsx` | Add n8n status panel (Phase 1 already adds minimal) | 1 (minimal) |

---

## 10. Files That Must Remain Untouched (Phase 1)

**ALL existing files remain untouched in Phase 1.** Specifically:

- `src/lib/ai-engine/**` — no changes
- `src/lib/creator-ai.ts` — no changes
- `src/app/api/ai/**` — no changes to existing routes
- `src/app/api/admin/**` — no changes to existing routes (new n8n routes added separately)
- `src/components/modules/**` — no changes to existing components (minimal n8n status added to admin monitoring)
- `prisma/schema.prisma` — no schema changes
- `package.json` — no dependency changes (zod already installed)

Phase 1 only **adds** new files; it does not modify existing AI logic.

---

## 11. Potential Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| n8n unavailable blocks AI features | Low (Phase 1 doesn't route AI through n8n) | None in Phase 1 | Feature flag defaults to OFF; existing engine unaffected |
| Credential leakage (N8N_API_KEY to browser) | Low | Critical | Server-only module (`src/lib/n8n/`); no `NEXT_PUBLIC_` vars; API routes don't echo secrets |
| HMAC signature bypass | Low | Medium | Strong secret (32+ chars); timestamp validation (±5 min); requestId uniqueness |
| Replay attack | Low | Medium | Timestamp in signature; n8n can reject old timestamps |
| n8n webhook URL changes | Medium | Low | Workflow registry centralizes URLs; env-configured base URL |
| Response validation failure | Medium | Low | Zod schema validation; graceful error mapping via `mapEngineError` pattern |
| Accidental n8n routing in Phase 1 | Low | High | Feature flag `N8N_AI_ENABLED=false` by default; no existing route calls n8n client |

---

## 12. Existing Error Handling Pattern

`mapEngineError(e)` in `src/lib/creator-ai.ts`:
- Detects HTML responses (server crash) → 503 "AI service unavailable"
- Detects size validation errors → 400 "size not supported"
- Detects insufficient credits → 402
- Detects rate limit → 429
- Detects provider-specific errors → 503 sanitized
- Default → 500 with truncated message

**n8n integration must follow this pattern.** The n8n client should throw errors that `mapEngineError` can handle, or a new `mapN8nError()` should follow the same conventions.

---

## 13. Existing Logging/Audit System

### AiLog table (per-request logging)

```
writeLog({
  workspaceId, userId, providerId, providerSlug, modelId,
  toolSlug, routeCategory, requestType, inputPreview,
  status (OK|ERROR|TIMEOUT|RATE_LIMITED), errorCode, errorMessage,
  durationMs, inputTokens, outputTokens, creditsUsed, costUsd,
  ip, userAgent
})
```

### AuditLog table (admin actions)

```
AuditLog: { workspaceId, actorId, actorRole, action, targetType, targetId, metadata, ip }
```

### Admin UI

- `/api/admin/logs` — paginated AiLog viewer
- `/api/admin/monitoring` — real-time dashboard (today's requests, success rate, cost, latency, per-provider health)
- `/api/admin/costs` — daily cost charts

**n8n integration logging:** Phase 1 uses `AuditLog` for n8n test/health operations (actorId=user, action='n8n.test' / 'n8n.health'). Full request-level logging to `AiLog` will be added in Phase 2 when AI routes actually call n8n (requires creating an n8n "provider" row in `AiProvider` table for the FK).

---

## Summary

The CreatorOS AI architecture is well-structured with clear separation between:
- **Orchestration** (engine.ts) — routing, credits, rate limits, job tracking
- **Provider calls** (providers.ts) — adapter pattern, z.ai SDK, stubs
- **Business logic** (creator-ai.ts) — auth, error mapping, serialization

Phase 1 adds an n8n client alongside this stack without touching any of it. The n8n client is a new peer to `ZaiAdapter` — when the feature flag is enabled and a workflow is migrated, `engine.ts` will be able to call `n8nClient.execute()` instead of `adapter.generateText()`. Until then, it's dormant infrastructure.
