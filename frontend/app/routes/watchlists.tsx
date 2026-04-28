"use client"

import * as React from "react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router"
import { ArrowRight, Edit3, ExternalLink, Grid, List, ListChecks, MoreVertical, Plus, Trash2 } from "lucide-react"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
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
import { useLiveTickers } from "~/lib/live-price-stream"
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
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "~/components/ui/avatar"
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

type TimeRange = "1h" | "24h" | "7d" | "30d" | "1m" | "3m" | "1y" | "max"
const TIME_RANGES: TimeRange[] = ["1h", "24h", "7d", "30d", "1m", "3m", "1y", "max"]
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value: string) => UUID_REGEX.test(value)

type WatchlistListEntryResponse = {
  list_id: string
  asset: AssetResponse
}

type WatchlistRangeStats = {
  changePct: number
  volume: number
  sparkline: string
}

const buildSparklinePath = (values: number[]) => {
  if (values.length < 2) return "0,25 L 25,23 L 50,24 L 75,22 L 100,24"
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100
      const y = 32 - ((value - min) / span) * 24
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" L ")
}

const getWatchlistRangeConfig = (range: string) => {
  switch (range) {
    case "1h":
      return { interval: "1m", limit: 60 }
    case "7d":
      return { interval: "4h", limit: 42 }
    case "30d":
      return { interval: "1d", limit: 30 }
    case "24h":
    default:
      return { interval: "1h", limit: 24 }
  }
}

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
    <Tooltip>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent>
        {asset.name} ({asset.symbol})
      </TooltipContent>
    </Tooltip>
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
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [newWatchlistName, setNewWatchlistName] = React.useState("")
  const [creatingWatchlist, setCreatingWatchlist] = React.useState(false)
  const [editWatchlist, setEditWatchlist] = React.useState<WatchlistListResponse | null>(null)
  const [editWatchlistName, setEditWatchlistName] = React.useState("")
  const [updatingWatchlist, setUpdatingWatchlist] = React.useState(false)
  const [deleteWatchlist, setDeleteWatchlist] = React.useState<WatchlistListResponse | null>(null)
  const [deletingWatchlist, setDeletingWatchlist] = React.useState(false)
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
  const [rangeStatsBySymbol, setRangeStatsBySymbol] = React.useState<Record<string, WatchlistRangeStats>>({})
  const [rangeStatsLoading, setRangeStatsLoading] = React.useState(false)
  const rangeStatsRequestRef = React.useRef(0)

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

  const createWatchlist = React.useCallback(async () => {
    const name = newWatchlistName.trim()
    if (!name) {
      toast.error("Please enter a watchlist name")
      return
    }
    setCreatingWatchlist(true)
    try {
      const created = await apiPost<WatchlistListResponse>("/users/me/watchlists", { name })
      setNewWatchlistName("")
      setCreateDialogOpen(false)
      await fetchWatchlistLists()
      setSelectedWatchlistList(created)
      toast.success("Watchlist created")
    } catch {
      toast.error("Failed to create watchlist")
    } finally {
      setCreatingWatchlist(false)
    }
  }, [fetchWatchlistLists, newWatchlistName])

  const openEditWatchlist = React.useCallback((list: WatchlistListResponse) => {
    setEditWatchlist(list)
    setEditWatchlistName(list.name)
  }, [])

  const updateWatchlistName = React.useCallback(async () => {
    if (!editWatchlist) return
    const name = editWatchlistName.trim()
    if (!name) {
      toast.error("Please enter a watchlist name")
      return
    }
    setUpdatingWatchlist(true)
    try {
      const updated = await apiPatch<WatchlistListResponse>(`/users/me/watchlists/${editWatchlist.id}`, { name })
      setWatchlistLists((prev) => prev.map((list) => (list.id === updated.id ? updated : list)))
      setSelectedWatchlistList((prev) => (prev?.id === updated.id ? updated : prev))
      setEditWatchlist(null)
      setEditWatchlistName("")
      toast.success("Watchlist renamed")
    } catch {
      toast.error("Failed to rename watchlist")
    } finally {
      setUpdatingWatchlist(false)
    }
  }, [editWatchlist, editWatchlistName])

  const removeWatchlistList = React.useCallback(async () => {
    if (!deleteWatchlist) return
    setDeletingWatchlist(true)
    try {
      await apiDelete(`/users/me/watchlists/${deleteWatchlist.id}`)
      setWatchlistLists((prev) => prev.filter((list) => list.id !== deleteWatchlist.id))
      setWatchlistAssetsByListId((prev) => {
        const next = { ...prev }
        delete next[deleteWatchlist.id]
        return next
      })
      setSelectedWatchlistList((prev) => (prev?.id === deleteWatchlist.id ? null : prev))
      setDeleteWatchlist(null)
      toast.success("Watchlist removed")
    } catch {
      toast.error("Failed to remove watchlist")
    } finally {
      setDeletingWatchlist(false)
    }
  }, [deleteWatchlist])

  const openWatchlistList = React.useCallback((list: WatchlistListResponse) => {
    setSelectedWatchlistList(list)
    setSearch("")
    setPage(1)
  }, [])

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
  const filteredWatchlistSymbolsKey = React.useMemo(
    () => filteredWatchlist.map(({ asset }) => asset.symbol.toUpperCase()).join("|"),
    [filteredWatchlist],
  )

  const totalPages = Math.ceil(filteredWatchlist.length / PAGE_SIZE)
  const paginatedWatchlist = filteredWatchlist.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const watchlistTickerSymbols = React.useMemo(
    () => filteredWatchlist.map(({ asset }) => `${asset.symbol.toUpperCase()}USDT`),
    [filteredWatchlist],
  )
  const liveTickerBySymbol = useLiveTickers(watchlistTickerSymbols)
  const showListOverview = selectedWatchlistList === null

  React.useEffect(() => {
    if (showListOverview || filteredWatchlist.length === 0) {
      setRangeStatsBySymbol({})
      setRangeStatsLoading(false)
      return
    }

    const currentRequest = rangeStatsRequestRef.current + 1
    rangeStatsRequestRef.current = currentRequest
    setRangeStatsLoading(true)

    const timeout = window.setTimeout(() => {
      const symbols = Array.from(new Set(filteredWatchlist.map(({ asset }) => asset.symbol.toUpperCase())))
      const { interval, limit } = getWatchlistRangeConfig(watchlistTimeRange)

      void Promise.allSettled(
        symbols.map(async (symbol) => {
          const response = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`,
          )
          if (!response.ok) throw new Error(`No Binance data for ${symbol}`)
          const klines = (await response.json()) as Array<
            [number, string, string, string, string, string, number, string]
          >
          const closes = klines.map((kline) => Number.parseFloat(kline[4])).filter(Number.isFinite)
          if (closes.length < 2) throw new Error(`Not enough range data for ${symbol}`)
          const first = closes[0]
          const last = closes[closes.length - 1]
          const volume = klines.reduce((sum, kline) => {
            const quoteVolume = Number.parseFloat(kline[7])
            return sum + (Number.isFinite(quoteVolume) ? quoteVolume : 0)
          }, 0)
          return [
            `${symbol}USDT`,
            {
              changePct: first > 0 ? ((last - first) / first) * 100 : 0,
              volume,
              sparkline: buildSparklinePath(closes),
            },
          ] as const
        }),
      ).then((results) => {
        if (rangeStatsRequestRef.current !== currentRequest) return
        const next: Record<string, WatchlistRangeStats> = {}
        for (const result of results) {
          if (result.status === "fulfilled") {
            const [symbol, stats] = result.value
            next[symbol] = stats
          }
        }
        setRangeStatsBySymbol(next)
        setRangeStatsLoading(false)
      })
    }, 500)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [filteredWatchlistSymbolsKey, showListOverview, watchlistTimeRange])

  return (
    <DashboardLayout title={selectedWatchlistList?.name || "Watchlists"}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-8 md:px-8 md:pb-8 md:pt-10">

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
              timeRangeLoading={rangeStatsLoading}
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
                <div className="flex rounded-2xl border border-border/50 bg-card/40 p-1 shadow-sm">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setOverviewViewMode("grid")}
                          className={`flex size-10 items-center justify-center rounded-xl transition-all ${
                            overviewViewMode === "grid"
                              ? "bg-foreground text-background shadow-md"
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
                          className={`flex size-10 items-center justify-center rounded-xl transition-all ${
                            overviewViewMode === "list"
                              ? "bg-foreground text-background shadow-md"
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
                  <TooltipProvider>
                    {overviewViewMode === "list" ? (
                  <div className="overflow-hidden rounded-3xl border border-border/50 bg-card/30 shadow-2xl shadow-primary/5">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50 bg-muted/20">
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
                                      {new Date(list.created_at).toLocaleDateString()}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Created {new Date(list.created_at).toLocaleString()}
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
                    ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                                    Created {new Date(list.created_at).toLocaleDateString()}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Created {new Date(list.created_at).toLocaleString()}
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
                  </TooltipProvider>
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
                              rangeStatsBySymbol={rangeStatsBySymbol}
                              rangeStatsLoading={rangeStatsLoading}
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
                          rangeStatsBySymbol={rangeStatsBySymbol}
                          rangeStatsLoading={rangeStatsLoading}
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

          <Dialog
            open={createDialogOpen}
            onOpenChange={(open) => {
              setCreateDialogOpen(open)
              if (!open) setNewWatchlistName("")
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Watchlist</DialogTitle>
                <DialogDescription>
                  Add a named list to organize tracked assets.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={newWatchlistName}
                onChange={(event) => setNewWatchlistName(event.target.value)}
                placeholder="e.g. AI Picks"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !creatingWatchlist) {
                    event.preventDefault()
                    void createWatchlist()
                  }
                }}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={creatingWatchlist}
                >
                  Cancel
                </Button>
                <Button onClick={() => void createWatchlist()} disabled={creatingWatchlist}>
                  {creatingWatchlist ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={editWatchlist !== null}
            onOpenChange={(open) => {
              if (!open) {
                setEditWatchlist(null)
                setEditWatchlistName("")
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Rename Watchlist</DialogTitle>
                <DialogDescription>
                  Update the name shown on the watchlists page.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={editWatchlistName}
                onChange={(event) => setEditWatchlistName(event.target.value)}
                placeholder="Watchlist name"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !updatingWatchlist) {
                    event.preventDefault()
                    void updateWatchlistName()
                  }
                }}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditWatchlist(null)}
                  disabled={updatingWatchlist}
                >
                  Cancel
                </Button>
                <Button onClick={() => void updateWatchlistName()} disabled={updatingWatchlist}>
                  {updatingWatchlist ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={deleteWatchlist !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteWatchlist(null)
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Remove Watchlist</DialogTitle>
                <DialogDescription>
                  Remove "{deleteWatchlist?.name}" and all assets tracked inside it. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteWatchlist(null)}
                  disabled={deletingWatchlist}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void removeWatchlistList()}
                  disabled={deletingWatchlist}
                >
                  {deletingWatchlist ? "Removing..." : "Remove"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
