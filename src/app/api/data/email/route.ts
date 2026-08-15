import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const campaigns = await db.emailCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    const subscribers = 12400
    const sent = campaigns.filter((c) => c.status === 'SENT')
    const totalSent = sent.reduce((s, c) => s + c.recipients, 0)
    const avgOpen = sent.length ? sent.reduce((s, c) => s + c.openRate, 0) / sent.length : 0
    const avgClick = sent.length ? sent.reduce((s, c) => s + c.clickRate, 0) / sent.length : 0
    return NextResponse.json({
      stats: { subscribers, campaigns: campaigns.length, totalSent, avgOpen, avgClick },
      campaigns: campaigns.map((c) => ({
        id: c.id, name: c.name, subject: c.subject, previewText: c.previewText, body: c.body,
        type: c.type, status: c.status, audience: c.audience,
        recipients: c.recipients, openRate: c.openRate, clickRate: c.clickRate,
        date: c.createdAt, sentAt: c.sentAt, scheduledAt: c.scheduledAt,
      })),
    })
  } catch (e) {
    console.error('Email list error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// POST — create campaign
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { name, subject, previewText, body: emailBody, type, audience } = body

    if (!name || !name.trim()) return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    if (!subject || !subject.trim()) return NextResponse.json({ error: 'Subject line is required' }, { status: 400 })
    if (!emailBody || !emailBody.trim()) return NextResponse.json({ error: 'Email body is required' }, { status: 400 })

    const validTypes = ['BROADCAST', 'AUTOMATION', 'SEQUENCE']
    const validAudiences = ['ALL', 'STUDENTS', 'CUSTOMERS', 'MEMBERS']
    const campaignType = validTypes.includes(type) ? type : 'BROADCAST'
    const campaignAudience = validAudiences.includes(audience) ? audience : 'ALL'

    // Get first workspace for demo
    const workspace = await db.workspace.findFirst()
    if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })

    const campaign = await db.emailCampaign.create({
      data: {
        workspaceId: workspace.id,
        name: name.trim(),
        subject: subject.trim(),
        previewText: previewText || '',
        body: emailBody,
        type: campaignType,
        audience: campaignAudience,
        status: 'DRAFT',
        recipients: 0,
        openRate: 0,
        clickRate: 0,
      },
    })

    return NextResponse.json({ success: true, campaign: { id: campaign.id, name: campaign.name, status: campaign.status } })
  } catch (e) {
    console.error('Email create error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// PUT — update campaign
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { id, name, subject, previewText, body: emailBody, type, audience, status, scheduledAt } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const existing = await db.emailCampaign.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim()
    if (subject !== undefined) data.subject = subject.trim()
    if (previewText !== undefined) data.previewText = previewText
    if (emailBody !== undefined) data.body = emailBody
    if (type !== undefined) data.type = type
    if (audience !== undefined) data.audience = audience
    if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null

    if (status !== undefined) {
      data.status = status
      if (status === 'SENT') {
        data.sentAt = new Date()
        data.recipients = 12400
        data.openRate = 0.43
        data.clickRate = 0.10
      }
      if (status === 'DRAFT') {
        data.sentAt = null
        data.scheduledAt = null
      }
    }

    const campaign = await db.emailCampaign.update({ where: { id }, data })
    return NextResponse.json({ success: true, campaign: { id: campaign.id, name: campaign.name, status: campaign.status } })
  } catch (e) {
    console.error('Email update error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// DELETE — delete campaign
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await db.emailCampaign.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    await db.emailCampaign.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Email delete error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
