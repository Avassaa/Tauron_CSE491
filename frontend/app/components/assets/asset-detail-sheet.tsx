"use client"

import * as React from "react"
import { CircleDot, TrendingUp, TrendingDown, Activity, RefreshCw, Star } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { Button } from "~/components/ui/button"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs"
import { AssetDetailChart } from "~/components/dashboard/asset-detail-chart"
import { AssetIcon } from "~/components/asset-icon"
import {
  Card,
  CardContent,
} from "~/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { cn } from "~/lib/utils"
import { Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import type { AssetResponse, MlModelResponse, WatchlistListResponse } from "~/lib/api-client"
import { useLiveTickers } from "~/lib/live-price-stream"

interface AssetDetailSheetProps {
  selectedAsset: AssetResponse | null
  setSelectedAsset: (asset: AssetResponse | null) => void
  marketStats: {
    price?: number;
    change24h?: number;
    rangeChange?: number;
    volume?: number;
    change1h?: number;
    change7d?: number;
    change14d?: number;
    change30d?: number;
    change1y?: number;
  } | null
  chartData: any[]
  chartLoading: boolean
  timeRange: string
  setTimeRange: (range: any) => void
  TIME_RANGES: string[]
  predictionModel: MlModelResponse | null
  setPredictionModel: (model: MlModelResponse | null) => void
  availableModels: MlModelResponse[]
  formatCurrency: (val?: number) => string
  formatCompactCurrency: (val?: number) => string
  quoteCurrency?: string
  quotePerUsd?: number
  isWatched?: boolean
  onToggleWatchlist?: (asset: AssetResponse) => void
  watchlistLists?: WatchlistListResponse[]
  onAddToWatchlistList?: (asset: AssetResponse, listId: string) => void
  onToggleWatchlistList?: (asset: AssetResponse, listId: string, currentlyInList: boolean) => void
  watchlistMembershipByListId?: Record<string, boolean>
  onCreateWatchlistList?: () => void
}

export function AssetDetailSheet({
  selectedAsset,
  setSelectedAsset,
  marketStats,
  chartData,
  chartLoading,
  timeRange,
  setTimeRange,
  TIME_RANGES,
  predictionModel,
  setPredictionModel,
  availableModels,
  formatCurrency,
  formatCompactCurrency,
  quoteCurrency = "USD",
  quotePerUsd,
  isWatched,
  onToggleWatchlist,
  watchlistLists = [],
  onAddToWatchlistList,
  onToggleWatchlistList,
  watchlistMembershipByListId = {},
  onCreateWatchlistList,
}: AssetDetailSheetProps) {
  const normalizedQuoteCurrency =
    quoteCurrency === "USD" ||
      quoteCurrency === "TRY" ||
      quoteCurrency === "EUR" ||
      quoteCurrency === "GBP" ||
      quoteCurrency === "JPY" ||
      quoteCurrency === "RUB" ||
      quoteCurrency === "CAD" ||
      quoteCurrency === "AUD" ||
      quoteCurrency === "CHF" ||
      quoteCurrency === "CNY" ||
      quoteCurrency === "USDT" ||
      quoteCurrency === "USDC" ||
      quoteCurrency === "BUSD"
      ? quoteCurrency
      : "USD"
  const isUsdPeggedQuote =
    normalizedQuoteCurrency === "USD" ||
    normalizedQuoteCurrency === "USDT" ||
    normalizedQuoteCurrency === "USDC" ||
    normalizedQuoteCurrency === "BUSD"
  const [activeTab, setActiveTab] = React.useState<"price" | "prediction">("price")
  const [chartMode, setChartMode] = React.useState<"price" | "volume" | "both">("both")
  const [priceFlash, setPriceFlash] = React.useState<"up" | "down" | null>(null)
  const previousPriceRef = React.useRef<number | null>(null)
  const flashTimerRef = React.useRef<number | null>(null)
  const streamSymbols = React.useMemo(() => {
    if (!selectedAsset) return []
    return [
      `${selectedAsset.symbol.toUpperCase()}USDT`,
      ...(isUsdPeggedQuote
        ? []
        : [
          `${normalizedQuoteCurrency.toUpperCase()}USDT`,
          `USDT${normalizedQuoteCurrency.toUpperCase()}`,
        ]),
    ]
  }, [selectedAsset?.symbol, isUsdPeggedQuote, normalizedQuoteCurrency])
  const displayChange =
    timeRange === "24H" ? marketStats?.change24h :
      timeRange === "7D" ? marketStats?.change7d :
        timeRange === "1M" ? marketStats?.change30d :
          timeRange === "1Y" ? marketStats?.change1y :
            marketStats?.rangeChange

  const isNegative = (displayChange ?? 0) < 0

  const chartConfig = React.useMemo(() => ({
    price: {
      label: "Price",
      color: isNegative ? "#ef4444" : "#10b981"
    }
  }), [isNegative])

  const liveTickers = useLiveTickers(streamSymbols)
  const targetSymbol = selectedAsset ? `${selectedAsset.symbol.toUpperCase()}USDT` : ""
  const quoteUsdtSymbol = `${normalizedQuoteCurrency.toUpperCase()}USDT`
  const usdtQuoteSymbol = `USDT${normalizedQuoteCurrency.toUpperCase()}`
  const usdtPrice = targetSymbol ? liveTickers[targetSymbol]?.price : undefined
  const targetChangePct = targetSymbol ? liveTickers[targetSymbol]?.changePct : undefined
  const quoteUsdtPrice = liveTickers[quoteUsdtSymbol]?.price
  const usdtQuotePrice = liveTickers[usdtQuoteSymbol]?.price
  const liveTicker = React.useMemo(() => {
    if (!Number.isFinite(usdtPrice)) return null
    const quotePerUsdt = (() => {
      if (isUsdPeggedQuote) return 1
      if (Number.isFinite(quotePerUsd)) return quotePerUsd as number
      if (Number.isFinite(quoteUsdtPrice) && (quoteUsdtPrice ?? 0) > 0) return 1 / (quoteUsdtPrice as number)
      if (Number.isFinite(usdtQuotePrice) && (usdtQuotePrice ?? 0) > 0) return usdtQuotePrice as number
      return null
    })()
    if (!Number.isFinite(quotePerUsdt ?? NaN)) return null
    return {
      price: (usdtPrice as number) * (quotePerUsdt as number),
      changePct: Number.isFinite(targetChangePct) ? (targetChangePct as number) : 0,
    }
  }, [isUsdPeggedQuote, quotePerUsd, quoteUsdtPrice, targetChangePct, usdtPrice, usdtQuotePrice])

  React.useEffect(() => {
    if (!selectedAsset) {
      setPriceFlash(null)
      previousPriceRef.current = null
      return
    }
    setPriceFlash(null)
    previousPriceRef.current = null
  }, [selectedAsset?.id])

  React.useEffect(() => {
    if (!selectedAsset || !liveTicker) return
    const prev = previousPriceRef.current
    if (prev !== null && prev !== liveTicker.price) {
      setPriceFlash(liveTicker.price > prev ? "up" : "down")
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setPriceFlash(null), 650)
    }
    previousPriceRef.current = liveTicker.price
  }, [selectedAsset?.id, liveTicker?.price])

  React.useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current)
    }
  }, [])

  const displayedPrice = liveTicker?.price ?? marketStats?.price
  const displayedChange24h = liveTicker?.changePct ?? marketStats?.change24h
  const hasVolumeData = marketStats?.volume !== undefined
  const hasChartData = chartData.length > 0
  const activeWatchlists = React.useMemo(() => {
    return watchlistLists.filter((list) => watchlistMembershipByListId[list.id])
  }, [watchlistLists, watchlistMembershipByListId])

  const watchlistButtonText = activeWatchlists.length === 1
    ? activeWatchlists[0].name
    : activeWatchlists.length > 1
      ? `${activeWatchlists.length} Lists`
      : "Watchlists"

  return (
    <Sheet open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
      <SheetContent side="right" className="w-full sm:max-w-[680px] p-0 border-l border-border bg-background text-foreground overflow-y-auto scrollbar-none">
        {selectedAsset && (
          <div className="relative px-4 sm:px-8 pt-8 sm:pt-10 pb-10 sm:pb-12 flex flex-col">
            <SheetHeader className="items-start text-left mb-8 p-0">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="size-20 overflow-hidden rounded-full flex items-center justify-center font-black text-2xl">
                    <AssetIcon
                      symbol={selectedAsset.symbol}
                      alt={`${selectedAsset.symbol} icon`}
                      fallbackClassName="text-2xl"
                    />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 size-7 rounded-xl bg-background border-2 border-background flex items-center justify-center shadow-lg">
                    <Activity className={cn("size-3.5", (marketStats?.rangeChange ?? 0) >= 0 ? "text-green-500" : "text-red-500")} />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <SheetTitle className="text-2xl sm:text-4xl font-black tracking-tighter truncate min-w-0">
                      {selectedAsset.name}
                    </SheetTitle>
                    {onToggleWatchlist || onToggleWatchlistList ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "shrink-0 h-9 w-9 sm:w-auto rounded-lg px-0 sm:px-4 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center",
                              isWatched === true
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:bg-yellow-500/10 dark:border-yellow-500/50 dark:text-yellow-500 hover:bg-amber-500/20 dark:hover:bg-yellow-500/20 shadow-amber-500/5 dark:shadow-yellow-500/10"
                                : "bg-muted/30 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <Star className={cn(
                              "size-3 sm:mr-1.5 transition-all duration-300",
                              isWatched === true
                                ? "fill-amber-500 text-amber-500 dark:fill-yellow-500 dark:text-yellow-500 scale-110"
                                : "text-muted-foreground/30 fill-none"
                            )} />
                            <span className="hidden sm:inline truncate max-w-[120px]">{watchlistButtonText}</span>
                            <ChevronDown className="ml-0 sm:ml-1.5 size-3 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[240px] p-2 bg-popover/95 backdrop-blur-md border-border shadow-2xl rounded-xl">
                          <div className="px-2 py-1.5 mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                            My Lists
                          </div>
                          {watchlistLists.length > 0 ? (
                            <>
                              {watchlistLists.map((list) => {
                                const isInList = !!watchlistMembershipByListId[list.id]
                                return (
                                  <DropdownMenuItem
                                    key={list.id}
                                    onSelect={(event) => {
                                      event.preventDefault()
                                      if (onToggleWatchlistList) {
                                        onToggleWatchlistList(selectedAsset, list.id, isInList)
                                      } else if (!isInList) {
                                        onAddToWatchlistList?.(selectedAsset, list.id)
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
                                )
                              })}
                              <DropdownMenuSeparator className="my-2 bg-border/50" />
                              <DropdownMenuItem
                                onClick={() => onCreateWatchlistList?.()}
                                className="flex items-center gap-2 cursor-pointer px-3 py-2 text-[10px] font-bold uppercase rounded-lg text-primary hover:bg-primary/5 transition-colors"
                              >
                                <div className="size-4 rounded-md bg-primary/10 flex items-center justify-center">
                                  <Activity className="size-2.5" />
                                </div>
                                Create New Watchlist
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => onCreateWatchlistList?.()}
                              className="flex items-center gap-2 cursor-pointer px-3 py-2 text-[10px] font-bold uppercase rounded-lg text-primary hover:bg-primary/5 transition-colors"
                            >
                              <div className="size-4 rounded-md bg-primary/10 flex items-center justify-center">
                                <Activity className="size-2.5" />
                              </div>
                              Create First Watchlist
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Badge variant="secondary" className="px-2.5 py-0.5 bg-muted text-foreground font-black text-[10px] rounded-md border-none">
                      {selectedAsset.symbol}
                    </Badge>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
                      • {selectedAsset.category || "CURRENCY"}
                    </span>
                  </div>
                </div>
              </div>


            </SheetHeader>

            {/* Status & Technical Details Row */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="w-full sm:flex-1 space-y-3">
                <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Network Status</h3>
                <div className="rounded-2xl border border-border bg-card/50 px-5 py-2 flex flex-col justify-center h-[68px] transition-colors hover:bg-card">
                  <div className="flex items-center gap-2 text-xs font-black">
                    <div className={cn("size-1 rounded-full animate-pulse", selectedAsset.is_active ? "bg-green-500" : "bg-red-500")} />
                    {selectedAsset.is_active ? "Active" : "Inactive"}
                  </div>
                  <div className="text-[9px] font-bold text-muted-foreground/60 mt-0.5 uppercase tracking-wider">{selectedAsset.is_active ? "System Online" : "System Offline"}</div>
                </div>
              </div>

              <div className="w-full sm:flex-[1.8] space-y-3">
                <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Technical ID Details</h3>
                <div className="rounded-2xl border border-border bg-card/50 overflow-hidden h-[68px] flex flex-col justify-center">
                  <div className="flex items-center justify-between px-5 py-2 border-b border-border">
                    <span className="text-[10px] font-bold text-muted-foreground/80">Asset ID</span>
                    <Badge className="bg-muted text-foreground font-black rounded-md border-none px-2 py-0 text-[9px]">{selectedAsset.id.slice(0, 8)}</Badge>
                  </div>
                  <div className="flex items-center justify-between px-5 py-2">
                    <span className="text-[10px] font-bold text-muted-foreground/80">CG Ref</span>
                    <span className="font-mono font-bold text-[10px]">{selectedAsset.coingecko_id || selectedAsset.name.toLowerCase()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Overview */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Live Market Overview</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {chartLoading && !marketStats ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-card/50 px-4 py-2.5 h-[58px]">
                      <Skeleton className="h-2 w-12 rounded mt-1 opacity-40" />
                      <Skeleton className="h-4 w-20 rounded mt-2" />
                    </div>
                  ))
                ) : (
                  <>
                    <div className={cn("rounded-2xl border border-border bg-card/50 px-4 py-2.5 space-y-0.5 transition-opacity", chartLoading && "opacity-50")}>
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Price</span>
                      <div className="text-base font-black tracking-tight">
                        {formatCurrency(marketStats?.price)}
                      </div>
                    </div>
                    <div className={cn("rounded-2xl border border-border bg-card/50 px-4 py-2.5 space-y-0.5 transition-opacity", chartLoading && "opacity-50")}>
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">{timeRange} Change</span>
                      {(() => {
                        const displayVal =
                          timeRange === "24H" ? marketStats?.change24h :
                            timeRange === "7D" ? marketStats?.change7d :
                              timeRange === "1M" ? marketStats?.change30d :
                                timeRange === "1Y" ? marketStats?.change1y :
                                  marketStats?.rangeChange; // Fallback to calculation for 3M/MAX

                        const isFinite = Number.isFinite(displayVal);
                        return (
                          <div className={`text-base font-black tracking-tight ${isFinite ? ((displayVal ?? 0) >= 0 ? "text-green-500" : "text-red-500") : "text-muted-foreground"}`}>
                            {isFinite ? (
                              <>{((displayVal ?? 0) >= 0 ? "+" : "")}{displayVal?.toFixed(2)}%</>
                            ) : "—"}
                          </div>
                        );
                      })()}
                    </div>
                    <div className={cn("rounded-2xl border border-border bg-card/50 px-4 py-2.5 space-y-0.5 transition-opacity", chartLoading && "opacity-50")}>
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">24H Volume</span>
                      <div className="text-base font-black tracking-tight truncate">
                        {formatCompactCurrency(marketStats?.volume)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Tabs & Content */}
            <div className="space-y-5">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <TabsList className="bg-muted/30 border border-border p-1 h-auto">
                    <TabsTrigger
                      value="price"
                      className="px-4 py-2 text-[10px] font-black uppercase rounded-lg data-[state=active]:bg-foreground data-[state=active]:text-background transition-all"
                    >
                      Price & Volume
                    </TabsTrigger>
                    <TabsTrigger
                      value="prediction"
                      className="px-4 py-2 text-[10px] font-black uppercase rounded-lg data-[state=active]:bg-foreground data-[state=active]:text-background transition-all flex items-center gap-1.5"
                    >
                      <CircleDot className="size-3" /> Prediction
                    </TabsTrigger>
                  </TabsList>

                  {activeTab === "price" && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5 rounded-xl bg-muted/30 border border-border p-0.5">
                        {TIME_RANGES.map((range) => (
                          <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={cn(
                              "px-2.5 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all",
                              timeRange === range ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 bg-muted/30 border-border hover:bg-muted/50 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                            {chartMode}
                            <ChevronDown className="ml-1 size-3 opacity-70" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[140px] bg-popover border-border">
                          {(["price", "volume", "both"] as const).map((mode) => (
                            <DropdownMenuItem
                              key={mode}
                              onClick={() => setChartMode(mode)}
                              className="flex items-center justify-between text-[10px] font-bold py-2 cursor-pointer"
                            >
                              <span className="uppercase">{mode}</span>
                              {chartMode === mode ? <Check className="size-3 text-primary" /> : null}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {activeTab === "price" ? (
                  <div className="space-y-6">
                    {/* Chart Section */}
                    <div className="h-[280px] sm:h-[340px] w-full px-0 sm:px-2 py-2 sm:py-4 relative overflow-hidden flex items-center justify-center border-none bg-transparent">
                      {chartLoading && chartData.length === 0 ? (
                        // skeleton
                        <div className="w-full h-full flex flex-col gap-4">
                          <div className="flex justify-between items-end gap-2 flex-1">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <Skeleton
                                key={i}
                                className="w-full bg-muted/40"
                                style={{ height: `${20 + Math.random() * 60}%` }}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between">
                            <Skeleton className="h-3 w-16 opacity-30" />
                            <Skeleton className="h-3 w-16 opacity-30" />
                            <Skeleton className="h-3 w-16 opacity-30" />
                          </div>
                          {/* spin animation */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <RefreshCw className="size-6 animate-spin text-muted-foreground/20" />
                          </div>
                        </div>
                      ) : hasChartData ? (
                        // chart params
                        <div className={cn("w-full h-full transition-opacity", chartLoading && "opacity-30")}>
                          <AssetDetailChart
                            data={chartData}
                            config={chartConfig}
                            trend={isNegative ? "down" : "up"}
                            currentPrice={marketStats?.price || 0}
                            mode={chartMode}
                            formatCurrency={formatCurrency}
                            formatCompactCurrency={formatCompactCurrency}
                          />
                        </div>
                      ) : (
                        // No market data
                        <div className="flex h-full items-center justify-center">
                          <div className="text-center">
                            <p className="text-sm font-bold text-muted-foreground">No market data available</p>
                            <p className="mt-1 text-xs text-muted-foreground/70">
                              Try a different asset or time range.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Performance Metrics Table */}
                    <div className="space-y-3">
                      <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 px-1">Price Performance</h3>
                      <div className="rounded-2xl border border-border/50 bg-card/30 overflow-hidden backdrop-blur-md shadow-2xl shadow-primary/5">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent border-b border-border/50 bg-muted/20">
                              {["1h", "24h", "7d", "14d", "30d", "1y"].map((t) => (
                                <TableHead key={t} className="h-auto py-2 px-1 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 border-r last:border-r-0 border-border/20">
                                  {t}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="hover:bg-transparent border-none">
                              {[
                                { label: "1h", value: marketStats?.change1h },
                                { label: "24h", value: marketStats?.change24h },
                                { label: "7d", value: marketStats?.change7d },
                                { label: "14d", value: marketStats?.change14d },
                                { label: "30d", value: marketStats?.change30d },
                                { label: "1y", value: marketStats?.change1y },
                              ].map((item, i) => (
                                <TableCell key={i} className={cn(
                                  "py-4 px-1 text-center border-r last:border-r-0 border-border/20",
                                  (item.value ?? 0) >= 0 ? "bg-green-500/[0.02]" : "bg-red-500/[0.02]"
                                )}>
                                  <div className={cn(
                                    "flex items-center justify-center gap-1 text-[11px] font-black tabular-nums",
                                    !Number.isFinite(item.value) ? "text-muted-foreground" : ((item.value ?? 0) >= 0 ? "text-green-500" : "text-red-500")
                                  )}>
                                    {Number.isFinite(item.value) ? (
                                      <>
                                        {((item.value ?? 0) >= 0 ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />)}
                                        {((item.value ?? 0) >= 0 ? "+" : "")}{item.value?.toFixed(2)}%
                                      </>
                                    ) : (
                                      <span className="opacity-20">—</span>
                                    )}
                                  </div>
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                ) :
                  // TODO : prediction model's info later to be done
                  (
                    <div className="rounded-2xl border border-border bg-card/50 p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Activity className="size-3 text-primary" />
                            <h4 className="text-sm font-black tracking-tight">Tauron {predictionModel?.model_type || "LSTM"} Model</h4>
                            <Badge className="bg-primary/20 text-primary text-[8px] font-black py-0 px-1.5 border-none">Active</Badge>
                          </div>
                          <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Powered by {predictionModel?.version_tag || "v1.2.4-stable"}</p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 bg-muted/30 border-border hover:bg-muted/50 rounded-lg gap-2 text-foreground">
                              <span className="text-[9px] font-black uppercase tracking-wider">
                                {predictionModel ? `${predictionModel.model_type} (${predictionModel.version_tag})` : "LSTM (v1.2.4-stable)"}
                              </span>
                              <Star className="size-2.5 fill-current" />
                              <ChevronDown className="size-2.5 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[200px] bg-popover border-border">
                            {availableModels.map((model) => (
                              <DropdownMenuItem
                                key={model.id}
                                onClick={() => setPredictionModel(model)}
                                className="flex items-center justify-between text-[10px] font-bold py-2 focus:bg-white/5 cursor-pointer"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="uppercase tracking-tight text-foreground">{model.model_type} ({model.version_tag})</span>
                                  {model.version_tag.includes("beta") && <span className="text-[8px] text-yellow-500 uppercase font-black">BETA</span>}
                                </div>
                                {predictionModel?.id === model.id && <Check className="size-3 text-primary" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="bg-card/30 border-border/50 shadow-sm">
                          <CardContent className="p-4 space-y-1">
                            <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Model R² Score</span>
                            <div className="flex items-center gap-1.5 text-xl font-black text-green-500">
                              <TrendingUp className="size-4" />
                              0.89
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-card/30 border-border/50 shadow-sm">
                          <CardContent className="p-4 space-y-1">
                            <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">RMSE Error</span>
                            <div className="text-xl font-black text-foreground">
                              0.0245
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-primary">
                          <div className="size-1.5 rounded-full bg-primary animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Real-time prediction ready.</span>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground leading-relaxed italic">
                          LSTM ensemble shows strong accumulation patterns. Next resistance +3.2%.
                        </p>
                      </div>
                    </div>
                  )}
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}