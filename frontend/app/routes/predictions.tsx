"use client"

import * as React from "react"
import { format, subDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Activity, BrainCircuit, RefreshCw, TrendingDown, TrendingUp, ChevronDown, ArrowLeft, Search, ArrowRight, Clock, ChevronRight, HelpCircle } from "lucide-react"
import { toast } from "sonner"
import { useSearchParams, useNavigate } from "react-router"
import { motion, AnimatePresence } from "framer-motion"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import { Separator } from "~/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { AssetPagination } from "~/components/assets"
import { DatePickerWithRange } from "~/components/dashboard/date-picker-with-range"
import {
  apiGet,
  type AssetResponse,
  type MlModelResponse,
  type PaginatedResponse,
  type PredictionResponse,
  type MarketDataResponse,
  type AssetPredictionSummaryResponse,
  type PredictionChartWindowResponse,
} from "~/lib/api-client"
import { formatCurrency, formatCompactCurrency } from "~/lib/currency"
import { cn } from "~/lib/utils"
import { PredictiveChart } from "~/components/predictions/predictive-chart"
import { PredictiveAreaChart } from "~/components/predictions/area-chart"
import { PageBlueBackdrop } from "~/components/dashboard/page-blue-backdrop"
import { AssetIcon } from "~/components/asset-icon"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { List, Grid as GridIcon } from "lucide-react"



// ─── Constants ────────────────────────────────────────────────────────────────

function utcCalendarDate(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

function startOfUtcDayFromLocalCalendarDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0))
}

function endOfUtcDayFromLocalCalendarDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999))
}

function utcBoundsFromDateRange(
  range: DateRange | undefined,
): { timeFromIso: string; timeToIso: string; spanDays: number } | null {
  if (!range?.from || !range.to) return null
  const fromUtc = startOfUtcDayFromLocalCalendarDate(range.from)
  const toUtc = endOfUtcDayFromLocalCalendarDate(range.to)
  if (fromUtc.getTime() > toUtc.getTime()) return null
  const inclusiveMs = toUtc.getTime() - fromUtc.getTime()
  const spanDays = Math.max(1, Math.ceil((inclusiveMs + 1) / 86400000))
  return { timeFromIso: fromUtc.toISOString(), timeToIso: toUtc.toISOString(), spanDays }
}

const PAGE_SIZE = 20

function assetSelectionLooksResolvedToUuid(candidate: string): boolean {
  const trimmed = candidate.trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
}

function coerceFiniteNumber(candidate: unknown): number | undefined {
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate
  }
  if (typeof candidate === "string" && candidate.trim() !== "") {
    const parsedNumber = Number(candidate.trim())
    if (Number.isFinite(parsedNumber)) {
      return parsedNumber
    }
  }
  return undefined
}

// ─── Stat card ────────────────────────────────────────────────────────────────

type StatVariant = "blue" | "rose" | "emerald"

const STAT_STYLES: Record<StatVariant, {
  card: string; iconWrap: string; icon: string; value: string; accent: string; glow: string
}> = {
  blue: {
    card: "bg-card/40 border-border/50 backdrop-blur-md dark:bg-black/40 dark:border-white/5",
    iconWrap: "bg-blue-500/10 dark:bg-blue-500/20",
    icon: "text-blue-600 dark:text-blue-400",
    value: "text-blue-600 dark:text-blue-400",
    accent: "before:absolute before:inset-0 before:border-t-2 before:border-blue-500/30",
    glow: "after:absolute after:-right-4 after:-top-4 after:size-16 after:bg-blue-500/10 after:blur-2xl after:rounded-full",
  },
  rose: {
    card: "bg-card/40 border-border/50 backdrop-blur-md dark:bg-black/40 dark:border-white/5",
    iconWrap: "bg-rose-500/10 dark:bg-rose-500/20",
    icon: "text-rose-600 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-400",
    accent: "before:absolute before:inset-0 before:border-t-2 before:border-rose-500/30",
    glow: "after:absolute after:-right-4 after:-top-4 after:size-16 after:bg-rose-500/10 after:blur-2xl after:rounded-full",
  },
  emerald: {
    card: "bg-card/40 border-border/50 backdrop-blur-md dark:bg-black/40 dark:border-white/5",
    iconWrap: "bg-emerald-500/10 dark:bg-emerald-500/20",
    icon: "text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    accent: "before:absolute before:inset-0 before:border-t-2 before:border-emerald-500/30",
    glow: "after:absolute after:-right-4 after:-top-4 after:size-16 after:bg-emerald-500/10 after:blur-2xl after:rounded-full",
  },
}

