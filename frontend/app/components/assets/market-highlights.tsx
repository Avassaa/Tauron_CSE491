"use client"

import * as React from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { Skeleton } from "~/components/ui/skeleton"
import { AssetIcon } from "~/components/asset-icon"
import { cn } from "~/lib/utils"
import { apiGet, apiPost, type AssetResponse, type PaginatedResponse } from "~/lib/api-client"

const TRENDING_COINS_COUNT = 20
const AUTO_ENSURE_COINS_COUNT = 20

interface CoinHighlight {
  id: string
  symbol: string
  name: string
  price: number | null
  changePct: number | null
  /** rank in the list (1-based) */
  rank: number
}

const AUTO_ENSURE_CACHE_TTL_MS = 60 * 60 * 1000
const ensuredCoinCache = new Map<string, number>()
const AUTO_ENSURE_SESSION_KEY = "assets:auto-ensure:last-run-at"
const AUTO_ENSURE_SESSION_TTL_MS = 12 * 60 * 60 * 1000
let ensureInFlight = false

function rememberEnsured(id: string) {
  ensuredCoinCache.set(id, Date.now())
}

function recentlyEnsured(id: string): boolean {
  const ts = ensuredCoinCache.get(id)
  if (!ts) return false
  if (Date.now() - ts <= AUTO_ENSURE_CACHE_TTL_MS) return true
  ensuredCoinCache.delete(id)
  return false
}

async function autoEnsureTrendingAssets(coins: CoinHighlight[]) {
  if (!coins.length) return
  if (ensureInFlight) return

  const now = Date.now()
  const hasWindow = typeof window !== "undefined"
  const lastRunRaw = hasWindow ? window.sessionStorage.getItem(AUTO_ENSURE_SESSION_KEY) : null
  const lastRun = lastRunRaw ? Number.parseInt(lastRunRaw, 10) : 0
  if (Number.isFinite(lastRun) && now - lastRun < AUTO_ENSURE_SESSION_TTL_MS) return

  try {
    ensureInFlight = true
    if (hasWindow) window.sessionStorage.setItem(AUTO_ENSURE_SESSION_KEY, String(now))

    const existing = await apiGet<PaginatedResponse<AssetResponse>>("/assets", {
      page: 1,
      page_size: 500,
    })
    const knownSymbols = new Set(existing.items.map((asset) => asset.symbol.toUpperCase()))

    let attempted = 0
    let created = 0
    let skippedExisting = 0
    let skippedCached = 0

    for (const coin of coins) {
      const symbol = coin.symbol.toUpperCase()
      if (knownSymbols.has(symbol)) {
        skippedExisting += 1
        continue
      }
      if (recentlyEnsured(coin.id)) {
        skippedCached += 1
        continue
      }

      try {
        attempted += 1
        await apiPost<AssetResponse>("/assets/ensure", {
          symbol,
          name: coin.name,
          category: "Crypto",
          coingecko_id: null,
          is_active: true,
        })
        knownSymbols.add(symbol)
        rememberEnsured(coin.id)
        created += 1
      } catch (ensureErr) {
        console.warn(`Auto-ensure failed for ${symbol}:`, ensureErr)
      }
    }

    console.info(
      `[MarketHighlights] Auto-ensure done: input=${coins.length}, attempted=${attempted}, created=${created}, skipped_existing=${skippedExisting}, skipped_cached=${skippedCached}`,
    )
  } catch (err) {
    console.warn("Auto-ensure skipped: unable to read existing assets", err)
  } finally {
    ensureInFlight = false
  }
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
    <div className="flex min-w-[200px] items-center gap-4 rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-md supports-[backdrop-filter]:bg-card/35">
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
      className="flex min-w-[200px] items-center gap-4 rounded-2xl border border-border/50 bg-card/40 p-4 text-left backdrop-blur-md transition-all supports-[backdrop-filter]:bg-card/35 hover:scale-[1.02] hover:bg-card/55 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]"
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
        const data = await apiGet<any[]>("/assets/live-market", { limit: 250 })
        if (!Array.isArray(data)) throw new Error("Live market endpoint did not return an array")

        const coins: CoinHighlight[] = data.map((coin: any, i: number) => ({
          id: String(coin.symbol ?? `${i}`),
          symbol: String(coin.symbol ?? "").toUpperCase(),
          name: coin.name,
          price: typeof coin.price === "number" ? coin.price : null,
          changePct: typeof coin.price_change_24h === "number" ? coin.price_change_24h : null,
          rank: i + 1,
        }))

        if (cancelled) return

        const topCoins = coins.slice(0, TRENDING_COINS_COUNT)
        const ensureCandidates = coins.slice(0, AUTO_ENSURE_COINS_COUNT)
        setTrending(topCoins)
        void autoEnsureTrendingAssets(ensureCandidates)
      } catch (err) {
        console.error("Highlights fetch failed:", err)
        try {
          const assetsRes = await apiGet<PaginatedResponse<AssetResponse>>("/assets", { page_size: 20, sort: "popular" })
          const topCoins = assetsRes.items.slice(0, TRENDING_COINS_COUNT).map((asset, index) => ({
            id: asset.id,
            symbol: asset.symbol.toUpperCase(),
            name: asset.name,
            price: null,
            changePct: null,
            rank: index + 1,
          }))
          setTrending(topCoins)
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
          <div className="rounded-2xl border border-border/50 bg-card/40 px-5 py-4 text-sm text-muted-foreground backdrop-blur-md supports-[backdrop-filter]:bg-card/35">
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
