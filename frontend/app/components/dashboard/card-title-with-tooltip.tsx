"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { CardTitle } from "~/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

type CardTitleWithTooltipProps = {
  children: React.ReactNode
  /** Short explanation shown on hover */
  tooltip: string
  className?: string
  /** Use `center` when the card header uses items-center (e.g. pie, radar) */
  align?: "start" | "center"
  /** Accessible name for the info control */
  infoLabel?: string
}

export function CardTitleWithTooltip({
  children,
  tooltip,
  className,
  align = "start",
  infoLabel = "More information",
}: CardTitleWithTooltipProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        align === "center" && "justify-center"
      )}
    >
      <CardTitle className={cn(className)}>{children}</CardTitle>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={infoLabel}
          >
            <Info className="size-3.5" strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-pretty">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
