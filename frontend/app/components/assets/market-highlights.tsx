"use client"

import * as React from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { Skeleton } from "~/components/ui/skeleton"
import { AssetIcon } from "~/components/asset-icon"
import { cn } from "~/lib/utils"
import { apiGet, type AssetResponse, type PaginatedResponse } from "~/lib/api-client"

const TRENDING_COINS_COUNT = 20

interface CoinHighlight {
  id: string
  symbol: string
  name: string
  price: number | null
  changePct: number | null
  /** rank in the list (1-based) */
  rank: number
}

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

function TrendingCoinSkeleton() {
  return (
    <div className="flex min-w-[200px] items-center gap-4 rounded-2xl border border-border/50 bg-card/30 p-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  )
}

function TrendingCoinCard({
  coin,
  onClick,
}: {
  coin: CoinHighlight
  onClick?: () => void
}) {
  const isUp = coin.changePct === null ? null : coin.changePct >= 0
  const Icon =
    isUp === null ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[200px] items-center gap-4 rounded-2xl border border-border/50 bg-card/30 p-4 text-left transition-all hover:scale-[1.02] hover:bg-card/50 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]"
    >
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
        <AssetIcon
          symbol={coin.symbol}
          alt={`${coin.symbol} icon`}
          fallbackClassName="text-xs"
        />
      </div>

      <div className="flex min-w-0 flex-col items-start overflow-hidden">
        <span className="truncate font-black tracking-tight">{coin.name}</span>
        <span className="text-[10px] font-bold uppercase text-muted-foreground">
          {coin.symbol}
        </span>
      </div>

      <div className="ml-auto flex shrink-0 flex-col items-end">
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

interface MarketHighlightsProps {
  onCoinClick?: (symbol: string) => void
}

export function MarketHighlights({ onCoinClick }: MarketHighlightsProps) {
  const [trending, setTrending] = React.useState<CoinHighlight[]>([])
  const [loading, setLoading] = React.useState(true)
  const marqueeCoins = React.useMemo(
    () => (trending.length > 0 ? [...trending, ...trending] : []),
    [trending],
  )

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

        setTrending(coins.slice(0, TRENDING_COINS_COUNT))
      } catch (err) {
        console.error("Highlights fetch failed:", err)
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
              setTrending(coins.slice(0, TRENDING_COINS_COUNT))
            }
          } else {
            setTrending(
              assetsRes.items.slice(0, TRENDING_COINS_COUNT).map((asset, index) => ({
                id: asset.id,
                symbol: asset.symbol.toUpperCase(),
                name: asset.name,
                price: null,
                changePct: null,
                rank: index + 1,
              }))
            )
          }
        } catch (innerErr) {
          console.error("Highlight deep fallback failed:", innerErr)
          if (!cancelled) {
            setTrending([])
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
    <div className="space-y-4">
      <style>
        {`
          @keyframes market-highlight-marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}
      </style>
      <div className="flex items-center justify-between px-3">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-foreground/80">
          Trending Coins
        </h3>
      </div>
      <div className="overflow-hidden p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading ? (
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <TrendingCoinSkeleton key={index} />
            ))}
          </div>
        ) : trending.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card/30 px-5 py-4 text-sm text-muted-foreground">
            No trending coins available.
          </div>
        ) : (
          <div className="flex w-max gap-4 [animation:market-highlight-marquee_45s_linear_infinite] hover:[animation-play-state:paused]">
            {marqueeCoins.map((coin, index) => (
              <TrendingCoinCard
                key={`${coin.id}-${index}`}
                coin={coin}
                onClick={onCoinClick ? () => onCoinClick(coin.symbol) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
