# Phase 2.4 — n8n Text Generation Workflow Setup Guide

This guide walks you through setting up the real TEXT_GENERATION workflow in your self-hosted n8n instance and connecting it to CreatorOS.

---

## Prerequisites

1. **Self-hosted n8n** running and accessible from your CreatorOS server
2. **OpenRouter API key** — get one at https://openrouter.ai/keys
3. **CreatorOS Phase 2.3+** deployed (N8nAdapter wired into engine.ts)

---

## Step 1 — Import the Workflow

1. Open your n8n instance (e.g., `https://n8n.yourdomain.com`)
2. Go to **Workflows** → **Import from File**
3. Select `docs/n8n-workflow-text-generation.json`
4. The workflow will appear with 10 nodes:
   - Webhook (receives CreatorOS requests)
   - Validate Provider (checks provider=openrouter)
   - Validate Model (checks model is non-empty)
   - Call OpenRouter (HTTP Request to OpenRouter API)
   - Format Success / Format Validation Error / Format OpenRouter Error
   - Respond Success / Respond Validation Error / Respond OpenRouter Error

---

## Step 2 — Configure OpenRouter Credentials

The "Call OpenRouter" node needs an API key for OpenRouter. DO NOT hardcode it in the workflow.

### Option A — Create a Header Auth credential (recommended)

1. In n8n, go to **Settings** → **Credentials** → **Add Credential**
2. Search for **Header Auth**
3. Configure:
   - Name: `OpenRouter API`
   - Header Name: `Authorization`
   - Header Value: `Bearer sk-or-v1-...` (your real OpenRouter API key)
4. Save
5. Go back to the imported workflow
6. Open the **Call OpenRouter** node
7. Under **Authentication**, select **Header Auth**
8. Select the `OpenRouter API` credential you just created

### Option B — Use the built-in OpenRouter credential type

If your n8n version supports it, search for "OpenRouter API" in the credential types and paste your API key there.

---

## Step 3 — Activate the Workflow

1. In the workflow editor, click **Save**
2. Toggle the workflow to **Active** (top-right switch)

The webhook URL will be:
```
https://n8n.yourdomain.com/webhook/text-generation
```

---

## Step 4 — Configure CreatorOS

Edit your CreatorOS `.env` file:

```env
# n8n connection
N8N_BASE_URL=https://n8n.yourdomain.com
N8N_API_KEY=your-n8n-api-key
N8N_WEBHOOK_SECRET=generate-a-32-plus-char-random-secret
N8N_TIMEOUT_MS=30000

# Enable n8n routing
N8N_AI_ENABLED=true
```

Restart CreatorOS.

---

## Step 5 — Enable the Feature Flag

In CreatorOS Admin (Super Admin):

1. Go to **System Settings** → **Feature Flags**
2. Find `n8n_ai_enabled`
3. Toggle it to **Enabled**

Or via DB:
```sql
UPDATE FeatureFlag SET enabled = 1 WHERE key = 'n8n_ai_enabled';
```

---

## Step 6 — Set OpenRouter as Primary Text Provider

In CreatorOS Admin (Super Admin):

1. Go to **AI Settings** → **Routing**
2. Find the **WRITING** category
3. Set **Provider** to `OpenRouter`
4. Set **Model** to one of the approved OpenRouter models (e.g., `google/gemini-2.5-pro-preview`)
5. Set **Fallback** to `GLM (Z.ai)` (keeps existing behavior as backup)
6. Save

Also ensure OpenRouter is marked as healthy:
- Go to **AI Settings** → **Providers**
- If OpenRouter shows as unhealthy, click **Test Connection** to verify it's reachable

---

## Step 7 — Verify End-to-End

### Quick health check

```bash
# Check n8n is configured and reachable
curl http://localhost:3000/api/n8n/health
# Expected: "status": "healthy"

# Test the n8n connection
curl -X POST http://localhost:3000/api/n8n/test
# Expected: "success": true
```

### Real chat test

1. Open CreatorOS → **AI Studio** → **AI Chat**
2. Send: `Reply with exactly: N8N_OPENROUTER_TEST_OK`
3. The response should come from the OpenRouter model you selected
4. Check the dev log for:
   - `N8nAdapter.generateText` called
   - `TEXT_GENERATION` workflow executed
   - Model verification passed (no `MODEL_MISMATCH` error)

### Model verification

The AiGeneration record will show `providerSlug: "openrouter"` — proving the request went through n8n → OpenRouter, not GLM.

---

## How Model Verification Works

CreatorOS enforces **explicit model verification** to prevent silent model substitution:

1. **CreatorOS resolves the model** from ApprovedModel (e.g., `google/gemini-2.5-pro-preview`)
2. **N8nAdapter sends** `{ provider: "openrouter", model: "google/gemini-2.5-pro-preview" }` to n8n
3. **n8n workflow passes** that exact model to OpenRouter
4. **OpenRouter returns** the actual model it used (in its response `model` field)
5. **n8n returns** `{ data: { model: "google/gemini-2.5-pro-preview" } }` to CreatorOS
6. **N8nAdapter verifies** `data.model === requestedModel`
   - ✅ Match → success, text returned to user
   - ❌ Mismatch → `MODEL_MISMATCH` error thrown, NO fallback to GLM

This prevents the previous bug where GLM was silently used instead of the requested OpenRouter model.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `NETWORK_ERROR` | n8n unreachable | Check `N8N_BASE_URL`, n8n is running, network allows connection |
| `NOT_CONFIGURED` | Missing env vars | Set `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WEBHOOK_SECRET` |
| `DISABLED` | Feature flag off | Set `N8N_AI_ENABLED=true` + enable `n8n_ai_enabled` flag |
| `WORKFLOW_NOT_FOUND` | TEXT_GENERATION disabled or not imported | Import workflow JSON, ensure it's Active |
| `MODEL_MISMATCH` | n8n returned a different model than requested | Check n8n workflow isn't substituting models; the workflow must echo the OpenRouter response model |
| `INVALID_RESPONSE` | n8n returned malformed JSON | Check the Format Success node output matches the contract |
| `AUTH_ERROR` | OpenRouter API key invalid | Update the credential in n8n |
| `MODEL_NOT_FOUND` | OpenRouter doesn't have that model | Use a valid model ID from https://openrouter.ai/models |
| Chat still uses GLM | Feature flag off OR provider not OpenRouter | Verify flag is ON and WRITING route points to OpenRouter |

---

## Rollback

To instantly revert to the existing AI engine (bypass n8n):

1. Set `N8N_AI_ENABLED=false` in `.env` and restart, OR
2. Toggle `n8n_ai_enabled` feature flag OFF in Admin

All chat requests will use the existing ZaiAdapter/GLM path. No n8n calls.
