"use client"

import * as React from "react"
import { Search, RefreshCw, Grid, List, Plus, ChevronDown, Check } from "lucide-react"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { format } from "date-fns"
import { cn } from "~/lib/utils"
import { motion } from "framer-motion"
import type { AssetResponse } from "~/lib/api-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

interface WatchlistHeaderProps {
  lastUpdate: Date
  loadingWatchlist: boolean
  onRefresh: () => void
  search: string
  setSearch: (val: string) => void
  watchlistTimeRange: string
  setWatchlistTimeRange: (val: any) => void
  viewMode: "grid" | "list"
  setViewMode: (val: "grid" | "list") => void
  allAssets: AssetResponse[]
  loadingAssets: boolean
  onFetchAllAssets: () => void
  watchedIds: Set<string>
  addingId: string | null
  onAdd: (asset: AssetResponse) => void
  showAddPanel: boolean
  setShowAddPanel: (val: boolean) => void
}

export function WatchlistHeader({
  lastUpdate,
  loadingWatchlist,
  onRefresh,
  search,
  setSearch,
  watchlistTimeRange,
  setWatchlistTimeRange,
  viewMode,
  setViewMode,
  allAssets,
  loadingAssets,
  onFetchAllAssets,
  watchedIds,
  addingId,
  onAdd,
  showAddPanel,
  setShowAddPanel,
}: WatchlistHeaderProps) {
  const [assetSearch, setAssetSearch] = React.useState("")

  const filteredNewAssets = React.useMemo(() => {
    return allAssets
      .filter(a => !watchedIds.has(a.id))
      .filter(a => 
        a.symbol.toLowerCase().includes(assetSearch.toLowerCase()) || 
        a.name.toLowerCase().includes(assetSearch.toLowerCase())
      )
  }, [allAssets, watchedIds, assetSearch])

  return (
    <div className="flex flex-col gap-8 mb-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Main Watchlist</h1>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground/60">
            Updated {format(lastUpdate, "MMM dd, HH:mm")}
            <button onClick={onRefresh} className="hover:text-white transition-colors">
              <RefreshCw className={`size-3 ${loadingWatchlist ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-white transition-colors" />
            <Input
              placeholder="Find Assets"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-64 pl-11 rounded-[14px] border-white/5 bg-white/[0.03] text-sm focus-visible:ring-white/10 placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Time Range Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 px-4 rounded-[14px] gap-2 border-border/50 bg-card/30 hover:bg-card/50 text-foreground">
                <span className="text-sm font-bold uppercase">{watchlistTimeRange}</span>
                <ChevronDown className="size-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-24 bg-card border-border/50 p-1 rounded-xl">
              {["1h", "24h", "7d", "30d"].map((range) => (
                <DropdownMenuItem
                  key={range}
                  onClick={() => setWatchlistTimeRange(range)}
                  className="rounded-lg text-[10px] font-black uppercase tracking-widest focus:bg-muted"
                >
                  {range}
                  {watchlistTimeRange === range && <Check className="size-3 ml-auto text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Asset Dropdown */}
          <DropdownMenu onOpenChange={(open) => {
            if (open) {
              onFetchAllAssets()
              setAssetSearch("")
            }
          }}>
            <DropdownMenuTrigger asChild>
              <Button className="h-11 px-6 rounded-[14px] gap-2 font-bold text-sm bg-foreground text-background hover:bg-foreground/90 shadow-xl transition-all active:scale-95 group">
                Add
                <Plus className="size-4 stroke-[3]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-2 rounded-[20px] border-border/50 bg-card/95 backdrop-blur-3xl shadow-2xl">
              <div className="p-2 border-b border-border/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Find new assets..."
                    className="h-10 pl-9 rounded-xl text-xs bg-muted/50 border-none focus-visible:ring-primary/20"
                    autoFocus
                    value={assetSearch}
                    onChange={(e) => {
                      e.stopPropagation()
                      setAssetSearch(e.target.value)
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="max-h-[320px] overflow-y-auto space-y-1 p-1 scrollbar-thin">
                {loadingAssets ? (
                  <div className="py-12 text-center space-y-3">
                    <RefreshCw className="size-5 animate-spin mx-auto text-primary/50" />
                    <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-50">
                      Sourcing Assets...
                    </div>
                  </div>
                ) : filteredNewAssets.length === 0 ? (
                  <div className="py-12 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-50">
                    {assetSearch ? "No matches found" : "No new assets available"}
                  </div>
                ) : (
                  filteredNewAssets.map(asset => (
                    <DropdownMenuItem
                      key={asset.id}
                      onClick={() => onAdd(asset)}
                      className="flex items-center justify-between p-3 rounded-xl cursor-pointer focus:bg-muted group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-xs text-primary transition-transform group-hover:scale-110">
                          {asset.symbol.slice(0, 3)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm tracking-tight text-foreground">{asset.name}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{asset.symbol}</span>
                        </div>
                      </div>
                      {addingId === asset.id ? (
                        <RefreshCw className="size-4 animate-spin text-primary" />
                      ) : (
                        <div className="size-7 rounded-full bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-foreground hover:text-background">
                          <Plus className="size-4" />
                        </div>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-[14px] bg-muted/30 border border-border/50 ml-2 relative">
            <div className="absolute inset-1 flex items-center gap-1 z-0">
              <motion.div
                className="h-full rounded-lg bg-foreground shadow-lg"
                initial={false}
                animate={{
                  x: viewMode === "grid" ? 0 : 36, // 32px (icon size) + 4px (gap)
                  width: 32
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("grid")}
              className={cn(
                "size-8 rounded-lg relative z-10 transition-colors duration-200",
                viewMode === "grid" ? "text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Grid className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("list")}
              className={cn(
                "size-8 rounded-lg relative z-10 transition-colors duration-200",
                viewMode === "list" ? "text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
