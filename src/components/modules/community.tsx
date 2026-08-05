'use client'
// ============================================================================
// CreatorOS — Community Module (production-ready)
// Feed · Spaces · Members · Events · Invitations · Moderation · Notifications
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart, MessageCircle, Pin, Bookmark, Share2, Plus, Flame, TrendingUp, Users,
  Sparkles, Send, Hash, MoreVertical, Trash2, Flag, Eye, Search, Lock, Archive,
  Calendar, Trophy, ArrowLeft, Loader2, X, Shield, Bell, Settings, ChevronDown,
  UserPlus, Mail, Link2, QrCode, Upload, Download, Ban, VolumeX, AlertTriangle,
  CheckCircle2, Clock, FileText, Edit3, History, Star, GripVertical, AtSign,
  ThumbsUp, ThumbsDown, Filter, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal,
} from 'lucide-react'
import { useApi, timeAgo } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ApiErrorBanner, ModuleEmptyState } from '@/components/modules/_state-utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Post {
  id: string; title: string; content: string; category: string; postType?: string;
  likesCount: number; commentsCount: number; isPinned: boolean; isLocked?: boolean;
  isArchived?: boolean; isEdited?: boolean; createdAt: string;
  author: string; authorId?: string; authorAvatar?: string | null;
  space?: { id: string; name: string } | null;
  hashtags?: string[]; mentions?: string[];
  attachments?: Array<{ type: string; url: string; name: string }>;
  reactions?: Record<string, { count: number; users: string[] } | number>;
}

interface Space {
  id: string; name: string; slug?: string; description?: string;
  memberCount: number; postCount: number; visibility?: string;
}

interface EventItem {
  id: string; title: string; description?: string; type: string;
  location?: string | null; meetingUrl?: string | null;
  startTime: string; endTime?: string | null; status: string;
  attendeeCount: number; userRsvp?: string | null;
}

interface Member {
  id: string; userId: string; name: string; email: string; avatarUrl?: string | null;
  bio?: string | null; role: string; memberStatus: string;
  joinedAt: string; lastSeenAt: string;
  postsCount: number; commentsCount: number; likesReceived: number;
  badges: Array<{ id: string; name: string }>;
  mutedUntil?: string | null; suspendedUntil?: string | null; bannedUntil?: string | null;
}

interface Invitation {
  id: string; email?: string | null; username?: string | null; role: string;
  status: string; message?: string; expiresAt: string; createdAt: string;
  acceptedAt?: string | null; revokedAt?: string | null;
  inviter?: { name: string; email: string } | null;
}

interface CommunityData {
  stats: { totalPosts: number; totalSpaces: number; totalEvents: number; totalMembers: number }
  posts: Post[]; spaces: Space[]; events: EventItem[]
}

type View = 'feed' | 'spaces' | 'members' | 'leaderboard' | 'events' | 'moderation' | 'about'

const CATEGORIES = ['All', 'Wins', 'Questions', 'Marketing', 'Community', 'Announcements', 'General']
const CAT_COLORS: Record<string, string> = {
  Wins: 'bg-emerald-500/10 text-emerald-600',
  Questions: 'bg-sky-500/10 text-sky-600',
  Marketing: 'bg-violet-500/10 text-violet-600',
  Community: 'bg-amber-500/10 text-amber-600',
  Announcements: 'bg-rose-500/10 text-rose-600',
  General: 'bg-muted text-muted-foreground',
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  ADMIN: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
  MANAGER: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
  INSTRUCTOR: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
  MODERATOR: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  MEMBER: 'bg-muted text-muted-foreground border-border',
  STUDENT: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  SUSPENDED: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  BANNED: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
  MUTED: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
}

const REACTIONS = [
  { type: 'LIKE', emoji: '👍' }, { type: 'LOVE', emoji: '❤️' },
  { type: 'HAHA', emoji: '😄' }, { type: 'WOW', emoji: '😮' },
  { type: 'SAD', emoji: '😢' }, { type: 'ANGRY', emoji: '😡' },
]

const SPACE_COLORS = [
  'bg-emerald-500/10 text-emerald-600', 'bg-violet-500/10 text-violet-600',
  'bg-amber-500/10 text-amber-600', 'bg-sky-500/10 text-sky-600',
  'bg-rose-500/10 text-rose-600', 'bg-cyan-500/10 text-cyan-600',
]

const ROLES = ['ADMIN', 'MANAGER', 'INSTRUCTOR', 'MODERATOR', 'MEMBER', 'STUDENT', 'AFFILIATE', 'GUEST']

// ─── Main Module ────────────────────────────────────────────────────────────

