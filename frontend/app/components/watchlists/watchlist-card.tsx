"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Star, Activity, BarChart3, Globe } from "lucide-react"
import { cn } from "~/lib/utils"
import type { AssetResponse } from "~/lib/api-client"
import { Sparkline } from "~/components/assets/sparkline"
import { type MarketData } from "~/components/assets"
import { AssetIcon } from "~/components/asset-icon"

interface WatchlistCardProps {
  asset: AssetResponse
  timeRange: string
  isWatched?: boolean
  onRemove: (assetId: string, symbol: string) => void
  onSelect: (asset: AssetResponse) => void
  marketData?: MarketData
}

export function WatchlistCard({
  asset,
  timeRange,
  isWatched = true,
  onRemove,
  onSelect,
  marketData,
}: WatchlistCardProps) {
  const stats = React.useMemo(() => {
    const isUp = (marketData?.price_change_24h ?? 0) >= 0
    const isUp7d = (marketData?.price_change_7d ?? 0) >= 0
    
    return {
      price: marketData?.price ?? null,
      change24h: marketData?.price_change_24h !== undefined 
        ? `${marketData.price_change_24h >= 0 ? "+" : ""}${marketData.price_change_24h.toFixed(2)}%` 
        : "--",
      change7d: marketData?.price_change_7d !== undefined 
        ? `${marketData.price_change_7d >= 0 ? "+" : ""}${marketData.price_change_7d.toFixed(2)}%` 
        : "--",
      isUp,
      isUp7d,
      marketCap: marketData?.market_cap ? `$${(marketData.market_cap / 1_000_000_000).toFixed(2)}B` : "—",
      volume: marketData?.volume ? `$${(marketData.volume / 1_000_000).toFixed(1)}M` : "—",
      rank: marketData?.rank ? `#${marketData.rank}` : "—",
      sparkline: marketData?.sparkline || []
    }
  }, [marketData])

  return (
    <div
      onClick={() => onSelect(asset)}
      className="group relative flex flex-col gap-6 p-6 rounded-[32px] border border-border/40 bg-card/40 backdrop-blur-md transition-all duration-500 hover:border-primary/30 hover:bg-card hover:shadow-[0_12px_30px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_12px_30px_rgba(0,0,0,0.3)] cursor-pointer overflow-hidden"
    >
      {/* Decorative Gradient Background */}
      <div className={cn(
        "absolute -right-10 -top-10 size-40 blur-[80px] opacity-20 transition-opacity duration-500 group-hover:opacity-30",
        stats.isUp ? "bg-green-500" : "bg-red-500"
      )} />

      {/* Top Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="size-12 overflow-hidden rounded-full flex items-center justify-center font-black text-xs text-primary">
              <AssetIcon
                symbol={asset.symbol}
                alt={`${asset.symbol} icon`}
                className="transition-transform duration-500"
                fallbackClassName="text-lg"
              />
            </div>
            {marketData?.rank && (
              <div className="absolute -bottom-1.5 -right-1.5 size-6 rounded-lg bg-background border border-border flex items-center justify-center text-[10px] font-black text-foreground shadow-sm">
                {marketData.rank}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="font-black text-base text-foreground tracking-tight leading-tight group-hover:text-primary transition-colors">
              {asset.name}
            </h3>
            <span className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-widest">
              {asset.symbol}
            </span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(asset.id, asset.symbol)
          }}
          className="p-2 rounded-xl transition-all hover:bg-primary/10 active:scale-90"
        >
          <Star className={cn(
            "size-5 transition-all duration-300",
            isWatched ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] scale-110" : "text-muted-foreground/30 hover:text-white"
          )} />
        </button>
      </div>

      {/* Main Price & Sparkline */}
      <div className="flex items-end justify-between gap-4 relative z-10">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Live Price</span>
          <div className="text-3xl font-black text-foreground tracking-tighter leading-none">
            {stats.price == null
              ? "—"
              : stats.price < 1 
                ? `$${stats.price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`
                : `$${stats.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black shadow-sm",
              stats.isUp ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
            )}>
              {stats.isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {stats.change24h}
            </div>
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              stats.isUp ? "text-green-500/50" : "text-red-500/50"
            )}>
              {stats.isUp ? "Bullish" : "Bearish"}
            </span>
          </div>
        </div>

        <div className="flex-1 max-w-[120px] h-14 -mb-2">
          <Sparkline data={stats.sparkline} isUp={stats.isUp} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 pt-5 border-t border-border/30 relative z-10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">
            <Globe className="size-2.5" />
            Mkt Cap
          </div>
          <div className="text-[13px] font-black text-foreground tracking-tight">{stats.marketCap}</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">
            <Activity className="size-2.5" />
            Vol (24h)
          </div>
          <div className="text-[13px] font-black text-foreground tracking-tight">{stats.volume}</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">
            <BarChart3 className="size-2.5" />
            7D Change
          </div>
          <div className={cn(
            "text-[13px] font-black tracking-tight",
            stats.isUp7d ? "text-green-500" : "text-red-500"
          )}>
            {stats.change7d}
          </div>
        </div>
      </div>
    </div>
  )
}
