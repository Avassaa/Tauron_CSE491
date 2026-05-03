"use client"

import * as React from "react"
import { Star, ChevronUp, ChevronDown, TrendingUp, TrendingDown, Search, Activity, Check, ChevronDown as ChevronDownIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import type { AssetResponse, WatchlistListResponse } from "~/lib/api-client"
import { useLiveTickers } from "~/lib/live-price-stream"
import { cn } from "~/lib/utils"
import { Sparkline } from "./sparkline"
import { AssetIcon } from "~/components/asset-icon"
import {
  type CurrencyCode,
  CURRENCY_SYMBOLS,
  FALLBACK_USD_BASE_RATES,
  getUsdtPerCurrency,
  formatCurrency,
  formatCompactCurrency,
  formatCompact
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

function normalizeBinanceBaseSymbol(raw: string): string | null {
  const normalized = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (!normalized || normalized.length < 2 || normalized.length > 12) return null
  return normalized
}

function toBinanceUsdtPair(baseSymbol: string): string {
  return baseSymbol === "USDT" ? "USDTUSD" : `${baseSymbol}USDT`
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
  onToggleWatchlist: (asset: AssetResponse) => void // Add/Remove from primary watchlist
  watchlistIds: Set<string> // Set of asset IDs in the user's watchlist
  watchlistLists?: WatchlistListResponse[]
  onToggleWatchlistList?: (asset: AssetResponse, listId: string, currentlyInList: boolean) => void
  onAddToWatchlistList?: (asset: AssetResponse, listId: string) => void
  watchlistAssetsByListId?: Record<string, AssetResponse[]>
  onCreateWatchlistList?: () => void
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
  watchlistLists = [],
  onToggleWatchlistList,
  onAddToWatchlistList,
  watchlistAssetsByListId = {},
  onCreateWatchlistList,
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
  const streamSymbols = React.useMemo(() => {
    const assetUsdtSymbols = assets
      .map((asset) => normalizeBinanceBaseSymbol(asset.symbol))
      .filter((symbol): symbol is string => Boolean(symbol))
      .map((symbol) => toBinanceUsdtPair(symbol))
    const conversionSymbols = isUsdPeggedQuote(normalizedQuoteCurrency)
      ? []
      : [`${normalizedQuoteCurrency.toUpperCase()}USDT`, `USDT${normalizedQuoteCurrency.toUpperCase()}`]
    return Array.from(new Set([...assetUsdtSymbols, ...conversionSymbols]))
  }, [assets, normalizedQuoteCurrency])

  const liveTickers = useLiveTickers(streamSymbols)

  const quotePerUsd = React.useMemo(() => {
    if (isUsdPeggedQuote(normalizedQuoteCurrency)) return 1
    if (Number.isFinite(externalQuotePerUsd)) return externalQuotePerUsd as number

    const usdtPerCurrency = getUsdtPerCurrency(normalizedQuoteCurrency, Object.fromEntries(
      Object.entries(liveTickers).map(([k, v]) => [k, v.price])
    ))

    if (Number.isFinite(usdtPerCurrency) && usdtPerCurrency! > 0) return 1 / usdtPerCurrency!
    return FALLBACK_USD_BASE_RATES[normalizedQuoteCurrency] || 1
  }, [externalQuotePerUsd, liveTickers, normalizedQuoteCurrency])

  // --- PRICE FLASH EFFECT ---
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

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return null
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="ml-1 size-3" />
    ) : (
      <ChevronDown className="ml-1 size-3" />
    )
  }

  return (
    <div className="min-w-0 w-full rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl overflow-hidden">
      <div className="min-w-0 overflow-x-auto scrollbar-thin">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/50 bg-white/28 dark:bg-muted/40">
              <TableHead className="w-12 pl-3 pr-0 text-left md:w-14 md:pl-6"></TableHead>
              <TableHead className="w-8 font-black text-foreground/70 py-4 px-0.5 uppercase tracking-widest text-[9px] text-center cursor-pointer hover:text-primary transition-colors md:w-9" onClick={() => handleSort("rank")}>
                <div className="flex items-center justify-center gap-0.5"># <SortIcon column="rank" /></div>
              </TableHead>
              <TableHead className="min-w-0 w-[30%] font-black text-foreground/70 py-4 px-3 uppercase tracking-widest text-[9px] cursor-pointer hover:text-primary transition-colors @md/dock-shell:w-[26%] md:px-6" onClick={() => handleSort("name")}>
                <div className="flex items-center gap-1">Coin <SortIcon column="name" /></div>
              </TableHead>
              <TableHead className="w-[10%] font-black text-foreground/70 py-4 px-2 uppercase tracking-widest text-[9px] text-right cursor-pointer hover:text-primary transition-colors @md/dock-shell:w-[12%] md:px-4" onClick={() => handleSort("price")}>
                <div className="flex items-center justify-end gap-1">Price <SortIcon column="price" /></div>
              </TableHead>
              <TableHead className="w-[7%] font-black text-foreground/70 py-4 px-1 uppercase tracking-widest text-[9px] text-center cursor-pointer hover:text-primary transition-colors @md/dock-shell:w-[8%] md:px-4" onClick={() => handleSort("change1h")}>
                <div className="flex items-center justify-center gap-1">1h <SortIcon column="change1h" /></div>
              </TableHead>
              <TableHead className="w-[7%] font-black text-foreground/70 py-4 px-1 uppercase tracking-widest text-[9px] text-center cursor-pointer hover:text-primary transition-colors @md/dock-shell:w-[8%] md:px-4" onClick={() => handleSort("change24h")}>
                <div className="flex items-center justify-center gap-1">24h <SortIcon column="change24h" /></div>
              </TableHead>
              <TableHead className="w-[7%] font-black text-foreground/70 py-4 px-1 uppercase tracking-widest text-[9px] text-center cursor-pointer hover:text-primary transition-colors @md/dock-shell:w-[8%] md:px-4" onClick={() => handleSort("change7d")}>
                <div className="flex items-center justify-center gap-1">7d <SortIcon column="change7d" /></div>
              </TableHead>
              <TableHead className="w-[12%] font-black text-foreground/70 py-4 px-2 uppercase tracking-widest text-[9px] text-right cursor-pointer hover:text-primary transition-colors md:px-4" onClick={() => handleSort("volume")}>
                <div className="flex items-center justify-end gap-1">24h Vol <SortIcon column="volume" /></div>
              </TableHead>
              <TableHead className="w-[14%] font-black text-foreground/70 py-4 px-3 uppercase tracking-widest text-[9px] text-center md:px-6">7d chart</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="h-72 text-center">
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
              assets.map((asset, index) => (
                (() => {
                  const normalizedBase = normalizeBinanceBaseSymbol(asset.symbol)
                  const liveTickerSymbol = normalizedBase ? `${normalizedBase}USDT` : `${asset.symbol.toUpperCase()}USDT`
                  return (
                <AssetTableRow
                  key={asset.id}
                  asset={asset}
                  index={index}
                  mData={marketDataMap[asset.id]}
                  isWatched={watchlistIds.has(asset.id) || watchlistIds.has(asset.symbol.toUpperCase())}
                  liveTickerSymbol={normalizedBase ? toBinanceUsdtPair(normalizedBase) : liveTickerSymbol}
                  liveTickers={liveTickers}
                  quotePerUsd={quotePerUsd}
                  currencyCode={currencyCode}
                  flashBySymbol={flashBySymbol}
                  currentPage={currentPage}
                  pageSize={pageSize}
                  setSelectedAsset={setSelectedAsset}
                  watchlistLists={watchlistLists}
                  watchlistAssetsByListId={watchlistAssetsByListId}
                  onToggleWatchlistList={onToggleWatchlistList}
                  onAddToWatchlistList={onAddToWatchlistList}
                  onCreateWatchlistList={onCreateWatchlistList}
                />
                  )
                })()
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function AssetTableRow({
  asset,
  index,
  mData,
  isWatched,
  liveTickerSymbol,
  liveTickers,
  quotePerUsd,
  currencyCode,
  flashBySymbol,
  currentPage,
  pageSize,
  setSelectedAsset,
  watchlistLists,
  watchlistAssetsByListId,
  onToggleWatchlistList,
  onAddToWatchlistList,
  onCreateWatchlistList,
}: {
  asset: AssetResponse
  index: number
  mData?: MarketData
  isWatched: boolean
  liveTickerSymbol: string
  liveTickers: any
  quotePerUsd: number
  currencyCode: CurrencyCode
  flashBySymbol: Record<string, "up" | "down">
  currentPage: number
  pageSize: number
  setSelectedAsset: (asset: AssetResponse) => void
  watchlistLists: WatchlistListResponse[]
  watchlistAssetsByListId: Record<string, AssetResponse[]>
  onToggleWatchlistList?: (asset: AssetResponse, listId: string, currentlyInList: boolean) => void
  onAddToWatchlistList?: (asset: AssetResponse, listId: string) => void
  onCreateWatchlistList?: () => void
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)

  return (
    <TableRow
      key={asset.id}
      className="group cursor-pointer border-border/40 transition-colors hover:bg-white/22 dark:hover:bg-muted/28"
      onClick={() => setSelectedAsset(asset)}
    >
      <TableCell className="py-4 pl-3 pr-0 w-12 text-left md:w-14 md:pl-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center h-full">
          <DropdownMenu onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button className="group/star outline-none">
                <Star
                  className={cn(
                    "size-4 transition-all duration-300",
                    isWatched
                      ? "fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]"
                      : cn(
                        "text-muted-foreground/40 hover:text-primary/70",
                        (menuOpen || isWatched) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px] p-2 bg-popover/95 backdrop-blur-md border-border shadow-2xl rounded-xl">
              <div className="px-2 py-1.5 mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                Add to Watchlist
              </div>

              {watchlistLists.length > 0 ? (
                watchlistLists.map((list) => {
                  const listAssets = watchlistAssetsByListId[list.id] || [];
                  const isInList = listAssets.some(a => a.id === asset.id || a.symbol.toUpperCase() === asset.symbol.toUpperCase());

                  return (
                    <DropdownMenuItem
                      key={list.id}
                      onSelect={() => {
                        if (onToggleWatchlistList) {
                          onToggleWatchlistList(asset, list.id, isInList);
                        } else if (!isInList) {
                          onAddToWatchlistList?.(asset, list.id);
                        }
                      }}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 text-[10px] font-bold uppercase rounded-lg transition-colors focus:bg-primary/10"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("size-1.5 rounded-full", isInList ? "bg-primary animate-pulse" : "bg-muted-foreground/20")} />
                        <span className="truncate">{list.name}</span>
                      </div>
                      {isInList && <Check className="size-3 text-primary" />}
                    </DropdownMenuItem>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center text-[9px] font-bold text-muted-foreground/60 uppercase">
                  No watchlists found
                </div>
              )}

              <DropdownMenuSeparator className="my-2 bg-border/50" />
              <DropdownMenuItem
                onClick={() => onCreateWatchlistList?.()}
                className="flex items-center gap-2 cursor-pointer px-3 py-2 text-[10px] font-bold uppercase rounded-lg text-primary hover:bg-primary/5 transition-colors"
              >
                <div className="size-4 rounded-md bg-primary/10 flex items-center justify-center">
                  <Activity className="size-2.5" />
                </div>
                New Watchlist
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
      <TableCell className="py-4 px-0.5 text-center md:px-1">
        <span className="text-[10px] font-black text-muted-foreground/60">{(currentPage - 1) * pageSize + index + 1}</span>
      </TableCell>
      <TableCell className="min-w-0 py-4 px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-transform group-hover:scale-110 md:size-9">
            <AssetIcon symbol={asset.symbol} alt={`${asset.symbol} icon`} fallbackClassName="text-[10px]" />
          </div>
          <div className="flex min-w-0 items-baseline gap-1.5 md:gap-2">
            <span className="truncate font-bold tracking-tight">{asset.name}</span>
            <span className="shrink-0 text-[10px] font-black uppercase text-muted-foreground opacity-60">{asset.symbol}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-4 px-2 text-right md:px-4">
        <span className={cn(
          "inline-block rounded px-1 font-mono text-xs font-bold tabular-nums transition-colors duration-300",
          flashBySymbol[liveTickerSymbol] === "up" ? "text-green-500" : flashBySymbol[liveTickerSymbol] === "down" ? "text-red-500" : "text-foreground"
        )}>
          {(() => {
            const usdtPrice = liveTickers[liveTickerSymbol]?.price || mData?.price
            if (!Number.isFinite(usdtPrice)) return "—"
            const livePrice = (usdtPrice as number) * (quotePerUsd as number)
            return formatCurrency(livePrice, currencyCode)
          })()}
        </span>
      </TableCell>
      <TableCell className="py-4 px-1 md:px-4"><PriceChange value={mData?.price_change_1h} /></TableCell>
      <TableCell className="py-4 px-1 md:px-4"><PriceChange value={mData?.price_change_24h} /></TableCell>
      <TableCell className="py-4 px-1 md:px-4"><PriceChange value={mData?.price_change_7d} /></TableCell>
      <TableCell className="py-4 px-2 text-right md:px-4"><span className="font-mono text-xs font-bold text-foreground/80">{formatCompact(mData?.volume)}</span></TableCell>
      <TableCell className="py-4 px-3 md:px-6">
        <div className="flex justify-center">
          <Sparkline data={mData?.sparkline || []} isUp={(mData?.price_change_7d || 0) >= 0} />
        </div>
      </TableCell>
    </TableRow>
  )
}
