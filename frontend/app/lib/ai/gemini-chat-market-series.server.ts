import { internalJsonFetch } from "~/lib/ai/gemini-internal-api"
import {
  estimateKlineLimit,
  fetchBinanceSpotKlines,
  type BinanceSimpleCandle,
} from "~/lib/server/binance-klines"

type Paginated<T> = {
  items: T[]
  total?: number
}

export type MarketCandleRow = {
  time: string
  close: number
  open: number
  high: number
  low: number
  volume: number
  resolution?: string
}

export type ResolvedMarketSeries = {
  closes: number[]
  labels: string[]
  resolutionLabel: string
  changePct: number | null
  sampleCount: number
  /** Where OHLC rows came from — Binance used when Tauron Timescale has no rows for this asset/window. */
  seriesSource: "database" | "binance"
}

function rowsToSeries(rows: MarketCandleRow[], resolutionFallback: string): Omit<ResolvedMarketSeries, "seriesSource"> {
  const closes = rows.map((r) => r.close)
  const labels = rows.map((r) =>
    new Date(r.time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" }),
  )
  const lastClose = closes[closes.length - 1]
  const firstClose = closes[0]
  const changePct =
    firstClose && lastClose && firstClose !== 0 ? ((lastClose - firstClose) / firstClose) * 100 : null
  const resolutionLabel = typeof rows[0]?.resolution === "string" ? rows[0].resolution : resolutionFallback
  return {
    closes,
    labels,
    resolutionLabel,
    changePct,
    sampleCount: closes.length,
  }
}

function trimCandlesToWindow(
  candles: BinanceSimpleCandle[],
  timeFrom: Date,
  timeTo: Date,
): BinanceSimpleCandle[] {
  const fromMs = timeFrom.getTime()
  const toMs = timeTo.getTime()
  const trimmed = candles.filter((c) => {
    const t = new Date(c.time).getTime()
    return t >= fromMs && t <= toMs
  })
  return trimmed.length >= 2 ? trimmed : candles
}

function binanceToMarketRows(candles: BinanceSimpleCandle[], resolution: string): MarketCandleRow[] {
  return candles.map((c) => ({
    time: c.time,
    close: c.close,
    open: c.close,
    high: c.close,
    low: c.close,
    volume: 0,
    resolution,
  }))
}

/**
 * Read OHLC from Tauron API with retries (resolution mismatch is common).
 */
export async function fetchInternalMarketSeries(
  authHeader: string,
  assetId: string,
  timeFrom: Date,
  timeTo: Date,
  preferredResolution: "1h" | "4h" | "1d",
): Promise<{ rows: MarketCandleRow[]; resolutionLabel: string } | null> {
  const strategies: Array<{ resolution?: string }> = [
    { resolution: preferredResolution },
    {},
    { resolution: "4h" },
    { resolution: "1d" },
    { resolution: "1h" },
  ]

  const tried = new Set<string>()
  for (const s of strategies) {
    const key = s.resolution ?? "__any__"
    if (tried.has(key)) continue
    tried.add(key)

    const qs = new URLSearchParams({
      asset_id: assetId,
      time_from: timeFrom.toISOString(),
      time_to: timeTo.toISOString(),
      page_size: "500",
      page: "1",
    })
    if (s.resolution !== undefined) qs.set("resolution", s.resolution)

    const md = await internalJsonFetch<Paginated<MarketCandleRow>>(`/market-data?${qs}`, {
      authHeader,
      method: "GET",
    })
    if (!md.ok || !md.data?.items?.length) continue

    const sorted = [...md.data.items].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    )
    const resolutionLabel =
      typeof sorted[0]?.resolution === "string" ? sorted[0].resolution : s.resolution ?? preferredResolution
    return { rows: sorted, resolutionLabel }
  }

  return null
}

/**
 * Prefer Tauron DB; if empty (still HTTP 200), fall back to Binance spot klines for liquid pairs.
 */
export async function resolveMarketSeriesForAssistant(args: {
  authHeader: string
  assetId: string
  symbol: string
  lookbackHours: number
  resolution: "1h" | "4h" | "1d"
}): Promise<ResolvedMarketSeries | { error: string }> {
  const { authHeader, assetId, symbol, lookbackHours, resolution } = args
  const timeTo = new Date()
  const timeFrom = new Date(timeTo.getTime() - lookbackHours * 60 * 60 * 1000)

  const internal = await fetchInternalMarketSeries(authHeader, assetId, timeFrom, timeTo, resolution)
  if (internal) {
    const s = rowsToSeries(internal.rows, internal.resolutionLabel)
    return { ...s, seriesSource: "database" }
  }

  const intervals: Array<"1h" | "4h" | "1d"> =
    resolution === "1h" ? ["1h", "4h", "1d"] : resolution === "4h" ? ["4h", "1h", "1d"] : ["1d", "4h", "1h"]

  for (const interval of intervals) {
    const limit = estimateKlineLimit(lookbackHours, interval)
    const candles = await fetchBinanceSpotKlines(symbol, interval, limit)
    const windowed = trimCandlesToWindow(candles, timeFrom, timeTo)
    if (windowed.length >= 2) {
      const rows = binanceToMarketRows(windowed, interval)
      const s = rowsToSeries(rows, interval)
      return { ...s, seriesSource: "binance" }
    }
  }

  return {
    error:
      "No candles in Tauron for this asset/time window, and Binance spot history was unavailable for this pair. " +
      "Try another symbol listed on Binance USDT spot, or ingest OHLC into Tauron.",
  }
}
