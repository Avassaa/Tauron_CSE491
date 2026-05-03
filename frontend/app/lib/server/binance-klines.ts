
export type BinanceSimpleCandle = { time: string; close: number }

const MAX_KLINES = 1000

export function estimateKlineLimit(lookbackHours: number, resolution: "1h" | "4h" | "1d"): number {
  const h = Math.max(1, lookbackHours)
  if (resolution === "1h") return Math.min(MAX_KLINES, Math.max(2, Math.ceil(h) + 2))
  if (resolution === "4h") return Math.min(MAX_KLINES, Math.max(2, Math.ceil(h / 4) + 2))
  return Math.min(MAX_KLINES, Math.max(2, Math.ceil(h / 24) + 2))
}

export type BinanceKlineInterval = "5m" | "1h" | "4h" | "1d"

export async function fetchBinanceSpotKlines(
  baseSymbol: string,
  interval: BinanceKlineInterval,
  limit: number,
): Promise<BinanceSimpleCandle[]> {
  const base = baseSymbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (!base || base === "USDT") return []

  const pair = `${base}USDT`
  const safeLimit = Math.min(MAX_KLINES, Math.max(2, Math.floor(limit)))

  const urls = [
    `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${interval}&limit=${safeLimit}`,
    `https://www.binance.com/api/v3/uiKlines?symbol=${encodeURIComponent(pair)}&interval=${interval}&limit=${safeLimit}`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const raw = (await res.json()) as unknown
      if (!Array.isArray(raw) || raw.length === 0) continue

      const candles: BinanceSimpleCandle[] = []
      for (const row of raw) {
        if (!Array.isArray(row) || row.length < 5) continue
        const openMs = Number(row[0])
        const close = Number.parseFloat(String(row[4]))
        if (!Number.isFinite(openMs) || !Number.isFinite(close)) continue
        candles.push({
          time: new Date(openMs).toISOString(),
          close,
        })
      }
      if (candles.length === 0) continue
      candles.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      return candles
    } catch {
      continue
    }
  }

  return []
}
