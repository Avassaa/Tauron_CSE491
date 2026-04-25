"use client"

import * as React from "react"
import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { Separator } from "~/components/ui/separator"
import { apiGet, apiPut, apiDelete, type AssetResponse, type PaginatedResponse, type MarketDataResponse, type MlModelResponse, type WatchlistEntryResponse } from "~/lib/api-client"
import { toast } from "sonner"
import { MOCK_ASSETS, MOCK_MARKET_DATA, MOCK_MODELS, MOCK_MARKET_STATS_FALLBACK, generateMockChartData, getAssetStats } from "~/lib/mock-data"
import { cn } from "~/lib/utils"

import {
  AssetsSkeleton,
  AssetControls,
  AssetTable,
  AssetPagination,
  AssetDetailSheet
} from "~/components/assets"

const PAGE_SIZE = 20

type TimeRange = "24H" | "7D" | "1M" | "3M" | "1Y" | "MAX"
const TIME_RANGES: TimeRange[] = ["24H", "7D", "1M", "3M", "1Y", "MAX"]

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

function AssetsPageClient() {
  const [assets, setAssets] = React.useState<AssetResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
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
  const [timeRange, setTimeRange] = React.useState<TimeRange>("7D")
  const [sortConfig, setSortConfig] = React.useState<{
    key: "name" | "symbol" | "category" | "is_active" | "activity"
    direction: "asc" | "desc"
  } | null>(null)
  const [watchlist, setWatchlist] = React.useState<WatchlistEntryResponse[]>([])
  const [addingId, setAddingId] = React.useState<string | null>(null)

  const handleSort = (key: "name" | "symbol" | "category" | "is_active" | "activity") => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key, direction: "desc" }
    })
  }

  const fetchChartData = React.useCallback(async (assetId: string, range: TimeRange) => {
    setChartLoading(true)
    try {
      const now = new Date()
      let timeFrom = new Date()
      let resolution = "1d"

      switch (range) {
        case "24H":
          timeFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          resolution = "1h"
          break
        case "7D":
          timeFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          break
        case "1M":
          timeFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          break
        case "3M":
          timeFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          break
        case "1Y":
          timeFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          resolution = "1w"
          break
        case "MAX":
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

  const fetchAssets = React.useCallback(async (currentPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<PaginatedResponse<AssetResponse>>("/assets", {
        page: currentPage,
        page_size: PAGE_SIZE,
      })
      if (data.items.length === 0) {
        const start = (currentPage - 1) * PAGE_SIZE
        const end = start + PAGE_SIZE
        setAssets(MOCK_ASSETS.slice(start, end))
        setTotal(MOCK_ASSETS.length)
      } else {
        setAssets(data.items)
        setTotal(data.total)
      }
    } catch (err) {
      console.error("API failed, using mock assets:", err)
      const start = (currentPage - 1) * PAGE_SIZE
      const end = start + PAGE_SIZE
      setAssets(MOCK_ASSETS.slice(start, end))
      setTotal(MOCK_ASSETS.length)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchAssets(page)
  }, [fetchAssets, page])

  const fetchWatchlist = React.useCallback(async () => {
    try {
      const data = await apiGet<WatchlistEntryResponse[]>("/users/me/watchlist")
      setWatchlist(data)
    } catch {
      // Silent fail for assets page
    }
  }, [])

  React.useEffect(() => {
    void fetchWatchlist()
  }, [fetchWatchlist])

  const handleAdd = async (asset: AssetResponse) => {
    setAddingId(asset.id)
    try {
      await apiPut(`/users/me/watchlist/${asset.id}`)
      await fetchWatchlist()
      toast.success(`Added ${asset.symbol} to watchlist`)
    } catch (err) {
      toast.error(`Failed to add ${asset.symbol}`)
    } finally {
      setAddingId(null)
    }
  }

  const handleRemove = async (assetId: string, symbol: string) => {
    try {
      await apiDelete(`/users/me/watchlist/${assetId}`)
      await fetchWatchlist()
      toast.success(`Removed ${symbol} from watchlist`)
    } catch (err) {
      toast.error(`Failed to remove ${symbol}`)
    }
  }

  const watchedIds = new Set(watchlist.map((w) => w.asset.id))

  const sortedAndFiltered = React.useMemo(() => {
    let result = assets
    if (search.trim()) {
      const q = search.toLowerCase()
      result = assets.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.category?.toLowerCase().includes(q) ?? false),
      )
    }
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let valA: string | number = 0
        let valB: string | number = 0
        switch (sortConfig.key) {
          case "name":
            valA = a.name
            valB = b.name
            break
          case "symbol":
            valA = a.symbol
            valB = b.symbol
            break
          case "category":
            valA = a.category || ""
            valB = b.category || ""
            break
          case "is_active":
            valA = a.is_active ? 1 : 0
            valB = b.is_active ? 1 : 0
            break
          case "activity":
            // Deterministic mock activity: Bullish if symbol length is even
            valA = a.symbol.length % 2 === 0 ? 1 : 0
            valB = b.symbol.length % 2 === 0 ? 1 : 0
            break
        }
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
    }
    return result
  }, [assets, search, sortConfig])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <DashboardLayout
      title={
        <div className="flex items-center gap-2">
          <span className="font-medium">Assets</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-bold">
            {total} total
          </span>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
          {/* Trending Assets Row */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80 flex items-center gap-2">
                Trending Coins
              </h3>
            </div>
            <div className="flex gap-4 overflow-x-auto p-3 scrollbar-none">
              {MOCK_ASSETS.slice(0, 10).map((asset) => {
                const stats = getAssetStats(asset.symbol)
                return (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className="flex min-w-[200px] items-center gap-4 rounded-2xl border border-border/50 bg-card/30 p-4 transition-all hover:scale-[1.02] hover:bg-card/50 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-black text-primary ring-1 ring-primary/20">
                      {asset.symbol.slice(0, 3)}
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="truncate font-black tracking-tight">{asset.name}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{asset.symbol}</span>
                    </div>
                    <div className="ml-auto flex flex-col items-end">
                      <span className={cn(
                        "text-[10px] font-black",
                        stats.isUp ? "text-green-500" : "text-red-500"
                      )}>
                        {stats.change}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <AssetControls
            search={search}
            setSearch={setSearch}
            loading={loading}
            fetchAssets={() => void fetchAssets(page)}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
          />

          {error && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <AssetsSkeleton />
          ) : (
            <div className="space-y-4">
              <AssetTable
                assets={sortedAndFiltered}
                search={search}
                currentPage={page}
                pageSize={PAGE_SIZE}
                sortConfig={sortConfig}
                handleSort={handleSort}
                setSelectedAsset={setSelectedAsset}
              />
              <AssetPagination
                page={page}
                totalPages={totalPages}
                setPage={setPage}
                loading={loading}
              />
            </div>
          )}

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

export default function AssetsPage() {
  return <AssetsPageClient />
}
