# N8N Integration — CreatorOS

**Phase:** 1 (Foundation)
**Status:** Infrastructure complete. No AI routing yet.
**Date:** 2026-08-07

---

## Architecture

```
┌─────────────────┐         ┌─────────────────────────┐         ┌─────────────┐
│  Browser        │         │  CreatorOS (Next.js)    │         │  n8n        │
│  (AI Studio)    │ ──────► │                         │ ──────► │ (self-host) │
│                 │  HTTPS  │  - Auth (getDemoUser)   │  HMAC   │             │
│  Never calls    │         │  - Workspace check      │ signed  │  Workflows  │
│  n8n directly   │ ◄────── │  - Credit/rate-limit    │ ◄────── │             │
│                 │         │  - n8nClient.execute()  │  JSON   │             │
└─────────────────┘         └─────────────────────────┘         └─────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │  Prisma DB   │
                            │  (SQLite)    │
                            │  - credits   │
                            │  - jobs      │
                            │  - assets    │
                            │  - audit logs│
                            └──────────────┘
```

### Key principle

**The browser NEVER calls n8n.** All n8n calls are server-to-server, after authentication, workspace validation, and credit/rate-limit checks. n8n is an orchestration layer — CreatorOS remains authoritative for all business logic (auth, credits, jobs, assets, billing).

---

## Environment Variables

Add to `.env` (see `.env.example`):

