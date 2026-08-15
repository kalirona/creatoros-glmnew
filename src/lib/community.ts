import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// Workspace resolver — resolves the active workspace + user for the current request.
// Uses getCurrentUser() (Clerk → CreatorOS identity bridge) for real authentication.

export interface ResolvedContext {
  user: {
    id: string
    email: string
    name: string
    avatarUrl: string | null
    role: string
    credits: number
  }
  workspaceId: string
  workspaceRole: string
  memberId: string
}

export async function getContext(): Promise<ResolvedContext | null> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const membership = await db.workspaceMember.findFirst({
    where: { userId: currentUser.id, workspaceId: currentUser.workspaceId },
  })

  if (!membership) {
    // User has no membership in this workspace — try any workspace
    const fallback = await db.workspaceMember.findFirst({
      where: { userId: currentUser.id },
    })
    if (!fallback) return null
    return {
      user: {
        id: currentUser.id, email: currentUser.email, name: currentUser.name,
        avatarUrl: currentUser.avatarUrl, role: currentUser.role, credits: currentUser.credits,
      },
      workspaceId: fallback.workspaceId,
      workspaceRole: fallback.role,
      memberId: fallback.id,
    }
  }

  return {
    user: {
      id: currentUser.id, email: currentUser.email, name: currentUser.name,
      avatarUrl: currentUser.avatarUrl, role: currentUser.role, credits: currentUser.credits,
    },
    workspaceId: currentUser.workspaceId,
    workspaceRole: membership.role,
    memberId: membership.id,
  }
}

// ─── Permission checks ─────────────────────────────────────────────────────

const ROLE_LEVELS: Record<string, number> = {
  GUEST: 0, AFFILIATE: 1, STUDENT: 2, MEMBER: 3,
  MODERATOR: 4, INSTRUCTOR: 5, MANAGER: 6, ADMIN: 7, OWNER: 8,
}

export function roleLevel(role: string): number {
  return ROLE_LEVELS[role] ?? 3
}

export function canManageMembers(role: string): boolean {
  return ['OWNER', 'ADMIN'].includes(role)
}

export function canModerate(role: string): boolean {
  return ['OWNER', 'ADMIN', 'MODERATOR'].includes(role)
}

export function canActOnMember(
  actorRole: string,
  targetRole: string,
  action: 'promote' | 'demote' | 'remove' | 'ban' | 'suspend' | 'mute' | 'warn'
): { allowed: boolean; reason?: string } {
  if (targetRole === 'OWNER') return { allowed: false, reason: 'Cannot act on the workspace owner' }
  if (action === 'promote' || action === 'demote' || action === 'remove' || action === 'ban' || action === 'suspend') {
    if (!canManageMembers(actorRole)) return { allowed: false, reason: 'Only owners and admins can manage members' }
  }
  const actorLevel = roleLevel(actorRole)
  const targetLevel = roleLevel(targetRole)
  if (targetLevel >= actorLevel) return { allowed: false, reason: 'Cannot act on a member of equal or higher role' }
  if (action === 'promote' && targetLevel + 1 >= actorLevel) return { allowed: false, reason: 'Cannot promote to your own level or above' }
  return { allowed: true }
}

// ─── Audit logging ─────────────────────────────────────────────────────────

export async function writeAuditLog(
  ctx: ResolvedContext,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        actorId: ctx.user.id,
        actorRole: ctx.workspaceRole,
        action,
        targetType: targetType || null,
        targetId: targetId || null,
        metadata: JSON.stringify(metadata || {}),
      },
    })
  } catch (e) {
    console.error('[audit] Failed:', e)
  }
}

// ─── Notification helper ───────────────────────────────────────────────────

export async function sendNotification(
  userId: string,
  workspaceId: string,
  type: string,
  title: string,
  body?: string,
  actorId?: string,
  entityId?: string,
  entityType?: string
): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId, workspaceId, type, title,
        body: body || '', link: '',
        actorId: actorId || null,
        entityId: entityId || null,
        entityType: entityType || null,
      },
    })
  } catch (e) {
    console.error('[notify] Failed:', e)
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────

export function sanitizeString(s: string, maxLength = 5000): string {
  return (s || '').slice(0, maxLength).trim()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function generateToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function paginate(page: number, pageSize: number, total: number) {
  const safePage = Math.max(1, page)
  const safeSize = Math.min(100, Math.max(1, pageSize))
  const skip = (safePage - 1) * safeSize
  const take = safeSize
  const totalPages = Math.ceil(total / safeSize)
  return { skip, take, page: safePage, pageSize: safeSize, totalPages, total }
}

export function safeJsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) as T } catch { return fallback }
}
