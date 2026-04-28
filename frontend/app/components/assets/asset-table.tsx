"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown, Activity } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Badge } from "~/components/ui/badge"
import type { AssetResponse } from "~/lib/api-client"
import { useLiveTickers } from "~/lib/live-price-stream"
import { cn } from "~/lib/utils"

type CoinGeckoMarket = {
  id: string
  current_price: number | null
  market_cap: number | null
  total_volume: number | null
  price_change_percentage_1h_in_currency: number | null
  price_change_percentage_24h_in_currency: number | null
  price_change_percentage_7d_in_currency: number | null
  sparkline_in_7d?: { price?: number[] }
}

function formatCompactUsd(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value as number)
}

function formatPercent(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return "—"
  return `${(value as number) >= 0 ? "+" : ""}${(value as number).toFixed(1)}%`
}

function sparklinePath(values?: number[]) {
  const points = (values || []).filter((value) => Number.isFinite(value))
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = Math.max(max - min, 1e-9)
  return points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100
      const y = 34 - ((value - min) / span) * 28
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

interface AssetTableProps {
  assets: AssetResponse[]
  search: string
  currentPage: number
  pageSize: number
  sortConfig: {
    key: "name" | "symbol" | "category" | "is_active" | "activity"
    direction: "asc" | "desc"
  } | null
  handleSort: (key: "name" | "symbol" | "category" | "is_active" | "activity") => void
  setSelectedAsset: (asset: AssetResponse) => void
  quoteCurrency: string
}

export function AssetTable({
  assets,
  search,
  currentPage,
  pageSize,
  sortConfig,
  handleSort,
  setSelectedAsset,
  quoteCurrency,
}: AssetTableProps) {
  const isUsdPeggedQuote = (value: string) => value === "USDT" || value === "USDC" || value === "BUSD"
  const normalizedQuoteCurrency =
    quoteCurrency === "TRY" ||
    quoteCurrency === "EUR" ||
    quoteCurrency === "GBP" ||
    quoteCurrency === "USDC" ||
    quoteCurrency === "BUSD"
      ? quoteCurrency
      : "USDT"
  const [flashBySymbol, setFlashBySymbol] = React.useState<Record<string, "up" | "down">>({})
  const [marketById, setMarketById] = React.useState<Record<string, CoinGeckoMarket>>({})
  const lastPriceBySymbolRef = React.useRef<Record<string, number>>({})
  const flashTimersRef = React.useRef<Record<string, number>>({})
  const streamSymbols = React.useMemo(() => {
    const assetUsdtSymbols = assets
      .map((asset) => `${asset.symbol.toUpperCase()}USDT`)
      .filter((symbol) => /^[A-Z0-9]+$/.test(symbol))
    const conversionSymbols =
      isUsdPeggedQuote(normalizedQuoteCurrency)
        ? []
        : [
            `${normalizedQuoteCurrency.toUpperCase()}USDT`,
            `USDT${normalizedQuoteCurrency.toUpperCase()}`,
          ]
    return Array.from(new Set([...assetUsdtSymbols, ...conversionSymbols]))
  }, [assets, normalizedQuoteCurrency])
  const liveTickers = useLiveTickers(streamSymbols)

  const queuePriceFlash = React.useCallback((symbol: string, direction: "up" | "down") => {
    setFlashBySymbol((prev) => ({ ...prev, [symbol]: direction }))
    const existing = flashTimersRef.current[symbol]
    if (existing) window.clearTimeout(existing)
    flashTimersRef.current[symbol] = window.setTimeout(() => {
      setFlashBySymbol((prev) => {
        const next = { ...prev }
        delete next[symbol]
        return next
      })
      delete flashTimersRef.current[symbol]
    }, 650)
  }, [])

  React.useEffect(() => {
    return () => {
      for (const timer of Object.values(flashTimersRef.current)) {
        window.clearTimeout(timer)
      }
      flashTimersRef.current = {}
    }
  }, [])

  React.useEffect(() => {
    for (const [symbol, row] of Object.entries(liveTickers)) {
      const nextPrice = row.price
      if (!Number.isFinite(nextPrice)) continue
      const prevPrice = lastPriceBySymbolRef.current[symbol]
      if (Number.isFinite(prevPrice) && prevPrice !== nextPrice) {
        queuePriceFlash(symbol, nextPrice > prevPrice ? "up" : "down")
      }
      lastPriceBySymbolRef.current[symbol] = nextPrice
    }
  }, [liveTickers, queuePriceFlash])

  React.useEffect(() => {
    const ids = Array.from(
      new Set(
        assets
          .map((asset) => asset.coingecko_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )
    if (ids.length === 0) return

    let cancelled = false
    const loadMarkets = async () => {
      try {
        const params = new URLSearchParams({
          vs_currency: "usd",
          ids: ids.join(","),
          order: "market_cap_desc",
          per_page: String(ids.length),
          page: "1",
          sparkline: "true",
          price_change_percentage: "1h,24h,7d",
        })
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?${params}`)
        if (!response.ok) return
        const rows = (await response.json()) as CoinGeckoMarket[]
        if (cancelled) return
        setMarketById((prev) => {
          const next = { ...prev }
          for (const row of rows) {
            next[row.id] = row
          }
          return next
        })
      } catch {
        // Keep Binance live values and placeholders if CoinGecko rate-limits.
      }
    }

    void loadMarkets()
    return () => {
      cancelled = true
    }
  }, [assets])

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return null
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="ml-1 size-3" />
    ) : (
      <ChevronDown className="ml-1 size-3" />
    )
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md overflow-hidden shadow-2xl shadow-primary/5">
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/50 bg-muted/20">
              <TableHead className="w-[40px] font-black text-foreground/70 py-4 px-2 uppercase tracking-widest text-[10px] text-center">
                #
              </TableHead>
              <TableHead
                className="font-black text-foreground/70 py-4 px-6 uppercase tracking-widest text-[10px] cursor-pointer hover:text-primary transition-colors flex items-center whitespace-nowrap"
                onClick={() => handleSort("name")}
              >
                Coin <SortIcon column="name" />
              </TableHead>
              <TableHead
                className="hidden md:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] cursor-pointer hover:text-primary transition-colors text-center whitespace-nowrap"
                onClick={() => handleSort("symbol")}
              >
                <div className="flex items-center justify-center">
                  Symbol <SortIcon column="symbol" />
                </div>
              </TableHead>
              <TableHead
                className="hidden sm:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] cursor-pointer hover:text-primary transition-colors text-center whitespace-nowrap"
                onClick={() => handleSort("category")}
              >
                <div className="flex items-center justify-center">
                  Category <SortIcon column="category" />
                </div>
              </TableHead>
              <TableHead className="hidden lg:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center whitespace-nowrap">
                Price
              </TableHead>
              <TableHead className="hidden xl:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center whitespace-nowrap">
                1H
              </TableHead>
              <TableHead className="hidden xl:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center whitespace-nowrap">
                24H
              </TableHead>
              <TableHead className="hidden xl:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center whitespace-nowrap">
                7D
              </TableHead>
              <TableHead className="hidden 2xl:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center whitespace-nowrap">
                24H Volume
              </TableHead>
              <TableHead className="hidden 2xl:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center whitespace-nowrap">
                Market Cap
              </TableHead>
              <TableHead className="hidden 2xl:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center whitespace-nowrap">
                Last 7 Days
              </TableHead>
              <TableHead
                className="font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
                onClick={() => handleSort("is_active")}
              >
                <div className="flex items-center justify-center">
                  Status <SortIcon column="is_active" />
                </div>
              </TableHead>
              <TableHead
                className="font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
                onClick={() => handleSort("activity")}
              >
                <div className="flex items-center justify-center">
                  Activity <SortIcon column="activity" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset, index) => {
              const liveTicker = liveTickers[`${asset.symbol.toUpperCase()}USDT`]
              const market = asset.coingecko_id ? marketById[asset.coingecko_id] : undefined
              const oneHourChange = market?.price_change_percentage_1h_in_currency
              const dayChange = market?.price_change_percentage_24h_in_currency ?? liveTicker?.changePct
              const weekChange = market?.price_change_percentage_7d_in_currency
              const volume = market?.total_volume ?? liveTicker?.quoteVolume
              const sparkPath = sparklinePath(market?.sparkline_in_7d?.price)
              const sparkIsUp = (weekChange ?? dayChange ?? 0) >= 0

              return (
                <TableRow
                  key={asset.id}
                  className="group cursor-pointer border-border/40 transition-all hover:bg-primary/[0.03]"
                  onClick={() => setSelectedAsset(asset)}
                >
                  <TableCell className="py-4 px-2 text-center">
                    <span className="text-[10px] font-black text-muted-foreground/60">
                      {(currentPage - 1) * pageSize + index + 1}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-primary/10 ring-1 ring-primary/20 group-hover:scale-110 transition-transform shrink-0">
                        <img
                          src={`https://cryptoicons.org/api/icon/${asset.symbol.toLowerCase()}/64`}
                          alt={`${asset.symbol} icon`}
                          className="size-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget
                            if (!img.dataset.fallbackTried) {
                              img.dataset.fallbackTried = "1"
                              img.src = `https://assets.coincap.io/assets/icons/${asset.symbol.toLowerCase()}@2x.png`
                              return
                            }
                            img.style.display = "none"
                            const fallback = img.nextElementSibling as HTMLSpanElement | null
                            if (fallback) fallback.style.display = "flex"
                          }}
                        />
                        <span className="hidden size-full items-center justify-center font-black text-primary">
                          {asset.symbol.slice(0, 3).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                          {asset.name}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-4 text-center">
                    <Badge variant="secondary" className="font-mono font-bold text-xs bg-muted/50 text-muted-foreground border-none">
                      {asset.symbol}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell py-4 text-center">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                      {asset.category || "General"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell py-4 text-center">
                    <span
                      className={`inline-block min-w-[12ch] rounded px-1 text-right font-mono text-xs font-black tabular-nums whitespace-nowrap transition-colors duration-300 ${
                        flashBySymbol[`${asset.symbol.toUpperCase()}${normalizedQuoteCurrency.toUpperCase()}`] === "up"
                          ? "text-emerald-500"
                          : flashBySymbol[`${asset.symbol.toUpperCase()}${normalizedQuoteCurrency.toUpperCase()}`] === "down"
                            ? "text-red-500"
                            : "text-foreground"
                      }`}
                    >
                      {(() => {
                        const usdtPrice = liveTickers[`${asset.symbol.toUpperCase()}USDT`]?.price
                        if (!Number.isFinite(usdtPrice)) return "—"
                        const quotePerUsdt = (() => {
                          if (isUsdPeggedQuote(normalizedQuoteCurrency)) return 1
                          const quoteUsdt = liveTickers[`${normalizedQuoteCurrency.toUpperCase()}USDT`]?.price
                          if (Number.isFinite(quoteUsdt) && quoteUsdt > 0) return 1 / quoteUsdt
                          const usdtQuote = liveTickers[`USDT${normalizedQuoteCurrency.toUpperCase()}`]?.price
                          if (Number.isFinite(usdtQuote) && usdtQuote > 0) return usdtQuote
                          return null
                        })()
                        if (!Number.isFinite(quotePerUsdt ?? NaN)) return "—"
                        const livePrice = usdtPrice * (quotePerUsdt as number)
                        const currencyPrefix =
                          normalizedQuoteCurrency === "TRY"
                            ? "₺"
                            : normalizedQuoteCurrency === "EUR"
                              ? "€"
                              : normalizedQuoteCurrency === "GBP"
                                ? "£"
                                : "$"
                        return `${currencyPrefix}${livePrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: livePrice >= 1 ? 2 : 6,
                        })}`
                      })()}
                    </span>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell py-4 text-center">
                    <span className={cn(
                      "text-xs font-black tabular-nums",
                      Number.isFinite(oneHourChange ?? NaN)
                        ? (oneHourChange as number) >= 0 ? "text-green-500" : "text-red-500"
                        : "text-muted-foreground"
                    )}>
                      {formatPercent(oneHourChange)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell py-4 text-center">
                    <span className={cn(
                      "text-xs font-black tabular-nums",
                      Number.isFinite(dayChange ?? NaN)
                        ? (dayChange as number) >= 0 ? "text-green-500" : "text-red-500"
                        : "text-muted-foreground"
                    )}>
                      {formatPercent(dayChange)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell py-4 text-center">
                    <span className={cn(
                      "text-xs font-black tabular-nums",
                      Number.isFinite(weekChange ?? NaN)
                        ? (weekChange as number) >= 0 ? "text-green-500" : "text-red-500"
                        : "text-muted-foreground"
                    )}>
                      {formatPercent(weekChange)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden 2xl:table-cell py-4 text-center">
                    <span className="text-xs font-black text-foreground tabular-nums whitespace-nowrap">
                      {formatCompactUsd(volume)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden 2xl:table-cell py-4 text-center">
                    <span className="text-xs font-black text-foreground tabular-nums whitespace-nowrap">
                      {formatCompactUsd(market?.market_cap)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden 2xl:table-cell py-4 text-center">
                    <div className="mx-auto h-10 w-28">
                      {sparkPath ? (
                        <svg viewBox="0 0 100 40" className="h-full w-full overflow-visible">
                          <path
                            d={sparkPath}
                            fill="none"
                            stroke={sparkIsUp ? "#22c55e" : "#ef4444"}
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <span className="text-xs font-black text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <div className={`size-1.5 rounded-full ${asset.is_active ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/30"}`} />
                      <span className={`text-[10px] font-black uppercase tracking-wider ${asset.is_active ? "text-green-500" : "text-muted-foreground"}`}>
                        {asset.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <div className="flex min-w-[80px] items-center justify-center">
                      {(dayChange ?? 0) >= 0 ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20">
                          <span className="text-[10px] font-black text-green-500 uppercase">Bullish</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20">
                          <span className="text-[10px] font-black text-red-500 uppercase">Bearish</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
