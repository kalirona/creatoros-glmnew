// ============================================================================
// N8N Integration — Audit Logging
// ----------------------------------------------------------------------------
// Logs n8n operations to the AuditLog table.
// Follows existing CreatorOS logging conventions.
//
// Never logs: API keys, secrets, passwords, session tokens, full prompts.
// ============================================================================

import { db } from '@/lib/db'
import type { N8nLogEntry } from './types'

/**
 * Log an n8n operation to AuditLog.
 *
 * Stores: requestId, workflow, userId, workspaceId, duration, success/failure.
 * Does NOT store: payloads (may contain sensitive data), API keys, signatures.
 */
export async function logN8nOperation(entry: N8nLogEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        workspaceId: entry.workspaceId,
        actorId: entry.userId,
        actorRole: 'system', // n8n calls are system-initiated on behalf of the user
        action: `n8n.${entry.workflow}.${entry.success ? 'success' : 'failure'}`,
        targetType: 'n8n_workflow',
        targetId: entry.requestId,
        metadata: JSON.stringify({
          requestId: entry.requestId,
          workflow: entry.workflow,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
          durationMs: entry.durationMs,
          success: entry.success,
          errorCode: entry.errorCode || null,
          // Truncate error message to 200 chars to avoid storing large error pages
          errorMessage: entry.errorMessage ? entry.errorMessage.slice(0, 200) : null,
        }),
      },
    })
  } catch {
    // Logging must never break the request — swallow errors
    // (console.error is fine for debugging)
  }
}

/**
 * Get recent n8n operations from AuditLog (for admin display).
 */
export async function getRecentN8nOperations(limit = 20): Promise<Array<{
  requestId: string
  workflow: string
  userId: string
  durationMs: number
  success: boolean
  errorCode: string | null
  errorMessage: string | null
  createdAt: Date
}>> {
  try {
    const logs = await db.auditLog.findMany({
      where: {
        action: { startsWith: 'n8n.' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        actorId: true,
        action: true,
        targetId: true,
        metadata: true,
        createdAt: true,
      },
    })

    return logs.map((log) => {
      const meta = JSON.parse(log.metadata || '{}') as {
        requestId?: string
        workflow?: string
        durationMs?: number
        success?: boolean
        errorCode?: string
        errorMessage?: string
      }
      return {
        requestId: meta.requestId || log.targetId || '',
        workflow: meta.workflow || log.action.split('.')[1] || 'unknown',
        userId: log.actorId,
        durationMs: meta.durationMs || 0,
        success: meta.success ?? false,
        errorCode: meta.errorCode || null,
        errorMessage: meta.errorMessage || null,
        createdAt: log.createdAt,
      }
    })
  } catch {
    return []
  }
}
