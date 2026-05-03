"use client"

import * as React from "react"
import { Bot } from "lucide-react"

import { EmbeddedAssistantWorkspace } from "~/components/assistant/embedded-assistant-workspace"
import { Button } from "~/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { useSidebar } from "~/components/ui/sidebar"
import { useIsMobile } from "~/hooks/use-mobile"
import { useAssistantDock } from "~/components/assistant/assistant-dock-context"
import { cn } from "~/lib/utils"

export function AssistantDockToolbarButton({ className }: { className?: string }) {
  const { toggle, open } = useAssistantDock()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={open ? "secondary" : "ghost"}
          size="icon"
          className={cn("relative h-10 w-10", className)}
          aria-label={open ? "Close assistant panel" : "Open assistant panel"}
          aria-pressed={open}
          onClick={toggle}
        >
          <Bot className="h-5 w-5" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} variant="inverted">
        {open ? "Close AI assistant" : "Open AI assistant"}
      </TooltipContent>
    </Tooltip>
  )
}

function AssistantDockMobileSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-[min(100vw,432px)] max-w-none flex-col gap-0 border-l bg-background p-0"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">AI assistant</SheetTitle>
        <EmbeddedAssistantWorkspace
          className="min-h-0"
          onRequestClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

/** Near half/half with slight bias to the assistant (~52% of shell); min width + cap on ultra-wide. */
const DESKTOP_ASSISTANT_WIDTH_CLASS =
  "flex-none shrink-0 grow-0 min-w-[312px] w-[clamp(312px,min(680px,calc(100cqw*0.52)),680px)]"

/**
 * Wrapper for dashboard-style scroll regions: main column scrolls internally; assistant
 * uses a fixed/clamped width and matches the viewport height of the shell (no stretch with content).
 */
export function AssistantDockSplitMain({
  children,
  outerClassName,
}: {
  children: React.ReactNode
  outerClassName?: string
}) {
  const { open, setOpen } = useAssistantDock()
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar()
  const isMobile = useIsMobile()

  const prevAssistantOpenRef = React.useRef(false)
  const rememberSidebarExpandedRef = React.useRef(true)

  React.useEffect(() => {
    if (isMobile) return

    const wasOpen = prevAssistantOpenRef.current
    if (open && !wasOpen) {
      rememberSidebarExpandedRef.current = sidebarOpen
      setSidebarOpen(false)
    }
    if (!open && wasOpen) {
      setSidebarOpen(rememberSidebarExpandedRef.current)
    }

    prevAssistantOpenRef.current = open
  }, [open, isMobile, sidebarOpen, setSidebarOpen])

  if (isMobile) {
    return (
      <>
        <div className={outerClassName}>{children}</div>
        <AssistantDockMobileSheet open={open} onOpenChange={setOpen} />
      </>
    )
  }

  return (
    <div
      data-dock-shell
      className={cn(
        "@container/dock-shell flex min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-transparent",
        outerClassName,
        open ? "flex-row" : "flex-col",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden self-stretch",
          open && "min-h-0 basis-0",
          !open && "w-full min-w-0 max-w-none",
        )}
      >
        {children}
      </div>

      <aside
        aria-hidden={!open}
        className={cn(
          "flex min-h-0 flex-col overflow-hidden border-transparent bg-muted/25 backdrop-blur-md transition-[min-width,max-width,border-color,opacity,width,height] duration-200 ease-out motion-reduce:transition-none",
          open
            ? cn(
                "relative z-30 h-full self-stretch border-border/70 border-l",
                DESKTOP_ASSISTANT_WIDTH_CLASS,
              )
            : "pointer-events-none h-0 max-h-0 w-0 max-w-0 min-w-0 shrink-0 grow-0 border-0 opacity-0",
        )}
      >
        {open ? (
          <EmbeddedAssistantWorkspace className="min-h-0" onRequestClose={() => setOpen(false)} />
        ) : null}
      </aside>
    </div>
  )
}
