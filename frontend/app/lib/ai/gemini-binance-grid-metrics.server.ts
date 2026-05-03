
import { fetchBinanceSpotKlines } from "~/lib/server/binance-klines"

function normalizeBinanceBaseSymbol(raw: string): string | null {
  const normalized = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  if (!normalized || normalized.length < 2 || normalized.length > 12) return null
  return normalized
}

function computePctChange(first: number, latest: number): number | null {
  if (!Number.isFinite(first) || !Number.isFinite(latest) || first <= 0) return null
  return ((latest - first) / first) * 100
}

export type AssetsGridStyleMetrics = {
  price_change_1h: number | null
  price_change_7d: number | null
  methodology: string
}

export async function computeAssetsGridStyleMetrics(baseSymbol: string): Promise<AssetsGridStyleMetrics> {
  const normalized = normalizeBinanceBaseSymbol(baseSymbol)
  if (!normalized || normalized === "USDT") {
    return {
      price_change_1h: null,
      price_change_7d: null,
      methodology:
        "Matches Assets page: Binance USDT spot klines — 5m×13 for ~1h window change, 4h×42 for ~7d window change (first→last close %).",
    }
  }

  try {
    const [sparklineRows, oneHourRows] = await Promise.all([
      fetchBinanceSpotKlines(normalized, "4h", 42),
      fetchBinanceSpotKlines(normalized, "5m", 13),
    ])

    const sparkline = sparklineRows.map((c) => c.close).filter((v) => Number.isFinite(v))
    const oneHourPrices = oneHourRows.map((c) => c.close).filter((v) => Number.isFinite(v))

    const price_change_7d =
      sparkline.length > 1 ? computePctChange(sparkline[0], sparkline[sparkline.length - 1]) : null
    const price_change_1h =
      oneHourPrices.length > 1 ? computePctChange(oneHourPrices[0], oneHourPrices[oneHourPrices.length - 1]) : null

    return {
      price_change_1h,
      price_change_7d,
      methodology:
        "Same derivation as the Assets grid: Binance spot closes — percent change from first to last in 5m×13 series (~1h) and 4h×42 series (~7d). Educational context only.",
    }
  } catch {
    return {
      price_change_1h: null,
      price_change_7d: null,
      methodology:
        "Assets grid style (5m×13 / 4h×42) — Binance request failed; values unavailable for this symbol.",
    }
  }
}
