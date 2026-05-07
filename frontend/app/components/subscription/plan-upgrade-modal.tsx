"use client"

import * as React from "react"
import { CheckCircle2, Sparkles, Zap, Building2 } from "lucide-react"
import { cn } from "~/lib/utils"
import { setLocalPlan, getLocalPlan } from "~/lib/auth-client"
import { getPlan, PLAN_BADGE, type PlanSlug, type SubscriptionFeature } from "~/lib/subscription"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog"
import { Button } from "~/components/ui/button"

const PLAN_ICON: Record<PlanSlug, React.ReactNode> = {
  free: <Zap className="size-5" />,
  pro: <Sparkles className="size-5" />,
  ultra: <Building2 className="size-5" />,
}

interface PlanUpgradeModalProps {
  targetPlan: PlanSlug
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm?: () => void
}

export function PlanUpgradeModal({
  targetPlan,
  open,
  onOpenChange,
  onConfirm,
}: PlanUpgradeModalProps) {
  const [confirming, setConfirming] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const currentPlan = getLocalPlan() as PlanSlug
  const plan = getPlan(targetPlan)
  const isDowngrade = (targetPlan === "free") || (targetPlan === "pro" && currentPlan === "ultra")
  const isSame = currentPlan === targetPlan

  function handleConfirm() {
    setConfirming(true)
    setTimeout(() => {
      setLocalPlan(targetPlan)
      setConfirming(false)
      setDone(true)
      onConfirm?.()
      setTimeout(() => {
        setDone(false)
        onOpenChange(false)
      }, 1200)
    }, 600)
  }

  React.useEffect(() => {
    if (open) setDone(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        {/* Header band */}
        <div className={cn(
          "relative flex flex-col items-center gap-3 px-6 py-8",
          targetPlan === "free" && "bg-gradient-to-br from-muted to-muted/60",
          targetPlan === "pro" && "bg-gradient-to-br from-violet-600/20 via-violet-500/10 to-transparent",
          targetPlan === "ultra" && "bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-transparent",
        )}>
          {/* Plan icon */}
          <div className={cn(
            "flex size-14 items-center justify-center rounded-2xl border",
            targetPlan === "free" && "border-border bg-muted text-muted-foreground",
            targetPlan === "pro" && "border-violet-500/30 bg-violet-500/15 text-violet-500 dark:text-violet-400",
            targetPlan === "ultra" && "border-amber-500/30 bg-amber-500/15 text-amber-500 dark:text-amber-400",
          )}>
            {PLAN_ICON[targetPlan]}
          </div>

          <DialogHeader className="items-center text-center space-y-1">
            <DialogTitle className="text-xl font-black tracking-tight">
              {isSame ? `Already on ${plan.name}` : isDowngrade ? `Downgrade to ${plan.name}` : `Upgrade to ${plan.name}`}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {plan.description}
            </DialogDescription>
          </DialogHeader>

          {/* Price badge */}
          {!isSame && (
            <div className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black",
              PLAN_BADGE[targetPlan],
            )}>
              {plan.price.monthly === 0
                ? "Free forever"
                : `$${plan.price.monthly}/month · $${plan.price.yearly}/year`}
            </div>
          )}
        </div>

        {/* Features list */}
        {!isSame && (
          <div className="border-t border-border/50 px-6 py-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {isDowngrade ? "You'll lose access to" : "What you get"}
            </p>
            {plan.features.map((f: SubscriptionFeature, i: number) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className={cn(
                  "mt-0.5 size-4 shrink-0",
                  isDowngrade ? "text-muted-foreground/40" : (
                    targetPlan === "pro" ? "text-violet-500 dark:text-violet-400" :
                    targetPlan === "ultra" ? "text-amber-500 dark:text-amber-400" :
                    "text-muted-foreground/70"
                  ),
                )} />
                <span className="text-sm text-foreground/80 leading-snug">{f.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-border/50 px-6 py-4 flex gap-3">
          {isSame ? (
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Got it
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={confirming}
              >
                Cancel
              </Button>
              <Button
                className={cn(
                  "flex-1 font-black transition-all",
                  done && "bg-emerald-600 hover:bg-emerald-600 text-white",
                  targetPlan === "free" && !done && "",
                  targetPlan === "pro" && !done && "bg-violet-600 hover:bg-violet-700 text-white",
                  targetPlan === "ultra" && !done && "bg-amber-600 hover:bg-amber-700 text-white",
                )}
                onClick={handleConfirm}
                disabled={confirming || done}
              >
                {done ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" /> Done!
                  </span>
                ) : confirming ? (
                  <span className="flex items-center gap-1.5">
                    <span className="size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Switching…
                  </span>
                ) : isDowngrade ? (
                  "Confirm Downgrade"
                ) : (
                  `Activate ${plan.name}`
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
