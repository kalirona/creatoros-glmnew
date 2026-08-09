# N8N Phase 2 — Chat Integration Audit

**Date:** 2026-08-07
**Phase:** 2.1 (Audit only — NO code changes)
**Goal:** Trace the exact AI Studio chat flow and identify where `N8nAdapter` plugs in for TEXT_GENERATION via n8n → OpenRouter, with explicit-model verification.

---

## 1. Current Chat Flow (end-to-end trace)

```
1. AI Studio UI (src/components/modules/ai-studio.tsx, ChatTab)
   User types message → clicks send
     ↓
   const res = await fetch('/api/ai/chat', {
     method: 'POST',
     body: JSON.stringify({ tool, messages: newMessages })
   })
     ↓

2. POST /api/ai/chat (src/app/api/ai/chat/route.ts)
   - Parses { tool, messages }
   - Validates: messages array non-empty, ≤50 msgs, ≤20000 chars total
   - Resolves systemPrompt from TOOL_SYSTEM_PROMPTS[tool] (hardcoded map)
   - getDemoUser() → resolves User from DB (first by createdAt)
   - Builds conversationInput: joins messages as "User: ...\n\nAssistant: ..."
   - Calls generateText({ toolSlug: 'AI_CHAT', userInput, userId, workspaceId, systemPrompt, title, routeCategory: 'WRITING' })
     ↓

3. generateText() (src/lib/ai-engine/engine.ts)
   a. resolveRoute('WRITING') → queries AiRoute + ApprovedModel tables
      → returns { providerId, providerSlug, providerName, modelId, modelName, strategy }
      → Currently: providerSlug='glm', modelId=GLM-4 Flash's ApprovedModel.id, modelName='glm-4-flash'
   b. Look up AiTool by slug='AI_CHAT' → get creditCost, temperature, maxTokens, isVisible
   c. checkRateLimit(workspaceId, userId, 'WRITING')
   d. checkCredits(userId, creditCost)
   e. Build systemPrompt: loadSystemPrompts() (DB) + params.systemPrompt
   f. Build messages: [{ role: 'user', content: userInput }]  ← NOTE: single user message, conversation flattened upstream
   g. getAdapter(route.providerSlug) → currently ZaiAdapter (since glm aliases to z.ai)
   h. adapter.generateText(messages, { temperature, maxTokens, systemPrompt })
      → calls zai.chat.completions.create({ messages, thinking: { type: 'disabled' } })
      → returns { text, inputTokens, outputTokens, durationMs }
      ↓ (on failure)
      i. Failover: query other ApprovedModel rows with modality='TEXT'
      ii. For each, getAdapter(providerSlug).generateText(...)
      iii. If all fail → throw "No available AI provider..."
   j. estimateCost('TEXT', inputTokens, outputTokens, 1.0)
   k. parseStructured(text) if tool.outputType !== 'MARKDOWN'
   l. db.aiGeneration.create({ ...providerSlug, modelId, output, creditsUsed, costUsd, ... })
   m. deductCredits(userId, creditCost)
   n. trackUsage() + trackCost() + writeLog() (parallel)
   o. Return { generationId, raw, structured, providerSlug, modelId, creditsUsed, ... }
     ↓

4. POST /api/ai/chat returns
   { content: result.raw, creditsUsed: result.creditsUsed, model: result.modelId || 'routed' }
     ↓

5. AI Studio UI
   - Appends assistant message to messages[]
   - Updates credits via onCreditsUpdate
```

### Key observations

- **The full conversation is NOT passed as structured messages to the adapter.** The chat route flattens it into a single `userInput` string (`"User: ...\n\nAssistant: ..."`). The adapter receives `[{ role: 'user', content: flattenedString }]`. This is a limitation we should fix in Phase 2 — n8n/OpenRouter should receive proper message array.
- **`result.modelId` is the ApprovedModel.id** (a cuid), NOT the provider's model string. The response to the UI says `model: result.modelId || 'routed'` — which returns the cuid, not `glm-4-flash`. This is misleading and should be improved.
- **The `usedRoute.modelName`** field (e.g. `'glm-4-flash'`) is saved to `AiGeneration.modelId` but that's actually the ApprovedModel.modelId, not the provider's model string. There's conflation between ApprovedModel.id, ApprovedModel.modelId, and the actual provider model.

---

## 2. Current Model Resolution

`resolveRoute(category)` in `src/lib/ai-engine/router.ts`:

1. Query `AiRoute` where `toolCategory='WRITING' AND isActive=true`
   - Current: `providerId=GLM provider, modelId=null` (null means "use default approved model")
