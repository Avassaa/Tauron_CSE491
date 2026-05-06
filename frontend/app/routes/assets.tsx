"use client"

import * as React from "react"
import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { apiGet, apiPost, type AssetResponse, type PaginatedResponse, type MlModelResponse } from "~/lib/api-client"
import { toast } from "sonner"
import { MOCK_MODELS } from "~/lib/mock-data"
import { formatCompactCurrency, formatCurrency, type CurrencyCode } from "~/lib/currency"

import {
  AssetsSkeleton,
  AssetTable,
  AssetPagination,
  AssetDetailSheet,
  MarketHighlights,
  AssetControls,
} from "~/components/assets"
import { PageBlueBackdrop } from "~/components/dashboard/page-blue-backdrop"

import { CreateWatchlistDialog } from "~/components/watchlists/create-watchlist-dialog"
import { useAssistantChatExtras } from "~/components/assistant/assistant-chat-extras-context"
import { useWatchlist } from "~/hooks/use-watchlist"
import { useMarketData } from "~/hooks/use-market-data"

const PAGE_SIZE = 20
type TimeRange = "24H" | "7D" | "1M" | "3M" | "1Y" | "MAX"
const TIME_RANGES: TimeRange[] = ["24H", "7D", "1M", "3M", "1Y", "MAX"]
const ensuredPopularSymbols = new Set<string>()

