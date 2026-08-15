// ============================================================================
// Creator AI API helpers — shared utilities for creator-facing AI routes.
// ----------------------------------------------------------------------------
// Lives outside src/lib/ai-engine/ on purpose (that library is admin-owned).
// Use these to keep creator responses free of provider/model/cost info.
// ============================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

// ─── Super Admin authorization ─────────────────────────────────────────────
// All admin API routes (src/app/api/admin/**) MUST call this at the top of
// every handler. It resolves the authenticated Clerk user and verifies their
// role is SUPER_ADMIN. If not, it returns a 403 NextResponse.
//
// This uses getCurrentUser() (Clerk → CreatorOS identity bridge) — NOT
// Clerk is the only authentication source.

export interface SuperAdminAuth {
  user: { id: string; email: string; name: string; role: string } | null
  error: NextResponse | null
}

export async function requireSuperAdmin(): Promise<SuperAdminAuth> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 }),
    }
  }
  if (user.role !== 'SUPER_ADMIN') {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Super Admin access required. This action is restricted to platform administrators.' },
        { status: 403 },
      ),
    }
  }
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    error: null,
  }
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
  // No model/provider available — show the actual message so the user knows what to do
  if (
    lower.includes('no enabled model') ||
    lower.includes('no enabled image') ||
    lower.includes('no enabled video') ||
    lower.includes('no available ai provider') ||
    lower.includes('no ai provider') ||
    lower.includes('no image provider') ||
    lower.includes('no video provider') ||
    lower.includes('no active')
  ) {
    return {
      status: 503,
      message: msg, // Show the actual error — tells admin to approve a model
    }
  }
  // Provider-specific errors (API key, adapter, provider name) — sanitize
  if (
    lower.includes('api key') ||
    lower.includes('openrouter') ||
    lower.includes('fal') ||
    lower.includes('elevenlabs') ||
    lower.includes('deepgram') ||
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
