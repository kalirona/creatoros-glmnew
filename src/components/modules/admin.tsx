'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Server, Cpu, KeyRound, Database, Activity, DollarSign,
  LineChart, Lock, ToggleLeft, Layers, Zap, History, Settings2, Sliders,
  Loader2, Eye, EyeOff, Check, AlertCircle, AlertTriangle, RefreshCw, Save,
  Plus, Filter, Search, ChevronLeft, ChevronRight, Globe, Boxes, Gauge,
  Rocket, FileText, ListChecks, HardDrive, Clock, TrendingUp, TrendingDown,
  CircleDot, Wifi, WifiOff, UserCheck, Coins, BarChart3, ShieldAlert,
  KeySquare, ArrowRightLeft, ClipboardList, PlayCircle, XCircle, Eye as EyeIcon,
  // Provider Gateway UI icons
  Brain, Image as ImageIcon, Video as VideoIcon, Mic, Volume2, Puzzle,
  Star, ExternalLink, Terminal, Send, Play,
  CheckCircle2, Sparkles, Cable, Settings, BookOpen, Stethoscope, ServerCog,
  Plug, PlugZap, RefreshCcw, Timer, Workflow, Building2, Wrench,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useApi, formatNumber, timeAgo } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { PROVIDER_REGISTRY, getProviderMeta, type ProviderMeta, type AuthType } from '@/lib/provider-gateway'

/* ============================================================================
 * Types — API response contracts (mirror Task 3a backend shapes)
 * ========================================================================== */

interface ProviderModel {
  id: string
  name: string
  displayName: string
  modality: string
  isDefault: boolean
  costMultiplier: number
  inputCostPer1k: number
  outputCostPer1k: number
  isActive: boolean
  // Extended gateway fields (optional — backend may not return all)
  contextWindow?: number
  supportsVision?: boolean
  supportsImage?: boolean
  supportsAudio?: boolean
  supportsVideo?: boolean
  supportsEmbeddings?: boolean
  supportsStreaming?: boolean
  supportsJson?: boolean
  supportsToolCalling?: boolean
  supportsReasoning?: boolean
  providerTags?: string[]
  isCustomPricing?: boolean
  lastSyncedAt?: string | null
}

interface Provider {
  id: string
  name: string
  slug: string
  capabilities: string
  isActive: boolean
  isHealthy: boolean
  priority: number
  dailyBudget: number
  monthlyBudget: number
  dailyRequests: number
  monthlyRequests: number
  lastHealthCheck: string | null
  description: string | null
  docsUrl: string | null
  maskedApiKey: string
  modelsCount: number
  keysCount: number
  activeKeysCount: number
  todayCost: number
  todayRequests: number
  todayFailures: number
  models: ProviderModel[]
  // Extended gateway fields (optional — backend may not return all)
  authType?: string
  headers?: string | Record<string, string> | null
  logoUrl?: string | null
  providerVersion?: string | null
  lastSyncAt?: string | null
  quotaRemaining?: string | null
  latencyMs?: number | null
  defaultStrategy?: string | null
  baseUrl?: string | null
  webhookSecret?: string | null
  timeout?: number
  retries?: number
  concurrency?: number
  fallbackProviderId?: string | null
}

// ─── Enterprise gateway types (mirror Task 3a backend shapes) ─────────────
interface TestConnectionResult {
  status?: 'healthy' | 'degraded' | 'down' | string
  latencyMs?: number
  testsRun?: string[]
  testsPassed?: string[]
  providerVersion?: string
  quotaRemaining?: string
  modelCount?: number
  error?: string
  success?: boolean
  message?: string
}

interface TestPromptResult {
  success: boolean
  response?: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  latencyMs?: number
  error?: string
}

interface SyncModelsResult {
  success?: boolean
  status?: 'success' | 'partial' | 'failed' | string
  modelsFound?: number
  modelsAdded?: number
  modelsUpdated?: number
  modelsRemoved?: number
  modelsKept?: number
  durationMs?: number
  error?: string
  message?: string
}

interface ValidateKeyResult {
  valid: boolean
  message?: string
  modelsCount?: number
  quotaRemaining?: string
  providerVersion?: string
}

interface ProviderUsage {
  requests?: number
  successRate?: number
  avgLatencyMs?: number
  dailyCost?: number
  monthlyCost?: number
  creditsUsed?: number
  failures?: number
  topModels?: Array<{ modelId: string; name?: string; requests: number; cost: number }>
  mostUsedFeatures?: Array<{ category: string; requests: number }>
}

interface ProviderKey {
  id: string
  providerId: string
  label: string
  maskedValue: string
  isActive: boolean
  lastUsedAt: string | null
  lastRotatedAt: string | null
  rotatedFrom: string | null
  createdAt: string
}

interface ModelRow {
  id: string
  name: string
  displayName: string
  modality: string
  isDefault: boolean
  costMultiplier: number
  inputCostPer1k: number
  outputCostPer1k: number
  isActive: boolean
  provider: { id: string; name: string; slug: string; isActive: boolean }
}

interface RouteRow {
  id: string
  toolCategory: string
  providerId: string | null
  fallbackProviderId: string | null
  modelId: string | null
  strategy: string
  weight: number
  isActive: boolean
  provider: { id: string; name: string; slug: string; isActive: boolean } | null
  fallbackProvider: { id: string; name: string; slug: string; isActive: boolean } | null
  model: { id: string; name: string; displayName: string; modality: string } | null
}

interface JobRow {
  id: string
  type: string
  prompt: string
  params: string
  status: string
  progress: number
  externalId: string | null
  resultUrl: string
  errorMessage: string
  creditsUsed: number
  costUsd: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  provider: { id: string; name: string; slug: string } | null
  user: { id: string; name: string | null; avatarUrl: string | null; email: string | null } | null
}

interface JobStats {
  queued: number
  rendering: number
  processing: number
  completed: number
  failed: number
  cancelled: number
  totalToday: number
}

interface LogRow {
  id: string
  requestType: string
  toolSlug: string
  routeCategory: string
  status: string
  errorCode: string
  errorMessage: string
  durationMs: number
  inputTokens: number
  outputTokens: number
  creditsUsed: number
  costUsd: number
  createdAt: string
  provider: { id: string; name: string; slug: string } | null
  user: { id: string; name: string | null; avatarUrl: string | null; email: string | null } | null
}

interface MonitoringData {
  timestamp: string
  providers: { active: number; total: number }
  today: { requests: number; successRate: number; costUsd: number; avgLatencyMs: number }
  perProviderHealth: Array<{
    id: string; name: string; slug: string; isHealthy: boolean
    lastHealthCheck: string | null
    todayCost: number; todayRequests: number; todayFailures: number
  }>
  topFailingTools: Array<{ toolSlug: string; count: number }>
  rateLimitedLastHour: number
  storage: { totalBytes: number; workspaceCount: number }
}

interface CostData {
  today: { totalCostUsd: number; requests: number; failures: number }
  thisMonth: { totalCostUsd: number; requests: number; failures: number }
  dailySeries: Array<{ day: string; totalCostUsd: number; requests: number; failures: number }>
  perProviderBreakdown: Array<{
    providerId: string; name: string; slug: string
    todayCost: number; todayRequests: number; todayFailures: number
    dailyBudget: number; budgetExceeded: boolean
  }>
  budgetAlerts: Array<{
    providerId: string; name: string; slug: string
    level: 'warning' | 'critical'
    todayCost: number; dailyBudget: number; message: string
  }>
}

interface StorageWorkspace {
  workspaceId: string
  imagesBytes: number
  videosBytes: number
  audioBytes: number
  documentsBytes: number
  totalBytes: number
  quotaBytes: number
  assetCount: number
  usagePercent: number
  updatedAt: string
}

interface StorageData {
  workspaces: StorageWorkspace[]
  totals: {
    images: number; videos: number; audio: number
    documents: number; total: number; quota: number
    assets: number; usagePercent: number; workspaceCount: number
  }
}

interface CreditsData {
  summary: {
    totalIssued: number; issuedCount: number
    totalSpent: number; spentCount: number
    inCirculation: number; totalUsers: number; avgCreditsPerUser: number
  }
  recent: Array<{
    id: string; amount: number; reason: string; createdAt: string
    user: { id: string; name: string | null; email: string | null; avatarUrl: string | null }
  }>
}

interface SecurityData {
  apiKeys: { total: number; active: number; inactive: number; rotatedInLast30Days: number }
  rateLimit: { defaultMaxPerMinute: number; defaultMaxPerHour: number }
  auditRetention: {
    auditLogRetentionDays: number
    requireApiKeyRotationDays: number
    oldestLogAt: string | null
  }
  providersWithEmptyKey: Array<{
    id: string; name: string; slug: string
    capabilities: string; isActive: boolean
  }>
  failedAuthAttempts24h: number
  workspaceIsolation: {
    totalGenerations: number
    defaultWorkspaceGenerations: number
    isolatedCount: number
    isolationPercent: number
  }
}

interface Flag {
  id: string; key: string; name: string; description: string; enabled: boolean
}

/* ============================================================================
 * Constants
 * ========================================================================== */

const ROUTE_CATEGORIES: Array<{ name: string; desc: string }> = [
  { name: 'WRITING', desc: 'Long-form article & narrative generation' },
  { name: 'MARKETING', desc: 'Ad copy, landing pages, marketing assets' },
  { name: 'COURSE', desc: 'Course outline, lesson, and curriculum authoring' },
  { name: 'WEBSITE', desc: 'Web page copy and structure generation' },
  { name: 'SEO', desc: 'SEO meta, keywords, and content optimization' },
  { name: 'EMAIL', desc: 'Email sequence and broadcast writing' },
  { name: 'BLOG', desc: 'Blog post generation' },
  { name: 'CRM', desc: 'Customer replies and CRM automation' },
  { name: 'AUTOMATION', desc: 'Workflow automation prompts' },
  { name: 'IMAGE', desc: 'Image generation requests' },
  { name: 'VIDEO', desc: 'Video generation requests' },
  { name: 'VOICE', desc: 'Text-to-speech synthesis' },
  { name: 'STT', desc: 'Speech-to-text transcription' },
  { name: 'EMBEDDING', desc: 'Vector embedding generation' },
]

const STRATEGIES = ['smart', 'cost', 'quality', 'round_robin'] as const
const STATUSES = ['QUEUED', 'RENDERING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const
const LOG_STATUSES = ['OK', 'ERROR', 'TIMEOUT', 'RATE_LIMITED', 'QUOTA_EXCEEDED'] as const
const MODALITIES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'EMBEDDING', 'STT', 'TTS'] as const
const REQUEST_TYPES = ['CHAT', 'GENERATE', 'IMAGE', 'VIDEO', 'EMBEDDING', 'STT', 'TTS'] as const

/* ============================================================================
 * Shared UI helpers
 * ========================================================================== */

