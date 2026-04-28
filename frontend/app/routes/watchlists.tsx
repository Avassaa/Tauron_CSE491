"use client"

import * as React from "react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router"
import { ListChecks } from "lucide-react"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import {
  apiGet,
  apiPut,
  apiDelete,
  apiPost,
  type AssetResponse,
  type WatchlistEntryResponse,
  type WatchlistListResponse,
  type PaginatedResponse,
} from "~/lib/api-client"
import { useLiveTickers } from "~/lib/live-price-stream"
import { MOCK_ASSETS } from "~/lib/mock-data"
import {
  WatchlistCard,
  WatchlistTable,
  WatchlistHeader,
  WatchlistEmptyState,
  WatchlistSkeleton,
} from "~/components/watchlists"
import { AssetDetailSheet } from "~/components/assets/asset-detail-sheet"
import { AssetPagination } from "~/components/assets/asset-pagination"
import { type MarketDataResponse, type MlModelResponse } from "~/lib/api-client"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "~/components/ui/avatar"

type TimeRange = "1h" | "24h" | "7d" | "30d" | "1m" | "3m" | "1y" | "max"
const TIME_RANGES: TimeRange[] = ["1h", "24h", "7d", "30d", "1m", "3m", "1y", "max"]
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value: string) => UUID_REGEX.test(value)

type WatchlistListEntryResponse = {
  list_id: string
  asset: AssetResponse
}

