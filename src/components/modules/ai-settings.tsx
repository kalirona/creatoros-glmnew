'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Cpu, Gauge, Server, KeyRound, ArrowRightLeft, Coins, ClipboardList,
  Activity, FileText, DollarSign, Lock, BookOpen, ToggleRight, BarChart3,
  ShieldCheck, Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi, formatNumber } from '@/hooks/use-api'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
// Reuse existing panels from admin.tsx (no duplication)
import {
  DashboardPanel, ProvidersPanel, ApiKeysPanel, ModelsPanel, RoutingPanel,
  CreditsPanel, JobsPanel, MonitoringPanel, LogsPanel, CostsPanel, SecurityPanel,
} from '@/components/modules/admin'
// New panels unique to AI Settings
import { PromptLibraryPanel, AiFeaturesPanel, UsageAnalyticsPanel } from '@/components/modules/ai-settings-panels'

type AiTab = 'dashboard' | 'providers' | 'keys' | 'models' | 'routing' | 'credits' | 'prompts' | 'features' | 'logs' | 'usage' | 'security'

const TABS: { id: AiTab; label: string; icon: typeof Cpu }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'providers', label: 'Providers', icon: Server },
  { id: 'keys', label: 'API Keys', icon: KeyRound },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'routing', label: 'Routing', icon: ArrowRightLeft },
  { id: 'credits', label: 'Credits', icon: Coins },
  { id: 'prompts', label: 'Prompt Library', icon: BookOpen },
  { id: 'features', label: 'AI Features', icon: ToggleRight },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'security', label: 'Security', icon: Lock },
]

export function AiSettingsModule() {
  const { activeSubTab } = useAppStore()
  const [tab, setTab] = useState<AiTab>('dashboard')

  useEffect(() => {
    if (activeSubTab) {
      const valid: string[] = ['dashboard', 'providers', 'keys', 'models', 'routing', 'credits', 'prompts', 'features', 'logs', 'usage', 'security']
      if (valid.includes(activeSubTab)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTab(activeSubTab as AiTab)
      }
    }
  }, [activeSubTab])

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card">
        <CardContent className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30">
              <Cpu className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">AI Settings</h2>
                <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/20">
                  <ShieldCheck className="h-2.5 w-2.5 mr-1" /> Super Admin
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Manage AI providers, models, routing, credits, prompt library, features, logs &amp; security.
              </p>
            </div>
          </div>
          <EngineStatusBadge />
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as AiTab)}>
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

        <TabsContent value="dashboard"><DashboardPanel onJump={(t) => setTab(t as AiTab)} /></TabsContent>
        <TabsContent value="providers"><ProvidersPanel /></TabsContent>
        <TabsContent value="keys"><ApiKeysPanel /></TabsContent>
        <TabsContent value="models"><ModelsPanel /></TabsContent>
        <TabsContent value="routing"><RoutingPanel /></TabsContent>
        <TabsContent value="credits"><CreditsPanel /></TabsContent>
        <TabsContent value="prompts"><PromptLibraryPanel /></TabsContent>
        <TabsContent value="features"><AiFeaturesPanel /></TabsContent>
        <TabsContent value="logs"><LogsPanel /></TabsContent>
        <TabsContent value="usage"><UsageAnalyticsPanel /></TabsContent>
        <TabsContent value="security"><SecurityPanel /></TabsContent>
      </Tabs>
    </div>
  )
}

function EngineStatusBadge() {
  const { data, loading } = useApi<{ providers: { active: number; total: number } }>('/api/admin/monitoring')
  if (loading || !data) return null
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> AI Engine Online
      </span>
      <span className="hidden sm:inline">{data.providers.active}/{data.providers.total} providers active</span>
    </div>
  )
}
