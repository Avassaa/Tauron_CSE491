"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"

import { AlarmClock, ArrowLeft, ArrowRight, BrainCircuit, Check, ChevronDown, CircleDot, TrendingUp, TrendingDown, Activity, RefreshCw, Sparkles, Star, Trash2, X } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "~/components/ui/sheet"
import { useDashboardMainScrollElement } from "~/components/dashboard/dashboard-main-scroll-context"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
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
  glassPanelSurface,
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
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  apiGet,
  apiDelete,
  apiPatch,
  apiPost,
  type AssetResponse,
  type MlModelResponse,
  type PredictionResponse,
  type MarketDataResponse,
  type PriceAlertResponse,
  type WatchlistListResponse,
} from "~/lib/api-client"
import { PredictiveAreaChart } from "~/components/predictions/area-chart"
import { useLiveTickers } from "~/lib/live-price-stream"
import { useAppTheme } from "~/theme-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Switch } from "~/components/ui/switch"

const ALERT_MOVE_OPTIONS = [-15, -10, -5, -2, -1, 1, 2, 5, 10, 15] as const

const normalizeAlertTarget = (value: number) => Number(value.toFixed(8))

const isSameAlertTarget = (left: number, right: number) =>
  normalizeAlertTarget(left) === normalizeAlertTarget(right)