function WatchlistCoinAvatar({ asset }: { asset: AssetResponse }) {
  const [fallbackTried, setFallbackTried] = React.useState(false)
  const [errored, setErrored] = React.useState(false)

  React.useEffect(() => {
    setFallbackTried(false)
    setErrored(false)
  }, [asset.symbol])

  const iconUrl = fallbackTried
    ? `https://assets.coincap.io/assets/icons/${asset.symbol.toLowerCase()}@2x.png`
    : `https://cryptoicons.org/api/icon/${asset.symbol.toLowerCase()}/64`

  return (
    <Avatar size="sm">
      {!errored ? (
        <img
          src={iconUrl}
          alt={`${asset.symbol} icon`}
          className="size-full object-cover"
          onError={() => {
            if (!fallbackTried) {
              setFallbackTried(true)
              return
            }
            setErrored(true)
          }}
        />
      ) : null}
      <AvatarFallback className="text-[9px] font-black">
        {asset.symbol.slice(0, 3).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

const formatCurrency = (val?: number) => {
  if (val === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(val)
}

const formatCompactCurrency = (val?: number) => {
  if (val === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function WatchlistPageClient() {
  const navigate = useNavigate()
  const [watchlist, setWatchlist] = React.useState<WatchlistEntryResponse[]>([])
  const [watchlistLists, setWatchlistLists] = React.useState<WatchlistListResponse[]>([])
  const [watchlistAssetsByListId, setWatchlistAssetsByListId] = React.useState<Record<string, AssetResponse[]>>({})
  const [selectedWatchlistList, setSelectedWatchlistList] = React.useState<WatchlistListResponse | null>(null)
  const [allAssets, setAllAssets] = React.useState<AssetResponse[]>([])
  const [loadingWatchlist, setLoadingWatchlist] = React.useState(true)
  const [loadingLists, setLoadingLists] = React.useState(true)
  const [loadingAssets, setLoadingAssets] = React.useState(false)
  const [removingId, setRemovingId] = React.useState<string | null>(null)
  const [addingId, setAddingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [showAddPanel, setShowAddPanel] = React.useState(false)
  const [lastUpdate, setLastUpdate] = React.useState(new Date())
  const [viewMode, setViewMode] = React.useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("watchlist_view_mode")
      return (saved === "grid" || saved === "list") ? saved : "grid"
    }
    return "grid"
  })

  React.useEffect(() => {
    localStorage.setItem("watchlist_view_mode", viewMode)
  }, [viewMode])
  const [page, setPage] = React.useState(1)
  const PAGE_SIZE = 20

  // Asset Detail states
  const [selectedAsset, setSelectedAsset] = React.useState<AssetResponse | null>(null)
  const [chartData, setChartData] = React.useState<any[]>([])
  const [chartLoading, setChartLoading] = React.useState(false)
  const [marketStats, setMarketStats] = React.useState<{
    price: number
    change24h: number
    volume: number
  } | null>(null)
  const [predictionModel, setPredictionModel] = React.useState<MlModelResponse | null>(null)
  const [availableModels, setAvailableModels] = React.useState<MlModelResponse[]>([])
  const [timeRange, setTimeRange] = React.useState<TimeRange>("7d")
  const [watchlistTimeRange, setWatchlistTimeRange] = React.useState<TimeRange>("24h")

  const fetchWatchlistLists = React.useCallback(async () => {
    setLoadingLists(true)
    try {
      const data = await apiGet<WatchlistListResponse[]>("/users/me/watchlists")
      setWatchlistLists(data)
      setSelectedWatchlistList((prev) =>
        prev ? data.find((list) => list.id === prev.id) ?? null : null,
      )
      const assetResults = await Promise.allSettled(
        data.map(async (list) => {
          const entries = await apiGet<WatchlistListEntryResponse[]>(
            `/users/me/watchlists/${list.id}/assets`,
          )
          return [list.id, entries.map((entry) => entry.asset)] as const
        }),
      )
      setWatchlistAssetsByListId((prev) => {
        const next = { ...prev }
        for (const result of assetResults) {
          if (result.status === "fulfilled") {
            const [listId, assets] = result.value
            next[listId] = assets
          }
        }
        return next
      })
    } catch (err) {
      console.error("API failed to fetch named watchlists:", err)
      setWatchlistLists([])
    } finally {
      setLoadingLists(false)
    }
  }, [])

  const fetchWatchlist = React.useCallback(async () => {
    if (!selectedWatchlistList) {
      setWatchlist([])
      setLoadingWatchlist(false)
      return
    }
    setLoadingWatchlist(true)
    setError(null)
    try {
      const data = await apiGet<WatchlistListEntryResponse[]>(
        `/users/me/watchlists/${selectedWatchlistList.id}/assets`,
      )
      setWatchlist(data.map((entry) => ({ user_id: "", asset: entry.asset })))
      setLastUpdate(new Date())
    } catch (err) {
      console.error("API failed to fetch watchlist:", err)
      setError("Failed to load watchlist from backend.")
      setWatchlist([])
    } finally {
      setLoadingWatchlist(false)
    }
  }, [selectedWatchlistList])

  const fetchAllAssets = React.useCallback(async () => {
    if (allAssets.length > 0) return
    setLoadingAssets(true)
    try {
      const data = await apiGet<PaginatedResponse<AssetResponse>>("/assets", { page_size: 100 })
      if (data.items && data.items.length > 0) {
        setAllAssets(data.items)
      } else {
        setAllAssets(MOCK_ASSETS)
      }
    } catch {
      setAllAssets(MOCK_ASSETS)
    } finally {
      setLoadingAssets(false)
    }
  }, [allAssets.length])

  const fetchChartData = React.useCallback(async (assetId: string | undefined, assetSymbol: string, range: TimeRange) => {
    setChartLoading(true)
    setMarketStats(null)
    setChartData([])
    try {
      const now = new Date()
      let timeFrom = new Date()
      let resolution = "1d"

      switch (range) {
        case "24h":
          timeFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          resolution = "1h"
          break
        case "7d":
          timeFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          break
        case "1m":
          timeFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          break
        case "3m":
          timeFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          break
        case "1y":
          timeFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          break
        case "max":
          timeFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          break
      }

      if (assetId) {
        const data = await apiGet<PaginatedResponse<MarketDataResponse>>("/market-data", {
          asset_id: assetId,
          time_from: timeFrom.toISOString(),
          time_to: now.toISOString(),
          resolution: resolution,
          page_size: 100,
        })

        if (data.items.length > 0) {
          const sortedItems = [...data.items].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
          const latest = sortedItems[sortedItems.length - 1]
          const first = sortedItems[0]
          const currentPrice = latest.close
          const currentVolume = latest.volume
          const priceChange = first.close > 0 ? ((latest.close - first.close) / first.close) * 100 : 0

          setMarketStats({
            price: currentPrice,
            change24h: priceChange,
            volume: currentVolume
          })

          const formatted = sortedItems.map(item => ({
            date: item.time,
            price: item.close,
            confidence: item.close * 0.95
          }))
          setChartData(formatted)
          return
        }
      }
      throw new Error("No backend market data for selected asset/range")
    } catch (err) {
      console.error("Failed to fetch backend chart data, trying Binance:", err)
      try {
        const symbol = `${assetSymbol.toUpperCase()}USDT`
        const interval =
          range === "24h" ? "1h" :
          range === "7d" ? "4h" :
          range === "1m" ? "1d" :
          range === "3m" ? "1d" :
          range === "1y" ? "1d" : "1d"
        const limit =
          range === "24h" ? 24 :
          range === "7d" ? 42 :
          range === "1m" ? 30 :
          range === "3m" ? 90 :
          range === "1y" ? 365 : 365

        const [tickerRes, klinesRes] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
          fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`),
        ])

        if (!tickerRes.ok || !klinesRes.ok) {
          throw new Error("Binance fallback unavailable")
        }

        const ticker = (await tickerRes.json()) as {
          lastPrice?: string
          priceChangePercent?: string
          quoteVolume?: string
        }
        const klines = (await klinesRes.json()) as Array<[number, string, string, string, string, string]>

        const points = klines
          .map((k) => {
            const close = Number.parseFloat(k[4])
            if (!Number.isFinite(close)) return null
            return {
              date: new Date(k[0]).toISOString(),
              price: close,
              confidence: close * 0.95,
            }
          })
          .filter((p): p is { date: string; price: number; confidence: number } => p != null)

        const sortedPoints = points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        if (sortedPoints.length === 0) throw new Error("No Binance chart points")

        const first = sortedPoints[0]
        const latest = sortedPoints[sortedPoints.length - 1]
        const lastPrice = Number.parseFloat(ticker.lastPrice || "")
        const priceChange = Number.parseFloat(ticker.priceChangePercent || "")
        const quoteVolume = Number.parseFloat(ticker.quoteVolume || "")

        setMarketStats({
          price: Number.isFinite(lastPrice) ? lastPrice : latest.price,
          change24h: Number.isFinite(priceChange)
            ? priceChange
            : first.price > 0
              ? ((latest.price - first.price) / first.price) * 100
              : 0,
          volume: Number.isFinite(quoteVolume) ? quoteVolume : 0,
        })
        setChartData(sortedPoints)
      } catch (fallbackErr) {
        console.error("Binance fallback failed:", fallbackErr)
        setMarketStats(null)
        setChartData([])
      }
    } finally {
      setChartLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (selectedAsset) {
      const backendAssetId = isUuid(selectedAsset.id) ? selectedAsset.id : undefined
      void fetchChartData(backendAssetId, selectedAsset.symbol, timeRange)
      if (!backendAssetId) {
        setAvailableModels([])
        setPredictionModel(null)
        return
      }
      apiGet<PaginatedResponse<MlModelResponse>>("/ml-models", { asset_id: backendAssetId })
        .then((data) => {
          if (data.items.length > 0) {
            setAvailableModels(data.items)
            const activeModel = data.items.find((m) => m.is_active) || data.items[0]
            setPredictionModel(activeModel)
          } else {
            setAvailableModels([])
            setPredictionModel(null)
          }
        })
        .catch(() => {
          setAvailableModels([])
          setPredictionModel(null)
        })
    } else {
      setChartData([])
      setMarketStats(null)
      setPredictionModel(null)
      setAvailableModels([])
    }
  }, [selectedAsset, timeRange, fetchChartData])

  React.useEffect(() => {
    void fetchWatchlistLists()
  }, [fetchWatchlistLists])

  React.useEffect(() => {
    void fetchWatchlist()
  }, [fetchWatchlist])

  const handleRemove = async (assetId: string, symbol: string) => {
    if (!selectedWatchlistList) return
    const itemToRemove = watchlist.find(w => w.asset.id === assetId)
    if (!itemToRemove) return

    setRemovingId(assetId)

    const previousWatchlist = [...watchlist]

    try {
      setWatchlist((prev) => prev.filter((w) => w.asset.id !== assetId))

      toast.success(`Removed ${symbol}`, {
        description: "The asset has been removed from your watchlist.",
        action: {
          label: <span className="underline font-bold">Undo</span>,
          onClick: () => {
            setWatchlist(previousWatchlist)
            void apiPut(`/users/me/watchlists/${selectedWatchlistList.id}/assets/${assetId}`)
            toast.success(`Restored ${symbol}`, {
              description: "The asset has been added back to your watchlist."
            })
          },
        },
      })

      await apiDelete(`/users/me/watchlists/${selectedWatchlistList.id}/assets/${assetId}`)
    } catch (err) {
      console.warn("Backend sync failed during removal:", err)
    } finally {
      setRemovingId(null)
    }
  }

  const handleAdd = async (asset: AssetResponse) => {
    if (!selectedWatchlistList) return
    setAddingId(asset.id)
    const previousWatchlist = [...watchlist]
    let added = false
    try {
      let backendId = asset.id
      if (!isUuid(backendId)) {
        const ensured = await apiPost<AssetResponse>("/assets/ensure", {
          symbol: asset.symbol,
          name: asset.name,
          category: asset.category || "General",
          coingecko_id: asset.coingecko_id || null,
          is_active: true,
        })
        backendId = ensured.id
      }

      await apiPut(`/users/me/watchlists/${selectedWatchlistList.id}/assets/${backendId}`)
      await fetchWatchlist()
      added = true
      toast.success(`Added ${asset.symbol} to watchlist.`, {
        action: {
          label: <span className="underline font-bold">Undo</span>,
          onClick: () => {
            setWatchlist(previousWatchlist)
            void apiDelete(`/users/me/watchlists/${selectedWatchlistList.id}/assets/${backendId}`)
            toast.success(`Removed ${asset.symbol}`, {
              description: "The asset has been removed from your watchlist."
            })
          },
        },
      })
    } catch (err) {
      console.warn("Backend sync failed when adding:", err)
      toast.error(`Failed to add ${asset.symbol} to watchlist`)
    } finally {
      if (!added) {
        setWatchlist(previousWatchlist)
      }
      setAddingId(null)
    }
  }

  React.useEffect(() => {
    setPage(1)
  }, [search])

  const watchedIds = new Set(watchlist.map((w) => w.asset.id))

  const filteredWatchlist = watchlist.filter(({ asset }) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return asset.symbol.toLowerCase().includes(q) || asset.name.toLowerCase().includes(q)
  })

  const totalPages = Math.ceil(filteredWatchlist.length / PAGE_SIZE)
  const paginatedWatchlist = filteredWatchlist.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const watchlistTickerSymbols = React.useMemo(
    () => filteredWatchlist.map(({ asset }) => `${asset.symbol.toUpperCase()}USDT`),
    [filteredWatchlist],
  )
  const liveTickerBySymbol = useLiveTickers(watchlistTickerSymbols)
  const showListOverview = selectedWatchlistList === null

  return (
    <DashboardLayout title={selectedWatchlistList?.name || "Watchlists"}>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8">

          <Breadcrumb className="mt-4 mb-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                {showListOverview ? (
                  <BreadcrumbPage>Watchlists</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    asChild
                    className="cursor-pointer"
                  >
                    <button
                      type="button"
                      onClick={() => {
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
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{selectedWatchlistList.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>

          {showListOverview ? null : (
            <WatchlistHeader
              title={selectedWatchlistList?.name}
              lastUpdate={lastUpdate}
              loadingWatchlist={loadingWatchlist}
              onRefresh={() => void fetchWatchlist()}
              search={search}
              setSearch={setSearch}
              watchlistTimeRange={watchlistTimeRange}
              setWatchlistTimeRange={setWatchlistTimeRange}
              viewMode={viewMode}
              setViewMode={setViewMode}
              allAssets={allAssets}
              loadingAssets={loadingAssets}
              onFetchAllAssets={fetchAllAssets}
              watchedIds={watchedIds}
              addingId={addingId}
              onAdd={handleAdd}
              showAddPanel={showAddPanel}
              setShowAddPanel={setShowAddPanel}
            />
          )}

          <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {showListOverview ? (
                loadingLists ? (
                  <WatchlistSkeleton viewMode="grid" />
                ) : watchlistLists.length === 0 ? (
                  <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-border bg-card/30 p-10 text-center">
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {watchlistLists.map((list) => {
                      const trackedAssets = watchlistAssetsByListId[list.id] || []
                      const visibleAssets = trackedAssets.slice(0, 5)
                      const remainingAssets = Math.max(trackedAssets.length - visibleAssets.length, 0)

                      return (
                        <button
                          key={list.id}
                          type="button"
                          onClick={() => {
                            setSelectedWatchlistList(list)
                            setSearch("")
                            setPage(1)
                          }}
                          className="group rounded-3xl border-2 border-border/50 bg-card/40 p-5 text-left shadow-2xl shadow-primary/5 transition-colors hover:border-primary/40 hover:bg-card"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="truncate text-xl font-black tracking-tight text-foreground group-hover:text-primary">
                              {list.name}
                            </h3>
                            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                              Created {new Date(list.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="mt-3 space-y-1">
                            <p className="text-xs font-bold text-muted-foreground">
                              {trackedAssets.length} tracked asset{trackedAssets.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="mt-5 flex items-center justify-between gap-3">
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
                            <span className="text-[10px] font-black uppercase tracking-wider text-primary opacity-0 transition-opacity group-hover:opacity-100">
                              View Assets
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              ) : error && (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {!showListOverview && (loadingWatchlist ? (
                <WatchlistSkeleton viewMode={viewMode} />
              ) : filteredWatchlist.length === 0 ? (
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
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {paginatedWatchlist.map(({ asset }) => (
                            <WatchlistCard
                              key={asset.id}
                              asset={asset}
                              timeRange={watchlistTimeRange}
                              isWatched={watchedIds.has(asset.id)}
                              onRemove={handleRemove}
                              onSelect={setSelectedAsset}
                              tickerBySymbol={liveTickerBySymbol}
                            />
                          ))}
                        </div>
                      ) : (
                        <WatchlistTable
                          watchlist={paginatedWatchlist}
                          timeRange={watchlistTimeRange}
                          onRemove={handleRemove}
                          onSelect={setSelectedAsset}
                          tickerBySymbol={liveTickerBySymbol}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                  <div className="flex justify-end mt-4">
                    <AssetPagination
                      page={page}
                      totalPages={totalPages}
                      setPage={setPage}
                      loading={loadingWatchlist}
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
            predictionModel={predictionModel}
            setPredictionModel={setPredictionModel}
            availableModels={availableModels}
            formatCurrency={formatCurrency}
            formatCompactCurrency={formatCompactCurrency}
            isWatched={selectedAsset ? watchedIds.has(selectedAsset.id) : false}
            onToggleWatchlist={(asset) => {
              if (watchedIds.has(asset.id)) {
                void handleRemove(asset.id, asset.symbol)
              } else {
                void handleAdd(asset)
              }
            }}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function WatchlistsPage() {
  return <WatchlistPageClient />
}
