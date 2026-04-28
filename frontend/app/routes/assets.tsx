"use client"

import * as React from "react"
import { DashboardLayout } from "~/components/dashboard/dashboard-layout"

import { apiGet, apiPut, apiDelete, apiPost, type AssetResponse, type PaginatedResponse, type MarketDataResponse, type MlModelResponse, type WatchlistEntryResponse, type WatchlistListResponse } from "~/lib/api-client"
import { toast } from "sonner"
import { MOCK_MODELS } from "~/lib/mock-data"

import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"

import {
  AssetsSkeleton,
  AssetTable,
  AssetPagination,
  AssetDetailSheet,
  MarketHighlights,
  AssetControls,
  type MarketData,
} from "~/components/assets"

const PAGE_SIZE = 20

type TimeRange = "24H" | "7D" | "1M" | "3M" | "1Y" | "MAX"
const TIME_RANGES: TimeRange[] = ["24H", "7D", "1M", "3M", "1Y", "MAX"]

import { formatCompactCurrency, formatCurrency, type CurrencyCode } from "~/lib/currency"

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = (value: string) => UUID_REGEX.test(value)

function AssetsPageClient() {
  const [assets, setAssets] = React.useState<AssetResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [selectedAsset, setSelectedAsset] = React.useState<AssetResponse | null>(null)
  const [chartData, setChartData] = React.useState<any[]>([])
  const [chartLoading, setChartLoading] = React.useState(false)
  const [marketStats, setMarketStats] = React.useState<{
    price?: number
    change24h?: number
    rangeChange?: number
    volume?: number
    change1h?: number
    change7d?: number
    change14d?: number
    change30d?: number
    change1y?: number
  } | null>(null)
  const [predictionModel, setPredictionModel] = React.useState<MlModelResponse | null>(null)
  const [availableModels, setAvailableModels] = React.useState<MlModelResponse[]>([])
  const [timeRange, setTimeRange] = React.useState<TimeRange>("7D")
  const [sortConfig, setSortConfig] = React.useState<{
    key: "name" | "symbol" | "category" | "is_active" | "activity" | "price" | "change1h" | "change24h" | "change7d" | "volume" | "market_cap" | "rank"
    direction: "asc" | "desc"
  } | null>(null)
  const [watchlist, setWatchlist] = React.useState<WatchlistEntryResponse[]>([])
  const [watchlistLists, setWatchlistLists] = React.useState<WatchlistListResponse[]>([])
  const [watchlistAssetsByListId, setWatchlistAssetsByListId] = React.useState<Record<string, AssetResponse[]>>({})
  const [addingId, setAddingId] = React.useState<string | null>(null)
  const [createWatchlistDialogOpen, setCreateWatchlistDialogOpen] = React.useState(false)
  const [newWatchlistName, setNewWatchlistName] = React.useState("")
  const [creatingWatchlist, setCreatingWatchlist] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [quoteCurrency, setQuoteCurrency] = React.useState<CurrencyCode>("USD")
  const marketDataMapRef = React.useRef<Record<string, MarketData>>({})
  const [marketDataMap, setMarketDataMap] = React.useState<Record<string, MarketData>>({})

  // Keep ref in sync
  React.useEffect(() => {
    marketDataMapRef.current = marketDataMap
  }, [marketDataMap])

  const fetchEnrichedMarketData = React.useCallback(async (assetsToEnrich: AssetResponse[]) => {
    const ids = assetsToEnrich
      .map((a) => a.coingecko_id)
      .filter(Boolean)
      .join(",")

    if (!ids) return

    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d,14d,30d,1y`
      )
      if (!res.ok) throw new Error("CoinGecko rate limit or error")
      const data = await res.json()

      const newMap: Record<string, any> = {}
      data.forEach((coin: any) => {
        const asset = assetsToEnrich.find((a) => a.coingecko_id === coin.id)
        if (asset) {
          newMap[asset.id] = {
            price: coin.current_price,
            price_change_1h: coin.price_change_percentage_1h_in_currency,
            price_change_24h: coin.price_change_percentage_24h_in_currency,
            price_change_7d: coin.price_change_percentage_7d_in_currency,
            price_change_14d: coin.price_change_percentage_14d_in_currency,
            price_change_30d: coin.price_change_percentage_30d_in_currency,
            price_change_1y: coin.price_change_percentage_1y_in_currency,
            volume: coin.total_volume,
            market_cap: coin.market_cap,
            rank: coin.market_cap_rank,
            sparkline: coin.sparkline_in_7d?.price || []
          }
        }
      })
      setMarketDataMap((prev) => ({ ...prev, ...newMap }))
    } catch (err) {
      console.error("Failed to fetch enriched market data from CoinGecko:", err)
    }
  }, [])


  const handleSort = (key: "name" | "symbol" | "category" | "is_active" | "activity" | "price" | "change1h" | "change24h" | "change7d" | "volume" | "market_cap" | "rank") => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key, direction: "desc" }
    })
  }

  const fetchChartData = React.useCallback(async (assetId: string, assetSymbol: string, range: TimeRange) => {
    setChartLoading(true)

    const asset = assets.find(a => a.id === assetId)
    const cgId = asset?.coingecko_id

    // Pre-fill stats from our already-fetched map
    const cgData = marketDataMapRef.current[assetId]
    setMarketStats(prev => ({
      ...prev,
      price: cgData?.price,
      change24h: cgData?.price_change_24h,
      rangeChange: undefined, // Reset while loading to avoid "wrong data" flicker
      volume: cgData?.volume,
      change1h: cgData?.price_change_1h,
      change7d: cgData?.price_change_7d,
      change14d: cgData?.price_change_14d,
      change30d: cgData?.price_change_30d,
      change1y: cgData?.price_change_1y,
    }))

    try {
      const now = new Date()
      let timeFrom = new Date()
      let resolution = "1d"

      switch (range) {
        case "24H": timeFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000); resolution = "30m"; break
        case "7D": timeFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); resolution = "2h"; break
        case "1M": timeFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); resolution = "1d"; break
        case "3M": timeFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); resolution = "1d"; break
        case "1Y": timeFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); resolution = "1d"; break
        case "MAX": timeFrom = new Date(0); resolution = "1d"; break
      }

      const data = await apiGet<PaginatedResponse<MarketDataResponse>>("/market-data", {
        asset_id: assetId,
        time_from: timeFrom.toISOString(),
        time_to: now.toISOString(),
        resolution,
        page_size: 1000,
      })

      if (data.items.length > 0) {
        const sorted = [...data.items].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        const first = sorted[0]
        const latest = sorted[sorted.length - 1]
        const priceChange = first.close > 0 ? ((latest.close - first.close) / first.close) * 100 : 0
        setMarketStats(prev => ({
          ...prev,
          // Keep current price/vol if they exist, else use latest from chart
          price: prev?.price || latest.close,
          change24h: prev?.change24h || priceChange,
          rangeChange: priceChange,
          volume: prev?.volume || latest.volume
        }))
        setChartData(sorted.map((item) => ({
          date: item.time,
          price: item.close,
          volume: item.volume,
          confidence: item.close * 0.95
        })))
        return
      }
      throw new Error("No backend market data")
    } catch {
      // Binance fallback
      try {
        const symbol = `${assetSymbol.toUpperCase()}USDT`
        const binInterval =
          range === "24H" ? "15m" :
            range === "7D" ? "1h" :
              range === "1M" ? "4h" :
                range === "3M" ? "12h" :
                  range === "1Y" ? "1d" : "1w"
        const binLimit = 365 // limit points

        const [tickerRes, klinesRes] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
          fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binInterval}&limit=${binLimit}`),
        ])
        if (!tickerRes.ok || !klinesRes.ok) throw new Error("Binance unavailable")

        const ticker = await tickerRes.json()
        const klines = await klinesRes.json()

        const points = klines.map((k: any) => ({
          date: new Date(k[0]).toISOString(),
          price: Number.parseFloat(k[4]),
          volume: Number.parseFloat(k[5]), // Volume is at index 5
          confidence: Number.parseFloat(k[4]) * 0.95
        }))

        const first = points[0]
        const latest = points[points.length - 1]
        const rangeChange = first.price > 0 ? ((latest.price - first.price) / first.price) * 100 : 0

        setMarketStats(prev => ({
          ...prev,
          price: prev?.price || Number.parseFloat(ticker.lastPrice),
          change24h: prev?.change24h || Number.parseFloat(ticker.priceChangePercent),
          rangeChange: rangeChange,
          volume: prev?.volume || Number.parseFloat(ticker.quoteVolume)
        }))
        setChartData(points)
      } catch {
        if (cgId) {
          try {
            const days =
              range === "24H" ? "1" :
                range === "7D" ? "7" :
                  range === "1M" ? "30" :
                    range === "3M" ? "90" :
                      range === "1Y" ? "365" : "max"

            const res = await fetch(`https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`)
            if (!res.ok) throw new Error("CoinGecko Chart Fail")
            const cgChartData = await res.json()

            if (cgChartData.prices && cgChartData.prices.length > 0) {
              const points = cgChartData.prices.map((p: [number, number], i: number) => ({
                date: new Date(p[0]).toISOString(),
                price: p[1],
                volume: cgChartData.total_volumes?.[i]?.[1] || 0,
                confidence: p[1] * 0.95
              }))

              const first = points[0]
              const latest = points[points.length - 1]
              const rangeChange = first.price > 0 ? ((latest.price - first.price) / first.price) * 100 : 0

              setMarketStats(prev => ({
                ...prev,
                price: prev?.price || latest.price,
                change24h: prev?.change24h || 0,
                rangeChange: rangeChange,
                volume: prev?.volume || 0
              }))
              setChartData(points)
              return
            }
          } catch (cgErr) {
            console.error("CoinGecko chart fallback failed:", cgErr)
          }
        }

        if (range === "7D" && cgData?.sparkline) {
          const points = cgData.sparkline.map((p: number, i: number) => ({
            date: new Date(Date.now() - (cgData.sparkline.length - i) * 60 * 60 * 1000).toISOString(),
            price: p,
            confidence: p * 0.95
          }))
          setChartData(points)
        } else if (!marketStats) {
          setMarketStats(null)
          setChartData([])
        }
      }
    } finally {
      setChartLoading(false)
    }
  }, [assets])

  const lastSelectedAssetId = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (selectedAsset) {
      const isNewAsset = selectedAsset.id !== lastSelectedAssetId.current

      if (isNewAsset) {
        // Clear data ONLY when switching to a different asset
        setChartData([])
        setMarketStats(null)
        lastSelectedAssetId.current = selectedAsset.id
      }

      void fetchChartData(selectedAsset.id, selectedAsset.symbol, timeRange)

      if (isNewAsset) {
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
      }
    } else {
      lastSelectedAssetId.current = null
      setChartData([])
      setMarketStats(null)
      setPredictionModel(null)
      setAvailableModels([])
    }
  }, [selectedAsset, timeRange, fetchChartData])

  const fetchAssets = React.useCallback(async (currentPage: number, searchQuery: string = "") => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<PaginatedResponse<AssetResponse>>("/assets", {
        page: currentPage,
        page_size: PAGE_SIZE,
        search: searchQuery || undefined, // Send search query to backend if provided
      })
      setAssets(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error("API failed to fetch assets:", err)
      setError("Failed to load assets from the backend. Please check your connection.")
      setAssets([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle initial fetch and page changes
  React.useEffect(() => {
    void fetchAssets(page, search)
  }, [page]) // Only trigger on page change here

  // Handle search with debouncing
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

  const fetchWatchlist = React.useCallback(async () => {
    try {
      const data = await apiGet<WatchlistEntryResponse[]>("/users/me/watchlist")
      setWatchlist(data)
    } catch (err) {
      console.error("Failed to fetch watchlist:", err)
    }
  }, [])

  React.useEffect(() => {
    void fetchWatchlist()
  }, [fetchWatchlist])

  const fetchWatchlistLists = React.useCallback(async () => {
    try {
      const data = await apiGet<WatchlistListResponse[]>("/users/me/watchlists")
      setWatchlistLists(data)
      const assetResults = await Promise.allSettled(
        data.map(async (list) => {
          const entries = await apiGet<Array<{ list_id: string; asset: AssetResponse }>>(
            `/users/me/watchlists/${list.id}/assets`,
          )
          return [list.id, entries.map((entry) => entry.asset)] as const
        }),
      )
      const nextAssetsByListId: Record<string, AssetResponse[]> = {}
      for (const result of assetResults) {
        if (result.status === "fulfilled") {
          const [listId, assets] = result.value
          nextAssetsByListId[listId] = assets
        }
      }
      setWatchlistAssetsByListId(nextAssetsByListId)
    } catch {
      setWatchlistLists([])
      setWatchlistAssetsByListId({})
    }
  }, [])

  React.useEffect(() => {
    void fetchWatchlistLists()
  }, [fetchWatchlistLists])

  const handleAdd = async (asset: AssetResponse) => {
    setAddingId(asset.id)
    try {
      await apiPut("/users/me/watchlist/" + asset.id)
      await fetchWatchlist()
      toast.success(`Added ${asset.symbol}`, {
        description: "The asset has been added to your watchlist.",
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                await apiDelete("/users/me/watchlist/" + asset.id)
                await fetchWatchlist()
                toast.success(`Removed ${asset.symbol}`)
              } catch (err) {
                toast.error("Failed to undo addition")
              }
            })();
          }
        }
      })
    } catch (err) {
      console.error("Failed to add to watchlist:", err)
      toast.error(`Failed to add ${asset.symbol}`)
    } finally {
      setAddingId(null)
    }
  }

  const handleRemove = async (assetId: string, symbol: string) => {
    try {
      await apiDelete("/users/me/watchlist/" + assetId)
      await fetchWatchlist()
      toast.success(`Removed ${symbol}`, {
        description: "The asset has been removed from your watchlist.",
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                await apiPut("/users/me/watchlist/" + assetId)
                await fetchWatchlist()
                toast.success(`Restored ${symbol}`)
              } catch (err) {
                toast.error("Failed to undo removal")
              }
            })();
          }
        }
      })
    } catch (err) {
      console.error("Failed to remove from watchlist:", err)
      toast.error(`Failed to remove ${symbol}`)
    }
  }

  const resolveBackendAssetId = async (asset: AssetResponse): Promise<string> => {
    if (isUuid(asset.id)) return asset.id
    const symbol = asset.symbol.toUpperCase()
    // Check if we already have it in our mapping from props/other fetches
    const existing = (assets.find(a => a.symbol.toUpperCase() === symbol && isUuid(a.id)))?.id
    if (existing) return existing

    try {
      const created = await apiPost<AssetResponse>("/assets/ensure", {
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category || "General",
        coingecko_id: asset.coingecko_id || null,
        is_active: true,
      })
      if (created?.id) return created.id
      throw new Error(`Ensure endpoint returned no id for ${asset.symbol}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ensure ${asset.symbol}`
      throw new Error(message)
    }
  }

  const createWatchlistList = async () => {
    const name = newWatchlistName.trim()
    if (!name) {
      toast.error("Please enter a watchlist name")
      return
    }
    setCreatingWatchlist(true)
    try {
      const newList = await apiPost<WatchlistListResponse>("/users/me/watchlists", { name })
      await fetchWatchlistLists()

      // Auto-add current asset to the new watchlist if we are in detail view
      if (selectedAsset && newList?.id) {
        await addAssetToNamedWatchlist(selectedAsset, newList.id)
      }

      setCreateWatchlistDialogOpen(false)
      setNewWatchlistName("")
      toast.success(`Watchlist "${name}" created`)
    } catch {
      toast.error("Failed to create watchlist")
    } finally {
      setCreatingWatchlist(false)
    }
  }

  const addAssetToNamedWatchlist = async (asset: AssetResponse, listId: string) => {
    try {
      const backendId = await resolveBackendAssetId(asset)
      await apiPut(`/users/me/watchlists/${listId}/assets/${backendId}`)
      await apiPut(`/users/me/watchlist/${backendId}`)
      await fetchWatchlist()
      await fetchWatchlistLists()
      toast.success(`Added ${asset.symbol} to watchlist`, {
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                await apiDelete(`/users/me/watchlists/${listId}/assets/${backendId}`)
                await apiDelete(`/users/me/watchlist/${backendId}`)
                await fetchWatchlist()
                await fetchWatchlistLists()
                toast.success(`Removed ${asset.symbol} (Undo)`)
              } catch {
                toast.error("Failed to undo addition")
              }
            })()
          }
        }
      })
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error"
      toast.error(`Failed to add ${asset.symbol}: ${detail}`)
    }
  }

  const toggleAssetInNamedWatchlist = async (asset: AssetResponse, listId: string, currentlyInList: boolean) => {
    const list = watchlistLists.find((item) => item.id === listId)
    try {
      const backendId = await resolveBackendAssetId(asset)
      if (currentlyInList) {
        // Remove from the specific named list
        await apiDelete(`/users/me/watchlists/${listId}/assets/${backendId}`)
        // Also remove from primary watchlist to ensure table sync
        await apiDelete(`/users/me/watchlist/${backendId}`)
        
        await fetchWatchlist()
        await fetchWatchlistLists()
        toast.success(`Removed ${asset.symbol} from ${list?.name || "watchlist"}`, {
          action: {
            label: "Undo",
            onClick: () => {
              void (async () => {
                try {
                  await apiPut(`/users/me/watchlists/${listId}/assets/${backendId}`)
                  await apiPut(`/users/me/watchlist/${backendId}`)
                  await fetchWatchlist()
                  await fetchWatchlistLists()
                  toast.success(`Restored ${asset.symbol} to ${list?.name || "watchlist"}`)
                } catch {
                  toast.error("Failed to undo removal")
                }
              })()
            }
          }
        })
      } else {
        // Add to the specific named list
        await apiPut(`/users/me/watchlists/${listId}/assets/${backendId}`)
        // Also add to primary watchlist so it shows up in the table
        await apiPut(`/users/me/watchlist/${backendId}`)
        
        await fetchWatchlist()
        await fetchWatchlistLists()
        toast.success(`Added ${asset.symbol} to ${list?.name || "watchlist"}`, {
          action: {
            label: "Undo",
            onClick: () => {
              void (async () => {
                try {
                  await apiDelete(`/users/me/watchlists/${listId}/assets/${backendId}`)
                  await apiDelete(`/users/me/watchlist/${backendId}`)
                  await fetchWatchlist()
                  await fetchWatchlistLists()
                  toast.success(`Removed ${asset.symbol} (Undo)`)
                } catch {
                  toast.error("Failed to undo addition")
                }
              })()
            }
          }
        })
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error"
      toast.error(`Failed to update ${asset.symbol}: ${detail}`)
    }
  }

  const watchedIds = React.useMemo(() => {
    const ids = new Set<string>()
    watchlist.forEach((w) => {
      if (w.asset.id) ids.add(w.asset.id)
      if (w.asset.symbol) ids.add(w.asset.symbol.toUpperCase())
    })
    return ids
  }, [watchlist])
  const selectedAssetWatchlistMembership = React.useMemo(() => {
    if (!selectedAsset) return {}
    const selectedSymbol = selectedAsset.symbol.toUpperCase()
    return Object.fromEntries(
      watchlistLists.map((list) => [
        list.id,
        (watchlistAssetsByListId[list.id] || []).some(
          (asset) => asset.id === selectedAsset.id || asset.symbol.toUpperCase() === selectedSymbol,
        ),
      ]),
    )
  }, [selectedAsset, watchlistAssetsByListId, watchlistLists])
  const selectedAssetIsInNamedWatchlist = Object.values(selectedAssetWatchlistMembership).some(Boolean)

  const sortedAndFiltered = React.useMemo(() => {
    let result = assets

    // Client-side filtering removed as we now use server-side search
    // but we still keep client-side sorting for the current page's data
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let valA: string | number = 0
        let valB: string | number = 0
        switch (sortConfig.key) {
          case "name":
            valA = a.name
            valB = b.name
            break
          case "price":
            valA = marketDataMap[a.id]?.price || 0
            valB = marketDataMap[b.id]?.price || 0
            break
          case "change1h":
            valA = marketDataMap[a.id]?.price_change_1h || 0
            valB = marketDataMap[b.id]?.price_change_1h || 0
            break
          case "change24h":
            valA = marketDataMap[a.id]?.price_change_24h || 0
            valB = marketDataMap[b.id]?.price_change_24h || 0
            break
          case "change7d":
            valA = marketDataMap[a.id]?.price_change_7d || 0
            valB = marketDataMap[b.id]?.price_change_7d || 0
            break
          case "volume":
            valA = marketDataMap[a.id]?.volume || 0
            valB = marketDataMap[b.id]?.volume || 0
            break
          case "market_cap":
            valA = marketDataMap[a.id]?.market_cap || 0
            valB = marketDataMap[b.id]?.market_cap || 0
            break
          case "rank":
            valA = marketDataMap[a.id]?.rank || 999999
            valB = marketDataMap[b.id]?.rank || 999999
            break
        }
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
    }
    return result
  }, [assets, sortConfig, marketDataMap, search])

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
          {/* Market Highlights: Trending + Top Gainers */}
          <MarketHighlights
            onCoinClick={async (symbol) => {
              // Check current page first
              const match = assets.find(
                (a) => a.symbol.toUpperCase() === symbol.toUpperCase()
              )
              if (match) {
                setSelectedAsset(match)
                return
              }

              // If not on current page, search globally in database
              try {
                const res = await apiGet<PaginatedResponse<AssetResponse>>("/assets", {
                  page_size: 1,
                  symbol: symbol.toUpperCase()
                })
                if (res.items && res.items.length > 0) {
                  setSelectedAsset(res.items[0])
                } else {
                  toast.info(`${symbol} is not in your tracked assets list.`, {
                    description: "Add it from the 'Add Asset' menu to see detailed metrics."
                  })
                }
              } catch (err) {
                console.error("Search failed:", err)
              }
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
                marketDataMap={marketDataMap}
                quoteCurrency={quoteCurrency}
                currentPage={page}
                pageSize={PAGE_SIZE}
                sortConfig={sortConfig}
                handleSort={handleSort}
                setSelectedAsset={setSelectedAsset}
                watchlistIds={watchedIds}
                onToggleWatchlist={(asset) => {
                  void (async () => {
                    try {
                      const backendId = await resolveBackendAssetId(asset)
                      if (watchedIds.has(asset.id) || watchedIds.has(backendId)) {
                        await handleRemove(backendId, asset.symbol)
                      } else {
                        await handleAdd({ ...asset, id: backendId })
                      }
                    } catch (err) {
                      const detail = err instanceof Error ? err.message : "Unknown error"
                      toast.error(`Failed to sync watchlist for ${asset.symbol}: ${detail}`)
                    }
                  })()
                }}
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
            formatCurrency={(val) => formatCurrency(val, quoteCurrency)}
            formatCompactCurrency={(val) => formatCompactCurrency(val, quoteCurrency)}
            isWatched={selectedAsset ? watchedIds.has(selectedAsset.id) || watchedIds.has(selectedAsset.symbol.toUpperCase()) : false}
            onToggleWatchlist={(asset) => {
              void (async () => {
                try {
                  const backendId = await resolveBackendAssetId(asset)
                  if (watchedIds.has(asset.id) || watchedIds.has(backendId)) {
                    await handleRemove(backendId, asset.symbol)
                  } else {
                    await handleAdd({ ...asset, id: backendId })
                  }
                } catch (err) {
                  const detail = err instanceof Error ? err.message : "Unknown error"
                  toast.error(`Failed to resolve ${asset.symbol}: ${detail}`)
                }
              })()
            }}
            watchlistLists={watchlistLists}
            watchlistMembershipByListId={selectedAssetWatchlistMembership}
            onAddToWatchlistList={(asset, listId) => {
              void addAssetToNamedWatchlist(asset, listId)
            }}
            onToggleWatchlistList={(asset, listId, currentlyInList) => {
              void toggleAssetInNamedWatchlist(asset, listId, currentlyInList)
            }}
            onCreateWatchlistList={() => {
              setCreateWatchlistDialogOpen(true)
            }}
          />

          <Dialog
            open={createWatchlistDialogOpen}
            onOpenChange={(open) => {
              setCreateWatchlistDialogOpen(open)
              if (!open) {
                setNewWatchlistName("")
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Watchlist</DialogTitle>
                <DialogDescription>
                  Enter a name to create a watchlist for this account.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                placeholder="e.g. Long Term, Scalps, AI Picks"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creatingWatchlist) {
                    e.preventDefault()
                    void createWatchlistList()
                  }
                }}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateWatchlistDialogOpen(false)}
                  disabled={creatingWatchlist}
                >
                  Cancel
                </Button>
                <Button onClick={() => void createWatchlistList()} disabled={creatingWatchlist}>
                  {creatingWatchlist ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function AssetsPage() {
  return <AssetsPageClient />
}
