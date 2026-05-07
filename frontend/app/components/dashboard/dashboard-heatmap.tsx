"use client"

import * as React from "react"
import { Link } from "react-router"
import { LayoutGrid } from "lucide-react"
import { cn } from "~/lib/utils"
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card"
import { CardTitleWithTooltip } from "~/components/dashboard/card-title-with-tooltip"
import { AssetIcon } from "~/components/asset-icon"
import type { DashboardCoin } from "~/hooks/use-dashboard-data"

interface DashboardHeatmapProps {
  coins?: DashboardCoin[]
}

function getHeatColor(change: number): string {
  if (change >= 10) return "bg-emerald-600 dark:bg-emerald-500 text-white"
  if (change >= 5) return "bg-emerald-500/85 dark:bg-emerald-500/70 text-white"
  if (change >= 2) return "bg-emerald-500/55 text-emerald-900 dark:text-emerald-100"
  if (change >= 0.5) return "bg-emerald-500/30 text-emerald-800 dark:text-emerald-200"
  if (change >= 0) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  if (change >= -0.5) return "bg-rose-500/15 text-rose-700 dark:text-rose-300"
  if (change >= -2) return "bg-rose-500/30 text-rose-800 dark:text-rose-200"
  if (change >= -5) return "bg-rose-500/55 text-rose-900 dark:text-rose-100"
  if (change >= -10) return "bg-rose-500/85 dark:bg-rose-500/70 text-white"
  return "bg-rose-600 dark:bg-rose-500 text-white"
}

function getTileSize(rank: number): string {
  if (rank <= 3) return "col-span-2 row-span-2"
  if (rank <= 8) return "col-span-2 row-span-1"
  return "col-span-1 row-span-1"
}

function HeatTile({ coin, rank }: { coin: DashboardCoin; rank: number }) {
  const change = coin.price_change_24h ?? 0
  const colorClass = getHeatColor(change)
  const sizeClass = getTileSize(rank)
  const isBig = rank <= 3

  return (
    <Link
      to={`/assets?symbol=${coin.symbol}`}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl p-2 transition-all duration-200",
        "hover:scale-[1.03] hover:z-10 hover:shadow-lg",
        colorClass,
        sizeClass,
      )}
    >
      {/* Shimmer on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 ring-2 ring-inset ring-white/20 transition-opacity group-hover:opacity-100" />

      {isBig && (
        <div className="size-7 shrink-0 overflow-hidden rounded-full mb-1 opacity-90">
          <AssetIcon symbol={coin.symbol} alt={coin.symbol} fallbackClassName="text-[8px]" />
        </div>
      )}

      <span className={cn("font-black tracking-tight leading-none", isBig ? "text-sm" : "text-[10px]")}>
        {coin.symbol}
      </span>

      <span className={cn("font-bold leading-none tabular-nums", isBig ? "text-xs" : "text-[9px]")}>
        {change >= 0 ? "+" : ""}{change.toFixed(2)}%
      </span>
    </Link>
  )
}

export function DashboardHeatmap({ coins }: DashboardHeatmapProps) {
  const top20 = (coins ?? [])
    .filter((c) => c.price_change_24h != null)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 20)

  const gainers = top20.filter((c) => (c.price_change_24h ?? 0) >= 0).length
  const losers = top20.length - gainers

  return (
    <Card>
      <CardHeader>
        <CardTitleWithTooltip
          tooltip="Top 20 coins by volume, colored by 24h price change. Darker green = bigger gain, darker red = bigger loss. Larger tiles = higher market cap rank."
        >
          Market Heatmap
        </CardTitleWithTooltip>
        <CardDescription className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <span>24h performance · top 20 by volume</span>
          <span className="flex items-center gap-2 ml-auto normal-case font-normal tracking-normal text-xs">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="inline-block size-2 rounded-sm bg-emerald-500" />
              {gainers} up
            </span>
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <span className="inline-block size-2 rounded-sm bg-rose-500" />
              {losers} down
            </span>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: "repeat(8, 1fr)",
            gridTemplateRows: "auto",
          }}
        >
          {top20.map((coin, idx) => (
            <HeatTile key={coin.symbol} coin={coin} rank={idx + 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
