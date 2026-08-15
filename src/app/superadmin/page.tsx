import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { SuperAdminModule } from '@/components/modules/superadmin'

export const dynamic = 'force-dynamic'

export default async function SuperAdminPage() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'))
  }

  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'))
  }

  return <SuperAdminModule />
}
