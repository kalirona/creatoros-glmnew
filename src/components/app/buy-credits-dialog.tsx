'use client'
import { useState } from 'react'
import { Zap, Check, Crown, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 500, price: 9, popular: false },
  { id: 'creator', name: 'Creator', credits: 1500, price: 24, popular: true },
  { id: 'pro', name: 'Pro', credits: 5000, price: 69, popular: false },
  { id: 'scale', name: 'Scale', credits: 15000, price: 179, popular: false },
]

interface BuyCreditsDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentCredits: number
  onPurchase?: (credits: number) => void
}

export function BuyCreditsDialog({ open, onOpenChange, currentCredits, onPurchase }: BuyCreditsDialogProps) {
  const [selected, setSelected] = useState('creator')

  const purchase = () => {
    const pkg = PACKAGES.find((p) => p.id === selected)!
    onPurchase?.(pkg.credits)
    toast.success(`Added ${pkg.credits.toLocaleString()} credits!`, {
      description: `$${pkg.price} charged to your payment method.`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Buy AI Credits
          </DialogTitle>
          <DialogDescription>
            You currently have <span className="font-semibold text-foreground">{currentCredits.toLocaleString()}</span> credits. Credits never expire.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2.5 py-2">
          {PACKAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={cn(
                'relative rounded-xl border-2 p-4 text-left transition',
                selected === p.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              )}
            >
              {p.popular && (
                <Badge className="absolute -top-2 right-3 bg-primary text-primary-foreground text-[9px]">
                  <Crown className="h-2.5 w-2.5 mr-0.5" /> Popular
                </Badge>
              )}
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{p.credits.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">credits</p>
              <p className="mt-2 text-sm font-semibold text-primary">${p.price}</p>
              {selected === p.id && (
                <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Tip:</span> Credits are consumed per AI generation (2-15 credits depending on the tool). Pro plan members get 1,500 credits monthly included.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={purchase}>
            <Zap className="h-4 w-4 mr-1.5" /> Purchase credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