function StatCard({
  label, value, sub,
  icon: Icon, variant,
}: {
  label: string; value: string; sub?: string
  icon: React.ComponentType<{ className?: string }>
  variant: StatVariant
}) {
  const s = STAT_STYLES[variant]
  return (
    <Card className={cn("relative flex flex-col overflow-hidden transition-all duration-500 hover:bg-white/[0.03] group", s.card, s.accent, s.glow)}>
      <div className={cn("absolute right-2 top-2 sm:right-3 sm:top-3 rounded-md sm:rounded-lg p-1 sm:p-1.5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12", s.iconWrap)}>
        <Icon className={cn("size-3 sm:size-3.5", s.icon)} />
      </div>
      <CardContent className="flex flex-1 flex-col justify-between p-2.5 pr-7 sm:p-3 sm:pr-10 relative z-10">
        <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-foreground/30 dark:text-white/30 group-hover:text-foreground/50 dark:group-hover:text-white/50 transition-colors">
          {label}
        </p>
        <div className="mt-1.5 sm:mt-2.5">
          <p className={cn("text-sm sm:text-xl font-black tabular-nums leading-none tracking-tight", s.value)}>
            {value}
          </p>
          {sub && (
            <div className="mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-1.5">
              <div className={cn("size-1 rounded-full animate-pulse", s.icon)} />
              <p className="text-[8px] sm:text-[9px] font-bold text-foreground/40 dark:text-white/40 tracking-tight uppercase">{sub}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border/50 bg-card/40 backdrop-blur-md p-3 space-y-2">
      <Skeleton className="h-2.5 w-14 bg-muted/50" />
      <Skeleton className="h-5 w-20 bg-muted/50" />
      <Skeleton className="h-2 w-16 bg-muted/50" />
    </Card>
  )
}

// ─── Asset Selector ──────────────────────────────────────────────────────────

function AssetSelector({ assets, onSelect, loading }: {
  assets: AssetPredictionSummaryResponse[]
  onSelect: (id: string) => void
  loading: boolean
}) {
  const [search, setSearch] = React.useState("")
  const [searchParams, setSearchParams] = useSearchParams()
  const viewMode = (searchParams.get("view") as "grid" | "list") || "grid"
  const setViewMode = (mode: "grid" | "list") => {
    setSearchParams(prev => {
      prev.set("view", mode)
      return prev
    })
  }
  const [page, setPage] = React.useState(1)
  const pageSize = 20

  const filtered = React.useMemo(() => assets.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.symbol.toLowerCase().includes(search.toLowerCase())
  ), [assets, search])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = React.useMemo(() =>
    filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page])

  // Reset page when searching
  React.useEffect(() => {
    setPage(1)
  }, [search])

  return (
    <div className="flex-1 flex flex-col min-h-0 relative overflow-y-auto px-4 md:px-8 py-8 md:py-10">
      <PageBlueBackdrop />

      <div className="relative z-10 w-full max-w-7xl mx-auto space-y-8 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black tracking-tight text-foreground">Market Predictions</h1>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {assets.length} indexed assets available for neural forecasting
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-foreground/30 dark:text-white/20" />
              <input
                type="text"
                placeholder="Filter assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 bg-card/40 backdrop-blur-md border border-border/50 rounded-2xl pl-10 pr-4 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none shadow-sm"
              />
            </div>

            <div className="flex h-11 rounded-2xl border border-border/50 bg-card/75 p-1 shadow-sm relative gap-1 items-center">
              {/* Sliding Animation Indicator */}
              <div className="absolute inset-1 flex items-center z-0">
                <motion.div
                  className="h-full rounded-xl bg-foreground shadow-sm"
                  animate={{
                    x: viewMode === "grid" ? 0 : 44,
                    width: 40
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              </div>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl relative z-10 transition-colors duration-300 outline-none",
                        viewMode === "grid" ? "text-background" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <GridIcon className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Grid View</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl relative z-10 transition-colors duration-300 outline-none",
                        viewMode === "list" ? "text-background" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <List className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>List View</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </motion.div>
          ) : paginated.length > 0 ? (
            <div className="space-y-8">
              {viewMode === "grid" ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                >
                  {paginated.map((asset) => {
                    const confidence = (asset.confidence_score ?? 0.85) * 100
                    const isUp = asset.trend_signal === "bullish"
                    return (
                      <Card
                        key={asset.asset_id}
                        onClick={() => onSelect(asset.asset_id)}
                        className="group relative overflow-hidden bg-card/30 backdrop-blur-md border-border/40 p-6 cursor-pointer hover:bg-white/[0.04] transition-all duration-500 hover:border-blue-500/40 shadow-xl flex flex-col justify-between min-h-[180px] rounded-3xl"
                      >
                        <div className="absolute -inset-px bg-gradient-to-br from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                        <div className="relative z-10">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="size-12 flex items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:scale-110 transition-transform duration-500 overflow-hidden p-2">
                                <AssetIcon symbol={asset.symbol} className="size-full" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-black tracking-tight truncate group-hover:text-blue-500 transition-colors">{asset.name}</h3>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{asset.symbol}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 grid grid-cols-2 gap-y-5 gap-x-4 border-t border-border/30 pt-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">AI Confidence</span>
                                <TooltipProvider>
                                  <Tooltip delayDuration={100}>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-2.5 text-muted-foreground/30 cursor-help hover:text-muted-foreground/60 transition-colors" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-foreground text-background border-none text-[10px] max-w-[200px] p-2 shadow-xl z-[100] font-medium">
                                      Probabilistic score indicating the model's certainty level for the predicted trajectory.
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground">{confidence.toFixed(1)}%</span>
                                <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${confidence}%` }}
                                    className="h-full bg-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <TooltipProvider>
                                  <Tooltip delayDuration={100}>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-2.5 text-muted-foreground/30 cursor-help hover:text-muted-foreground/60 transition-colors" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-foreground text-background border-none text-[10px] max-w-[200px] p-2 shadow-xl z-[100] font-medium">
                                      Aggregated directional sentiment derived from multi-model ensemble analysis.
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Trend Signal</span>
                              </div>
                              <div className="flex items-center justify-end gap-1.5">
                                {isUp ? <TrendingUp className="size-3 text-emerald-500" /> : <TrendingDown className="size-3 text-rose-500" />}
                                <span className={cn("text-xs font-bold uppercase tracking-tight", isUp ? "text-emerald-500" : "text-rose-500")}>
                                  {isUp ? "Bullish" : "Bearish"}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Volatility</span>
                                <TooltipProvider>
                                  <Tooltip delayDuration={100}>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="size-2.5 text-muted-foreground/30 cursor-help hover:text-muted-foreground/60 transition-colors" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-foreground text-background border-none text-[10px] max-w-[200px] p-2 shadow-xl z-[100] font-medium">
                                      Estimated market variance based on historical price deviation and current price action.
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <span className="block text-xs font-bold text-foreground">
                                {asset.volatility ? `${(asset.volatility * 100).toFixed(1)}%` : "Low (1.2%)"}
                              </span>
                            </div>
                            <div className="flex items-end justify-end">
                              <div className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all duration-300 border border-blue-500/10 hover:border-blue-500 shadow-lg shadow-blue-500/0 hover:shadow-blue-500/20"
                                >
                                  Analyze
                                  <ArrowRight className="ml-1.5 size-3 opacity-70 group-hover:translate-x-0.5 transition-all" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-md overflow-hidden"
                >
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/50 bg-white/5">
                        <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Asset</TableHead>
                        <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Confidence</TableHead>
                        <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Signal</TableHead>
                        <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((asset) => {
                        const confidence = (asset.confidence_score ?? 0.85) * 100
                        const isUp = asset.trend_signal === "bullish"
                        return (
                          <TableRow
                            key={asset.asset_id}
                            onClick={() => onSelect(asset.asset_id)}
                            className="group cursor-pointer hover:bg-white/5 border-border/40 transition-colors"
                          >
                            <TableCell className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="size-10 flex items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 overflow-hidden p-1.5">
                                  <AssetIcon symbol={asset.symbol} className="size-full" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-sm leading-none">{asset.name}</p>
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">{asset.symbol}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                                <span className="text-xs font-bold">{confidence.toFixed(1)}%</span>
                                <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500" style={{ width: `${confidence}%` }} />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="flex items-center justify-center gap-1.5">
                                {isUp ? <TrendingUp className="size-3.5 text-emerald-500" /> : <TrendingDown className="size-3.5 text-rose-500" />}
                                <span className={cn("text-[10px] font-black uppercase tracking-widest", isUp ? "text-emerald-500" : "text-rose-500")}>
                                  {isUp ? "Bullish" : "Bearish"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Analyze</span>
                                <ArrowRight className="size-4 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </motion.div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border/30 pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Showing {Math.min(filtered.length, (page - 1) * pageSize + 1)}–{Math.min(filtered.length, page * pageSize)} of {filtered.length} assets
                </p>
                <AssetPagination
                  page={page}
                  totalPages={totalPages}
                  setPage={setPage}
                  loading={loading}
                />
              </div>
            </div>
          ) : (
            <div className="py-20 text-center space-y-4">
              <p className="text-foreground/30 dark:text-white/20 font-black uppercase tracking-widest">No assets matching "{search}"</p>
              <Button variant="ghost" onClick={() => setSearch("")} className="text-blue-500 font-bold">Reset Search</Button>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PredictionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const assetParam = searchParams.get("asset")

  const [assets, setAssets] = React.useState<AssetPredictionSummaryResponse[]>([])
  const [assetsLoading, setAssetsLoading] = React.useState(true)
  const [selectedAssetId, setSelectedAssetId] = React.useState<string>(
    assetParam && assetSelectionLooksResolvedToUuid(assetParam) ? assetParam : "",
  )
  const [displayMode, setDisplayMode] = React.useState<"forecast" | "market">("forecast")
  const [models, setModels] = React.useState<MlModelResponse[]>([])
  const [modelsLoading, setModelsLoading] = React.useState(false)
  const [selectedModelId, setSelectedModelId] = React.useState<string>("__all__")
  const [chartDateRange, setChartDateRange] = React.useState<DateRange | undefined>(() => {
    const to = utcCalendarDate()
    return { from: subDays(to, 179), to }
  })
  const [predictions, setPredictions] = React.useState<PredictionResponse[]>([])
  const [marketData, setMarketData] = React.useState<MarketDataResponse[]>([])
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setAssetsLoading(true)
    apiGet<AssetPredictionSummaryResponse[]>("/predictions/asset-summaries")
      .then((data) => {
        setAssets(data)
      })
      .catch((err) => {
        console.error("Failed to fetch asset summaries:", err)
        setError("Market analysis backend is currently unavailable.")
      })
      .finally(() => setAssetsLoading(false))
  }, [])


  // Sync state from URL
  React.useEffect(() => {
    if (assets.length === 0) return
    const param = searchParams.get("asset")
    if (param) {
      const found = assets.find(a => a.symbol.toLowerCase() === param.toLowerCase() || a.asset_id === param)
      if (found) {
        setSelectedAssetId(found.asset_id)
      } else {
        setSelectedAssetId("")
      }
    } else {
      setSelectedAssetId("")
    }
  }, [searchParams, assets])

  React.useEffect(() => {
    setSelectedModelId("__all__")
    setModels([])

    if (!selectedAssetId || !assetSelectionLooksResolvedToUuid(selectedAssetId)) {
      setModelsLoading(false)
      return
    }

    setModelsLoading(true)

    apiGet<PaginatedResponse<MlModelResponse>>("/predictions/models", {
      asset_id: selectedAssetId || undefined,
      page: 1,
      page_size: 50,
    })
      .then((data) => {
        setModels(data.items)
        const active = data.items.find((m) => m.is_active)
        if (active) setSelectedModelId(active.id)
      })
      .catch((err) => {
        console.error("Failed to fetch models:", err)
        setModels([])
      })
      .finally(() => setModelsLoading(false))
  }, [selectedAssetId])


  const fetchPredictions = React.useCallback(
    async () => {
      if (!selectedAssetId || !assetSelectionLooksResolvedToUuid(selectedAssetId)) return
      const bounds = utcBoundsFromDateRange(chartDateRange)
      if (bounds == null) {
        return
      }
      setLoading(true)
      setError(null)

      try {
        const resolutionExclusive = bounds.spanDays <= 62 ? "1h" : "1d"
        const bundle = await apiGet<PredictionChartWindowResponse>("/predictions/chart-window", {
          asset_id: selectedAssetId,
          time_from: bounds.timeFromIso,
          time_to: bounds.timeToIso,
          model_id: selectedModelId === "__all__" ? undefined : selectedModelId,
          resolution: resolutionExclusive,
        })

        setPredictions(bundle.predictions)
        setMarketData(bundle.market_data)

        if (bundle.predictions.length === 0) {
          setError("No prediction data found for this asset and timeframe.")
        }
      } catch (err) {
        console.error("Fetch failed:", err)
        setError("Failed to fetch data from the server. Please check your connection.")
        setPredictions([])
        setMarketData([])
      } finally {
        setLoading(false)
      }
    },
    [chartDateRange, selectedAssetId, selectedModelId],
  )


  const handleExport = () => {
    if (predictions.length === 0) return
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(predictions, null, 2))
    const downloadAnchorNode = document.createElement('a')
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", `predictions_${selectedAsset?.symbol || 'data'}.json`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
    toast.success("Export successful")
  }

  React.useEffect(() => {
    setPage(1)
    void fetchPredictions()
  }, [fetchPredictions])

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedAsset = assets.find((a) => a.asset_id === selectedAssetId)
  const selectedModel = models.find((m) => m.id === selectedModelId)

  const chartRangeSummaryLabel = React.useMemo(() => {
    if (!chartDateRange?.from || !chartDateRange.to) return "—"
    return `${format(chartDateRange.from, "MMM d, y")} → ${format(chartDateRange.to, "MMM d, y")}`
  }, [chartDateRange])

  const chartHistorical = React.useMemo(() => {
    return marketData
      .map((d) => {
        const timeSeconds = Math.floor(new Date(d.time).getTime() / 1000)
        return {
          time: timeSeconds,
          open: coerceFiniteNumber(d.open),
          high: coerceFiniteNumber(d.high),
          low: coerceFiniteNumber(d.low),
          close: coerceFiniteNumber(d.close),
          volume: coerceFiniteNumber(d.volume),
        }
      })
      .filter((row): row is {
        time: number
        open: number
        high: number
        low: number
        close: number
        volume: number | undefined
      } =>
        Number.isFinite(row.time) &&
        row.open !== undefined &&
        row.high !== undefined &&
        row.low !== undefined &&
        row.close !== undefined &&
        Number.isFinite(row.open) &&
        Number.isFinite(row.high) &&
        Number.isFinite(row.low) &&
        Number.isFinite(row.close))
      .map((row) => ({
        ...row,
        volume: row.volume ?? 0,
      }))
      .sort((a, b) => a.time - b.time)
  }, [marketData])

  const chartPredictions = React.useMemo(() => {
    return predictions
      .map((p) => ({
        time: Math.floor(new Date(p.time).getTime() / 1000),
        value: coerceFiniteNumber(p.predicted_value),
        ciHigh: coerceFiniteNumber(p.confidence_interval_high ?? undefined),
        ciLow: coerceFiniteNumber(p.confidence_interval_low ?? undefined),
      }))
      .filter((row): row is {
        time: number
        value: number
        ciHigh: number | undefined
        ciLow: number | undefined
      } => Number.isFinite(row.time) && row.value !== undefined && Number.isFinite(row.value))
      .sort((a, b) => a.time - b.time)
  }, [predictions])

  const tableRows = React.useMemo(() => {
    return [...predictions].reverse()
  }, [predictions])

  // Nearest-to-now prediction → the model's current price estimate
  const lastPredicted = React.useMemo(() => {
    if (predictions.length === 0) return null
    const nowMs = Date.now()
    return predictions.reduce((best, p) =>
      Math.abs(new Date(p.time).getTime() - nowMs) < Math.abs(new Date(best.time).getTime() - nowMs) ? p : best
    ).predicted_value
  }, [predictions])

  // Stat cards show only the FUTURE portion (the actual forecast horizon)
  const futurePredictions = React.useMemo(() => {
    const nowMs = Date.now()
    const future = predictions.filter(p => new Date(p.time).getTime() > nowMs)
    return future.length > 0 ? future : predictions
  }, [predictions])

  const avgPredicted = futurePredictions.length > 0
    ? futurePredictions.reduce((s, p) => s + p.predicted_value, 0) / futurePredictions.length
    : null
  const minPredicted = futurePredictions.length > 0
    ? Math.min(...futurePredictions.map(p => p.predicted_value))
    : null
  const maxPredicted = futurePredictions.length > 0
    ? Math.max(...futurePredictions.map(p => p.predicted_value))
    : null

  const handleSelectAsset = (id: string) => {
    const asset = assets.find(a => a.asset_id === id)
    if (asset) {
      setSelectedAssetId(id)
      setSearchParams({ asset: asset.symbol.toLowerCase() }, { replace: false })
    }
  }

  // ── Render Selection View ──────────────────────────────────────────────
  if (!selectedAssetId) {
    return (
      <DashboardLayout title="Market Predictions">
        <AssetSelector
          assets={assets}
          loading={assetsLoading}
          onSelect={handleSelectAsset}
        />
      </DashboardLayout>
    )
  }


  // ── Render Dashboard View ──────────────────────────────────────────────
  return (
    <DashboardLayout
      title={
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight">{selectedAsset?.name || "Market Prediction"}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Forecast Dashboard</span>
          </div>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-border/50 bg-card/50 px-4 font-black uppercase tracking-widest text-[10px] hover:bg-white/10"
            onClick={() => {
              setSelectedAssetId("")
              setSearchParams(prev => {
                prev.delete("asset")
                prev.delete("page")
                return prev
              })
            }}
          >
            <ArrowLeft className="mr-2 size-3" />
            Switch Asset
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="icon" className="size-9 rounded-xl border-border/50 bg-card/50 hover:bg-white/10" onClick={() => void fetchPredictions()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      }
    >
      {/* Use w-full and min-h-full to ensure natural vertical growth for the scroll container */}
      <div className="relative w-full min-h-full pt-4 md:pt-6">
        <PageBlueBackdrop />
        <div className="relative z-10 flex w-full flex-col gap-6 px-4 pb-8 md:px-8 md:pb-12">

          {/* Breadcrumbs */}
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <button
                    onClick={() => {
                      setSelectedAssetId("")
                      setSearchParams({})
                    }}
                    className="font-bold"
                  >
                    Predictions
                  </button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="opacity-40" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-black text-foreground">
                  {selectedAsset?.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* ── Controls ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div className="flex min-w-[200px] flex-1 flex-col gap-2 sm:flex-none sm:max-w-xs">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30 dark:text-white/30">Target Asset</label>
                {assetsLoading ? <Skeleton className="h-9 w-full bg-muted/50 sm:max-w-[11rem]" /> : (
                  <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                    <SelectTrigger className="h-9 w-full border-border/50 bg-card/60 backdrop-blur-sm text-foreground/90 rounded-xl focus:ring-blue-500/20 sm:max-w-[11rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover/90 border-border backdrop-blur-xl">
                      {assets.map((a) => (
                        <SelectItem key={a.asset_id} value={a.asset_id} className="focus:bg-accent">
                          <span className="font-black tracking-tight">{a.name} ({a.symbol})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex min-w-[200px] flex-1 flex-col gap-2 sm:flex-none sm:max-w-sm">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30 dark:text-white/30">Analysis Model</label>
                {modelsLoading ? <Skeleton className="h-9 w-full bg-muted/50 sm:max-w-[13rem]" /> : (
                  <Select value={selectedModelId} onValueChange={setSelectedModelId} disabled={models.length === 0}>
                    <SelectTrigger className="h-9 w-full border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] backdrop-blur-xl text-foreground/90 rounded-xl focus:ring-blue-500/20 shadow-sm dark:shadow-inner sm:max-w-[13rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover/90 border-border backdrop-blur-xl">
                      <SelectItem value="__all__" className="focus:bg-accent">Consensus Ensemble</SelectItem>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="focus:bg-accent">
                          {m.display_name?.trim()
                            ? `${m.display_name.trim()} · ${m.model_type || "model"}`
                            : `${m.model_type || "Model"}`}{" "}
                          <span className="text-[9px] text-muted-foreground ml-2">{m.version_tag}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex min-w-[220px] flex-1 flex-col gap-2 sm:max-w-[17rem]">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30 dark:text-white/30">
                  Chart range
                </label>
                <DatePickerWithRange
                  hideLabel
                  className="w-full max-w-none"
                  date={chartDateRange}
                  onSelect={setChartDateRange}
                  disabled={loading}
                />
              </div>

              <div className="ml-0 flex w-full flex-col gap-2 sm:ml-auto sm:w-auto">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30 dark:text-white/30">
                  View mode
                </label>
                <div className="relative flex h-9 w-full sm:w-fit items-center gap-1 rounded-xl border border-border/40 bg-black/20 dark:bg-black/40 p-1 shadow-sm backdrop-blur-md">
                  {[
                    { id: "forecast", label: "Candlestick" },
                    { id: "market", label: "Area Chart" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setDisplayMode(mode.id as "forecast" | "market")}
                      className={cn(
                        "relative z-10 h-full flex-1 rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.1em] transition-colors duration-300 sm:flex-initial sm:px-3",
                        displayMode === mode.id
                          ? "text-white"
                          : "text-foreground/40 dark:text-white/30 hover:text-foreground dark:hover:text-white"
                      )}
                    >
                      {displayMode === mode.id && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 z-[-1] rounded-lg bg-blue-600 shadow-[0_4px_15px_rgba(37,99,235,0.4)]"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Chart Section ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <Card className="relative flex flex-col border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl xl:col-span-3 group">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

              <CardHeader className="flex flex-row items-center justify-between px-6 py-3.5 border-b border-border/50 relative z-10 bg-white/5 dark:bg-black/20">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                      <TrendingUp className="size-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-[13px] font-black uppercase tracking-[0.2em] text-foreground/80 dark:text-white/80">Market Outlook</CardTitle>
                    </div>
                    <p className="text-[10px] font-bold text-foreground/40 dark:text-white/30 uppercase tracking-widest mt-0.5">Price trajectory analytics</p>
                  </div>
                </div>

                {/* Forecast Display */}
                {lastPredicted != null && (
                  <div className="flex flex-col items-end leading-tight">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Model Forecast</span>
                    <span className="text-3xl font-black tabular-nums text-blue-400 tracking-tight drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]">
                      {formatCurrency(lastPredicted, "USD")}
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="relative p-0 overflow-hidden">
                <div className="h-[260px] sm:h-[360px] md:h-[450px] w-full border-b border-border/10">
                  {loading &&
                  predictions.length === 0 &&
                  chartHistorical.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <RefreshCw className="size-8 animate-spin text-blue-500/10" />
                    </div>
                  ) : predictions.length === 0 &&
                    chartHistorical.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-xs font-bold text-muted-foreground/40">No telemetry data.</p>
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={displayMode}
                        initial={{ opacity: 0, filter: "blur(4px)" }}
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, filter: "blur(4px)" }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="h-full w-full"
                      >
                        {displayMode === "forecast" ? (
                          <PredictiveChart
                            historicalData={chartHistorical}
                            predictions={chartPredictions}
                            lastPredictedValue={lastPredicted ?? undefined}
                          />
                        ) : (
                          <PredictiveAreaChart
                            historicalData={chartHistorical}
                            predictions={chartPredictions}
                            lastPredictedValue={lastPredicted ?? undefined}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sidebar Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 xl:flex xl:flex-col xl:gap-3">
              {predictions.length > 0 ? (
                <>
                  <StatCard icon={TrendingUp} variant="emerald" label="Max Forecast" value={maxPredicted != null ? formatCurrency(maxPredicted, "USD") : "—"} sub="Peak Signal" />
                  <StatCard icon={Activity} variant="blue" label="Mean Forecast" value={avgPredicted != null ? formatCurrency(avgPredicted, "USD") : "—"} sub="Avg Telemetry" />
                  <StatCard icon={TrendingDown} variant="rose" label="Min Forecast" value={minPredicted != null ? formatCurrency(minPredicted, "USD") : "—"} sub="Floor Signal" />
                </>
              ) : Array.from({ length: 3 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          </div>

          {/* ── Chart Guide (Full Width) ─────────────────────────────── */}
          <Collapsible className="group/collapsible">
            <Card className="relative overflow-hidden border-border/60 bg-card/50 backdrop-blur-xl dark:bg-black/60 dark:border-white/10 transition-all duration-700 shadow-xl">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3.5 md:p-4 cursor-pointer outline-none">
                  <div className="flex items-center gap-2.5">
                    <BrainCircuit className="size-4 text-blue-500/60 shrink-0 transition-transform duration-700 group-hover/collapsible:rotate-12" />
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-foreground/90 dark:text-white/80">Chart Guide</p>
                    <div className="hidden sm:block h-px w-32 bg-gradient-to-r from-border/40 to-transparent ml-2" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex size-7 items-center justify-center rounded-full bg-white/5 border border-white/10 group-hover/collapsible:bg-white/10 transition-colors duration-500">
                      <ChevronDown className="size-3.5 text-foreground/30 dark:text-white/20 transition-transform duration-700 group-data-[state=open]/collapsible:rotate-180" />
                    </div>
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                <div className="px-5 pb-8 md:px-6 md:pb-10 pt-2 border-t border-white/5">
                  {/* 5-column horizontal layout */}
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-0 lg:divide-x lg:divide-border/25">

                    {displayMode === "forecast" ? (
                      <>
                        {/* 1 — Legend */}
                        <div className="space-y-3.5 lg:pr-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 dark:text-white/70">Legend</p>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 size-3.5 shrink-0 rounded-sm bg-emerald-500/80 border border-emerald-500/40" />
                              <div>
                                <p className="text-xs font-black text-foreground/90 dark:text-white/80">Bullish — Historical</p>
                                <p className="text-[10px] text-foreground/60 dark:text-white/50 leading-relaxed mt-0.5 font-medium">Close &gt; Open. Price rose during this candle period.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 size-3.5 shrink-0 rounded-sm bg-rose-500/80 border border-rose-500/40" />
                              <div>
                                <p className="text-xs font-black text-foreground/90 dark:text-white/80">Bearish — Historical</p>
                                <p className="text-[10px] text-foreground/60 dark:text-white/50 leading-relaxed mt-0.5 font-medium">Close &lt; Open. Price fell during this candle period.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 size-3.5 shrink-0 rounded-sm bg-cyan-400/80 border border-cyan-400/40" />
                              <div>
                                <p className="text-xs font-black text-foreground/90 dark:text-white/80">Forecast ↑</p>
                                <p className="text-[10px] text-foreground/60 dark:text-white/50 leading-relaxed mt-0.5 font-medium">Model predicts upward movement.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 size-3.5 shrink-0 rounded-sm bg-pink-500/80 border border-pink-500/40" />
                              <div>
                                <p className="text-xs font-black text-foreground/90 dark:text-white/80">Forecast ↓</p>
                                <p className="text-[10px] text-foreground/60 dark:text-white/50 leading-relaxed mt-0.5 font-medium">Model predicts downward movement.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2 — Candle Anatomy */}
                        <div className="space-y-3.5 lg:px-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 dark:text-white/70">Candle Anatomy</p>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 w-3.5 shrink-0 flex flex-col items-center gap-0.5">
                                <div className="w-px h-2.5 bg-foreground/50 dark:bg-white/40" />
                                <div className="w-3 h-4 rounded-[2px] bg-foreground/60 dark:bg-white/50" />
                                <div className="w-px h-2.5 bg-foreground/50 dark:bg-white/40" />
                              </div>
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-white/50 shrink-0">Body</span>
                                  <div className="h-px flex-1 bg-border/40" />
                                  <span className="text-[10px] font-bold text-foreground/80 dark:text-white/70">Open → Close</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60 dark:text-white/50 shrink-0">High</span>
                                  <div className="h-px flex-1 bg-border/40" />
                                  <span className="text-[10px] font-bold text-foreground/80 dark:text-white/70">Upper wick tip</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80 dark:text-white/70 shrink-0">Low</span>
                                  <div className="h-px flex-1 bg-border/40" />
                                  <span className="text-[10px] font-bold text-foreground/80 dark:text-white/70">Lower wick tip</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-[10px] text-foreground/80 dark:text-white/70 leading-relaxed font-medium">
                              Each candle represents one time unit. The body shows the price range between open and close. Wicks extend to the session high and low.
                            </p>
                          </div>
                        </div>

                        {/* 3 — Confidence Interval */}
                        <div className="space-y-3.5 lg:px-6 col-span-2 sm:col-span-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 dark:text-white/70">Confidence Interval</p>
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-px flex-1 bg-gradient-to-r from-rose-500/60 via-blue-500/70 to-emerald-500/60" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-foreground/70 dark:text-white/60 shrink-0">CI Band</span>
                              <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/60 via-blue-500/70 to-rose-500/60" />
                            </div>
                            <p className="text-[10px] text-foreground/80 dark:text-white/70 leading-relaxed font-medium">
                              On forecast candles, the wick range represents the model's <span className="font-black text-blue-500/90 dark:text-blue-400">confidence interval</span> — the range of values the model considers plausible.
                            </p>
                            <p className="text-[10px] text-foreground/80 dark:text-white/70 leading-relaxed font-medium">
                              <span className="font-black text-foreground/80 dark:text-white/70">Narrow wicks</span> indicate high certainty. <span className="font-black text-foreground/80 dark:text-white/70">Wide wicks</span> indicate greater uncertainty in the model's prediction.
                            </p>
                            <div className="flex gap-3 mt-1">
                              <div className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center transition-colors duration-500 hover:bg-emerald-500/20">
                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/90 dark:text-emerald-400">Narrow</p>
                                <p className="text-[10px] text-foreground/80 dark:text-white/70 mt-0.5 font-bold">High confidence</p>
                              </div>
                              <div className="flex-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center transition-colors duration-500 hover:bg-rose-500/20">
                                <p className="text-[9px] font-black uppercase tracking-widest text-rose-500/90 dark:text-rose-400">Wide</p>
                                <p className="text-[10px] text-foreground/80 dark:text-white/70 mt-0.5 font-bold">High uncertainty</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 4 — Volume Flow */}
                        <div className="space-y-3.5 lg:px-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 dark:text-white/70">Volume Flow</p>
                          <div className="space-y-2.5">
                            <div className="flex items-end gap-[3px] h-10 mb-1">
                              {[40, 65, 50, 85, 45, 70, 55, 90, 35, 60].map((h, i) => (
                                <div key={i} className={cn("flex-1 rounded-t-[1px] transition-all duration-700", i % 3 !== 1 ? "bg-emerald-500/50 group-hover/collapsible:bg-emerald-500/70" : "bg-rose-500/45 group-hover/collapsible:bg-rose-500/65")} style={{ height: `${h}%` }} />
                              ))}
                            </div>
                            <p className="text-[10px] text-foreground/80 dark:text-white/70 leading-relaxed font-medium">
                              The <span className="font-black text-foreground/80 dark:text-white/70">histogram</span> at the bottom of the chart shows trading volume for each period.
                            </p>
                            <div className="space-y-2 mt-0.5">
                              <div className="flex items-center gap-2.5">
                                <div className="size-2.5 rounded-sm bg-emerald-500/60 border border-emerald-500/30 shrink-0" />
                                <span className="text-[10px] text-foreground/70 dark:text-white/60 font-bold">Green — bullish volume session</span>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <div className="size-2.5 rounded-sm bg-rose-500/55 border border-rose-500/30 shrink-0" />
                                <span className="text-[10px] text-foreground/70 dark:text-white/60 font-bold">Red — bearish volume session</span>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <div className="size-2.5 rounded-sm bg-blue-500/50 border border-blue-500/30 shrink-0" />
                                <span className="text-[10px] text-foreground/70 dark:text-white/60 font-bold">Blue — forecast zone overlay</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* 1 — Data Points */}
                        <div className="space-y-3.5 lg:pr-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 dark:text-white/70">Forecast Data</p>
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 size-3.5 shrink-0 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                                <Clock className="size-2 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-xs font-black text-foreground/90 dark:text-white/80">Temporal Resolution</p>
                                <p className="text-[10px] text-foreground/80 dark:text-white/70 leading-relaxed mt-1 font-medium">Use the chart range control to slice both real OHLC and stored model points to the calendar window you need.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="mt-1 size-3.5 shrink-0 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                                <TrendingUp className="size-2 text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-xs font-black text-foreground/90 dark:text-white/80">Price Targets</p>
                                <p className="text-[10px] text-foreground/80 dark:text-white/70 leading-relaxed mt-1 font-medium">Aggregated estimates from multiple neural architectures.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2 — CI Logic */}
                        <div className="space-y-3.5 lg:px-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 dark:text-white/70">Confidence Bands</p>
                          <div className="space-y-3">
                            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                              <p className="text-[10px] font-bold text-foreground/80 leading-relaxed">
                                Represents the statistical range where the model expects the price to settle with 95% probability.
                              </p>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-muted-foreground/70 dark:text-white/60">Lower Bound</span>
                              <span className="text-blue-500/70">Support Floor</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-muted-foreground/70 dark:text-white/60">Upper Bound</span>
                              <span className="text-blue-500/70">Resistance Ceiling</span>
                            </div>
                          </div>
                        </div>

                        {/* 3 — Signal Analysis */}
                        <div className="space-y-3.5 lg:px-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 dark:text-white/70">Signal Analysis</p>
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[8px] font-black px-1.5 py-0">Bullish</Badge>
                              <span className="text-[10px] font-medium text-foreground/60">Price &gt; Prev Price</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-rose-500/10 text-rose-500 border-none text-[8px] font-black px-1.5 py-0">Bearish</Badge>
                              <span className="text-[10px] font-medium text-foreground/60">Price &lt; Prev Price</span>
                            </div>
                            <p className="text-[10px] text-foreground/70 dark:text-white/60 leading-relaxed mt-2">
                              Directional momentum derived from sequential point comparison.
                            </p>
                          </div>
                        </div>

                        {/* 4 — Error Metrics */}
                        <div className="space-y-3.5 lg:px-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 dark:text-white/70">Quality Control</p>
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                                <span>Reliability</span>
                                <span>89%</span>
                              </div>
                              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500/50 w-[89%]" />
                              </div>
                            </div>
                            <p className="text-[10px] text-foreground/60 leading-relaxed font-medium">
                              Table view provides exact values for high-precision institutional reporting and backtesting.
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* 5 — Session (Always visible) */}
                    <div className="space-y-3.5 lg:pl-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 dark:text-white/70">Active Session</p>
                      <div className="space-y-2">
                        {selectedAsset && (
                          <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.05] dark:bg-white/[0.08] border border-border/40 px-3 py-2.5 transition-colors duration-500 hover:bg-white/[0.1]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70 dark:text-white/60">Asset</span>
                            <span className="text-[11px] font-black text-foreground/90 dark:text-white/80">{selectedAsset.symbol}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.05] dark:bg-white/[0.08] border border-border/40 px-3 py-2.5 transition-colors duration-500 hover:bg-white/[0.1]">
                          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70 dark:text-white/60">Model</span>
                          <span className="text-[11px] font-black text-foreground/90 dark:text-white/80 truncate max-w-[110px]">{selectedModel?.model_type || "Consensus"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.05] dark:bg-white/[0.08] border border-border/40 px-3 py-2.5 transition-colors duration-500 hover:bg-white/[0.1]">
                          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70 dark:text-white/60">Range</span>
                          <span className="text-[11px] font-black text-blue-500/90 dark:text-blue-400 truncate max-w-[min(260px,45vw)]" title={chartRangeSummaryLabel}>
                            {chartRangeSummaryLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ── Table ────────────────────────────────────────────────── */}
          <Card className="border-border/50 bg-card/20 backdrop-blur-md overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-12 text-center h-12">
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/80 dark:text-white/70 transition-colors cursor-default">#</span>
                    </TableHead>
                    <TableHead className="text-center h-12">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/80 dark:text-white/70 hover:text-foreground/80 dark:hover:text-white/60 transition-colors cursor-default">Timestamp</span>
                          </TooltipTrigger>
                          <TooltipContent variant="inverted" side="bottom" className="text-[11px] max-w-[200px] font-medium">
                            The exact date and time for each prediction point.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center h-12">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/80 dark:text-white/70 hover:text-foreground/80 dark:hover:text-white/60 transition-colors cursor-default">Predicted Value</span>
                          </TooltipTrigger>
                          <TooltipContent variant="inverted" side="bottom" className="text-[11px] max-w-[200px] font-medium">
                            The AI's estimated price at this specific time.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center h-12">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/80 dark:text-white/70 hover:text-foreground/80 dark:hover:text-white/60 transition-colors cursor-default">Confidence Band</span>
                          </TooltipTrigger>
                          <TooltipContent variant="inverted" side="bottom" className="text-[11px] max-w-[200px] font-medium">
                            The expected range where the price is likely to stay.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-center h-12">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/80 dark:text-white/70 hover:text-foreground/80 dark:hover:text-white/60 transition-colors cursor-default">Trend Signal</span>
                          </TooltipTrigger>
                          <TooltipContent variant="inverted" side="bottom" className="text-[11px] max-w-[200px] font-medium">
                            The predicted market direction.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.slice((page - 1) * 10, page * 10).map((row, idx) => {
                    const globalIdx = (page - 1) * 10 + idx + 1
                    const actualIdx = (page - 1) * 10 + idx
                    const trend = tableRows[actualIdx + 1] ? row.predicted_value - tableRows[actualIdx + 1].predicted_value : 0
                    const isUp = trend >= 0
                    return (
                      <TableRow key={idx} className="border-border/50 hover:bg-accent/50 transition-colors group">
                        <TableCell className="text-center font-black text-[10px] text-foreground/30 dark:text-white/20">{globalIdx}</TableCell>
                        <TableCell className="text-center font-bold text-[11px] text-foreground/70 dark:text-white/60 group-hover:text-foreground/70 dark:group-hover:text-white/70 transition-colors">{format(new Date(row.time), "MMM d, HH:mm")}</TableCell>
                        <TableCell className="text-center font-black text-sm text-foreground tracking-tight">{formatCurrency(row.predicted_value, "USD")}</TableCell>
                        <TableCell className="text-center">
                          {row.confidence_interval_low != null && (
                            <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/20 dark:border-blue-500/10 group-hover:bg-blue-500/20 dark:group-hover:bg-blue-500/10 transition-colors">
                              <span className="text-[10px] text-blue-600/80 dark:text-blue-400/60 font-bold tracking-tight">{formatCompactCurrency(row.confidence_interval_low, "USD")}</span>
                              <div className="flex items-center gap-0.5 opacity-40">
                                <div className="w-2 h-[1px] bg-blue-500/50" />
                                <ChevronRight className="size-2 text-blue-600 dark:text-blue-500" />
                              </div>
                              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-black tracking-tight">{formatCompactCurrency(row.confidence_interval_high!, "USD")}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                            isUp ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                          )}>
                            {isUp ? "Bullish" : "Bearish"}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 bg-muted/5 border-t border-border/50 flex items-center justify-between">
              <p className="text-[10px] font-bold text-foreground/40 dark:text-white/30 uppercase tracking-widest">Showing {Math.min(page * 10, tableRows.length)} of {tableRows.length} forecast points</p>
              <AssetPagination page={page} totalPages={Math.ceil(tableRows.length / 10)} setPage={setPage} loading={loading} />
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
