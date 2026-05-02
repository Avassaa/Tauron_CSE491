import * as React from "react"

import { cn } from "~/lib/utils"

/**
 * Stronger blur keeps body text readable over the blue glass backdrop; fill stays translucent.
 */
export const glassCardSurface =
  "relative isolate overflow-hidden rounded-xl border border-border/50 bg-background/55 text-card-foreground shadow-sm backdrop-blur-xl backdrop-saturate-125 dark:border-border/50 dark:bg-background/45"

function cardVariants() {
  return cn(glassCardSurface, "flex flex-col gap-6 py-6")
}

/** Use on custom panels (e.g. tools grid) for the same glass as `<Card />`. */
export function glassSurfaceVariants(): string {
  return glassCardSurface
}

export interface CardProps extends React.ComponentProps<"div"> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="card" className={cn(cardVariants(), className)} {...props} />
))
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
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
