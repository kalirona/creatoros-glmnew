import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maskApiKey, invalidateRouteCache } from '@/lib/ai-engine'
import { requireSuperAdmin } from '@/lib/creator-ai'
export const dynamic = 'force-dynamic'

// ─── POST — rotate a provider's API key ────────────────────────────────────
// Body: { newKey: string }
// Steps:
//   1. Save the OLD key's masked value into an AiProviderKey audit record
//      (isActive=false, lastRotatedAt=now, rotatedFrom=old masked).
//   2. Update provider.apiKey = newKey.
//   3. Set lastRotatedAt on the new active AiProviderKey (create one if none).
//   4. Bust route cache.
//   5. Return masked new key + timestamp.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { id } = await ctx.params
    const body = await req.json()
    const { newKey } = body as { newKey?: string }

    if (!newKey || typeof newKey !== 'string' || newKey.trim().length < 8) {
      return NextResponse.json(
        { error: 'newKey is required (min 8 chars)' },
        { status: 400 }
      )
    }

    const provider = await db.aiProvider.findUnique({
      where: { id },
      include: { keys: { orderBy: { createdAt: 'desc' } } },
    })
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const now = new Date()
    const oldMasked = maskApiKey(provider.apiKey)

    // 1. Mark any currently-active key as inactive (audit trail). Keep a single
    //    audit record representing the rotated-from key.
    const activeKeys = provider.keys.filter((k) => k.isActive)
    if (activeKeys.length > 0) {
      await db.aiProviderKey.updateMany({
        where: { providerId: id, isActive: true },
        data: { isActive: false, lastRotatedAt: now },
      })
      // Promote the most recent one into an audit record
      const mostRecent = activeKeys[0]
      await db.aiProviderKey.update({
        where: { id: mostRecent.id },
        data: { rotatedFrom: oldMasked },
      })
    } else if (provider.apiKey) {
      // No AiProviderKey records exist yet — create an audit row for the old key
      await db.aiProviderKey.create({
        data: {
          providerId: id,
          label: 'Rotated (legacy)',
          keyValue: provider.apiKey,
          maskedValue: oldMasked,
          isActive: false,
          lastRotatedAt: now,
          rotatedFrom: null,
        },
      })
    }

    // 2. Update the provider's apiKey
    await db.aiProvider.update({
      where: { id },
      data: { apiKey: newKey },
    })

    // 3. Create (or update) the new active key record
    const newMasked = maskApiKey(newKey)
    await db.aiProviderKey.create({
      data: {
        providerId: id,
        label: 'Primary',
        keyValue: newKey,
        maskedValue: newMasked,
        isActive: true,
        lastRotatedAt: now,
        rotatedFrom: oldMasked,
      },
    })

    // 4. Bust route cache so the engine picks up the new key
    invalidateRouteCache()

    return NextResponse.json({
      success: true,
      maskedApiKey: newMasked,
      rotatedAt: now,
    })
  } catch (e) {
    console.error('[admin/providers/[id]/rotate-key POST]', e)
    return NextResponse.json({ error: 'Failed to rotate key' }, { status: 500 })
  }
}
