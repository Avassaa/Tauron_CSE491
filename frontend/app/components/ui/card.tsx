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
    {
      surface: "plain",
      rim: "success",
      class:
        "!bg-[radial-gradient(ellipse_95%_72%_at_18%_12%,rgba(16,185,129,0.11),transparent_58%),color-mix(in_oklab,var(--card)_46%,transparent)]",
    },
    {
      surface: "plain",
      rim: "destructive",
      class:
        "!bg-[radial-gradient(ellipse_95%_72%_at_18%_12%,rgba(244,63,94,0.10),transparent_58%),color-mix(in_oklab,var(--card)_46%,transparent)]",
    },
    {
      surface: "plain",
      rim: "neutral",
      class:
        "!bg-[radial-gradient(ellipse_90%_68%_at_22%_14%,rgba(148,163,184,0.07),transparent_58%),color-mix(in_oklab,var(--card)_46%,transparent)]",
    },
    {
      surface: "plain",
      rim: "primary",
      class:
        "!bg-[radial-gradient(ellipse_88%_65%_at_92%_14%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_56%),color-mix(in_oklab,var(--card)_46%,transparent)]",
    },
    {
      surface: "plain",
      rim: "primaryStart",
      class:
        "!bg-[radial-gradient(ellipse_88%_65%_at_12%_14%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_56%),color-mix(in_oklab,var(--card)_46%,transparent)]",
    },
    /* Tinted + rim: color only into the panel volume (soft inset wash), not a drawn edge */
    {
      surface: "tinted",
      rim: "success",
      class:
        "shadow-[inset_28px_22px_48px_-30px_rgba(16,185,129,0.08),inset_0_1px_0_0_rgba(255,255,255,0.07)] dark:shadow-[inset_28px_22px_48px_-30px_rgba(16,185,129,0.06),inset_0_1px_0_0_rgba(255,255,255,0.04)]",
    },
    {
      surface: "tinted",
      rim: "destructive",
      class:
        "shadow-[inset_28px_22px_48px_-30px_rgba(244,63,94,0.07),inset_0_1px_0_0_rgba(255,255,255,0.07)] dark:shadow-[inset_28px_22px_48px_-30px_rgba(244,63,94,0.05),inset_0_1px_0_0_rgba(255,255,255,0.04)]",
    },
    {
      surface: "tinted",
      rim: "neutral",
      class:
        "shadow-[inset_22px_18px_40px_-28px_rgba(148,163,184,0.06),inset_0_1px_0_0_rgba(255,255,255,0.07)] dark:shadow-[inset_22px_18px_40px_-28px_rgba(148,163,184,0.05),inset_0_1px_0_0_rgba(255,255,255,0.04)]",
    },
    {
      surface: "tinted",
      rim: "primary",
      class:
        "shadow-[inset_-26px_20px_44px_-28px_color-mix(in_oklab,var(--primary)_12%,transparent),inset_0_1px_0_0_rgba(255,255,255,0.07)]",
    },
    {
      surface: "tinted",
      rim: "primaryStart",
      class:
        "shadow-[inset_26px_20px_44px_-28px_color-mix(in_oklab,var(--primary)_12%,transparent),inset_0_1px_0_0_rgba(255,255,255,0.07)]",
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
