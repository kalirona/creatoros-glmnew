'use client'

import Link from 'next/link'
import { Sparkles, GraduationCap, Users, Package, Globe, MessageCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/40 sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">CreatorOS</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sign-in"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link href="/sign-up"><Button size="sm">Get Started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 md:px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
          <Zap className="h-3.5 w-3.5" />
          All-in-one creator business platform
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 max-w-3xl mx-auto">
          Build, sell, and grow your<br className="hidden md:block" /> creator business
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Create courses, sell digital products, build a community, and generate content with AI.
          Everything you need in one platform.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/sign-up"><Button size="lg" className="w-full sm:w-auto">Start Free <Sparkles className="h-4 w-4 ml-2" /></Button></Link>
          <Link href="/sign-in"><Button size="lg" variant="outline" className="w-full sm:w-auto">Sign in</Button></Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 md:px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Everything in one place</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard icon={GraduationCap} title="Online Courses" desc="Build and sell structured courses with modules, lessons, and progress tracking." />
          <FeatureCard icon={Package} title="Digital Products" desc="Sell downloads, templates, and digital goods with built-in checkout." />
          <FeatureCard icon={Users} title="Community" desc="Create spaces, post content, host events, and engage your audience." />
          <FeatureCard icon={Globe} title="Website Builder" desc="Build landing pages, blog posts, and your creator website." />
          <FeatureCard icon={MessageCircle} title="AI Assistant" desc="Write, improve, and brainstorm content with built-in AI tools." />
          <FeatureCard icon={Zap} title="Creator Dashboard" desc="Track sales, monitor growth, and manage your business at a glance." />
        </div>
      </section>

      {/* AI Section */}
      <section className="mx-auto max-w-6xl px-4 md:px-6 py-16">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
          <CardContent className="p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary mb-4">
                  <Sparkles className="h-3 w-3" /> AI-Powered
                </div>
                <h3 className="text-2xl font-bold mb-3">Create content 10x faster</h3>
                <p className="text-muted-foreground mb-4">
                  Use the built-in AI Assistant to write course lessons, product descriptions,
                  community posts, and website copy. Get suggestions, rewrite content, and
                  brainstorm ideas — all within your workspace.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> AI chat for writing and brainstorming</li>
                  <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Content history and saved outputs</li>
                  <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Credit-based usage with transparent costs</li>
                </ul>
              </div>
              <div className="rounded-xl border bg-muted/30 p-6 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></div>
                  <div className="rounded-lg bg-background border p-3 text-sm flex-1">
                    Write a welcome email for new course students
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><MessageCircle className="h-4 w-4" /></div>
                  <div className="rounded-lg bg-background border p-3 text-sm flex-1">
                    Welcome to the course! I'm thrilled to have you here. Over the next few weeks, you'll learn everything you need to...
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 md:px-6 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Start building today</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Join CreatorOS and get access to all the tools you need to run your creator business.
        </p>
        <Link href="/sign-up"><Button size="lg">Get Started Free <Sparkles className="h-4 w-4 ml-2" /></Button></Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <Sparkles className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-medium text-sm">CreatorOS</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/sign-in" className="hover:text-foreground transition">Sign In</Link>
            <Link href="/sign-up" className="hover:text-foreground transition">Sign Up</Link>
            <span>© 2025 CreatorOS</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Card className="border-border/50 hover:border-primary/30 transition">
      <CardContent className="p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  )
}