export function StatCard({
  icon: Icon, label, value, hint, accent = 'amber',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  hint?: string
  accent?: 'amber' | 'emerald' | 'red' | 'sky' | 'violet'
}) {
  const colorMap = {
    amber: 'bg-amber-500/10 text-amber-600',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    red: 'bg-red-500/10 text-red-600',
    sky: 'bg-sky-500/10 text-sky-600',
    violet: 'bg-violet-500/10 text-violet-600',
  }
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', colorMap[accent])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold tabular-nums leading-none truncate">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
          {hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export function HealthDot({ healthy, label }: { healthy: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', healthy ? 'bg-emerald-500' : 'bg-red-500')}>
        <span className={cn('block h-2 w-2 rounded-full', healthy ? 'animate-pulse bg-emerald-500/40' : 'bg-red-500/40')} />
      </span>
      <span className={cn('text-xs', healthy ? 'text-emerald-600' : 'text-red-600')}>
        {label || (healthy ? 'Healthy' : 'Unhealthy')}
      </span>
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OK: 'bg-emerald-500/10 text-emerald-600',
    COMPLETED: 'bg-emerald-500/10 text-emerald-600',
    QUEUED: 'bg-sky-500/10 text-sky-600',
    RENDERING: 'bg-amber-500/10 text-amber-600',
    PROCESSING: 'bg-amber-500/10 text-amber-600',
    ERROR: 'bg-red-500/10 text-red-600',
    FAILED: 'bg-red-500/10 text-red-600',
    CANCELLED: 'bg-muted text-muted-foreground',
    TIMEOUT: 'bg-red-500/10 text-red-600',
    RATE_LIMITED: 'bg-amber-500/10 text-amber-600',
    QUOTA_EXCEEDED: 'bg-red-500/10 text-red-600',
  }
  return (
    <Badge variant="secondary" className={cn('text-[10px] font-medium', map[status] || 'bg-muted')}>
      {status}
    </Badge>
  )
}

export function CapBadges({ capabilities }: { capabilities: string }) {
  if (!capabilities) return null
  const caps = capabilities.split(',').map((s) => s.trim()).filter(Boolean)
  const capColor: Record<string, string> = {
    TEXT: 'bg-amber-500/10 text-amber-600',
    IMAGE: 'bg-violet-500/10 text-violet-600',
    VIDEO: 'bg-violet-500/10 text-violet-600',
    TTS: 'bg-sky-500/10 text-sky-600',
    STT: 'bg-sky-500/10 text-sky-600',
    EMBEDDING: 'bg-emerald-500/10 text-emerald-600',
  }
  return (
    <div className="flex flex-wrap gap-1">
      {caps.map((c) => (
        <Badge key={c} variant="secondary" className={cn('text-[9px] font-medium px-1.5 py-0', capColor[c] || 'bg-muted')}>
          {c}
        </Badge>
      ))}
    </div>
  )
}

export function ProgressBar({ value, accent = 'amber' }: { value: number; accent?: 'amber' | 'emerald' | 'red' | 'sky' }) {
  const v = Math.min(100, Math.max(0, value))
  const colorMap = {
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
    sky: 'bg-sky-500',
  }
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', colorMap[accent])} style={{ width: `${v}%` }} />
    </div>
  )
}

export function EmptyState({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="p-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export function LoadingBlock() {
  return <Skeleton className="h-96 rounded-xl" />
}

async function mutate(
  url: string, method: 'PUT' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown, okMessage?: string,
): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((d as { error?: string }).error || `Request failed (${res.status})`)
    if (okMessage) toast.success(okMessage)
    return { ok: true, data: d }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Request failed')
    return { ok: false }
  }
}

export function fmtBytes(n: number): string {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n, i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export function fmtMoney(n: number): string {
  return '$' + (Math.round(n * 100) / 100).toFixed(n < 1 ? 4 : 2)
}

/* ============================================================================
 * Main module — Super Admin shell
 * ========================================================================== */

export function AdminModule() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="space-y-5">
      {/* Header — amber themed */}
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
                  Platform Control Center
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Manage 12 AI providers, smart routing, models, jobs, costs, security & feature flags — no code required.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> AI Engine Online
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard"><Gauge className="h-3.5 w-3.5 mr-1.5" />Dashboard</TabsTrigger>
          <TabsTrigger value="providers"><Server className="h-3.5 w-3.5 mr-1.5" />Providers</TabsTrigger>
          <TabsTrigger value="keys"><KeyRound className="h-3.5 w-3.5 mr-1.5" />API Keys</TabsTrigger>
          <TabsTrigger value="models"><Cpu className="h-3.5 w-3.5 mr-1.5" />Models</TabsTrigger>
          <TabsTrigger value="routing"><ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />Routing</TabsTrigger>
          <TabsTrigger value="credits"><Coins className="h-3.5 w-3.5 mr-1.5" />Credits</TabsTrigger>
          <TabsTrigger value="storage"><HardDrive className="h-3.5 w-3.5 mr-1.5" />Storage</TabsTrigger>
          <TabsTrigger value="jobs"><ClipboardList className="h-3.5 w-3.5 mr-1.5" />Jobs</TabsTrigger>
          <TabsTrigger value="monitoring"><Activity className="h-3.5 w-3.5 mr-1.5" />Monitoring</TabsTrigger>
          <TabsTrigger value="logs"><FileText className="h-3.5 w-3.5 mr-1.5" />Logs</TabsTrigger>
          <TabsTrigger value="costs"><DollarSign className="h-3.5 w-3.5 mr-1.5" />Costs</TabsTrigger>
          <TabsTrigger value="security"><Lock className="h-3.5 w-3.5 mr-1.5" />Security</TabsTrigger>
          <TabsTrigger value="flags"><ToggleLeft className="h-3.5 w-3.5 mr-1.5" />Feature Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardPanel onJump={setTab} /></TabsContent>
        <TabsContent value="providers"><ProvidersPanel /></TabsContent>
        <TabsContent value="keys"><ApiKeysPanel /></TabsContent>
        <TabsContent value="models"><ModelsPanel /></TabsContent>
        <TabsContent value="routing"><RoutingPanel /></TabsContent>
        <TabsContent value="credits"><CreditsPanel /></TabsContent>
        <TabsContent value="storage"><StoragePanel /></TabsContent>
        <TabsContent value="jobs"><JobsPanel /></TabsContent>
        <TabsContent value="monitoring"><MonitoringPanel /></TabsContent>
        <TabsContent value="logs"><LogsPanel /></TabsContent>
        <TabsContent value="costs"><CostsPanel /></TabsContent>
        <TabsContent value="security"><SecurityPanel /></TabsContent>
        <TabsContent value="flags"><FlagsPanel /></TabsContent>
      </Tabs>
    </div>
  )
}

/* ============================================================================
 * 1. Dashboard — platform overview & system health
 * ========================================================================== */

