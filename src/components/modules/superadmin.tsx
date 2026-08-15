'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Server, Cpu, ArrowRightLeft, Coins, FileText, BarChart3,
  Lock, BookOpen, Gauge, Activity, DollarSign, ToggleRight, Settings2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi } from '@/hooks/use-api'
import {
  DashboardPanel, ProvidersPanel, ModelsPanel, RoutingPanel,
  CreditsPanel, LogsPanel,
} from '@/components/modules/admin'
import { PromptLibraryPanel, UsageAnalyticsPanel } from '@/components/modules/ai-settings-panels'

type SuperAdminTab = 'overview' | 'providers' | 'models' | 'routing' | 'prompts' | 'credits' | 'usage' | 'logs'

const TABS: { id: SuperAdminTab; label: string; icon: typeof Cpu }[] = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'providers', label: 'Providers', icon: Server },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'routing', label: 'Routing', icon: ArrowRightLeft },
  { id: 'prompts', label: 'Prompts', icon: BookOpen },
  { id: 'credits', label: 'Credits', icon: Coins },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'logs', label: 'Logs', icon: FileText },
]

export function SuperAdminModule() {
  const [tab, setTab] = useState<SuperAdminTab>('overview')

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card">
        <CardContent className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Super Admin</h2>
                <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/20">
                  <ShieldCheck className="h-2.5 w-2.5 mr-1" /> Platform Administration
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                AI infrastructure, providers, models, routing, credits & usage.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SuperAdminTab)}>
        <div className="overflow-x-auto scroll-thin pb-1">
          <TabsList className="flex h-auto gap-1">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <TabsTrigger key={t.id} value={t.id} className="text-sm gap-2 px-3 py-2">
                  <Icon className="h-4 w-4" /> {t.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <TabsContent value="overview"><DashboardPanel onJump={(t) => setTab(t as SuperAdminTab)} /></TabsContent>
        <TabsContent value="providers"><ProvidersPanel /></TabsContent>
        <TabsContent value="models"><ModelsPanel /></TabsContent>
        <TabsContent value="routing"><RoutingPanel /></TabsContent>
        <TabsContent value="prompts"><PromptLibraryPanel /></TabsContent>
        <TabsContent value="credits"><CreditsPanel /></TabsContent>
        <TabsContent value="usage"><UsageAnalyticsPanel /></TabsContent>
        <TabsContent value="logs"><LogsPanel /></TabsContent>
      </Tabs>
    </div>
  )
}
