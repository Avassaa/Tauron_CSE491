"use client"

import * as React from "react"
import {
  BarChart3,
  Bitcoin,
  ChevronRight,
  Coins,
  Globe2,
  Layers,
  ListChecks,
  Sparkles,
  TrendingUp,
} from "lucide-react"
// BarChart3, Bitcoin, Globe2, Layers used in QuickLinkCard and stat helpers kept for future use
import { useNavigate, useSearchParams } from "react-router"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import {
  ChartBarDefault,
  ChartLineDefault,
  ChartPieSimple,
  ChartRadarLinesOnly,
} from "~/components/dashboard/dashboard-charts"
import { ChartAreaInteractive } from "~/components/dashboard/chart-area-interactive"
import { DashboardChartsSkeleton } from "~/components/dashboard/dashboard-charts-skeleton"
import { DashboardTableSkeleton } from "~/components/dashboard/dashboard-table-skeleton"
import { DashboardNewsStrip } from "~/components/dashboard/dashboard-news-strip"
import { DashboardResultsTable } from "~/components/dashboard/dashboard-results-table"
import { DashboardHeatmap } from "~/components/dashboard/dashboard-heatmap"
import { DashboardAlerts } from "~/components/dashboard/dashboard-alerts"
import { PageBlueBackdrop } from "~/components/dashboard/page-blue-backdrop"
import { Card, CardContent, glassPanelSurface } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"
import { useDashboardData } from "~/hooks/use-dashboard-data"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import { toast } from "sonner"

// ─── Quick Link Card ──────────────────────────────────────────────────────────

function QuickLinkCard({
  icon,
  label,
  description,
  href,
}: {
  icon: React.ReactNode
  label: string
  description: string
  href: string
}) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 text-left",
        "border border-border/50 bg-card/60 backdrop-blur-xl backdrop-saturate-150",
        "supports-[backdrop-filter]:bg-card/45",
        "transition-all duration-300",
        "hover:border-border/80 hover:bg-card/80",
        "hover:shadow-xl hover:shadow-black/8 dark:hover:shadow-black/40",
        "hover:scale-[1.015] active:scale-[0.99]",
      )}
    >
      {/* Radial glow in top-right */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.05),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.10),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Shimmer ring */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-1 ring-inset ring-foreground/8 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Icon pill */}
      <div className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-xl",
        "border border-border/50 bg-gradient-to-br from-primary/20 to-primary/5",
        "text-primary shadow-[0_0_14px_-4px_hsl(var(--primary)/0.35)]",
        "transition-all duration-300",
        "group-hover:border-primary/40 group-hover:from-primary/30 group-hover:shadow-[0_0_18px_-4px_hsl(var(--primary)/0.55)]",
      )}>
        {icon}
      </div>

      <div className="relative min-w-0">
        <div className="text-sm font-black tracking-tight text-foreground/85 transition-colors group-hover:text-foreground">
          {label}
        </div>
        <div className="truncate text-[10px] text-muted-foreground/60">{description}</div>
      </div>

      <ChevronRight className="relative ml-auto size-4 shrink-0 translate-x-1 text-muted-foreground/40 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-primary/80 group-hover:opacity-100" />
    </button>
  )
}

// ─── Dashboard Page Client ────────────────────────────────────────────────────

function DashboardPageClient() {
  const [searchParams] = useSearchParams()
  const selectedAssetId = searchParams.get("asset")
  const { coins, btcKlines, loading } = useDashboardData()

  const btcCoin = coins.find((c) => c.symbol === "BTC")
  const ethCoin = coins.find((c) => c.symbol === "ETH")

  const totalMcap = coins.slice(0, 20).reduce((s, c) => s + (c.market_cap ?? 0), 0)
  const totalVol = coins.slice(0, 20).reduce((s, c) => s + (c.volume ?? 0), 0)

  const fmtPrice = (price: number | null) => {
    if (price == null) return "—"
    if (price >= 1000)
      return price.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    return `$${price.toFixed(4)}`
  }

  const fmtCompact = (v: number) => {
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
    return `$${v.toLocaleString()}`
  }

  const btcDominance =
    btcCoin?.market_cap && totalMcap > 0
      ? ((btcCoin.market_cap / totalMcap) * 100).toFixed(1)
      : null

  const dataBusy = loading

  return (
    <DashboardLayout
      title={
        <div className="flex items-center gap-2">
          <span className="font-medium">Dashboard</span>
          {selectedAssetId && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <span className="text-sm font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                {selectedAssetId}
              </span>
            </>
          )}
        </div>
      }
    >
      <div className="relative flex-1 overflow-y-auto">
        <PageBlueBackdrop />
        <div className="relative z-[1] flex flex-1 flex-col gap-6 p-4 md:p-8">

          {/* ── Latest Curated News ─────────────────────────────────── */}
          <DashboardNewsStrip />

          {/* ── Quick Links ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickLinkCard
              icon={<Coins className="size-4" />}
              label="Assets"
              description="Browse all coins"
              href="/assets"
            />
            <QuickLinkCard
              icon={<ListChecks className="size-4" />}
              label="Watchlists"
              description="Your saved lists"
              href="/watchlists"
            />
            <QuickLinkCard
              icon={<TrendingUp className="size-4" />}
              label="Predictions"
              description="AI price forecasts"
              href="/predictions"
            />
            <QuickLinkCard
              icon={<Sparkles className="size-4" />}
              label="AI Assistant"
              description="Market insights"
              href="/chat"
            />
          </div>

          {/* ── Top Movers Table ────────────────────────────────────── */}
          <div className="relative">
            <div
              className={cn(
                "transition-opacity",
                dataBusy && "pointer-events-none opacity-0"
              )}
              aria-hidden={dataBusy}
            >
              <DashboardResultsTable coins={coins} />
            </div>
            {dataBusy && (
              <div
                className={cn(
                  "absolute inset-0 z-10 isolate overflow-auto rounded-xl p-1 ring-1 ring-border/50",
                  glassPanelSurface
                )}
                role="status"
                aria-busy
                aria-label="Loading market data"
              >
                <DashboardTableSkeleton />
              </div>
            )}
          </div>

          {/* ── Charts ──────────────────────────────────────────────── */}
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
                  {/* Market heatmap */}
                  <DashboardHeatmap coins={coins} />

                  {/* Top 3 gainers normalized performance comparison */}
                  <ChartAreaInteractive coins={coins} />

                  {/* 4-column grid */}
                  <div className="grid gap-4 xl:grid-cols-4">
                    <ChartBarDefault coins={coins} />
                    <ChartLineDefault btcKlines={btcKlines} coins={coins} />
                    <ChartPieSimple coins={coins} />
                    <ChartRadarLinesOnly coins={coins} />
                  </div>

                  {/* Price alerts (replaces 30D multi-line comparison) */}
                  <DashboardAlerts />
                </div>

                {dataBusy && (
                  <div
                    className={cn(
                      "absolute inset-0 z-10 isolate overflow-auto rounded-xl p-1 ring-1 ring-border/50",
                      glassPanelSurface
                    )}
                    role="status"
                    aria-busy
                    aria-label="Loading charts"
                  >
                    <DashboardChartsSkeleton />
                  </div>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
              <ContextMenuLabel>Dashboard</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={() => {
                  window.location.reload()
                  toast.success("Refreshing market data…")
                }}
              >
                Refresh data
                <ContextMenuShortcut>R</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => toast.message("Export coming soon.")}
              >
                Export view
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onSelect={() => toast.error("Nothing to clear.")}
              >
                Clear selection
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function DashboardPage() {
  return <DashboardPageClient />
}
