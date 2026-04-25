"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Star } from "lucide-react"
import { cn } from "~/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import type { WatchlistEntryResponse, AssetResponse } from "~/lib/api-client"

interface WatchlistTableProps {
  watchlist: WatchlistEntryResponse[]
  timeRange: string
  onRemove: (assetId: string, symbol: string) => void
  onSelect: (asset: AssetResponse) => void
}

export function WatchlistTable({
  watchlist,
  timeRange,
  onRemove,
  onSelect,
}: WatchlistTableProps) {
  const [tickerBySymbol, setTickerBySymbol] = React.useState<
    Record<string, { lastPrice: number; priceChangePercent: number; quoteVolume: number }>
  >({})

  React.useEffect(() => {
    let cancelled = false
    const loadTickers = async () => {
      try {
        const res = await fetch("https://api.binance.com/api/v3/ticker/24hr")
        if (!res.ok) return
        const rows = (await res.json()) as Array<{
          symbol?: string
          lastPrice?: string
          priceChangePercent?: string
          quoteVolume?: string
        }>
        const next: Record<string, { lastPrice: number; priceChangePercent: number; quoteVolume: number }> = {}
        for (const row of rows) {
          const symbol = (row.symbol || "").toUpperCase()
          if (!symbol) continue
          const lastPrice = Number.parseFloat(row.lastPrice || "")
          const priceChangePercent = Number.parseFloat(row.priceChangePercent || "")
          const quoteVolume = Number.parseFloat(row.quoteVolume || "")
          if (!Number.isFinite(lastPrice) || !Number.isFinite(priceChangePercent)) continue
          next[symbol] = {
            lastPrice,
            priceChangePercent,
            quoteVolume: Number.isFinite(quoteVolume) ? quoteVolume : 0,
          }
        }
        if (!cancelled) setTickerBySymbol(next)
      } catch {
        // Keep placeholders if Binance is unavailable.
      }
    }

    void loadTickers()
    const interval = window.setInterval(() => void loadTickers(), 30000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  return (
    <div className="rounded-3xl border border-border/50 bg-card/30 backdrop-blur-md overflow-hidden shadow-2xl shadow-primary/5">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border/50 bg-muted/20">
            <TableHead className="font-black text-foreground/70 py-5 px-6 uppercase tracking-widest text-[10px]">
              Asset
            </TableHead>
            <TableHead className="font-black text-foreground/70 py-5 uppercase tracking-widest text-[10px] text-center">
              Price
            </TableHead>
            <TableHead className="font-black text-foreground/70 py-5 uppercase tracking-widest text-[10px] text-center">
              {timeRange}
            </TableHead>
            <TableHead className="font-black text-foreground/70 py-5 uppercase tracking-widest text-[10px] text-center">
              Market Cap
            </TableHead>
            <TableHead className="font-black text-foreground/70 py-5 uppercase tracking-widest text-[10px] text-center">
              Volume
            </TableHead>
            <TableHead className="font-black text-foreground/70 py-5 uppercase tracking-widest text-[10px] text-center">
              Trend
            </TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {watchlist.map(({ asset }) => {
            const ticker = tickerBySymbol[`${asset.symbol.toUpperCase()}USDT`]
            const isUp = (ticker?.priceChangePercent ?? 0) >= 0
            const change = ticker
              ? `${ticker.priceChangePercent >= 0 ? "+" : ""}${ticker.priceChangePercent.toFixed(2)}%`
              : "--"

            return (
              <TableRow
                key={asset.id}
                className="group cursor-pointer border-border/40 transition-all hover:bg-primary/[0.03]"
                onClick={() => onSelect(asset)}
              >
                <TableCell className="py-5 px-6">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-xs text-primary ring-1 ring-primary/20 group-hover:scale-110 transition-transform shrink-0">
                      {asset.symbol.slice(0, 3).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-black tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                        {asset.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="h-4 px-1.5 font-mono font-bold text-[8px] bg-muted/50 text-muted-foreground border-none uppercase">
                          {asset.symbol}
                        </Badge>
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                          {asset.category || "General"}
                        </span>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <span className="font-black text-sm tracking-tight text-foreground">
                    {ticker
                      ? `$${ticker.lastPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        })}`
                      : "—"}
                  </span>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <div className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest",
                    ticker == null
                      ? "bg-muted/30 text-muted-foreground"
                      : isUp ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {ticker == null ? null : isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {change}
                  </div>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                    —
                  </span>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                    {ticker
                      ? `$${(ticker.quoteVolume / 1_000_000).toFixed(1)}M`
                      : "—"}
                  </span>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <div className="flex justify-center">
                    <div className="w-16 h-8">
                      <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
                        <path
                          d={
                            isUp
                              ? "M 0,28 L 20,26 L 40,24 L 60,22 L 80,20 L 100,18"
                              : "M 0,18 L 20,20 L 40,22 L 60,24 L 80,26 L 100,28"
                          }
                          fill="none"
                          stroke={ticker == null ? "var(--muted-foreground)" : isUp ? "#22c55e" : "#ef4444"}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-5 text-right pr-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(asset.id, asset.symbol)
                    }}
                    className="size-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-muted"
                  >
                    <Star className="size-4 fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