2. Query `ApprovedModel` where `providerId=route.providerId, modality='TEXT', isEnabled=true, workspaceVisible=true`
3. Pick model priority: `route.modelId override → isDefault=true → first by priority`
4. Return `{ providerId, providerSlug, providerName, modelId, modelName }`
   - `modelId` = ApprovedModel.id (cuid) ← confusingly named
   - `modelName` = ApprovedModel.modelId (e.g. `'glm-4-flash'`) ← the actual provider model string

### Current state in DB

| Route Category | Provider | Approved Models |
|---------------|----------|-----------------|
| WRITING | GLM (Z.ai) — primary | GLM-4 Flash (`glm-4-flash`, default) |
| WRITING | OpenRouter — fallback | Gemini 2.5 Pro (`google/gemini-2.5-pro-preview`), Gemma 4 31B (`google/gemma-4-31b-it:free`), Lyria 3 Pro (`google/lyria-3-pro-preview`) |

**Important:** OpenRouter's `isHealthy=false` in the DB. Phase 2 must set this to `true` for OpenRouter to be eligible for routing (or the n8n adapter must bypass the health check).

---

## 3. Current OpenRouter Flow

**There is NO real OpenRouter integration.** The `OpenRouterAdapter` is a `StubAdapter` subclass:

```typescript
class OpenRouterAdapter extends StubAdapter {
  slug = 'openrouter' as const
  modalities: Modality[] = ['TEXT']
  protected label = 'OpenRouter'
}
// StubAdapter.generateText() throws: "OpenRouter text generation requires a real API key. Falling back to default engine."
```

So when `resolveRoute('WRITING')` returns OpenRouter as the fallback provider, `getAdapter('openrouter').generateText()` **always throws**, and the failover loop in `generateText()` moves to the next provider (z.ai/GLM). This is the root cause of the "selected one model but GLM was actually being used" bug.

**Phase 2 fixes this by replacing the stub with a real N8nAdapter that calls OpenRouter via n8n.**

---

## 4. Existing N8N Client (Phase 1)

Located in `src/lib/n8n/`. Key components:

### `client.ts` — `N8nClient`

```typescript
class N8nClient {
  async execute<T>(
    workflowName: string,
    payload: Record<string, unknown>,
    context: N8nContext
  ): Promise<N8nResponse<T>>
}
```

- Builds standard request contract: `{ requestId, timestamp, workflow, user, workspace, locale, timezone, payload }`
- Signs with HMAC-SHA256: `X-CreatorOS-Signature` over `${requestId}:${timestamp}:${body}`
- Sends headers: `X-N8N-API-Key`, `X-CreatorOS-Signature`, `X-CreatorOS-Request-ID`, `X-CreatorOS-Timestamp`
- Validates response with Zod (`N8nResponseSchema`)
- Logs to `AuditLog`
- Throws `N8nError` on any failure (TIMEOUT, HTTP_ERROR, INVALID_RESPONSE, NETWORK_ERROR, etc.)

### `workflows.ts` — Registry

```typescript
TEXT_GENERATION: {
  name: 'TEXT_GENERATION',
  webhookId: 'text-generation',
  description: '[NOT YET MIGRATED]...',
  enabled: false,   // ← Phase 2 will set this to true
  timeoutMs: 60_000,
  responseType: 'json',
}
```

### `feature-flag.ts`

- `isN8nEnabled()` — sync, checks env var only
- `isN8nEnabledAsync()` — async, checks env var + DB FeatureFlag row (`n8n_ai_enabled`), 60s cache
- Both default to `false`

### `schemas.ts`

- `N8nResponseSchema` — discriminated union on `success: true|false`
- `N8nHealthTestDataSchema` — for the health-test workflow

**Phase 2 needs:** A new Zod schema for the TEXT_GENERATION response payload (validating `{ text, provider, model }`).

---

## 5. Best Location for N8nAdapter

### Recommendation: `src/lib/ai-engine/providers.ts`

Add a new `N8nAdapter` class alongside `ZaiAdapter` and the stubs:

