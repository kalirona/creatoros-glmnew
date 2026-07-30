'use client'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ApiErrorBanner({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Card className="border-rose-500/30 bg-rose-500/5">
      <CardContent className="p-6 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 mb-3">
          <AlertCircle className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold">Failed to load</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{message || 'Something went wrong. Please try again.'}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function ModuleEmptyState({ icon: Icon, title, hint, action }: { icon: React.ComponentType<{ className?: string }>; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-10 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
          <Icon className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{hint}</p>}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  )
}