function AssetsPageClient() {
  const [assets, setAssets] = React.useState<AssetResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [search, setSearch] = React.useState("")
  const [quoteCurrency, setQuoteCurrency] = React.useState<CurrencyCode>("USD")

  const [selectedAsset, setSelectedAsset] = React.useState<AssetResponse | null>(null)
  const { setAssetsUiHints } = useAssistantChatExtras()

  React.useEffect(() => {
    setAssetsUiHints({
      selectedAsset:
        selectedAsset ?
          {
            id: selectedAsset.id,
            symbol: selectedAsset.symbol,
            name: selectedAsset.name,
          }
        : null,
      dashboardStats: {
        trackedAssetsTotal: total,
        assetsPage: page,
        quoteCurrency,
        assetSheetOpen: Boolean(selectedAsset),
      },
    })
    return () =>
      setAssetsUiHints({
        selectedAsset: null,
        dashboardStats: null,
      })
  }, [page, quoteCurrency, selectedAsset, setAssetsUiHints, total])
  const [timeRange, setTimeRange] = React.useState<TimeRange>("7D")
  const [predictionModel, setPredictionModel] = React.useState<MlModelResponse | null>(null)
  const [availableModels, setAvailableModels] = React.useState<MlModelResponse[]>([])
  const [sortConfig, setSortConfig] = React.useState<{
    key: string
    direction: "asc" | "desc"
  } | null>(null)
  const isPopularSort = sortConfig?.key === "rank" && sortConfig.direction === "asc"
  const isGainersSort = sortConfig?.key === "change24h" && sortConfig.direction === "desc"
  const isLosersSort = sortConfig?.key === "change24h" && sortConfig.direction === "asc"

  const [createWatchlistDialogOpen, setCreateWatchlistDialogOpen] = React.useState(false)
  const [watchlistTargetAsset, setWatchlistTargetAsset] = React.useState<AssetResponse | null>(null)

  // Custom Hooks
  const {
    watchlistLists,
    watchlistAssetsByListId,
    watchedIds,
    creatingWatchlist,
    toggleWatchlist,
    toggleAssetInNamedWatchlist,
    addAssetToNamedWatchlist,
    createWatchlistList
  } = useWatchlist(assets)

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

  // Asset Fetching
  const fetchAssets = React.useCallback(async (
    currentPage: number,
    searchQuery: string = "",
  ) => {
    setLoading(true)
    setError(null)
    try {
      // Keep assets table aligned with Binance popular list.
      // Missing assets are auto-ensured, which also queues 5Y on-chain backfill.
      if (!searchQuery.trim() && isPopularSort) {
        try {
          const liveRows = await apiGet<any[]>("/assets/live-market", { limit: 250 })
          if (Array.isArray(liveRows) && liveRows.length > 0) {
            const start = Math.max(0, (currentPage - 1) * PAGE_SIZE)
            const end = start + PAGE_SIZE
            const pageCoins = liveRows.slice(start, end)
            const toEnsure = pageCoins
              .map((coin) => ({
                symbol: String(coin?.symbol ?? "").toUpperCase(),
                name: String(coin?.name ?? "").trim(),
              }))
              .filter((coin) =>
                /^[A-Z0-9]{1,10}$/.test(coin.symbol) &&
                coin.name.length > 0 &&
                !ensuredPopularSymbols.has(coin.symbol)
              )

            /** Popular-sort paging was firing one POST per missing symbol per page — cap burst size. */
            const MAX_ENSURE_PER_FETCH = 8
            if (toEnsure.length > 0) {
              let posted = 0
              for (const coin of toEnsure) {
                if (posted >= MAX_ENSURE_PER_FETCH) break
                try {
                  posted += 1
                  await apiPost<AssetResponse>("/assets/ensure", {
                    symbol: coin.symbol,
                    name: coin.name,
                    category: "Crypto",
                    coingecko_id: null,
                    is_active: true,
                  })
                  ensuredPopularSymbols.add(coin.symbol)
                } catch {
                  // Ignore per-coin failures; table still loads existing assets.
                }
              }
            }
          }
        } catch {
          // Non-blocking; continue with regular assets fetch.
        }
      }

      const data = await apiGet<PaginatedResponse<AssetResponse>>("/assets", {
        page: currentPage,
        page_size: PAGE_SIZE,
        search: searchQuery || undefined,
        sort: isPopularSort
          ? "popular"
          : isGainersSort
            ? "gainers_24h"
            : isLosersSort
              ? "losers_24h"
              : undefined,
      })
      setAssets(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error("API failed to fetch assets:", err)
      setError("Failed to load assets from the backend.")
      setAssets([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [isPopularSort, isGainersSort, isLosersSort])

  // Effects
  React.useEffect(() => {
    void fetchAssets(page, search)
  }, [page, sortConfig, fetchAssets, search])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      void fetchAssets(1, search)
    }, 500)
    return () => clearTimeout(timer)
  }, [search, fetchAssets])

  React.useEffect(() => {
    if (assets.length > 0) {
      void fetchEnrichedMarketData(assets)
    }
  }, [assets, fetchEnrichedMarketData])

  // Asset Detail Management
  const lastSelectedAssetId = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (selectedAsset) {
      const isNewAsset = selectedAsset.id !== lastSelectedAssetId.current
      if (isNewAsset) {
        setChartData([])
        setMarketStats(null)
        lastSelectedAssetId.current = selectedAsset.id

        // Fetch models
        apiGet<PaginatedResponse<MlModelResponse>>("/ml-models", { asset_id: selectedAsset.id })
          .then((data) => {
            setAvailableModels(data.items.length > 0 ? data.items : MOCK_MODELS.filter(m => m.asset_id === selectedAsset.id))
            setPredictionModel(data.items.find(m => m.is_active) || data.items[0] || null)
          })
          .catch(() => {
            const mocks = MOCK_MODELS.filter(m => m.asset_id === selectedAsset.id)
            setAvailableModels(mocks)
            setPredictionModel(mocks.find(m => m.is_active) || mocks[0] || null)
          })
      }
      void fetchChartData(selectedAsset, timeRange)
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

  const sortedAssets = React.useMemo(() => {
    if (!sortConfig) return assets
    if (isPopularSort || isGainersSort || isLosersSort) return assets
    return [...assets].sort((a, b) => {
      let valA: any = (marketDataMap[a.id] as any)?.[sortConfig.key] ?? a[sortConfig.key as keyof AssetResponse]
      let valB: any = (marketDataMap[b.id] as any)?.[sortConfig.key] ?? b[sortConfig.key as keyof AssetResponse]
      
      // Special mappings for sorting
      if (sortConfig.key === "change1h") { valA = marketDataMap[a.id]?.price_change_1h; valB = marketDataMap[b.id]?.price_change_1h }
      if (sortConfig.key === "change24h") { valA = marketDataMap[a.id]?.price_change_24h; valB = marketDataMap[b.id]?.price_change_24h }
      if (sortConfig.key === "change7d") { valA = marketDataMap[a.id]?.price_change_7d; valB = marketDataMap[b.id]?.price_change_7d }
      if (valA == null && valB == null) return 0
      if (valA == null) return 1
      if (valB == null) return -1

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })
  }, [assets, sortConfig, marketDataMap, isPopularSort, isGainersSort, isLosersSort])

  const selectedAssetWatchlistMembership = React.useMemo(() => {
    if (!selectedAsset) return {}
    return Object.fromEntries(
      watchlistLists.map((list) => [
        list.id,
        (watchlistAssetsByListId[list.id] || []).some(a => a.id === selectedAsset.id || a.symbol.toUpperCase() === selectedAsset.symbol.toUpperCase()),
      ])
    )
  }, [selectedAsset, watchlistAssetsByListId, watchlistLists])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <DashboardLayout
      title={
        <div className="flex items-center gap-2">
          <span className="font-medium">Assets</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-bold">{total} total</span>
        </div>
      }
    >
      <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <PageBlueBackdrop />
        <div className="relative z-[1] flex min-w-0 max-w-full flex-1 flex-col gap-6 p-4 md:p-8">
          <MarketHighlights
            onCoinClick={async (symbol) => {
              const match = assets.find(a => a.symbol.toUpperCase() === symbol.toUpperCase())
              if (match) return setSelectedAsset(match)
              try {
                const res = await apiGet<PaginatedResponse<AssetResponse>>("/assets", { page_size: 1, symbol: symbol.toUpperCase() })
                if (res.items?.[0]) setSelectedAsset(res.items[0])
                else toast.info(`${symbol} not found in tracked list.`)
              } catch { toast.error("Search failed") }
            }}
          />

          <AssetControls
            search={search}
            setSearch={setSearch}
            loading={loading}
            fetchAssets={() => fetchAssets(page, search)}
            sortConfig={sortConfig as any}
            setSortConfig={setSortConfig}
            quoteCurrency={quoteCurrency}
            setQuoteCurrency={setQuoteCurrency}
          />

          {error && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">{error}</div>}

          {loading ? <AssetsSkeleton /> : (
            <div className="space-y-4">
              <AssetTable
                assets={sortedAssets}
                marketDataMap={marketDataMap}
                quoteCurrency={quoteCurrency}
                currentPage={page}
                pageSize={PAGE_SIZE}
                sortConfig={sortConfig}
                handleSort={handleSort}
                setSelectedAsset={setSelectedAsset}
                watchlistIds={watchedIds}
                watchlistLists={watchlistLists}
                watchlistAssetsByListId={watchlistAssetsByListId}
                onToggleWatchlistList={toggleAssetInNamedWatchlist}
                onAddToWatchlistList={addAssetToNamedWatchlist}
                onCreateWatchlistList={(asset) => {
                  if (asset) setWatchlistTargetAsset(asset)
                  setCreateWatchlistDialogOpen(true)
                }}
                onToggleWatchlist={toggleWatchlist}
              />
              <AssetPagination page={page} totalPages={totalPages} setPage={setPage} loading={loading} />
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
            formatCurrency={(val) => formatCurrency(val, quoteCurrency)}
            formatCompactCurrency={(val) => formatCompactCurrency(val, quoteCurrency)}
            isWatched={selectedAsset ? watchedIds.has(selectedAsset.id) || watchedIds.has(selectedAsset.symbol.toUpperCase()) : false}
            onToggleWatchlist={toggleWatchlist}
            watchlistLists={watchlistLists}
            watchlistMembershipByListId={selectedAssetWatchlistMembership}
            onAddToWatchlistList={addAssetToNamedWatchlist}
            onToggleWatchlistList={toggleAssetInNamedWatchlist}
            onCreateWatchlistList={() => setCreateWatchlistDialogOpen(true)}
          />

          <CreateWatchlistDialog
            open={createWatchlistDialogOpen}
            onOpenChange={(open) => {
              setCreateWatchlistDialogOpen(open)
              if (!open) setWatchlistTargetAsset(null)
            }}
            onConfirm={(name) => createWatchlistList(name, watchlistTargetAsset || selectedAsset).then(() => {
              setCreateWatchlistDialogOpen(false)
              setWatchlistTargetAsset(null)
            })}
            loading={creatingWatchlist}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function AssetsPage() {
  return <AssetsPageClient />
}
