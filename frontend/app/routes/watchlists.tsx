"use client"

import * as React from "react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import {
  apiGet,
  apiPut,
  apiDelete,
  type AssetResponse,
  type WatchlistEntryResponse,
  type PaginatedResponse,
} from "~/lib/api-client"
import { MOCK_WATCHLIST, MOCK_ASSETS, MOCK_MARKET_DATA, MOCK_MODELS, MOCK_MARKET_STATS_FALLBACK } from "~/lib/mock-data"
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

type TimeRange = "1h" | "24h" | "7d" | "30d" | "1m" | "3m" | "1y" | "max"
const TIME_RANGES: TimeRange[] = ["1h", "24h", "7d", "30d", "1m", "3m", "1y", "max"]

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
  const [watchlist, setWatchlist] = React.useState<WatchlistEntryResponse[]>([])
  const [allAssets, setAllAssets] = React.useState<AssetResponse[]>([])
  const [loadingWatchlist, setLoadingWatchlist] = React.useState(true)
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

  const fetchWatchlist = React.useCallback(async () => {
    setLoadingWatchlist(true)
    setError(null)
    try {
      const data = await apiGet<WatchlistEntryResponse[]>("/users/me/watchlist")
      if (data.length === 0) {
        setWatchlist(MOCK_WATCHLIST)
      } else {
        setWatchlist(data)
      }
      setLastUpdate(new Date())
    } catch (err) {
      console.error("API failed, using mock watchlist:", err)
      setWatchlist(MOCK_WATCHLIST)
    } finally {
      setLoadingWatchlist(false)
    }
  }, [])

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

  const fetchChartData = React.useCallback(async (assetId: string, range: TimeRange) => {
    setChartLoading(true)
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
          resolution = "1w"
          break
        case "max":
          timeFrom = new Date(0)
          resolution = "1mo"
          break
      }

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
      } else {
        setMarketStats(MOCK_MARKET_STATS_FALLBACK)
        const mockFormatted = MOCK_MARKET_DATA
          .map((item) => ({
            date: item.time,
            price: 50000 + (Math.random() * 20000),
            confidence: 48000 + (Math.random() * 20000)
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        setChartData(mockFormatted)
      }
    } catch (err) {
      console.error("Failed to fetch chart data:", err)
      setMarketStats(MOCK_MARKET_STATS_FALLBACK)
      const mockFormatted = MOCK_MARKET_DATA
        .map((item) => ({
          date: item.time,
          price: 50000 + (Math.random() * 20000),
          confidence: 48000 + (Math.random() * 20000)
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      setChartData(mockFormatted)
    } finally {
      setChartLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (selectedAsset) {
      void fetchChartData(selectedAsset.id, timeRange)
      apiGet<PaginatedResponse<MlModelResponse>>("/ml-models", { asset_id: selectedAsset.id })
        .then((data) => {
          if (data.items.length > 0) {
            setAvailableModels(data.items)
            const activeModel = data.items.find((m) => m.is_active) || data.items[0]
            setPredictionModel(activeModel)
          } else {
            const mockModels = MOCK_MODELS.filter((m) => m.asset_id === selectedAsset.id)
            setAvailableModels(mockModels)
            setPredictionModel(mockModels.find((m) => m.is_active) || mockModels[0] || null)
          }
        })
        .catch(() => {
          const mockModels = MOCK_MODELS.filter((m) => m.asset_id === selectedAsset.id)
          setAvailableModels(mockModels)
          setPredictionModel(mockModels.find((m) => m.is_active) || mockModels[0] || null)
        })
    } else {
      setChartData([])
      setMarketStats(null)
      setPredictionModel(null)
      setAvailableModels([])
    }
  }, [selectedAsset, timeRange, fetchChartData])

  React.useEffect(() => {
    void fetchWatchlist()
  }, [fetchWatchlist])

  const handleRemove = async (assetId: string, symbol: string) => {
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
            void apiPut(`/users/me/watchlist/${assetId}`)
            toast.success(`Restored ${symbol}`, {
              description: "The asset has been added back to your watchlist."
            })
          },
        },
      })

      await apiDelete(`/users/me/watchlist/${assetId}`)
    } catch (err) {
      console.warn("Backend sync failed during removal:", err)
    } finally {
      setRemovingId(null)
    }
  }

  const handleAdd = async (asset: AssetResponse) => {
    setAddingId(asset.id)
    const previousWatchlist = [...watchlist]
    try {
      await apiPut(`/users/me/watchlist/${asset.id}`)
      const data = await apiGet<WatchlistEntryResponse[]>("/users/me/watchlist")
      setWatchlist(data)
    } catch (err) {
      console.warn("Backend sync failed, adding to local state:", err)
      setWatchlist(prev => {
        if (prev.some(w => w.asset.id === asset.id)) return prev
        return [...prev, { user_id: "demo", asset }]
      })
    } finally {
      toast.success(`Added ${asset.symbol} to watchlist.`, {
        action: {
          label: <span className="underline font-bold">Undo</span>,
          onClick: () => {
            setWatchlist(previousWatchlist)
            void apiDelete(`/users/me/watchlist/${asset.id}`)
            toast.success(`Removed ${asset.symbol}`, {
              description: "The asset has been removed from your watchlist."
            })
          },
        },
      })
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

  return (
    <DashboardLayout title="Watchlist">
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8">

          <WatchlistHeader
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

          <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {error && (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {loadingWatchlist ? (
                <WatchlistSkeleton viewMode={viewMode} />
              ) : filteredWatchlist.length === 0 ? (
                <WatchlistEmptyState
                  search={search}
                  onBrowseAssets={() => {
                    setShowAddPanel(true)
                    void fetchAllAssets()
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
                            />
                          ))}
                        </div>
                      ) : (
                        <WatchlistTable
                          watchlist={paginatedWatchlist}
                          timeRange={watchlistTimeRange}
                          onRemove={handleRemove}
                          onSelect={setSelectedAsset}
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
              )}
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
