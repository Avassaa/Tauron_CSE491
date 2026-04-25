"use client"

import * as React from "react"

import { DashboardClientOnly } from "~/components/dashboard/dashboard-client-only"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Separator } from "~/components/ui/separator"
import { AppSidebar } from "~/components/dashboard/app-sidebar"
import {
  ChartAreaInteractive,
  ChartBarDefault,
  ChartLineDefault,
  ChartLineMultiple,
  ChartPieSimple,
  ChartRadarLinesOnly,
} from "~/components/dashboard/dashboard-charts"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  DashboardFiltersSection,
  type DashboardApplyPayload,
} from "~/components/dashboard/dashboard-filters-section"
import { DashboardChartsSkeleton } from "~/components/dashboard/dashboard-charts-skeleton"
import { DashboardResultsTable } from "~/components/dashboard/dashboard-results-table"
import { DashboardTableSkeleton } from "~/components/dashboard/dashboard-table-skeleton"
import { cn } from "~/lib/utils"

const INITIAL_DATA_MOCK_MS = 1500
const APPLY_MOCK_MS = 1500

function DashboardPageClient() {
  const [filtersReady, setFiltersReady] = React.useState(false)
  const [applyBusy, setApplyBusy] = React.useState(false)
  const applyTimerRef = React.useRef<number | null>(null)
  const applyBusyRef = React.useRef(false)

  React.useEffect(() => {
    const id = window.setTimeout(() => setFiltersReady(true), INITIAL_DATA_MOCK_MS)
    return () => window.clearTimeout(id)
  }, [])

  React.useEffect(() => {
    return () => {
      if (applyTimerRef.current != null) {
        window.clearTimeout(applyTimerRef.current)
        applyTimerRef.current = null
      }
      applyBusyRef.current = false
    }
  }, [])

  const handleApply = React.useCallback((payload: DashboardApplyPayload) => {
    if (applyBusyRef.current) return
    applyBusyRef.current = true
    setApplyBusy(true)
    if (applyTimerRef.current != null) {
      window.clearTimeout(applyTimerRef.current)
    }
    applyTimerRef.current = window.setTimeout(() => {
      applyTimerRef.current = null
      const { date, placeholderOn } = payload
      const label =
        date?.from && date.to
          ? `${format(date.from, "MMM d, yyyy")} – ${format(date.to, "MMM d, yyyy")}`
          : date?.from
            ? format(date.from, "MMM d, yyyy")
            : "No range selected"
      toast.success("Filters applied (demo).", {
        description: `${label}${placeholderOn ? " · Placeholder on" : ""}`,
      })
      applyBusyRef.current = false
      setApplyBusy(false)
    }, APPLY_MOCK_MS)
  }, [])

  const dataBusy = !filtersReady || applyBusy

  return (
    <SidebarProvider>
      <AppSidebar />
      <MarketMarqueeBanner />
      <SidebarInset
        style={{
          paddingTop: "var(--market-banner-offset, 0px)",
        }}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="font-medium">Dashboard</span>
        </header>
        <div className="flex min-h-[calc(100svh-3.5rem)] flex-1 flex-col gap-6 overflow-auto p-4">
          <DashboardFiltersSection
            applyBusy={applyBusy}
            onApply={handleApply}
          />
          <div className="relative">
            <div
              className={cn(
                "transition-opacity",
                dataBusy && "pointer-events-none opacity-0"
              )}
              aria-hidden={dataBusy}
            >
              <DashboardResultsTable />
            </div>
            {dataBusy ? (
              <div
                className="absolute inset-0 z-10 overflow-auto rounded-lg bg-background/95 p-0.5 shadow-md ring-1 ring-border backdrop-blur-[2px]"
                role="status"
                aria-busy
                aria-label={applyBusy ? "Updating results" : "Loading results"}
              >
                <DashboardTableSkeleton />
              </div>
            ) : null}
          </div>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="relative flex min-h-0 flex-1 flex-col gap-6 outline-none">
                <div
                  className={cn(
                    "flex min-h-0 flex-1 flex-col gap-6 transition-opacity",
                    dataBusy && "pointer-events-none opacity-0"
                  )}
                  aria-hidden={dataBusy}
                >
                  <ChartAreaInteractive />
                  <div className="grid gap-4 xl:grid-cols-4">
                    <ChartBarDefault />
                    <ChartLineDefault />
                    <ChartPieSimple />
                    <ChartRadarLinesOnly />
                  </div>
                  <ChartLineMultiple />
                </div>
                {dataBusy ? (
                  <div
                    className="absolute inset-0 z-10 overflow-auto rounded-lg bg-background/95 p-0.5 shadow-md ring-1 ring-border backdrop-blur-[2px]"
                    role="status"
                    aria-busy
                    aria-label={
                      applyBusy ? "Updating charts" : "Loading charts"
                    }
                  >
                    <DashboardChartsSkeleton />
                  </div>
                ) : null}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
              <ContextMenuLabel>Dashboard</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={() => toast.success("Refreshed (demo).")}
              >
                Refresh data
                <ContextMenuShortcut>R</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => toast.message("Export started (demo).")}
              >
                Export view
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onSelect={() => toast.error("Nothing to undo (demo).")}
              >
                Clear selection
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function DashboardPage() {
  return (
    <DashboardClientOnly
      fallback={
        <div
          className="flex min-h-svh w-full bg-background"
          aria-busy
          aria-label="Loading dashboard"
        >
          <div className="hidden w-64 shrink-0 animate-pulse border-r bg-sidebar md:block" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="h-14 shrink-0 animate-pulse border-b bg-background" />
            <div className="flex flex-1 flex-col gap-6 overflow-auto p-4">
              <div className="h-40 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-64 animate-pulse rounded-lg bg-muted/50" />
            </div>
          </div>
        </div>
      }
    >
      <DashboardPageClient />
    </DashboardClientOnly>
  )
}
