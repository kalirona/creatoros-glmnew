# CreatorOS AI System Report

## Overview

CreatorOS has a complete enterprise AI infrastructure with a **Provider Gateway**, **Approved Model** system, and **AI Engine** that routes every AI request through Super Admin-configured providers and models.

---

## Architecture

```
Creator (AI Studio)
    ↓
API Route (/api/ai/chat, /api/ai/generate, /api/ai/images, etc.)
    ↓
AI Engine (generateText / generateImage / generateVideo)
    ↓
Router (resolveRoute) → reads ApprovedModel table
    ↓
Provider Adapter (ZaiAdapter for GLM/Z.ai in sandbox)
    ↓
External AI API (z.ai SDK for GLM; real HTTP for OpenRouter/OpenAI/etc.)
    ↓
Response → Credits deducted → Usage tracked → Audit logged → Asset saved
    ↓
Creator sees result
```

### Key Principle: Provider Catalog ≠ Approved Models

| Layer | Table | Purpose | Who Controls |
|-------|-------|---------|--------------|
| **Provider Catalog** | `AiModel` | Mirrors ALL models from provider API (read-only) | Auto-synced from provider |
| **Approved Models** | `ApprovedModel` | Only models Super Admin approved for creators | Super Admin |
| **Routing** | `AiRoute` | Maps capability (TEXT/IMAGE/VIDEO) to provider | Super Admin |

**Creators NEVER see the Provider Catalog.** They only see Approved Models.

---

## AI Settings (Super Admin)

### 1. Dashboard
- Shows: Active Providers, Today's Requests, Today's Cost, Success Rate
- System Health: API Gateway, AI Engine, Database, File Storage, Webhook Ingest
- Quick Links: Providers, Routing, Monitoring, Costs
- Recent Activity: Last 5 AI audit logs

### 2. Providers (AI Provider Gateway)
Each provider card contains:
- **Name + slug** (e.g., OpenRouter, Fal AI, GLM)
- **Health indicator**: Healthy/Down + latency (ms)
- **Capabilities**: TEXT, IMAGE, VIDEO, TTS, STT, EMBEDDING
- **Stats**: Models count, Today Requests, Today Cost
- **API Key**: Masked display + Validate button (makes REAL HTTP request to provider)
- **Actions**: Test Connection, Refresh Models, Test Prompt, Usage, Edit Settings, Models dialog

**Supported Providers (13):**
| Provider | Status | Models | Capabilities |
|----------|--------|--------|-------------|
| Z.ai (GLM) | ✅ Active | 4 | TEXT, IMAGE |
| OpenRouter | ✅ Active | 343 | TEXT |
| Fal AI | ⚠️ Inactive | 4 | IMAGE, VIDEO |
| OpenAI | ⚠️ Inactive | 2 | TEXT, IMAGE, EMBEDDING |
| ElevenLabs | ⚠️ Inactive | 1 | TTS |
| Deepgram | ⚠️ Inactive | 1 | STT |
| Anthropic | ⚠️ Inactive | 1 | TEXT |
| Google Gemini | ⚠️ Inactive | 1 | TEXT, IMAGE |
| DeepSeek | ⚠️ Inactive | 1 | TEXT |
| Replicate | ⚠️ Inactive | 1 | IMAGE, VIDEO |
| Together AI | ⚠️ Inactive | 0 | TEXT, IMAGE |
| RunPod | ⚠️ Inactive | 0 | — |
| Custom | ⚠️ Inactive | 0 | TEXT, IMAGE, EMBEDDING |

**Key Feature: REAL Validation**
- When admin enters an API key and clicks "Validate," the system makes a REAL HTTP request to the provider's authenticated endpoint:
  - OpenRouter: `GET /key` (requires Bearer auth)
  - OpenAI: `GET /models` (requires Bearer auth)
  - Anthropic: `GET /models` (requires x-api-key)
  - Google Gemini: `GET /models?key=KEY`
  - Fal AI: `GET /users/me` (requires Key auth)
  - GLM/Z.ai: Real z.ai SDK chat completion