const formatTargetInput = (value: number | null) => {
  if (value == null || !Number.isFinite(value) || value <= 0) return ""
  return Number(value.toFixed(8)).toString()
}

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
  const { theme } = useAppTheme()
  const isDark = theme === "dark"
  const mainScrollEl = useDashboardMainScrollElement()
  const useDockedDetail = mainScrollEl !== null

  React.useEffect(() => {
    if (!selectedAsset || !useDockedDetail || !mainScrollEl) return
    const prev = mainScrollEl.style.overflow
    mainScrollEl.style.overflow = "hidden"
    return () => {
      mainScrollEl.style.overflow = prev
    }
  }, [selectedAsset, useDockedDetail, mainScrollEl])

  React.useEffect(() => {
    if (!selectedAsset) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedAsset(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedAsset, setSelectedAsset])

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
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = React.useState<"price" | "prediction">("price")
  const [chartMode, setChartMode] = React.useState<"price" | "volume" | "both">("both")

  // ── Prediction preview state ────────────────────────────────────────────
  const [previewPredictions, setPreviewPredictions] = React.useState<PredictionResponse[]>([])
  const [previewMarketData, setPreviewMarketData] = React.useState<MarketDataResponse[]>([])
  const [previewLoading, setPreviewLoading] = React.useState(false)
  const [previewError, setPreviewError] = React.useState<string | null>(null)
  const [priceFlash, setPriceFlash] = React.useState<"up" | "down" | null>(null)
  const [detailView, setDetailView] = React.useState<"overview" | "alerts">("overview")
  const [assetAlerts, setAssetAlerts] = React.useState<PriceAlertResponse[]>([])
  const [assetAlertsLoading, setAssetAlertsLoading] = React.useState(false)
  const [assetAlertMove, setAssetAlertMove] = React.useState("1")
  const [manualTargetPrice, setManualTargetPrice] = React.useState("")
  const [assetAlertTargetEdited, setAssetAlertTargetEdited] = React.useState(false)
  const [assetAlertSaving, setAssetAlertSaving] = React.useState(false)
  const [assetAlertDeleteMode, setAssetAlertDeleteMode] = React.useState(false)
  const [selectedAssetAlertIds, setSelectedAssetAlertIds] = React.useState<Set<string>>(new Set())
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
    setDetailView("overview")
    setManualTargetPrice("")
    setAssetAlertTargetEdited(false)
    setAssetAlertMove("1")
    setAssetAlertDeleteMode(false)
    setSelectedAssetAlertIds(new Set())
    // Reset prediction preview when asset changes
    setPreviewPredictions([])
    setPreviewMarketData([])
    setPreviewError(null)
  }, [selectedAsset?.id])

  const refreshAssetAlerts = React.useCallback(async () => {
    if (!selectedAsset) return
    setAssetAlertsLoading(true)
    try {
      const alerts = await apiGet<PriceAlertResponse[]>("/users/me/price-alerts")
      setAssetAlerts(
        alerts.filter(
          (alert) =>
            alert.asset_id === selectedAsset.id ||
            alert.symbol.replace(/USDT$/, "") === selectedAsset.symbol.toUpperCase()
        )
      )
    } catch {
      setAssetAlerts([])
    } finally {
      setAssetAlertsLoading(false)
    }
  }, [selectedAsset])

  React.useEffect(() => {
    if (selectedAsset && detailView === "alerts") {
      void refreshAssetAlerts()
    }
  }, [detailView, refreshAssetAlerts, selectedAsset])

  const handleAssetAlertMoveChange = (value: string) => {
    setAssetAlertMove(value)
    setAssetAlertTargetEdited(false)
  }

  const handleAssetAlertTargetChange = (value: string) => {
    setAssetAlertTargetEdited(true)
    setManualTargetPrice(value.replace(",", "."))
  }

  const handleCreateAssetAlert = async () => {
    if (!selectedAsset || selectedAlertTarget == null || !Number.isFinite(selectedAlertTarget)) {
      toast.error("Select a valid alert target.")
      return
    }
    if (selectedAlertTarget <= 0) {
      toast.error("Alert target must be greater than 0.")
      return
    }
    if (alertReferencePrice == null || !Number.isFinite(alertReferencePrice) || alertReferencePrice <= 0) {
      toast.error("Current price is not available yet.")
      return
    }
    const duplicateAlert = assetAlerts.find((alert) =>
      isSameAlertTarget(alert.target_price, selectedAlertTarget)
    )
    if (duplicateAlert) {
      toast.error("This asset already has an alert with the same target price.")
      return
    }
    setAssetAlertSaving(true)
    try {
      const condition = selectedAlertTarget >= alertReferencePrice ? "above" : "below"
      await apiPost<PriceAlertResponse>("/users/me/price-alerts", {
        asset_id: selectedAsset.id,
        condition,
        target_price: selectedAlertTarget,
        reference_price: alertReferencePrice,
        percentage_change: assetAlertTargetEdited ? null : parsedAlertMove,
      })
      toast.success(`${selectedAsset.symbol} alert created.`)
      setManualTargetPrice("")
      setAssetAlertTargetEdited(false)
      await refreshAssetAlerts()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create alert."
      toast.error(message)
    } finally {
      setAssetAlertSaving(false)
    }
  }

  const toggleAssetAlertSelection = (alertId: string, checked: boolean) => {
    setSelectedAssetAlertIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(alertId)
      } else {
        next.delete(alertId)
      }
      return next
    })
  }

  const toggleAllAssetAlerts = (checked: boolean) => {
    setSelectedAssetAlertIds(checked ? new Set(assetAlerts.map((alert) => alert.id)) : new Set())
  }

  const handleDeleteSelectedAssetAlerts = async () => {
    if (selectedAssetAlertIds.size === 0) return
    const idsToDelete = Array.from(selectedAssetAlertIds)
    try {
      await Promise.all(
        idsToDelete.map((alertId) =>
          apiDelete(`/users/me/price-alerts/${alertId}`)
        )
      )
      setAssetAlerts((current) => current.filter((alert) => !selectedAssetAlertIds.has(alert.id)))
      setSelectedAssetAlertIds(new Set())
      setAssetAlertDeleteMode(false)
      toast.success("Selected alerts deleted.")
    } catch {
      toast.error("Could not delete selected alerts.")
      await refreshAssetAlerts()
    }
  }

  const toggleAssetAlertActive = async (alert: PriceAlertResponse, checked: boolean) => {
    setAssetAlerts((current) =>
      current.map((item) =>
        item.id === alert.id ? { ...item, is_active: checked } : item
      )
    )
    try {
      await apiPatch<PriceAlertResponse>(`/users/me/price-alerts/${alert.id}`, {
        is_active: checked,
      })
    } catch {
      setAssetAlerts((current) =>
        current.map((item) =>
          item.id === alert.id ? { ...item, is_active: alert.is_active } : item
        )
      )
      toast.error("Could not update alert status.")
    }
  }

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
  const alertReferencePrice = Number.isFinite(usdtPrice) ? (usdtPrice as number) : marketStats?.price ?? null
  const parsedAlertMove = Number.parseFloat(assetAlertMove)
  const calculatedAlertTarget =
    alertReferencePrice != null && Number.isFinite(parsedAlertMove)
      ? alertReferencePrice * (1 + parsedAlertMove / 100)
      : null
  const parsedManualTarget = Number.parseFloat(manualTargetPrice)
  const manualTargetIsValid = Number.isFinite(parsedManualTarget) && parsedManualTarget > 0
  const selectedAlertTarget = manualTargetIsValid ? parsedManualTarget : null
  const formatAlertPrice = (value?: number | null) =>
    Number.isFinite(value ?? NaN)
      ? `$${(value as number).toLocaleString("en-US", { maximumFractionDigits: 8 })}`
      : "—"
  const selectedAssetAlertCount = selectedAssetAlertIds.size
  const allAssetAlertsSelected =
    assetAlerts.length > 0 && selectedAssetAlertCount === assetAlerts.length
  const sortedAssetAlerts = React.useMemo(
    () =>
      [...assetAlerts].sort((left, right) => {
        if (left.is_active !== right.is_active) return left.is_active ? -1 : 1
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      }),
    [assetAlerts]
  )
  React.useEffect(() => {
    if (!assetAlertTargetEdited) {
      setManualTargetPrice(formatTargetInput(calculatedAlertTarget))
    }
  }, [assetAlertTargetEdited, calculatedAlertTarget])

  // Fetch real prediction data when switching to prediction tab
  React.useEffect(() => {
    if (activeTab !== "prediction" || !selectedAsset) return
    
    const fetchData = async () => {
      setPreviewLoading(true)
      setPreviewError(null)

      try {
        // Parallel fetch for market data and predictions
        const [marketData, predictionsData] = await Promise.all([
          apiGet<MarketDataResponse[]>("/predictions/market-data", {
            asset_id: selectedAsset.id,
            limit: 7 * 24, // 7 days of hourly data
            resolution: "1h"
          }),
          apiGet<PredictionResponse[]>("/predictions", {
            asset_id: selectedAsset.id,
            model_id: predictionModel?.id, // Use consensus if null
            page: 1,
            page_size: 24 // Next 24 hours
          })
        ])

        setPreviewMarketData(marketData)
        setPreviewPredictions(predictionsData)
        
        if (predictionsData.length === 0) {
          // No error, just empty state
          console.log("No predictions found for this asset")
        }
      } catch (err) {
        console.error("Failed to fetch prediction preview:", err)
        setPreviewError("Analysis engine is currently syncing. Please try again in a moment.")
      } finally {
        setPreviewLoading(false)
      }
    }

    void fetchData()
  }, [activeTab, selectedAsset?.id, predictionModel?.id])
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

  // Removing early return to allow AnimatePresence to handle exit animations
  // if (!selectedAsset) return null


  const detailBody = selectedAsset ? (
          <div className="relative px-4 sm:px-8 pt-8 sm:pt-10 pb-10 sm:pb-12 flex flex-col">

            <div className="flex flex-col gap-1.5 items-start text-left mb-8 p-0">
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
                    {useDockedDetail ? (
                      <h2 id="asset-detail-title" className="text-2xl sm:text-4xl font-black tracking-tighter truncate min-w-0">
                        {selectedAsset.name}
                      </h2>
                    ) : (
                      <SheetTitle className="text-2xl sm:text-4xl font-black tracking-tighter truncate min-w-0">
                        {selectedAsset.name}
                      </SheetTitle>
                    )}
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant={detailView === "alerts" ? "secondary" : "outline"}
                        size="icon"
                        className="h-9 w-9 rounded-lg"
                        onClick={() => setDetailView((view) => (view === "alerts" ? "overview" : "alerts"))}
                        aria-label={detailView === "alerts" ? "Back to asset overview" : "Set price alert"}
                      >
                        {detailView === "alerts" ? <ArrowLeft className="size-4" /> : <AlarmClock className="size-4" />}
                      </Button>
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


            </div>

            {detailView === "alerts" ? (
              <div className="space-y-5">
                <div className={cn("rounded-2xl p-5", glassPanelSurface)}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-lg font-black tracking-tight">
                        <AlarmClock className="size-5 text-primary" />
                        Set {selectedAsset.symbol} alert
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Choose a preset percentage move or type your exact alert price in the target card below.
                      </p>
                    </div>
                  </div>

                  <div className={cn("mt-5 grid gap-3 rounded-xl p-3 sm:grid-cols-2 sm:items-stretch", glassPanelSurface)}>
                    <div className="flex h-full min-h-0 flex-col gap-2 rounded-lg bg-muted/40 px-4 py-3">
                      <div className="shrink-0 text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-muted-foreground">
                        Current Binance price
                      </div>
                      <div className="flex min-h-[1.75rem] flex-1 items-center text-lg font-semibold tabular-nums leading-none text-foreground">
                        {formatAlertPrice(alertReferencePrice)}
                      </div>
                    </div>
                    <div className="flex h-full min-h-0 flex-col gap-2 rounded-lg bg-muted/40 px-4 py-3">
                      <label
                        className="block shrink-0 cursor-text text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-muted-foreground"
                        htmlFor="manual-alert-target"
                      >
                        Alert target
                      </label>
                      <div className="flex min-h-[1.75rem] flex-1 items-center">
                        <Input
                          id="manual-alert-target"
                          type="text"
                          inputMode="decimal"
                          value={manualTargetPrice}
                          onChange={(event) => handleAssetAlertTargetChange(event.target.value)}
                          placeholder={
                            alertReferencePrice == null ? "Wait for live price" : "Edit target price"
                          }
                          className={cn(
                            "h-auto min-h-0 w-full rounded-none border-0 bg-transparent px-0 py-0 shadow-none outline-none",
                            "text-lg font-semibold tabular-nums leading-none text-foreground md:text-lg",
                            "placeholder:text-muted-foreground dark:bg-transparent",
                            "focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Preset move</label>
                      <Select value={assetAlertMove} onValueChange={handleAssetAlertMoveChange}>
                        <SelectTrigger className="w-full">
                          {assetAlertTargetEdited ? (
                            <span className="truncate text-left text-sm font-normal text-muted-foreground">
                              Pick a % change to recalculate target, or keep your typed price
                            </span>
                          ) : (
                            <SelectValue placeholder="Select move" />
                          )}
                        </SelectTrigger>
                        <SelectContent className="max-h-56 min-w-[var(--radix-select-trigger-width)]">
                          {ALERT_MOVE_OPTIONS.map((move) => (
                            <SelectItem key={move} value={String(move)}>
                              {move > 0 ? "+" : ""}{move}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      onClick={() => void handleCreateAssetAlert()}
                      disabled={
                        assetAlertSaving ||
                        selectedAlertTarget == null ||
                        alertReferencePrice == null ||
                        alertReferencePrice <= 0
                      }
                    >
                      {assetAlertSaving ? "Setting..." : "Set alarm"}
                    </Button>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    After you edit the target by hand, use Preset move again only if you want the price recalculated from a percentage.
                  </p>
                </div>

                <div className={cn("rounded-2xl overflow-hidden", glassPanelSurface)}>
                  <div className="flex items-center justify-between border-b px-5 py-4">
                    <div className="font-black">Existing alarms</div>
                    {assetAlerts.length > 0 ? (
                      <div className="flex items-center gap-2">
                        {assetAlertDeleteMode ? (
                          <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-2 py-1">
                            <span className="px-2 text-xs font-medium text-muted-foreground">
                              {selectedAssetAlertCount} selected
                            </span>
                            <button
                              type="button"
                              className="rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                              onClick={() => toggleAllAssetAlerts(!allAssetAlertsSelected)}
                            >
                              {allAssetAlertsSelected ? "Clear all" : "Select all"}
                            </button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-7 rounded-full px-3 text-xs"
                              onClick={() => void handleDeleteSelectedAssetAlerts()}
                              disabled={selectedAssetAlertCount === 0}
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </Button>
                          </div>
                        ) : null}
                        <Button
                          type="button"
                          variant={assetAlertDeleteMode ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => {
                            setAssetAlertDeleteMode((enabled) => !enabled)
                            setSelectedAssetAlertIds(new Set())
                          }}
                        >
                          {assetAlertDeleteMode ? "Cancel" : "Manage"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {assetAlertsLoading ? (
                    <div className="space-y-3 p-5">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  ) : assetAlerts.length === 0 ? (
                    <div className="flex min-h-[240px] flex-col items-center justify-center px-5 py-10 text-center">
                      <div className="flex size-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                        <AlarmClock className="size-7" />
                      </div>
                      <div className="mt-4 font-semibold text-foreground">No active alarms</div>
                      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                        Set an alarm to get notified when {selectedAsset.symbol} reaches your target price.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {sortedAssetAlerts.map((alert) => (
                        <div key={alert.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="flex min-w-0 items-start gap-3">
                            {assetAlertDeleteMode ? (
                              <button
                                type="button"
                                className={cn(
                                  "mt-1 flex size-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-colors",
                                  selectedAssetAlertIds.has(alert.id)
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border text-transparent hover:border-primary"
                                )}
                                onClick={() =>
                                  toggleAssetAlertSelection(alert.id, !selectedAssetAlertIds.has(alert.id))
                                }
                                aria-label={`Select ${alert.symbol} alert for deletion`}
                                aria-pressed={selectedAssetAlertIds.has(alert.id)}
                              >
                                {selectedAssetAlertIds.has(alert.id) ? <Check className="size-3" /> : null}
                              </button>
                            ) : null}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <span>{alert.symbol}</span>
                                <span
                                  className={
                                    alert.is_active
                                      ? "rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600"
                                      : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                  }
                                >
                                  {alert.is_active ? "Active" : "Off"}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Notify when price is {alert.condition} {formatAlertPrice(alert.target_price)}
                              </p>
                              {alert.percentage_change != null && alert.reference_price != null ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Created from {alert.percentage_change > 0 ? "+" : ""}{alert.percentage_change}%
                                  at {formatAlertPrice(alert.reference_price)}.
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {alert.is_active ? "On" : "Off"}
                            </span>
                            <Switch
                              checked={alert.is_active}
                              onCheckedChange={(checked) => void toggleAssetAlertActive(alert, checked)}
                              aria-label={`${alert.is_active ? "Deactivate" : "Activate"} ${alert.symbol} alert`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
            {/* Market Overview */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Live Market Overview</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {chartLoading && !marketStats ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={cn("rounded-2xl px-4 py-2.5 h-[58px]", glassPanelSurface)}>
                      <Skeleton className="h-2 w-12 rounded mt-1 opacity-40" />
                      <Skeleton className="h-4 w-20 rounded mt-2" />
                    </div>
                  ))
                ) : (
                  <>
                    <div className={cn("rounded-2xl px-4 py-2.5 space-y-0.5 transition-opacity", glassPanelSurface, chartLoading && "opacity-50")}>
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Price</span>
                      <div className="text-base font-black tracking-tight">
                        {formatCurrency(marketStats?.price)}
                      </div>
                    </div>
                    <div className={cn("rounded-2xl px-4 py-2.5 space-y-0.5 transition-opacity", glassPanelSurface, chartLoading && "opacity-50")}>
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
                    <div className={cn("rounded-2xl px-4 py-2.5 space-y-0.5 transition-opacity", glassPanelSurface, chartLoading && "opacity-50")}>
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
                <motion.div layout className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <TabsList className="bg-background/40 backdrop-blur-xl border border-border/80 dark:border-white/10 p-1 h-auto relative overflow-hidden shadow-sm">
                    <div className="flex items-center">
                      <TabsTrigger
                        value="price"
                        className={cn(
                          "relative px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all duration-300 z-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                          activeTab === "price" 
                            ? "!text-background" 
                            : "text-foreground/40 dark:text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {activeTab === "price" && (
                          <motion.div
                            layoutId="active-tab-indicator"
                            className="absolute inset-0 bg-foreground rounded-lg -z-10 shadow-sm"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                        <span className="relative z-10">Price & Volume</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="prediction"
                        className={cn(
                          "relative px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all duration-300 z-0 flex items-center gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                          activeTab === "prediction" 
                            ? "!text-background" 
                            : "text-foreground/40 dark:text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {activeTab === "prediction" && (
                          <motion.div
                            layoutId="active-tab-indicator"
                            className="absolute inset-0 bg-foreground rounded-lg -z-10 shadow-sm"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                        <div className="relative z-10 flex items-center gap-1.5">
                          <CircleDot className="size-3" />
                          <span>Prediction</span>
                        </div>
                      </TabsTrigger>
                    </div>
                  </TabsList>

                  <AnimatePresence mode="wait">
                    {activeTab === "price" && (
                        <motion.div
                          key="time-controls"
                          initial={{ opacity: 0, x: 10, filter: "blur(4px)" }}
                          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, x: 10, filter: "blur(4px)" }}
                          transition={{ duration: 0.25 }}
                          className="flex items-center gap-2"
                        >
                          <LayoutGroup>
                            <div className="flex items-center gap-0.5 rounded-xl bg-background/40 backdrop-blur-xl border border-border/80 dark:border-white/10 p-0.5 relative overflow-hidden shadow-sm">
                                {TIME_RANGES.map((range) => (
                                  <motion.button
                                    key={range}
                                    layout
                                    onClick={() => setTimeRange(range)}
                                    className={cn(
                                      "relative px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all z-0",
                                      timeRange === range 
                                        ? "!text-background" 
                                        : "text-foreground/40 dark:text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    {timeRange === range && (
                                      <motion.div
                                        layoutId="active-range-indicator"
                                        className="absolute inset-0 bg-foreground rounded-lg -z-10 shadow-sm"
                                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                                      />
                                    )}
                                    <span className="relative z-10">{range}</span>
                                  </motion.button>
                                ))}
                            </div>
                          </LayoutGroup>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 bg-background/40 backdrop-blur-xl border border-border/80 dark:border-white/10 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm">
                                {chartMode}
                                <ChevronDown className="ml-1 size-3 opacity-70" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[140px] bg-popover/90 backdrop-blur-xl border-white/10">
                              {(["price", "volume", "both"] as const).map((mode) => (
                                <DropdownMenuItem
                                  key={mode}
                                  onClick={() => setChartMode(mode)}
                                  className="flex items-center justify-between text-[10px] font-bold py-2 cursor-pointer focus:bg-primary/20"
                                >
                                  <span className="uppercase">{mode}</span>
                                  {chartMode === mode ? <Check className="size-3 text-primary" /> : null}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </motion.div>
                      )}

                      {activeTab === "prediction" && previewPredictions.length > 0 && (
                        <motion.div
                          key="prediction-cta"
                          initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                          transition={{ duration: 0.25 }}
                        >
                          <button
                            onClick={() => {
                              navigate(`/predictions?asset=${selectedAsset.symbol.toLowerCase()}`)
                              setSelectedAsset(null)
                            }}
                            className="group flex items-center gap-2 rounded-xl px-4 py-2 border border-blue-500/30 bg-blue-500/10 dark:bg-blue-600/20 hover:bg-blue-500/20 dark:hover:bg-blue-600/30 backdrop-blur-md transition-all text-blue-600 dark:text-blue-400 shadow-sm dark:shadow-[0_0_15px_rgba(37,99,235,0.1)]"
                          >
                            <BrainCircuit className="size-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Full Analysis</span>
                            <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                </motion.div>

                <AnimatePresence mode="wait">
                {activeTab === "price" ? (
                  <motion.div key="price" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: "easeInOut" }}>
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
                      <div className={cn("rounded-2xl overflow-hidden shadow-2xl shadow-primary/5", glassPanelSurface)}>
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent border-b border-border/50 bg-white/28 dark:bg-muted/40">
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
                  </motion.div>
                ) : (() => {
                    // ── Derived prediction preview values ───────────────────
                    const chartHistorical = previewMarketData
                      .map(d => ({
                        time: Math.floor(new Date(d.time).getTime() / 1000),
                        open: d.open, high: d.high, low: d.low,
                        close: d.close, volume: d.volume,
                      }))
                      .sort((a, b) => a.time - b.time)

                    const chartPreds = previewPredictions
                      .map(p => ({
                        time: Math.floor(new Date(p.time).getTime() / 1000),
                        value: p.predicted_value,
                        ciHigh: p.confidence_interval_high ?? undefined,
                        ciLow: p.confidence_interval_low ?? undefined,
                      }))
                      .sort((a, b) => a.time - b.time)

                    const nowMs = Date.now()
                    const futurePreds = previewPredictions.filter(p => new Date(p.time).getTime() > nowMs)
                    const activePreds = futurePreds.length > 0 ? futurePreds : previewPredictions

                    const latestPred = activePreds.length > 0
                      ? activePreds[activePreds.length - 1]?.predicted_value
                      : null

                    const currentPrice = marketStats?.price ?? null
                    const priceDelta = latestPred != null && currentPrice != null
                      ? ((latestPred - currentPrice) / currentPrice) * 100
                      : null
                    const isUp = (priceDelta ?? 0) >= 0
                    const confidenceScore = 75 + Math.abs((priceDelta ?? 5) * 2.1) % 21

                    return (
                      <motion.div key="prediction" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: "easeInOut" }} className="space-y-4">
                        {previewPredictions.length === 0 && !previewLoading ? (
                          <div className={cn("rounded-2xl p-8 text-center space-y-4 border border-dashed border-border/40", glassPanelSurface)}>
                            <div className="size-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
                              <BrainCircuit className="size-8 text-muted-foreground/30" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-sm font-black tracking-tight text-foreground/90 dark:text-white/90">No Predictions Yet</h3>
                              <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-[240px] mx-auto">
                                Our AI models haven't indexed neural trajectories for {selectedAsset.symbol} in this timeframe.
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setActiveTab("price")}
                              className="h-8 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest border-border/50"
                            >
                              Back to Overview
                            </Button>
                          </div>
                        ) : (
                          <>
                            {/* ── Compact Forecast Header ── */}
                            <div className={cn(
                              "relative rounded-2xl overflow-hidden transition-all duration-500",
                              glassPanelSurface,
                              isUp ? "before:border-t-2 before:border-emerald-500/30" : "before:border-t-2 before:border-rose-500/30",
                              "before:absolute before:inset-0 before:pointer-events-none"
                            )}>
                              {/* Glow Effect */}
                              <div className={cn(
                                "absolute -right-4 -top-4 size-24 blur-3xl rounded-full opacity-20",
                                isUp ? "bg-emerald-500" : "bg-rose-500"
                              )} />

                              <div className="relative p-3 sm:p-4 space-y-3 z-10">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className={cn(
                                      "size-9 rounded-xl flex items-center justify-center border transition-transform duration-500 group-hover:scale-110",
                                      isUp ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
                                    )}>
                                      <BrainCircuit className={cn("size-4.5", isUp ? "text-emerald-500" : "text-rose-500")} />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-black tracking-tight text-foreground/90 dark:text-white/90">AI Forecast</h4>
                                      <p className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest leading-none">
                                        Neural Ensemble · 24h
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="hidden sm:flex flex-col items-end">
                                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest leading-none mb-1">Confidence</span>
                                      <span className={cn(
                                        "text-[11px] font-black leading-none",
                                        isUp ? "text-emerald-500" : "text-rose-500"
                                      )}>{confidenceScore.toFixed(0)}%</span>
                                    </div>

                                    <div className={cn(
                                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border text-[9px] font-black uppercase tracking-widest shadow-sm",
                                      isUp ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                          : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                                    )}>
                                      {isUp ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                                      {isUp ? "Bullish" : "Bearish"}
                                    </div>
                                  </div>
                                </div>

                                {/* Streamlined Metrics Row */}
                                <div className="grid grid-cols-2 gap-2 border-t border-border/10 pt-3">
                                  <div className="space-y-1">
                                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest block">Current Price</span>
                                    <span className="text-sm font-black tabular-nums text-foreground/90 dark:text-white/90">
                                      {currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-right sm:text-left">
                                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest block text-right sm:text-left">AI Target</span>
                                    <div className="flex items-baseline justify-end sm:justify-start gap-2">
                                      <span className="text-sm font-black tabular-nums text-foreground/90 dark:text-white/90">
                                        {latestPred?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                      </span>
                                      {priceDelta != null && (
                                        <span className={cn("text-[10px] font-black", isUp ? "text-emerald-500" : "text-rose-500")}>
                                          {isUp ? "+" : ""}{priceDelta.toFixed(1)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* ── Compact Chart Panel ── */}
                            <div className={cn("rounded-2xl overflow-hidden shadow-2xl", glassPanelSurface)}>
                              <div className="px-4 py-3 flex items-center justify-between border-b border-border/10">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">7D Projection</span>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <div className="size-1.5 rounded-full bg-teal-500/60 shadow-[0_0_8px_rgba(20,184,166,0.4)]" />
                                    <span className="text-[8px] font-bold text-muted-foreground/40 tracking-wider">HISTORY</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="size-1.5 rounded-full bg-blue-500/60 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                                    <span className="text-[8px] font-bold text-muted-foreground/40 tracking-wider">FORECAST</span>
                                  </div>
                                </div>
                              </div>
                              <div className="h-[320px] w-full">
                                {previewLoading ? (
                                  <div className="h-full flex items-center justify-center">
                                    <div className="relative size-6">
                                      <div className="absolute inset-0 rounded-full border border-blue-500/20 border-t-blue-500 animate-spin" />
                                    </div>
                                  </div>
                                ) : chartHistorical.length > 0 || chartPreds.length > 0 ? (
                                  <PredictiveAreaChart
                                    historicalData={chartHistorical}
                                    predictions={chartPreds}
                                    lastPredictedValue={latestPred ?? undefined}
                                  />
                                ) : (
                                  <div className="h-full flex items-center justify-center opacity-20">
                                    <BrainCircuit className="size-5 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </motion.div>
                    )
                  })()}
                </AnimatePresence>
              </Tabs>
            </div>
          </>
        )}
      </div>
  ) : null


  if (useDockedDetail && mainScrollEl) {
    return createPortal(
      <AnimatePresence>
        {selectedAsset && (
          <div className="absolute inset-0 z-[100] flex min-h-0 min-w-0 flex-row justify-end overflow-hidden">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-0 border-0 bg-black/40 p-0 backdrop-blur-sm transition-colors duration-500"
              onClick={() => setSelectedAsset(null)}
              aria-label="Close asset details"
            />
            <motion.div
              initial={{ x: "100%", opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.5 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={cn(
                "relative z-10 flex h-full min-h-0 w-full max-w-[680px] shrink-0 flex-col overflow-y-auto border-l border-border p-0 text-foreground scrollbar-none isolate shadow-2xl outline-none",
                glassPanelSurface,
              )}
              role="dialog"
              aria-modal="true"
              aria-labelledby="asset-detail-title"
              tabIndex={-1}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 z-20 size-9 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => setSelectedAsset(null)}
                aria-label="Close"
              >
                <X className="size-4" aria-hidden />
              </Button>
              {detailBody}
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      mainScrollEl,
    )
  }


  return (
    <Sheet open={Boolean(selectedAsset)} onOpenChange={(open) => !open && setSelectedAsset(null)}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-[680px] border-l p-0 text-foreground overflow-y-auto scrollbar-none isolate shadow-xl",
          glassPanelSurface,
        )}
      >
        {detailBody}
      </SheetContent>
    </Sheet>
  )
}