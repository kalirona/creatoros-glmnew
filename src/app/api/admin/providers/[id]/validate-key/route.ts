import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateRouteCache } from '@/lib/ai-engine'
import { maskApiKey, type ProviderSlug } from '@/lib/provider-gateway'
import { validateProviderKey } from '@/lib/provider-gateway/discovery'
import { requireSuperAdmin } from '@/lib/creator-ai'

export const dynamic = 'force-dynamic'

// ─── POST — validate an API key against the provider ───────────────────────
// Body: { apiKey: string }
// If valid: save the key to provider + create AiProviderKey record + cache bust
// If invalid: return 200 with { valid: false, message } (don't throw — admin
// needs to see the validation error message)
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { id } = await ctx.params
    const body = await req.json()
    const { apiKey } = body as { apiKey?: string }

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
      return NextResponse.json(
        { error: 'apiKey is required (min 8 chars)' },
        { status: 400 }
      )
    }

    const provider = await db.aiProvider.findUnique({ where: { id } })
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const slug = provider.slug as ProviderSlug
    const result = await validateProviderKey(slug, apiKey, provider.baseUrl || undefined)

    if (!result.valid) {
      // Return 200 with valid:false so the admin UI can show the message.
      return NextResponse.json({
        valid: false,
        message: result.message,
        modelsCount: 0,
      })
    }

    // Valid — save the key.
    const now = new Date()

    // 1. Mark any currently-active key as inactive (audit trail).
    await db.aiProviderKey.updateMany({
      where: { providerId: id, isActive: true },
      data: { isActive: false, lastRotatedAt: now },
    })

    // 2. Update provider.apiKey.
    await db.aiProvider.update({
      where: { id },
      data: {
        apiKey,
        quotaRemaining: result.quotaRemaining || '',
        providerVersion: result.providerVersion || '',
        lastSyncAt: now,
      },
    })

    // 3. Create the new active AiProviderKey record.
    await db.aiProviderKey.create({
      data: {
        providerId: id,
        label: 'Primary',
        keyValue: apiKey,
        maskedValue: maskApiKey(apiKey),
        isActive: true,
        lastRotatedAt: now,
      },
    })

    // 4. Bust route cache so engine picks up new key.
    invalidateRouteCache()

    return NextResponse.json({
      valid: true,
      message: result.message,
      modelsCount: result.models?.length || 0,
      quotaRemaining: result.quotaRemaining,
      providerVersion: result.providerVersion,
    })
  } catch (e) {
    console.error('[admin/providers/[id]/validate-key POST]', e)
    return NextResponse.json({ error: 'Failed to validate key' }, { status: 500 })
  }
}