```typescript
class N8nAdapter implements ProviderAdapter {
  slug: ProviderSlug = 'n8n'   // new slug, OR reuse 'openrouter'
  modalities: Modality[] = ['TEXT']

  async generateText(
    messages: ChatMessage[],
    opts: { temperature: number; maxTokens: number; systemPrompt: string; modelId: string; providerSlug: string }
  ): Promise<TextCompletionResult & { actualModel: string; actualProvider: string }>
  {
    // 1. Build n8n payload: { provider, model, temperature, messages }
    // 2. Call n8nClient.execute('TEXT_GENERATION', payload, context)
    // 3. Verify response.data.model === opts.modelId  (EXPLICIT MODEL CHECK)
    // 4. Return { text, inputTokens, outputTokens, durationMs, actualModel, actualProvider }
  }
}
```

### Two integration approaches (recommend Option B)

**Option A — New 'n8n' provider slug:**
- Add `'n8n'` to `ProviderSlug` type
- Register `N8nAdapter` in the `adapters` registry under `'n8n'`
- Admin would need to create an `AiProvider` row with `slug='n8n'` and approve models under it
- **Downside:** Changes DB data, adds a fake "provider" that's really an orchestration layer

**Option B (RECOMMENDED) — N8nAdapter wraps existing provider slugs:**
- `N8nAdapter` is NOT registered in the static `adapters` map
- Instead, `generateText()` in `engine.ts` checks: "is n8n enabled AND the resolved provider is OpenRouter?"
- If yes → use `N8nAdapter` (which calls n8n with `provider: 'openrouter'`)
- If no → use the existing `getAdapter(route.providerSlug)` (current behavior)
- **Advantage:** No DB changes, no new provider row, no admin UI changes. The feature flag controls everything.

### Where the feature-flag check goes

In `generateText()` (engine.ts), step 6 (before calling the adapter):

```typescript
// Current step 6:
const adapter = getAdapter(route.providerSlug as any)
completion = await adapter.generateText(messages, { ... })

// Phase 2 step 6:
const useN8n = await isN8nEnabledAsync() && route.providerSlug === 'openrouter'
if (useN8n) {
  const n8nAdapter = new N8nAdapter()
  completion = await n8nAdapter.generateText(messages, {
    temperature, maxTokens, systemPrompt,
    modelId: route.modelName,        // e.g. 'google/gemini-2.5-pro-preview'
    providerSlug: 'openrouter',
    userId: params.userId,           // for N8nContext
    workspaceId: params.workspaceId,
  })
  // VERIFY: completion.actualModel === route.modelName
} else {
  const adapter = getAdapter(route.providerSlug as any)
  completion = await adapter.generateText(messages, { ... })
}
```

### What N8nAdapter needs that the current interface doesn't provide

The `ProviderAdapter.generateText` signature is:
```typescript
generateText(messages, opts: { temperature, maxTokens, systemPrompt }): Promise<TextCompletionResult>
```

It does NOT include `modelId`, `providerSlug`, `userId`, or `workspaceId`. N8nAdapter needs these. Options:
1. **Extend the interface** (changes all adapters — not recommended for Phase 2)
2. **Pass via opts** (add optional fields — backward compatible)
3. **N8nAdapter constructor takes context** (cleanest — `new N8nAdapter({ userId, workspaceId, modelId, providerSlug })`)

**Recommend Option 3** — N8nAdapter is instantiated with context, not registered as a singleton.

---

## 6. Existing Feature-Flag System

### n8n-specific (Phase 1)

- `N8N_AI_ENABLED` env var (master switch)
- `n8n_ai_enabled` FeatureFlag DB row (runtime toggle)
- `isN8nEnabledAsync()` checks both, 60s cache

### General FeatureFlag table

```prisma
model FeatureFlag {
  id, key (unique), name, description, enabled (default true), createdAt, updatedAt
}
```

- Admin UI: System Settings → Feature Flags tab (toggles `enabled` via PUT `/api/admin/flags`)
- The `n8n_ai_enabled` flag is already seeded (enabled=false)

### How Phase 2 uses it

`generateText()` calls `isN8nEnabledAsync()`:
- If `false` → use existing adapter (current behavior, zero regression)
- If `true` AND `route.providerSlug === 'openrouter'` → use N8nAdapter

**No new feature flags needed.** The existing `n8n_ai_enabled` flag controls all n8n routing.

---

## 7. Existing Credit Flow

Handled entirely in `generateText()` (engine.ts), steps 4, 10, 11:

```
Step 4:  checkCredits(userId, creditCost)        ← before adapter call
Step 10: deductCredits(userId, creditCost, reason) ← after successful adapter call
Step 11: trackUsage() + trackCost() + writeLog()  ← parallel, after deduction
```

- `AiTool.creditCost` defines the cost (AI_CHAT = ? — need to verify)
- `CreditTransaction` record created per deduction
- `deductCredits` is atomic (Prisma transaction)

