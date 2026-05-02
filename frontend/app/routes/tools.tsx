"use client"

import * as React from "react"
import {
  ArrowRightLeft,
  Activity,
  AlarmClock,
  Bell,
  Gauge,
  Newspaper,
  Trash2,
  ChevronDown,
  Check,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react"

import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { Switch } from "~/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  type AssetResponse,
  type CuratedNewsResponse,
  type MarketDataResponse,
  type PaginatedResponse,
  type PriceAlertResponse,
  type WatchlistEntryResponse,
} from "~/lib/api-client"
import { useLiveTickers } from "~/lib/live-price-stream"
import { cn } from "~/lib/utils"

import {
  type CurrencyCode,
  CURRENCY_LABELS,
  FALLBACK_USD_BASE_RATES,
  CURRENCIES,
  BINANCE_TICKER_URL,
  convertAmount,
  getUsdtPerCurrency
} from "~/lib/currency"

const BINANCE_24HR_TICKER_URL = "https://api.binance.com/api/v3/ticker/24hr"
const MAX_CONVERT_AMOUNT = 1_000_000_000
type SentimentRange = "24h" | "7d" | "30d"
const SENTIMENT_RANGES: SentimentRange[] = ["24h", "7d", "30d"]
const ALERT_MOVE_OPTIONS = [-15, -10, -5, -2, -1, 1, 2, 5, 10, 15] as const
type ToolSectionId = "currency" | "price-alerts" | "market-sentiment" | "watchlist-insights"
const TOOL_SECTIONS: Array<{ id: ToolSectionId; label: string }> = [
  { id: "currency", label: "Currency Converter" },
  { id: "price-alerts", label: "Price Alerts" },
  { id: "market-sentiment", label: "Market Sentiment" },
  { id: "watchlist-insights", label: "Watchlist Insights" },
]

type WatchlistInsightRow = {
  asset: AssetResponse
  tickerSymbol: string | null
  price: number | null
  changePct: number | null
  quoteVolume: number | null
  news?: CuratedNewsResponse
}

type MarketSentimentResult = {
  asset: AssetResponse
  range: SentimentRange
  score: number
  label: "Bullish" | "Neutral" | "Bearish"
  priceChangePct: number | null
  volumeChangePct: number | null
  volumeUsd: number | null
  avgNewsSentiment: number | null
  newsCount: number
  priceDataSource: "market-data" | "binance-live" | "none"
  explanation: string
}

type TickerFallback = {
  price: number
  changePct: number
  quoteVolume: number
}

function formatUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 4 : 8,
  }).format(value)
}

function formatTargetInput(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return ""
  return Number(value.toFixed(8)).toString()
}

const normalizeAlertTarget = (value: number) => Number(value.toFixed(8))

const isSameAlertTarget = (left: number, right: number) =>
  normalizeAlertTarget(left) === normalizeAlertTarget(right)

function formatCompactUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

function getTickerSymbol(symbol: string): string | null {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized || normalized === "USDT") return null
  return `${normalized}USDT`
}

async function fetchBinance24hTicker(symbol: string): Promise<TickerFallback | null> {
  try {
    const response = await fetch(`${BINANCE_24HR_TICKER_URL}?symbol=${symbol}`)
    if (!response.ok) return null
    const row = (await response.json()) as {
      lastPrice?: string
      priceChangePercent?: string
      quoteVolume?: string
    }
    const price = Number.parseFloat(row.lastPrice ?? "")
    const changePct = Number.parseFloat(row.priceChangePercent ?? "")
    const quoteVolume = Number.parseFloat(row.quoteVolume ?? "")
    if (!Number.isFinite(price) || !Number.isFinite(changePct)) return null
    return {
      price,
      changePct,
      quoteVolume: Number.isFinite(quoteVolume) ? quoteVolume : 0,
    }
  } catch {
    return null
  }
}

function getSentimentLabel(score: number | null | undefined): "Bullish" | "Neutral" | "Bearish" {
  if (score == null || !Number.isFinite(score)) return "Neutral"
  if (score > 0.15) return "Bullish"
  if (score < -0.15) return "Bearish"
  return "Neutral"
}

