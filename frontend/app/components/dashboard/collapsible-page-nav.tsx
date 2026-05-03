"use client"

import * as React from "react"
import { Menu } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export type CollapsiblePageNavItem = {
  id: string
  label: string
  icon: LucideIcon
}

export function CollapsiblePageNav({
  items,
  onSelect,
  navLabel = "Sections",
  defaultOpen = true,
}: {
  items: CollapsiblePageNavItem[]
  onSelect: (id: string) => void
  navLabel?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <>
      <nav
        className="shrink-0 border-b border-border bg-muted/30 px-4 py-3 lg:hidden"
        aria-label={navLabel}
      >
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:outline-none"
                onClick={() => onSelect(item.id)}
              >
                <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col overflow-hidden border-border bg-muted/30 transition-[width] duration-200 motion-reduce:transition-none lg:flex",
          open ? "w-[220px] min-w-[220px] border-r" : "w-12 min-w-12 border-r",
        )}
        aria-label={navLabel}
      >
        {!open ? (
          <div className="flex flex-col items-center gap-1 border-b border-border py-2">
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0"
                  aria-label="Expand menu"
                  aria-expanded={false}
                  onClick={() => setOpen(true)}
                >
                  <Menu className="size-5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand menu</TooltipContent>
            </Tooltip>
            {items.map((item) => {
              const Icon = item.icon
              return (
                <Tooltip delayDuration={200} key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 shrink-0"
                      aria-label={item.label}
                      onClick={() => onSelect(item.id)}
                    >
                      <Icon className="size-5" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        ) : (
          <>
            <div className="flex min-h-11 items-center gap-1 border-b border-border px-2 py-2">
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0"
                    aria-label="Collapse menu"
                    aria-expanded={true}
                    onClick={() => setOpen(false)}
                  >
                    <Menu className="size-5" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Collapse menu</TooltipContent>
              </Tooltip>
              <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {navLabel}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:outline-none"
                    onClick={() => onSelect(item.id)}
                  >
                    <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </aside>
    </>
  )
}
