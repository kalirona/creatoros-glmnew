import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { SuperAdminModule } from '@/components/modules/superadmin'

export const dynamic = 'force-dynamic'

export default async function SuperAdminPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
  }

  if (user.role !== 'SUPER_ADMIN') {
    redirect('/')
  }

  return <SuperAdminModule />
}