- **Fake keys always fail** with "Authentication failed (HTTP 401)"

### 3. Models (Two-Tab Architecture)

#### Tab 1: Approved Models (Creator-Facing Catalog)
- Shows ONLY models the Super Admin has approved
- Grouped by modality (TEXT, IMAGE, VIDEO, etc.)
- Each model has: Enable/Disable toggle, Default toggle, Remove button
- **Default enforcement**: Exactly ONE default per modality (capability)
- Stats: Approved count, Enabled count, Defaults Set, Modalities

#### Tab 2: Provider Catalog (Review Screen)
- Shows ALL models from ALL connected providers (363+ models)
- **Search**: Client-side filter by name/display name/provider
- **Filters**: Provider dropdown, Modality dropdown
- **Bulk Actions**: Approve All Visible, Approve Chat Models, Approve Image Models, Approve Video Models
- **Pagination**: 50 models per page (handles 500+ models)
- Each row shows: Name, Status badge (available/unavailable), Model ID, Modality, Provider, Capability badges (V/R/T/J), Cost, Approve button
- Already-approved models show "In Catalog" badge

**Flow**: Sync Provider → Models appear in Provider Catalog → Admin reviews → Clicks "Approve" → Model copied to Approved Models → Creators can now use it

### 4. Routing
- 14 route categories: CHAT, IMAGE, VIDEO, AUDIO, OCR, STT, TTS, VISION, EMBEDDING, RERANKER, MODERATION, WRITING, MARKETING, COURSE
- Each route maps to a primary provider + fallback provider
- Routing engine reads from `ApprovedModel` table (NOT `AiModel`)
- Only models with `isEnabled=true` AND `workspaceVisible=true` are eligible
- Provider must be `isActive=true` AND `isHealthy=true`

### 5. Credits
- Total issued, total spent, in circulation
- Recent transactions with user + amount + reason

### 6. Prompt Library
- Super Admin creates system prompts (System, Safety, Brand, Marketing, Course, Website, Image, Video, Email)
- Active prompts are **automatically injected into every AI request**
- Stored in database (AdminSetting key='ai_prompts')
- CRUD: Create, Edit, Toggle Active, Delete

### 7. AI Features
- Toggle individual AI capabilities on/off
- Categories: Core (Chat, Automation), Content (Course, Landing, Email, Blog, SEO, Document), Media (Image, Video, Voice), Experimental (Vision, OCR, Embeddings, Reasoning)

### 8. Logs
- Every AI request is logged with: timestamp, provider, model, tool, status, duration, tokens, cost
- Searchable and filterable

### 9. Usage Analytics
- Real-time stats: Requests Today, Cost Today, Success Rate, Avg Latency
- Monthly Summary: Total Requests, Total Cost, Avg Cost/Request
- Provider Comparison: Top 5 providers by requests
- Cost Trend: 30-day chart from real AiCost data

### 10. Security
- API key stats (total, active, rotated)
- Rate limit config (default 60/min, 600/hour)
- Providers with empty keys (security risk list)
- Workspace isolation status
- Audit log retention

---

## How AI Image Generation Works

1. Creator enters prompt in AI Studio → Images tab
2. Selects style (10 options: Realistic, Cartoon, Anime, 3D, etc.) and aspect ratio (6 options: 1:1, 2:3, 3:2, 9:16, 16:9, 4:1)
3. Clicks "Generate · 3 credits"
4. POST `/api/ai/images` with `{ prompt, style, aspectRatio }`
5. API route calls `generateImage()` from the AI Engine
6. Engine calls `resolveRoute('IMAGE')` → reads `ApprovedModel` table for IMAGE modality
7. **If no approved IMAGE model → throws "No enabled image model available"**
8. Engine calls `getAdapter(providerSlug).generateImage()`
9. ZaiAdapter calls `zai.images.generations.create()` with the prompt + style + size
10. SDK returns base64 image data
11. Engine converts to data URL, saves to:
    - `AiGeneration` (record with provider, model, cost, tokens)
    - `AiAsset` (auto-saved to Media Library, folder="AI Images")
    - `AiUsage` (daily aggregation)
    - `AiCost` (per-provider daily cost)
    - `AiLog` (audit log)
