"use client"

import * as React from "react"
import { Star, ChevronUp, ChevronDown, TrendingUp, TrendingDown, Search } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import type { AssetResponse } from "~/lib/api-client"
import { useLiveTickers } from "~/lib/live-price-stream"
import { cn } from "~/lib/utils"
import { Sparkline } from "./sparkline"
import {
  type CurrencyCode,
  CURRENCY_SYMBOLS,
  FALLBACK_USD_BASE_RATES,
  getUsdtPerCurrency
} from "~/lib/currency"

/**
 * Type for market data received from the parent component.
 */
export interface MarketData {
  price: number
  price_change_1h: number
  price_change_24h: number
  price_change_7d: number
  price_change_14d?: number
  price_change_30d?: number
  price_change_1y?: number
  volume: number
  market_cap: number
  rank: number
  sparkline: number[]
}

/**
 * Currency formatting: Shortens values using compact notation (K, M, B).
 */
function formatCompactCurrency(
  value: number | null | undefined,
  currencyCode: CurrencyCode,
) {
  if (!Number.isFinite(value ?? NaN)) return "—"
  const formatted = new Intl.NumberFormat("en-US", {
    currency: currencyCode,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value as number)
  return `${CURRENCY_SYMBOLS[currencyCode]}${formatted}`
}

/**
 * Number formatting: Shortens large numbers like Volume and Market Cap.
 */
function formatCompact(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return "—"
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value as number)
}

/**
 * Price Change Component: Displays color and icon (up/down arrow) based on percentage change.
 */
