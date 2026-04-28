"use client"

import * as React from "react"
import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { apiGet, apiPut, apiDelete, apiPost, type AssetResponse, type PaginatedResponse, type MarketDataResponse, type MlModelResponse, type WatchlistEntryResponse, type WatchlistListResponse } from "~/lib/api-client"
import { toast } from "sonner"
import { cn } from "~/lib/utils"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { useLiveTickers } from "~/lib/live-price-stream"
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
  AssetControls,
  AssetTable,
  AssetPagination,
  AssetDetailSheet
} from "~/components/assets"

const PAGE_SIZE = 20
const TRENDING_COINS_COUNT = 20
const TRENDING_PAGE_SIZE = 120
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000

type TimeRange = "24H" | "7D" | "1M" | "3M" | "1Y" | "MAX"
const TIME_RANGES: TimeRange[] = ["24H", "7D", "1M", "3M", "1Y", "MAX"]

const QUOTE_CURRENCIES = ["USD", "TRY", "EUR", "GBP", "JPY", "RUB", "CAD", "AUD", "CHF", "CNY"] as const
const USD_PEGGED_QUOTES = new Set<string>(["USD", "USDT", "USDC", "BUSD"])
const CURRENCY_SYMBOLS: Record<(typeof QUOTE_CURRENCIES)[number], string> = {
  USD: "$",
  TRY: "₺",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  RUB: "₽",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF ",
  CNY: "¥",
}
const FALLBACK_QUOTE_PER_USD: Record<(typeof QUOTE_CURRENCIES)[number], number> = {
  USD: 1,
  TRY: 38.5,
  EUR: 0.93,
  GBP: 0.8,
  JPY: 155,
  RUB: 92,
  CAD: 1.37,
  AUD: 1.52,
  CHF: 0.91,
  CNY: 7.24,
}