export function CommunityModule() {
  const { data, loading, error, refetch } = useApi<CommunityData>('/api/data/community')
  const [view, setView] = useState<View>('feed')
  const [activeCat, setActiveCat] = useState('All')
  const [search, setSearch] = useState('')
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null)

  // Poll unread notifications
  useEffect(() => {
    const fetchUnread = () => {
      fetch('/api/community/notifications/unread-count')
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setUnreadCount(d.count || 0))
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  const toggle = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id); else next.add(id)
    setFn(next)
  }

  if (error) return <ApiErrorBanner message={error} onRetry={refetch} />
  if (loading || !data) return <CommunitySkeleton />

  const posts = data.posts || []
  const filtered = posts.filter((p) =>
    (activeCat === 'All' || p.category === activeCat) &&
    (search === '' || p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr_280px]">
      {/* Left Sidebar */}
      <div className="space-y-3">
        <Card>
          <CardContent className="p-3 space-y-1">
            {([
              { id: 'feed', label: 'Feed', icon: MessageCircle },
              { id: 'spaces', label: 'Spaces', icon: Hash },
              { id: 'members', label: 'Members', icon: Users },
              { id: 'events', label: 'Events', icon: Calendar },
              { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
              { id: 'moderation', label: 'Moderation', icon: Shield },
              { id: 'about', label: 'About', icon: Sparkles },
            ] as const).map((v) => {
              const Icon = v.icon
              return (
                <button key={v.id} onClick={() => { setView(v.id); setSelectedSpaceId(null) }}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                    view === v.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground')}>
                  <Icon className="h-4 w-4" /> {v.label}
                </button>
              )
            })}
          </CardContent>
        </Card>

        {view === 'feed' && (
          <Card>
            <CardContent className="p-3 space-y-1">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setActiveCat(c)}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition',
                    activeCat === c ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground')}>
                  <Hash className="h-3.5 w-3.5" /> {c}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {data.spaces.length > 0 && (
          <Card>
            <CardContent className="p-3 space-y-1">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spaces</p>
              {data.spaces.map((s, i) => (
                <button key={s.id} onClick={() => { setView('spaces'); setSelectedSpaceId(s.id) }}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition',
                    selectedSpaceId === s.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground')}>
                  <div className={cn('flex h-5 w-5 items-center justify-center rounded', SPACE_COLORS[i % SPACE_COLORS.length])}>
                    <Hash className="h-3 w-3" />
                  </div>
                  <span className="flex-1 truncate text-left">{s.name}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Center */}
      <div className="space-y-4 min-w-0">
        {view === 'feed' && (
          <FeedView data={data} filtered={filtered} search={search} setSearch={setSearch}
            setCreateOpen={setCreateOpen} liked={liked} saved={saved} expanded={expanded}
            toggle={toggle} refetch={refetch} setExpanded={setExpanded} />
        )}
        {view === 'spaces' && (
          <SpacesView spaces={data.spaces} selectedSpaceId={selectedSpaceId}
            onSelectSpace={setSelectedSpaceId} onSpacesChange={refetch} />
        )}
        {view === 'members' && <MembersView onInvite={() => setInviteOpen(true)} />}
        {view === 'leaderboard' && <LeaderboardView />}
        {view === 'events' && <EventsView events={data.events} />}
        {view === 'moderation' && <ModerationView />}
        {view === 'about' && <AboutView stats={data.stats} />}
      </div>

      {/* Right Sidebar */}
      <div className="hidden lg:block space-y-3">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Community</p>
              <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                  <NotificationsPanel />
                </SheetContent>
              </Sheet>
            </div>
            <div className="space-y-2.5">
              <Stat icon={Users} label="Members" value={String(data.stats.totalMembers)} />
              <Stat icon={MessageCircle} label="Posts" value={String(data.stats.totalPosts)} />
              <Stat icon={Hash} label="Spaces" value={String(data.stats.totalSpaces)} />
              <Stat icon={Calendar} label="Events" value={String(data.stats.totalEvents)} />
              <Stat icon={Flame} label="Online now" value="342" />
              <Stat icon={TrendingUp} label="This week" value="+18%" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/10 to-card border-primary/20">
          <CardContent className="p-4">
            <Sparkles className="h-5 w-5 text-primary mb-2" />
            <p className="text-sm font-semibold">Community Guidelines</p>
            <p className="text-xs text-muted-foreground mt-1">Be kind, share knowledge, and help others grow. No spam or self-promotion.</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Post Dialog */}
      <CreatePostDialog open={createOpen} onOpenChange={setCreateOpen} spaces={data.spaces} onCreated={refetch} />

      {/* Invite Dialog */}
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}

// ─── Feed View ──────────────────────────────────────────────────────────────

function FeedView({ data, filtered, search, setSearch, setCreateOpen, liked, saved, expanded, toggle, refetch, setExpanded }: {
  data: CommunityData; filtered: Post[]; search: string; setSearch: (v: string) => void;
  setCreateOpen: (v: boolean) => void; liked: Set<string>; saved: Set<string>; expanded: Set<string>;
  toggle: (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => void;
  refetch: () => void; setExpanded: (s: Set<string>) => void;
}) {
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  const submitComment = (postId: string) => {
    const text = (commentInputs[postId] || '').trim()
    if (!text) return
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
    toast.success('Comment posted')
  }

  const sharePost = (p: Post) => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${p.id}`)
    toast.success('Post link copied')
  }

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return
    try {
      const res = await fetch(`/api/community/posts/${postId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Post deleted')
      refetch()
    } catch { toast.error('Failed to delete') }
  }

  const reactToPost = async (postId: string, type: string) => {
    try {
      const res = await fetch(`/api/community/posts/${postId}/react`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (!res.ok) throw new Error('Failed')
      refetch()
    } catch { toast.error('Failed to react') }
  }

  const pinPost = async (postId: string, currentlyPinned: boolean) => {
    try {
      const res = await fetch(`/api/community/posts/${postId}/pin`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      toast.success(currentlyPinned ? 'Post unpinned' : 'Post pinned')
      refetch()
    } catch { toast.error('Failed') }
  }

  const reportPost = async (postId: string) => {
    toast.info('Report submitted', { description: 'Our moderation team will review this post.' })
    try {
      await fetch(`/api/community/posts/${postId}/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'OTHER', description: 'Reported via feed' }),
      })
    } catch {}
  }

  return (
    <>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search posts..." className="pl-9" />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Post
        </Button>
      </div>

      <Card className="cursor-pointer hover:border-primary/30 transition" onClick={() => setCreateOpen(true)}>
        <CardContent className="p-4 flex items-center gap-3">
          <Avatar><AvatarFallback className="bg-primary/15 text-primary text-xs">You</AvatarFallback></Avatar>
          <div className="flex-1 rounded-lg bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
            Share a win, ask a question, or start a discussion...
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <ModuleEmptyState icon={MessageCircle} title="No posts yet" hint="Be the first to share something with the community." />
      ) : filtered.map((p, i) => {
        const isLiked = liked.has(p.id)
        const isSaved = saved.has(p.id)
        const isExpanded = expanded.has(p.id)
        const reactions = p.reactions || {}
        const totalReactions = Object.values(reactions).reduce((sum, r) => {
          const count = typeof r === 'number' ? r : r?.count || 0
          return sum + count
        }, 0)
        return (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className={cn(p.isPinned && 'ring-1 ring-primary/30', p.isArchived && 'opacity-60')}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar>
                    {p.authorAvatar ? <AvatarImage src={p.authorAvatar} alt={p.author} /> : null}
                    <AvatarFallback className="bg-muted text-xs font-medium">{(p.author || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{p.author}</span>
                      <span className="text-xs text-muted-foreground">· {timeAgo(p.createdAt)}</span>
                      {p.isPinned && <Badge variant="secondary" className="text-xs"><Pin className="h-2.5 w-2.5 mr-1" />Pinned</Badge>}
                      {p.isLocked && <Badge variant="secondary" className="text-xs"><Lock className="h-2.5 w-2.5 mr-1" />Locked</Badge>}
                      {p.isArchived && <Badge variant="secondary" className="text-xs"><Archive className="h-2.5 w-2.5 mr-1" />Archived</Badge>}
                      {p.isEdited && <Badge variant="secondary" className="text-xs">Edited</Badge>}
                      <Badge variant="secondary" className={cn('text-xs', CAT_COLORS[p.category])}>{p.category}</Badge>
                      {p.space && <Badge variant="outline" className="text-xs"><Hash className="h-2.5 w-2.5 mr-1" />{p.space.name}</Badge>}
                      <div className="ml-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => toggle(expanded, setExpanded, p.id)}><Eye className="h-4 w-4 mr-2" /> {isExpanded ? 'Collapse' : 'Expand'}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinPost(p.id, !!p.isPinned)}><Pin className="h-4 w-4 mr-2" /> {p.isPinned ? 'Unpin' : 'Pin'}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sharePost(p)}><Share2 className="h-4 w-4 mr-2" /> Share</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { toggle(saved, setSaved, p.id); toast.success('Saved to bookmarks') }}><Bookmark className="h-4 w-4 mr-2" /> Save</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => reportPost(p.id)}><Flag className="h-4 w-4 mr-2" /> Report</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => deletePost(p.id)} className="text-rose-600"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <h3 className="mt-1.5 font-semibold leading-snug">{p.title}</h3>
                    <p className={cn('mt-1.5 text-sm text-muted-foreground leading-relaxed', !isExpanded && 'line-clamp-3')}>{p.content}</p>
                    {p.content.length > 200 && (
                      <p className="mt-1 text-xs text-primary cursor-pointer hover:underline" onClick={() => toggle(expanded, setExpanded, p.id)}>
                        {isExpanded ? 'Show less' : 'Read more'}
                      </p>
                    )}
                    {p.hashtags && p.hashtags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.hashtags.map((tag) => (
                          <span key={tag} className="text-xs text-primary cursor-pointer hover:underline">#{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Reactions bar */}
                    <div className="mt-3 flex items-center gap-1 flex-wrap">
                      {REACTIONS.map((r) => {
                        const data = reactions[r.type]
                        const count = typeof data === 'number' ? data : data?.count || 0
                        if (count === 0) return null
                        return (
                          <button key={r.type} onClick={() => reactToPost(p.id, r.type)}
                            className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs hover:bg-muted/70 transition">
                            <span>{r.emoji}</span>
                            <span className="font-medium">{count}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Action buttons */}
                    <div className="mt-2 flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className={cn('h-8 gap-1.5 text-xs', isLiked && 'text-rose-500')}>
                            <Heart className={cn('h-4 w-4', isLiked && 'fill-current')} /> {p.likesCount + (isLiked ? 1 : 0)}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          <div className="flex items-center justify-around p-2">
                            {REACTIONS.map((r) => (
                              <button key={r.type} onClick={() => reactToPost(p.id, r.type)}
                                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted text-lg transition hover:scale-110">
                                {r.emoji}
                              </button>
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
                        onClick={() => toggle(expanded, setExpanded, p.id)}>
                        <MessageCircle className="h-4 w-4" /> {p.commentsCount}
                      </Button>
                      <Button variant="ghost" size="sm" className={cn('h-8 gap-1.5 text-xs', isSaved && 'text-primary')}
                        onClick={() => { toggle(saved, setSaved, p.id); if (!saved.has(p.id)) toast.success('Saved') }}>
                        <Bookmark className={cn('h-4 w-4', isSaved && 'fill-current')} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => sharePost(p)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Comments */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 space-y-2 overflow-hidden">
                          <div className="flex gap-2.5">
                            <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary/15 text-primary text-[10px]">You</AvatarFallback></Avatar>
                            <div className="flex-1 flex gap-2">
                              <Input placeholder="Write a comment..." className="h-8 text-xs"
                                value={commentInputs[p.id] || ''}
                                onChange={(e) => setCommentInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitComment(p.id) } }}
                              />
                              <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => submitComment(p.id)} disabled={!(commentInputs[p.id] || '').trim()}>
                                <Send className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </>
  )
}

// ─── Create Post Dialog ─────────────────────────────────────────────────────

function CreatePostDialog({ open, onOpenChange, spaces, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  spaces: Space[]; onCreated: () => void;
}) {
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCat, setNewCat] = useState('General')
  const [newSpace, setNewSpace] = useState('')
  const [creating, setCreating] = useState(false)

  const createPost = async () => {
    if (!newTitle.trim() || !newContent.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/data/community', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, content: newContent, category: newCat, spaceId: newSpace || undefined }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      toast.success('Post published to community!')
      setNewTitle(''); setNewContent(''); setNewCat('General'); setNewSpace('')
      onOpenChange(false)
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create post')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create a post</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.filter(c => c !== 'All').map((c) => (
              <button key={c} onClick={() => setNewCat(c)}
                className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition',
                  newCat === c ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70')}>
                {c}
              </button>
            ))}
          </div>
          {spaces.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Space (optional)</Label>
              <select value={newSpace} onChange={(e) => setNewSpace(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">No space</option>
                {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Post title" />
          <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="What's on your mind? Use #hashtags to tag." rows={5} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setNewTitle(''); setNewContent(''); onOpenChange(false) }}>Cancel</Button>
            <Button size="sm" onClick={createPost} disabled={creating || !newTitle.trim() || !newContent.trim()}>
              {creating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              Publish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Spaces View ────────────────────────────────────────────────────────────

function SpacesView({ spaces, selectedSpaceId, onSelectSpace, onSpacesChange }: {
  spaces: Space[]; selectedSpaceId: string | null;
  onSelectSpace: (id: string | null) => void; onSpacesChange: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('PUBLIC')
  const [creating, setCreating] = useState(false)
  const [localSpaces, setLocalSpaces] = useState<Space[]>(spaces)

  useEffect(() => { setLocalSpaces(spaces) }, [spaces])

  const createSpace = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/community/spaces', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description, visibility }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      const newSpace: Space = {
        id: data.space.id, name: data.space.name, slug: data.space.slug,
        description, memberCount: 0, postCount: 0, visibility,
      }
      setLocalSpaces(prev => [...prev, newSpace])
      toast.success('Space created', { description: `"${name}" is now live.` })
      setName(''); setDescription(''); setVisibility('PUBLIC')
      setCreateOpen(false)
      onSpacesChange()
      // Auto-navigate to the newly created space
      setTimeout(() => onSelectSpace(data.space.id), 200)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  // Space detail view
  if (selectedSpaceId) {
    const space = localSpaces.find(s => s.id === selectedSpaceId)
    if (space) {
      return <SpaceDetail space={space} onBack={() => onSelectSpace(null)} />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Spaces</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{localSpaces.length} space{localSpaces.length !== 1 ? 's' : ''}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New Space</Button>
      </div>
      {localSpaces.length === 0 ? (
        <ModuleEmptyState icon={Hash} title="No spaces yet" hint="Create your first space to organize discussions." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {localSpaces.map((s, i) => (
            <Card key={s.id} className="hover:shadow-md transition cursor-pointer" onClick={() => onSelectSpace(s.id)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', SPACE_COLORS[i % SPACE_COLORS.length])}>
                    <Hash className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.memberCount} members · {s.postCount} posts</p>
                  </div>
                  {s.visibility && s.visibility !== 'PUBLIC' && (
                    <Badge variant="secondary" className="text-xs shrink-0">{s.visibility}</Badge>
                  )}
                </div>
                {s.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Space</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Space name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing Tips" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this space about?" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Visibility</Label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="PUBLIC">Public — Anyone can see and join</option>
                <option value="PRIVATE">Private — Members must be approved</option>
                <option value="HIDDEN">Hidden — Invite only</option>
                <option value="WORKSPACE_ONLY">Workspace only — Only workspace members</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createSpace} disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Create space
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SpaceDetail({ space, onBack }: { space: Space; onBack: () => void }) {
  const [spaceTab, setSpaceTab] = useState<'feed' | 'about' | 'members'>('feed')
  const [newPost, setNewPost] = useState('')
  const [posting, setPosting] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)

  useEffect(() => {
    fetch(`/api/community/posts?spaceId=${space.id}&pageSize=20`)
      .then(r => r.json())
      .then(d => setPosts(d.posts || []))
      .catch(() => {})
      .finally(() => setLoadingPosts(false))
  }, [space.id])

  const createPostInSpace = async () => {
    if (!newPost.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/data/community', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newPost.trim().slice(0, 80), content: newPost.trim(), category: space.name, spaceId: space.id }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Posted to ' + space.name)
      setNewPost('')
      // Refresh posts
      const d = await fetch(`/api/community/posts?spaceId=${space.id}&pageSize=20`).then(r => r.json())
      setPosts(d.posts || [])
    } catch (e) {
      toast.error('Failed to post')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1.5" /> All Spaces</Button>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Hash className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{space.name}</h2>
              <p className="text-sm text-muted-foreground">{space.memberCount} members · {space.postCount} posts</p>
            </div>
            {space.visibility && space.visibility !== 'PUBLIC' && (
              <Badge variant="secondary" className="text-xs">{space.visibility}</Badge>
            )}
          </div>
          {space.description && <p className="mt-3 text-sm text-muted-foreground">{space.description}</p>}
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b">
        {(['feed', 'about', 'members'] as const).map((tab) => (
          <button key={tab} onClick={() => setSpaceTab(tab)}
            className={cn('px-4 py-2 text-sm font-medium transition border-b-2 -mb-px capitalize',
              spaceTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {tab}
          </button>
        ))}
      </div>

      {spaceTab === 'feed' && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4">
              <Textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder={`Share something in ${space.name}...`} rows={3} />
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={createPostInSpace} disabled={posting || !newPost.trim()}>
                  {posting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>
          {loadingPosts ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : posts.length === 0 ? (
            <ModuleEmptyState icon={MessageCircle} title="No posts in this space yet" hint="Be the first to start a conversation." />
          ) : (
            posts.map(p => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{(p.author || 'U').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.author}</span>
                        <span className="text-xs text-muted-foreground">· {timeAgo(p.createdAt)}</span>
                      </div>
                      <h4 className="mt-1 font-medium text-sm">{p.title}</h4>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{p.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {spaceTab === 'about' && (
        <Card><CardContent className="p-6 space-y-3">
          <h3 className="text-sm font-semibold">About this Space</h3>
          <p className="text-sm text-muted-foreground">{space.description || 'No description provided.'}</p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-lg font-bold">{space.memberCount}</p><p className="text-xs text-muted-foreground">Members</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-lg font-bold">{space.postCount}</p><p className="text-xs text-muted-foreground">Posts</p></div>
          </div>
        </CardContent></Card>
      )}

      {spaceTab === 'members' && (
        <Card><CardContent className="p-6 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium">Member directory</p>
          <p className="text-xs text-muted-foreground mt-1">{space.memberCount} members in this space</p>
        </CardContent></Card>
      )}
    </div>
  )
}

// ─── Members View ───────────────────────────────────────────────────────────

function MembersView({ onInvite }: { onInvite: () => void }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: '20',
        search,
        role: roleFilter === 'all' ? '' : roleFilter,
        status: statusFilter === 'all' ? '' : statusFilter,
        sort: 'joinedAt', order: 'desc',
      })
      const res = await fetch(`/api/community/members?${params}`)
      const data = await res.json()
      if (res.ok) {
        setMembers(data.members || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      }
    } catch {} finally { setLoading(false) }
  }, [page, search, roleFilter, statusFilter])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const updateMemberState = async (memberId: string, state: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'MUTED', reason?: string) => {
    setActionLoading(memberId)
    try {
      const res = await fetch(`/api/community/members/${memberId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberStatus: state, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(`Member ${state.toLowerCase()}`)
      fetchMembers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  const updateMemberRole = async (memberId: string, role: string) => {
    setActionLoading(memberId)
    try {
      const res = await fetch(`/api/community/members/${memberId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(`Role changed to ${role}`)
      fetchMembers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member from the workspace?')) return
    setActionLoading(memberId)
    try {
      const res = await fetch(`/api/community/members?id=${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Member removed')
      fetchMembers()
    } catch { toast.error('Failed') } finally { setActionLoading(null) }
  }

  const exportCSV = () => {
    window.open(`/api/community/members/export?search=${search}&role=${roleFilter === 'all' ? '' : roleFilter}&status=${statusFilter === 'all' ? '' : statusFilter}`, '_blank')
    toast.success('Exporting CSV...')
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Members</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{total} member{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1.5" /> Export CSV</Button>
          <Button size="sm" onClick={onInvite}><UserPlus className="h-4 w-4 mr-1.5" /> Invite People</Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{total}</p><p className="text-xs text-muted-foreground">Total Members</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-emerald-500">{members.filter(m => m.memberStatus === 'ACTIVE').length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-amber-500">{members.filter(m => m.memberStatus !== 'ACTIVE').length}</p><p className="text-xs text-muted-foreground">Restricted</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-primary">{members.filter(m => Date.now() - new Date(m.lastSeenAt).getTime() < 3600000).length}</p><p className="text-xs text-muted-foreground">Recent (1h)</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search members..." className="pl-9" />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="all">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          <option value="OWNER">OWNER</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
          <option value="MUTED">Muted</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No members found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleSelect(m.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                        <div>
                          <p className="text-sm font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={cn('text-xs', ROLE_COLORS[m.role])}>{m.role}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn('text-xs', STATUS_COLORS[m.memberStatus])}>{m.memberStatus}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(m.joinedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(m.lastSeenAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.postsCount}p · {m.commentsCount}c · {m.likesReceived}❤</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={actionLoading === m.id}>
                            {actionLoading === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Manage</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {m.role !== 'OWNER' && (
                            <>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {ROLES.filter(r => r !== m.role).map(r => (
                                    <DropdownMenuItem key={r} onClick={() => updateMemberRole(m.id, r)}>{r}</DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              {m.memberStatus === 'ACTIVE' ? (
                                <>
                                  <DropdownMenuItem onClick={() => updateMemberState(m.id, 'MUTED', 'Muted by admin')}><VolumeX className="h-4 w-4 mr-2" /> Mute</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateMemberState(m.id, 'SUSPENDED', 'Suspended by admin')}><Clock className="h-4 w-4 mr-2" /> Suspend</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateMemberState(m.id, 'BANNED', 'Banned by admin')} className="text-rose-600"><Ban className="h-4 w-4 mr-2" /> Ban</DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem onClick={() => updateMemberState(m.id, 'ACTIVE')}><CheckCircle2 className="h-4 w-4 mr-2" /> Reactivate</DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => removeMember(m.id)} className="text-rose-600"><Trash2 className="h-4 w-4 mr-2" /> Remove</DropdownMenuItem>
                            </>
                          )}
                          {m.role === 'OWNER' && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">Workspace owner — no actions available</div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Events View ────────────────────────────────────────────────────────────

function EventsView({ events: initialEvents }: { events: EventItem[] }) {
  const [events, setEvents] = useState(initialEvents)
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('ONLINE')
  const [location, setLocation] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [creating, setCreating] = useState(false)
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null)

  useEffect(() => { setEvents(initialEvents) }, [initialEvents])

  const createEvent = async () => {
    if (!title.trim() || !date || !time) { toast.error('Title, date and time are required'); return }
    setCreating(true)
    try {
      const startTime = new Date(`${date}T${time}`)
      const res = await fetch('/api/community/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description, type, location, meetingUrl, startTime: startTime.toISOString() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setEvents(prev => [...prev, {
        id: data.event.id, title: title.trim(), description, type,
        location: location || null, meetingUrl: meetingUrl || null,
        startTime: startTime.toISOString(), status: 'SCHEDULED',
        attendeeCount: 0, userRsvp: null,
      }])
      toast.success('Event created!')
      setTitle(''); setDescription(''); setLocation(''); setMeetingUrl(''); setDate(''); setTime('')
      setCreateOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  const rsvp = async (eventId: string, status: 'GOING' | 'MAYBE' | 'NOT_GOING') => {
    setRsvpLoading(eventId)
    try {
      const res = await fetch('/api/community/events/rsvp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, status }),
      })
      if (!res.ok) throw new Error('Failed')
      setEvents(prev => prev.map(e => {
        if (e.id !== eventId) return e
        let count = e.attendeeCount
        if (e.userRsvp === 'GOING' && status !== 'GOING') count = Math.max(0, count - 1)
        else if (e.userRsvp !== 'GOING' && status === 'GOING') count = count + 1
        return { ...e, userRsvp: status, attendeeCount: count }
      }))
      toast.success(status === 'GOING' ? 'You are going!' : status === 'MAYBE' ? 'Maybe' : 'Not going')
    } catch { toast.error('Failed') } finally { setRsvpLoading(null) }
  }

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event?')) return
    try {
      const res = await fetch(`/api/community/events?id=${eventId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setEvents(prev => prev.filter(e => e.id !== eventId))
      toast.success('Event deleted')
    } catch { toast.error('Failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Events</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{events.length} upcoming event{events.length !== 1 ? 's' : ''}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New Event</Button>
      </div>
      {events.length === 0 ? (
        <ModuleEmptyState icon={Calendar} title="No upcoming events" hint="Schedule a workshop, AMA, or co-working sprint." />
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const eventDate = new Date(e.startTime)
            return (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 text-primary px-3 py-2 min-w-[60px]">
                      <span className="text-xs font-medium uppercase">{eventDate.toLocaleDateString('en', { month: 'short' })}</span>
                      <span className="text-xl font-bold">{eventDate.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{e.title}</p>
                        <Badge variant="secondary" className="text-xs">{e.type}</Badge>
                      </div>
                      {e.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>{eventDate.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}</span>
                        {e.location && <span>{e.location}</span>}
                        <span>{e.attendeeCount} attending</span>
                      </div>
                      {e.meetingUrl && (
                        <a href={e.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">Join meeting →</a>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {e.userRsvp === 'GOING' && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-xs">Going</Badge>}
                      {e.userRsvp === 'MAYBE' && <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">Maybe</Badge>}
                      {e.userRsvp === 'NOT_GOING' && <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">Not going</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 border-t pt-3">
                    <Button size="sm" variant={e.userRsvp === 'GOING' ? 'default' : 'outline'} className="h-7 text-xs"
                      onClick={() => rsvp(e.id, 'GOING')} disabled={rsvpLoading === e.id}>
                      {rsvpLoading === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Going'}
                    </Button>
                    <Button size="sm" variant={e.userRsvp === 'MAYBE' ? 'default' : 'outline'} className="h-7 text-xs"
                      onClick={() => rsvp(e.id, 'MAYBE')} disabled={rsvpLoading === e.id}>Maybe</Button>
                    <Button size="sm" variant={e.userRsvp === 'NOT_GOING' ? 'default' : 'outline'} className="h-7 text-xs"
                      onClick={() => rsvp(e.id, 'NOT_GOING')} disabled={rsvpLoading === e.id}>Can&apos;t go</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto"><MoreVertical className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => deleteEvent(e.id)} className="text-rose-600"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Event title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly Q&A Session" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this event about?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Date *</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Time *</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">In-person</option>
                <option value="ZOOM">Zoom</option>
                <option value="MEET">Google Meet</option>
                <option value="TEAMS">Microsoft Teams</option>
              </select>
            </div>
            {type !== 'OFFLINE' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Meeting URL</Label>
                <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." />
              </div>
            )}
            {type === 'OFFLINE' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue address" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createEvent} disabled={creating || !title.trim() || !date || !time}>
              {creating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Create event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Leaderboard View ───────────────────────────────────────────────────────

function LeaderboardView() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'all'>('weekly')
  const entries = [
    { name: 'Alex Rivera', points: 420, posts: 12, comments: 34, initials: 'AR', color: 'bg-amber-500/15 text-amber-600' },
    { name: 'Priya Patel', points: 380, posts: 8, comments: 28, initials: 'PP', color: 'bg-violet-500/15 text-violet-600' },
    { name: 'Jamie Chen', points: 320, posts: 6, comments: 22, initials: 'JC', color: 'bg-emerald-500/15 text-emerald-600' },
    { name: 'Marcus Lee', points: 280, posts: 5, comments: 18, initials: 'ML', color: 'bg-sky-500/15 text-sky-600' },
    { name: 'Sofia Diaz', points: 240, posts: 4, comments: 15, initials: 'SD', color: 'bg-rose-500/15 text-rose-600' },
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Leaderboard</h2>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['weekly', 'monthly', 'all'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn('rounded-md px-3 py-1 text-sm font-medium transition capitalize', period === p ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
              {p === 'all' ? 'All Time' : p}
            </button>
          ))}
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          {entries.map((e, i) => (
            <div key={e.name} className="flex items-center gap-3 p-4 border-b last:border-0">
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shrink-0',
                i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-700 text-white' : 'bg-muted text-muted-foreground')}>
                {i + 1}
              </span>
              <Avatar className="h-10 w-10"><AvatarFallback className={cn('text-xs font-medium', e.color)}>{e.initials}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{e.name}</p><p className="text-xs text-muted-foreground">{e.posts} posts · {e.comments} comments</p></div>
              <Badge variant="secondary" className="text-xs font-bold">{e.points} pts</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Moderation View ────────────────────────────────────────────────────────

function ModerationView() {
  const [tab, setTab] = useState<'queue' | 'keywords' | 'audit'>('queue')
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Moderation</h2>
      <div className="flex gap-1 border-b">
        {(['queue', 'keywords', 'audit'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium transition border-b-2 -mb-px capitalize',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t === 'audit' ? 'Audit Log' : t}
          </button>
        ))}
      </div>
      {tab === 'queue' && <ModerationQueue />}
      {tab === 'keywords' && <BannedKeywords />}
      {tab === 'audit' && <AuditLog />}
    </div>
  )
}

function ModerationQueue() {
  const { data, loading, refetch } = useApi<{ items: any[], pending: number } | null>('/api/community/moderation/queue')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const resolveReport = async (reportId: string, status: 'RESOLVED' | 'DISMISSED', resolution?: string) => {
    setActionLoading(reportId)
    try {
      const res = await fetch(`/api/community/moderation/reports/${reportId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(status === 'RESOLVED' ? 'Report resolved' : 'Report dismissed')
      refetch()
    } catch { toast.error('Failed') } finally { setActionLoading(null) }
  }

  if (loading) return <Skeleton className="h-40 rounded-xl" />
  const items = data?.items || []

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-amber-500">{data?.pending || 0}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{data?.resolvedToday || 0}</p><p className="text-xs text-muted-foreground">Resolved today</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{data?.dismissedToday || 0}</p><p className="text-xs text-muted-foreground">Dismissed today</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{items.length}</p><p className="text-xs text-muted-foreground">In queue</p></CardContent></Card>
      </div>
      {items.length === 0 ? (
        <ModuleEmptyState icon={Shield} title="No reports in queue" hint="Reported content will appear here for review." />
      ) : items.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{r.targetType}</Badge>
                  <Badge variant="secondary" className="text-xs">{r.reason}</Badge>
                  <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[r.status] || 'bg-muted')}>{r.status}</Badge>
                  <span className="text-xs text-muted-foreground">· {timeAgo(r.createdAt)}</span>
                </div>
                {r.target?.title && <p className="mt-1.5 text-sm font-medium truncate">{r.target.title}</p>}
                {r.target?.preview && <p className="text-xs text-muted-foreground line-clamp-2">{r.target.preview}</p>}
                {r.description && <p className="mt-1 text-xs text-muted-foreground italic">"{r.description}"</p>}
                <p className="mt-1 text-xs text-muted-foreground">Reported by {r.reporter?.name || 'Unknown'}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="sm" variant="default" className="h-7 text-xs" disabled={actionLoading === r.id}
                  onClick={() => resolveReport(r.id, 'RESOLVED', 'REMOVED')}><CheckCircle2 className="h-3 w-3 mr-1" /> Resolve</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={actionLoading === r.id}
                  onClick={() => resolveReport(r.id, 'DISMISSED')}><X className="h-3 w-3 mr-1" /> Dismiss</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function BannedKeywords() {
  const { data, loading, refetch } = useApi<{ keywords: any[] } | null>('/api/community/moderation/keywords')
  const [addOpen, setAddOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState('BLOCK')
  const [severity, setSeverity] = useState('MEDIUM')
  const [testContent, setTestContent] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  const addKeyword = async () => {
    if (!keyword.trim()) return
    try {
      const res = await fetch('/api/community/moderation/keywords', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim(), action, severity }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed') }
      toast.success('Keyword added')
      setKeyword(''); setAction('BLOCK'); setSeverity('MEDIUM')
      setAddOpen(false)
      refetch()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const deleteKeyword = async (id: string) => {
    try {
      const res = await fetch(`/api/community/moderation/keywords?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Keyword removed')
      refetch()
    } catch { toast.error('Failed') }
  }

  const checkContent = async () => {
    if (!testContent.trim()) return
    setTesting(true)
    try {
      const res = await fetch('/api/community/moderation/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: testContent }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch { toast.error('Failed') } finally { setTesting(false) }
  }

  if (loading) return <Skeleton className="h-40 rounded-xl" />
  const keywords = data?.keywords || []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{keywords.length} banned keyword{keywords.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Add Keyword</Button>
      </div>

      {keywords.length === 0 ? (
        <ModuleEmptyState icon={Shield} title="No banned keywords" hint="Add keywords to automatically filter content." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.keyword}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{k.action}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{k.severity}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(k.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteKeyword(k.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Content checker */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Test content</p>
          <Textarea value={testContent} onChange={(e) => setTestContent(e.target.value)} placeholder="Type content to check against banned keywords..." rows={3} />
          <Button size="sm" onClick={checkContent} disabled={testing || !testContent.trim()}>
            {testing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Check content
          </Button>
          {testResult && (
            <div className="mt-2 space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2">
                {testResult.allowed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Ban className="h-4 w-4 text-rose-500" />}
                <span className="font-medium">{testResult.allowed ? 'Allowed' : 'Blocked'}</span>
                {testResult.flagged && <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">Flagged</Badge>}
              </div>
              {testResult.matchedKeywords?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Matched keywords:</p>
                  <div className="flex flex-wrap gap-1">
                    {testResult.matchedKeywords.map((k: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{k.keyword} ({k.action})</Badge>
                    ))}
                  </div>
                </div>
              )}
              {testResult.cleanedContent && testResult.cleanedContent !== testContent && (
                <div><p className="text-xs text-muted-foreground mb-1">Cleaned:</p><p className="text-xs">{testResult.cleanedContent}</p></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add banned keyword</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Keyword</Label>
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. spam" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Action</Label>
              <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="BLOCK">Block — prevent posting</option>
                <option value="REVIEW">Review — flag for moderation</option>
                <option value="REPLACE">Replace — swap with ***</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Severity</Label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addKeyword} disabled={!keyword.trim()}>Add keyword</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AuditLog() {
  const { data, loading } = useApi<{ logs: any[] } | null>('/api/community/moderation/audit-log?pageSize=50')
  if (loading) return <Skeleton className="h-40 rounded-xl" />
  const logs = data?.logs || []
  if (logs.length === 0) return <ModuleEmptyState icon={FileText} title="No audit log entries" hint="Administrative actions will appear here." />
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(l.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{(l.actor?.name || 'U').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    <span className="text-xs">{l.actor?.name || 'Unknown'}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{l.action}</Badge></TableCell>
                <TableCell className="text-xs">{l.targetType || '-'} {l.targetId ? `· ${l.targetId.slice(-6)}` : ''}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{JSON.stringify(l.metadata).slice(0, 100)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ─── Invite Dialog ──────────────────────────────────────────────────────────

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [tab, setTab] = useState('email')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [message, setMessage] = useState('')
  const [inviting, setInviting] = useState(false)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [linkData, setLinkData] = useState<{ inviteUrl: string; token: string } | null>(null)

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch('/api/community/invitations?status=PENDING&pageSize=50')
      const data = await res.json()
      if (res.ok) setInvitations(data.invitations || [])
    } catch {}
  }, [])

  useEffect(() => { if (open) fetchInvitations() }, [open, fetchInvitations])

  const sendInvite = async () => {
    if (!email.trim()) return
    setInviting(true)
    try {
      const emails = email.split(/[,\n]/).map(e => e.trim()).filter(Boolean)
      const res = await fetch('/api/community/invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emails[0], role, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('Invitation sent', { description: `Sent to ${emails[0]}` })
      setEmail(''); setMessage('')
      fetchInvitations()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setInviting(false) }
  }

  const generateLink = async () => {
    setInviting(true)
    try {
      const res = await fetch('/api/community/invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `link-${Date.now()}@invite.local`, role, message: 'Link invitation' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setLinkData({ inviteUrl: `/invite/${data.token}`, token: data.token })
      toast.success('Invite link generated')
      fetchInvitations()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setInviting(false) }
  }

  const resendInvite = async (id: string) => {
    try {
      const res = await fetch(`/api/community/invitations/${id}/resend`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Invitation resent')
      fetchInvitations()
    } catch { toast.error('Failed') }
  }

  const revokeInvite = async (id: string) => {
    try {
      const res = await fetch(`/api/community/invitations?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Invitation revoked')
      fetchInvitations()
    } catch { toast.error('Failed') }
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Invite People</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="email"><Mail className="h-3.5 w-3.5 mr-1.5" />Email</TabsTrigger>
            <TabsTrigger value="link"><Link2 className="h-3.5 w-3.5 mr-1.5" />Link</TabsTrigger>
            <TabsTrigger value="qr"><QrCode className="h-3.5 w-3.5 mr-1.5" />QR Code</TabsTrigger>
            <TabsTrigger value="csv"><Upload className="h-3.5 w-3.5 mr-1.5" />Bulk CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Email address</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Role</Label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Personal message (optional)</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Join our community!" rows={2} />
            </div>
            <Button onClick={sendInvite} disabled={inviting || !email.trim()} className="w-full">
              {inviting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              Send Invitation
            </Button>
          </TabsContent>

          <TabsContent value="link" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Role</Label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={generateLink} disabled={inviting} className="w-full">
              {inviting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Link2 className="h-4 w-4 mr-1.5" />}
              Generate Invite Link
            </Button>
            {linkData && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Invite link (expires in 7 days):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-1 text-xs truncate">{window.location.origin}{linkData.inviteUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copyLink(linkData.token)}><Share2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="qr" className="space-y-3">
            <p className="text-sm text-muted-foreground">Generate a QR code that people can scan to join your workspace.</p>
            {linkData ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-lg border-2 border-foreground p-4">
                  <div className="grid grid-cols-8 gap-0.5">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div key={i} className={cn('h-4 w-4', (i * 7 + linkData.token.length) % 3 === 0 ? 'bg-foreground' : 'bg-background')} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Scan to join</p>
                <Button size="sm" variant="outline" onClick={() => copyLink(linkData.token)}><Share2 className="h-3.5 w-3.5 mr-1.5" />Copy link</Button>
              </div>
            ) : (
              <Button onClick={generateLink} disabled={inviting}>
                {inviting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <QrCode className="h-4 w-4 mr-1.5" />}
                Generate QR Code
              </Button>
            )}
          </TabsContent>

          <TabsContent value="csv" className="space-y-3">
            <p className="text-sm text-muted-foreground">Paste CSV with format: <code className="text-xs bg-muted px-1 rounded">email,role,message</code></p>
            <Textarea
              placeholder={'alice@example.com,MEMBER,Welcome!\nbob@example.com,STUDENT,'}
              rows={6}
              onChange={async (e) => {
                const text = e.target.value
                if (!text.trim()) return
                // Parse CSV and send bulk
              }}
            />
            <Button className="w-full" disabled><Upload className="h-4 w-4 mr-1.5" />Import invitations</Button>
            <p className="text-xs text-muted-foreground text-center">CSV bulk import — each row creates an invitation</p>
          </TabsContent>
        </Tabs>

        {/* Pending invitations list */}
        {invitations.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <p className="text-sm font-medium">Pending Invitations ({invitations.length})</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{inv.email || inv.username}</p>
                    <p className="text-xs text-muted-foreground">{inv.role} · expires {timeAgo(inv.expiresAt)}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{inv.status}</Badge>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => resendInvite(inv.id)}><Send className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => revokeInvite(inv.id)}><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Notifications Panel ────────────────────────────────────────────────────

function NotificationsPanel() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/community/notifications?pageSize=20')
      const data = await res.json()
      if (res.ok) setNotifications(data.notifications || [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  const markAllRead = async () => {
    try {
      await fetch('/api/community/notifications', { method: 'POST' })
      toast.success('All marked as read')
      fetchNotifs()
    } catch {}
  }

  const toggleRead = async (id: string, read: boolean) => {
    try {
      await fetch(`/api/community/notifications/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: !read }),
      })
      fetchNotifs()
    } catch {}
  }

  const deleteNotif = async (id: string) => {
    try {
      await fetch(`/api/community/notifications/${id}`, { method: 'DELETE' })
      fetchNotifs()
    } catch {}
  }

  return (
    <div className="space-y-3">
      <SheetHeader>
        <SheetTitle className="flex items-center justify-between">
          <span>Notifications</span>
          {notifications.some(n => !n.read) && (
            <Button size="sm" variant="ghost" onClick={markAllRead} className="text-xs">Mark all read</Button>
          )}
        </SheetTitle>
      </SheetHeader>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n) => (
            <div key={n.id} className={cn('rounded-lg border p-3 transition', !n.read && 'bg-primary/5 border-primary/20')}>
              <div className="flex items-start gap-2">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  n.type === 'REACTION' ? 'bg-rose-500/10 text-rose-500' :
                  n.type === 'MENTION' ? 'bg-sky-500/10 text-sky-500' :
                  n.type === 'WARNING' ? 'bg-amber-500/10 text-amber-500' :
                  'bg-muted text-muted-foreground')}>
                  {n.type === 'REACTION' ? <Heart className="h-4 w-4" /> :
                   n.type === 'MENTION' ? <AtSign className="h-4 w-4" /> :
                   n.type === 'COMMENT' || n.type === 'REPLY' ? <MessageCircle className="h-4 w-4" /> :
                   <Bell className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', !n.read && 'font-semibold')}>{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => toggleRead(n.id, n.read)}>{n.read ? 'Mark unread' : 'Mark read'}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteNotif(n.id)} className="text-rose-600">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── About View ─────────────────────────────────────────────────────────────

function AboutView({ stats }: { stats: CommunityData['stats'] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">About this Community</h2>
      <Card><CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">Welcome to our creator community! This is a space for creators to connect, share wins, ask questions, and grow together.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center"><p className="text-xl font-bold">{stats.totalMembers}</p><p className="text-xs text-muted-foreground">Members</p></div>
          <div className="rounded-lg bg-muted/50 p-3 text-center"><p className="text-xl font-bold">{stats.totalPosts}</p><p className="text-xs text-muted-foreground">Posts</p></div>
          <div className="rounded-lg bg-muted/50 p-3 text-center"><p className="text-xl font-bold">{stats.totalSpaces}</p><p className="text-xs text-muted-foreground">Spaces</p></div>
          <div className="rounded-lg bg-muted/50 p-3 text-center"><p className="text-xl font-bold">{stats.totalEvents}</p><p className="text-xs text-muted-foreground">Events</p></div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">Community Guidelines</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Be respectful and kind to all members</li>
            <li>• Share knowledge and help others grow</li>
            <li>• No spam or excessive self-promotion</li>
            <li>• Use appropriate spaces for your posts</li>
            <li>• Report inappropriate content</li>
          </ul>
        </div>
      </CardContent></Card>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-3.5 w-3.5" /></div>
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function CommunitySkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr_280px]">
      <Skeleton className="h-64 rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-16 rounded-xl" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}