function PriceChange({ value }: { value?: number | null }) {
  if (!Number.isFinite(value ?? NaN)) return <span className="text-muted-foreground">—</span>
  const isPositive = (value as number) >= 0
  return (
    <div className={cn("flex items-center justify-end gap-1 font-mono text-xs font-bold tabular-nums", isPositive ? "text-green-500" : "text-red-500")}>
      {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {isPositive ? "+" : ""}{value?.toFixed(2)}%
    </div>
  )
}

/**
 * Resilient Icon component that falls back to text if image fails
 */
function AssetIcon({ symbol }: { symbol: string }) {
  const [error, setError] = React.useState(false)

  if (error) {
    return (
      <span className="text-[10px] font-black text-primary uppercase">
        {symbol.slice(0, 3)}
      </span>
    )
  }

  return (
    <img
      src={`https://cryptoicons.org/api/icon/${symbol.toLowerCase()}/64`}
      alt={symbol}
      className="size-full object-cover"
      onError={() => setError(true)}
    />
  )
}

interface AssetTableProps {
  assets: AssetResponse[] // Assets to display in the table
  marketDataMap: Record<string, MarketData> // Market data indexed by asset ID
  currentPage: number
  pageSize: number
  sortConfig: {
    key: string
    direction: "asc" | "desc"
  } | null
  handleSort: (key: any) => void
  setSelectedAsset: (asset: AssetResponse) => void // Opens detail view on row click
  quoteCurrency: string // Currency to display (USD, TRY, etc.)
  quotePerUsd?: number
  onToggleWatchlist: (asset: AssetResponse) => void // Add/Remove from watchlist
  watchlistIds: Set<string> // Set of asset IDs in the user's watchlist
}

export function AssetTable({
  assets,
  marketDataMap,
  currentPage,
  pageSize,
  sortConfig,
  handleSort,
  setSelectedAsset,
  quoteCurrency,
  quotePerUsd: externalQuotePerUsd,
  onToggleWatchlist,
  watchlistIds,
}: AssetTableProps) {
  // --- HELPER VARIABLES & STATE ---
  const isUsdPeggedQuote = (value: string) => value === "USD" || value === "USDT" || value === "USDC" || value === "BUSD"

  // Normalize the quote currency code (default to USD)
  const normalizedQuoteCurrency = ["USD", "TRY", "EUR", "GBP", "JPY", "RUB", "CAD", "AUD", "CHF", "CNY"].includes(quoteCurrency)
    ? quoteCurrency
    : "USD"

  const [flashBySymbol, setFlashBySymbol] = React.useState<Record<string, "up" | "down">>({})
  const lastPriceBySymbolRef = React.useRef<Record<string, number>>({})
  const flashTimersRef = React.useRef<Record<string, number>>({})
  const currencyCode = (normalizedQuoteCurrency as CurrencyCode) || "USD"

  // --- LIVE DATA (WEBSOCKET) ---
  // Determine which symbols to subscribe to for live updates
  const streamSymbols = React.useMemo(() => {
    const assetUsdtSymbols = assets.map((asset) => `${asset.symbol.toUpperCase()}USDT`)
    const conversionSymbols = isUsdPeggedQuote(normalizedQuoteCurrency)
      ? []
      : [`${normalizedQuoteCurrency.toUpperCase()}USDT`, `USDT${normalizedQuoteCurrency.toUpperCase()}`]
    return Array.from(new Set([...assetUsdtSymbols, ...conversionSymbols]))
  }, [assets, normalizedQuoteCurrency])

  const liveTickers = useLiveTickers(streamSymbols)

  // Calculate the exchange rate for the selected quote currency
  const quotePerUsd = React.useMemo(() => {
    if (isUsdPeggedQuote(normalizedQuoteCurrency)) return 1
    if (Number.isFinite(externalQuotePerUsd)) return externalQuotePerUsd as number

    const usdtPerCurrency = getUsdtPerCurrency(normalizedQuoteCurrency, Object.fromEntries(
      Object.entries(liveTickers).map(([k, v]) => [k, v.price])
    ))

    if (Number.isFinite(usdtPerCurrency) && usdtPerCurrency! > 0) return 1 / usdtPerCurrency!
    return FALLBACK_USD_BASE_RATES[normalizedQuoteCurrency] || 1
  }, [externalQuotePerUsd, liveTickers, normalizedQuoteCurrency])

  // --- PRICE FLASH EFFECT (TICKERS) ---
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
    }, 650)
  }, [])

  // Trigger flash effect when live price changes
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

  // --- SORTING ICON ---
  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return null
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="ml-1 size-3" />
    ) : (
      <ChevronDown className="ml-1 size-3" />
    )
  }

  // --- RENDER ---
  return (
    <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/50 bg-muted/20">
              <TableHead className="w-[32px] px-1 text-center"></TableHead>
              <TableHead className="w-[32px] font-black text-foreground/70 py-4 px-1 uppercase tracking-widest text-[9px] text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("rank")}>
                <div className="flex items-center justify-center gap-0.5"># <SortIcon column="rank" /></div>
              </TableHead>
              <TableHead className="min-w-[180px] font-black text-foreground/70 py-4 px-6 uppercase tracking-widest text-[9px] cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("name")}>
                <div className="flex items-center gap-1">Coin <SortIcon column="name" /></div>
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("price")}>
                <div className="flex items-center justify-end gap-1">Price <SortIcon column="price" /></div>
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("change1h")}>
                <div className="flex items-center justify-center gap-1">1h <SortIcon column="change1h" /></div>
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("change24h")}>
                <div className="flex items-center justify-center gap-1">24h <SortIcon column="change24h" /></div>
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-center cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("change7d")}>
                <div className="flex items-center justify-center gap-1">7d <SortIcon column="change7d" /></div>
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("volume")}>
                <div className="flex items-center justify-end gap-1">24h Volume <SortIcon column="volume" /></div>
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("market_cap")}>
                <div className="flex items-center justify-end gap-1">Market Cap <SortIcon column="market_cap" /></div>
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-6 uppercase tracking-widest text-[9px] text-center">Last 7 Days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              // --- EMPTY STATE ---
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={10} className="h-72 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 animate-in fade-in zoom-in duration-500">
                    <div className="rounded-full bg-muted/50 p-4 ring-1 ring-border">
                      <Search className="size-8 text-muted-foreground/60" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xl font-bold tracking-tight">No results found</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your search to find what you're looking for.</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // --- ASSET LIST ---
              assets.map((asset, index) => {
                const mData = marketDataMap[asset.id];
                const isWatched = watchlistIds.has(asset.id) || watchlistIds.has(asset.symbol.toUpperCase());
                const liveTickerSymbol = `${asset.symbol.toUpperCase()}USDT`

                return (
                  <TableRow key={asset.id} className="group cursor-pointer border-border/40 transition-colors hover:bg-muted/30" onClick={() => setSelectedAsset(asset)}>
                    {/* Watchlist Toggle */}
                    <TableCell className="py-4 px-0 w-[40px] text-center" onClick={(e) => { e.stopPropagation(); onToggleWatchlist(asset); }}>
                      <div className="flex items-center justify-center h-full">
                        <Star className={cn("size-4 transition-all duration-300", isWatched ? "fill-primary text-primary scale-110" : "text-muted-foreground/40 hover:text-primary/70 opacity-0 group-hover:opacity-100")} />
                      </div>
                    </TableCell>
                    {/* Row Number */}
                    <TableCell className="py-4 px-1 text-center">
                      <span className="text-[10px] font-black text-muted-foreground/60">{(currentPage - 1) * pageSize + index + 1}</span>
                    </TableCell>
                    {/* Coin Identity */}
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-primary/10 ring-1 ring-primary/20 group-hover:scale-110 transition-transform shrink-0">
                          <AssetIcon symbol={asset.symbol} />
                        </div>
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="font-bold tracking-tight truncate">{asset.name}</span>
                          <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">{asset.symbol}</span>
                        </div>
                      </div>
                    </TableCell>
                    {/* Live Price with Currency Conversion */}
                    <TableCell className="py-4 px-4 text-right">
                      <span className={cn(
                        "inline-block rounded px-1 font-mono text-xs font-bold tabular-nums transition-colors duration-300",
                        flashBySymbol[liveTickerSymbol] === "up" ? "text-green-500" : flashBySymbol[liveTickerSymbol] === "down" ? "text-red-500" : "text-foreground"
                      )}>
                        {(() => {
                          const usdtPrice = liveTickers[liveTickerSymbol]?.price || mData?.price
                          if (!Number.isFinite(usdtPrice)) return "—"
                          const livePrice = (usdtPrice as number) * (quotePerUsd as number)
                          return `${CURRENCY_SYMBOLS[currencyCode]}${new Intl.NumberFormat("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: livePrice >= 1 ? 2 : 6,
                          }).format(livePrice)}`
                        })()}
                      </span>
                    </TableCell>
                    {/* Market Performance Metrics */}
                    <TableCell className="py-4 px-4"><PriceChange value={mData?.price_change_1h} /></TableCell>
                    <TableCell className="py-4 px-4"><PriceChange value={mData?.price_change_24h} /></TableCell>
                    <TableCell className="py-4 px-4"><PriceChange value={mData?.price_change_7d} /></TableCell>
                    {/* Financial Figures */}
                    <TableCell className="py-4 px-4 text-right"><span className="font-mono font-bold text-xs text-foreground/80">{formatCompact(mData?.volume)}</span></TableCell>
                    <TableCell className="py-4 px-4 text-right"><span className="font-mono font-bold text-xs text-foreground/80">{formatCompact(mData?.market_cap)}</span></TableCell>
                    {/* 7-Day Trend Visualization */}
                    <TableCell className="py-4 px-6">
                      <div className="flex justify-center">
                        <Sparkline data={mData?.sparkline || []} isUp={(mData?.price_change_7d || 0) >= 0} />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