export function DashboardPanel({ onJump }: { onJump: (t: string) => void }) {
  const { data: mon, loading: l1 } = useApi<MonitoringData>('/api/admin/monitoring')
  const { data: logs, loading: l2 } = useApi<{ logs: LogRow[] }>('/api/admin/logs?page=1&pageSize=5')

  if (l1 || !mon) return <LoadingBlock />

  const quickLinks = [
    { l: 'Providers', v: `${mon.providers.active}/${mon.providers.total} active`, i: Server, t: 'providers' },
    { l: 'Routing', v: '14 categories', i: ArrowRightLeft, t: 'routing' },
    { l: 'Monitoring', v: `${mon.today.successRate.toFixed(1)}% ok`, i: Activity, t: 'monitoring' },
    { l: 'Costs', v: fmtMoney(mon.today.costUsd), i: DollarSign, t: 'costs' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Server} label="Active Providers" value={`${mon.providers.active}/${mon.providers.total}`} accent="emerald" />
        <StatCard icon={Zap} label="Today Requests" value={formatNumber(mon.today.requests)} accent="amber" />
        <StatCard icon={DollarSign} label="Today Cost" value={fmtMoney(mon.today.costUsd)} accent="amber" />
        <StatCard icon={Check} label="Success Rate" value={`${mon.today.successRate.toFixed(1)}%`} accent={mon.today.successRate >= 95 ? 'emerald' : 'red'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { s: 'API Gateway', st: 'Operational', up: 99.98 },
              { s: 'AI Engine (router + adapters)', st: 'Operational', up: 99.95 },
              { s: 'Database (SQLite)', st: 'Operational', up: 100 },
              { s: 'File Storage', st: 'Operational', up: 99.99 },
              { s: 'Webhook Ingest', st: mon.storage.workspaceCount > 0 ? 'Operational' : 'Standby', up: 99.5 },
            ].map((x) => (
              <div key={x.s} className="flex items-center justify-between rounded-lg border p-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', x.st === 'Operational' ? 'bg-emerald-500' : 'bg-amber-500')} />
                  <span className="text-sm">{x.s}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{x.up}% uptime</span>
                  <Badge variant="secondary" className={cn('text-[10px]', x.st === 'Operational' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>
                    {x.st}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Rocket className="h-4 w-4 text-amber-500" /> Quick Links
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {quickLinks.map((q) => {
              const Icon = q.i
              return (
                <Button
                  key={q.l}
                  variant="outline"
                  className="h-auto justify-start py-3 px-3"
                  onClick={() => onJump(q.t)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 mr-2">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-medium">{q.l}</p>
                    <p className="text-[10px] text-muted-foreground">{q.v}</p>
                  </div>
                </Button>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4 text-amber-500" /> Recent Activity
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">Last 5 audit logs</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {l2 || !logs || logs.logs.length === 0 ? (
            <EmptyState icon={FileText} message="No recent activity yet. Generate something in AI Studio." />
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto scroll-thin">
              {logs.logs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/40"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {log.provider?.name || '—'} · {log.toolSlug || log.requestType}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {log.requestType} · {timeAgo(log.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={log.status} />
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {log.durationMs}ms
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ============================================================================
 * 2. Providers — Enterprise AI Gateway UI
 * ----------------------------------------------------------------------------
 * Comprehensive provider management: cards with health, capabilities, API key
 * validation, test connection, sync models, test prompt, usage stats, and
 * an expandable per-provider models table.
 * ========================================================================== */

const MODALITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  TEXT: Brain,
  IMAGE: ImageIcon,
  VIDEO: VideoIcon,
  AUDIO: Volume2,
  EMBEDDING: Boxes,
  STT: Mic,
  TTS: Volume2,
  VISION: Eye,
}

const MODALITY_COLORS: Record<string, string> = {
  TEXT: 'bg-amber-500/10 text-amber-600',
  IMAGE: 'bg-violet-500/10 text-violet-600',
  VIDEO: 'bg-violet-500/10 text-violet-600',
  AUDIO: 'bg-sky-500/10 text-sky-600',
  EMBEDDING: 'bg-emerald-500/10 text-emerald-600',
  STT: 'bg-sky-500/10 text-sky-600',
  TTS: 'bg-sky-500/10 text-sky-600',
  VISION: 'bg-amber-500/10 text-amber-600',
  OCR: 'bg-amber-500/10 text-amber-600',
  RERANKER: 'bg-amber-500/10 text-amber-600',
  MODERATION: 'bg-red-500/10 text-red-600',
}

// Lightweight brace icon (avoids lucide import name clash)
function BracesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
      <path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
    </svg>
  )
}

function capList(caps: string | undefined | null): string[] {
  if (!caps) return []
  return caps.split(',').map((s) => s.trim()).filter(Boolean)
}

function parseHeaders(h: string | Record<string, string> | null | undefined): Record<string, string> {
  if (!h) return {}
  if (typeof h === 'object') return h
  try { return JSON.parse(h) as Record<string, string> } catch { return {} }
}

function stringifyHeaders(h: string | Record<string, string> | null | undefined): string {
  const obj = parseHeaders(h)
  return Object.keys(obj).length ? JSON.stringify(obj, null, 2) : ''
}

function fmtCtx(n: number | undefined): string {
  if (!n || n <= 0) return '—'
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}

function latencyColor(ms: number | null | undefined): string {
  if (ms == null) return 'bg-muted text-muted-foreground'
  if (ms < 500) return 'bg-emerald-500/10 text-emerald-600'
  if (ms < 2000) return 'bg-amber-500/10 text-amber-600'
  return 'bg-red-500/10 text-red-600'
}

function CapIconBadges({ model }: { model: ProviderModel }) {
  const features: Array<{ key: keyof ProviderModel; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'supportsVision', label: 'Vision', icon: Eye },
    { key: 'supportsImage', label: 'Image', icon: ImageIcon },
    { key: 'supportsAudio', label: 'Audio', icon: Volume2 },
    { key: 'supportsVideo', label: 'Video', icon: VideoIcon },
    { key: 'supportsEmbeddings', label: 'Embed', icon: Boxes },
    { key: 'supportsStreaming', label: 'Stream', icon: Activity },
    { key: 'supportsJson', label: 'JSON', icon: BracesIcon },
    { key: 'supportsToolCalling', label: 'Tools', icon: Wrench },
    { key: 'supportsReasoning', label: 'Reason', icon: Brain },
  ]
  return (
    <div className="flex flex-wrap gap-1">
      {features
        .filter((f) => model[f.key] === true)
        .map((f) => {
          const Icon = f.icon
          return (
            <span
              key={f.label}
              title={f.label}
              className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground"
            >
              <Icon className="h-2.5 w-2.5" />
              {f.label}
            </span>
          )
        })}
    </div>
  )
}

export function ProvidersPanel() {
  const { data, loading, refetch } = useApi<{ providers: Provider[] }>('/api/admin/providers')
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [modelsDialog, setModelsDialog] = useState<{ open: boolean; provider?: Provider }>({ open: false })
  const [testConn, setTestConn] = useState<{
    open: boolean; provider?: Provider; loading?: boolean; result?: TestConnectionResult
  }>({ open: false })
  const [testPrompt, setTestPrompt] = useState<{ open: boolean; provider?: Provider }>({ open: false })
  const [usage, setUsage] = useState<{ open: boolean; provider?: Provider }>({ open: false })
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Provider | null>(null)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [newKeys, setNewKeys] = useState<Record<string, string>>({})
  const [syncingId, setSyncingId] = useState<string | null>(null)

  if (loading || !data) return <LoadingBlock />

  const toggleActive = async (p: Provider, v: boolean) => {
    await mutate('/api/admin/providers', 'PUT', { id: p.id, isActive: v }, `${p.name} ${v ? 'enabled' : 'disabled'}`)
    refetch()
  }

  const validateKey = async (p: Provider) => {
    const newKey = (newKeys[p.id] || '').trim()
    if (newKey.length < 8) {
      toast.error('API key must be at least 8 characters')
      return
    }
    setValidatingId(p.id)
    try {
      // 1. Validate the new key
      const valRes = await fetch(`/api/admin/providers/${p.id}/validate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: newKey }),
      })
      const valData = (await valRes.json().catch(() => ({}))) as ValidateKeyResult & { error?: string }
      if (!valRes.ok || !valData.valid) {
        toast.error(valData.message || valData.error || 'Invalid API key')
        return
      }
      toast.success(valData.message || `Connected. ${valData.modelsCount ?? 0} models available.`)
      // 2. Save the validated key
      const saveOk = await mutate('/api/admin/providers', 'PUT', { id: p.id, apiKey: newKey })
      if (!saveOk.ok) return
      // 3. Auto-sync models (best-effort)
      try {
        const syncRes = await fetch(`/api/admin/providers/${p.id}/sync-models`, { method: 'POST' })
        const syncData = (await syncRes.json().catch(() => ({}))) as SyncModelsResult
        if (syncRes.ok && (syncData.success || syncData.status === 'success' || syncData.status === 'partial')) {
          toast.success(
            `Synced: ${syncData.modelsFound ?? 0} found, ${syncData.modelsAdded ?? 0} added, ${syncData.modelsUpdated ?? 0} updated, ${syncData.modelsRemoved ?? 0} removed`,
          )
        }
      } catch {
        /* sync is best-effort — key was already saved */
      }
      setNewKeys((s) => ({ ...s, [p.id]: '' }))
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setValidatingId(null)
    }
  }

  const testConnection = async (p: Provider) => {
    setTestConn({ open: true, provider: p, loading: true })
    try {
      const res = await fetch(`/api/admin/providers/${p.id}/test-connection`, { method: 'POST' })
      const d = (await res.json().catch(() => ({}))) as TestConnectionResult & { error?: string }
      if (!res.ok) {
        setTestConn({ open: true, provider: p, loading: false, result: { status: 'down', error: d.error || `HTTP ${res.status}` } })
        return
      }
      setTestConn({ open: true, provider: p, loading: false, result: d })
      if (d.status === 'healthy' || d.success) toast.success(`${p.name}: healthy (${d.latencyMs ?? 0}ms)`)
      else toast.error(`${p.name}: ${d.error || d.status || 'unhealthy'}`)
    } catch (e) {
      setTestConn({ open: true, provider: p, loading: false, result: { status: 'down', error: e instanceof Error ? e.message : 'Network error' } })
    }
  }

  const syncModels = async (p: Provider) => {
    setSyncingId(p.id)
    const tid = toast.loading(`Syncing models for ${p.name}…`)
    try {
      const res = await fetch(`/api/admin/providers/${p.id}/sync-models`, { method: 'POST' })
      const d = (await res.json().catch(() => ({}))) as SyncModelsResult & { error?: string }
      if (!res.ok || d.status === 'failed') {
        toast.error(d.error || 'Sync failed', { id: tid })
        return
      }
      toast.success(
        `Synced: ${d.modelsFound ?? 0} found, ${d.modelsAdded ?? 0} added, ${d.modelsUpdated ?? 0} updated, ${d.modelsRemoved ?? 0} removed`,
        { id: tid },
      )
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed', { id: tid })
    } finally {
      setSyncingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header — gateway title + Add Provider */}
      <Card className="overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card">
        <CardContent className="p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 shrink-0">
              <Cable className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold">AI Provider Gateway</h3>
                <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/20">
                  {data.providers.length} providers
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Connect, validate, and monitor all AI providers in one place.
              </p>
            </div>
          </div>
          <Button onClick={() => setAddOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> Add Provider
          </Button>
        </CardContent>
      </Card>

      {/* Info banner */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-3 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            API keys are <span className="font-medium text-amber-600">encrypted at rest</span> and never exposed to creators.
            Smart routing auto-selects the best provider per route category, with automatic failover when a provider goes down.
          </p>
        </CardContent>
      </Card>

      {/* Provider cards grid */}
      {data.providers.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={Server} message="No providers configured yet. Click 'Add Provider' to connect your first AI gateway." />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.providers.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
            >
              <ProviderCard
                provider={p}
                showKey={!!showKey[p.id]}
                validating={validatingId === p.id}
                syncing={syncingId === p.id}
                newKey={newKeys[p.id] || ''}
                onToggleShowKey={() => setShowKey((s) => ({ ...s, [p.id]: !s[p.id] }))}
                onToggleActive={(v) => toggleActive(p, v)}
                onValidateKey={() => validateKey(p)}
                onNewKeyChange={(v) => setNewKeys((s) => ({ ...s, [p.id]: v }))}
                onTestConnection={() => testConnection(p)}
                onSyncModels={() => syncModels(p)}
                onTestPrompt={() => setTestPrompt({ open: true, provider: p })}
                onUsage={() => setUsage({ open: true, provider: p })}
                onEdit={() => setEditing(p)}
                onOpenModels={() => setModelsDialog({ open: true, provider: p })}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <TestConnectionDialog
        open={testConn.open}
        provider={testConn.provider}
        loading={!!testConn.loading}
        result={testConn.result}
        onClose={() => setTestConn({ open: false })}
      />

      <TestPromptDialog
        open={testPrompt.open}
        provider={testPrompt.provider}
        onClose={() => setTestPrompt({ open: false })}
      />

      <UsageDialog
        open={usage.open}
        provider={usage.provider}
        onClose={() => setUsage({ open: false })}
      />

      <ModelsDialog
        open={modelsDialog.open}
        provider={modelsDialog.provider}
        syncing={modelsDialog.provider ? syncingId === modelsDialog.provider.id : false}
        onSyncModels={() => modelsDialog.provider && syncModels(modelsDialog.provider)}
        onClose={() => setModelsDialog({ open: false })}
      />

      <AddProviderDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => { setAddOpen(false); refetch() }}
      />

      {editing && (
        <EditProviderDialog
          provider={editing}
          allProviders={data.providers}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refetch() }}
        />
      )}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * ProviderCard — full management card
 * -------------------------------------------------------------------------- */

function ProviderCard({
  provider, showKey, validating, syncing, newKey,
  onToggleShowKey, onToggleActive, onValidateKey, onNewKeyChange,
  onTestConnection, onSyncModels, onTestPrompt, onUsage, onEdit, onOpenModels,
}: {
  provider: Provider
  showKey: boolean
  validating: boolean
  syncing: boolean
  newKey: string
  onToggleShowKey: () => void
  onToggleActive: (v: boolean) => void
  onValidateKey: () => void
  onNewKeyChange: (v: string) => void
  onTestConnection: () => void
  onSyncModels: () => void
  onTestPrompt: () => void
  onUsage: () => void
  onEdit: () => void
  onOpenModels: () => void
}) {
  const p = provider
  const caps = capList(p.capabilities)
  const meta = getProviderMeta(p.slug)
  const lastSync = p.lastSyncAt || p.lastHealthCheck

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
              p.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground',
            )}
            style={meta ? { backgroundColor: meta.color + '20', color: meta.color } : undefined}
          >
            <Server className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm truncate">{p.name}</p>
              {p.providerVersion && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-muted text-muted-foreground shrink-0">
                  v{p.providerVersion}
                </Badge>
              )}
            </div>
            <code className="text-[10px] text-muted-foreground">{p.slug}</code>
          </div>
        </div>
        <Switch checked={p.isActive} onCheckedChange={onToggleActive} />
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3">
        {/* Status row */}
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            <HealthDot healthy={p.isHealthy} label={p.isHealthy ? 'Healthy' : 'Down'} />
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {p.lastHealthCheck ? <span>{timeAgo(p.lastHealthCheck)}</span> : <span>not tested</span>}
            {p.latencyMs != null && (
              <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 font-mono', latencyColor(p.latencyMs))}>
                {p.latencyMs}ms
              </Badge>
            )}
          </div>
        </div>

        {/* Capabilities badges */}
        {caps.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {caps.map((c) => {
              const Icon = MODALITY_ICONS[c]
              return (
                <Badge
                  key={c}
                  variant="secondary"
                  className={cn('text-[9px] font-medium px-1.5 py-0 flex items-center gap-0.5', MODALITY_COLORS[c] || 'bg-muted')}
                >
                  {Icon && <Icon className="h-2.5 w-2.5" />}
                  {c}
                </Badge>
              )
            })}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-muted/50 py-1.5">
            <p className="text-[10px] text-muted-foreground">Models</p>
            <p className="text-xs font-semibold tabular-nums">{p.modelsCount}</p>
          </div>
          <div className="rounded-md bg-muted/50 py-1.5">
            <p className="text-[10px] text-muted-foreground">Today Reqs</p>
            <p className="text-xs font-semibold tabular-nums">{p.todayRequests || 0}</p>
          </div>
          <div className="rounded-md bg-muted/50 py-1.5">
            <p className="text-[10px] text-muted-foreground">Today Cost</p>
            <p className={cn('text-xs font-semibold tabular-nums', p.todayCost > 0 ? 'text-amber-600' : '')}>
              {p.todayCost > 0 ? fmtMoney(p.todayCost) : '—'}
            </p>
          </div>
        </div>

        {/* API Key section */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Masked API Key</Label>
            {p.quotaRemaining && (
              <span className="text-[9px] text-muted-foreground">Quota: {p.quotaRemaining}</span>
            )}
          </div>
          <div className="flex gap-1.5">
            <Input
              type={showKey ? 'text' : 'password'}
              value={p.maskedApiKey || '(not set)'}
              readOnly
              className="font-mono text-xs h-8"
            />
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              onClick={onToggleShowKey}
              title={showKey ? 'Hide masked key' : 'Show masked key'}
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="flex gap-1.5">
            <Input
              type="password"
              placeholder="Enter new API key to validate…"
              value={newKey}
              onChange={(e) => onNewKeyChange(e.target.value)}
              className="font-mono text-xs h-8"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 text-xs"
              disabled={validating || newKey.length < 8}
              onClick={onValidateKey}
            >
              {validating ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              )}
              Validate
            </Button>
          </div>
        </div>

        {/* Action buttons — 2x2 grid */}
        <div className="grid grid-cols-2 gap-2 mt-auto pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onTestConnection}
          >
            <Stethoscope className="h-3 w-3 mr-1" /> Test Connection
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={syncing}
            onClick={onSyncModels}
          >
            {syncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Refresh Models
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onTestPrompt}
          >
            <Terminal className="h-3 w-3 mr-1" /> Test Prompt
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onUsage}
          >
            <BarChart3 className="h-3 w-3 mr-1" /> Usage
          </Button>
        </div>

        {/* Edit + Models row */}
        <div className="flex gap-2 pt-1 border-t">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs flex-1"
            onClick={onEdit}
          >
            <Settings2 className="h-3 w-3 mr-1" /> Edit Settings
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs flex-1"
            onClick={onOpenModels}
          >
            <Cpu className="h-3 w-3 mr-1" /> Models ({p.modelsCount})
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ----------------------------------------------------------------------------
 * TestConnectionDialog — shows full health-check result
 * -------------------------------------------------------------------------- */

function TestConnectionDialog({
  open, provider, loading, result, onClose,
}: {
  open: boolean
  provider?: Provider
  loading: boolean
  result?: TestConnectionResult
  onClose: () => void
}) {
  const status = result?.status || (result?.success ? 'healthy' : 'unknown')
  const statusColor: Record<string, string> = {
    healthy: 'bg-emerald-500/10 text-emerald-600',
    degraded: 'bg-amber-500/10 text-amber-600',
    down: 'bg-red-500/10 text-red-600',
    unknown: 'bg-muted text-muted-foreground',
  }
  const allTests = ['health', 'auth', 'prompt', 'streaming', 'tool']
  const passed = result?.testsPassed || []
  const run = result?.testsRun || []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-amber-500" /> Test Connection
            {provider && <span className="text-muted-foreground font-normal">· {provider.name}</span>}
          </DialogTitle>
          <DialogDescription>
            Run a full health check against the provider&apos;s API. Tests authentication, prompt, streaming, and tool calling.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground">Running health check…</p>
            </div>
          ) : result?.error && !result.status ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-600">Connection failed</p>
                <p className="text-xs text-muted-foreground mt-0.5">{result.error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Status banner */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={cn('text-xs font-medium uppercase', statusColor[status] || statusColor.unknown)}>
                    {status}
                  </Badge>
                  <span className="text-sm font-medium">{provider?.name}</span>
                </div>
                {result?.latencyMs != null && (
                  <Badge variant="secondary" className={cn('text-xs font-mono', latencyColor(result.latencyMs))}>
                    <Timer className="h-3 w-3 mr-1" /> {result.latencyMs}ms
                  </Badge>
                )}
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Provider Version</p>
                  <p className="text-xs font-semibold">{result?.providerVersion || '—'}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Quota Remaining</p>
                  <p className="text-xs font-semibold truncate">{result?.quotaRemaining || '—'}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Model Count</p>
                  <p className="text-xs font-semibold tabular-nums">{result?.modelCount ?? '—'}</p>
                </div>
              </div>

              {/* Tests checklist */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Test Checklist</p>
                <div className="space-y-1">
                  {allTests.map((t) => {
                    const wasRun = run.includes(t)
                    const wasPassed = passed.includes(t)
                    return (
                      <div key={t} className="flex items-center justify-between rounded-md border px-2.5 py-1.5">
                        <span className="text-xs capitalize">{t}</span>
                        {!wasRun ? (
                          <Badge variant="secondary" className="text-[9px] bg-muted text-muted-foreground">Skipped</Badge>
                        ) : wasPassed ? (
                          <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-600">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Passed
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] bg-red-500/10 text-red-600">
                            <XCircle className="h-2.5 w-2.5 mr-0.5" /> Failed
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {result?.error && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
                  <p className="text-[10px] font-medium text-amber-600 mb-0.5">Notice</p>
                  <p className="text-xs text-muted-foreground">{result.error}</p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------------------------
 * TestPromptDialog — model selector + prompt input + results
 * -------------------------------------------------------------------------- */

function TestPromptDialog({
  open, provider, onClose,
}: {
  open: boolean
  provider?: Provider
  onClose: () => void
}) {
  const [modelId, setModelId] = useState<string>('')
  const [prompt, setPrompt] = useState('Hello World')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<TestPromptResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens for a different provider
  useEffect(() => {
    if (open && provider) {
      const defaultModel = provider.models.find((m) => m.isDefault) || provider.models[0]
      setModelId(defaultModel?.id || '')
      setPrompt('Hello World')
      setResult(null)
      setError(null)
    }
  }, [open, provider])

  if (!provider) return null

  const activeModels = provider.models.filter((m) => m.isActive)
  const modelList = activeModels.length > 0 ? activeModels : provider.models

  const runTest = async () => {
    if (!provider) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/test-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: modelId || undefined, prompt }),
      })
      const d = (await res.json().catch(() => ({}))) as TestPromptResult & { error?: string }
      if (!res.ok || !d.success) {
        setError(d.error || 'Test prompt failed')
        return
      }
      setResult(d)
      toast.success(`Prompt completed in ${d.latencyMs ?? 0}ms`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-amber-500" /> Test Prompt
            <span className="text-muted-foreground font-normal">· {provider.name}</span>
          </DialogTitle>
          <DialogDescription>
            Send a test prompt to verify the model responds correctly. Token counts and cost are returned.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Model</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Default model" /></SelectTrigger>
                <SelectContent>
                  {modelList.length === 0 ? (
                    <SelectItem value="" disabled>No models — sync first</SelectItem>
                  ) : (
                    modelList.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName}{m.isDefault ? ' ★' : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prompt</Label>
              <Input
                className="mt-1"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Hello World"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={runTest} disabled={running || !prompt.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
              {running ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
              Run Test
            </Button>
          </div>

          {/* Error display */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-600">Test failed</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Input Tokens</p>
                  <p className="text-xs font-semibold tabular-nums">{result.inputTokens ?? 0}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Output Tokens</p>
                  <p className="text-xs font-semibold tabular-nums">{result.outputTokens ?? 0}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Cost</p>
                  <p className="text-xs font-semibold tabular-nums text-amber-600">{result.costUsd != null ? fmtMoney(result.costUsd) : '—'}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Latency</p>
                  <p className="text-xs font-semibold tabular-nums">{result.latencyMs ?? 0}ms</p>
                </div>
              </div>
              <div>
                <Label className="text-xs">Response</Label>
                <pre className="mt-1 rounded-md bg-muted/50 p-2.5 text-xs whitespace-pre-wrap break-words max-h-60 overflow-y-auto scroll-thin font-mono">
                  {result.response || '(empty response)'}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------------------------
 * UsageDialog — full usage stats for a provider
 * -------------------------------------------------------------------------- */

function UsageDialog({
  open, provider, onClose,
}: {
  open: boolean
  provider?: Provider
  onClose: () => void
}) {
  const { data, loading } = useApi<ProviderUsage>(open && provider ? `/api/admin/providers/${provider.id}/usage` : null)

  if (!provider) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-500" /> Usage Stats
            <span className="text-muted-foreground font-normal">· {provider.name}</span>
          </DialogTitle>
          <DialogDescription>
            Aggregated usage for this provider over the last 30 days.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {loading || !data ? (
            <div className="space-y-2">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          ) : (
            <>
              {/* 4 stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatCard icon={Activity} label="Requests (30d)" value={formatNumber(data.requests || 0)} accent="amber" />
                <StatCard icon={Check} label="Success Rate" value={`${(data.successRate ?? 0).toFixed(1)}%`} accent={data.successRate != null && data.successRate >= 95 ? 'emerald' : 'red'} />
                <StatCard icon={Timer} label="Avg Latency" value={`${data.avgLatencyMs ?? 0}ms`} accent="sky" />
                <StatCard icon={DollarSign} label="Daily Cost" value={fmtMoney(data.dailyCost || 0)} accent="amber" />
              </div>

              {/* 2 more */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard icon={TrendingUp} label="Monthly Cost" value={fmtMoney(data.monthlyCost || 0)} accent="amber" />
                <StatCard icon={Coins} label="Credits Used" value={formatNumber(data.creditsUsed || 0)} accent="emerald" />
              </div>

              {/* Failures */}
              {(data.failures ?? 0) > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-600">{data.failures} failures in the last 30 days</span>
                </div>
              )}

              {/* Top models + Most used features */}
              <div className="grid md:grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 text-amber-500" /> Top Models
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {data.topModels && data.topModels.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto scroll-thin">
                        {data.topModels.slice(0, 5).map((m, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{m.name || m.modelId}</p>
                              <p className="text-[10px] text-muted-foreground">{formatNumber(m.requests)} requests</p>
                            </div>
                            <span className="font-mono tabular-nums text-amber-600 shrink-0 ml-2">{fmtMoney(m.cost)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={Cpu} message="No model usage yet." />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-2">
                      <Workflow className="h-3.5 w-3.5 text-amber-500" /> Most Used Features
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {data.mostUsedFeatures && data.mostUsedFeatures.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto scroll-thin">
                        {data.mostUsedFeatures.slice(0, 5).map((f, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="font-medium">{f.category}</span>
                            <Badge variant="secondary" className="text-[9px] bg-amber-500/10 text-amber-600">
                              {formatNumber(f.requests)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={Workflow} message="No feature usage yet." />
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------------------------
 * AddProviderDialog — provider registry grid + connect form
 * -------------------------------------------------------------------------- */

function AddProviderDialog({
  open, onClose, onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const [selected, setSelected] = useState<ProviderMeta | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [authType, setAuthType] = useState<AuthType>('bearer')
  const [headers, setHeaders] = useState('')
  const [capabilities, setCapabilities] = useState<string[]>(['TEXT'])
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (open) {
      setSelected(null)
      setApiKey('')
      setBaseUrl('')
      setAuthType('bearer')
      setHeaders('')
      setCapabilities(['TEXT'])
    }
  }, [open])

  const pickProvider = (meta: ProviderMeta) => {
    setSelected(meta)
    setBaseUrl(meta.defaultBaseUrl)
    setAuthType(meta.authType)
    setCapabilities(meta.capabilities)
  }

  const toggleCap = (cap: string) => {
    setCapabilities((c) => c.includes(cap) ? c.filter((x) => x !== cap) : [...c, cap])
  }

  const connect = async () => {
    if (!selected) return
    if (apiKey.trim().length < 8) {
      toast.error('API key must be at least 8 characters')
      return
    }
    setConnecting(true)
    try {
      // 1. Create the provider
      const createRes = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: selected.slug,
          name: selected.name,
          baseUrl: baseUrl || selected.defaultBaseUrl,
          apiKey,
          authType,
          headers: headers || undefined,
          capabilities: capabilities.join(','),
          description: selected.description,
          docsUrl: selected.docsUrl,
        }),
      })
      const created = (await createRes.json().catch(() => ({}))) as { provider?: { id: string }; error?: string }
      if (!createRes.ok || !created.provider) {
        toast.error(created.error || 'Failed to create provider')
        return
      }
      const newId = created.provider.id

      // 2. Validate the key (best-effort)
      try {
        const valRes = await fetch(`/api/admin/providers/${newId}/validate-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        })
        const valData = (await valRes.json().catch(() => ({}))) as ValidateKeyResult
        if (valRes.ok && valData.valid) {
          toast.success(`Connected. ${valData.modelsCount ?? 0} models available.`)
        }
      } catch {
        /* validation best-effort */
      }

      // 3. Sync models (best-effort)
      try {
        const syncRes = await fetch(`/api/admin/providers/${newId}/sync-models`, { method: 'POST' })
        const syncData = (await syncRes.json().catch(() => ({}))) as SyncModelsResult
        if (syncRes.ok && (syncData.success || syncData.status === 'success' || syncData.status === 'partial')) {
          toast.success(`Synced: ${syncData.modelsFound ?? 0} found, ${syncData.modelsAdded ?? 0} added`)
        }
      } catch {
        /* sync best-effort */
      }

      toast.success(`${selected.name} connected`)
      onAdded()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  const AUTH_TYPES: Array<{ value: AuthType; label: string }> = [
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'x-api-key', label: 'X-API-Key Header' },
    { value: 'custom-header', label: 'Custom Header' },
    { value: 'query-param', label: 'Query Parameter' },
  ]

  const ALL_CAPS = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'EMBEDDING', 'STT', 'TTS', 'VISION']

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-amber-500" /> Add Provider
          </DialogTitle>
          <DialogDescription>
            {selected
              ? `Configure ${selected.name} connection. Validate your API key before saving.`
              : 'Pick a provider from the registry to connect. Custom providers can be configured with any OpenAI-compatible endpoint.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {!selected ? (
            // Step 1: registry grid
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto scroll-thin pr-1">
              {PROVIDER_REGISTRY.map((meta) => (
                <button
                  key={meta.slug}
                  onClick={() => pickProvider(meta)}
                  className="text-left rounded-lg border p-3 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md shrink-0 text-white"
                      style={{ backgroundColor: meta.color || '#6b7280' }}
                    >
                      <Server className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{meta.name}</p>
                      <code className="text-[9px] text-muted-foreground">{meta.slug}</code>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{meta.description}</p>
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {meta.capabilities.slice(0, 3).map((c) => (
                      <Badge key={c} variant="secondary" className={cn('text-[8px] px-1 py-0', MODALITY_COLORS[c] || 'bg-muted')}>
                        {c}
                      </Badge>
                    ))}
                    {meta.capabilities.length > 3 && (
                      <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-muted text-muted-foreground">
                        +{meta.capabilities.length - 3}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Step 2: connect form
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 text-white"
                  style={{ backgroundColor: selected.color || '#6b7280' }}
                >
                  <Server className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{selected.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{selected.description}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected(null)}>
                  <ChevronLeft className="h-3 w-3 mr-1" /> Back
                </Button>
              </div>

              {selected.isCustom && (
                <>
                  <div>
                    <Label className="text-xs">Base URL</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      placeholder="https://api.example.com/v1"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Auth Type</Label>
                    <Select value={authType} onValueChange={(v) => setAuthType(v as AuthType)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AUTH_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Custom Headers (JSON, optional)</Label>
                    <Textarea
                      className="mt-1 font-mono text-xs"
                      rows={3}
                      placeholder='{"X-Custom-Header": "value"}'
                      value={headers}
                      onChange={(e) => setHeaders(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Capabilities</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {ALL_CAPS.map((c) => {
                        const Icon = MODALITY_ICONS[c]
                        const on = capabilities.includes(c)
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleCap(c)}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors',
                              on
                                ? (MODALITY_COLORS[c] || 'bg-amber-500/10 text-amber-600 border-amber-500/30')
                                : 'bg-background text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {Icon && <Icon className="h-2.5 w-2.5" />}
                            {c}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs">API Key</Label>
                <Input
                  type="password"
                  className="mt-1 font-mono text-xs"
                  placeholder="paste API key here…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {selected.docsUrl ? (
                    <a href={selected.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-amber-600">
                      Get your API key <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : (
                    'Your key will be encrypted at rest.'
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {selected && (
            <Button onClick={connect} disabled={connecting} className="bg-amber-600 hover:bg-amber-700 text-white">
              {connecting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plug className="h-4 w-4 mr-1.5" />}
              Validate &amp; Connect
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------------------------
 * EditProviderDialog — extended settings form
 * -------------------------------------------------------------------------- */

function EditProviderDialog({
  provider, allProviders, onClose, onSaved,
}: {
  provider: Provider
  allProviders: Provider[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    baseUrl: provider.baseUrl || '',
    authType: (provider.authType as AuthType) || 'bearer',
    headers: stringifyHeaders(provider.headers),
    dailyBudget: provider.dailyBudget || 0,
    monthlyBudget: provider.monthlyBudget || 0,
    timeout: provider.timeout ?? 30,
    retries: provider.retries ?? 2,
    concurrency: provider.concurrency ?? 5,
    priority: provider.priority ?? 0,
    defaultStrategy: provider.defaultStrategy || 'smart',
    fallbackProviderId: provider.fallbackProviderId || '',
    description: provider.description || '',
    docsUrl: provider.docsUrl || '',
    webhookSecret: provider.webhookSecret || '',
  })
  const [saving, setSaving] = useState(false)

  const AUTH_TYPES: Array<{ value: AuthType; label: string }> = [
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'x-api-key', label: 'X-API-Key Header' },
    { value: 'custom-header', label: 'Custom Header' },
    { value: 'query-param', label: 'Query Parameter' },
  ]

  const STRATS = ['smart', 'cost', 'quality', 'round_robin', 'fast', 'balanced', 'best', 'creative', 'reasoning']

  const submit = async () => {
    setSaving(true)
    // Validate headers JSON if provided
    let headersValue: string | undefined
    if (form.headers.trim()) {
      try {
        JSON.parse(form.headers)
        headersValue = form.headers.trim()
      } catch {
        toast.error('Headers must be valid JSON')
        setSaving(false)
        return
      }
    }
    const patch: Record<string, unknown> = {
      id: provider.id,
      baseUrl: form.baseUrl || null,
      authType: form.authType,
      headers: headersValue || null,
      dailyBudget: Number(form.dailyBudget),
      monthlyBudget: Number(form.monthlyBudget),
      timeout: Number(form.timeout),
      retries: Number(form.retries),
      concurrency: Number(form.concurrency),
      priority: Number(form.priority),
      defaultStrategy: form.defaultStrategy,
      fallbackProviderId: form.fallbackProviderId || null,
      description: form.description || null,
      docsUrl: form.docsUrl || null,
      webhookSecret: form.webhookSecret || null,
    }
    const ok = await mutate('/api/admin/providers', 'PUT', patch, `${provider.name} updated`)
    setSaving(false)
    if (ok.ok) onSaved()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-amber-500" /> Edit {provider.name}
          </DialogTitle>
          <DialogDescription>Configure connection, budgets, retries, and fallback provider.</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 py-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Base URL</Label>
            <Input
              className="mt-1 font-mono text-xs"
              placeholder="https://api.example.com/v1"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs">Auth Type</Label>
            <Select value={form.authType} onValueChange={(v) => setForm({ ...form, authType: v as AuthType })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUTH_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Default Strategy</Label>
            <Select value={form.defaultStrategy} onValueChange={(v) => setForm({ ...form, defaultStrategy: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STRATS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label className="text-xs">Custom Headers (JSON)</Label>
            <Textarea
              className="mt-1 font-mono text-xs"
              rows={2}
              placeholder='{"X-Org-Id": "abc123"}'
              value={form.headers}
              onChange={(e) => setForm({ ...form, headers: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs">Daily Budget ($)</Label>
            <Input
              type="number" step="0.01" min="0"
              className="mt-1"
              value={form.dailyBudget}
              onChange={(e) => setForm({ ...form, dailyBudget: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">Monthly Budget ($)</Label>
            <Input
              type="number" step="0.01" min="0"
              className="mt-1"
              value={form.monthlyBudget}
              onChange={(e) => setForm({ ...form, monthlyBudget: Number(e.target.value) })}
            />
          </div>

          <div>
            <Label className="text-xs">Timeout (sec)</Label>
            <Input
              type="number" min="1"
              className="mt-1"
              value={form.timeout}
              onChange={(e) => setForm({ ...form, timeout: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">Retries</Label>
            <Input
              type="number" min="0" max="10"
              className="mt-1"
              value={form.retries}
              onChange={(e) => setForm({ ...form, retries: Number(e.target.value) })}
            />
          </div>

          <div>
            <Label className="text-xs">Concurrency</Label>
            <Input
              type="number" min="1" max="100"
              className="mt-1"
              value={form.concurrency}
              onChange={(e) => setForm({ ...form, concurrency: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">Priority (lower = higher)</Label>
            <Input
              type="number" min="0"
              className="mt-1"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            />
          </div>

          <div>
            <Label className="text-xs">Fallback Provider</Label>
            <Select
              value={form.fallbackProviderId || 'none'}
              onValueChange={(v) => setForm({ ...form, fallbackProviderId: v === 'none' ? '' : v })}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No fallback</SelectItem>
                {allProviders.filter((p) => p.id !== provider.id).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label className="text-xs">Webhook Secret (optional)</Label>
            <Input
              className="mt-1 font-mono text-xs"
              placeholder="whsec_…"
              value={form.webhookSecret}
              onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="text-xs">Docs URL</Label>
            <Input
              className="mt-1 font-mono text-xs"
              placeholder="https://docs.example.com"
              value={form.docsUrl}
              onChange={(e) => setForm({ ...form, docsUrl: e.target.value })}
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              className="mt-1 text-xs"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={submit} className="bg-amber-600 hover:bg-amber-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------------------------
 * ModelsDialog — wide modal containing the ModelsTable
 * -------------------------------------------------------------------------- */

function ModelsDialog({
  open, provider, syncing, onSyncModels, onClose,
}: {
  open: boolean
  provider?: Provider
  syncing: boolean
  onSyncModels: () => void
  onClose: () => void
}) {
  if (!provider) return null
  const lastSync = provider.lastSyncAt || provider.lastHealthCheck

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-500" /> Models
            <span className="text-muted-foreground font-normal">· {provider.name}</span>
            <Badge variant="secondary" className="text-[10px] ml-1">{provider.modelsCount} models</Badge>
          </DialogTitle>
          <DialogDescription>
            Manage models for this provider. Click pricing to edit, toggle active/default, or sync to discover new models.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <ModelsTable provider={provider} onSyncModels={onSyncModels} syncing={syncing} lastSync={lastSync} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------------------------
 * ModelsTable — per-provider models table (used inside ModelsDialog)
 * -------------------------------------------------------------------------- */

function ModelsTable({
  provider, onSyncModels, syncing, lastSync,
}: {
  provider: Provider
  onSyncModels: () => void
  syncing: boolean
  lastSync: string | null | undefined
}) {
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editingPricing, setEditingPricing] = useState<ProviderModel | null>(null)

  const toggleField = async (m: ProviderModel, field: 'isActive' | 'isDefault', v: boolean) => {
    setTogglingId(m.id)
    await mutate('/api/admin/models', 'PUT', { id: m.id, [field]: v }, `${m.displayName} ${field} ${v ? 'on' : 'off'}`)
    setTogglingId(null)
  }

  const updatePricing = async (m: ProviderModel, inputCost: number, outputCost: number) => {
    setTogglingId(m.id)
    const ok = await mutate('/api/admin/models', 'PUT', {
      id: m.id,
      inputCostPer1k: inputCost,
      outputCostPer1k: outputCost,
      isCustomPricing: true,
    }, `${m.displayName} pricing updated`)
    setTogglingId(null)
    if (ok.ok) setEditingPricing(null)
  }

  if (provider.models.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">No models synced yet.</p>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={syncing} onClick={onSyncModels}>
            {syncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Sync Now
          </Button>
        </div>
        <EmptyState icon={Cpu} message="Click 'Sync Now' to discover available models." />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {provider.models.length} models
          {lastSync && <> · last synced {timeAgo(lastSync)}</>}
        </p>
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={syncing} onClick={onSyncModels}>
          {syncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Refresh
        </Button>
      </div>

      <div className="max-h-72 overflow-y-auto scroll-thin rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card border-b">
            <tr className="text-left text-[9px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5 font-medium">Name</th>
              <th className="px-2 py-1.5 font-medium">Modality</th>
              <th className="px-2 py-1.5 font-medium text-right">Context</th>
              <th className="px-2 py-1.5 font-medium text-right">In/Out $/1k</th>
              <th className="px-2 py-1.5 font-medium">Capabilities</th>
              <th className="px-2 py-1.5 font-medium text-center">Active</th>
              <th className="px-2 py-1.5 font-medium text-center">Default</th>
            </tr>
          </thead>
          <tbody>
            {provider.models.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-2 py-1.5">
                  <p className="font-medium truncate max-w-[120px]">{m.displayName}</p>
                  <code className="text-[9px] text-muted-foreground truncate block max-w-[120px]">{m.name}</code>
                </td>
                <td className="px-2 py-1.5">
                  <Badge variant="secondary" className={cn('text-[8px] px-1 py-0', MODALITY_COLORS[m.modality] || 'bg-muted')}>
                    {m.modality}
                  </Badge>
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-[10px]">
                  {fmtCtx(m.contextWindow)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-[10px]">
                  <button
                    onClick={() => setEditingPricing(m)}
                    className="hover:text-amber-600 hover:underline"
                    title="Click to edit pricing"
                  >
                    ${m.inputCostPer1k}/${m.outputCostPer1k}
                  </button>
                  {m.isCustomPricing && (
                    <span className="ml-1 text-amber-500" title="Custom pricing">★</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <CapIconBadges model={m} />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <Switch
                    checked={m.isActive}
                    disabled={togglingId === m.id}
                    onCheckedChange={(v) => toggleField(m, 'isActive', v)}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => toggleField(m, 'isDefault', !m.isDefault)}
                    disabled={togglingId === m.id}
                    className="p-1"
                    title={m.isDefault ? 'Default model' : 'Set as default'}
                  >
                    <Star className={cn('h-3.5 w-3.5', m.isDefault ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground hover:text-amber-500')} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingPricing && (
        <PricingEditDialog
          model={editingPricing}
          saving={togglingId === editingPricing.id}
          onClose={() => setEditingPricing(null)}
          onSave={updatePricing}
        />
      )}
    </div>
  )
}

function PricingEditDialog({
  model, saving, onClose, onSave,
}: {
  model: ProviderModel
  saving: boolean
  onClose: () => void
  onSave: (m: ProviderModel, inputCost: number, outputCost: number) => void
}) {
  const [inputCost, setInputCost] = useState(model.inputCostPer1k)
  const [outputCost, setOutputCost] = useState(model.outputCostPer1k)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-500" /> Edit Pricing
          </DialogTitle>
          <DialogDescription>
            Set custom pricing for <span className="font-medium text-amber-600">{model.displayName}</span>.
            Once saved, the model is marked as having custom pricing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label className="text-xs">Input Cost ($/1k tokens)</Label>
            <Input
              type="number" step="0.0001" min="0"
              className="mt-1"
              value={inputCost}
              onChange={(e) => setInputCost(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs">Output Cost ($/1k tokens)</Label>
            <Input
              type="number" step="0.0001" min="0"
              className="mt-1"
              value={outputCost}
              onChange={(e) => setOutputCost(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={() => onSave(model, inputCost, outputCost)}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save Pricing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ============================================================================
 * 3. API Keys — all keys across providers with rotate dialog
 * ========================================================================== */

export function ApiKeysPanel() {
  const { data: provData, loading: l1, refetch } = useApi<{ providers: Provider[] }>('/api/admin/providers')
  const [keys, setKeys] = useState<Array<ProviderKey & { providerName: string; providerSlug: string }>>([])
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [rotating, setRotating] = useState<{ id: string; name: string } | null>(null)
  const [newKey, setNewKey] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch detailed keys for each provider in parallel
  useEffect(() => {
    if (!provData?.providers?.length) return
    let active = true
    setLoadingKeys(true)
    Promise.all(
      provData.providers.map(async (p) => {
        try {
          const res = await fetch(`/api/admin/providers/${p.id}`)
          if (!res.ok) return [] as Array<ProviderKey & { providerName: string; providerSlug: string }>
          const d = (await res.json()) as { provider: { keys: ProviderKey[] } }
          return d.provider.keys.map((k) => ({
            ...k,
            providerName: p.name,
            providerSlug: p.slug,
          }))
        } catch {
          return [] as Array<ProviderKey & { providerName: string; providerSlug: string }>
        }
      })
    ).then((results) => {
      if (!active) return
      setKeys(results.flat())
      setLoadingKeys(false)
    })
    return () => { active = false }
  }, [provData])

  const doRotate = async () => {
    if (!rotating) return
    if (newKey.trim().length < 8) {
      toast.error('Key must be at least 8 characters')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/providers/${rotating.id}/rotate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newKey }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error((d as { error?: string }).error || 'Rotate failed')
      toast.success(`${rotating.name} key rotated`)
      setRotating(null)
      setNewKey('')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rotate failed')
    } finally {
      setSaving(false)
    }
  }

  if (l1) return <LoadingBlock />

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <KeySquare className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            All API keys across providers. Plain-text keys are never returned by the API — only the
            <span className="font-medium text-amber-600"> masked</span> value is shown here.
            Rotate keys regularly for security.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loadingKeys ? (
            <div className="p-4 space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}
            </div>
          ) : keys.length === 0 ? (
            <EmptyState icon={KeyRound} message="No API keys configured. Add keys via the Providers tab." />
          ) : (
            <div className="max-h-[600px] overflow-y-auto scroll-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 font-medium">Label</th>
                    <th className="px-3 py-2 font-medium">Masked Key</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Last Used</th>
                    <th className="px-3 py-2 font-medium">Last Rotated</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k, i) => (
                    <motion.tr
                      key={k.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.01, 0.2) }}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Server className="h-3.5 w-3.5 text-amber-500" />
                          <div>
                            <p className="text-xs font-medium">{k.providerName}</p>
                            <code className="text-[10px] text-muted-foreground">{k.providerSlug}</code>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{k.label || 'Primary'}</td>
                      <td className="px-3 py-2.5">
                        <code className="text-[11px] font-mono text-muted-foreground">{k.maskedValue || '—'}</code>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="secondary" className={cn('text-[10px]', k.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                          {k.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                        {k.lastUsedAt ? timeAgo(k.lastUsedAt) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                        {k.lastRotatedAt ? timeAgo(k.lastRotatedAt) : 'never'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={!k.isActive}
                          onClick={() => {
                            setRotating({ id: k.providerId || '', name: k.providerName })
                            setNewKey('')
                          }}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />Rotate
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rotating} onOpenChange={(o) => !o && setRotating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-500" /> Rotate Key
            </DialogTitle>
            <DialogDescription>
              Enter the new API key for <span className="font-medium text-amber-600">{rotating?.name}</span>.
              The old key will be deactivated and stored in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs">New API Key</Label>
            <Textarea
              className="mt-1 font-mono text-xs"
              rows={3}
              placeholder="paste new key..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotating(null)}>Cancel</Button>
            <Button disabled={saving} onClick={doRotate}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
              Rotate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ============================================================================
 * 4. Models — filter by provider/modality, default + active toggles, add dialog
 * ========================================================================== */

export function ModelsPanel() {
  const [providerFilter, setProviderFilter] = useState('all')
  const [modalityFilter, setModalityFilter] = useState('all')
  const query = useMemo(
    () => {
      const params = new URLSearchParams()
      if (providerFilter !== 'all') params.set('providerId', providerFilter)
      if (modalityFilter !== 'all') params.set('modality', modalityFilter)
      const q = params.toString()
      return `/api/admin/models${q ? `?${q}` : ''}`
    },
    [providerFilter, modalityFilter],
  )
  const { data, loading, refetch } = useApi<{ models: ModelRow[] }>(query)
  const { data: provData } = useApi<{ providers: Provider[] }>('/api/admin/providers')
  const [adding, setAdding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const toggleField = async (m: ModelRow, field: 'isActive' | 'isDefault', v: boolean) => {
    setTogglingId(m.id)
    const ok = await mutate('/api/admin/models', 'PUT', { id: m.id, [field]: v }, `${m.displayName} ${field} ${v ? 'on' : 'off'}`)
    setTogglingId(null)
    if (ok.ok) refetch()
  }

  if (loading || !data) return <LoadingBlock />

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All Providers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              {provData?.providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={modalityFilter} onValueChange={setModalityFilter}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Modalities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modalities</SelectItem>
              {MODALITIES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{data.models.length} models</span>
            <Button size="sm" className="h-8" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Model
            </Button>
          </div>
        </CardContent>
      </Card>

      {data.models.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={Cpu} message="No models found. Try adjusting filters." /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[640px] overflow-y-auto scroll-thin pr-1">
          {data.models.map((m, i) => {
            const modColor: Record<string, string> = {
              TEXT: 'bg-amber-500/10 text-amber-600',
              IMAGE: 'bg-violet-500/10 text-violet-600',
              VIDEO: 'bg-violet-500/10 text-violet-600',
              AUDIO: 'bg-sky-500/10 text-sky-600',
              EMBEDDING: 'bg-emerald-500/10 text-emerald-600',
              STT: 'bg-sky-500/10 text-sky-600',
              TTS: 'bg-sky-500/10 text-sky-600',
            }
            return (
              <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.displayName}</p>
                        <code className="text-[10px] text-muted-foreground">{m.name}</code>
                      </div>
                      <Badge variant="secondary" className={cn('text-[9px] px-1.5 shrink-0', modColor[m.modality] || 'bg-muted')}>
                        {m.modality}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[9px] bg-amber-500/10 text-amber-600">
                        {m.provider.name}
                      </Badge>
                      {m.isDefault && (
                        <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-600">Default</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                      <div>In: <span className="font-mono text-foreground">${m.inputCostPer1k}/1k</span></div>
                      <div>Out: <span className="font-mono text-foreground">${m.outputCostPer1k}/1k</span></div>
                      <div>Cost ×<span className="font-mono text-foreground">{m.costMultiplier}</span></div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={m.isActive}
                          disabled={togglingId === m.id}
                          onCheckedChange={(v) => toggleField(m, 'isActive', v)}
                        />
                        <span className="text-[10px] text-muted-foreground">Active</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">Default</span>
                        <Switch
                          checked={m.isDefault}
                          disabled={togglingId === m.id}
                          onCheckedChange={(v) => toggleField(m, 'isDefault', v)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {adding && (
        <AddModelDialog
          providers={provData?.providers || []}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); refetch() }}
        />
      )}
    </div>
  )
}

function AddModelDialog({
  providers, onClose, onSaved,
}: {
  providers: Provider[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    providerId: providers[0]?.id || '',
    name: '',
    displayName: '',
    modality: 'TEXT',
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    costMultiplier: 1,
    isDefault: false,
    isActive: true,
  })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.providerId || !form.name || !form.displayName) {
      toast.error('Provider, name, and display name are required')
      return
    }
    setSaving(true)
    const ok = await mutate('/api/admin/models', 'POST', form, `${form.displayName} created`)
    setSaving(false)
    if (ok.ok) onSaved()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-amber-500" /> Add Model
          </DialogTitle>
          <DialogDescription>Create a new AI model entry on a provider.</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3 py-2">
          <div>
            <Label className="text-xs">Provider</Label>
            <Select value={form.providerId} onValueChange={(v) => setForm({ ...form, providerId: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Modality</Label>
            <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODALITIES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Model Name (API id)</Label>
            <Input className="mt-1 font-mono text-xs" placeholder="gpt-4-turbo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Display Name</Label>
            <Input className="mt-1" placeholder="GPT-4 Turbo" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Input Cost ($/1k tokens)</Label>
            <Input type="number" step="0.0001" min="0" className="mt-1" value={form.inputCostPer1k} onChange={(e) => setForm({ ...form, inputCostPer1k: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Output Cost ($/1k tokens)</Label>
            <Input type="number" step="0.0001" min="0" className="mt-1" value={form.outputCostPer1k} onChange={(e) => setForm({ ...form, outputCostPer1k: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Cost Multiplier</Label>
            <Input type="number" step="0.1" min="0" className="mt-1" value={form.costMultiplier} onChange={(e) => setForm({ ...form, costMultiplier: Number(e.target.value) })} />
          </div>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <span className="text-xs">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
              <span className="text-xs">Default</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Create Model
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ============================================================================
 * 5. Routing — 14 categories with provider + fallback + strategy
 * ========================================================================== */

export function RoutingPanel() {
  const { data: routeData, loading: l1, refetch } = useApi<{ routes: RouteRow[] }>('/api/admin/routing')
  const { data: provData } = useApi<{ providers: Provider[] }>('/api/admin/providers')
  const [drafts, setDrafts] = useState<Record<string, { providerId: string; fallbackProviderId: string; strategy: string; isActive: boolean }>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const activeProviders = useMemo(() => (provData?.providers || []).filter((p) => p.isActive), [provData])

  // Build a category -> route map
  const routeMap = useMemo(() => {
    const m = new Map<string, RouteRow>()
    routeData?.routes.forEach((r) => m.set(r.toolCategory, r))
    return m
  }, [routeData])

  if (l1 || !routeData) return <LoadingBlock />

  const getDraft = (cat: string, r: RouteRow | undefined) => {
    if (drafts[cat]) return drafts[cat]
    return {
      providerId: r?.providerId || '',
      fallbackProviderId: r?.fallbackProviderId || '',
      strategy: r?.strategy || 'smart',
      isActive: r?.isActive ?? true,
    }
  }

  const save = async (cat: string) => {
    const r = routeMap.get(cat)
    if (!r) {
      toast.error('Route not found — seed it first via API')
      return
    }
    const draft = getDraft(cat, r)
    setSaving(cat)
    const ok = await mutate('/api/admin/routing', 'PUT', { id: r.id, ...draft }, `${cat} routing updated`)
    setSaving(null)
    if (ok.ok) {
      setDrafts((d) => { const n = { ...d }; delete n[cat]; return n })
      refetch()
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <ArrowRightLeft className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Smart routing maps each tool category to a primary provider with optional fallback.
            Strategy <code className="font-mono text-amber-600">smart</code> picks the best model per request,
            <code className="font-mono text-amber-600"> cost</code> optimizes for spend,
            <code className="font-mono text-amber-600"> quality</code> picks highest capability,
            <code className="font-mono text-amber-600"> round_robin</code> distributes load.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ROUTE_CATEGORIES.map(({ name, desc }) => {
          const r = routeMap.get(name)
          const draft = getDraft(name, r)
          return (
            <Card key={name}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={draft.isActive}
                    onCheckedChange={(v) => setDrafts((d) => ({ ...d, [name]: { ...draft, isActive: v } }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Provider</Label>
                    <Select
                      value={draft.providerId || 'none'}
                      onValueChange={(v) => setDrafts((d) => ({ ...d, [name]: { ...draft, providerId: v === 'none' ? '' : v } }))}
                    >
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {activeProviders.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Fallback</Label>
                    <Select
                      value={draft.fallbackProviderId || 'none'}
                      onValueChange={(v) => setDrafts((d) => ({ ...d, [name]: { ...draft, fallbackProviderId: v === 'none' ? '' : v } }))}
                    >
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {activeProviders.filter((p) => p.id !== draft.providerId).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground">Strategy</Label>
                  <Select
                    value={draft.strategy}
                    onValueChange={(v) => setDrafts((d) => ({ ...d, [name]: { ...draft, strategy: v } }))}
                  >
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-7 ml-auto text-xs" disabled={saving === name} onClick={() => save(name)}>
                    {saving === name ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================================
 * 6. Credits — totals + recent transactions
 * ========================================================================== */

export function CreditsPanel() {
  const { data, loading } = useApi<CreditsData>('/api/admin/credits')
  if (loading || !data) return <LoadingBlock />

  const { summary, recent } = data
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Coins} label="Total Issued" value={formatNumber(summary.totalIssued)} accent="emerald" />
        <StatCard icon={TrendingDown} label="Total Spent" value={formatNumber(summary.totalSpent)} accent="red" />
        <StatCard icon={Wallet} label="In Circulation" value={formatNumber(summary.inCirculation)} accent="amber" />
        <StatCard icon={UserCheck} label="Active Users" value={formatNumber(summary.totalUsers)} accent="sky" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4 text-amber-500" /> Recent Transactions
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">Last 20</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <EmptyState icon={Coins} message="No transactions yet." />
          ) : (
            <div className="max-h-[500px] overflow-y-auto scroll-thin">
              {recent.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/40"
                >
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', t.amount >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600')}>
                    {t.amount >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.reason}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.user?.name || t.user?.email || 'Unknown'} · {timeAgo(t.createdAt)}
                    </p>
                  </div>
                  <span className={cn('text-sm font-semibold tabular-nums', t.amount >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {t.amount >= 0 ? '+' : ''}{formatNumber(t.amount)} cr
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// local icon for credits panel
function Wallet({ className }: { className?: string }) {
  return <Coins className={className} />
}

/* ============================================================================
 * 7. Storage — per-workspace usage with quota update
 * ========================================================================== */

export function StoragePanel() {
  const { data, loading, refetch } = useApi<StorageData>('/api/admin/storage')
  const [editing, setEditing] = useState<StorageWorkspace | null>(null)
  const [newQuota, setNewQuota] = useState('10')
  const [saving, setSaving] = useState(false)

  if (loading || !data) return <LoadingBlock />

  const submitQuota = async () => {
    if (!editing) return
    const gb = Number(newQuota)
    if (!Number.isFinite(gb) || gb < 0) {
      toast.error('Quota must be a non-negative number')
      return
    }
    setSaving(true)
    const ok = await mutate('/api/admin/storage', 'PATCH', {
      workspaceId: editing.workspaceId,
      quotaBytes: Math.floor(gb * 1024 * 1024 * 1024),
    }, 'Quota updated')
    setSaving(false)
    if (ok.ok) {
      setEditing(null)
      refetch()
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={HardDrive} label="Total Used" value={fmtBytes(data.totals.total)} accent="sky" />
        <StatCard icon={Database} label="Quota" value={fmtBytes(data.totals.quota)} accent="emerald" />
        <StatCard icon={Layers} label="Workspaces" value={data.totals.workspaceCount} accent="amber" />
        <StatCard icon={Boxes} label="Asset Count" value={formatNumber(data.totals.assets)} accent="violet" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-amber-500" /> Per-Workspace Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.workspaces.length === 0 ? (
            <EmptyState icon={HardDrive} message="No workspace storage records yet." />
          ) : (
            <div className="max-h-[500px] overflow-y-auto scroll-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Workspace</th>
                    <th className="px-3 py-2 font-medium text-right">Images</th>
                    <th className="px-3 py-2 font-medium text-right">Videos</th>
                    <th className="px-3 py-2 font-medium text-right">Audio</th>
                    <th className="px-3 py-2 font-medium text-right">Docs</th>
                    <th className="px-3 py-2 font-medium text-right">Total</th>
                    <th className="px-3 py-2 font-medium">Usage</th>
                    <th className="px-3 py-2 font-medium text-right">Assets</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workspaces.map((w) => {
                    const pct = w.usagePercent
                    const accent = pct >= 90 ? 'red' : pct >= 70 ? 'amber' : 'emerald'
                    return (
                      <tr key={w.workspaceId} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2.5">
                          <code className="text-xs font-mono">{w.workspaceId}</code>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-right tabular-nums">{fmtBytes(w.imagesBytes)}</td>
                        <td className="px-3 py-2.5 text-xs text-right tabular-nums">{fmtBytes(w.videosBytes)}</td>
                        <td className="px-3 py-2.5 text-xs text-right tabular-nums">{fmtBytes(w.audioBytes)}</td>
                        <td className="px-3 py-2.5 text-xs text-right tabular-nums">{fmtBytes(w.documentsBytes)}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-semibold tabular-nums">{fmtBytes(w.totalBytes)}</td>
                        <td className="px-3 py-2.5 w-32">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={pct} accent={accent} />
                            <span className="text-[10px] tabular-nums w-8 text-right">{Math.round(pct)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-right tabular-nums">{w.assetCount || 0}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditing(w)
                              setNewQuota(((w.quotaBytes || 0) / 1024 / 1024 / 1024).toFixed(1))
                            }}
                          >
                            <Settings2 className="h-3 w-3 mr-1" />Quota
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-amber-500" /> Update Storage Quota
            </DialogTitle>
            <DialogDescription>
              Set the storage limit for <code className="font-mono">{editing?.workspaceId}</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-[10px] text-muted-foreground">Used</p>
                <p className="font-semibold tabular-nums">{editing ? fmtBytes(editing.totalBytes) : '—'}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-[10px] text-muted-foreground">Current Quota</p>
                <p className="font-semibold tabular-nums">{editing ? fmtBytes(editing.quotaBytes) : '—'}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-[10px] text-muted-foreground">Usage</p>
                <p className="font-semibold tabular-nums">{editing ? Math.round(editing.usagePercent) : 0}%</p>
              </div>
            </div>
            <div>
              <Label className="text-xs">New Quota (GB)</Label>
              <Input type="number" step="0.1" min="0" className="mt-1" value={newQuota} onChange={(e) => setNewQuota(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={saving} onClick={submitQuota}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Quota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ============================================================================
 * 8. Jobs — async AI job queue with status filter + view dialog
 * ========================================================================== */

export function JobsPanel() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<JobRow | null>(null)
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    return `/api/admin/jobs?${params.toString()}`
  }, [page, statusFilter])
  const { data, loading, refetch } = useApi<{ jobs: JobRow[]; total: number; totalPages: number; stats: JobStats }>(query, [page, statusFilter])

  const cancelJob = async (j: JobRow) => {
    const ok = await mutate(`/api/admin/jobs/${j.id}`, 'PATCH', { status: 'CANCELLED', errorMessage: 'Cancelled by admin' }, `Job ${j.id.slice(-6)} cancelled`)
    if (ok.ok) refetch()
  }

  if (loading || !data) return <LoadingBlock />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Clock} label="Queued" value={data.stats.queued} accent="sky" />
        <StatCard icon={Loader2} label="Rendering" value={data.stats.rendering} accent="amber" />
        <StatCard icon={Cpu} label="Processing" value={data.stats.processing} accent="amber" />
        <StatCard icon={Check} label="Completed" value={data.stats.completed} accent="emerald" />
        <StatCard icon={XCircle} label="Failed" value={data.stats.failed} accent="red" />
      </div>

      <Card>
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">{data.total} total jobs</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {data.jobs.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No jobs in this view." />
          ) : (
            <div className="max-h-[500px] overflow-y-auto scroll-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Prompt</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium w-32">Progress</th>
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.map((j, i) => (
                    <motion.tr
                      key={j.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.01, 0.2) }}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2.5">
                        <Badge variant="secondary" className="text-[9px] bg-violet-500/10 text-violet-600">{j.type}</Badge>
                      </td>
                      <td className="px-3 py-2.5 max-w-xs">
                        <p className="text-xs truncate">{j.prompt || '(no prompt)'}</p>
                        <code className="text-[10px] text-muted-foreground">{j.id.slice(-8)}</code>
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={j.status} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            value={j.progress}
                            accent={j.status === 'FAILED' ? 'red' : j.status === 'COMPLETED' ? 'emerald' : 'amber'}
                          />
                          <span className="text-[10px] tabular-nums w-8">{j.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{j.provider?.name || '—'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{timeAgo(j.createdAt)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setViewing(j)}>
                            <EyeIcon className="h-3 w-3 mr-1" />View
                          </Button>
                          {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status) && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => cancelJob(j)}>
                              <XCircle className="h-3 w-3 mr-1" />Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} / {data.totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-amber-500" /> Job Detail
            </DialogTitle>
            <DialogDescription>
              <code className="font-mono">{viewing?.id}</code>
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">Type</p>
                  <p className="font-medium">{viewing.type}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">Status</p>
                  <StatusBadge status={viewing.status} />
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">Progress</p>
                  <p className="font-medium tabular-nums">{viewing.progress}%</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">Cost</p>
                  <p className="font-medium tabular-nums">{fmtMoney(viewing.costUsd)} · {viewing.creditsUsed}cr</p>
                </div>
              </div>
              <div>
                <Label className="text-xs">Prompt</Label>
                <Textarea className="mt-1 text-xs" rows={3} value={viewing.prompt} readOnly />
              </div>
              <div>
                <Label className="text-xs">Params</Label>
                <pre className="mt-1 text-[10px] font-mono bg-muted/50 p-2 rounded-md max-h-32 overflow-y-auto scroll-thin">
                  {(() => { try { return JSON.stringify(JSON.parse(viewing.params), null, 2) } catch { return viewing.params } })()}
                </pre>
              </div>
              {viewing.errorMessage && (
                <div className="rounded-md bg-red-500/10 p-2">
                  <p className="text-[10px] font-medium text-red-600">Error</p>
                  <p className="text-xs text-red-700">{viewing.errorMessage}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Provider:</span> {viewing.provider?.name || '—'}</div>
                <div><span className="text-muted-foreground">User:</span> {viewing.user?.name || viewing.user?.email || '—'}</div>
                <div><span className="text-muted-foreground">External ID:</span> {viewing.externalId || '—'}</div>
                <div><span className="text-muted-foreground">Created:</span> {new Date(viewing.createdAt).toLocaleString()}</div>
                {viewing.startedAt && <div><span className="text-muted-foreground">Started:</span> {timeAgo(viewing.startedAt)}</div>}
                {viewing.completedAt && <div><span className="text-muted-foreground">Completed:</span> {timeAgo(viewing.completedAt)}</div>}
              </div>
              {viewing.resultUrl && (
                <div>
                  <Label className="text-xs">Result URL</Label>
                  <Input className="mt-1 text-xs font-mono" value={viewing.resultUrl} readOnly />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ============================================================================
 * 9. Monitoring — real-time metrics
 * ========================================================================== */

export function MonitoringPanel() {
  const { data, loading, refetch } = useApi<MonitoringData>('/api/admin/monitoring')
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => refetch(), 15000)
    return () => clearInterval(id)
  }, [autoRefresh, refetch])

  if (loading || !data) return <LoadingBlock />

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <CircleDot className="h-3.5 w-3.5 text-amber-500" />
            Last refresh: {timeAgo(data.timestamp)}
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <span className="text-xs text-muted-foreground">Auto (15s)</span>
            </label>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3 mr-1" />Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Server} label="Active Providers" value={`${data.providers.active}/${data.providers.total}`} accent="emerald" />
        <StatCard icon={Zap} label="Today Requests" value={formatNumber(data.today.requests)} accent="amber" />
        <StatCard icon={Check} label="Success Rate" value={`${data.today.successRate.toFixed(1)}%`} accent={data.today.successRate >= 95 ? 'emerald' : 'red'} />
        <StatCard icon={Gauge} label="Avg Latency" value={`${Math.round(data.today.avgLatencyMs)}ms`} accent="sky" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4 text-amber-500" /> Per-Provider Health
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto scroll-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 font-medium">Health</th>
                    <th className="px-3 py-2 font-medium text-right">Req</th>
                    <th className="px-3 py-2 font-medium text-right">Cost</th>
                    <th className="px-3 py-2 font-medium text-right">Failures</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perProviderHealth.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium">{p.name}</p>
                        <code className="text-[10px] text-muted-foreground">{p.slug}</code>
                      </td>
                      <td className="px-3 py-2.5">
                        <HealthDot healthy={p.isHealthy} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right tabular-nums">{p.todayRequests}</td>
                      <td className="px-3 py-2.5 text-xs text-right tabular-nums">{p.todayCost > 0 ? fmtMoney(p.todayCost) : '—'}</td>
                      <td className={cn('px-3 py-2.5 text-xs text-right tabular-nums', p.todayFailures > 0 ? 'text-red-600' : '')}>
                        {p.todayFailures}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Top Failing Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.topFailingTools.length === 0 ? (
                <EmptyState icon={Check} message="No failing tools in the last 24h. All good!" />
              ) : (
                <div className="space-y-2">
                  {data.topFailingTools.map((t) => (
                    <div key={t.toolSlug} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                        <code className="text-xs font-mono">{t.toolSlug || 'unknown'}</code>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-600">{t.count} fails</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', data.rateLimitedLastHour > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600')}>
                {data.rateLimitedLastHour > 0 ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-sm font-semibold tabular-nums">{data.rateLimitedLastHour}</p>
                <p className="text-xs text-muted-foreground">Rate-limited requests (last hour)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                <HardDrive className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold tabular-nums">{fmtBytes(data.storage.totalBytes)}</p>
                <p className="text-xs text-muted-foreground">{data.storage.workspaceCount} workspaces tracked</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
 * 10. Logs — paginated audit trail with filters
 * ========================================================================== */

export function LogsPanel() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    providerId: 'all',
    status: 'all',
    toolSlug: '',
    routeCategory: 'all',
    requestType: 'all',
    from: '',
    to: '',
  })

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: '25' })
    if (filters.providerId !== 'all') p.set('providerId', filters.providerId)
    if (filters.status !== 'all') p.set('status', filters.status)
    if (filters.toolSlug.trim()) p.set('toolSlug', filters.toolSlug.trim())
    if (filters.routeCategory !== 'all') p.set('routeCategory', filters.routeCategory)
    if (filters.requestType !== 'all') p.set('requestType', filters.requestType)
    if (filters.from) p.set('from', filters.from)
    if (filters.to) p.set('to', filters.to)
    return `/api/admin/logs?${p.toString()}`
  }, [page, filters])

  const { data: provData } = useApi<{ providers: Provider[] }>('/api/admin/providers')
  const { data, loading } = useApi<{ logs: LogRow[]; total: number; totalPages: number }>(query, [page, filters])

  const update = (k: keyof typeof filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }))
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <Select value={filters.providerId} onValueChange={(v) => update('providerId', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Provider" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              {provData?.providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => update('status', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {LOG_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            className="h-8 text-xs"
            placeholder="Tool slug"
            value={filters.toolSlug}
            onChange={(e) => update('toolSlug', e.target.value)}
          />
          <Select value={filters.routeCategory} onValueChange={(v) => update('routeCategory', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {ROUTE_CATEGORIES.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.requestType} onValueChange={(v) => update('requestType', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {REQUEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="h-8 text-xs" value={filters.from} onChange={(e) => update('from', e.target.value)} />
          <Input type="date" className="h-8 text-xs" value={filters.to} onChange={(e) => update('to', e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 rounded-md" />)}</div>
          ) : !data || data.logs.length === 0 ? (
            <EmptyState icon={FileText} message="No logs match these filters." />
          ) : (
            <div className="max-h-[600px] overflow-y-auto scroll-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 font-medium">Tool</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Duration</th>
                    <th className="px-3 py-2 font-medium text-right">Tokens</th>
                    <th className="px-3 py-2 font-medium text-right">Cost</th>
                    <th className="px-3 py-2 font-medium">User</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log, i) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.005, 0.2) }}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{log.provider?.name || '—'}</td>
                      <td className="px-3 py-2.5"><code className="text-[11px] font-mono">{log.toolSlug || '—'}</code></td>
                      <td className="px-3 py-2.5">
                        <Badge variant="secondary" className="text-[9px] bg-muted">{log.requestType}</Badge>
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={log.status} /></td>
                      <td className="px-3 py-2.5 text-xs text-right tabular-nums font-mono">{log.durationMs}ms</td>
                      <td className="px-3 py-2.5 text-xs text-right tabular-nums">
                        {(log.inputTokens + log.outputTokens).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right tabular-nums">
                        {log.costUsd > 0 ? fmtMoney(log.costUsd) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {log.user?.name || log.user?.email || '—'}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} / {data.totalPages} · {data.total} logs</span>
          <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
 * 11. Costs — today/month, 30-day chart, per-provider breakdown, alerts
 * ========================================================================== */

export function CostsPanel() {
  const { data, loading, refetch } = useApi<CostData>('/api/admin/costs')
  if (loading || !data) return <LoadingBlock />

  const maxDaily = Math.max(...data.dailySeries.map((d) => d.totalCostUsd), 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{fmtMoney(data.today.totalCostUsd)}</p>
              <p className="text-xs text-muted-foreground">Today's Cost · {formatNumber(data.today.requests)} req · {data.today.failures} failures</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{fmtMoney(data.thisMonth.totalCostUsd)}</p>
              <p className="text-xs text-muted-foreground">This Month · {formatNumber(data.thisMonth.requests)} req · {data.thisMonth.failures} failures</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-500" /> Daily Cost (Last 30 Days)
            <Button size="sm" variant="ghost" className="h-7 ml-auto text-xs" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3 mr-1" />Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.dailySeries.length === 0 ? (
            <EmptyState icon={BarChart3} message="No cost data yet for the last 30 days." />
          ) : (
            <div className="flex items-end gap-1 h-40 overflow-x-auto scroll-thin pb-1">
              {data.dailySeries.map((d) => {
                const h = Math.max(4, (d.totalCostUsd / maxDaily) * 100)
                return (
                  <div key={d.day} className="flex flex-col items-center gap-1 shrink-0" title={`${d.day}: ${fmtMoney(d.totalCostUsd)}`}>
                    <div
                      className="w-3 bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-sm"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[8px] text-muted-foreground -rotate-45 origin-top whitespace-nowrap">
                      {d.day.slice(5)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4 text-amber-500" /> Per-Provider Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.perProviderBreakdown.length === 0 ? (
              <EmptyState icon={Server} message="No per-provider cost data today." />
            ) : (
              <div className="max-h-80 overflow-y-auto scroll-thin">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Provider</th>
                      <th className="px-3 py-2 font-medium text-right">Cost</th>
                      <th className="px-3 py-2 font-medium text-right">Req</th>
                      <th className="px-3 py-2 font-medium text-right">Fail</th>
                      <th className="px-3 py-2 font-medium w-32">Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perProviderBreakdown.map((p) => {
                      const pct = p.dailyBudget > 0 ? (p.todayCost / p.dailyBudget) * 100 : 0
                      const accent = pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'emerald'
                      return (
                        <tr key={p.providerId} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="px-3 py-2.5">
                            <p className="text-xs font-medium">{p.name}</p>
                            <code className="text-[10px] text-muted-foreground">{p.slug}</code>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right font-semibold tabular-nums">{fmtMoney(p.todayCost)}</td>
                          <td className="px-3 py-2.5 text-xs text-right tabular-nums">{p.todayRequests}</td>
                          <td className={cn('px-3 py-2.5 text-xs text-right tabular-nums', p.todayFailures > 0 ? 'text-red-600' : '')}>
                            {p.todayFailures}
                          </td>
                          <td className="px-3 py-2.5">
                            {p.dailyBudget > 0 ? (
                              <div className="flex items-center gap-2">
                                <ProgressBar value={pct} accent={accent} />
                                <span className="text-[10px] tabular-nums w-10 text-right">{Math.round(pct)}%</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">no budget</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" /> Budget Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.budgetAlerts.length === 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10">
                <Check className="h-5 w-5 text-emerald-600" />
                <p className="text-xs text-emerald-700">All providers within budget. No alerts.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto scroll-thin">
                {data.budgetAlerts.map((a) => (
                  <div
                    key={a.providerId}
                    className={cn(
                      'rounded-lg p-2.5 border',
                      a.level === 'critical' ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold">{a.name}</p>
                      <Badge variant="secondary" className={cn('text-[9px]', a.level === 'critical' ? 'bg-red-500/15 text-red-600' : 'bg-amber-500/15 text-amber-600')}>
                        {a.level}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{a.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Spent {fmtMoney(a.todayCost)} of {fmtMoney(a.dailyBudget)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ============================================================================
 * 12. Security — keys, rate limits, empty-key providers, isolation
 * ========================================================================== */

export function SecurityPanel() {
  const { data, loading, refetch } = useApi<SecurityData>('/api/admin/security')
  const [rateForm, setRateForm] = useState({ minute: 60, hour: 600 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRateForm({
        minute: data.rateLimit.defaultMaxPerMinute,
        hour: data.rateLimit.defaultMaxPerHour,
      })
    }
  }, [data])

  if (loading || !data) return <LoadingBlock />

  const saveRateLimits = async () => {
    setSaving(true)
    const ok = await mutate('/api/admin/security', 'PATCH', {
      defaultRateLimitPerMinute: rateForm.minute,
      defaultRateLimitPerHour: rateForm.hour,
    }, 'Rate limits updated')
    setSaving(false)
    if (ok.ok) refetch()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={KeyRound} label="Total Keys" value={data.apiKeys.total} accent="amber" />
        <StatCard icon={KeySquare} label="Active Keys" value={data.apiKeys.active} accent="emerald" />
        <StatCard icon={AlertCircle} label="Empty Keys" value={data.providersWithEmptyKey.length} accent={data.providersWithEmptyKey.length > 0 ? 'red' : 'emerald'} />
        <StatCard icon={ShieldAlert} label="Failed Auth (24h)" value={data.failedAuthAttempts24h} accent={data.failedAuthAttempts24h > 0 ? 'red' : 'emerald'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4 text-amber-500" /> Rate Limit Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Default Max / Minute</Label>
                <Input type="number" min="1" className="mt-1" value={rateForm.minute} onChange={(e) => setRateForm({ ...rateForm, minute: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Default Max / Hour</Label>
                <Input type="number" min="1" className="mt-1" value={rateForm.hour} onChange={(e) => setRateForm({ ...rateForm, hour: Number(e.target.value) })} />
              </div>
            </div>
            <Button size="sm" disabled={saving} onClick={saveRateLimits}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save Rate Limits
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" /> Workspace Isolation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Workspace-scoped generations</span>
                <span className="text-xs font-semibold tabular-nums">{data.workspaceIsolation.isolationPercent.toFixed(1)}%</span>
              </div>
              <ProgressBar value={data.workspaceIsolation.isolationPercent} accent={data.workspaceIsolation.isolationPercent >= 90 ? 'emerald' : 'amber'} />
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatNumber(data.workspaceIsolation.isolatedCount)} of {formatNumber(data.workspaceIsolation.totalGenerations)} generations are workspace-scoped.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Providers with Empty API Keys
            <Badge variant="secondary" className={cn('text-[10px] ml-2', data.providersWithEmptyKey.length > 0 ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600')}>
              {data.providersWithEmptyKey.length} at risk
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.providersWithEmptyKey.length === 0 ? (
            <div className="flex items-center gap-3 p-4">
              <Check className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-emerald-700">All providers have API keys configured. No security risks detected.</p>
            </div>
          ) : (
            <div className="divide-y">
              {data.providersWithEmptyKey.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.name}</p>
                    <code className="text-[10px] text-muted-foreground">{p.slug}</code>
                  </div>
                  <CapBadges capabilities={p.capabilities} />
                  <Badge variant="secondary" className={cn('text-[10px]', p.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted')}>
                    {p.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" /> Audit Log Retention
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] text-muted-foreground">Retention Days</p>
            <p className="font-semibold tabular-nums">{data.auditRetention.auditLogRetentionDays}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] text-muted-foreground">Key Rotation Days</p>
            <p className="font-semibold tabular-nums">{data.auditRetention.requireApiKeyRotationDays}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] text-muted-foreground">Keys Rotated (30d)</p>
            <p className="font-semibold tabular-nums">{data.apiKeys.rotatedInLast30Days}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] text-muted-foreground">Oldest Log</p>
            <p className="font-semibold">{data.auditRetention.oldestLogAt ? timeAgo(data.auditRetention.oldestLogAt) : '—'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ============================================================================
 * 13. Feature Flags — toggle list
 * ========================================================================== */

export function FlagsPanel() {
  const { data, loading, refetch } = useApi<{ flags: Flag[] }>('/api/admin/flags')

  if (loading || !data) return <LoadingBlock />

  return (
    <div className="space-y-2">
      {data.flags.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={ToggleLeft} message="No feature flags configured." /></CardContent></Card>
      ) : (
        data.flags.map((f, i) => (
          <motion.div key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', f.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                    <ToggleLeft className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{f.name}</p>
                      <code className="text-[10px] text-muted-foreground">{f.key}</code>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={cn('text-[10px]', f.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted')}>
                    {f.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={async (v) => {
                      const ok = await mutate('/api/admin/flags', 'PUT', { id: f.id, enabled: v }, `${f.name} ${v ? 'enabled' : 'disabled'}`)
                      if (ok.ok) refetch()
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))
      )}
    </div>
  )
}
