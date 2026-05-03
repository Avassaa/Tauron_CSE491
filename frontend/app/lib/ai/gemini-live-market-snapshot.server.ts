
import { internalJsonFetch } from "~/lib/ai/gemini-internal-api"

export type LiveMarketSnapshot = {
  last_price_usdt: number | null
  quote_volume_24h_usdt: number | null
  price_change_24h_pct: number | null
  rank_by_liquidity: number | null
  source: "tauron_live_market"
}

export async function fetchLiveMarketSnapshot(
  authHeader: string | null,
  symbol: string,
): Promise<LiveMarketSnapshot | null> {
  if (!authHeader?.trim()) return null
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const qs = new URLSearchParams({ symbols: sym, limit: "25" })
  const res = await internalJsonFetch<Array<Record<string, unknown>>>(`/assets/live-market?${qs}`, {
    authHeader,
    method: "GET",
  })

  if (!res.ok || !Array.isArray(res.data)) return null

  const row = res.data.find((r) => String(r.symbol ?? "").toUpperCase() === sym)
  if (!row) return null

  const num = (x: unknown) => {
    if (typeof x === "number" && Number.isFinite(x)) return x
    if (typeof x === "string") {
      const v = Number.parseFloat(x)
      return Number.isFinite(v) ? v : null
    }
    return null
  }

  return {
    last_price_usdt: num(row.price),
    quote_volume_24h_usdt: num(row.volume),
    price_change_24h_pct: num(row.price_change_24h),
    rank_by_liquidity: num(row.rank),
    source: "tauron_live_market",
  }
}
