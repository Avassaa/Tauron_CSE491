import * as React from "react"
import { apiGet, type AssetResponse, type PaginatedResponse, type MarketDataResponse } from "~/lib/api-client"
import { type MarketData } from "~/components/assets"

type TimeRange = "24H" | "7D" | "1M" | "3M" | "1Y" | "MAX"
const LIVE_MARKET_CACHE_TTL_MS = 20_000
const liveMarketCache = new Map<string, { at: number; data: any[] }>()
const liveMarketInFlight = new Map<string, Promise<any[]>>()
const BINANCE_SPARKLINE_TTL_MS = 5 * 60_000
const binanceSparklineCache = new Map<string, { at: number; points: number[] }>()
const binanceSparklineInFlight = new Map<string, Promise<number[]>>()
const BINANCE_DERIVED_TTL_MS = 2 * 60_000
const binanceDerivedCache = new Map<string, { at: number; data: { sparkline: number[]; change1h: number | null; change7d: number | null } }>()
const binanceDerivedInFlight = new Map<string, Promise<{ sparkline: number[]; change1h: number | null; change7d: number | null }>>()

function normalizeBinanceBaseSymbol(raw: string): string | null {
  const normalized = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (!normalized || normalized.length < 2 || normalized.length > 12) return null
  return normalized
}

function toBinanceUsdtPair(baseSymbol: string): string {
  return baseSymbol === "USDT" ? "USDTUSD" : `${baseSymbol}USDT`
}

async function fetchBinanceKlinesWithFallback(pair: string, interval: string, limit: number): Promise<any[]> {
  const safeLimit = Math.max(1, Math.min(limit, 1000))
  const urls = [
    `https://www.binance.com/api/v3/uiKlines?symbol=${pair}&interval=${interval}&limit=${safeLimit}`,
    `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${safeLimit}`,
    `https://www.binance.com/fapi/v1/continuousKlines?interval=${interval}&limit=${safeLimit}&pair=${pair}&contractType=PERPETUAL`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const payload = await res.json()
      if (Array.isArray(payload) && payload.length > 0) return payload
    } catch {
      // Try next endpoint.
    }
  }
  return []
}

async function fetchLiveMarketCached(symbols: string): Promise<any[]> {
  const key = symbols
  const now = Date.now()
  const cached = liveMarketCache.get(key)
  if (cached && now - cached.at <= LIVE_MARKET_CACHE_TTL_MS) return cached.data

  const existing = liveMarketInFlight.get(key)
  if (existing) return existing

  const promise = apiGet<any[]>("/assets/live-market", { symbols, limit: 500 })
    .then((data) => {
      liveMarketCache.set(key, { at: Date.now(), data })
      return data
    })
    .finally(() => {
      liveMarketInFlight.delete(key)
    })
  liveMarketInFlight.set(key, promise)
  return promise
}

async function fetchBinanceSparkline7d(symbol: string): Promise<number[]> {
  const normalized = normalizeBinanceBaseSymbol(symbol)
  if (!normalized) return []
  const cache = binanceSparklineCache.get(normalized)
  if (cache && Date.now() - cache.at <= BINANCE_SPARKLINE_TTL_MS) return cache.points

  const inFlight = binanceSparklineInFlight.get(normalized)
  if (inFlight) return inFlight

  const promise = fetchBinanceKlinesWithFallback(toBinanceUsdtPair(normalized), "4h", 42)
    .then((payload) =>
      payload
        .map((row: any) => Number.parseFloat(String(row?.[4] ?? "")))
        .filter((v: number) => Number.isFinite(v))
    )
    .catch(() => [])
    .then((points) => {
      binanceSparklineCache.set(normalized, { at: Date.now(), points })
      return points
    })
    .finally(() => {
      binanceSparklineInFlight.delete(normalized)
    })

  binanceSparklineInFlight.set(normalized, promise)
  return promise
}

function computePctChange(first: number, latest: number): number | null {
  if (!Number.isFinite(first) || !Number.isFinite(latest) || first <= 0) return null
  return ((latest - first) / first) * 100
}

async function fetchBinanceDerivedChanges(symbol: string): Promise<{ sparkline: number[]; change1h: number | null; change7d: number | null }> {
  const normalized = normalizeBinanceBaseSymbol(symbol)
  if (!normalized) return { sparkline: [], change1h: null, change7d: null }

  const cached = binanceDerivedCache.get(normalized)
  if (cached && Date.now() - cached.at <= BINANCE_DERIVED_TTL_MS) return cached.data

  const inFlight = binanceDerivedInFlight.get(normalized)
  if (inFlight) return inFlight

  const promise = (async () => {
    const pair = toBinanceUsdtPair(normalized)
    const [sparklineRows, oneHourRows] = await Promise.all([
      fetchBinanceKlinesWithFallback(pair, "4h", 42),
      fetchBinanceKlinesWithFallback(pair, "5m", 13),
    ])

    const sparkline = Array.isArray(sparklineRows)
      ? sparklineRows
          .map((row: any) => Number.parseFloat(String(row?.[4] ?? "")))
          .filter((v: number) => Number.isFinite(v))
      : []

    const oneHourPrices = Array.isArray(oneHourRows)
      ? oneHourRows
          .map((row: any) => Number.parseFloat(String(row?.[4] ?? "")))
          .filter((v: number) => Number.isFinite(v))
      : []

    const change7d = sparkline.length > 1
      ? computePctChange(sparkline[0], sparkline[sparkline.length - 1])
      : null
    const change1h = oneHourPrices.length > 1
      ? computePctChange(oneHourPrices[0], oneHourPrices[oneHourPrices.length - 1])
      : null

    return { sparkline, change1h, change7d }
  })()
    .catch(() => ({ sparkline: [], change1h: null, change7d: null }))
    .then((data) => {
      binanceDerivedCache.set(normalized, { at: Date.now(), data })
      return data
    })
    .finally(() => {
      binanceDerivedInFlight.delete(normalized)
    })

  binanceDerivedInFlight.set(normalized, promise)
  return promise
}

