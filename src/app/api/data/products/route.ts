import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const products = await db.product.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(products.map((p) => ({
      id: p.id, name: p.name, description: p.description, type: p.type, price: p.price,
      compareAt: p.compareAt, salesCount: p.salesCount, rating: p.rating, status: p.status,
      coverUrl: p.coverUrl, fileUrl: p.fileUrl, createdAt: p.createdAt,
      revenue: p.salesCount * p.price,
    })))
  } catch (e) {
    console.error('Products list error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// POST — create product
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { name, description, type, price, compareAt, coverUrl, fileUrl, status } = body

    if (!name || !name.trim()) return NextResponse.json({ error: 'Product name is required' }, { status: 400 })

    const workspace = await db.workspace.findFirst()
    if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })

    const product = await db.product.create({
      data: {
        workspaceId: workspace.id,
        name: name.trim(),
        description: description || '',
        type: type || 'DIGITAL',
        price: parseFloat(price) || 0,
        compareAt: compareAt ? parseFloat(compareAt) : null,
        coverUrl: coverUrl || null,
        fileUrl: fileUrl || null,
        status: status || 'DRAFT',
      },
    })

    return NextResponse.json({ success: true, product: { id: product.id, name: product.name, status: product.status } })
  } catch (e) {
    console.error('Product create error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// PUT — update product
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body = await req.json()
    const { id, name, description, type, price, compareAt, coverUrl, fileUrl, status } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim()
    if (description !== undefined) data.description = description
    if (type !== undefined) data.type = type
    if (price !== undefined) data.price = parseFloat(price) || 0
    if (compareAt !== undefined) data.compareAt = compareAt ? parseFloat(compareAt) : null
    if (coverUrl !== undefined) data.coverUrl = coverUrl || null
    if (fileUrl !== undefined) data.fileUrl = fileUrl || null
    if (status !== undefined) data.status = status

    const product = await db.product.update({ where: { id }, data })
    return NextResponse.json({ success: true, product: { id: product.id, name: product.name, status: product.status } })
  } catch (e) {
    console.error('Product update error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// DELETE — delete product
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    await db.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Product delete error:', e)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