**Phase 2 does NOT change this.** Credits are checked and deducted by CreatorOS before/after the n8n call. n8n never touches credits. If n8n fails, credits are NOT deducted (the throw happens before step 10).

---

## 8. Existing Conversation Persistence

### AiConversation table

```prisma
model AiConversation {
  id, userId, tool, title, messages (JSON string), createdAt, updatedAt
}
```

### Current behavior

**The chat route (`/api/ai/chat`) does NOT save to `AiConversation`.** It only:
1. Calls `generateText()` which saves to `AiGeneration` (single request/response record)
2. Returns the response to the UI

The UI maintains conversation state in React (`messages` state array). There's no server-side conversation threading — each chat message is an independent `AiGeneration` record.

**Phase 2 does NOT change this.** Conversation persistence stays exactly as-is. n8n receives the messages array for context, but CreatorOS remains responsible for any persistence.

---

## 9. Existing Usage/Logging

Three parallel calls after a successful generation (engine.ts step 11):

### `trackUsage()` → `AiUsage` table
```
{ workspaceId, userId, toolSlug, routeCategory, providerSlug, creditsUsed, costUsd, inputTokens, outputTokens, durationMs }
```

### `trackCost()` → `AiCost` table (daily aggregation per provider)
```
{ providerId, day, totalCostUsd, totalCredits, totalInputTokens, totalOutputTokens }
```

### `writeLog()` → `AiLog` table (per-request detailed log)
```
{ workspaceId, userId, providerId, providerSlug, modelId, toolSlug, routeCategory,
  requestType, inputPreview, status, errorCode, errorMessage, durationMs,
  inputTokens, outputTokens, creditsUsed, costUsd, ip, userAgent }
```

### n8n-specific logging (Phase 1)

`logN8nOperation()` → `AuditLog` table:
```
{ workspaceId, actorId, actorRole='system', action='n8n.TEXT_GENERATION.success',
  targetType='n8n_workflow', targetId=requestId, metadata={...} }
```

**Phase 2:** The N8nAdapter should log to AuditLog (via `logN8nOperation`) for each call. The existing `trackUsage`/`trackCost`/`writeLog` in `generateText()` continue to run with the `usedRoute` data — which will show `providerSlug: 'openrouter'` and the actual model, making usage transparent.

---

## 10. Exact Files That Will Need Modification (Phase 2.2)

### WILL modify

| File | Change | Risk |
|------|--------|------|
| `src/lib/ai-engine/providers.ts` | Add `N8nAdapter` class (new, alongside existing adapters). Does NOT modify `ZaiAdapter`, `StubAdapter`, or the registry. | Low — additive |
| `src/lib/ai-engine/engine.ts` | In `generateText()`, add feature-flag check before step 6: if n8n enabled + provider is OpenRouter → use N8nAdapter. Add model-verification check after adapter returns. | Medium — touches the core orchestration function |
| `src/lib/n8n/workflows.ts` | Set `TEXT_GENERATION.enabled = true` | Low — one boolean |
| `src/lib/n8n/schemas.ts` | Add `N8nTextGenerationDataSchema` (validates `{ text, provider, model }`) | Low — additive |
| `src/lib/n8n/types.ts` | Add `N8nTextGenerationPayload` and `N8nTextGenerationData` types | Low — additive |

### WILL create (new files)

| File | Purpose |
|------|---------|
| `docs/n8n-workflow-text-generation.json` | Importable n8n workflow that calls OpenRouter with the exact model specified |
| `docs/N8N_PHASE_2_CHAT_IMPLEMENTATION.md` | Implementation doc (what was changed, how to test, rollback) |

### WILL NOT modify

| File | Reason |
|------|--------|
| `src/app/api/ai/chat/route.ts` | No change — it calls `generateText()` which handles routing internally |
| `src/components/modules/ai-studio.tsx` | No UI change — the chat tab works as-is |
| `src/lib/ai-engine/router.ts` | No change — model resolution stays the same |
| `src/lib/ai-engine/cost.ts` | No change — credits/rate-limits/logging stay the same |
| `src/lib/creator-ai.ts` | No change — auth/error-mapping stay the same |
| `src/lib/n8n/client.ts` | No change — the client is generic, N8nAdapter uses it as-is |
| `src/lib/n8n/feature-flag.ts` | No change — existing flag controls Phase 2 |
| `src/lib/n8n/health.ts` | No change |
| `src/lib/n8n/logging.ts` | No change |
| `prisma/schema.prisma` | No DB schema change |
| `src/lib/ai-engine/types.ts` | No type change (N8nAdapter context passed via constructor, not interface) |

