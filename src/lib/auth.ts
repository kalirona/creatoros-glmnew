// ============================================================================
// Clerk → CreatorOS Identity Bridge
// ----------------------------------------------------------------------------
// Server-side helper that resolves the authenticated Clerk user to a CreatorOS
// User record. This is the identity bridge between Clerk (authentication)
// and CreatorOS (application data).
//
// CRITICAL INVARIANTS:
//   1. CreatorOS User.id is NEVER replaced by Clerk's userId.
//   2. Clerk's userId is stored ONLY in User.clerkId.
//   3. Existing User records are linked (not duplicated) by email match.
//   4. CreatorOS role/credits/bio are NEVER overwritten by Clerk data.
//   5. This function does NOT fall back to demo identity — if there's no
//      Clerk session, it returns null. Callers that need fallback behavior
//      must implement it explicitly.
//
// ARCHITECTURE:
//   Clerk session → auth() → Clerk userId
//     → lookup User by clerkId
//       → found: return existing User (Case A)
//       → not found: lookup User by email
//         → found: link clerkId, return User (Case B)
//         → not found: create new User from Clerk data (Case C)
//
// Clerk identity bridge. All API routes now use getCurrentUser().
// ============================================================================

import 'server-only'

import { auth, currentUser as clerkCurrentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

// ─── Types ──────────────────────────────────────────────────────────────────

/** The CreatorOS User record with the fields needed by the application. */
export interface CurrentUser {
  id: string           // CreatorOS User ID (never Clerk's)
  clerkId: string | null
  email: string
  name: string
  avatarUrl: string | null
  role: string         // CreatorOS-owned: SUPER_ADMIN | OWNER | MEMBER | etc.
  credits: number      // CreatorOS-owned
  bio: string | null   // CreatorOS-owned
  activeWorkspaceId: string | null
  workspaceId: string  // Resolved workspace ID (from membership or first workspace)
}

/** Error codes the identity bridge can produce. */
export type AuthErrorCode =
  | 'UNAUTHENTICATED'       // No Clerk session
  | 'NO_EMAIL'              // Clerk user has no usable primary email
  | 'CLERK_ID_CONFLICT'     // clerkId already assigned to a different User
  | 'CLERK_API_ERROR'       // Error calling Clerk's API

/** Structured error thrown by getCurrentUser() on non-recoverable failures. */
export class AuthError extends Error {
  readonly code: AuthErrorCode
  readonly statusCode: number

  constructor(code: AuthErrorCode, message: string, statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.statusCode = statusCode
  }
}

// ─── Main Resolver ──────────────────────────────────────────────────────────

/**
 * Resolve the authenticated Clerk user to a CreatorOS User record.
 *
 * Returns null if there is no Clerk session (unauthenticated).
 * Throws AuthError on non-recoverable failures (conflict, no email, API error).
 *
 * This function is SAFE to call repeatedly — it won't create duplicate users
 * or overwrite existing data. On second login, the clerkId lookup finds the
 * existing User immediately (Case A).
 *
 * Usage:
 *   import { getCurrentUser } from '@/lib/auth'
 *   const user = await getCurrentUser()
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *   // use user.id, user.role, user.credits, etc.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // 1. Get the Clerk session's userId
  const session = await auth()
  const clerkUserId = session.userId

  // No Clerk session → unauthenticated
  if (!clerkUserId) {
    return null
  }

  // 2. Fetch the full Clerk user object (for email, name, avatar)
  //    currentUser() calls auth() internally, then fetches the user from Clerk's API.
  //    Returns null if no session or session is pending.
  let clerkUser: Awaited<ReturnType<typeof clerkCurrentUser>>
  try {
    clerkUser = await clerkCurrentUser()
  } catch (err) {
    throw new AuthError(
      'CLERK_API_ERROR',
      `Failed to fetch Clerk user: ${err instanceof Error ? err.message : 'unknown error'}`,
      502,
    )
  }

  // If currentUser() returns null, the session is invalid or pending
  if (!clerkUser) {
    return null
  }

  // 3. Case A: Look up CreatorOS User by clerkId (fast path for returning users)
  const existingByClerkId = await db.user.findUnique({
    where: { clerkId: clerkUserId },
  })

  if (existingByClerkId) {
    return await toCurrentUser(existingByClerkId)
  }

  // 4. Get the Clerk user's primary email address
  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress

  // Case E: Clerk user has no usable primary email
  if (!primaryEmail) {
    throw new AuthError(
      'NO_EMAIL',
      'Your Clerk account does not have a verified primary email address. Please add an email in your Clerk account settings.',
      400,
    )
  }

  // 5. Case B: Look up CreatorOS User by email (link existing account)
  const existingByEmail = await db.user.findUnique({
    where: { email: primaryEmail },
  })

  if (existingByEmail) {
    // Case D: Check if this User's clerkId is already set to a DIFFERENT Clerk user
    // (This shouldn't happen because we already checked by clerkId above, but
    // we guard against race conditions and data integrity issues.)
    if (existingByEmail.clerkId && existingByEmail.clerkId !== clerkUserId) {
      throw new AuthError(
        'CLERK_ID_CONFLICT',
        `Email ${primaryEmail} is already linked to a different Clerk account. Please contact support.`,
        409,
      )
    }

    // Link the existing CreatorOS User to this Clerk user.
    // ONLY update clerkId — preserve id, role, credits, bio, everything else.
    const linked = await db.user.update({
      where: { id: existingByEmail.id },
      data: { clerkId: clerkUserId },
    })

    return await toCurrentUser(linked)
  }

  // 6. Case C: No existing CreatorOS User — create a new one from Clerk data
  //    Only set identity fields from Clerk (clerkId, email, name, avatarUrl).
  //    All other fields use their Prisma defaults (role=MEMBER, credits=500, etc.)
  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim()
  const name = fullName || clerkUser.username || primaryEmail.split('@')[0]

  const created = await db.user.create({
    data: {
      clerkId: clerkUserId,
      email: primaryEmail,
      name,
      avatarUrl: clerkUser.imageUrl || null,
      // role, credits, bio — use Prisma defaults (MEMBER, 500, null)
    },
  })

  return await toCurrentUser(created)
}

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * Map a Prisma User row to the CurrentUser interface.
 * Resolves the user's workspace from activeWorkspaceId, or falls back to
 * their first WorkspaceMember entry, or the first workspace in the DB.
 */
async function toCurrentUser(user: {
  id: string
  clerkId: string | null
  email: string
  name: string
  avatarUrl: string | null
  role: string
  credits: number
  bio: string | null
  activeWorkspaceId: string | null
}): Promise<CurrentUser> {
  // Resolve workspaceId: activeWorkspaceId → first membership → first workspace
  let workspaceId = user.activeWorkspaceId
  if (!workspaceId) {
    const membership = await db.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    })
    workspaceId = membership?.workspaceId || null
  }
  if (!workspaceId) {
    const firstWs = await db.workspace.findFirst({ select: { id: true } })
    workspaceId = firstWs?.id || 'default'
  }

  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    credits: user.credits,
    bio: user.bio,
    activeWorkspaceId: user.activeWorkspaceId,
    workspaceId,
  }
}
