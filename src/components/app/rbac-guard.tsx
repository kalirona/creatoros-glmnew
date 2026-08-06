'use client'
import { useAppStore } from '@/store/app-store'
import { canAccessModule, type ModuleId } from '@/lib/nav'
import { ShieldX } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface RbacGuardProps {
  moduleId: ModuleId
  children: React.ReactNode
}

/**
 * RBAC Guard — wraps platform modules (AI Settings, System Settings).
 * If the current user is not SUPER_ADMIN, renders a 403 page instead.
 */
export function RbacGuard({ moduleId, children }: RbacGuardProps) {
  const userRole = useAppStore((s) => s.userRole)
  const navigateTo = useAppStore((s) => s.navigateTo)

  if (canAccessModule(moduleId, userRole)) {
    return <>{children}</>
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <Card className="max-w-md w-full border-destructive/30">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Access Denied</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You don&apos;t have permission to access this page. This area is restricted to Super Admins only.
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium">Your role: <span className="font-mono">{userRole}</span></p>
            <p className="mt-1">Required role: <span className="font-mono">SUPER_ADMIN</span></p>
          </div>
          <Button onClick={() => navigateTo('dashboard')} variant="outline" className="w-full">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
