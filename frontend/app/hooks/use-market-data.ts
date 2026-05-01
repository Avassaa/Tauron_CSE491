import * as React from "react"
import { apiGet, type AssetResponse, type PaginatedResponse, type MarketDataResponse } from "~/lib/api-client"
import { type MarketData } from "~/components/assets"

type TimeRange = "24H" | "7D" | "1M" | "3M" | "1Y" | "MAX"
let coingeckoCooldownUntil = 0

export function useMarketData() {
  const [marketDataMap, setMarketDataMap] = React.useState<Record<string, MarketData>>({})
  const [chartData, setChartData] = React.useState<any[]>([])
  const [chartLoading, setChartLoading] = React.useState(false)
  const [marketStats, setMarketStats] = React.useState<any>(null)

  const fetchEnrichedMarketData = React.useCallback(async (assetsToEnrich: AssetResponse[]) => {
    if (Date.now() < coingeckoCooldownUntil) return

    const ids = assetsToEnrich
      .map((a) => a.coingecko_id)
      .filter(Boolean)
      .join(",")

    if (!ids) return

    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d,14d,30d,1y`
      )
      if (!res.ok) {
        if (res.status === 429) coingeckoCooldownUntil = Date.now() + 60_000
        throw new Error(`CoinGecko HTTP ${res.status}`)
      }
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
      coingeckoCooldownUntil = Math.max(coingeckoCooldownUntil, Date.now() + 30_000)
      console.error("Failed to fetch enriched market data:", err)
    }
  }, [])

  const fetchChartData = React.useCallback(async (asset: AssetResponse, range: TimeRange) => {
    setChartLoading(true)
    const assetId = asset.id
    const assetSymbol = asset.symbol
    const cgId = asset.coingecko_id

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
        setMarketStats((prev: any) => ({
          ...prev,
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
      throw new Error("No backend data")
    } catch {
      // Fallback logic (Simplified for brevity or keep full if needed)
      // I will keep it mostly as is but cleaner
      try {
        const symbol = `${assetSymbol.toUpperCase()}USDT`
        const binInterval = range === "24H" ? "15m" : range === "7D" ? "1h" : range === "1M" ? "4h" : range === "3M" ? "12h" : range === "1Y" ? "1d" : "1w"
        
        const [tickerRes, klinesRes] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
          fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binInterval}&limit=365`),
        ])
        if (!tickerRes.ok || !klinesRes.ok) throw new Error("Binance Fail")
        const ticker = await tickerRes.json()
        const klines = await klinesRes.json()

        const points = klines.map((k: any) => ({
          date: new Date(k[0]).toISOString(),
          price: Number.parseFloat(k[4]),
          volume: Number.parseFloat(k[5]),
          confidence: Number.parseFloat(k[4]) * 0.95
        }))

        const first = points[0]
        const latest = points[points.length - 1]
        const rangeChange = first.price > 0 ? ((latest.price - first.price) / first.price) * 100 : 0

        setMarketStats((prev: any) => ({
          ...prev,
          price: prev?.price || Number.parseFloat(ticker.lastPrice),
          change24h: prev?.change24h || Number.parseFloat(ticker.priceChangePercent),
          rangeChange: rangeChange,
          volume: prev?.volume || Number.parseFloat(ticker.quoteVolume)
        }))
        setChartData(points)
      } catch {
        // CG Fallback
        if (cgId) {
          try {
            const days = range === "24H" ? "1" : range === "7D" ? "7" : range === "1M" ? "30" : range === "3M" ? "90" : range === "1Y" ? "365" : "max"
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`)
            const cgChartData = await res.json()
            if (cgChartData.prices?.length > 0) {
              const points = cgChartData.prices.map((p: any, i: number) => ({
                date: new Date(p[0]).toISOString(),
                price: p[1],
                volume: cgChartData.total_volumes?.[i]?.[1] || 0,
                confidence: p[1] * 0.95
              }))
              const first = points[0]
              const latest = points[points.length - 1]
              const rangeChange = first.price > 0 ? ((latest.price - first.price) / first.price) * 100 : 0
              setMarketStats((prev: any) => ({
                ...prev,
                price: prev?.price || latest.price,
                rangeChange: rangeChange
              }))
              setChartData(points)
            }
          } catch {}
        }
      }
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
