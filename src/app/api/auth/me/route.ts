// ============================================================================
// GET /api/auth/me — Current authenticated user identity
// ----------------------------------------------------------------------------
// Uses getCurrentUser() (the Clerk → CreatorOS identity bridge) to resolve
// the authenticated Clerk user to a CreatorOS User record.
//
// Responses:
//   200 — Authenticated, returns safe application identity
//   401 — Not authenticated (no Clerk session)
//   409 — Clerk ID conflict (email linked to different Clerk account)
//   400 — Clerk user has no primary email
//   502 — Clerk API error
//
// This endpoint does NOT:
//   - Expose Clerk API keys or secrets
//   - Expose password hashes (none exist)
//   - Expose session tokens
//   - Modify any data (getCurrentUser handles linking/creation on first login)
// ============================================================================

import { NextResponse } from 'next/server'
import { getCurrentUser, AuthError } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated. Please sign in to continue.' },
        { status: 401 },
      )
    }

    // Return ONLY safe application identity information.
    // Never expose: passwords (none), session tokens, Clerk API keys, etc.
    return NextResponse.json({
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      credits: user.credits,
      activeWorkspaceId: user.activeWorkspaceId,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode },
      )
    }

    console.error('[/api/auth/me] unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred while resolving your identity.' },
      { status: 500 },
    )
  }
}
