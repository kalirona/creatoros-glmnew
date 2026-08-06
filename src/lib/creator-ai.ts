// ============================================================================
// Creator AI API helpers — shared utilities for creator-facing AI routes.
// ----------------------------------------------------------------------------
// Lives outside src/lib/ai-engine/ on purpose (that library is admin-owned).
// Use these to keep creator responses free of provider/model/cost info.
// ============================================================================

import { db } from '@/lib/db'

// ─── Demo user / workspace resolver ────────────────────────────────────────
// Matches the existing pattern used across the codebase:
//   const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })
// First user is the demo user; workspaceId = 'default' for all creator ops.
export const DEMO_WORKSPACE_ID = 'default'

export async function getDemoUser() {
  return db.user.findFirst({ orderBy: { createdAt: 'asc' } })
}

// ─── safeJsonParse ─────────────────────────────────────────────────────────
// Parse a JSON string column; never throws. Returns fallback on failure.
export function safeJsonParse<T = unknown>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

// ─── Creator-friendly error mapping ────────────────────────────────────────
// Engine errors can leak provider names ("OpenRouter API key invalid") —
// this translates them to creator-safe messages + status codes.
export interface CreatorError {
  status: number
  message: string
}

export function mapEngineError(e: unknown): CreatorError {
  const msg = e instanceof Error ? e.message : String(e)
  const lower = msg.toLowerCase()

  // Insufficient credits
  if (lower.includes('insufficient credits') || lower.includes('insufficient credit')) {
    return { status: 402, message: makeInsufficientCreditsMessage(msg) }
  }
  // Rate limit
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      status: 429,
      message: "You're generating a bit too fast. Please wait a moment and try again.",
    }
  }
  // No provider available
  if (
    lower.includes('no ai provider') ||
    lower.includes('no image provider') ||
    lower.includes('no video provider') ||
    lower.includes('no active') ||
    lower.includes('provider') ||
    lower.includes('api key') ||
    lower.includes('openrouter') ||
    lower.includes('fal') ||
    lower.includes('elevenlabs') ||
    lower.includes('deepgram') ||
    lower.includes('model') ||
    lower.includes('adapter')
  ) {
    return {
      status: 503,
      message: 'AI service is temporarily unavailable. Please try again later.',
    }
  }
  // Tool disabled
  if (lower.includes('disabled') || lower.includes('not visible')) {
    return { status: 403, message: 'This AI tool is currently unavailable.' }
  }
  // Unknown tool
  if (lower.includes('unknown ai tool')) {
    return { status: 404, message: 'This AI tool could not be found.' }
  }
  // Generic
  return { status: 500, message: 'Something went wrong while generating. Please try again.' }
}

function makeInsufficientCreditsMessage(raw: string): string {
  // Try to extract "need X" and "have Y" from the engine message
  const needMatch = raw.match(/need\s+(\d+)/i)
  const haveMatch = raw.match(/have\s+(\d+)/i)
  const need = needMatch ? Number(needMatch[1]) : null
  const have = haveMatch ? Number(haveMatch[1]) : null
  if (need !== null && have !== null) {
    return `You need ${need} credits but have ${have}. Top up your account to continue.`
  }
  return 'You do not have enough credits. Top up your account to continue.'
}

// ─── Creator-safe asset serializer ─────────────────────────────────────────
// Strips providerSlug, modelId, costUsd, routeCategory from creator-visible
// asset objects. Parses JSON columns to native arrays/objects.
export interface CreatorAsset {
  id: string
  type: string
  folder: string
  name: string
  description: string
  url: string
  thumbnailUrl: string
  width: number
  height: number
  duration: number
  prompt: string
  style: string
  aspectRatio: string
  tags: string[]
  isFavorite: boolean
  isUsed: boolean
  usedIn: Array<{ module: string; entityId?: string | null; entityName?: string | null; usedAt: string }>
  createdAt: string
}

export function serializeCreatorAsset(a: {
  id: string
  type: string
  folder: string
  name: string
  description: string
  url: string
  thumbnailUrl: string
  width: number
  height: number
  duration: number
  prompt: string
  style: string
  aspectRatio: string
  tags: string
  isFavorite: boolean
  isUsed: boolean
  usedIn: string
  createdAt: Date
}): CreatorAsset {
  return {
    id: a.id,
    type: a.type,
    folder: a.folder,
    name: a.name,
    description: a.description,
    url: a.url,
    thumbnailUrl: a.thumbnailUrl,
    width: a.width,
    height: a.height,
    duration: a.duration,
    prompt: a.prompt,
    style: a.style,
    aspectRatio: a.aspectRatio,
    tags: safeJsonParse<string[]>(a.tags, []),
    isFavorite: a.isFavorite,
    isUsed: a.isUsed,
    usedIn: safeJsonParse<Array<{ module: string; entityId?: string | null; entityName?: string | null; usedAt: string }>>(a.usedIn, []),
    createdAt: a.createdAt.toISOString(),
  }
}

// ─── BigInt → Number converter (for AiStorage etc.) ────────────────────────
export function bigIntToNumber(v: bigint | null | undefined): number {
  if (v === null || v === undefined) return 0
  return Number(v)
}

// ─── Pagination helper ─────────────────────────────────────────────────────
export function parsePagination(req: { url: string }): { page: number; pageSize: number; skip: number; take: number } {
  const sp = new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize') ?? '20') || 20))
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}