```env
# n8n integration (all optional in Phase 1 — if unset, n8n is disabled)
N8N_BASE_URL=https://n8n.yourdomain.com
N8N_API_KEY=your-n8n-api-key
N8N_WEBHOOK_SECRET=generate-a-32-plus-char-random-secret
N8N_TIMEOUT_MS=30000
N8N_AI_ENABLED=false
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `N8N_BASE_URL` | Yes (to enable) | — | n8n instance URL, no trailing slash |
| `N8N_API_KEY` | Yes (to enable) | — | Sent as `X-N8N-API-Key` header; n8n authenticates the request |
| `N8N_WEBHOOK_SECRET` | Yes (to enable) | — | Shared secret for HMAC-SHA256 signing (`X-CreatorOS-Signature`) |
| `N8N_TIMEOUT_MS` | No | `30000` | Per-request timeout in milliseconds |
| `N8N_AI_ENABLED` | Yes | `false` | Master switch. `true`/`1` = enabled, anything else = disabled |

### Security

- **Never** use `NEXT_PUBLIC_` for these vars — they'd be exposed to the browser
- `.env*` is gitignored
- Credentials are only read server-side in `src/lib/n8n/`
- No API endpoint echoes credentials back

---

## Security Model

### Authentication (CreatorOS → n8n)

Every request to n8n includes three security headers:

```
X-N8N-API-Key: <N8N_API_KEY>              ← authenticates to n8n
X-CreatorOS-Signature: <HMAC-SHA256>      ← proves request came from CreatorOS
X-CreatorOS-Request-ID: <UUID>            ← correlation ID
X-CreatorOS-Timestamp: <ISO 8601>         ← for replay protection
```

### HMAC Signature

```
signature = HMAC-SHA256(
  key   = N8N_WEBHOOK_SECRET,
  input = `${requestId}:${timestamp}:${body}`
)
```

n8n should verify the signature and reject requests where:
- The signature doesn't match (tampered or forged)
- The timestamp is >5 minutes old (replay attack)

### What is NEVER sent to n8n

- Passwords
- Session cookies
- Refresh tokens
- User API keys
- Internal database secrets
- Full PII beyond `{ userId, userRole, workspaceId, workspacePlan }`

### What n8n CANNOT do

- Deduct credits (CreatorOS does this before/after the n8n call)
- Decide permissions (CreatorOS checks RBAC before calling n8n)
- Bypass workspace isolation (CreatorOS resolves workspace from the session, not from the request)
- Write to CreatorOS DB (n8n returns data; CreatorOS persists it)

---

## Request Contract

All n8n requests use this standard body:

```json
{
  "requestId": "uuid-v4",
  "timestamp": "2026-08-07T12:00:00.000Z",
  "workflow": "HEALTH_TEST",
  "user": {
    "id": "user-cuid",
    "role": "SUPER_ADMIN"
  },
  "workspace": {
    "id": "workspace-cuid",
    "plan": "PRO"
  },
  "locale": "en",
  "timezone": "UTC",
  "payload": {}
}
```

The `payload` field contains workflow-specific data. `user` and `workspace` are resolved from the authenticated CreatorOS session — **never trusted from the client**.

---

## Response Contract

### Success

```json
{
  "success": true,
  "requestId": "uuid-v4",
  "data": {}
}
```

### Failure

```json
{
  "success": false,
  "requestId": "uuid-v4",
  "error": {
    "code": "WORKFLOW_ERROR",
    "message": "Human-readable error description"
  }
}
```

### Validation

All responses are validated with Zod (`src/lib/n8n/schemas.ts`) before being returned to the application. Invalid responses throw `N8nError` with code `INVALID_RESPONSE`.

---

## Workflow Naming

Workflows are registered in `src/lib/n8n/workflows.ts`. The registry maps internal names to n8n webhook paths:

| Internal Name | n8n Webhook Path | Status | Timeout |
|---------------|-------------------|--------|---------|
| `HEALTH_TEST` | `creatoros-health-test` | ✅ Enabled | 10s |
| `TEXT_GENERATION` | `text-generation` | ❌ Disabled (Phase 2) | 60s |
| `IMAGE_GENERATION` | `image-generation` | ❌ Disabled (Phase 2) | 90s |
| `VIDEO_GENERATION` | `video-generation` | ❌ Disabled (Phase 2) | 120s |
| `COURSE_GENERATION` | `course-generation` | ❌ Disabled (Phase 3) | 90s |
| `CONTENT_GENERATION` | `content-generation` | ❌ Disabled (Phase 3) | 60s |

Only `HEALTH_TEST` is enabled in Phase 1. The others are placeholders for documentation — they cannot be called until explicitly enabled in a future phase.

---

## Health Checking

### Lightweight health check (no auth needed)

`GET /api/n8n/health` (Super Admin only) — pings n8n's `/healthz` endpoint:

```json
{
  "health": {
    "configured": true,
    "enabled": true,
    "reachable": true,
    "latencyMs": 124,
    "status": "healthy",
    "lastCheckedAt": "2026-08-07T12:00:00.000Z"
  },
  "workflows": [...],
  "recentOperations": [...]
}
```

Status values: `healthy` | `degraded` | `unhealthy` | `not_configured` | `disabled`

### End-to-end test (auth + signature + workflow)

`POST /api/n8n/test` (authenticated) — calls the `creatoros-health-test` workflow:

```json
{
  "success": true,
  "requestId": "uuid",
  "data": {
    "service": "n8n",
    "status": "healthy"
  }
}
```

---

## Feature Flag / Safe Rollout

n8n integration is controlled by **two layers**:

1. **`N8N_AI_ENABLED` env var** — deployment-level master switch (requires restart)
2. **`n8n_ai_enabled` FeatureFlag DB row** — admin runtime toggle (no restart)

n8n is enabled **only if both are truthy**. Either can disable it.

### Rollback procedure

To instantly disable n8n:
1. Set `N8N_AI_ENABLED=false` in `.env` and restart, OR
2. Toggle the `n8n_ai_enabled` feature flag off in Admin → System Settings → Feature Flags

When disabled, all existing AI features continue to work through the built-in AI engine. n8n is not a single point of failure in Phase 1 — no AI route calls n8n yet.

---

## Logging

n8n operations are logged to the `AuditLog` table:

```
AuditLog {
  workspaceId: "default"
  actorId: "user-cuid"
  actorRole: "system"
  action: "n8n.HEALTH_TEST.success"  // or .failure
  targetType: "n8n_workflow"
  targetId: "request-uuid"
  metadata: {
    requestId, workflow, startedAt, completedAt,
    durationMs, success, errorCode, errorMessage
  }
}
```

**Never logged:** API keys, signatures, full prompts (may contain PII), response bodies.

Recent operations are visible via `GET /api/n8n/health` (Super Admin only).

---

## Files

### Created (new)

| File | Purpose |
|------|---------|
| `src/lib/n8n/types.ts` | TypeScript types + `N8nError` class |
| `src/lib/n8n/schemas.ts` | Zod validation schemas |
| `src/lib/n8n/workflows.ts` | Workflow registry |
| `src/lib/n8n/config.ts` | Env var access helpers |
| `src/lib/n8n/client.ts` | `N8nClient` — core client with HMAC signing |
| `src/lib/n8n/health.ts` | `checkN8nHealth()` — lightweight health check |
| `src/lib/n8n/logging.ts` | AuditLog integration |
| `src/lib/n8n/feature-flag.ts` | Feature flag check (env + DB) |
| `src/lib/n8n/index.ts` | Barrel exports |
| `src/app/api/n8n/test/route.ts` | POST — end-to-end test endpoint |
| `src/app/api/n8n/health/route.ts` | GET — health check (Super Admin) |
| `docs/N8N_INTEGRATION_AUDIT.md` | Architecture audit |
| `docs/N8N_INTEGRATION.md` | This document |
| `docs/n8n-workflow-creatoros-health-test.json` | n8n workflow import file |
| `.env.example` | Environment variable documentation |

### Modified

| File | Change |
|------|--------|
| `.env` | Added n8n env vars (all empty/disabled by default) |

### Database changes

| Change | Description |
|--------|-------------|
| `FeatureFlag` row | Added `n8n_ai_enabled` flag (enabled=false by default) |

**No Prisma schema changes.** No existing tables modified. The feature flag reuses the existing `FeatureFlag` model.

---

## Setup Guide

### 1. Self-host n8n

Deploy n8n with Docker:
```yaml
# docker-compose.yml
services:
  n8n:
    image: n8nio/n8n:latest
    ports: ["5678:5678"]
    environment:
      N8N_HOST: n8n.yourdomain.com
      WEBHOOK_URL: https://n8n.yourdomain.com
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      # ...
    volumes:
      - n8n_data:/home/node/.n8n
