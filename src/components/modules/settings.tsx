'use client'

import { useState, useEffect } from 'react'
import { Building2, Users, CreditCard, Bell, Crown, Globe, Zap, ExternalLink, Shield, User } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TEAM = [
  { name: 'Team Member', email: 'member@example.com', role: 'Member', initials: 'T', color: 'bg-muted text-muted-foreground' },
]

export function SettingsModule() {
  const { theme, toggleTheme, activeSubTab, currentUser: user } = useAppStore()
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifPush, setNotifPush] = useState(false)
  const [settingsTab, setSettingsTab] = useState(activeSubTab || 'workspace')

  useEffect(() => {
    if (activeSubTab && ['workspace', 'team', 'billing', 'notifications'].includes(activeSubTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettingsTab(activeSubTab)
    }
  }, [activeSubTab])

  return (
    <div className="space-y-5">
      {/* Clerk Account Management Card — always visible at top */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.info('Manage Account', { description: 'Opening Clerk account portal...' })}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Manage Account
          </Button>
        </CardContent>
      </Card>

      <Tabs value={settingsTab} onValueChange={setSettingsTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="workspace"><Building2 className="h-3.5 w-3.5 mr-1.5" />Workspace</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-3.5 w-3.5 mr-1.5" />Team</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="h-3.5 w-3.5 mr-1.5" />Billing</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5 mr-1.5" />Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Workspace</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Workspace name</Label><Input defaultValue="" placeholder="Your workspace name" className="mt-1.5" /></div>
                <div><Label>URL slug</Label><Input defaultValue="" placeholder="my-workspace" className="mt-1.5" /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3"><Globe className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">Theme</p><p className="text-xs text-muted-foreground">Currently: {theme}</p></div></div>
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
                <div className="flex items-center gap-2"><Crown className="h-5 w-5 text-primary" /><p className="font-semibold">{user?.role === 'SUPER_ADMIN' ? 'Admin Plan' : 'Free Plan'}</p><Badge variant="secondary" className="bg-primary/15 text-primary">Current</Badge></div>
                <Button size="sm" variant="outline" onClick={() => toast.info('Plan comparison', { description: 'Compare Free, Pro, Scale, and Enterprise plans.' })}>Change plan</Button>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[{ l: 'Plan', v: user?.role === 'SUPER_ADMIN' ? 'Admin' : 'Free' }, { l: 'AI Credits', v: `${(user?.credits ?? 0).toLocaleString()} remaining` }].map((x) => (
                  <div key={x.l} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{x.l}</p><p className="text-sm font-semibold mt-0.5">{x.v}</p></div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Payment Method</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3"><div className="flex h-8 w-12 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground font-bold">—</div><div><p className="text-sm font-medium text-muted-foreground">No payment method</p></div></div>
                <Button size="sm" variant="outline" onClick={() => toast.info('Update payment method', { description: 'Add a new card or change your default.' })}>Update</Button>
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