export function useMarketData() {
  const [marketDataMap, setMarketDataMap] = React.useState<Record<string, MarketData>>({})
  const [chartData, setChartData] = React.useState<any[]>([])
  const [chartLoading, setChartLoading] = React.useState(false)
  const [marketStats, setMarketStats] = React.useState<any>(null)

  const fetchEnrichedMarketData = React.useCallback(async (assetsToEnrich: AssetResponse[]) => {
    const symbols = assetsToEnrich
      .map((a) => a.symbol?.toUpperCase())
      .filter(Boolean)
      .join(",")

    if (!symbols) return

    try {
      const data = await fetchLiveMarketCached(symbols)

      const newMap: Record<string, any> = {}
      const sparklineTasks: Promise<void>[] = []
      data.forEach((coin: any) => {
        const asset = assetsToEnrich.find((a) => a.symbol.toUpperCase() === String(coin.symbol || "").toUpperCase())
        if (asset) {
          const symbol = normalizeBinanceBaseSymbol(asset.symbol)
          newMap[asset.id] = {
            price: coin.price,
            price_change_1h: coin.price_change_1h,
            price_change_24h: coin.price_change_24h,
            price_change_7d: coin.price_change_7d,
            price_change_14d: null,
            price_change_30d: coin.price_change_30d,
            price_change_1y: coin.price_change_1y,
            volume: coin.volume,
            market_cap: coin.market_cap,
            rank: coin.rank,
            sparkline: [],
          }
          if (symbol) {
            sparklineTasks.push(
              fetchBinanceDerivedChanges(symbol)
                .then((derived) => {
                  if (!newMap[asset.id]) return
                  if (derived.sparkline.length > 0) {
                    newMap[asset.id].sparkline = derived.sparkline
                  }
                  if (derived.change1h !== null) {
                    newMap[asset.id].price_change_1h = derived.change1h
                  }
                  if (derived.change7d !== null) {
                    newMap[asset.id].price_change_7d = derived.change7d
                  }
                })
            )
          }
        }
      })
      await Promise.all(sparklineTasks)
      setMarketDataMap((prev) => ({ ...prev, ...newMap }))
    } catch (err) {
      console.error("Failed to fetch live market data from backend:", err)
    }
  }, [])

  const fetchChartData = React.useCallback(async (asset: AssetResponse, range: TimeRange) => {
    setChartLoading(true)
    const assetId = asset.id
    const assetSymbol = normalizeBinanceBaseSymbol(asset.symbol)

    const cgData = marketDataMap[assetId]
    setMarketStats((prev: any) => ({
      ...prev,
      price: cgData?.price,
      change24h: cgData?.price_change_24h,
      rangeChange: undefined,
      volume: cgData?.volume,
      change1h: cgData?.price_change_1h,
      change7d: cgData?.price_change_7d,
      change14d: cgData?.price_change_14d,
      change30d: cgData?.price_change_30d,
      change1y: cgData?.price_change_1y,
    }))

    try {
      if (!assetSymbol) throw new Error("Invalid symbol")

      // Primary source: Binance UI/spot/futures klines with larger window.
      const pair = toBinanceUsdtPair(assetSymbol)
      const binInterval =
        range === "24H" ? "5m" :
        range === "7D" ? "30m" :
        range === "1M" ? "1h" :
        range === "3M" ? "4h" :
        range === "1Y" ? "1d" : "1d"
      const binLimit =
        range === "24H" ? 288 :
        range === "7D" ? 336 :
        range === "1M" ? 720 :
        range === "3M" ? 540 :
        range === "1Y" ? 365 : 1000

      const [tickerRes, klinesRes] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`),
        fetchBinanceKlinesWithFallback(pair, binInterval, binLimit),
      ])
      if (!tickerRes.ok || !Array.isArray(klinesRes) || klinesRes.length === 0) {
        throw new Error("Binance fallback unavailable")
      }
      const ticker = await tickerRes.json()

      const points = klinesRes
        .map((k: any) => ({
          date: new Date(k[0]).toISOString(),
          price: Number.parseFloat(String(k[4] ?? "")),
          volume: Number.parseFloat(String(k[5] ?? "")),
          confidence: Number.parseFloat(String(k[4] ?? "")) * 0.95,
        }))
        .filter((p: any) => Number.isFinite(p.price))

      if (points.length === 0) throw new Error("No parsed Binance points")

      const first = points[0]
      const latest = points[points.length - 1]
      const rangeChange = first.price > 0 ? ((latest.price - first.price) / first.price) * 100 : 0

      setMarketStats((prev: any) => ({
        ...prev,
        price: prev?.price || Number.parseFloat(String(ticker.lastPrice ?? "")),
        change24h: prev?.change24h || Number.parseFloat(String(ticker.priceChangePercent ?? "")),
        rangeChange,
        volume: prev?.volume || Number.parseFloat(String(ticker.quoteVolume ?? "")),
      }))
      setChartData(points)
    } catch {
      // Keep empty state when Binance does not have data.
    } finally {
      setChartLoading(false)
    }
  }, [marketDataMap])

  return {
    marketDataMap,
    chartData,
    chartLoading,
    marketStats,
    setMarketStats,
    setChartData,
    fetchEnrichedMarketData,
    fetchChartData
  }
}