### DB changes needed

| Change | Reason |
|--------|--------|
| Set OpenRouter `isHealthy=true` | Currently `false`, which prevents routing. Needed for OpenRouter to be eligible. (This is a data fix, not a schema change.) |
| Set WRITING route `providerId` to OpenRouter (optional) | Currently GLM is primary, OpenRouter is fallback. To test Phase 2, either: (a) make OpenRouter primary, or (b) keep GLM primary and test via failover. Recommend (a) for explicit testing. |

---

## 11. Model Verification Design (the critical invariant)

### The problem this solves

Previously, the system said "use OpenRouter" but the stub threw, failover silently switched to GLM, and the user got a GLM response thinking it was OpenRouter. **No error, no warning — silent model substitution.**

### Phase 2 fix

**Request contract** (CreatorOS → n8n):
```json
{
  "payload": {
    "provider": "openrouter",
    "model": "google/gemini-2.5-pro-preview",
    "temperature": 0.7,
    "maxTokens": 4096,
    "messages": [
      { "role": "system", "content": "..." },
      { "role": "user", "content": "..." }
    ]
  }
}
```

**Response contract** (n8n → CreatorOS):
```json
{
  "success": true,
  "requestId": "...",
  "data": {
    "text": "Here's my response...",
    "provider": "openrouter",
    "model": "google/gemini-2.5-pro-preview"
  }
}
```

**Verification in N8nAdapter:**
```typescript
if (response.data.model !== requestedModel) {
  throw new N8nError('MODEL_MISMATCH', 
    `Model mismatch: requested "${requestedModel}" but n8n returned "${response.data.model}". This is a security issue — n8n may have substituted a different model.`, 
    { statusCode: 502, requestId, workflow: 'TEXT_GENERATION' })
}
```

This is a **hard failure**. The request fails rather than silently using the wrong model. Credits are NOT deducted (the throw happens before `deductCredits()`).

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| n8n unavailable blocks chat | Medium | High (if OpenRouter is primary) | Keep GLM as fallback provider; failover loop in `generateText()` catches N8nError and tries next approved provider |
| Model mismatch (n8n substitutes model) | Low | Critical | Hard-fail with `MODEL_MISMATCH` error; no credits deducted; logged to AuditLog |
| Feature flag accidentally on | Low | Medium | Flag defaults to `false`; requires both env var + DB flag |
| n8n response latency | Medium | Low | 60s timeout on TEXT_GENERATION workflow; chat is not real-time-critical |
| Conversation context lost | Low | Medium | N8nAdapter receives full `messages[]` array (Phase 2 should fix the current flattening bug) |
| OpenRouter API key needed | High | Blocker | n8n workflow holds the OpenRouter key in its credential vault — CreatorOS never sees it |

---

## 13. Open Questions for Phase 2.2 Implementation

1. **Should we fix the conversation flattening?** Currently the chat route joins all messages into one string. n8n/OpenRouter work best with a proper messages array. Recommend fixing this in the chat route (pass `messages` directly to `generateText` instead of `userInput` string).

2. **Should N8nAdapter be used for the failover case too?** If GLM is primary and fails, and OpenRouter is the fallback, should the failover go through n8n or the OpenRouter stub? Recommend: yes, through n8n (same feature-flag check applies).

3. **Should we set OpenRouter as the primary WRITING provider for testing?** Recommend: yes, to actually exercise the n8n path. Can revert via admin UI after testing.

4. **Token counting:** The current ZaiAdapter estimates tokens (4 chars ≈ 1 token). n8n/OpenRouter can return actual token counts. Should N8nAdapter use real counts? Recommend: yes, if OpenRouter returns them in the response.

---

## Summary

The integration point is clear: **`N8nAdapter` plugs into `generateText()` in `engine.ts` as an alternative to `getAdapter(route.providerSlug).generateText()`**, gated by the existing n8n feature flag + provider-slug check.

- **No new DB tables** — reuses ApprovedModel, AiRoute, AiGeneration, AiLog, AuditLog
- **No UI changes** — the chat tab calls `/api/ai/chat` which calls `generateText()` unchanged
- **No auth/credit/rate-limit changes** — all stay in CreatorOS
- **Explicit model verification** — hard-fail if n8n returns a different model than requested
- **Safe rollback** — set `N8N_AI_ENABLED=false` and everything reverts to existing behavior

**Ready for Phase 2.2 implementation upon approval.**
