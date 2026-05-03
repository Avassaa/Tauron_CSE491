
const BINANCE_24HR_TICKER_URL = "https://api.binance.com/api/v3/ticker/24hr"

export async function fetchBinanceLastPrice(pairSymbol: string): Promise<number | null> {
  try {
    const response = await fetch(`${BINANCE_24HR_TICKER_URL}?symbol=${encodeURIComponent(pairSymbol)}`)
    if (!response.ok) return null
    const row = (await response.json()) as { lastPrice?: string }
    const price = Number.parseFloat(row.lastPrice ?? "")
    return Number.isFinite(price) && price > 0 ? price : null
  } catch {
    return null
  }
}
