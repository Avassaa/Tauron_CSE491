"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Star } from "lucide-react"
import { cn } from "~/lib/utils"
import type { AssetResponse } from "~/lib/api-client"

interface WatchlistCardProps {
  asset: AssetResponse
  timeRange: string
  isWatched?: boolean
  onRemove: (assetId: string, symbol: string) => void
  onSelect: (asset: AssetResponse) => void
}

export function WatchlistCard({
  asset,
  timeRange,
  isWatched = true,
  onRemove,
  onSelect,
}: WatchlistCardProps) {
  const [stats, setStats] = React.useState<{
    price: number | null
    change: string
    isUp: boolean
    marketCap: string
    volume: string
    supply: string
    sparkline: string
  }>({
    price: null,
    change: "--",
    isUp: false,
    marketCap: "—",
    volume: "—",
    supply: "—",
    sparkline: "0,25 L 25,23 L 50,24 L 75,22 L 100,24",
  })

  React.useEffect(() => {
    let cancelled = false
    const symbol = `${asset.symbol.toUpperCase()}USDT`

    const run = async () => {
      try {
        const tickerRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
        if (!tickerRes.ok) return
        const ticker = (await tickerRes.json()) as {
          lastPrice?: string
          priceChangePercent?: string
          quoteVolume?: string
        }

        const price = Number.parseFloat(ticker.lastPrice || "")
        const changePct = Number.parseFloat(ticker.priceChangePercent || "")
        const quoteVolume = Number.parseFloat(ticker.quoteVolume || "")
        const isUp = Number.isFinite(changePct) ? changePct >= 0 : false

        const klinesRes = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=25`
        )
        let sparkline = "0,25 L 25,23 L 50,24 L 75,22 L 100,24"
        if (klinesRes.ok) {
          const klines = (await klinesRes.json()) as Array<[number, string, string, string, string]>
          const closes = klines
            .map((k) => Number.parseFloat(k[4]))
            .filter((v) => Number.isFinite(v))
          if (closes.length > 1) {
            const min = Math.min(...closes)
            const max = Math.max(...closes)
            const span = Math.max(max - min, 1e-9)
            const points = closes.map((value, idx) => {
              const x = (idx / (closes.length - 1)) * 100
              const y = 32 - ((value - min) / span) * 24
              return `${x},${y}`
            })
            sparkline = points.join(" L ")
          }
        }

        if (cancelled) return
        setStats({
          price: Number.isFinite(price) ? price : null,
          change: Number.isFinite(changePct) ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : "--",
          isUp,
          marketCap: "—",
          volume: Number.isFinite(quoteVolume) ? `$${(quoteVolume / 1_000_000).toFixed(1)}M` : "—",
          supply: "—",
          sparkline,
        })
      } catch {
        // Keep graceful placeholders.
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [asset.symbol, timeRange])

  return (
    <div
      onClick={() => onSelect(asset)}
      className="group relative flex flex-col gap-5 p-5 rounded-[28px] border border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/20 hover:bg-card cursor-pointer shadow-2xl"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-xs text-primary">
            {asset.symbol.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm text-foreground tracking-tight leading-none">{asset.name}</span>
            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{asset.symbol}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(asset.id, asset.symbol)
            }}
            className="p-1 transition-colors"
          >
            <Star className={cn(
              "size-4 transition-all",
              isWatched ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" : "text-muted-foreground/40 hover:text-white"
            )} />
          </button>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="flex items-end justify-between">
        <div className="space-y-1.5">
          <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Activity</span>
          <div className="text-3xl font-black text-foreground tracking-tighter">
            {stats.price == null
              ? "—"
              : `$${stats.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black",
              stats.isUp ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
            )}>
              {stats.isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {stats.change}
            </div>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest",
              stats.isUp ? "text-green-500/60" : "text-red-500/60"
            )}>
              {stats.isUp ? "Bullish" : "Bearish"}
            </span>
          </div>
        </div>

        {/* Mini Sparkline */}
        <div className="w-24 h-12 mb-1">
          <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id={`gradient-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stats.isUp ? "#22c55e" : "#ef4444"} stopOpacity="0.2" />
                <stop offset="100%" stopColor={stats.isUp ? "#22c55e" : "#ef4444"} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`M 0,25 L ${stats.sparkline}`}
              fill="none"
              stroke={stats.isUp ? "#22c55e" : "#ef4444"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={`M 0,25 L ${stats.sparkline} V 40 H 0 Z`}
              fill={`url(#gradient-${asset.id})`}
            />
          </svg>
        </div>
      </div>

      {/* Bottom Info Grid */}
      <div className="pt-4 border-t border-border/50">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-0.5">
            <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">M. Cap</span>
            <div className="text-[11px] font-black text-foreground">{stats.marketCap}</div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Vol.</span>
            <div className="text-[11px] font-black text-foreground">{stats.volume}</div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Supply</span>
            <div className="text-[11px] font-black text-foreground">{stats.supply}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
