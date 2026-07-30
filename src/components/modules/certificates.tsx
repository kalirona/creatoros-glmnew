'use client'
import { Award, Plus, Download, Eye, Trash2, MoreVertical } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function CertificatesModule() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Issue certificates to students who complete your courses.</p>
        <Button size="sm" onClick={() => toast.info('Certificate builder', { description: 'Design custom certificates for your courses.' })}>
          <Plus className="h-4 w-4 mr-1.5" /> New Template
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { name: 'Course Completion', course: 'AI Faceless YouTube', issued: 42, color: 'from-emerald-500/20 to-teal-500/10' },
          { name: 'Mastery Certificate', course: 'Notion Creator OS', issued: 128, color: 'from-violet-500/20 to-fuchsia-500/10' },
          { name: 'Pro Certificate', course: 'Email Marketing', issued: 67, color: 'from-amber-500/20 to-orange-500/10' },
        ].map((cert, i) => (
          <Card key={i} className="overflow-hidden hover:shadow-lg transition">
            <div className={cn('relative h-32 bg-gradient-to-br flex items-center justify-center', cert.color)}>
              <Award className="h-12 w-12 text-foreground/30" />
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm">{cert.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{cert.course}</p>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">{cert.issued} issued</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toast.info('Preview certificate')}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toast.success('Certificate downloaded')}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