12. Credits deducted (3 credits)
13. Creator sees the image + it appears in Media Library

**Current state**: 1 approved IMAGE model (CogView 3 Plus from GLM/Z.ai)

---

## How AI Video Generation Works

1. Creator enters prompt in AI Studio → Videos tab
2. Selects preset (8 options: Product Demo, Social Reel, YouTube Short, etc.), duration, resolution
3. Clicks "Generate Video · 15 credits"
4. POST `/api/ai/videos` with `{ prompt, preset, duration, resolution }`
5. API route calls `generateVideo()` from the AI Engine
6. Engine calls `resolveRoute('VIDEO')` → reads `ApprovedModel` table for VIDEO modality
7. **If no approved VIDEO model → throws "No enabled video model available"**
8. Engine creates `AiJob` in QUEUED state
9. Background simulation progresses: QUEUED → RENDERING (15%) → PROCESSING (75%) → COMPLETED (100%)
10. On completion, auto-saves to `AiAsset` (folder="AI Videos")
11. Creator sees job progress, then video URL when complete

**Current state**: 0 approved VIDEO models (admin needs to approve one)

---

## How AI Chat Works

1. Creator types message in AI Studio → Chat tab
2. POST `/api/ai/chat` with `{ tool: "CHAT", messages: [...] }`
3. Chat route builds system prompt from `TOOL_SYSTEM_PROMPTS['CHAT']`
4. Calls `generateText()` from the AI Engine
5. Engine:
   - Calls `resolveRoute('WRITING')` → reads `ApprovedModel` for TEXT modality
   - Loads active system prompts from database (`AdminSetting` key='ai_prompts')
   - Combines: admin prompts + tool prompt + user input
   - Calls `getAdapter(providerSlug).generateText()`
   - **If primary adapter fails → tries other approved providers (failover)**
6. ZaiAdapter calls `zai.chat.completions.create()` with messages
7. Returns response text + deducts 2 credits + logs everything

**System prompt**: "You are CreatorOS AI, a helpful, knowledgeable, and versatile AI assistant. You can answer questions on ANY topic — not just business."

**Current state**: 49 approved TEXT models (48 OpenRouter + 1 GLM)

---

## How AI Document/Course/Marketing Generation Works

1. Creator selects a tool (Blog Writer, Course Generator, Email Writer, etc.) in AI Studio → Documents tab
2. Enters input text
3. POST `/api/ai/generate` with `{ toolSlug, input }`
4. Generate route calls `generateText()` from the AI Engine
5. Engine:
   - Looks up the tool in `AiTool` table (gets system prompt, credit cost, output type)
   - Routes through `resolveRoute()` → `ApprovedModel`
   - Calls adapter with tool's system prompt + admin prompts + user input
   - Parses structured output if tool's outputType is not MARKDOWN
6. Returns: raw text, structured JSON, credits used, remaining credits

**Available Tools (10+):**
| Tool | Cost | Output Type |
|------|------|-------------|
| AI Chat | 2 cr | MARKDOWN |
| Blog Writer | 8 cr | BLOG (JSON) |
| Course Generator | 15 cr | COURSE (JSON) |
| Email Writer | 4 cr | EMAIL (JSON) |
| Sales Page Generator | 12 cr | SALES_PAGE (JSON) |
| Social Media Generator | 3 cr | SOCIAL (JSON) |
| YouTube Script Generator | 10 cr | SCRIPT (JSON) |
| Product Description | 6 cr | PRODUCT (JSON) |
| Landing Page Generator | 7 cr | LANDING (JSON) |
| SEO Optimizer | 5 cr | MARKDOWN |
| Image Generator | 3 cr | IMAGE |
| Video Generator | 15 cr | VIDEO |

