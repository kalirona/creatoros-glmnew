import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

const SECURITY_SETTING_KEYS = [
  'defaultRateLimitPerMinute',
  'defaultRateLimitPerHour',
  'auditLogRetentionDays',
  'requireApiKeyRotationDays',
] as const

const SECURITY_DEFAULTS: Record<string, string> = {
  defaultRateLimitPerMinute: '60',
  defaultRateLimitPerHour: '600',
  auditLogRetentionDays: '90',
  requireApiKeyRotationDays: '90',
}

// ─── GET — security posture ───────────────────────────────────────────────
export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalKeys,
      activeKeys,
      rotatedInLast30Days,
      providersWithEmptyKey,
      failedAuthAttempts24h,
      totalGenerations,
      defaultWorkspaceGenerations,
      oldestLog,
      securitySettings,
    ] = await Promise.all([
      db.aiProviderKey.count(),
      db.aiProviderKey.count({ where: { isActive: true } }),
      db.aiProviderKey.count({ where: { lastRotatedAt: { gte: last30d } } }),
      // Providers with empty apiKey — security risk
      db.aiProvider.findMany({
        where: { apiKey: '' },
        select: { id: true, name: true, slug: true, capabilities: true, isActive: true },
      }),
      // Failed auth attempts in last 24h (ERROR status)
      db.aiLog.count({
        where: { status: 'ERROR', createdAt: { gte: last24h } },
      }),
      // Total AiGeneration records (for isolation check)
      db.aiGeneration.count(),
      // AiGeneration records still using the default workspaceId
      db.aiGeneration.count({ where: { workspaceId: 'default' } }),
      // Oldest AiLog timestamp (audit log retention baseline)
      db.aiLog.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      // Security settings
      db.adminSetting.findMany({
        where: { category: 'security' },
        select: { key: true, value: true },
      }),
    ])

    // Build security settings object (with defaults fallback)
    const settingsMap = new Map(securitySettings.map((s) => [s.key, s.value]))
    const settings: Record<string, number> = {}
    for (const k of SECURITY_SETTING_KEYS) {
      const v = settingsMap.get(k) ?? SECURITY_DEFAULTS[k]
      settings[k] = Number(v) || 0
    }

    // Isolation % — what % of generations are NOT using the 'default' workspace
    const isolatedCount = totalGenerations - defaultWorkspaceGenerations
    const isolationPercent =
      totalGenerations > 0 ? Math.round((isolatedCount / totalGenerations) * 100) : 100

    return NextResponse.json({
      apiKeys: {
        total: totalKeys,
        active: activeKeys,
        inactive: totalKeys - activeKeys,
        rotatedInLast30Days,
      },
      rateLimit: {
        defaultMaxPerMinute: settings.defaultRateLimitPerMinute,
        defaultMaxPerHour: settings.defaultRateLimitPerHour,
      },
      auditRetention: {
        auditLogRetentionDays: settings.auditLogRetentionDays,
        requireApiKeyRotationDays: settings.requireApiKeyRotationDays,
        oldestLogAt: oldestLog?.createdAt || null,
      },
      providersWithEmptyKey,
      failedAuthAttempts24h,
      workspaceIsolation: {
        totalGenerations,
        defaultWorkspaceGenerations,
        isolatedCount,
        isolationPercent,
      },
    })
  } catch (e) {
    console.error('[admin/security GET]', e)
    return NextResponse.json({ error: 'Failed to load security posture' }, { status: 500 })
  }
}

// ─── PATCH — update security settings (stored in AdminSetting) ────────────
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const updates = body as Record<string, unknown>

    const allowed: Record<string, (v: unknown) => number> = {
      defaultRateLimitPerMinute: (v) => Number(v),
      defaultRateLimitPerHour: (v) => Number(v),
      auditLogRetentionDays: (v) => Number(v),
      requireApiKeyRotationDays: (v) => Number(v),
    }

    const results: Array<{ key: string; value: number }> = []

    for (const [key, coerce] of Object.entries(allowed)) {
      if (!(key in updates)) continue
      const num = coerce(updates[key])
      if (!Number.isFinite(num) || num < 0) {
        return NextResponse.json(
          { error: `${key} must be a non-negative number` },
          { status: 400 }
        )
      }
      // Upsert by unique key
      await db.adminSetting.upsert({
        where: { key },
        create: { key, value: String(num), category: 'security' },
        update: { value: String(num), category: 'security' },
      })
      results.push({ key, value: num })
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'No valid security settings provided' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, updated: results })
  } catch (e) {
    console.error('[admin/security PATCH]', e)
    return NextResponse.json({ error: 'Failed to update security settings' }, { status: 500 })
  }
}
