import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"

/**
 * Frosted shell only (no layout).
 * - `tinted`: faint cool wash + soft corner glows (dashboard cards).
 * - `plain`: neutral card tint only — use for dense feeds so rows don’t read as “all blue”.
 */
const glassSurfaceVariants = cva("relative isolate overflow-hidden rounded-xl text-card-foreground", {
  variants: {
    surface: {
      tinted: [
        "border border-white/[0.09] dark:border-white/[0.06]",
        "bg-gradient-to-br from-blue-500/[0.045] via-card/40 to-sky-500/[0.035]",
        "dark:from-blue-400/[0.035] dark:via-card/34 dark:to-cyan-500/[0.03]",
        "supports-[backdrop-filter]:bg-card/[0.30]",
        "backdrop-blur-lg backdrop-saturate-115 supports-[backdrop-filter]:backdrop-saturate-[1.22]",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        "before:pointer-events-none before:absolute before:-right-16 before:-top-14 before:h-[min(160px,42%)] before:w-[min(200px,52%)] before:rounded-full before:bg-blue-500/10 before:blur-3xl before:content-[''] dark:before:bg-blue-400/8",
        "after:pointer-events-none after:absolute after:-bottom-20 after:-left-14 after:h-[min(140px,38%)] after:w-[min(180px,48%)] after:rounded-full after:bg-sky-400/9 after:blur-3xl after:content-[''] dark:after:bg-cyan-500/7",
      ],
      plain: [
        "border border-border/45 dark:border-border/40",
        "bg-card/46 backdrop-blur-md backdrop-saturate-105 supports-[backdrop-filter]:bg-card/40",
        "shadow-sm shadow-black/[0.02] dark:shadow-black/[0.25]",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
      ],
    },
    rim: {
      none: "",
      /** Meaningful classes live in compoundVariants so rims stay organic (no full-width bar border). */
      success: "",
      destructive: "",
      neutral: "",
      primary: "",
      primaryStart: "",
    },
  },
  compoundVariants: [
    /* --- Plain: localized “reflection” near badges (blur + skew), not a ruler-straight edge --- */
    {
      surface: "plain",
      rim: "success",
      class: [
        "before:pointer-events-none before:absolute before:-left-10 before:-top-12 before:h-[7.5rem] before:w-[min(52vw,15rem)] before:rotate-[-11deg] before:rounded-[42%] before:bg-emerald-400/28 before:blur-2xl before:content-[''] dark:before:bg-emerald-400/20",
        "after:pointer-events-none after:absolute after:left-0 after:top-0 after:h-[4px] after:w-[min(62%,13rem)] after:origin-left after:rotate-[-1.5deg] after:bg-gradient-to-r after:from-emerald-400/55 after:via-emerald-400/18 after:to-transparent after:content-[''] after:opacity-[0.85]",
      ],
    },
    {
      surface: "plain",
      rim: "destructive",
      class: [
        "before:pointer-events-none before:absolute before:-left-10 before:-top-12 before:h-[7.5rem] before:w-[min(52vw,15rem)] before:rotate-[-11deg] before:rounded-[42%] before:bg-rose-400/26 before:blur-2xl before:content-[''] dark:before:bg-rose-400/18",
        "after:pointer-events-none after:absolute after:left-0 after:top-0 after:h-[4px] after:w-[min(62%,13rem)] after:origin-left after:rotate-[-1.5deg] after:bg-gradient-to-r after:from-rose-400/50 after:via-rose-400/16 after:to-transparent after:content-[''] after:opacity-[0.85]",
      ],
    },
    {
      surface: "plain",
      rim: "neutral",
      class: [
        "before:pointer-events-none before:absolute before:-left-8 before:-top-10 before:h-24 before:w-[min(48vw,12rem)] before:rotate-[-9deg] before:rounded-[40%] before:bg-slate-400/14 before:blur-2xl before:content-[''] dark:before:bg-slate-500/16",
        "after:pointer-events-none after:absolute after:left-0 after:top-0 after:h-[3px] after:w-[min(48%,11rem)] after:rotate-[-1deg] after:bg-gradient-to-r after:from-slate-400/35 after:via-slate-400/12 after:to-transparent after:content-[''] dark:after:from-slate-500/40",
      ],
    },
    {
      surface: "plain",
      rim: "primary",
      class: [
        "before:pointer-events-none before:absolute before:-right-8 before:-top-8 before:h-[6.5rem] before:w-[min(46vw,13rem)] before:rotate-[10deg] before:rounded-[44%] before:bg-primary/22 before:blur-2xl before:content-['']",
        "after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-[4px] after:w-[min(48%,12rem)] after:origin-right after:rotate-[1.5deg] after:bg-gradient-to-l after:from-primary/45 after:via-primary/14 after:to-transparent after:content-['']",
      ],
    },
    {
      surface: "plain",
      rim: "primaryStart",
      class: [
        "before:pointer-events-none before:absolute before:-left-8 before:-top-8 before:h-[6.5rem] before:w-[min(46vw,13rem)] before:rotate-[-10deg] before:rounded-[44%] before:bg-primary/22 before:blur-2xl before:content-['']",
        "after:pointer-events-none after:absolute after:left-0 after:top-0 after:h-[4px] after:w-[min(48%,12rem)] after:origin-left after:rotate-[-1.5deg] after:bg-gradient-to-r after:from-primary/45 after:via-primary/14 after:to-transparent after:content-['']",
      ],
    },
    /* --- Tinted: keep blue pseudos; only add soft corner light (no extra ::before/::after) --- */
    {
      surface: "tinted",
      rim: "success",
      class:
        "shadow-[inset_24px_18px_42px_-28px_rgba(16,185,129,0.13),inset_0_1px_0_0_rgba(255,255,255,0.07)] dark:shadow-[inset_24px_18px_42px_-28px_rgba(16,185,129,0.09),inset_0_1px_0_0_rgba(255,255,255,0.04)]",
    },
    {
      surface: "tinted",
      rim: "destructive",
      class:
        "shadow-[inset_24px_18px_42px_-28px_rgba(244,63,94,0.11),inset_0_1px_0_0_rgba(255,255,255,0.07)] dark:shadow-[inset_24px_18px_42px_-28px_rgba(244,63,94,0.08),inset_0_1px_0_0_rgba(255,255,255,0.04)]",
    },
    {
      surface: "tinted",
      rim: "neutral",
      class:
        "shadow-[inset_18px_14px_36px_-26px_rgba(148,163,184,0.09),inset_0_1px_0_0_rgba(255,255,255,0.07)] dark:shadow-[inset_18px_14px_36px_-26px_rgba(148,163,184,0.07),inset_0_1px_0_0_rgba(255,255,255,0.04)]",
    },
    {
      surface: "tinted",
      rim: "primary",
      class:
        "shadow-[inset_-22px_16px_40px_-26px_color-mix(in_oklab,var(--primary)_18%,transparent),inset_0_1px_0_0_rgba(255,255,255,0.07)]",
    },
    {
      surface: "tinted",
      rim: "primaryStart",
      class:
        "shadow-[inset_22px_16px_40px_-26px_color-mix(in_oklab,var(--primary)_18%,transparent),inset_0_1px_0_0_rgba(255,255,255,0.07)]",
    },
  ],
  defaultVariants: {
    surface: "tinted",
    rim: "none",
  },
})

/** Standard vertical card layout on top of ``glassSurfaceVariants``. */
function cardVariants(opts?: VariantProps<typeof glassSurfaceVariants>) {
  return cn(glassSurfaceVariants(opts), "flex flex-col gap-6 py-6")
}

export type CardRim = NonNullable<VariantProps<typeof glassSurfaceVariants>["rim"]>
export type GlassSurface = NonNullable<VariantProps<typeof glassSurfaceVariants>["surface"]>

/** Maps sentiment score to a glass rim that echoes badge hue on the nearest card edge (top / inline-end). */
export function sentimentScoreToCardRim(score: number | null | undefined): CardRim {
  if (score == null || !Number.isFinite(score)) return "neutral"
  if (score > 0.15) return "success"
  if (score < -0.15) return "destructive"
  return "neutral"
}

export interface CardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof glassSurfaceVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, rim, surface, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      className={cn(cardVariants({ rim, surface }), className)}
      {...props}
    />
  ),
)
Card.displayName = "Card"

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header relative z-[1] grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("relative z-[1] px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "relative z-[1] flex items-center px-6 [.border-t]:pt-6",
        className,
      )}
      {...props}
    />
  )
}

export {
  Card,
  cardVariants,
  glassSurfaceVariants,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