---

## How AI Routing Works (Complete Pipeline)

```
1. User Request
   ↓
2. API Route (/api/ai/chat, /api/ai/generate, /api/ai/images, etc.)
   ↓
3. AI Engine (generateText / generateImage / generateVideo)
   ├── resolveRoute(routeCategory)
   │   ├── Look up AiRoute for the category
   │   ├── Find ApprovedModel for the provider + modality
   │   │   WHERE isEnabled=true AND workspaceVisible=true
   │   ├── Pick model: route override → default → first enabled
   │   └── Return { providerId, providerSlug, modelId, modelName }
   │
   ├── If no route → throw meaningful error (NO hardcoded fallback)
   │
   ├── Load system prompts from database
   │   └── AdminSetting key='ai_prompts' → active prompts
   │
   ├── Check rate limit (60/min per workspace+user+category)
   ├── Check credits (tool.creditCost)
   │
   ├── Call adapter.generateText/Image()
   │   ├── Try primary provider's adapter
   │   ├── If fails → try other approved providers (FAILOVER)
   │   └── If all fail → throw "No available AI provider"
   │
   ├── Parse structured output (if tool.outputType != MARKDOWN)
   ├── Save AiGeneration record
   ├── Auto-save AiAsset (for images/videos)
   ├── Deduct credits
   ├── Track usage (AiUsage - daily aggregation)
   ├── Track cost (AiCost - per-provider daily)
   └── Write audit log (AiLog)
   ↓
4. Return result to API route
   ↓
5. API route returns creator-safe response
   (strips providerSlug, modelId, costUsd, durationMs)
   ↓
6. Creator sees result in AI Studio
```

---

## Database Tables (AI Infrastructure)

| Table | Purpose |
|-------|---------|
| `AiProvider` | Provider config (name, slug, apiKey, baseUrl, isActive, isHealthy, etc.) |
| `AiModel` | Provider Catalog (mirrors provider's models, read-only) |
| `ApprovedModel` | Creator-facing catalog (only admin-approved models) |
| `AiRoute` | Maps route category → provider + fallback |
| `AiTool` | AI tools (Blog Writer, Course Generator, etc.) with system prompts |
| `AiGeneration` | Every AI generation record |
| `AiAsset` | Auto-saved media (images, videos) |
| `AiJob` | Async video generation queue |
| `AiUsage` | Daily usage aggregation per workspace+user+tool |
| `AiLog` | Every AI request audit log |
| `AiCost` | Daily cost per provider |
| `AiProviderHealth` | Health check history |
| `AiProviderSyncHistory` | Model sync history |
| `AiRateLimit` | Sliding window rate limiting |
| `AiStorage` | Per-workspace storage tracking |
| `AiBrandProfile` | Creator brand voice settings |

---

## Security

- API keys **never** returned in plain text — always masked (`sk-1••••••••cdef`)
- API keys **never** saved when validation fails
- Provider names/model IDs **never** shown to creators
- All AI requests are audit logged
- Rate limiting: 60 requests/min per workspace+user+category
- Credit validation before every request
- Workspace isolation enforced

---

## Current Configuration Summary

- **Active Providers**: 3 (Z.ai, OpenRouter, Fal AI)
- **Approved Models**: 50 (49 TEXT + 1 IMAGE)
- **Approved IMAGE Model**: CogView 3 Plus (GLM/Z.ai)
- **Approved VIDEO Models**: 0 (none approved yet)
- **Routing**: TEXT → GLM (with OpenRouter failover), IMAGE → GLM
- **System Prompts**: Active prompts injected into every request
- **Rate Limit**: 60/min per user per category
- **Image Cost**: 3 credits
- **Video Cost**: 15 credits
- **Chat Cost**: 2 credits
- **Blog Cost**: 8 credits
- **Course Cost**: 15 credits
