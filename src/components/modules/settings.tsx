'use client'
import { useState, useEffect } from 'react'
import { User, Building2, CreditCard, Users, Shield, Bell, Globe, Key, Crown, Check, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TEAM = [
  { name: 'Current User', email: 'user@example.com', role: 'Owner', initials: 'U', color: 'bg-primary/15 text-primary' },
  { name: 'Jamie Chen', email: 'jamie@creatoros.io', role: 'Admin', initials: 'JC', color: 'bg-violet-500/15 text-violet-600' },
  { name: 'Priya Patel', email: 'priya@creatoros.io', role: 'Instructor', initials: 'PP', color: 'bg-amber-500/15 text-amber-600' },
  { name: 'Marcus Lee', email: 'marcus@creatoros.io', role: 'Moderator', initials: 'ML', color: 'bg-sky-500/15 text-sky-600' },
  { name: 'Sofia Diaz', email: 'sofia@creatoros.io', role: 'Manager', initials: 'SD', color: 'bg-emerald-500/15 text-emerald-600' },
]

export function SettingsModule() {
  const { theme, toggleTheme, activeSubTab } = useAppStore()
  const [twoFA, setTwoFA] = useState(true)
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifPush, setNotifPush] = useState(false)
  const [settingsTab, setSettingsTab] = useState(activeSubTab || 'profile')

  // Sync with sidebar navigation
  useEffect(() => {
    if (activeSubTab && ['profile', 'workspace', 'team', 'billing', 'security', 'notifications'].includes(activeSubTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettingsTab(activeSubTab)
    }
  }, [activeSubTab])

  return (
    <div className="space-y-5">
      <Tabs value={settingsTab} onValueChange={setSettingsTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile"><User className="h-3.5 w-3.5 mr-1.5" />Profile</TabsTrigger>
          <TabsTrigger value="workspace"><Building2 className="h-3.5 w-3.5 mr-1.5" />Workspace</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-3.5 w-3.5 mr-1.5" />Team</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="h-3.5 w-3.5 mr-1.5" />Billing</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-3.5 w-3.5 mr-1.5" />Security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5 mr-1.5" />Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16"><AvatarFallback className="bg-primary/15 text-primary text-lg">AR</AvatarFallback></Avatar>
                <div><Button size="sm" variant="outline" onClick={() => toast.info('Upload avatar', { description: 'Choose an image file (JPG, PNG, GIF — max 2MB)' })}>Change avatar</Button><p className="text-xs text-muted-foreground mt-1.5">JPG, PNG or GIF. Max 2MB.</p></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Full name</Label><Input defaultValue="" className="mt-1.5" /></div>
                <div><Label>Email</Label><Input defaultValue="" className="mt-1.5" /></div>
                <div><Label>Username</Label><Input defaultValue="@alexrivera" className="mt-1.5" /></div>
                <div><Label>Timezone</Label><Select defaultValue="Asia/Manila"><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Asia/Manila">Asia/Manila (PHT)</SelectItem><SelectItem value="America/New_York">America/New_York (EST)</SelectItem><SelectItem value="Europe/London">Europe/London (GMT)</SelectItem></SelectContent></Select></div>
              </div>
              <div><Label>Bio</Label><Textarea defaultValue="Creator educator building the future of online business." className="mt-1.5" rows={3} /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" size="sm">Cancel</Button><Button size="sm" onClick={() => toast.success('Profile saved')}>Save changes</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Workspace</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Workspace name</Label><Input defaultValue="CreatorOS Studio" className="mt-1.5" /></div>
                <div><Label>URL slug</Label><Input defaultValue="creatoros" className="mt-1.5" /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3"><Globe className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">Custom domain</p><p className="text-xs text-muted-foreground">creatoros.io</p></div></div>
                <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10">Connected</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Zap className="h-4 w-4 text-primary" /></div><div><p className="text-sm font-medium">Theme</p><p className="text-xs text-muted-foreground">Currently: {theme}</p></div></div>
                <Button size="sm" variant="outline" onClick={toggleTheme}>Switch to {theme === 'dark' ? 'light' : 'dark'}</Button>
              </div>
              <div className="flex justify-end"><Button size="sm" onClick={() => toast.success('Workspace saved')}>Save changes</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Team Members</CardTitle><Button size="sm" onClick={() => toast.success('Invite sent', { description: 'Team invitation email will be sent.' })}>Invite member</Button></CardHeader>
            <CardContent className="space-y-1.5">
              {TEAM.map((m) => (
                <div key={m.email} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition">
                  <Avatar className="h-9 w-9"><AvatarFallback className={cn('text-xs font-medium', m.color)}>{m.initials}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{m.name}</p><p className="text-xs text-muted-foreground truncate">{m.email}</p></div>
                  <Select defaultValue={m.role}><SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent>{['Owner', 'Admin', 'Manager', 'Instructor', 'Moderator', 'Member'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
                  {m.role !== 'Owner' && <Button size="sm" variant="ghost" className="h-8 text-xs text-rose-500" onClick={() => toast.success(`${m.name} removed from workspace`)}>Remove</Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card className="overflow-hidden border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Crown className="h-5 w-5 text-primary" /><p className="font-semibold">Scale Plan</p><Badge variant="secondary" className="bg-primary/15 text-primary">Current</Badge></div>
                <Button size="sm" variant="outline" onClick={() => toast.info('Plan comparison', { description: 'Compare Free, Pro, Scale, and Enterprise plans.' })}>Change plan</Button>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[{ l: 'Monthly price', v: '$199/mo' }, { l: 'Next billing', v: 'Dec 15, 2025' }, { l: 'AI Credits', v: '4,280 remaining' }].map((x) => (
                  <div key={x.l} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{x.l}</p><p className="text-sm font-semibold mt-0.5">{x.v}</p></div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Payment Method</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3"><div className="flex h-8 w-12 items-center justify-center rounded bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] text-white font-bold">VISA</div><div><p className="text-sm font-medium">•••• •••• •••• 4242</p><p className="text-xs text-muted-foreground">Expires 08/27</p></div></div>
                <Button size="sm" variant="outline" onClick={() => toast.info('Update payment method', { description: 'Add a new card or change your default.' })}>Update</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3"><Key className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">Two-factor authentication</p><p className="text-xs text-muted-foreground">Add an extra layer of security</p></div></div>
                <Switch checked={twoFA} onCheckedChange={setTwoFA} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3"><Shield className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">Password</p><p className="text-xs text-muted-foreground">Last changed 3 months ago</p></div></div>
                <Button size="sm" variant="outline" onClick={() => toast.info('Change password', { description: 'A secure reset link will be emailed to you.' })}>Change</Button>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Active sessions</p>
                <div className="space-y-1.5">
                  {[{ d: 'MacBook Pro · Manila', t: 'Current session', active: true }, { d: 'iPhone 15 · Manila', t: '2 hours ago', active: false }].map((s) => (
                    <div key={s.d} className="flex items-center justify-between rounded-lg border p-3">
                      <div><p className="text-sm font-medium">{s.d}</p><p className="text-xs text-muted-foreground">{s.t}</p></div>
                      {s.active ? <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10">Active</Badge> : <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-500" onClick={() => toast.success('Session revoked')}>Revoke</Button>}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[{ l: 'Email notifications', d: 'Sales, comments, mentions', v: notifEmail, set: setNotifEmail }, { l: 'Push notifications', d: 'Real-time alerts in browser', v: notifPush, set: setNotifPush }].map((n) => (
                <div key={n.l} className="flex items-center justify-between rounded-lg border p-3">
                  <div><p className="text-sm font-medium">{n.l}</p><p className="text-xs text-muted-foreground">{n.d}</p></div>
                  <Switch checked={n.v} onCheckedChange={n.set} />
                </div>
              ))}
              <div className="space-y-2 pt-2">
                <p className="text-sm font-semibold">Notify me about</p>
                {['New sales', 'New community posts', 'New comments on my content', 'AI generation complete', 'Weekly analytics report'].map((x) => (
                  <label key={x} className="flex items-center gap-2.5 text-sm"><input type="checkbox" defaultChecked className="rounded" /> {x}</label>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