```

### 2. Import the health-test workflow

1. Open n8n → Workflows → Import from File
2. Select `docs/n8n-workflow-creatoros-health-test.json`
3. Activate the workflow

### 3. Configure CreatorOS

1. Copy `.env.example` to `.env`
2. Fill in:
   ```env
   N8N_BASE_URL=https://n8n.yourdomain.com
   N8N_API_KEY=your-n8n-api-key
   N8N_WEBHOOK_SECRET=your-32-char-secret
   N8N_AI_ENABLED=true
   ```
3. Restart CreatorOS
4. Enable the `n8n_ai_enabled` feature flag in Admin → System Settings → Feature Flags

### 4. Verify

1. `GET /api/n8n/health` — should return `status: "healthy"`
2. `POST /api/n8n/test` — should return `success: true`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `status: "not_configured"` | Missing env vars | Set `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WEBHOOK_SECRET` |
| `status: "disabled"` | Feature flag off | Set `N8N_AI_ENABLED=true` + enable `n8n_ai_enabled` flag in DB |
| `status: "unhealthy"` | n8n not reachable | Check n8n is running, URL is correct, network allows connection |
| `code: "HTTP_ERROR"` (401/403) | API key rejected | Verify `N8N_API_KEY` matches n8n's configured key |
| `code: "INVALID_RESPONSE"` | n8n returned non-standard JSON | Check the workflow returns the standard response contract |
| `code: "TIMEOUT"` | n8n took too long | Increase `N8N_TIMEOUT_MS` or optimize the workflow |
| `code: "WORKFLOW_NOT_FOUND"` | Workflow disabled in registry | Check `src/lib/n8n/workflows.ts` — workflow must have `enabled: true` |

---

## Future Phases

### Phase 2 — Migrate text + image generation
- Enable `TEXT_GENERATION` and `IMAGE_GENERATION` workflows
- Add `N8nAdapter` to `src/lib/ai-engine/providers.ts`
- `engine.ts` checks feature flag → routes to n8n or existing adapter
- Keep credits, rate limits, asset saving in CreatorOS

### Phase 3 — Migrate video generation
- Enable `VIDEO_GENERATION` workflow
- Move video submission to n8n (keep polling/self-healing in CreatorOS)
- Or: n8n calls back to CreatorOS webhook when video is ready

### Phase 4 — Migrate content tools
- Enable `COURSE_GENERATION`, `CONTENT_GENERATION`
- Move system prompts to n8n workflow variables
- Admin edits prompts in n8n UI (no code redeploy)

**Do not start Phase 2 until Phase 1 is verified in production.**
