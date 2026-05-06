"use client"

import * as React from "react"
import { apiGet } from "~/lib/api-client"

const MARKET_TTL_MS = 60_000
let marketCacheData: any[] | null = null
let marketCacheAt = 0
let marketInFlight: Promise<any[]> | null = null

async function fetchMarket(limit = 50): Promise<any[]> {
  if (marketCacheData && Date.now() - marketCacheAt <= MARKET_TTL_MS) return marketCacheData
  if (marketInFlight) return marketInFlight
  marketInFlight = apiGet<any[]>("/assets/live-market", { limit })
    .then((data) => {
      marketCacheData = data
      marketCacheAt = Date.now()
      return data
    })
    .finally(() => { marketInFlight = null })
  return marketInFlight
}

async function fetchBinanceKlines(pair: string, interval: string, limit: number): Promise<any[]> {
  const urls = [
    `https://www.binance.com/api/v3/uiKlines?symbol=${pair}&interval=${interval}&limit=${limit}`,
    `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
    `https://www.binance.com/fapi/v1/continuousKlines?interval=${interval}&limit=${limit}&pair=${pair}&contractType=PERPETUAL`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
    } catch { /* try next */ }
  }
  return []
}

export interface DashboardCoin {
  symbol: string
  name: string
  price: number | null
  volume: number | null
  market_cap: number | null
  price_change_1h: number | null
  price_change_24h: number | null
  price_change_7d: number | null
  price_change_30d: number | null
  rank: number
}

export interface KlinePoint {
  date: string
  price: number
}

export function useDashboardData() {
  const [coins, setCoins] = React.useState<DashboardCoin[]>([])
  const [btcKlines, setBtcKlines] = React.useState<KlinePoint[]>([])
  const [ethKlines, setEthKlines] = React.useState<KlinePoint[]>([])
  const [solKlines, setSolKlines] = React.useState<KlinePoint[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const [marketResult, btcResult, ethResult, solResult] = await Promise.allSettled([
          fetchMarket(50),
          fetchBinanceKlines("BTCUSDT", "1d", 30),
          fetchBinanceKlines("ETHUSDT", "1d", 30),
          fetchBinanceKlines("SOLUSDT", "1d", 30),
        ])

        if (cancelled) return

        if (marketResult.status === "fulfilled") {
          const raw = Array.isArray(marketResult.value) ? marketResult.value : []
          setCoins(raw.map((c: any) => ({
            symbol: String(c.symbol ?? "").toUpperCase(),
            name: c.name ?? c.symbol ?? "",
            price: typeof c.price === "number" ? c.price : null,
            volume: typeof c.volume === "number" ? c.volume : null,
            market_cap: typeof c.market_cap === "number" ? c.market_cap : null,
            price_change_1h: typeof c.price_change_1h === "number" ? c.price_change_1h : null,
            price_change_24h: typeof c.price_change_24h === "number" ? c.price_change_24h : null,
            price_change_7d: typeof c.price_change_7d === "number" ? c.price_change_7d : null,
            price_change_30d: typeof c.price_change_30d === "number" ? c.price_change_30d : null,
            rank: typeof c.rank === "number" ? c.rank : 999,
          })))
        }

        const parseKlines = (raw: any[]): KlinePoint[] =>
          raw
            .map((k: any) => ({
              date: new Date(k[0]).toISOString().slice(0, 10),
              price: Number.parseFloat(String(k[4] ?? "")),
            }))
            .filter((p) => Number.isFinite(p.price))

        if (btcResult.status === "fulfilled") setBtcKlines(parseKlines(btcResult.value))
        if (ethResult.status === "fulfilled") setEthKlines(parseKlines(ethResult.value))
        if (solResult.status === "fulfilled") setSolKlines(parseKlines(solResult.value))
      } catch (err) {
        console.error("[DashboardData] fetch failed:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  return { coins, btcKlines, ethKlines, solKlines, loading }
}