function getAttentionLabel(row: WatchlistInsightRow): string {
  const change = row.changePct ?? 0
  const newsCount = row.news ? "New curated news available" : "No curated news yet"
  if (change >= 5) return `${row.asset.symbol} is up ${formatPct(change)} in 24h`
  if (change <= -5) return `${row.asset.symbol} is down ${formatPct(change)} in 24h`
  if (row.quoteVolume != null && row.quoteVolume > 1_000_000_000) {
    return `${row.asset.symbol} has high 24h trading volume`
  }
  return newsCount
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function getScoreLabel(score: number): MarketSentimentResult["label"] {
  if (score >= 65) return "Bullish"
  if (score <= 40) return "Bearish"
  return "Neutral"
}

function getSentimentColorClass(label: MarketSentimentResult["label"]): string {
  if (label === "Bullish") return "text-emerald-500"
  if (label === "Bearish") return "text-red-500"
  return "text-yellow-500"
}

function getSignedValueColorClass(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "text-yellow-500"
  if (value > 0) return "text-emerald-500"
  if (value < 0) return "text-red-500"
  return "text-yellow-500"
}

function getNewsValueColorClass(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "text-yellow-500"
  if (value > 0.05) return "text-emerald-500"
  if (value < -0.05) return "text-red-500"
  return "text-yellow-500"
}

function getSentimentWindow(range: SentimentRange): { timeFrom: Date; resolution: string } {
  const now = new Date()
  const hoursByRange: Record<SentimentRange, number> = {
    "24h": 24,
    "7d": 7 * 24,
    "30d": 30 * 24,
  }
  const timeFrom = new Date(now.getTime() - hoursByRange[range] * 60 * 60 * 1000)
  return {
    timeFrom,
    resolution: range === "24h" ? "1h" : "1d",
  }
}

function average(values: number[]): number | null {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return null
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}

function calculateVolumeChangePct(rows: MarketDataResponse[]): number | null {
  if (rows.length < 4) return null
  const midpoint = Math.floor(rows.length / 2)
  const firstAverage = average(rows.slice(0, midpoint).map((row) => row.volume))
  const secondAverage = average(rows.slice(midpoint).map((row) => row.volume))
  if (firstAverage == null || secondAverage == null || firstAverage <= 0) return null
  return ((secondAverage - firstAverage) / firstAverage) * 100
}

function buildMarketSentimentResult(
  asset: AssetResponse,
  range: SentimentRange,
  marketRows: MarketDataResponse[],
  newsRows: CuratedNewsResponse[],
  tickerFallback?: TickerFallback | null
): MarketSentimentResult {
  const sortedMarketRows = [...marketRows].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  )
  const first = sortedMarketRows[0]
  const latest = sortedMarketRows[sortedMarketRows.length - 1]
  const marketDataPriceChangePct =
    first && latest && first.close > 0 ? ((latest.close - first.close) / first.close) * 100 : null
  const priceChangePct = marketDataPriceChangePct ?? tickerFallback?.changePct ?? null
  const priceDataSource =
    marketDataPriceChangePct != null
      ? "market-data"
      : tickerFallback
        ? "binance-live"
        : "none"
  const volumeChangePct = calculateVolumeChangePct(sortedMarketRows)
  const volumeUsd = tickerFallback?.quoteVolume ?? null
  const avgNewsSentiment = average(
    newsRows
      .map((row) => row.sentiment_score)
      .filter((score): score is number => score != null && Number.isFinite(score))
  )

  let score = 50
  const reasons: string[] = []
  const hasNewsSignal = avgNewsSentiment != null
  const priceWeight = hasNewsSignal ? 1 : 1.25

  if (priceChangePct != null) {
    if (priceChangePct >= 5) {
      score += 24 * priceWeight
      reasons.push(
        priceDataSource === "binance-live"
          ? "strong positive live price momentum"
          : "strong positive price momentum"
      )
    } else if (priceChangePct >= 3) {
      score += 18 * priceWeight
      reasons.push(
        priceDataSource === "binance-live"
          ? "clear positive live price movement"
          : "clear positive price movement"
      )
    } else if (priceChangePct >= 1) {
      score += 10 * priceWeight
      reasons.push(
        priceDataSource === "binance-live"
          ? "mild positive live price movement"
          : "mild positive price movement"
      )
    } else if (priceChangePct <= -5) {
      score -= 24 * priceWeight
      reasons.push(
        priceDataSource === "binance-live"
          ? "negative live price momentum"
          : "negative price momentum"
      )
    } else if (priceChangePct <= -3) {
      score -= 18 * priceWeight
      reasons.push(
        priceDataSource === "binance-live"
          ? "clear negative live price movement"
          : "clear negative price movement"
      )
    } else if (priceChangePct <= -1) {
      score -= 10 * priceWeight
      reasons.push(
        priceDataSource === "binance-live"
          ? "mild negative live price movement"
          : "mild negative price movement"
      )
    }
  }

  if (avgNewsSentiment != null) {
    if (avgNewsSentiment > 0.2) {
      score += 18
      reasons.push("positive curated news sentiment")
    } else if (avgNewsSentiment < -0.2) {
      score -= 18
      reasons.push("negative curated news sentiment")
    } else if (avgNewsSentiment > 0.05) {
      score += 9
      reasons.push("slightly positive news tone")
    } else if (avgNewsSentiment < -0.05) {
      score -= 9
      reasons.push("slightly negative news tone")
    }
  }

  if (volumeChangePct != null) {
    if (volumeChangePct > 20 && priceChangePct != null) {
      const volumeBoost = priceChangePct >= 0 ? 6 : -6
      score += volumeBoost
      reasons.push("rising trading volume")
    } else if (volumeChangePct < -20) {
      score -= 4
      reasons.push("cooling trading volume")
    }
  } else if (volumeUsd != null && volumeUsd > 100_000_000 && priceChangePct != null) {
    score += priceChangePct >= 0 ? 4 : -4
    reasons.push("high live trading volume")
  }

  const finalScore = clampScore(score)
  const label = getScoreLabel(finalScore)
  const explanation =
    reasons.length > 0
      ? `${asset.symbol} looks ${label.toLowerCase()} because of ${reasons.join(", ")}.`
      : `${asset.symbol} looks neutral because available market and news signals are limited.`

  return {
    asset,
    range,
    score: finalScore,
    label,
    priceChangePct,
    volumeChangePct,
    volumeUsd,
    avgNewsSentiment,
    newsCount: newsRows.length,
    priceDataSource,
    explanation,
  }
}


function buildUsdBaseRatesFromBinance(
  tickerBySymbol: Record<string, string>
): Record<string, number> {
  const next = { ...FALLBACK_USD_BASE_RATES }
  for (const currency of CURRENCIES) {
    const rawPrice = tickerBySymbol[`${currency}USDT`] || tickerBySymbol[`USDT${currency}`]
    const usdtPerCurrency = getUsdtPerCurrency(currency, Object.fromEntries(
      Object.entries(tickerBySymbol).map(([k, v]) => [k, parseFloat(v)])
    ))
    if (usdtPerCurrency == null || usdtPerCurrency <= 0) continue
    next[currency] = 1 / usdtPerCurrency
  }
  next.USD = 1
  return next
}

