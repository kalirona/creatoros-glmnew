import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt } = body as { prompt?: string }
    if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

    const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 })

    const cost = 3
    if (user.credits < cost) return NextResponse.json({ error: `Insufficient credits (${cost} required, ${user.credits} available)` }, { status: 402 })

    const zai = await ZAI.create()
    const result = await zai.images.generations.create({
      prompt: prompt.trim(),
      size: '1024x1024',
    }) as any

    const url = result.data?.[0]?.url || result.url || result.base64 || ''
    if (!url) return NextResponse.json({ error: 'AI failed to generate image' }, { status: 502 })

    // Deduct credits
    await db.user.update({ where: { id: user.id }, data: { credits: { decrement: cost } } })
    await db.creditTransaction.create({ data: { userId: user.id, amount: -cost, reason: `AI Image: ${prompt.slice(0, 50)}` } })

    // Save generation
    await db.aiGeneration.create({
      data: {
        userId: user.id,
        toolId: 'image-gen',
        toolSlug: 'IMAGE_GEN',
        title: prompt.slice(0, 80),
        input: prompt,
        output: url,
        status: 'COMPLETED',
        creditsUsed: cost,
      },
    })

    return NextResponse.json({ url, creditsUsed: cost, remainingCredits: user.credits - cost })
  } catch (e) {
    console.error('AI image error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to generate image' }, { status: 500 })
  }
}
