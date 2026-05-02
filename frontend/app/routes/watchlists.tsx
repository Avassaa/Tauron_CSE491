"use client"

import * as React from "react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useSearchParams } from "react-router"
import { ArrowRight, Edit3, ExternalLink, Grid, List, ListChecks, MoreVertical, Plus, Trash2 } from "lucide-react"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { PageBlueBackdrop } from "~/components/dashboard/page-blue-backdrop"
import {
  apiGet,
  apiPut,
  apiDelete,
  apiPost,
  apiPatch,
  type AssetResponse,
  type WatchlistEntryResponse,
  type WatchlistListResponse,
  type PaginatedResponse,
} from "~/lib/api-client"

import {
  WatchlistCard,
  WatchlistHeader,
  WatchlistEmptyState,
  WatchlistSkeleton,
  CreateWatchlistDialog,
  RenameWatchlistDialog,
  RemoveWatchlistDialog,
  WatchlistCoinAvatar,
} from "~/components/watchlists"
import { AssetDetailSheet, AssetTable, AssetPagination } from "~/components/assets"
import { useWatchlist } from "~/hooks/use-watchlist"
import { useMarketData } from "~/hooks/use-market-data"
import { type MarketDataResponse, type MlModelResponse } from "~/lib/api-client"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import {
  AvatarGroup,
  AvatarGroupCount,
} from "~/components/ui/avatar"
import {
  formatCurrency,
  formatCompactCurrency,
} from "~/lib/currency"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"

type TimeRange = "24h" | "7d" | "30d" | "1m" | "3m" | "1y" | "max"
const TIME_RANGES: TimeRange[] = ["24h", "7d", "30d", "1m", "3m", "1y", "max"]


const mergePopularAssets = (primary: AssetResponse[], targetCount = 60) => {
  const seen = new Set<string>()
  const merged: AssetResponse[] = []
  for (const asset of primary) {
    const symbol = asset.symbol.toUpperCase()
    if (seen.has(symbol)) continue
    seen.add(symbol)
    merged.push(asset)
    if (merged.length >= targetCount) break
  }
  return merged
}