export default function ToolsPage() {
  const sectionRefs = React.useRef<Record<ToolSectionId, HTMLDivElement | null>>({
    currency: null,
    "price-alerts": null,
    "market-sentiment": null,
    "watchlist-insights": null,
  })
  const [amount, setAmount] = React.useState("1")
  const [fromCurrency, setFromCurrency] = React.useState<CurrencyCode>("USD")
  const [toCurrency, setToCurrency] = React.useState<CurrencyCode>("TRY")
  const [usdBaseRates, setUsdBaseRates] = React.useState<Record<CurrencyCode, number>>(
    FALLBACK_USD_BASE_RATES
  )
  const [ratesStatus, setRatesStatus] = React.useState<"loading" | "live" | "fallback">("loading")
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<Date | null>(null)
  const [amountLimitError, setAmountLimitError] = React.useState<string | null>(null)
  const [watchlist, setWatchlist] = React.useState<WatchlistEntryResponse[]>([])
  const [watchlistLoading, setWatchlistLoading] = React.useState(true)
  const [watchlistError, setWatchlistError] = React.useState<string | null>(null)
  const [curatedNewsByAssetId, setCuratedNewsByAssetId] = React.useState<
    Record<string, CuratedNewsResponse>
  >({})
  const [assets, setAssets] = React.useState<AssetResponse[]>([])
  const [assetsLoading, setAssetsLoading] = React.useState(true)
  const [selectedSentimentAssetId, setSelectedSentimentAssetId] = React.useState("")
  const [sentimentRange, setSentimentRange] = React.useState<SentimentRange>("7d")
  const [sentimentLoading, setSentimentLoading] = React.useState(false)
  const [sentimentError, setSentimentError] = React.useState<string | null>(null)
  const [sentimentResult, setSentimentResult] = React.useState<MarketSentimentResult | null>(null)
  const [priceAlerts, setPriceAlerts] = React.useState<PriceAlertResponse[]>([])
  const [priceAlertsLoading, setPriceAlertsLoading] = React.useState(true)
  const [priceAlertsError, setPriceAlertsError] = React.useState<string | null>(null)
  const [selectedAlertAssetId, setSelectedAlertAssetId] = React.useState("")
  const [alertMove, setAlertMove] = React.useState("1")
  const [alertTargetPrice, setAlertTargetPrice] = React.useState("")
  const [alertTargetEdited, setAlertTargetEdited] = React.useState(false)
  const [selectedAlertFallbackTicker, setSelectedAlertFallbackTicker] = React.useState<TickerFallback | null>(null)
  const [alertSaving, setAlertSaving] = React.useState(false)
  const [priceAlertsOpen, setPriceAlertsOpen] = React.useState(false)
  const [priceAlertDeleteMode, setPriceAlertDeleteMode] = React.useState(false)
  const [selectedPriceAlertIds, setSelectedPriceAlertIds] = React.useState<Set<string>>(() => new Set())
  const selectedSentimentAsset = assets.find((asset) => asset.id === selectedSentimentAssetId)
  const selectedAlertAsset = assets.find((asset) => asset.id === selectedAlertAssetId)
  const alertAssets = React.useMemo(
    () => assets.filter((asset) => asset.symbol.toUpperCase() !== "USDT"),
    [assets]
  )
  const selectedAlertTickerSymbol = selectedAlertAsset ? getTickerSymbol(selectedAlertAsset.symbol) : null

  const watchlistTickerSymbols = React.useMemo(
    () => {
      const selectedTickerSymbol = selectedSentimentAsset
        ? getTickerSymbol(selectedSentimentAsset.symbol)
        : null
      return watchlist
        .map((entry) => getTickerSymbol(entry.asset.symbol))
        .concat(selectedTickerSymbol, selectedAlertTickerSymbol)
        .filter((symbol): symbol is string => Boolean(symbol))
    },
    [selectedAlertTickerSymbol, selectedSentimentAsset, watchlist]
  )
  const liveTickers = useLiveTickers(watchlistTickerSymbols)
  const selectedAlertTicker = selectedAlertTickerSymbol ? liveTickers[selectedAlertTickerSymbol] : null
  const selectedAlertCurrentPrice = selectedAlertTicker?.price ?? selectedAlertFallbackTicker?.price ?? null
  const selectedAlertMove = Number.parseFloat(alertMove)
  const selectedPriceAlertCount = selectedPriceAlertIds.size
  const allPriceAlertsSelected = priceAlerts.length > 0 && selectedPriceAlertCount === priceAlerts.length
  const sortedPriceAlerts = React.useMemo(
    () =>
      [...priceAlerts].sort((left, right) => {
        if (left.is_active !== right.is_active) return left.is_active ? -1 : 1
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      }),
    [priceAlerts]
  )
  const calculatedAlertTargetPrice =
    selectedAlertCurrentPrice != null && Number.isFinite(selectedAlertMove)
      ? selectedAlertCurrentPrice *
      (1 + selectedAlertMove / 100)
      : null
  const parsedAlertTargetPrice = Number.parseFloat(alertTargetPrice)
  const selectedAlertTargetPrice =
    Number.isFinite(parsedAlertTargetPrice) && parsedAlertTargetPrice > 0
      ? parsedAlertTargetPrice
      : null

  const numericAmount = Number.parseFloat(amount)
  const converted = convertAmount(numericAmount, fromCurrency, toCurrency, usdBaseRates)

  const insightRows = React.useMemo<WatchlistInsightRow[]>(() => {
    return watchlist.map((entry) => {
      const tickerSymbol = getTickerSymbol(entry.asset.symbol)
      const ticker = tickerSymbol ? liveTickers[tickerSymbol] : null
      const isStableUsdt = entry.asset.symbol.toUpperCase() === "USDT"
      return {
        asset: entry.asset,
        tickerSymbol,
        price: isStableUsdt ? 1 : ticker?.price ?? null,
        changePct: isStableUsdt ? 0 : ticker?.changePct ?? null,
        quoteVolume: ticker?.quoteVolume ?? null,
        news: curatedNewsByAssetId[entry.asset.id],
      }
    })
  }, [curatedNewsByAssetId, liveTickers, watchlist])

  const sortedInsightRows = React.useMemo(() => {
    return [...insightRows].sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
  }, [insightRows])

  const topMover = sortedInsightRows[0]
  const strongest = insightRows
    .filter((row) => row.changePct != null)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0]
  const newsCount = insightRows.filter((row) => row.news).length

  const formattedResult = Number.isFinite(converted)
    ? converted.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
    : "0.00"

  const switchCurrencies = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  const handleAmountChange = (raw: string) => {
    if (raw.trim() === "") {
      setAmount(raw)
      setAmountLimitError(null)
      return
    }
    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed) && parsed > MAX_CONVERT_AMOUNT) {
      setAmount(String(MAX_CONVERT_AMOUNT))
      setAmountLimitError(`Maximum amount is ${MAX_CONVERT_AMOUNT.toLocaleString("en-US")}.`)
      return
    }
    setAmount(raw)
    setAmountLimitError(null)
  }

  const handleAlertMoveChange = (value: string) => {
    setAlertMove(value)
    setAlertTargetEdited(false)
  }

  const handleAlertTargetChange = (value: string) => {
    setAlertTargetEdited(true)
    setAlertTargetPrice(value.replace(",", "."))
  }

  const scrollToToolSection = (sectionId: ToolSectionId) => {
    sectionRefs.current[sectionId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  const handleAnalyzeSentiment = async () => {
    if (!selectedSentimentAsset) {
      setSentimentError("Select an asset to analyze.")
      return
    }

    setSentimentLoading(true)
    setSentimentError(null)
    try {
      const { timeFrom, resolution } = getSentimentWindow(sentimentRange)
      const now = new Date()
      const marketData = await apiGet<PaginatedResponse<MarketDataResponse>>("/market-data", {
        asset_id: selectedSentimentAsset.id,
        time_from: timeFrom.toISOString(),
        time_to: now.toISOString(),
        resolution,
        page_size: 200,
      })

      let curatedNews: CuratedNewsResponse[] = []
      try {
        const news = await apiGet<PaginatedResponse<CuratedNewsResponse>>("/curated-news", {
          asset_id: selectedSentimentAsset.id,
          page_size: 10,
        })
        curatedNews = news.items
      } catch {
        curatedNews = []
      }

      const selectedTickerSymbol = getTickerSymbol(selectedSentimentAsset.symbol)
      const liveTicker = selectedTickerSymbol ? liveTickers[selectedTickerSymbol] : null
      const tickerFallback =
        liveTicker ?? (selectedTickerSymbol ? await fetchBinance24hTicker(selectedTickerSymbol) : null)

      setSentimentResult(
        buildMarketSentimentResult(
          selectedSentimentAsset,
          sentimentRange,
          marketData.items,
          curatedNews,
          tickerFallback
        )
      )
    } catch {
      setSentimentResult(null)
      setSentimentError("Could not analyze market sentiment for this asset.")
    } finally {
      setSentimentLoading(false)
    }
  }

  const refreshPriceAlerts = React.useCallback(async () => {
    setPriceAlertsLoading(true)
    setPriceAlertsError(null)
    try {
      const alerts = await apiGet<PriceAlertResponse[]>("/users/me/price-alerts")
      setPriceAlerts(alerts)
    } catch {
      setPriceAlerts([])
      setPriceAlertsError("Could not load your price alerts.")
    } finally {
      setPriceAlertsLoading(false)
    }
  }, [])

  const handleCreatePriceAlert = async () => {
    if (!selectedAlertAsset) {
      setPriceAlertsError("Select an asset before creating an alert.")
      return
    }
    const move = Number.parseFloat(alertMove)
    if (!Number.isFinite(move) || move === 0) {
      setPriceAlertsError("Select a valid price move.")
      return
    }
    if (selectedAlertTargetPrice == null || selectedAlertTargetPrice <= 0) {
      setPriceAlertsError("Enter a valid alert target above 0.")
      return
    }
    const tickerSymbol = getTickerSymbol(selectedAlertAsset.symbol)
    if (!tickerSymbol) {
      setPriceAlertsError("This asset is not supported for Binance price alerts.")
      return
    }

    setAlertSaving(true)
    setPriceAlertsError(null)
    try {
      const tickerFallback = selectedAlertTicker ?? await fetchBinance24hTicker(tickerSymbol)
      const currentPrice = tickerFallback?.price
      if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) {
        setPriceAlertsError("Could not get the current Binance price for this asset.")
        return
      }
      const targetPrice = selectedAlertTargetPrice
      if (targetPrice <= 0) {
        setPriceAlertsError("Alert target must be greater than 0.")
        return
      }
      const duplicateAlert = priceAlerts.find(
        (alert) =>
          (alert.asset_id === selectedAlertAsset.id ||
            alert.symbol.replace(/USDT$/, "") === selectedAlertAsset.symbol.toUpperCase()) &&
          isSameAlertTarget(alert.target_price, targetPrice)
      )
      if (duplicateAlert) {
        setPriceAlertsError("This asset already has a price alert with the same target price.")
        return
      }
      await apiPost<PriceAlertResponse>("/users/me/price-alerts", {
        asset_id: selectedAlertAsset.id,
        condition: targetPrice >= currentPrice ? "above" : "below",
        target_price: targetPrice,
        reference_price: currentPrice,
        percentage_change: alertTargetEdited ? null : move,
      })
      await refreshPriceAlerts()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create this price alert."
      setPriceAlertsError(message)
    } finally {
      setAlertSaving(false)
    }
  }

  const togglePriceAlertSelection = (alertId: string, checked: boolean) => {
    setSelectedPriceAlertIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(alertId)
      } else {
        next.delete(alertId)
      }
      return next
    })
  }

  const toggleAllPriceAlerts = (checked: boolean) => {
    setSelectedPriceAlertIds(checked ? new Set(priceAlerts.map((alert) => alert.id)) : new Set())
  }

  const togglePriceAlertActive = async (alert: PriceAlertResponse, checked: boolean) => {
    setPriceAlertsError(null)
    setPriceAlerts((current) =>
      current.map((item) =>
        item.id === alert.id
          ? {
            ...item,
            is_active: checked,
            triggered_at: checked ? null : item.triggered_at,
          }
          : item
      )
    )
    try {
      await apiPatch<PriceAlertResponse>(`/users/me/price-alerts/${alert.id}`, {
        is_active: checked,
      })
      await refreshPriceAlerts()
    } catch {
      setPriceAlertsError("Could not update this price alert.")
      await refreshPriceAlerts()
    }
  }

  const handleDeleteSelectedPriceAlerts = async () => {
    if (selectedPriceAlertIds.size === 0) return
    try {
      await Promise.all(
        Array.from(selectedPriceAlertIds).map((alertId) =>
          apiDelete(`/users/me/price-alerts/${alertId}`)
        )
      )
      setSelectedPriceAlertIds(new Set())
      setPriceAlertDeleteMode(false)
      await refreshPriceAlerts()
    } catch {
      setPriceAlertsError("Could not delete selected price alerts.")
    }
  }

  React.useEffect(() => {
    let cancelled = false

    const fetchAssets = async () => {
      setAssetsLoading(true)
      try {
        const data = await apiGet<PaginatedResponse<AssetResponse>>("/assets", { page_size: 100 })
        if (cancelled) return
        setAssets(data.items)
        const defaultAsset =
          data.items.find((asset) => asset.symbol.toUpperCase() === "BTC") ??
          data.items.find((asset) => asset.symbol.toUpperCase() !== "USDT") ??
          data.items[0]
        if (defaultAsset) {
          setSelectedSentimentAssetId((current) => current || defaultAsset.id)
          setSelectedAlertAssetId((current) => current || defaultAsset.id)
        }
      } catch {
        if (!cancelled) setAssets([])
      } finally {
        if (!cancelled) setAssetsLoading(false)
      }
    }

    void fetchAssets()

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    void refreshPriceAlerts()
  }, [refreshPriceAlerts])

  React.useEffect(() => {
    let cancelled = false
    setSelectedAlertFallbackTicker(null)
    if (!selectedAlertTickerSymbol) return
    void fetchBinance24hTicker(selectedAlertTickerSymbol).then((ticker) => {
      if (!cancelled) setSelectedAlertFallbackTicker(ticker)
    })
    return () => {
      cancelled = true
    }
  }, [selectedAlertTickerSymbol])

  React.useEffect(() => {
    if (!alertTargetEdited) {
      setAlertTargetPrice(formatTargetInput(calculatedAlertTargetPrice))
    }
  }, [alertTargetEdited, calculatedAlertTargetPrice])

  React.useEffect(() => {
    setSelectedPriceAlertIds((current) => {
      const validIds = new Set(priceAlerts.map((alert) => alert.id))
      const next = new Set(Array.from(current).filter((alertId) => validIds.has(alertId)))
      return next.size === current.size ? current : next
    })
  }, [priceAlerts])

  React.useEffect(() => {
    if (!priceAlertDeleteMode) {
      setSelectedPriceAlertIds(new Set())
    }
  }, [priceAlertDeleteMode])

  React.useEffect(() => {
    let cancelled = false

    const refreshRates = async () => {
      try {
        const response = await fetch(BINANCE_TICKER_URL)
        if (!response.ok) throw new Error("Failed to fetch Binance tickers")

        const rows = (await response.json()) as Array<{ symbol?: string; price?: string }>
        const tickerBySymbol: Record<string, string> = {}
        for (const row of rows) {
          if (!row.symbol || !row.price) continue
          tickerBySymbol[row.symbol.toUpperCase()] = row.price
        }

        const liveRates = buildUsdBaseRatesFromBinance(tickerBySymbol)
        if (cancelled) return
        setUsdBaseRates(liveRates)
        setRatesStatus("live")
        setLastUpdatedAt(new Date())
      } catch {
        if (cancelled) return
        setUsdBaseRates(FALLBACK_USD_BASE_RATES)
        setRatesStatus("fallback")
      }
    }

    void refreshRates()
    const intervalId = window.setInterval(() => {
      void refreshRates()
    }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false

    const fetchWatchlistInsights = async () => {
      setWatchlistLoading(true)
      setWatchlistError(null)
      try {
        const entries = await apiGet<WatchlistEntryResponse[]>("/users/me/watchlist")
        if (cancelled) return
        setWatchlist(entries)

        const newsPairs = await Promise.all(
          entries.slice(0, 8).map(async (entry) => {
            try {
              const news = await apiGet<PaginatedResponse<CuratedNewsResponse>>("/curated-news", {
                asset_id: entry.asset.id,
                page_size: 1,
              })
              return [entry.asset.id, news.items[0]] as const
            } catch {
              return [entry.asset.id, undefined] as const
            }
          })
        )
        if (cancelled) return
        const nextNews: Record<string, CuratedNewsResponse> = {}
        for (const [assetId, news] of newsPairs) {
          if (news) nextNews[assetId] = news
        }
        setCuratedNewsByAssetId(nextNews)
      } catch {
        if (cancelled) return
        setWatchlist([])
        setWatchlistError("Could not load your watchlist insights.")
      } finally {
        if (!cancelled) setWatchlistLoading(false)
      }
    }

    void fetchWatchlistInsights()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <MarketMarqueeBanner />
      <SidebarInset
        style={{
          paddingTop: "var(--market-banner-offset, 0px)",
        }}
      >
        <header className="sticky top-[var(--market-banner-offset,0px)] z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="font-medium">Tools</span>
          </div>
          <NotificationInbox />
        </header>
        <div className="flex min-h-[calc(100svh-3.5rem)] flex-1 overflow-auto p-4">
          <div className="grid w-full gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="h-fit self-start">
              <div className="space-y-1 lg:fixed lg:top-[calc(var(--market-banner-offset,0px)+5rem)] lg:z-10 lg:w-[220px]">
                {TOOL_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:outline-none"
                    onClick={() => scrollToToolSection(section.id)}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </aside>
            <section className="space-y-5">
              <div
                ref={(node) => {
                  sectionRefs.current.currency = node
                }}
                className="scroll-mt-20 rounded-xl border"
              >
                <div className="border-b px-5 py-4">
                  <div className="text-xl font-semibold">Currency Converter</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Convert from selected currency to another using dropdowns.
                  </p>
                </div>
                <div className="space-y-4 px-5 py-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_1fr] md:items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="amount">
                        Amount
                      </label>
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        max={String(MAX_CONVERT_AMOUNT)}
                        step="any"
                        value={amount}
                        onChange={(event) => handleAmountChange(event.target.value)}
                        placeholder="Enter amount"
                      />
                      {amountLimitError ? (
                        <p className="text-xs font-medium text-destructive">{amountLimitError}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Max: {MAX_CONVERT_AMOUNT.toLocaleString("en-US")}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">From</label>
                      <Select
                        value={fromCurrency}
                        onValueChange={(value) => setFromCurrency(value as CurrencyCode)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select source currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency} - {CURRENCY_LABELS[currency]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-center md:pb-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={switchCurrencies}
                        aria-label="Switch currencies"
                      >
                        <ArrowRightLeft className="size-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">To</label>
                      <Select
                        value={toCurrency}
                        onValueChange={(value) => setToCurrency(value as CurrencyCode)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select target currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency} - {CURRENCY_LABELS[currency]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Converted Amount</p>
                    <p className="mt-1 text-3xl font-semibold">
                      {formattedResult} {toCurrency}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {ratesStatus === "live"
                        ? `Rate basis: live Binance ticker data${lastUpdatedAt ? ` (updated ${lastUpdatedAt.toLocaleTimeString("en-US")})` : ""}.`
                        : ratesStatus === "loading"
                          ? "Rate basis: loading Binance data..."
                          : "Rate basis: Binance unavailable, using fallback rates."}
                    </p>
                  </div>
                </div>
              </div>

              <div
                ref={(node) => {
                  sectionRefs.current["price-alerts"] = node
                }}
                className="scroll-mt-20 rounded-xl border"
              >
                <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2 text-xl font-semibold">
                      <AlarmClock className="size-5 text-primary" />
                      Price Alerts
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create price alarms with inbox notifications when Binance hits your threshold. Use a preset move, then edit the exact target in the card.
                    </p>
                  </div>
                </div>
                <div className="space-y-5 px-5 py-4">
                  <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Asset</label>
                      <Select
                        value={selectedAlertAssetId}
                        onValueChange={(value) => {
                          setSelectedAlertAssetId(value)
                          setAlertTargetEdited(false)
                        }}
                        disabled={assetsLoading || alertAssets.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={assetsLoading ? "Loading assets..." : "Select asset"} />
                        </SelectTrigger>
                        <SelectContent>
                          {alertAssets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.symbol} - {asset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Preset move</label>
                      <Select value={alertMove} onValueChange={handleAlertMoveChange}>
                        <SelectTrigger className="w-full">
                          {alertTargetEdited ? (
                            <span className="truncate text-left text-sm font-normal text-muted-foreground">
                              Pick a % change to recalculate target, or keep your typed price
                            </span>
                          ) : (
                            <SelectValue placeholder="Select move" />
                          )}
                        </SelectTrigger>
                        <SelectContent className="max-h-56 min-w-[var(--radix-select-trigger-width)]">
                          {ALERT_MOVE_OPTIONS.map((move) => (
                            <SelectItem key={move} value={String(move)}>
                              {move > 0 ? "+" : ""}{move}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      onClick={handleCreatePriceAlert}
                      disabled={
                        alertSaving ||
                        assetsLoading ||
                        selectedAlertCurrentPrice == null ||
                        selectedAlertCurrentPrice <= 0 ||
                        selectedAlertTargetPrice == null
                      }
                    >
                      {alertSaving ? "Creating..." : "Create alert"}
                    </Button>
                  </div>

                  <div className="grid gap-3 rounded-xl border bg-card/50 p-3 sm:grid-cols-2 sm:items-stretch">
                    <div className="flex h-full min-h-0 flex-col gap-2 rounded-lg bg-muted/40 px-4 py-3">
                      <div className="shrink-0 text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-muted-foreground">
                        Current price
                      </div>
                      <div className="flex min-h-[1.75rem] flex-1 items-center text-lg font-semibold tabular-nums leading-none text-foreground">
                        {formatUsd(selectedAlertCurrentPrice)}
                      </div>
                    </div>
                    <div className="flex h-full min-h-0 flex-col gap-2 rounded-lg bg-muted/40 px-4 py-3">
                      <label
                        className="block shrink-0 cursor-text text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-muted-foreground"
                        htmlFor="tools-alert-target"
                      >
                        Alert target
                      </label>
                      <div className="flex min-h-[1.75rem] flex-1 items-center">
                        <Input
                          id="tools-alert-target"
                          type="text"
                          inputMode="decimal"
                          value={alertTargetPrice}
                          onChange={(event) => handleAlertTargetChange(event.target.value)}
                          placeholder={
                            selectedAlertCurrentPrice == null ? "Wait for live price" : "Edit target price"
                          }
                          className={cn(
                            "h-auto min-h-0 w-full rounded-none border-0 bg-transparent px-0 py-0 shadow-none outline-none",
                            "text-lg font-semibold tabular-nums leading-none text-foreground md:text-lg",
                            "placeholder:text-muted-foreground dark:bg-transparent",
                            "focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    After you edit the target by hand, use Preset move again only if you want the price recalculated from a percentage.
                  </p>

                  {priceAlertsError ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {priceAlertsError}
                    </div>
                  ) : null}

                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <div className="text-sm font-medium">Your alerts</div>
                      <div className="flex items-center gap-2">
                        {priceAlertDeleteMode ? (
                          <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-2 py-1">
                            <span className="px-2 text-xs font-medium text-muted-foreground">
                              {selectedPriceAlertCount} selected
                            </span>
                            <button
                              type="button"
                              className="rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                              onClick={() => toggleAllPriceAlerts(!allPriceAlertsSelected)}
                            >
                              {allPriceAlertsSelected ? "Clear all" : "Select all"}
                            </button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-7 rounded-full px-3 text-xs"
                              onClick={() => void handleDeleteSelectedPriceAlerts()}
                              disabled={selectedPriceAlertCount === 0}
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </Button>
                          </div>
                        ) : null}
                        <Button
                          type="button"
                          variant={priceAlertDeleteMode ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setPriceAlertDeleteMode((enabled) => !enabled)}
                          disabled={priceAlerts.length === 0}
                        >
                          {priceAlertDeleteMode ? "Cancel" : "Manage"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setPriceAlertsOpen((open) => !open)}
                          aria-label={priceAlertsOpen ? "Collapse alerts list" : "Expand alerts list"}
                          aria-expanded={priceAlertsOpen}
                        >
                          <ChevronDown
                            className={`size-4 transition-transform ${priceAlertsOpen ? "rotate-180" : ""}`}
                          />
                        </Button>
                      </div>
                    </div>
                    {priceAlertsOpen ? (
                      priceAlertsLoading ? (
                        <div className="space-y-3 p-4">
                          <Skeleton className="h-14 w-full" />
                          <Skeleton className="h-14 w-full" />
                        </div>
                      ) : priceAlerts.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No price alerts yet. Create one above to start watching live prices.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {sortedPriceAlerts.map((alert) => (
                            <div key={alert.id} className="flex items-center justify-between gap-4 px-4 py-3">
                              <div className="flex min-w-0 items-start gap-3">
                                {priceAlertDeleteMode ? (
                                  <button
                                    type="button"
                                    className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-colors ${selectedPriceAlertIds.has(alert.id)
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border text-transparent hover:border-primary"
                                      }`}
                                    onClick={() =>
                                      togglePriceAlertSelection(alert.id, !selectedPriceAlertIds.has(alert.id))
                                    }
                                    aria-label={`Select ${alert.symbol} alert for deletion`}
                                    aria-pressed={selectedPriceAlertIds.has(alert.id)}
                                  >
                                    {selectedPriceAlertIds.has(alert.id) ? <Check className="size-3" /> : null}
                                  </button>
                                ) : null}
                                <div className="min-w-0">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <span>{alert.symbol}</span>
                                  <span
                                    className={
                                      alert.is_active
                                        ? "rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600"
                                        : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                    }
                                  >
                                    {alert.is_active ? "Active" : "Off"}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Notify when price is {alert.condition} {formatUsd(alert.target_price)}
                                  {alert.triggered_at
                                    ? `, triggered ${new Date(alert.triggered_at).toLocaleString("en-US")}`
                                    : ""}
                                </p>
                                {alert.percentage_change != null && alert.reference_price != null ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Created from {alert.percentage_change > 0 ? "+" : ""}{alert.percentage_change}%
                                    at {formatUsd(alert.reference_price)}.
                                  </p>
                                ) : null}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {alert.is_active ? "On" : "Off"}
                                </span>
                                <Switch
                                  checked={alert.is_active}
                                  onCheckedChange={(checked) => void togglePriceAlertActive(alert, checked)}
                                  aria-label={`${alert.is_active ? "Deactivate" : "Activate"} ${alert.symbol} alert`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                ref={(node) => {
                  sectionRefs.current["market-sentiment"] = node
                }}
                className="scroll-mt-20 rounded-xl border"
              >
                <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2 text-xl font-semibold">
                      <Gauge className="size-5 text-primary" />
                      Market Sentiment Tool
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Analyze price momentum and curated news tone for a selected asset.
                    </p>
                  </div>
                  {sentimentResult ? (
                    <div className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                      {sentimentResult.range}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Asset</label>
                      <Select
                        value={selectedSentimentAssetId}
                        onValueChange={setSelectedSentimentAssetId}
                        disabled={assetsLoading || sentimentLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={assetsLoading ? "Loading assets..." : "Select asset"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.symbol} - {asset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Range</label>
                      <Select
                        value={sentimentRange}
                        onValueChange={(value) => setSentimentRange(value as SentimentRange)}
                        disabled={sentimentLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          {SENTIMENT_RANGES.map((range) => (
                            <SelectItem key={range} value={range}>
                              {range}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      onClick={handleAnalyzeSentiment}
                      disabled={assetsLoading || sentimentLoading || !selectedSentimentAssetId}
                    >
                      {sentimentLoading ? "Analyzing..." : "Analyze"}
                    </Button>
                  </div>

                  {sentimentLoading ? (
                    <div className="grid gap-3 md:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="rounded-lg border bg-muted/30 p-4">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="mt-3 h-7 w-20" />
                          <Skeleton className="mt-2 h-3 w-32" />
                        </div>
                      ))}
                    </div>
                  ) : sentimentError ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      {sentimentError}
                    </div>
                  ) : sentimentResult ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-sm text-muted-foreground">Overall sentiment</div>
                          <div
                            className={`mt-2 text-2xl font-semibold ${getSentimentColorClass(
                              sentimentResult.label
                            )}`}
                          >
                            {sentimentResult.label}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Score {sentimentResult.score}/100
                          </p>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="size-4" />
                            Price signal
                          </div>
                          <div
                            className={`mt-2 text-2xl font-semibold ${getSignedValueColorClass(
                              sentimentResult.priceChangePct
                            )}`}
                          >
                            {formatPct(sentimentResult.priceChangePct)}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {sentimentResult.priceDataSource === "market-data"
                              ? `Close-to-close over ${sentimentResult.range}`
                              : sentimentResult.priceDataSource === "binance-live"
                                ? "Live Binance 24h fallback"
                                : "No price data available"}
                          </p>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Newspaper className="size-4" />
                            News signal
                          </div>
                          <div
                            className={`mt-2 text-2xl font-semibold ${getNewsValueColorClass(
                              sentimentResult.avgNewsSentiment
                            )}`}
                          >
                            {sentimentResult.avgNewsSentiment == null
                              ? "No news"
                              : sentimentResult.avgNewsSentiment.toFixed(2)}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {sentimentResult.newsCount} curated news items
                          </p>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Activity className="size-4" />
                            Volume signal
                          </div>
                          <div
                            className={`mt-2 text-2xl font-semibold ${sentimentResult.volumeChangePct != null
                                ? getSignedValueColorClass(sentimentResult.volumeChangePct)
                                : "text-yellow-500"
                              }`}
                          >
                            {sentimentResult.volumeChangePct != null
                              ? formatPct(sentimentResult.volumeChangePct)
                              : formatCompactUsd(sentimentResult.volumeUsd)}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {sentimentResult.volumeChangePct != null
                              ? "Recent volume vs earlier window"
                              : sentimentResult.volumeUsd != null
                                ? "Live Binance 24h quote volume"
                                : "No volume data available"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted/50 p-4">
                        <div className="text-sm font-medium">
                          {sentimentResult.asset.symbol} sentiment summary
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {sentimentResult.explanation}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border bg-muted/40 p-5">
                      <div className="font-medium">Select an asset and run analysis</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The tool combines market data and curated news into a simple sentiment score.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={(node) => {
                  sectionRefs.current["watchlist-insights"] = node
                }}
                className="scroll-mt-20 rounded-xl border"
              >
                <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2 text-xl font-semibold">
                      <WalletCards className="size-5 text-primary" />
                      Watchlist Insights
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Live movement, volume, and curated news signals from your watchlist.
                    </p>
                  </div>
                  <div className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                    {watchlistLoading ? "Loading" : `${watchlist.length} assets`}
                  </div>
                </div>

                <div className="space-y-4 px-5 py-4">
                  {watchlistLoading ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div key={index} className="rounded-lg border bg-muted/30 p-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="mt-3 h-7 w-28" />
                            <Skeleton className="mt-2 h-3 w-36" />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <Skeleton key={index} className="h-20 w-full rounded-lg" />
                        ))}
                      </div>
                    </>
                  ) : watchlistError ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      {watchlistError}
                    </div>
                  ) : watchlist.length === 0 ? (
                    <div className="rounded-lg border bg-muted/40 p-5">
                      <div className="font-medium">Your watchlist is empty</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Add assets to your watchlist to see live attention cards here.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Bell className="size-4" />
                            Needs attention
                          </div>
                          <div className="mt-2 text-lg font-semibold">
                            {topMover ? topMover.asset.symbol : "—"}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {topMover ? getAttentionLabel(topMover) : "Waiting for live data."}
                          </p>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="size-4 text-emerald-500" />
                            Strongest 24h
                          </div>
                          <div className="mt-2 text-lg font-semibold">
                            {strongest ? strongest.asset.symbol : "—"}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {strongest
                              ? `${formatPct(strongest.changePct)} at ${formatUsd(strongest.price)}`
                              : "No live change yet."}
                          </p>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Newspaper className="size-4" />
                            Curated news
                          </div>
                          <div className="mt-2 text-lg font-semibold">{newsCount}</div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Latest summaries matched to watchlist assets.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {sortedInsightRows.slice(0, 6).map((row) => {
                          const sentiment = getSentimentLabel(row.news?.sentiment_score)
                          const isPositive = (row.changePct ?? 0) >= 0
                          return (
                            <div
                              key={row.asset.id}
                              className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_auto] md:items-center"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold">{row.asset.symbol}</span>
                                  <span className="text-sm text-muted-foreground">{row.asset.name}</span>
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                    {sentiment}
                                  </span>
                                </div>
                                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                  {row.news?.summary ?? getAttentionLabel(row)}
                                </p>
                              </div>

                              <div className="flex items-center justify-between gap-6 md:justify-end">
                                <div className="text-right">
                                  <div className="text-sm font-medium">{formatUsd(row.price)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Vol {formatCompactUsd(row.quoteVolume)}
                                  </div>
                                </div>
                                <div
                                  className={`flex min-w-20 items-center justify-end gap-1 text-sm font-semibold ${isPositive ? "text-emerald-500" : "text-red-500"
                                    }`}
                                >
                                  {isPositive ? (
                                    <TrendingUp className="size-4" />
                                  ) : (
                                    <TrendingDown className="size-4" />
                                  )}
                                  {formatPct(row.changePct)}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Live price data comes from Binance ticker streams. Curated news is pulled from
                        Tauron&apos;s backend when available.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
