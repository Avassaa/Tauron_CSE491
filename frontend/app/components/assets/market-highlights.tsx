"use client"

import * as React from "react"
import { TrendingUp, Zap, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import {
  Card,
  CardContent,
} from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"
import { apiGet, type AssetResponse, type PaginatedResponse } from "~/lib/api-client"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoinHighlight {
  id: string
  symbol: string
  name: string
  price: number | null
  changePct: number | null
  /** rank in the list (1-based) */
  rank: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number | null): string {
  if (price === null) return "—"
  if (price >= 1000)
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  if (price >= 1)
    return `$${price.toFixed(4)}`
  return `$${price.toFixed(6)}`
}

function formatChange(pct: number | null): string {
  if (pct === null) return "—"
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function HighlightRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Skeleton className="size-8 rounded-lg shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-2.5 w-12 rounded" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-2.5 w-12 rounded" />
      </div>
    </div>
  )
}

// ─── Single coin row ──────────────────────────────────────────────────────────

interface HighlightRowProps {
  coin: CoinHighlight
  onClick?: () => void
}

function HighlightRow({ coin, onClick }: HighlightRowProps) {
  const isUp = coin.changePct === null ? null : coin.changePct >= 0
  const Icon =
    isUp === null ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left",
        "transition-all duration-200",
        "hover:bg-accent/60 hover:shadow-sm",
        "active:scale-[0.99]",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      {/* Avatar / rank */}
      <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 font-black text-primary text-[10px] group-hover:bg-primary/15 transition-colors">
        {coin.symbol.slice(0, 3)}
      </div>

      {/* Name / symbol */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold leading-tight text-foreground">
          {coin.name}
        </p>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {coin.symbol}
        </p>
      </div>

      {/* Price + change */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-xs font-bold tabular-nums text-foreground">
          {formatPrice(coin.price)}
        </span>
        <span
          className={cn(
            "flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
            isUp === null
              ? "text-muted-foreground"
              : isUp
                ? "text-green-500 dark:text-green-400"
                : "text-red-500 dark:text-red-400",
          )}
        >
          <Icon className="size-2.5 shrink-0" />
          {formatChange(coin.changePct)}
        </span>
      </div>
    </button>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface HighlightPanelProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  coins: CoinHighlight[]
  loading: boolean
  onCoinClick?: (coin: CoinHighlight) => void
  accentClass?: string
}

function HighlightPanel({
  icon,
  title,
  subtitle,
  coins,
  loading,
  onCoinClick,
  accentClass = "text-red-500",
}: HighlightPanelProps) {
  return (
    <Card className="flex-1 min-w-0 gap-0 py-0 overflow-hidden border-border/60 shadow-sm">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("text-base leading-none", accentClass)}>{icon}</span>
          <h3 className="text-sm font-bold text-foreground leading-none">
            {title}
          </h3>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] font-medium text-muted-foreground border-border/60 px-2 py-0.5 h-auto leading-none"
        >
          {subtitle}
        </Badge>
      </div>

      <CardContent className="px-2 py-1">
        <div className="divide-y divide-border/30">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-2">
                <HighlightRowSkeleton />
              </div>
            ))
          ) : coins.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No data available
            </p>
          ) : (
            coins.slice(0, 3).map((coin) => (
              <HighlightRow
                key={coin.id}
                coin={coin}
                onClick={onCoinClick ? () => onCoinClick(coin) : undefined}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MarketHighlightsProps {
  /** Called when user clicks a coin row — passes the matched AssetResponse if found */
  onCoinClick?: (symbol: string) => void
}

export function MarketHighlights({ onCoinClick }: MarketHighlightsProps) {
  const [trending, setTrending] = React.useState<CoinHighlight[]>([])
  const [topGainers, setTopGainers] = React.useState<CoinHighlight[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    const fetchHighlights = async () => {
      setLoading(true)
      try {
        // Try fetching top 50 markets from CoinGecko
        const res = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h"
        )

        if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
        const data = await res.json()

        if (!Array.isArray(data)) throw new Error("CoinGecko did not return an array")

        const coins: CoinHighlight[] = data.map((coin: any, i: number) => ({
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price,
          changePct: coin.price_change_percentage_24h_in_currency || coin.price_change_percentage_24h || 0,
          rank: i + 1,
        }))

        if (cancelled) return

        setTrending(coins.slice(0, 5))
        setTopGainers([...coins].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)).slice(0, 5))
      } catch (err) {
        console.error("Highlights fetch failed:", err)
        // Final fallback: try fetching specific backend assets from CG
        try {
          const assetsRes = await apiGet<PaginatedResponse<AssetResponse>>("/assets", { page_size: 20 })
          const ids = assetsRes.items.map(a => a.coingecko_id).filter(Boolean).join(",")
          if (ids) {
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`)
            const data = await res.json()
            if (Array.isArray(data)) {
              const coins: CoinHighlight[] = data.map((coin: any, i: number) => ({
                id: coin.id,
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                price: coin.current_price,
                changePct: coin.price_change_percentage_24h || 0,
                rank: i + 1,
              }))
              setTrending(coins.slice(0, 5))
              setTopGainers([...coins].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)).slice(0, 5))
            }
          }
        } catch (innerErr) {
          console.error("Highlight deep fallback failed:", innerErr)
          if (!cancelled) {
            setTrending([])
            setTopGainers([])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchHighlights()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <HighlightPanel
          icon={<TrendingUp className="size-4" />}
          title="Trending"
          subtitle="24h"
          coins={trending}
          loading={loading}
          onCoinClick={onCoinClick ? (c) => onCoinClick(c.symbol) : undefined}
          accentClass="text-red-500"
        />
      </div>
      <div className="flex-1 min-w-0">
        <HighlightPanel
          icon={<Zap className="size-4" />}
          title="Top Gainers"
          subtitle="24h"
          coins={topGainers}
          loading={loading}
          onCoinClick={onCoinClick ? (c) => onCoinClick(c.symbol) : undefined}
          accentClass="text-green-500"
        />
      </div>
    </div>
  )
}
