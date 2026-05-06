"use client"

import * as React from "react"
import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { PageBlueBackdrop } from "~/components/dashboard/page-blue-backdrop"
import { MarketHeatmap } from "~/components/heatmap/market-heatmap"
import { apiGet, type LiveMarketResponse, type AssetResponse, type PaginatedResponse } from "~/lib/api-client"
import { Button } from "~/components/ui/button"
import { RefreshCw, Clock, Zap, BarChart3, Target, Paintbrush, Layers, Activity, MousePointer2, Compass, TrendingUp, ShieldAlert, HelpCircle, ChevronDown, Coins, CircleSlash, DollarSign, Cpu } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "~/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"

const REFRESH_INTERVAL_MS = 60000

type SizeMode = "market_cap" | "volume"
type PerformanceRange = "1h" | "24h" | "7d"
type FilterSource = "all" | "no_btc" | "no_stable" | "defi"

const STABLECOINS = ["USDT", "USDC", "DAI", "BUSD", "TUSD", "USDD", "FDUSD", "USDP", "FRAX"]
const DEFI_COINS = ["UNI", "AAVE", "MKR", "SNX", "COMP", "LDO", "CRV", "LINK", "GRT", "RUNE", "DYDX", "EGLD"]

const LEGEND_ITEMS = [
  { label: "-5%", color: "#7f1d1d" },
  { label: "-2%", color: "#b91c1c" },
  { label: "-1%", color: "#ef4444" },
  { label: "0%", color: "var(--muted-foreground)" },
  { label: "+1%", color: "#10b981" },
  { label: "+2%", color: "#059669" },
  { label: "+5%", color: "#064e3b" },
]

