# AI Video Generation — Cost & Model Report

## Available Video Models in CreatorOS

### Currently Approved
| Model | Provider | Cost/Request | Quality | Speed | Best For |
|-------|----------|-------------|---------|-------|----------|
| Kling Video | Fal AI | ~$0.50/sec | High | Medium | Cinematic shots, product demos |

### Available in Provider Catalog (Not Yet Approved)
| Model | Provider | Cost/sec | Quality | Speed | Best For |
|-------|----------|-----------|---------|-------|----------|
| Kling Video | Fal AI | $0.50 | High | Medium | General video, cinematic |
| (More available when providers connected) | | | | | |

## Recommended Cheap Video Models

### Tier 1: Cheapest (Best for prototyping/testing)
| Model | Provider | Est. Cost/8s video | Quality | Notes |
|-------|----------|-------------------|---------|-------|
| SDXL Turbo Video | Fal AI | ~$0.05 | Low-Medium | Fastest, cheapest, good for drafts |
| Stable Video Diffusion | Replicate | ~$0.03 | Low | Very cheap, short clips only |
| AnimateDiff | Replicate | ~$0.04 | Medium | Good for animated/stylized content |

### Tier 2: Best Value (Quality vs Cost)
| Model | Provider | Est. Cost/8s video | Quality | Notes |
|-------|----------|-------------------|---------|-------|
| Kling 1.6 | Fal AI | ~$0.40 | High | Best quality/cost ratio |
| Flux Schnell Video | Fal AI | ~$0.10 | Medium | Fast, affordable, decent quality |
| LTX Video | Fal AI | ~$0.08 | Medium | New model, very affordable |

### Tier 3: Premium (Highest Quality)
| Model | Provider | Est. Cost/8s video | Quality | Notes |
|-------|----------|-------------------|---------|-------|
| Kling Video Pro | Fal AI | ~$0.50 | Highest | Cinema-grade, slow rendering |
| Veo 3 | Google | ~$0.75 | Highest | Google's premium video model |
| Runway Gen-3 | Runway | ~$0.60 | Highest | Professional video editing |

## Recommendation for CreatorOS

**For production (best value):**
- **Kling Video** (Fal AI) — $0.50/8s — currently approved ✅
  - Best balance of quality and cost
  - Handles most creator needs (social reels, product demos, explainers)
  - 8-second clips are perfect for social media

**For budget/testing:**
- **LTX Video** (Fal AI) — ~$0.08/8s
  - 6x cheaper than Kling
  - Good enough for drafts and quick social posts
  - Lower quality but fast rendering

**For premium/professional:**
- **Veo 3** (Google) — ~$0.75/8s
  - Highest quality available
  - Best for course intros, brand videos, premium content
  - Requires Google AI provider connection

## Current CreatorOS Video Settings
- **Cost**: 15 credits per video
- **Duration**: 8 seconds (default)
- **Resolution**: 1080p (default)
- **Presets**: Product Demo, Social Reel, YouTube Short, Explainer, Promo, AI Avatar, Presentation, Animation
- **Queue**: Async job system (QUEUED → RENDERING → PROCESSING → COMPLETED)
- **Auto-save**: Videos automatically saved to Media Library (AI Videos folder)

## How to Switch Models
1. Go to **AI Settings → Models → Provider Catalog**
2. Find the video model you want (filter by VIDEO modality)
3. Click **Approve**
4. Go to **Approved Models** tab
5. Set the new model as **Default** for VIDEO
6. Routing engine immediately uses the new model (no restart needed)
