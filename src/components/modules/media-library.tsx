'use client'
import { FolderOpen, Plus, Image as ImageIcon, Video, FileText, Download, MoreVertical, Trash2, Copy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi } from '@/hooks/use-api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ApiErrorBanner, ModuleEmptyState } from '@/components/modules/_state-utils'

interface FileAsset {
  id: string; name: string; type: string; size: string; url: string; createdAt: string
}

export function MediaLibraryModule() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage images, videos, and files for your courses and products.</p>
        <Button size="sm" onClick={() => toast.info('Upload', { description: 'Drag and drop files or click to browse.' })}>
          <Plus className="h-4 w-4 mr-1.5" /> Upload
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Images', value: '24', icon: ImageIcon, color: 'text-sky-600 bg-sky-500/10' },
          { label: 'Videos', value: '8', icon: Video, color: 'text-violet-600 bg-violet-500/10' },
          { label: 'Documents', value: '12', icon: FileText, color: 'text-amber-600 bg-amber-500/10' },
          { label: 'Storage', value: '1.2 GB', icon: FolderOpen, color: 'text-emerald-600 bg-emerald-500/10' },
        ].map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', s.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {[
          { name: 'course-thumbnail.jpg', type: 'image', size: '2.4 MB', color: 'from-sky-500/20 to-cyan-500/10' },
          { name: 'lesson-video.mp4', type: 'video', size: '124 MB', color: 'from-violet-500/20 to-fuchsia-500/10' },
          { name: 'worksheet.pdf', type: 'doc', size: '1.2 MB', color: 'from-amber-500/20 to-orange-500/10' },
          { name: 'template.zip', type: 'doc', size: '8.5 MB', color: 'from-emerald-500/20 to-teal-500/10' },
          { name: 'promo-image.png', type: 'image', size: '1.8 MB', color: 'from-rose-500/20 to-pink-500/10' },
          { name: 'intro-video.mp4', type: 'video', size: '56 MB', color: 'from-indigo-500/20 to-purple-500/10' },
        ].map((file, i) => {
          const Icon = file.type === 'image' ? ImageIcon : file.type === 'video' ? Video : FileText
          return (
            <Card key={i} className="overflow-hidden group hover:shadow-lg transition cursor-pointer">
              <div className={cn('relative h-24 bg-gradient-to-br flex items-center justify-center', file.color)}>
                <Icon className="h-8 w-8 text-foreground/30" />
              </div>
              <CardContent className="p-2.5">
                <p className="text-xs font-medium truncate">{file.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-muted-foreground">{file.size}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toast.success('File downloaded')}>
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
