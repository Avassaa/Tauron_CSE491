"use client"

import * as React from "react"
import { ExternalLink, CircleDot, TrendingUp, Calendar, Activity, RefreshCw, Star } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { Separator } from "~/components/ui/separator"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Button } from "~/components/ui/button"
import { AssetDetailChart } from "~/components/dashboard/asset-detail-chart"
import { cn } from "~/lib/utils"
import { Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import type { AssetResponse, MlModelResponse } from "~/lib/api-client"

interface AssetDetailSheetProps {
  selectedAsset: AssetResponse | null
  setSelectedAsset: (asset: AssetResponse | null) => void
  marketStats: { price: number; change24h: number; volume: number } | null
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
  isWatched?: boolean
  onToggleWatchlist?: (asset: AssetResponse) => void
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
  isWatched,
  onToggleWatchlist,
}: AssetDetailSheetProps) {
  const [activeTab, setActiveTab] = React.useState<"price" | "prediction">("price")

  return (
    <Sheet open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
      <SheetContent side="right" className="w-full sm:max-w-[680px] p-0 border-l border-border bg-background text-foreground overflow-hidden">
        {selectedAsset && (
          <div className="h-full relative px-8 pt-10 pb-12 flex flex-col justify-center overflow-hidden">
              <SheetHeader className="items-start text-left mb-8">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="size-20 rounded-[28px] bg-muted flex items-center justify-center font-black text-2xl shadow-2xl ring-1 ring-border">
                      {selectedAsset.symbol.slice(0, 3).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 size-7 rounded-xl bg-background border-2 border-background flex items-center justify-center shadow-lg">
                      <Activity className="size-3.5 text-green-500" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <SheetTitle className="text-4xl font-black tracking-tighter">
                      {selectedAsset.name}
                    </SheetTitle>
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

              {/* Status Cards */}
              <div className="grid grid-cols-1 mb-6">
                <div className="rounded-xl border border-border bg-card/50 px-4 py-3 space-y-0.5 transition-colors hover:bg-card w-fit min-w-[160px]">
                  <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                    <Activity className="size-2.5 text-green-500" />
                    Network Status
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-black">
                    <div className="size-1 rounded-full bg-green-500 animate-pulse" />
                    Active
                  </div>
                </div>
              </div>

              {/* Technical Details */}
              <div className="space-y-3 mb-8">
                <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Technical ID Details</h3>
                <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <span className="text-xs font-bold text-muted-foreground/80">Asset Identifier</span>
                    <Badge className="bg-muted text-foreground font-black rounded-md border-none px-2 py-0 text-[10px]">1</Badge>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-xs font-bold text-muted-foreground/80">CoinGecko Ref</span>
                    <span className="font-mono font-bold text-xs">{selectedAsset.name.toLowerCase()}</span>
                  </div>
                </div>
              </div>

              {/* Market Overview */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Live Market Overview</h3>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-border bg-card/50 px-4 py-3 space-y-0.5">
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Price</span>
                    <div className="text-lg font-black tracking-tight">
                      {formatCurrency(marketStats?.price)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/50 px-4 py-3 space-y-0.5">
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">24H Change</span>
                    <div className={`text-lg font-black tracking-tight ${(marketStats?.change24h ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {(marketStats?.change24h ?? 0) >= 0 ? "+" : ""}{marketStats?.change24h?.toFixed(2)}%
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/50 px-4 py-3 space-y-0.5">
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">24H Volume</span>
                    <div className="text-lg font-black tracking-tight truncate">
                      {formatCompactCurrency(marketStats?.volume)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs & Content */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex p-0.5 rounded-xl bg-muted/30 border border-border">
                    <button
                      onClick={() => setActiveTab("price")}
                      className={cn(
                        "px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all",
                        activeTab === "price" ? "bg-foreground text-background shadow-lg" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Price & Volume
                    </button>
                    <button
                      onClick={() => setActiveTab("prediction")}
                      className={cn(
                        "px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1.5",
                        activeTab === "prediction" ? "bg-foreground text-background shadow-lg" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <CircleDot className="size-3" /> Prediction
                    </button>
                  </div>

                  {activeTab === "price" && (
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
                  )}
                </div>

                {activeTab === "price" ? (
                  <div className="h-[340px] w-full rounded-2xl border border-border bg-card/50 p-6 relative overflow-hidden">
                    {chartLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                        <RefreshCw className="size-6 animate-spin text-foreground" />
                      </div>
                    )}
                    <AssetDetailChart
                      data={chartData}
                      config={{ price: { label: "Price", color: "#16a34a" } }}
                      currentPrice={marketStats?.price || 0}
                    />
                  </div>
                ) : (
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                        <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Model R² Score</span>
                        <div className="flex items-center gap-1.5 text-xl font-black text-green-500">
                          <TrendingUp className="size-4" />
                          0.89
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                        <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">RMSE Error</span>
                        <div className="text-xl font-black text-foreground">
                          0.0245
                        </div>
                      </div>
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
              </div>
            </div>
        )}
      </SheetContent>
    </Sheet>
  )
}