const formatWithCurrencySymbol = (
  value: number,
  currency: (typeof QUOTE_CURRENCIES)[number],
  options?: Intl.NumberFormatOptions,
) => {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(value)
  return `${CURRENCY_SYMBOLS[currency]}${formatted}`
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = (value: string) => UUID_REGEX.test(value)

const uniqueAssets = (primary: AssetResponse[], targetCount: number) => {
  const seenSymbols = new Set<string>()
  const merged: AssetResponse[] = []

  for (const asset of primary) {
    const key = asset.symbol.toUpperCase()
    if (seenSymbols.has(key)) continue
    seenSymbols.add(key)
    merged.push(asset)
    if (merged.length >= targetCount) return merged
  }

  return merged
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
  const [watchlistLists, setWatchlistLists] = React.useState<WatchlistListResponse[]>([])
  const [watchlistAssetsByListId, setWatchlistAssetsByListId] = React.useState<Record<string, AssetResponse[]>>({})
  const [addingId, setAddingId] = React.useState<string | null>(null)
  const [trendingAssets, setTrendingAssets] = React.useState<AssetResponse[]>([])
  const [backendAssetIdBySymbol, setBackendAssetIdBySymbol] = React.useState<Record<string, string>>({})
  const backendAssetIdBySymbolRef = React.useRef<Record<string, string>>({})
  const ensuredSymbolsRef = React.useRef<Set<string>>(new Set())
  const [createWatchlistDialogOpen, setCreateWatchlistDialogOpen] = React.useState(false)
  const [newWatchlistName, setNewWatchlistName] = React.useState("")
  const [creatingWatchlist, setCreatingWatchlist] = React.useState(false)
  const [quoteCurrency, setQuoteCurrency] = React.useState<(typeof QUOTE_CURRENCIES)[number]>(() => {
    if (typeof window === "undefined") return "USD"
    const saved = localStorage.getItem("assets.quoteCurrency")
    if (saved === "USDT" || saved === "USDC" || saved === "BUSD") return "USD"
    return QUOTE_CURRENCIES.includes(saved as (typeof QUOTE_CURRENCIES)[number])
      ? (saved as (typeof QUOTE_CURRENCIES)[number])
      : "USD"
  })
  const [quotePerUsd, setQuotePerUsd] = React.useState(1)

  React.useEffect(() => {
    localStorage.setItem("assets.quoteCurrency", quoteCurrency)
  }, [quoteCurrency])

  React.useEffect(() => {
    backendAssetIdBySymbolRef.current = backendAssetIdBySymbol
  }, [backendAssetIdBySymbol])

  const normalizedQuoteCurrency: (typeof QUOTE_CURRENCIES)[number] =
    QUOTE_CURRENCIES.includes(quoteCurrency) ? quoteCurrency : "USD"
  const marketQuoteCurrency = USD_PEGGED_QUOTES.has(normalizedQuoteCurrency)
    ? "USDT"
    : normalizedQuoteCurrency

  React.useEffect(() => {
    if (normalizedQuoteCurrency === "USD") {
      setQuotePerUsd(1)
      return
    }
    let cancelled = false
    const loadFx = async () => {
      try {
        let nextRate: number | null = null
        const response = await fetch("https://api.coingecko.com/api/v3/exchange_rates")
        if (response.ok) {
          const data = (await response.json()) as {
            rates?: Record<string, { value?: number }>
          }
          const usdRate = data.rates?.usd?.value
          const targetRate = data.rates?.[normalizedQuoteCurrency.toLowerCase()]?.value
          if (Number.isFinite(usdRate) && Number.isFinite(targetRate) && usdRate && targetRate) {
            nextRate = targetRate / usdRate
          }
        }
        if (nextRate === null) {
          const fallbackResponse = await fetch("https://open.er-api.com/v6/latest/USD")
          if (!fallbackResponse.ok) throw new Error("Fallback exchange rates unavailable")
          const fallbackData = (await fallbackResponse.json()) as {
            rates?: Record<string, number>
          }
          const targetRate = fallbackData.rates?.[normalizedQuoteCurrency]
          if (Number.isFinite(targetRate) && targetRate) nextRate = targetRate
        }
        if (!cancelled && nextRate !== null) {
          setQuotePerUsd(nextRate)
        }
      } catch {
        if (!cancelled) setQuotePerUsd(FALLBACK_QUOTE_PER_USD[normalizedQuoteCurrency])
      }
    }
    void loadFx()
    return () => {
      cancelled = true
    }
  }, [normalizedQuoteCurrency])

  const formatCurrency = React.useCallback((val?: number) => {
    if (val === undefined) return "—"
    return formatWithCurrencySymbol(val, normalizedQuoteCurrency)
  }, [normalizedQuoteCurrency])

  const formatCompactCurrency = React.useCallback((val?: number) => {
    if (val === undefined) return "—"
    return formatWithCurrencySymbol(val, normalizedQuoteCurrency, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }, [normalizedQuoteCurrency])

  const handleSort = (key: "name" | "symbol" | "category" | "is_active" | "activity") => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key, direction: "desc" }
    })
  }

  const fetchChartData = React.useCallback(async (asset: AssetResponse, range: TimeRange, backendAssetId?: string) => {
    setChartLoading(true)
    setMarketStats(null)
    setChartData([])
    try {
      const now = new Date()
      let timeFrom = new Date()
      let resolution = "1d"
      let binanceInterval = "1d"

      switch (range) {
        case "24H":
          timeFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          resolution = "1h"
          binanceInterval = "1h"
          break
        case "7D":
          timeFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          binanceInterval = "4h"
          break
        case "1M":
          timeFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          binanceInterval = "1d"
          break
        case "3M":
          timeFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          resolution = "1d"
          binanceInterval = "1d"
          break
        case "1Y":
          timeFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          resolution = "1w"
          binanceInterval = "1w"
          break
        case "MAX":
          timeFrom = new Date(now.getTime() - FIVE_YEARS_MS)
          resolution = "1mo"
          binanceInterval = "1M"
          break
      }

      let hasBackendData = false
      const apiAssetId = backendAssetId && isUuid(backendAssetId) ? backendAssetId : isUuid(asset.id) ? asset.id : null
      if (apiAssetId) {
        try {
          const data = await apiGet<PaginatedResponse<MarketDataResponse>>("/market-data", {
            asset_id: apiAssetId,
            time_from: timeFrom.toISOString(),
            time_to: now.toISOString(),
            resolution: resolution,
            page_size: 100,
          })
          if (data.items.length > 0) {
            hasBackendData = true
            const sortedItems = [...data.items].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
            const latest = sortedItems[sortedItems.length - 1]
            const first = sortedItems[0]
            const fx = Number.isFinite(quotePerUsd) ? quotePerUsd : 1
            const currentPrice = latest.close * fx
            const currentVolume = latest.volume * fx
            const firstClose = first.close * fx
            const priceChange = firstClose > 0 ? ((currentPrice - firstClose) / firstClose) * 100 : 0

            setMarketStats({
              price: currentPrice,
              change24h: priceChange,
              volume: currentVolume
            })

            const formatted = sortedItems.map(item => ({
              date: item.time,
              price: item.close * fx,
              volume: item.volume * fx,
              confidence: item.close * fx * 0.95
            }))
            setChartData(formatted)
          }
        } catch (backendErr) {
          console.warn("Backend market-data unavailable, using Binance fallback:", backendErr)
        }
      }

      if (!hasBackendData) {
        // Binance market fallback always reads USDT history, then converts locally.
        const usdtPair = `${asset.symbol.toUpperCase()}USDT`
        const startTime = timeFrom.getTime()
        const usdtRes = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${usdtPair}&interval=${binanceInterval}&startTime=${startTime}&endTime=${now.getTime()}&limit=1000`,
        )
        if (!usdtRes.ok) throw new Error("Failed to fetch Binance USDT klines")
        const klines = (await usdtRes.json()) as Array<
          [number, string, string, string, string, string, number, string, number, string, string, string]
        >
        if (!Array.isArray(klines) || klines.length === 0) throw new Error("No Binance USDT klines data")
        const fx = Number.isFinite(quotePerUsd) ? quotePerUsd : 1

        const first = klines[0]
        const latest = klines[klines.length - 1]
        const firstClose = Number.parseFloat(first[4]) * fx
        const latestClose = Number.parseFloat(latest[4]) * fx
        const latestVolume = Number.parseFloat(latest[7]) * fx
        const priceChange = firstClose > 0 ? ((latestClose - firstClose) / firstClose) * 100 : 0
        setMarketStats({
          price: latestClose,
          change24h: priceChange,
          volume: Number.isFinite(latestVolume) ? latestVolume : 0,
        })
        setChartData(
          klines.map((kline) => {
            const close = Number.parseFloat(kline[4])
            const volume = Number.parseFloat(kline[7]) * fx
            return {
              date: new Date(kline[0]).toISOString(),
              price: close * fx,
              volume: Number.isFinite(volume) ? volume : 0,
              confidence: close * fx * 0.95,
            }
          }),
        )
      }
    } catch (err) {
      console.error("Failed to fetch chart data from all sources:", err)
      try {
        if (!asset.coingecko_id) throw new Error("Asset has no CoinGecko id")
        const days =
          range === "24H" ? "1" :
          range === "7D" ? "7" :
          range === "1M" ? "30" :
          range === "3M" ? "90" :
          range === "1Y" ? "365" : "max"
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${asset.coingecko_id}/market_chart?vs_currency=usd&days=${days}`,
        )
        if (!response.ok) throw new Error("CoinGecko market chart unavailable")
        const data = (await response.json()) as {
          prices?: Array<[number, number]>
          total_volumes?: Array<[number, number]>
        }
        const prices = Array.isArray(data.prices) ? data.prices : []
        if (prices.length === 0) throw new Error("No CoinGecko price points")
        const volumesByTime = new Map(
          (Array.isArray(data.total_volumes) ? data.total_volumes : []).map(([time, volume]) => [time, volume]),
        )
        const fx = Number.isFinite(quotePerUsd) ? quotePerUsd : 1
        const points = prices
          .map(([time, price]) => {
            if (!Number.isFinite(price)) return null
            const volume = volumesByTime.get(time) ?? 0
            return {
              date: new Date(time).toISOString(),
              price: price * fx,
              volume: Number.isFinite(volume) ? volume * fx : 0,
              confidence: price * fx * 0.95,
            }
          })
          .filter((point): point is { date: string; price: number; volume: number; confidence: number } => point != null)
        if (points.length === 0) throw new Error("No formatted CoinGecko chart points")
        const first = points[0]
        const latest = points[points.length - 1]
        setMarketStats({
          price: latest.price,
          change24h: first.price > 0 ? ((latest.price - first.price) / first.price) * 100 : 0,
          volume: latest.volume,
        })
        setChartData(points)
      } catch (fallbackErr) {
        console.error("CoinGecko chart fallback failed:", fallbackErr)
        setMarketStats(null)
        setChartData([])
      }
    } finally {
      setChartLoading(false)
    }
  }, [marketQuoteCurrency, quotePerUsd])

  React.useEffect(() => {
    if (selectedAsset) {
      const backendAssetId =
        backendAssetIdBySymbol[selectedAsset.symbol.toUpperCase()] ||
        (isUuid(selectedAsset.id) ? selectedAsset.id : undefined)

      void fetchChartData(selectedAsset, timeRange, backendAssetId)

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
  }, [selectedAsset, timeRange, fetchChartData, backendAssetIdBySymbol])

  const ensureAssetsPersisted = React.useCallback(async (rows: AssetResponse[]) => {
    const needsEnsure = rows.filter((asset) => {
      if (isUuid(asset.id)) return false
      const symbol = asset.symbol.toUpperCase()
      if (backendAssetIdBySymbolRef.current[symbol]) return false
      if (ensuredSymbolsRef.current.has(symbol)) return false
      ensuredSymbolsRef.current.add(symbol)
      return true
    })
    if (needsEnsure.length === 0) return

    const settled = await Promise.allSettled(
      needsEnsure.map((asset) =>
        apiPost<AssetResponse>("/assets/ensure", {
          symbol: asset.symbol,
          name: asset.name,
          category: asset.category || "General",
          coingecko_id: asset.coingecko_id || null,
          is_active: true,
        }),
      ),
    )

    setBackendAssetIdBySymbol((prev) => {
      const next = { ...prev }
      for (let i = 0; i < settled.length; i += 1) {
        const result = settled[i]
        const symbol = needsEnsure[i]?.symbol?.toUpperCase()
        if (!symbol) continue
        if (result.status === "fulfilled" && result.value?.id) {
          next[symbol] = result.value.id
        } else {
          ensuredSymbolsRef.current.delete(symbol)
        }
      }
      return next
    })
  }, [])

  const fetchAssets = React.useCallback(async (currentPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<PaginatedResponse<AssetResponse>>("/assets", {
        page: currentPage,
        page_size: PAGE_SIZE,
      })
      setBackendAssetIdBySymbol((prev) => {
        const next = { ...prev }
        for (const asset of data.items) {
          if (isUuid(asset.id)) next[asset.symbol.toUpperCase()] = asset.id
        }
        return next
      })
      const mergedItems = uniqueAssets(data.items, PAGE_SIZE)
      setAssets(mergedItems)
      setTotal(Math.max(data.total, mergedItems.length))
      await ensureAssetsPersisted(mergedItems)
    } catch (err) {
      console.error("API failed to fetch assets:", err)
      setAssets([])
      setTotal(0)
      setError("Failed to load assets from the API.")
    } finally {
      setLoading(false)
    }
  }, [ensureAssetsPersisted])

  React.useEffect(() => {
    void fetchAssets(page)
  }, [fetchAssets, page])

  const fetchTrendingAssets = React.useCallback(async () => {
    try {
      const data = await apiGet<PaginatedResponse<AssetResponse>>("/assets", {
        page: 1,
        page_size: TRENDING_PAGE_SIZE,
      })
      setBackendAssetIdBySymbol((prev) => {
        const next = { ...prev }
        for (const asset of data.items) {
          if (isUuid(asset.id)) next[asset.symbol.toUpperCase()] = asset.id
        }
        return next
      })
      const merged = uniqueAssets(data.items, TRENDING_PAGE_SIZE)
      setTrendingAssets(merged)
      await ensureAssetsPersisted(merged)
    } catch (err) {
      console.error("API failed to fetch trending assets:", err)
      setTrendingAssets([])
    }
  }, [ensureAssetsPersisted])

  React.useEffect(() => {
    void fetchTrendingAssets()
  }, [fetchTrendingAssets])

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
      await apiPut(`/users/me/watchlist/${asset.id}`)
      await fetchWatchlist()
      toast.success(`Added ${asset.symbol} to watchlist`)
    } catch (err) {
      toast.error(`Failed to add ${asset.symbol}`)
    } finally {
      setAddingId(null)
    }
  }

  const resolveBackendAssetId = async (asset: AssetResponse): Promise<string> => {
    if (isUuid(asset.id)) return asset.id
    const symbol = asset.symbol.toUpperCase()
    const existing = backendAssetIdBySymbol[symbol]
    if (existing) return existing

    try {
      const data = await apiGet<PaginatedResponse<AssetResponse>>("/assets", { page: 1, page_size: 500 })
      const matched = data.items.find((item) => item.symbol.toUpperCase() === symbol)
      if (matched?.id) {
        ensuredSymbolsRef.current.add(symbol)
        setBackendAssetIdBySymbol((prev) => ({ ...prev, [symbol]: matched.id }))
        return matched.id
      }
    } catch {
      // Ignore and try ensure fallback.
    }

    try {
      const created = await apiPost<AssetResponse>("/assets/ensure", {
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category || "General",
        coingecko_id: asset.coingecko_id || null,
        is_active: true,
      })
      if (created?.id) {
        ensuredSymbolsRef.current.add(symbol)
        setBackendAssetIdBySymbol((prev) => ({ ...prev, [symbol]: created.id }))
        return created.id
      }
      throw new Error(`Ensure endpoint returned no id for ${asset.symbol}`)
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : `Failed to ensure ${asset.symbol} in backend`
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
      await apiPost<WatchlistListResponse>("/users/me/watchlists", { name })
      await fetchWatchlistLists()
      setCreateWatchlistDialogOpen(false)
      setNewWatchlistName("")
      toast.success("Watchlist created")
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
      toast.success(`Added ${asset.symbol} to watchlist`)
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
        await apiDelete(`/users/me/watchlists/${listId}/assets/${backendId}`)
        setWatchlistAssetsByListId((prev) => ({
          ...prev,
          [listId]: (prev[listId] || []).filter(
            (item) => item.id !== backendId && item.symbol.toUpperCase() !== asset.symbol.toUpperCase(),
          ),
        }))
        await fetchWatchlist()
        toast.success(`Removed ${asset.symbol} from ${list?.name || "watchlist"}`)
      } else {
        await apiPut(`/users/me/watchlists/${listId}/assets/${backendId}`)
        setWatchlistAssetsByListId((prev) => ({
          ...prev,
          [listId]: [
            ...(prev[listId] || []).filter((item) => item.symbol.toUpperCase() !== asset.symbol.toUpperCase()),
            { ...asset, id: backendId },
          ],
        }))
        await fetchWatchlist()
        toast.success(`Added ${asset.symbol} to ${list?.name || "watchlist"}`)
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error"
      toast.error(`Failed to update ${asset.symbol}: ${detail}`)
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
  const trendingCoins = React.useMemo(
    () => trendingAssets.slice(0, TRENDING_COINS_COUNT),
    [trendingAssets],
  )
  const trendingSymbols = React.useMemo(
    () => trendingCoins.map((asset) => `${asset.symbol.toUpperCase()}USDT`),
    [trendingCoins],
  )
  const trendingTickers = useLiveTickers(trendingSymbols)

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
        <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-8 md:px-8 md:pb-8 md:pt-10">
          {/* Trending Assets Row */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-3">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80 flex items-center gap-2">
                Trending Coins
              </h3>
            </div>
            <div className="flex gap-4 overflow-x-auto p-3 scrollbar-none">
              {trendingCoins.map((asset) => {
                const ticker = trendingTickers[`${asset.symbol.toUpperCase()}USDT`]
                const changePct = ticker?.changePct
                const isUp = Number.isFinite(changePct) ? (changePct as number) >= 0 : null
                return (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className="flex min-w-[200px] items-center gap-4 rounded-2xl border border-border/50 bg-card/30 p-4 transition-all hover:scale-[1.02] hover:bg-card/50 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 ring-1 ring-primary/20">
                      <img
                        src={`https://cryptoicons.org/api/icon/${asset.symbol.toLowerCase()}/64`}
                        alt={`${asset.symbol} icon`}
                        className="size-full object-cover"
                        onError={(e) => {
                          const img = e.currentTarget
                          if (!img.dataset.fallbackTried) {
                            img.dataset.fallbackTried = "1"
                            img.src = `https://assets.coincap.io/assets/icons/${asset.symbol.toLowerCase()}@2x.png`
                            return
                          }
                          img.style.display = "none"
                          const fallback = img.nextElementSibling as HTMLSpanElement | null
                          if (fallback) fallback.style.display = "flex"
                        }}
                      />
                      <span
                        className="hidden size-full items-center justify-center font-black text-primary"
                      >
                        {asset.symbol.slice(0, 3)}
                      </span>
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="truncate font-black tracking-tight">{asset.name}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{asset.symbol}</span>
                    </div>
                    <div className="ml-auto flex flex-col items-end">
                      <span className={cn(
                        "text-[10px] font-black",
                        isUp === null ? "text-muted-foreground" : isUp ? "text-green-500" : "text-red-500"
                      )}>
                        {Number.isFinite(changePct)
                          ? `${(changePct as number) >= 0 ? "+" : ""}${(changePct as number).toFixed(2)}%`
                          : "—"}
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
            quoteCurrency={normalizedQuoteCurrency}
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
                search={search}
                currentPage={page}
                pageSize={PAGE_SIZE}
                sortConfig={sortConfig}
                handleSort={handleSort}
                setSelectedAsset={setSelectedAsset}
                quoteCurrency={normalizedQuoteCurrency}
                quotePerUsd={quotePerUsd}
                marketAssets={trendingAssets.length > 0 ? trendingAssets : assets}
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
            quoteCurrency={normalizedQuoteCurrency}
            quotePerUsd={quotePerUsd}
            isWatched={selectedAsset ? watchedIds.has(selectedAsset.id) || selectedAssetIsInNamedWatchlist : false}
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
