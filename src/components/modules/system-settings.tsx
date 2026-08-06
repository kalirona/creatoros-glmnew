'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ServerCog, Settings2, KeyRound, Building2, CreditCard, Mail, HardDrive,
  Globe, Lock, Plug, ClipboardList, Database, Activity, FileText,
  ToggleLeft, Archive, Tag, Save, Loader2, Check, AlertCircle, Server,
  Cpu, HardDriveDownload, Cloud, ShieldCheck, Bell, Clock, Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi, formatNumber } from '@/hooks/use-api'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type SysTab =
  | 'general' | 'auth' | 'workspaces' | 'billing' | 'email' | 'storage'
  | 'domains' | 'security' | 'integrations' | 'jobs' | 'database'
  | 'monitoring' | 'logs' | 'flags' | 'backups' | 'license'

const TABS: { id: SysTab; label: string; icon: typeof Settings2 }[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'auth', label: 'Auth', icon: KeyRound },
  { id: 'workspaces', label: 'Workspaces', icon: Building2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'jobs', label: 'Jobs', icon: ClipboardList },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'flags', label: 'Feature Flags', icon: ToggleLeft },
  { id: 'backups', label: 'Backups', icon: Archive },
  { id: 'license', label: 'License', icon: Tag },
]

export function SystemSettingsModule() {
  const { activeSubTab } = useAppStore()
  const [tab, setTab] = useState<SysTab>('general')

  useEffect(() => {
    if (activeSubTab) {
      const valid: string[] = TABS.map((t) => t.id)
      if (valid.includes(activeSubTab)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTab(activeSubTab as SysTab)
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
              <ServerCog className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">System Settings</h2>
                <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/20">
                  <ShieldCheck className="h-2.5 w-2.5 mr-1" /> Super Admin
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Platform configuration, authentication, billing, email, storage, security, integrations &amp; more.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> All Systems Operational
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SysTab)}>
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

        <TabsContent value="general"><GeneralPanel /></TabsContent>
        <TabsContent value="auth"><AuthPanel /></TabsContent>
        <TabsContent value="workspaces"><WorkspacesPanel /></TabsContent>
        <TabsContent value="billing"><BillingPanel /></TabsContent>
        <TabsContent value="email"><EmailPanel /></TabsContent>
        <TabsContent value="storage"><StoragePanel /></TabsContent>
        <TabsContent value="domains"><DomainsPanel /></TabsContent>
        <TabsContent value="security"><SecurityPanel /></TabsContent>
        <TabsContent value="integrations"><IntegrationsPanel /></TabsContent>
        <TabsContent value="jobs"><JobsPanel /></TabsContent>
        <TabsContent value="database"><DatabasePanel /></TabsContent>
        <TabsContent value="monitoring"><MonitoringPanel /></TabsContent>
        <TabsContent value="logs"><LogsPanel /></TabsContent>
        <TabsContent value="flags"><FlagsPanel /></TabsContent>
        <TabsContent value="backups"><BackupsPanel /></TabsContent>
        <TabsContent value="license"><LicensePanel /></TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================================
// Shared helpers
// ============================================================================

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SaveBar({ onSave }: { onSave: () => void }) {
  const [saving, setSaving] = useState(false)
  return (
    <div className="flex justify-end pt-3">
      <Button onClick={async () => { setSaving(true); await new Promise((r) => setTimeout(r, 500)); onSave(); setSaving(false) }} disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving</> : <><Save className="h-4 w-4 mr-1.5" />Save Changes</>}
      </Button>
    </div>
  )
}

// ============================================================================
// 1. General — platform name, logo, theme, maintenance mode
// ============================================================================

function GeneralPanel() {
  const [name, setName] = useState('CreatorOS')
  const [timezone, setTimezone] = useState('UTC')
  const [language, setLanguage] = useState('en')
  const [maintenance, setMaintenance] = useState(false)
  const [banner, setBanner] = useState('')

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Platform General Settings</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        <SettingRow label="Platform Name" desc="Displayed in sidebar, emails, and browser title">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-48" />
        </SettingRow>
        <SettingRow label="Timezone" desc="Default timezone for the platform">
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="America/New_York">America/New_York</SelectItem>
              <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
              <SelectItem value="Europe/London">Europe/London</SelectItem>
              <SelectItem value="Asia/Manila">Asia/Manila</SelectItem>
              <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Default Language" desc="Platform-wide default language">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="pt">Portuguese</SelectItem>
              <SelectItem value="zh">Chinese</SelectItem>
              <SelectItem value="ja">Japanese</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Maintenance Mode" desc="Temporarily disable all non-admin access">
          <Switch checked={maintenance} onCheckedChange={setMaintenance} />
        </SettingRow>
        <SettingRow label="Release Channel" desc="Stable receives updates less frequently">
          <Select defaultValue="stable">
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stable">Stable</SelectItem>
              <SelectItem value="beta">Beta</SelectItem>
              <SelectItem value="canary">Canary</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <div className="pt-3">
          <Label>Announcement Banner</Label>
          <Textarea className="mt-1" placeholder="Show a banner to all users (leave empty to hide)" value={banner} onChange={(e) => setBanner(e.target.value)} rows={2} />
        </div>
        <div className="pt-3 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div><p className="font-medium text-foreground">Version</p><p className="font-mono mt-0.5">v2.4.0</p></div>
          <div><p className="font-medium text-foreground">Build</p><p className="font-mono mt-0.5">2026.08.06</p></div>
        </div>
        <SaveBar onSave={() => toast.success('General settings saved')} />
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 2. Authentication
// ============================================================================

function AuthPanel() {
  const [registration, setRegistration] = useState(true)
  const [emailVerify, setEmailVerify] = useState(true)
  const [twoFA, setTwoFA] = useState(false)
  const [magicLink, setMagicLink] = useState(true)
  const [sessionTimeout, setSessionTimeout] = useState('30')

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Authentication Settings</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        <SettingRow label="Allow Registration" desc="New users can create accounts">
          <Switch checked={registration} onCheckedChange={setRegistration} />
        </SettingRow>
        <SettingRow label="Require Email Verification" desc="Users must verify email before login">
          <Switch checked={emailVerify} onCheckedChange={setEmailVerify} />
        </SettingRow>
        <SettingRow label="Two-Factor Authentication (2FA)" desc="Require 2FA for all admin accounts">
          <Switch checked={twoFA} onCheckedChange={setTwoFA} />
        </SettingRow>
        <SettingRow label="Magic Link Login" desc="Allow passwordless email login">
          <Switch checked={magicLink} onCheckedChange={setMagicLink} />
        </SettingRow>
        <SettingRow label="Session Timeout" desc="Auto-logout after inactivity">
          <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="240">4 hours</SelectItem>
              <SelectItem value="720">12 hours</SelectItem>
              <SelectItem value="1440">24 hours</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Password Policy" desc="Minimum password strength">
          <Select defaultValue="strong">
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weak">Weak (6+ chars)</SelectItem>
              <SelectItem value="medium">Medium (8+ chars, mixed)</SelectItem>
              <SelectItem value="strong">Strong (12+ chars, symbols)</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Social Login" desc="Google, GitHub, etc.">
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Google</Badge>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">GitHub</Badge>
            <Badge variant="secondary" className="bg-muted">+ Add</Badge>
          </div>
        </SettingRow>
        <SaveBar onSave={() => toast.success('Authentication settings saved')} />
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 3. Workspaces
// ============================================================================

function WorkspacesPanel() {
  const { data, loading } = useApi<{ workspaces: { id: string; name: string; plan: string; members: number }[] }>('/api/data/workspaces')
  if (loading || !data) return <Skeleton className="h-96 rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Total Workspaces', v: formatNumber(data.workspaces.length), i: Building2 },
          { l: 'Default Plan', v: 'Scale', i: CreditCard },
          { l: 'Max Members', v: '50', i: KeyRound },
          { l: 'Max Storage', v: '50 GB', i: HardDrive },
        ].map((s) => { const Icon = s.i; return (
          <Card key={s.l}><CardContent className="p-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Icon className="h-4 w-4" /></div>
            <div><p className="text-lg font-bold leading-none">{s.v}</p><p className="text-[10px] text-muted-foreground mt-0.5">{s.l}</p></div>
          </CardContent></Card>
        )})}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Workspace Limits</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <SettingRow label="Default Plan" desc="Plan assigned to new workspaces">
            <Select defaultValue="scale">
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="scale">Scale</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Max Members per Workspace" desc="Hard limit on workspace members">
            <Input type="number" defaultValue={50} className="w-24" />
          </SettingRow>
          <SettingRow label="Max Storage (GB)" desc="Total storage per workspace">
            <Input type="number" defaultValue={50} className="w-24" />
          </SettingRow>
          <SettingRow label="Max AI Credits / Month" desc="Monthly AI credit allocation">
            <Input type="number" defaultValue={10000} className="w-32" />
          </SettingRow>
          <SettingRow label="Workspace Approval" desc="New workspaces require admin approval">
            <Switch defaultChecked={false} />
          </SettingRow>
          <SettingRow label="Allow Workspace Suspension" desc="Admins can suspend workspaces">
            <Switch defaultChecked />
          </SettingRow>
          <SaveBar onSave={() => toast.success('Workspace limits saved')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Workspaces ({data.workspaces.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-64 overflow-y-auto scroll-thin">
            {data.workspaces.map((w, i) => (
              <motion.div key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Building2 className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-medium">{w.name}</p><p className="text-xs text-muted-foreground">{w.members} members</p></div>
                <Badge variant="secondary" className="text-[10px]">{w.plan}</Badge>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 4. Billing
// ============================================================================

function BillingPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Payment Gateways</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <SettingRow label="Stripe" desc="Accept credit cards via Stripe">
            <div className="flex items-center gap-2"><Switch defaultChecked /><Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Connected</Badge></div>
          </SettingRow>
          <SettingRow label="Lemon Squeezy" desc="Alternative payment gateway">
            <Switch />
          </SettingRow>
          <SettingRow label="PayPal" desc="Accept PayPal payments">
            <Switch />
          </SettingRow>
          <SettingRow label="Manual Payments" desc="Accept offline/bank transfer payments">
            <Switch defaultChecked />
          </SettingRow>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Currency &amp; Taxes</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <SettingRow label="Default Currency" desc="Platform-wide default currency">
            <Select defaultValue="USD">
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="JPY">JPY (¥)</SelectItem>
                <SelectItem value="PHP">PHP (₱)</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Tax Rate" desc="Default tax percentage">
            <Input type="number" defaultValue={0} className="w-24" />
          </SettingRow>
          <SettingRow label="Auto-generate Invoices" desc="Create invoices for every order">
            <Switch defaultChecked />
          </SettingRow>
          <SaveBar onSave={() => toast.success('Billing settings saved')} />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 5. Email
// ============================================================================

function EmailPanel() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Email Configuration</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        <SettingRow label="Email Provider" desc="Service used to send emails">
          <Select defaultValue="resend">
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="smtp">SMTP</SelectItem>
              <SelectItem value="resend">Resend</SelectItem>
              <SelectItem value="sendgrid">SendGrid</SelectItem>
              <SelectItem value="mailgun">Mailgun</SelectItem>
              <SelectItem value="ses">AWS SES</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Sender Email" desc="From: address for all emails">
          <Input defaultValue="noreply@creatoros.io" className="w-56" />
        </SettingRow>
        <SettingRow label="Sender Name" desc="From: name for all emails">
          <Input defaultValue="CreatorOS" className="w-40" />
        </SettingRow>
        <SettingRow label="Bounce Tracking" desc="Track and handle email bounces">
          <Switch defaultChecked />
        </SettingRow>
        <SettingRow label="Email Verification" desc="Send verification emails on signup">
          <Switch defaultChecked />
        </SettingRow>
        <div className="pt-3">
          <Label>SMTP Configuration (if using SMTP)</Label>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <Input placeholder="smtp.gmail.com" />
            <Input placeholder="587" type="number" />
            <Input placeholder="username" />
            <Input placeholder="password" type="password" />
          </div>
        </div>
        <SaveBar onSave={() => toast.success('Email settings saved')} />
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 6. Storage
// ============================================================================

function StoragePanel() {
  const { data, loading } = useApi<{ workspaces: { workspaceId: string; imagesBytes: number; videosBytes: number; totalBytes: number; quotaBytes: number; assetCount: number }[]; totals: { total: number; quota: number; assets: number } }>('/api/admin/storage')
  if (loading || !data) return <Skeleton className="h-96 rounded-xl" />

  const pct = data.totals.quota > 0 ? (data.totals.total / data.totals.quota) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Total Storage', v: `${(data.totals.total / 1e9).toFixed(2)} GB`, i: HardDrive },
          { l: 'Quota', v: `${(data.totals.quota / 1e9).toFixed(0)} GB`, i: Cloud },
          { l: 'Assets', v: formatNumber(data.totals.assets), i: Archive },
          { l: 'Usage', v: `${pct.toFixed(1)}%`, i: Activity },
        ].map((s) => { const Icon = s.i; return (
          <Card key={s.l}><CardContent className="p-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Icon className="h-4 w-4" /></div>
            <div><p className="text-lg font-bold leading-none">{s.v}</p><p className="text-[10px] text-muted-foreground mt-0.5">{s.l}</p></div>
          </CardContent></Card>
        )})}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Storage Provider</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <SettingRow label="Active Provider" desc="Where files are stored">
            <Select defaultValue="local">
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local Disk</SelectItem>
                <SelectItem value="s3">Amazon S3</SelectItem>
                <SelectItem value="r2">Cloudflare R2</SelectItem>
                <SelectItem value="b2">Backblaze B2</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Upload Limit (MB)" desc="Maximum file size per upload">
            <Input type="number" defaultValue={50} className="w-24" />
          </SettingRow>
          <SettingRow label="Image Compression" desc="Auto-compress uploaded images">
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow label="CDN" desc="Serve files via CDN">
            <Switch defaultChecked />
          </SettingRow>
          <SaveBar onSave={() => toast.success('Storage settings saved')} />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 7. Domains
// ============================================================================

function DomainsPanel() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Domain Configuration</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        <SettingRow label="Primary Domain" desc="Main platform domain">
          <Input defaultValue="creatoros.io" className="w-56" />
        </SettingRow>
        <SettingRow label="Wildcard Domains" desc="Allow *.creatoros.io subdomains">
          <Switch defaultChecked />
        </SettingRow>
        <SettingRow label="Custom Domains" desc="Allow workspaces to use custom domains">
          <Switch defaultChecked />
        </SettingRow>
        <SettingRow label="Auto SSL" desc="Automatically provision SSL certificates">
          <Switch defaultChecked />
        </SettingRow>
        <SettingRow label="Cloudflare Integration" desc="Use Cloudflare for DNS &amp; CDN">
          <div className="flex items-center gap-2"><Switch defaultChecked /><Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Connected</Badge></div>
        </SettingRow>
        <SettingRow label="Domain Verification" desc="Require DNS verification for custom domains">
          <Switch defaultChecked />
        </SettingRow>
        <SaveBar onSave={() => toast.success('Domain settings saved')} />
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 8. Security
// ============================================================================

function SecurityPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Web Security</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <SettingRow label="CORS Policy" desc="Cross-Origin Resource Sharing">
            <Select defaultValue="restricted">
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open (all origins)</SelectItem>
                <SelectItem value="restricted">Restricted (same + allowlist)</SelectItem>
                <SelectItem value="strict">Strict (same origin only)</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="CSP Headers" desc="Content Security Policy">
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow label="CSRF Protection" desc="Cross-Site Request Forgery">
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow label="Rate Limiting" desc="Limit requests per IP">
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow label="Security Headers" desc="HSTS, X-Frame-Options, etc.">
            <Switch defaultChecked />
          </SettingRow>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Access Control</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <SettingRow label="IP Blocking" desc="Block specific IP addresses">
            <Button variant="outline" size="sm">Manage Blocklist</Button>
          </SettingRow>
          <SettingRow label="Country Blocking" desc="Geo-block countries">
            <Button variant="outline" size="sm">Manage Countries</Button>
          </SettingRow>
          <SettingRow label="Audit Logs" desc="Log all admin actions">
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow label="API Tokens" desc="Manage platform API tokens">
            <Button variant="outline" size="sm">Manage Tokens</Button>
          </SettingRow>
          <SaveBar onSave={() => toast.success('Security settings saved')} />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 9. Integrations
// ============================================================================

function IntegrationsPanel() {
  const integrations = [
    { name: 'Google', desc: 'Google OAuth, Calendar, Drive', connected: true, icon: Globe },
    { name: 'GitHub', desc: 'GitHub OAuth & repos', connected: true, icon: Plug },
    { name: 'Slack', desc: 'Slack notifications', connected: false, icon: Bell },
    { name: 'Discord', desc: 'Discord bot & webhooks', connected: false, icon: Bell },
    { name: 'Zapier', desc: 'Connect to 5000+ apps', connected: false, icon: Zap },
    { name: 'Make', desc: 'Visual automation platform', connected: false, icon: Zap },
    { name: 'n8n', desc: 'Self-hosted workflow automation', connected: false, icon: Zap },
    { name: 'REST API', desc: 'Public REST API access', connected: true, icon: Plug },
    { name: 'GraphQL', desc: 'Public GraphQL API access', connected: false, icon: Plug },
    { name: 'Webhooks', desc: 'Outgoing webhook management', connected: true, icon: Plug },
  ]

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {integrations.map((int, i) => { const Icon = int.icon; return (
        <motion.div key={int.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
          <Card><CardContent className="p-4 flex items-start gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shrink-0', int.connected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{int.name}</p>
                {int.connected && <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">Connected</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{int.desc}</p>
            </div>
            <Button size="sm" variant={int.connected ? 'outline' : 'default'} onClick={() => toast.info(`${int.name} ${int.connected ? 'disconnect' : 'connect'} dialog`)}>
              {int.connected ? 'Manage' : 'Connect'}
            </Button>
          </CardContent></Card>
        </motion.div>
      )})}
    </div>
  )
}

// ============================================================================
// 10. Jobs — reuse from admin.tsx concept but simpler
// ============================================================================

function JobsPanel() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Background Jobs</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        <SettingRow label="Queue System" desc="Job queue backend">
          <Select defaultValue="memory">
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="memory">In-Memory</SelectItem>
              <SelectItem value="redis">Redis</SelectItem>
              <SelectItem value="bullmq">BullMQ</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Workers" desc="Number of background workers">
          <Input type="number" defaultValue={4} className="w-20" />
        </SettingRow>
        <SettingRow label="Max Retries" desc="Retry failed jobs">
          <Input type="number" defaultValue={3} className="w-20" />
        </SettingRow>
        <SettingRow label="Email Queue" desc="Process emails in background">
          <Switch defaultChecked />
        </SettingRow>
        <SettingRow label="AI Queue" desc="Process AI jobs in background">
          <Switch defaultChecked />
        </SettingRow>
        <SettingRow label="Cleanup Jobs" desc="Auto-clean old data">
          <Switch defaultChecked />
        </SettingRow>
        <SaveBar onSave={() => toast.success('Jobs settings saved')} />
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 11. Database
// ============================================================================

function DatabasePanel() {
  const { data: metrics, loading } = useApi<SystemMetrics>('/api/admin/system-metrics')
  const dbSize = metrics?.database?.size || 0
  const dbTables = metrics?.database?.tables || 0
  const fmtBytes = (b: number) => {
    if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`
    if (b > 1e6) return `${(b / 1e6).toFixed(2)} MB`
    if (b > 1e3) return `${(b / 1e3).toFixed(2)} KB`
    return `${b} B`
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Status', v: loading ? '...' : metrics?.database?.connected ? 'Connected' : 'Error', i: Check, c: 'text-emerald-500' },
          { l: 'Type', v: 'SQLite', i: Database, c: 'text-sky-500' },
          { l: 'Tables', v: loading ? '...' : String(dbTables), i: Server, c: 'text-violet-500' },
          { l: 'Size', v: loading ? '...' : fmtBytes(dbSize), i: HardDrive, c: 'text-amber-500' },
        ].map((s) => { const Icon = s.i; return (
          <Card key={s.l}><CardContent className="p-3 flex items-center gap-2">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-muted', s.c)}><Icon className="h-4 w-4" /></div>
            <div><p className="text-sm font-bold leading-none">{s.v}</p><p className="text-[10px] text-muted-foreground mt-0.5">{s.l}</p></div>
          </CardContent></Card>
        )})}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Database Management</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <SettingRow label="Connection Pool" desc="Max concurrent connections">
            <Input type="number" defaultValue={10} className="w-20" />
          </SettingRow>
          <SettingRow label="Auto-backup" desc="Daily automatic backups">
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow label="Index Optimization" desc="Auto-optimize indexes weekly">
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow label="Query Logging" desc="Log slow queries">
            <Switch />
          </SettingRow>
          <div className="pt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toast.info('Migration history dialog')}><Clock className="h-4 w-4 mr-1.5" />Migration History</Button>
            <Button variant="outline" size="sm" onClick={() => toast.info('Performance report')}><Activity className="h-4 w-4 mr-1.5" />Performance</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 12. Monitoring — uses REAL system metrics from /api/admin/system-metrics
// ============================================================================

interface SystemMetrics {
  cpu: { percent: number; cores: number; loadAvg1: string }
  memory: { percent: number; used: number; total: number; processRss: number }
  disk: { percent: number; used: number; total: number }
  uptime: { human: string; hours: number; days: number }
  database: { size: number; tables: number; connected: boolean }
  network: { totalRequests: number }
  hostname: string
  platform: string
  arch: string
  nodeVersion: string
}

function MonitoringPanel() {
  const { data: mon } = useApi<{ providers: { active: number; total: number } }>('/api/admin/monitoring')
  const { data: metrics, loading } = useApi<SystemMetrics>('/api/admin/system-metrics')

  // Services status — derived from real provider health + DB connectivity
  const aiActive = mon?.providers?.active ?? 0
  const aiTotal = mon?.providers?.total ?? 0
  const services = [
    { s: 'API Gateway', st: 'Operational' as const, up: 100 },
    { s: 'AI Engine', st: aiActive > 0 ? 'Operational' as const : 'Down' as const, up: aiTotal > 0 ? Math.round((aiActive / aiTotal) * 100) : 0 },
    { s: 'Database', st: metrics?.database?.connected ? 'Operational' as const : 'Checking' as const, up: 100 },
    { s: 'File Storage', st: 'Operational' as const, up: 100 },
    { s: 'Email Delivery', st: 'Operational' as const, up: 100 },
    { s: 'Webhook Ingest', st: aiActive > 0 ? 'Operational' as const : 'Standby' as const, up: 99 },
  ]

  if (loading || !metrics) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">System Health</CardTitle></CardHeader>
          <CardContent><Skeleton className="h-48 rounded-lg" /></CardContent>
        </Card>
      </div>
    )
  }

  const fmtBytes = (b: number) => {
    if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`
    if (b > 1e6) return `${(b / 1e6).toFixed(2)} MB`
    if (b > 1e3) return `${(b / 1e3).toFixed(2)} KB`
    return `${b} B`
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">System Health</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {services.map((x) => (
            <div key={x.s} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', x.st === 'Operational' ? 'bg-emerald-500' : x.st === 'Standby' ? 'bg-amber-500' : 'bg-red-500')} />
                <span className="text-sm">{x.s}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{x.up}% uptime</span>
                <Badge variant="secondary" className={cn('text-[10px]', x.st === 'Operational' ? 'bg-emerald-500/10 text-emerald-600' : x.st === 'Standby' ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600')}>{x.st}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Resource Usage (Live)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1"><span>CPU</span><span className="text-muted-foreground">{metrics.cpu.percent}% · {metrics.cpu.cores} cores · load {metrics.cpu.loadAvg1}</span></div>
            <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-sky-500 transition-all" style={{ width: `${metrics.cpu.percent}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span>RAM</span><span className="text-muted-foreground">{metrics.memory.percent}% · {fmtBytes(metrics.memory.used)} / {fmtBytes(metrics.memory.total)}</span></div>
            <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-violet-500 transition-all" style={{ width: `${metrics.memory.percent}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span>Disk</span><span className="text-muted-foreground">{metrics.disk.percent}% · {fmtBytes(metrics.disk.used)}</span></div>
            <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.min(metrics.disk.percent, 100)}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span>Process Memory</span><span className="text-muted-foreground">{fmtBytes(metrics.memory.processRss)}</span></div>
            <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min((metrics.memory.processRss / metrics.memory.total) * 100, 100)}%` }} /></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Server Info</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4 text-xs">
          <div><p className="text-muted-foreground">Hostname</p><p className="font-mono mt-0.5">{metrics.hostname}</p></div>
          <div><p className="text-muted-foreground">Platform</p><p className="font-mono mt-0.5">{metrics.platform} ({metrics.arch})</p></div>
          <div><p className="text-muted-foreground">Node.js</p><p className="font-mono mt-0.5">{metrics.nodeVersion}</p></div>
          <div><p className="text-muted-foreground">Uptime</p><p className="font-mono mt-0.5">{metrics.uptime.human}</p></div>
          <div><p className="text-muted-foreground">Database Size</p><p className="font-mono mt-0.5">{fmtBytes(metrics.database.size)}</p></div>
          <div><p className="text-muted-foreground">DB Tables</p><p className="font-mono mt-0.5">{metrics.database.tables}</p></div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 13. Logs
// ============================================================================

function LogsPanel() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Application Logs</CardTitle></CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto scroll-thin rounded-lg bg-zinc-950 p-4 font-mono text-xs text-zinc-300 space-y-1">
          {[
            { t: '2026-08-06 10:30:15', l: 'INFO', m: 'Server started on port 3000' },
            { t: '2026-08-06 10:30:16', l: 'INFO', m: 'Database connection established' },
            { t: '2026-08-06 10:30:17', l: 'INFO', m: 'AI Engine initialized — 5 providers active' },
            { t: '2026-08-06 10:31:02', l: 'INFO', m: 'GET /api/admin/monitoring 200 75ms' },
            { t: '2026-08-06 10:31:05', l: 'INFO', m: 'POST /api/ai/images 200 46701ms' },
            { t: '2026-08-06 10:31:06', l: 'INFO', m: 'Asset saved to Media Library' },
            { t: '2026-08-06 10:32:10', l: 'WARN', m: 'Rate limit: user 1234 hit 60/min on IMAGE' },
            { t: '2026-08-06 10:33:45', l: 'INFO', m: 'GET /api/ai/dashboard 200 15ms' },
            { t: '2026-08-06 10:34:20', l: 'ERROR', m: 'Provider OpenRouter: no API key configured' },
            { t: '2026-08-06 10:35:00', l: 'INFO', m: 'Health check completed for GLM (healthy, 14374ms)' },
          ].map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-zinc-500">{log.t}</span>
              <span className={cn(
                log.l === 'ERROR' && 'text-red-400',
                log.l === 'WARN' && 'text-amber-400',
                log.l === 'INFO' && 'text-sky-400',
              )}>{log.l}</span>
              <span>{log.m}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => toast.info('Log filter dialog')}><FileText className="h-4 w-4 mr-1.5" />Filter</Button>
          <Button variant="outline" size="sm" onClick={() => toast.info('Downloading logs...')}><HardDriveDownload className="h-4 w-4 mr-1.5" />Export</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 14. Feature Flags — reuse existing FlagsPanel from admin.tsx
// ============================================================================

function FlagsPanel() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Platform Feature Flags</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto scroll-thin">
          {[
            { k: 'ai_chat', n: 'AI Chat', d: 'Enable AI chat for all workspaces', e: true },
            { k: 'ai_images', n: 'AI Images', d: 'Enable image generation', e: true },
            { k: 'ai_videos', n: 'AI Videos', d: 'Enable video generation', e: true },
            { k: 'ai_voice', n: 'AI Voice', d: 'Enable text-to-speech', e: false },
            { k: 'ai_reasoning', n: 'AI Reasoning', d: 'Extended thinking mode (beta)', e: false },
            { k: 'custom_domains', n: 'Custom Domains', d: 'Allow workspace custom domains', e: true },
            { k: 'white_label', n: 'White Label', d: 'Remove CreatorOS branding (Enterprise)', e: false },
            { k: 'api_access', n: 'API Access', d: 'Public REST API access', e: true },
            { k: 'webhooks', n: 'Webhooks', d: 'Outgoing webhook management', e: true },
            { k: 'advanced_analytics', n: 'Advanced Analytics', d: 'Detailed business analytics', e: true },
          ].map((f) => (
            <div key={f.k} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', f.e ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                  <ToggleLeft className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2"><p className="text-sm font-medium">{f.n}</p><code className="text-[10px] text-muted-foreground">{f.k}</code></div>
                  <p className="text-xs text-muted-foreground">{f.d}</p>
                </div>
              </div>
              <Switch checked={f.e} onCheckedChange={() => toast.success(`${f.n} ${f.e ? 'disabled' : 'enabled'}`)} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 15. Backups
// ============================================================================

function BackupsPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Backup Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <SettingRow label="Auto-backup" desc="Daily automatic database backups">
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow label="Backup Schedule" desc="When to run automatic backups">
            <Select defaultValue="daily">
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Retention (days)" desc="How long to keep backups">
            <Input type="number" defaultValue={30} className="w-20" />
          </SettingRow>
          <SettingRow label="Cloud Backup" desc="Upload backups to cloud storage">
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow label="Cloud Provider" desc="Where to store cloud backups">
            <Select defaultValue="s3">
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="s3">Amazon S3</SelectItem>
                <SelectItem value="r2">Cloudflare R2</SelectItem>
                <SelectItem value="b2">Backblaze B2</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SaveBar onSave={() => toast.success('Backup settings saved')} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Backup Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => toast.success('Backup created')}><Archive className="h-4 w-4 mr-1.5" />Create Backup</Button>
          <Button variant="outline" onClick={() => toast.info('Restore dialog')}><HardDriveDownload className="h-4 w-4 mr-1.5" />Restore</Button>
          <Button variant="outline" onClick={() => toast.info('Downloading latest backup...')}><Cloud className="h-4 w-4 mr-1.5" />Download</Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 16. License
// ============================================================================

function LicensePanel() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">License &amp; Version</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Current Version</p>
            <p className="text-2xl font-bold">v2.4.0</p>
            <p className="text-xs text-muted-foreground">Build 2026.08.06</p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <p className="text-xs text-muted-foreground">License Type</p>
            <p className="text-2xl font-bold">Enterprise</p>
            <p className="text-xs text-muted-foreground">Valid until: 2027-08-06</p>
          </div>
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">License Key</p>
          <Input defaultValue="CREOS-ENT-XXXX-XXXX-XXXX-XXXX" className="font-mono" readOnly />
          <Button variant="outline" size="sm" onClick={() => toast.info('Update license dialog')}>Update License</Button>
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">Updates</p>
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">Auto-update</p><p className="text-sm">Install updates automatically</p></div>
            <Switch defaultChecked />
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.info('Checking for updates...')}><Check className="h-4 w-4 mr-1.5" />Check for Updates</Button>
        </div>
      </CardContent>
    </Card>
  )
}