function WatchlistPageClient() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedWatchlistList, setSelectedWatchlistList] = React.useState<WatchlistListResponse | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [editWatchlist, setEditWatchlist] = React.useState<WatchlistListResponse | null>(null)
  const [updatingWatchlist, setUpdatingWatchlist] = React.useState(false)
  const [deleteWatchlist, setDeleteWatchlist] = React.useState<WatchlistListResponse | null>(null)
  const [deletingWatchlist, setDeletingWatchlist] = React.useState(false)
  const [allAssets, setAllAssets] = React.useState<AssetResponse[]>([])
  const [loadingAssets, setLoadingAssets] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [lastUpdate, setLastUpdate] = React.useState(new Date())
  const [viewMode, setViewMode] = React.useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("watchlist_view_mode")
      return (saved === "grid" || saved === "list") ? saved : "grid"
    }
    return "grid"
  })
  const [overviewViewMode, setOverviewViewMode] = React.useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("watchlist_overview_view_mode")
      return (saved === "grid" || saved === "list") ? saved : "grid"
    }
    return "grid"
  })

  React.useEffect(() => {
    localStorage.setItem("watchlist_view_mode", viewMode)
  }, [viewMode])
  React.useEffect(() => {
    localStorage.setItem("watchlist_overview_view_mode", overviewViewMode)
  }, [overviewViewMode])
  const [page, setPage] = React.useState(1)
  const PAGE_SIZE = 20

  // Asset Detail states
  const [selectedAsset, setSelectedAsset] = React.useState<AssetResponse | null>(null)
  const [timeRange, setTimeRange] = React.useState<TimeRange>("7d")
  const [watchlistTimeRange, setWatchlistTimeRange] = React.useState<TimeRange>("24h")

  const [sortConfig, setSortConfig] = React.useState<{
    key: string
    direction: "asc" | "desc"
  } | null>(null)

  // Custom Hooks
  const {
    watchlistLists,
    watchlistAssetsByListId,
    watchedIds,
    creatingWatchlist,
    addingId,
    toggleWatchlist,
    toggleAssetInNamedWatchlist,
    addAssetToNamedWatchlist,
    createWatchlistList,
    refresh: refreshWatchlist
  } = useWatchlist(allAssets)

  const {
    marketDataMap,
    chartData,
    chartLoading,
    marketStats,
    setMarketStats,
    setChartData,
    fetchEnrichedMarketData,
    fetchChartData
  } = useMarketData()

  React.useEffect(() => {
    const currentParam = searchParams.get("watchlist")
    if (currentParam) {
      const found = watchlistLists.find((w) => w.name === currentParam)
      if (found && (!selectedWatchlistList || selectedWatchlistList.id !== found.id)) {
        setSelectedWatchlistList(found)
        setSearch("")
        setPage(1)
      }
    } else if (selectedWatchlistList) {
      setSelectedWatchlistList(null)
      setSearch("")
      setPage(1)
    }
  }, [searchParams, watchlistLists, selectedWatchlistList])

  const currentWatchlistAssets = React.useMemo(() => {
    if (!selectedWatchlistList) return []
    return watchlistAssetsByListId[selectedWatchlistList.id] || []
  }, [selectedWatchlistList, watchlistAssetsByListId])

  // Fetch enriched market data when current watchlist assets change
  React.useEffect(() => {
    if (currentWatchlistAssets.length > 0) {
      void fetchEnrichedMarketData(currentWatchlistAssets)
    }
  }, [currentWatchlistAssets, fetchEnrichedMarketData])

  const fetchWatchlist = React.useCallback(async () => {
    refreshWatchlist()
    setLastUpdate(new Date())
  }, [refreshWatchlist])

  const handleCreateWatchlist = React.useCallback(async (name: string) => {
    const success = await createWatchlistList(name)
    if (success) {
      setCreateDialogOpen(false)
      // The hook handles refreshing the lists
    }
  }, [createWatchlistList])

  const openEditWatchlist = React.useCallback((list: WatchlistListResponse) => {
    setEditWatchlist(list)
  }, [])

  const updateWatchlistName = React.useCallback(async (name: string) => {
    if (!editWatchlist) return
    setUpdatingWatchlist(true)
    try {
      const updated = await apiPatch<WatchlistListResponse>(`/users/me/watchlists/${editWatchlist.id}`, { name })
      refreshWatchlist()
      setSelectedWatchlistList((prev) => (prev?.id === updated.id ? updated : prev))
      setEditWatchlist(null)
      toast.success("Watchlist renamed")
    } catch {
      toast.error("Failed to rename watchlist")
    } finally {
      setUpdatingWatchlist(false)
    }
  }, [editWatchlist, refreshWatchlist])

  const removeWatchlistList = React.useCallback(async () => {
    if (!deleteWatchlist) return
    setDeletingWatchlist(true)
    try {
      await apiDelete(`/users/me/watchlists/${deleteWatchlist.id}`)
      refreshWatchlist()
      setSelectedWatchlistList((prev) => (prev?.id === deleteWatchlist.id ? null : prev))
      setDeleteWatchlist(null)
      toast.success("Watchlist removed")
    } catch {
      toast.error("Failed to remove watchlist")
    } finally {
      setDeletingWatchlist(false)
    }
  }, [deleteWatchlist, refreshWatchlist])

  const openWatchlistList = React.useCallback((list: WatchlistListResponse) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("watchlist", list.name)
      return next
    })
    setSelectedWatchlistList(list)
    setSearch("")
    setPage(1)
  }, [setSearchParams])

  const fetchAllAssets = React.useCallback(async () => {
    if (allAssets.length > 0) return
    setLoadingAssets(true)
    try {
      const data = await apiGet<PaginatedResponse<AssetResponse>>("/assets", { page_size: 500 })
      setAllAssets(mergePopularAssets(data.items || []))
    } catch (err) {
      console.error("API failed to fetch addable assets:", err)
      setAllAssets([])
    } finally {
      setLoadingAssets(false)
    }
  }, [allAssets.length])

  // Asset Detail Management
  const lastSelectedAssetId = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (selectedAsset) {
      const isNewAsset = selectedAsset.id !== lastSelectedAssetId.current
      if (isNewAsset) {
        setChartData([])
        setMarketStats(null)
        lastSelectedAssetId.current = selectedAsset.id
      }
      void fetchChartData(selectedAsset, timeRange.toUpperCase() as any)
    } else {
      lastSelectedAssetId.current = null
      setChartData([])
      setMarketStats(null)
    }
  }, [selectedAsset, timeRange, fetchChartData, setChartData, setMarketStats])

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      return { key, direction: "desc" }
    })
  }

  const handleRemove = async (assetId: string, symbol: string) => {
    if (!selectedWatchlistList) return
    await toggleAssetInNamedWatchlist({ id: assetId, symbol } as any, selectedWatchlistList.id, true)
  }

  const handleAdd = async (asset: AssetResponse) => {
    if (!selectedWatchlistList) return
    await addAssetToNamedWatchlist(asset, selectedWatchlistList.id)
  }


  const filteredWatchlist = currentWatchlistAssets.filter((asset) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return asset.symbol.toLowerCase().includes(q) || asset.name.toLowerCase().includes(q)
  })

  const sortedWatchlist = React.useMemo(() => {
    if (!sortConfig) return filteredWatchlist
    return [...filteredWatchlist].sort((a, b) => {
      let valA: any = (marketDataMap[a.id] as any)?.[sortConfig.key] || (a as any)[sortConfig.key]
      let valB: any = (marketDataMap[b.id] as any)?.[sortConfig.key] || (b as any)[sortConfig.key]

      if (sortConfig.key === "change1h") { valA = marketDataMap[a.id]?.price_change_1h; valB = marketDataMap[b.id]?.price_change_1h }
      if (sortConfig.key === "change24h") { valA = marketDataMap[a.id]?.price_change_24h; valB = marketDataMap[b.id]?.price_change_24h }
      if (sortConfig.key === "change7d") { valA = marketDataMap[a.id]?.price_change_7d; valB = marketDataMap[b.id]?.price_change_7d }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })
  }, [filteredWatchlist, sortConfig, marketDataMap])

  const totalPages = Math.ceil(sortedWatchlist.length / PAGE_SIZE)
  const paginatedWatchlist = sortedWatchlist.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const selectedAssetWatchlistMembership = React.useMemo(() => {
    if (!selectedAsset) return {}
    return Object.fromEntries(
      watchlistLists.map((list) => [
        list.id,
        (watchlistAssetsByListId[list.id] || []).some(a => a.id === selectedAsset.id || a.symbol.toUpperCase() === selectedAsset.symbol.toUpperCase()),
      ])
    )
  }, [selectedAsset, watchlistAssetsByListId, watchlistLists])

  const showListOverview = selectedWatchlistList === null

  return (
    <DashboardLayout title={selectedWatchlistList?.name || "Watchlists"}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
      <div
        className="relative flex-1 overflow-y-auto"
        style={{ paddingTop: "var(--market-banner-offset, 0px)" }}
      >
        <PageBlueBackdrop />
        <div className="relative z-[1] flex flex-1 flex-col gap-4 px-4 pb-4 pt-8 md:px-8 md:pb-8 md:pt-10">

          <Breadcrumb className="mt-4 mb-4">
            <BreadcrumbList className="flex-wrap">
              <BreadcrumbItem>
                {showListOverview ? (
                  <BreadcrumbPage className="font-black text-foreground">Watchlists</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    asChild
                    className="cursor-pointer font-bold"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev)
                          next.delete("watchlist")
                          return next
                        })
                        setSelectedWatchlistList(null)
                        setSearch("")
                        setPage(1)
                      }}
                    >
                      Watchlists
                    </button>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!showListOverview && selectedWatchlistList ? (
                <>
                  <BreadcrumbSeparator className="opacity-40" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-black text-foreground max-w-[150px] truncate">
                      {selectedWatchlistList.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>

          {showListOverview ? null : (
            <WatchlistHeader
              title={selectedWatchlistList?.name}
              lastUpdate={lastUpdate}
              loadingWatchlist={false} // Hook handles loading
              onRefresh={() => void fetchWatchlist()}
              search={search}
              setSearch={setSearch}
              watchlistTimeRange={watchlistTimeRange}
              setWatchlistTimeRange={setWatchlistTimeRange}
              timeRangeLoading={false}
              viewMode={viewMode}
              setViewMode={setViewMode}
              allAssets={allAssets}
              loadingAssets={loadingAssets}
              onFetchAllAssets={fetchAllAssets}
              watchedIds={watchedIds}
              addingId={addingId}
              onAdd={handleAdd}
              showAddPanel={false}
              setShowAddPanel={() => {}}
              onRenameWatchlist={
                selectedWatchlistList ? () => openEditWatchlist(selectedWatchlistList) : undefined
              }
              onDeleteWatchlist={
                selectedWatchlistList ? () => setDeleteWatchlist(selectedWatchlistList) : undefined
              }
            />
          )}

          {showListOverview ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Watchlists</h1>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {watchlistLists.length} saved list{watchlistLists.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        className="size-11 rounded-2xl bg-black text-white shadow-sm hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                        onClick={() => setCreateDialogOpen(true)}
                        aria-label="Create watchlist"
                      >
                        <Plus className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Create watchlist</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex rounded-2xl border border-border/50 bg-card/75 p-1 shadow-sm relative gap-1">
                  <div className="absolute inset-1 flex items-center gap-1 z-0">
                    <motion.div
                      className="h-full rounded-xl bg-foreground shadow-lg"
                      initial={false}
                      animate={{
                        x: overviewViewMode === "grid" ? 0 : 44,
                        width: 40
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setOverviewViewMode("grid")}
                          className={`flex size-10 items-center justify-center rounded-xl relative z-10 transition-colors duration-200 ${
                            overviewViewMode === "grid"
                              ? "text-background"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          aria-label="Grid view"
                        >
                          <Grid className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Grid view</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setOverviewViewMode("list")}
                          className={`flex size-10 items-center justify-center rounded-xl relative z-10 transition-colors duration-200 ${
                            overviewViewMode === "list"
                              ? "text-background"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          aria-label="List view"
                        >
                          <List className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Table view</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {showListOverview ? (
                watchlistLists.length === 0 ? (
                  <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-border bg-card/75 p-10 text-center">
                    <div className="space-y-3">
                      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <ListChecks className="size-6" />
                      </div>
                      <h3 className="text-lg font-black tracking-tight">No watchlists yet</h3>
                      <p className="max-w-md text-sm text-muted-foreground">
                        Create a watchlist from an asset drawer, then come back here to open it.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/assets")}
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground"
                      >
                        Browse Assets
                      </button>
                    </div>
                  </div>
                ) : (
                  <TooltipProvider>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={overviewViewMode}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="w-full"
                      >
                        {overviewViewMode === "list" ? (
                  <div className="overflow-x-auto rounded-3xl border border-border/50 bg-card/80 shadow-2xl shadow-primary/5">
                    <div className="min-w-[600px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-border/50 bg-white/28 dark:bg-muted/40">
                            <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-foreground/70">
                              Name
                            </TableHead>
                            <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-foreground/70">
                              Tracked Assets
                            </TableHead>
                            <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-foreground/70">
                              Created
                            </TableHead>
                            <TableHead className="w-[120px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                        {watchlistLists.map((list) => {
                          const trackedAssets = watchlistAssetsByListId[list.id] || []
                          const visibleAssets = trackedAssets.slice(0, 5)
                          const remainingAssets = Math.max(trackedAssets.length - visibleAssets.length, 0)

                          return (
                            <ContextMenu key={list.id}>
                              <ContextMenuTrigger asChild>
                                <TableRow
                                  onClick={() => openWatchlistList(list)}
                                  className="group cursor-pointer border-border/40 transition-colors hover:bg-primary/[0.03]"
                                >
                              <TableCell className="px-6 py-5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-block max-w-[240px] truncate text-sm font-black tracking-tight text-foreground group-hover:text-primary">
                                      {list.name}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{list.name}</TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  {trackedAssets.length > 0 ? (
                                    <AvatarGroup>
                                      {visibleAssets.map((asset) => (
                                        <WatchlistCoinAvatar key={asset.id} asset={asset} />
                                      ))}
                                      {remainingAssets > 0 ? (
                                        <AvatarGroupCount className="text-[10px] font-black">
                                          +{remainingAssets}
                                        </AvatarGroupCount>
                                      ) : null}
                                    </AvatarGroup>
                                  ) : (
                                    <span className="text-xs font-bold text-muted-foreground">
                                      No tracked assets
                                    </span>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-xs font-bold text-muted-foreground">
                                        {trackedAssets.length} asset{trackedAssets.length === 1 ? "" : "s"}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {trackedAssets.length} tracked asset{trackedAssets.length === 1 ? "" : "s"}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                              <TableCell className="px-6 py-5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs font-bold text-muted-foreground">
                                      {new Date(list.created_at).toLocaleDateString("en-US")}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Created {new Date(list.created_at).toLocaleString("en-US")}
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell
                                className="px-6 py-5 text-right"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
                                        aria-label={`Actions for ${list.name}`}
                                      >
                                        <MoreVertical className="size-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem className="cursor-pointer" onSelect={() => openEditWatchlist(list)}>
                                        <Edit3 className="size-4" />
                                        Rename
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        variant="destructive"
                                        className="cursor-pointer"
                                        onSelect={() => setDeleteWatchlist(list)}
                                      >
                                        <Trash2 className="size-4" />
                                        Remove
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <ArrowRight className="size-4 translate-x-2 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100" />
                                </div>
                              </TableCell>
                                </TableRow>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-44">
                                <ContextMenuItem className="cursor-pointer" onSelect={() => openWatchlistList(list)}>
                                  <ExternalLink className="size-4" />
                                  Open
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem className="cursor-pointer" onSelect={() => openEditWatchlist(list)}>
                                  <Edit3 className="size-4" />
                                  Rename
                                </ContextMenuItem>
                                <ContextMenuItem
                                  variant="destructive"
                                  className="cursor-pointer"
                                  onSelect={() => setDeleteWatchlist(list)}
                                >
                                  <Trash2 className="size-4" />
                                  Remove
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                    ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {watchlistLists.map((list) => {
                      const trackedAssets = watchlistAssetsByListId[list.id] || []
                      const visibleAssets = trackedAssets.slice(0, 5)
                      const remainingAssets = Math.max(trackedAssets.length - visibleAssets.length, 0)

                      return (
                        <ContextMenu key={list.id}>
                          <ContextMenuTrigger asChild>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => openWatchlistList(list)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault()
                                  openWatchlistList(list)
                                }
                              }}
                              className="group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-border/50 bg-card/40 p-5 text-left shadow-2xl shadow-primary/5 transition-colors hover:border-primary/40 hover:bg-card"
                            >
                          <div
                            className="absolute right-4 top-4 z-10"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
                                  aria-label={`Actions for ${list.name}`}
                                >
                                  <MoreVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem className="cursor-pointer" onSelect={() => openEditWatchlist(list)}>
                                  <Edit3 className="size-4" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  className="cursor-pointer"
                                  onSelect={() => setDeleteWatchlist(list)}
                                >
                                  <Trash2 className="size-4" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="absolute right-5 top-1/2 flex size-9 -translate-y-1/2 translate-x-2 items-center justify-center rounded-full border border-border/60 bg-black text-white opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:border-primary/40 group-hover:opacity-100 dark:bg-white dark:text-black">
                            <ArrowRight className="size-4" />
                          </div>
                          <div className="grid min-h-[116px] grid-cols-[minmax(0,1fr)_120px] items-stretch gap-4 pr-12">
                            <div className="flex min-w-0 flex-col justify-between">
                              <div>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <h3 className="truncate text-xl font-black tracking-tight text-foreground group-hover:text-primary">
                                      {list.name}
                                    </h3>
                                  </TooltipTrigger>
                                  <TooltipContent>{list.name}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className="mt-3 w-fit text-xs font-bold text-muted-foreground">
                                      {trackedAssets.length} tracked asset{trackedAssets.length === 1 ? "" : "s"}
                                    </p>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {trackedAssets.length} tracked asset{trackedAssets.length === 1 ? "" : "s"}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="mt-5">
                                {trackedAssets.length > 0 ? (
                                  <AvatarGroup>
                                    {visibleAssets.map((asset) => (
                                      <WatchlistCoinAvatar key={asset.id} asset={asset} />
                                    ))}
                                    {remainingAssets > 0 ? (
                                      <AvatarGroupCount className="text-[10px] font-black">
                                        +{remainingAssets}
                                      </AvatarGroupCount>
                                    ) : null}
                                  </AvatarGroup>
                                ) : (
                                  <span className="text-xs font-bold text-muted-foreground">
                                    No tracked assets yet
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex min-w-[120px] flex-col items-end justify-between text-right">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                    Created {new Date(list.created_at).toLocaleDateString("en-US")}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Created {new Date(list.created_at).toLocaleString("en-US")}
                                </TooltipContent>
                              </Tooltip>
                              <span className="text-[10px] font-black uppercase tracking-wider text-primary opacity-0 transition-opacity group-hover:opacity-100">
                                View Assets
                              </span>
                            </div>
                          </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-44">
                            <ContextMenuItem className="cursor-pointer" onSelect={() => openWatchlistList(list)}>
                              <ExternalLink className="size-4" />
                              Open
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem className="cursor-pointer" onSelect={() => openEditWatchlist(list)}>
                              <Edit3 className="size-4" />
                              Rename
                            </ContextMenuItem>
                            <ContextMenuItem
                              variant="destructive"
                              className="cursor-pointer"
                              onSelect={() => setDeleteWatchlist(list)}
                            >
                              <Trash2 className="size-4" />
                              Remove
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      )
                    })}
                  </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </TooltipProvider>
                )
              ) : null}

              {!showListOverview && (sortedWatchlist.length === 0 ? (
                <WatchlistEmptyState
                  search={search}
                  onBrowseAssets={() => {
                    navigate("/assets")
                  }}
                />
              ) : (
                <>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={viewMode}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="flex-1"
                    >
                      {viewMode === "grid" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {paginatedWatchlist.map((asset) => (
                            <WatchlistCard
                              key={asset.id}
                              asset={asset}
                              timeRange={watchlistTimeRange}
                              isWatched={watchedIds.has(asset.id)}
                              onRemove={handleRemove}
                              onSelect={setSelectedAsset}
                              marketData={marketDataMap[asset.id]}
                            />
                          ))}
                        </div>
                      ) : (
                        <AssetTable
                          assets={paginatedWatchlist}
                          marketDataMap={marketDataMap}
                          currentPage={page}
                          pageSize={PAGE_SIZE}
                          sortConfig={sortConfig}
                          handleSort={handleSort}
                          setSelectedAsset={setSelectedAsset}
                          quoteCurrency="USD"
                          onToggleWatchlist={toggleWatchlist}
                          watchlistIds={watchedIds}
                          watchlistLists={watchlistLists}
                          onToggleWatchlistList={toggleAssetInNamedWatchlist}
                          onAddToWatchlistList={addAssetToNamedWatchlist}
                          watchlistAssetsByListId={watchlistAssetsByListId}
                          onCreateWatchlistList={() => setCreateDialogOpen(true)}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                  <div className="flex justify-end mt-4">
                    <AssetPagination
                      page={page}
                      totalPages={totalPages}
                      setPage={setPage}
                      loading={false}
                    />
                  </div>
                </>
              ))}
            </div>
          </div>

          <AssetDetailSheet
            selectedAsset={selectedAsset}
            setSelectedAsset={setSelectedAsset}
            marketStats={marketStats}
            chartData={chartData}
            chartLoading={chartLoading}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            TIME_RANGES={TIME_RANGES}
            predictionModel={null}
            setPredictionModel={() => {}}
            availableModels={[]}
            formatCurrency={formatCurrency}
            formatCompactCurrency={formatCompactCurrency}
            isWatched={selectedAsset ? watchedIds.has(selectedAsset.id) : false}
            onToggleWatchlist={toggleWatchlist}
            watchlistLists={watchlistLists}
            watchlistMembershipByListId={selectedAssetWatchlistMembership}
            onAddToWatchlistList={addAssetToNamedWatchlist}
            onToggleWatchlistList={toggleAssetInNamedWatchlist}
            onCreateWatchlistList={() => setCreateDialogOpen(true)}
          />

          <CreateWatchlistDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onConfirm={handleCreateWatchlist}
            loading={creatingWatchlist}
          />

          <RenameWatchlistDialog
            watchlist={editWatchlist}
            onOpenChange={(open) => !open && setEditWatchlist(null)}
            onConfirm={updateWatchlistName}
            loading={updatingWatchlist}
          />

          <RemoveWatchlistDialog
            watchlist={deleteWatchlist}
            onOpenChange={(open) => !open && setDeleteWatchlist(null)}
            onConfirm={removeWatchlistList}
            loading={deletingWatchlist}
          />
        </div>
      </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuItem className="cursor-pointer" onSelect={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" />
            Create Watchlist
          </ContextMenuItem>
          {selectedWatchlistList ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="cursor-pointer"
                onSelect={() => openEditWatchlist(selectedWatchlistList)}
              >
                <Edit3 className="size-4" />
                Rename Current
              </ContextMenuItem>
              <ContextMenuItem
                variant="destructive"
                className="cursor-pointer"
                onSelect={() => setDeleteWatchlist(selectedWatchlistList)}
              >
                <Trash2 className="size-4" />
                Remove Current
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    </DashboardLayout>
  )
}

export default function WatchlistsPage() {
  return <WatchlistPageClient />
}