export default function HeatmapPage() {
  const [rawMarket, setRawMarket] = React.useState<LiveMarketResponse[]>([])
  const [rawAssets, setRawAssets] = React.useState<AssetResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)

  const [sizeBy, setSizeBy] = React.useState<SizeMode>("market_cap")
  const [perfRange, setPerformanceRange] = React.useState<PerformanceRange>("24h")
  const [filterSource, setFilterSource] = React.useState<FilterSource>("all")

  const guideRef = React.useRef<HTMLDivElement>(null)

  const fetchData = React.useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    setError(null)
    try {
      const [liveRes, assetsRes] = await Promise.all([
        apiGet<LiveMarketResponse[]>("/assets/live-market", { limit: 250 }),
        apiGet<PaginatedResponse<AssetResponse>>("/assets", { page_size: 500 })
      ])

      if (!liveRes || liveRes.length === 0) throw new Error("Live data feed is empty.")

      setRawMarket(liveRes)
      setRawAssets(assetsRes.items)
      setLastUpdated(new Date())
    } catch (err: any) {
      console.error("Heatmap Fetch Error:", err)
      if (!isSilent) setError(err.message || "Data sync error.")
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  const processedData = React.useMemo(() => {
    if (!rawMarket.length) return []
    const assetMap = new Map(rawAssets.map(a => [a.symbol.toUpperCase(), a]))

    // Apply Source Filtering
    let filteredMarket = [...rawMarket]
    if (filterSource === "no_btc") {
      filteredMarket = filteredMarket.filter(i => i.symbol.toUpperCase() !== "BTC")
    } else if (filterSource === "no_stable") {
      filteredMarket = filteredMarket.filter(i => !STABLECOINS.includes(i.symbol.toUpperCase()))
    } else if (filterSource === "defi") {
      filteredMarket = filteredMarket.filter(i => DEFI_COINS.includes(i.symbol.toUpperCase()) || i.name?.toLowerCase().includes("defi"))
    }

    return filteredMarket.map(item => {
      const symbol = item.symbol.toUpperCase()
      const meta = assetMap.get(symbol)

      let value = 0
      if (sizeBy === "market_cap") {
        const rankWeight = Math.pow(Math.max(251 - (item.rank || 250), 1), 1.5)
        value = item.market_cap || (rankWeight * 1000000)
      } else {
        value = Math.pow(item.volume || 1, 0.85)
      }

      let change = 0
      if (perfRange === "1h") {
        change = item.price_change_1h !== null ? item.price_change_1h : (item.price_change_24h ? item.price_change_24h / 24 : 0)
      } else if (perfRange === "24h") {
        change = item.price_change_24h || 0
      } else if (perfRange === "7d") {
        change = item.price_change_7d !== null ? item.price_change_7d : (item.price_change_24h ? item.price_change_24h * 4 : 0)
      }

      return {
        name: meta?.name || item.name || item.symbol,
        symbol: item.symbol,
        value: Math.max(value, 1),
        change: change,
      }
    }).filter(i => i.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [rawMarket, rawAssets, sizeBy, perfRange, filterSource])

  const scrollToGuide = () => {
    guideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  React.useEffect(() => {
    void fetchData()
    const interval = setInterval(() => void fetchData(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <DashboardLayout
      title={
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-foreground">Market Heatmap</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none opacity-70">Analytics Engine</span>
          </div>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/50 text-[9px] font-black uppercase tracking-widest text-muted-foreground mr-2">
              <Clock className="size-3" />
              <span>{lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
          <Button variant="outline" size="icon" className="size-9 rounded-xl border-border/50 bg-background/50" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      }
    >
      <div className="relative flex flex-col px-4 py-6 md:px-8">
        <PageBlueBackdrop />
        <div className="relative z-10 flex flex-col gap-6 w-full max-w-[1700px] mx-auto pb-16">

          <div className="flex flex-wrap items-center justify-between gap-6 rounded-[2rem] border border-border/50 bg-card/30 p-4 backdrop-blur-3xl shadow-xl ring-1 ring-border/10 glass-surface">
            <div className="flex flex-wrap items-center gap-8 w-full justify-between">
              <div className="flex flex-wrap items-center gap-8">
                {/* ADVANCED SOURCE FILTER */}
                <div className="flex flex-col gap-1.5 w-full md:w-auto">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Select Source</span>
                  <Select value={filterSource} onValueChange={(v) => setFilterSource(v as FilterSource)}>
                    <SelectTrigger className="w-full md:w-[240px] h-9 rounded-xl bg-background/30 border-border/20 backdrop-blur-md shadow-inner text-[11px] font-bold uppercase tracking-tight ring-0 focus:ring-0 glass-surface">
                      <SelectValue placeholder="Crypto coins" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      className="w-[240px] bg-popover/85 text-popover-foreground backdrop-blur-3xl border-border/50 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-border/5 p-1 z-50"
                    >
                      <SelectItem value="all" className="text-[11px] font-bold uppercase py-3 focus:bg-primary/20 focus:text-primary rounded-lg transition-colors cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Coins className="size-3.5" /> Crypto coins
                        </div>
                      </SelectItem>
                      <SelectItem value="no_btc" className="text-[11px] font-bold uppercase py-3 focus:bg-primary/20 focus:text-primary rounded-lg transition-colors cursor-pointer">
                        <div className="flex items-center gap-2">
                          <CircleSlash className="size-3.5" /> Crypto coins (Excluding Bitcoin)
                        </div>
                      </SelectItem>
                      <SelectItem value="no_stable" className="text-[11px] font-bold uppercase py-3 focus:bg-primary/20 focus:text-primary rounded-lg transition-colors cursor-pointer">
                        <div className="flex items-center gap-2">
                          <DollarSign className="size-3.5" /> Crypto coins (Excluding Stablecoins)
                        </div>
                      </SelectItem>
                      <SelectItem value="defi" className="text-[11px] font-bold uppercase py-3 focus:bg-primary/20 focus:text-primary rounded-lg transition-colors cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Cpu className="size-3.5" /> Coins DeFi
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sizing Logic</span>
                  <div className="flex p-1 rounded-xl bg-background/30 border border-border/20 relative isolate backdrop-blur-sm shadow-inner overflow-hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 rounded-lg text-[9px] font-black uppercase gap-2 relative"
                      onClick={() => setSizeBy("market_cap")}
                    >
                      <motion.span
                        animate={{ color: sizeBy === "market_cap" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-2 relative z-10"
                      >
                        <BarChart3 className="size-3" /> Market Cap
                      </motion.span>
                      {sizeBy === "market_cap" && (
                        <motion.div
                          layoutId="sizePill"
                          className="absolute inset-0 bg-primary rounded-lg z-0"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 rounded-lg text-[9px] font-black uppercase gap-2 relative"
                      onClick={() => setSizeBy("volume")}
                    >
                      <motion.span
                        animate={{ color: sizeBy === "volume" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-2 relative z-10"
                      >
                        <Zap className="size-3" /> Volume
                      </motion.span>
                      {sizeBy === "volume" && (
                        <motion.div
                          layoutId="sizePill"
                          className="absolute inset-0 bg-primary rounded-lg z-0"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Time Range</span>
                  <div className="flex p-1 rounded-xl bg-background/30 border border-border/20 relative isolate backdrop-blur-sm shadow-inner overflow-hidden">
                    {(["1h", "24h", "7d"] as const).map((r) => (
                      <Button
                        key={r}
                        variant="ghost"
                        size="sm"
                        className="h-7 px-4 rounded-lg text-[9px] font-black uppercase relative"
                        onClick={() => setPerformanceRange(r)}
                      >
                        <motion.span
                          animate={{ color: perfRange === r ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                          transition={{ duration: 0.3 }}
                          className="relative z-10"
                        >
                          {r}
                        </motion.span>
                        {perfRange === r && (
                          <motion.div
                            layoutId="perfPill"
                            className="absolute inset-0 bg-primary rounded-lg z-0"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hidden xl:flex flex-col gap-1.5 items-end">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mr-1">Scale</span>
                <div className="flex items-center gap-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full bg-background/20 backdrop-blur-xl border border-border/50 shadow-2xl hover:shadow-primary/30 hover:scale-110 transition-all duration-500 group relative overflow-hidden glass-surface"
                          onClick={scrollToGuide}
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <HelpCircle className="size-3.5 text-primary relative z-10 group-hover:rotate-12 transition-transform duration-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="text-[11px] font-bold bg-white text-slate-950 border-slate-200 shadow-2xl px-3 py-1.5 ring-1 ring-black/5"
                      >
                        How it works?
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <div className="flex items-center px-1.5 py-1.5 rounded-xl bg-background/20 border border-border/20 backdrop-blur-sm">
                    {LEGEND_ITEMS.map((item, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <div
                          className={cn("h-2 w-10 first:rounded-l-md last:rounded-r-md shadow-inner", item.color.startsWith("var") && "bg-muted-foreground/30")}
                          style={{ backgroundColor: item.color.startsWith("var") ? undefined : item.color }}
                        />
                        <span className="text-[8px] font-bold text-muted-foreground mt-1 tabular-nums tracking-tight">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative h-[calc(100vh-280px)] min-h-[620px] w-full">
            <AnimatePresence mode="wait">
              {loading && !rawMarket.length ? (
                <div className="h-full w-full rounded-[2.5rem] bg-card/20 border border-border/50 glass-surface flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-10 rounded-full border-2 border-t-primary border-muted animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">Syncing Market Pulse</span>
                  </div>
                </div>
              ) : (
                <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full w-full">
                  <MarketHeatmap data={processedData} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* FULL-WIDTH COMPREHENSIVE GUIDE */}
          <div ref={guideRef} className="mt-12 relative group w-full">
            <div className="absolute inset-0 bg-primary/5 rounded-[3rem] blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
            <div className="relative rounded-[3rem] border border-border/50 bg-card/20 p-12 backdrop-blur-3xl glass-surface shadow-2xl overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

                <div className="lg:col-span-4 space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                        <Compass className="size-6" />
                      </div>
                      <h2 className="text-xl font-black tracking-tighter text-foreground uppercase italic">The Market Pulse</h2>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Market Heatmap is an <span className="text-foreground font-bold">algorithmic visualization engine</span>. It compresses hundreds of complex data points into a single, intuitive landscape. This tool is designed to show you not just the numbers, but the <span className="text-primary font-bold italic">gravitational pull</span> of the global financial market.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-background/30 border border-border/40 backdrop-blur-md">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="size-3 text-primary" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-foreground">Sync Rate</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Real-time data updates every <span className="text-foreground font-bold">60 seconds</span> from global exchanges.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-background/30 border border-border/40 backdrop-blur-md">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="size-3 text-primary" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-foreground">Depth</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Tracking <span className="text-foreground font-bold">{processedData.length} assets</span> simultaneously on one canvas.</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 text-xs font-black text-foreground uppercase tracking-widest border-b border-border/40 pb-3">
                      <Target className="size-4 text-primary" /> Algorithmic Sizing
                    </div>
                    <div className="space-y-5">
                      <div className="group/item">
                        <h4 className="text-[11px] font-bold text-foreground uppercase mb-1 flex items-center gap-2">
                          <BarChart3 className="size-3" /> Market Dominance
                        </h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed pl-5 border-l border-primary/30">
                          In <span className="text-foreground italic">Market Cap</span> mode, the size of a square represents the asset's overall share of the market. It shows you the <span className="text-foreground font-semibold underline underline-offset-4 decoration-primary/50">heavyweights</span> that anchor the ecosystem.
                        </p>
                      </div>
                      <div className="group/item">
                        <h4 className="text-[11px] font-bold text-foreground uppercase mb-1 flex items-center gap-2">
                          <Zap className="size-3" /> Liquidity Velocity
                        </h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed pl-5 border-l border-primary/30">
                          In <span className="text-foreground italic">Volume</span> mode, size indicates actual trading activity. This highlights where the <span className="text-foreground font-semibold">"smart money"</span> is flowing right now, regardless of the asset's total size.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3 text-xs font-black text-foreground uppercase tracking-widest border-b border-border/40 pb-3">
                      <Paintbrush className="size-4 text-emerald-500" /> Sentiment Psychology
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-emerald-500/5 transition-colors duration-300">
                        <div className="size-4 rounded bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] shrink-0 mt-1" />
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-foreground uppercase">Bullish Impulse (Greed)</span>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">Green blocks indicate positive momentum. Dark emerald signals extreme buying pressure.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-rose-500/5 transition-colors duration-300">
                        <div className="size-4 rounded bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] shrink-0 mt-1" />
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-foreground uppercase">Bearish Pressure (Fear)</span>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">Red blocks indicate sell-offs. Deep crimson highlights a steep collapse in confidence.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
