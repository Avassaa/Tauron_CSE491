/**
 * Crypto-themed fallback data for dashboard charts.
 * These are used as placeholders while live data loads or if the API is unavailable.
 */

export interface FallbackCoin {
  symbol: string
  name: string
  price: number
  volume: number
  market_cap: number
  price_change_1h: number
  price_change_24h: number
  price_change_7d: number
  price_change_30d: number
  rank: number
}

export const FALLBACK_COINS: FallbackCoin[] = [
  { symbol: "BTC", name: "Bitcoin", price: 97500, volume: 28_000_000_000, market_cap: 1_920_000_000_000, price_change_1h: 0.3, price_change_24h: 1.8, price_change_7d: 4.2, price_change_30d: 12.5, rank: 1 },
  { symbol: "ETH", name: "Ethereum", price: 1820, volume: 12_000_000_000, market_cap: 220_000_000_000, price_change_1h: 0.5, price_change_24h: 2.4, price_change_7d: 5.1, price_change_30d: 8.9, rank: 2 },
  { symbol: "BNB", name: "BNB", price: 608, volume: 1_500_000_000, market_cap: 88_000_000_000, price_change_1h: 0.1, price_change_24h: 0.9, price_change_7d: 2.3, price_change_30d: 5.4, rank: 3 },
  { symbol: "SOL", name: "Solana", price: 162, volume: 3_200_000_000, market_cap: 75_000_000_000, price_change_1h: 0.8, price_change_24h: 3.1, price_change_7d: 7.8, price_change_30d: 18.2, rank: 4 },
  { symbol: "XRP", name: "XRP", price: 2.18, volume: 4_100_000_000, market_cap: 125_000_000_000, price_change_1h: -0.2, price_change_24h: -0.6, price_change_7d: -1.2, price_change_30d: 3.8, rank: 5 },
  { symbol: "DOGE", name: "Dogecoin", price: 0.192, volume: 1_800_000_000, market_cap: 28_000_000_000, price_change_1h: 1.1, price_change_24h: 4.2, price_change_7d: 9.4, price_change_30d: 22.1, rank: 6 },
  { symbol: "ADA", name: "Cardano", price: 0.72, volume: 620_000_000, market_cap: 25_000_000_000, price_change_1h: 0.3, price_change_24h: 1.2, price_change_7d: 3.5, price_change_30d: -2.8, rank: 7 },
  { symbol: "AVAX", name: "Avalanche", price: 24.8, volume: 380_000_000, market_cap: 10_300_000_000, price_change_1h: -0.4, price_change_24h: -1.4, price_change_7d: 2.1, price_change_30d: -5.6, rank: 8 },
  { symbol: "SHIB", name: "Shiba Inu", price: 0.0000148, volume: 290_000_000, market_cap: 8_700_000_000, price_change_1h: 1.5, price_change_24h: 5.8, price_change_7d: 12.3, price_change_30d: 28.4, rank: 9 },
  { symbol: "LINK", name: "Chainlink", price: 14.2, volume: 310_000_000, market_cap: 8_800_000_000, price_change_1h: 0.7, price_change_24h: 2.8, price_change_7d: 6.2, price_change_30d: 10.1, rank: 10 },
]

// 30-day BTC price klines (fallback)
export const FALLBACK_BTC_KLINES = Array.from({ length: 30 }, (_, i) => {
  const basePrice = 89000
  const t = i / 29
  const price = basePrice * (1 + Math.sin(t * 5.5) * 0.06 + t * 0.08 + Math.sin(t * 14.3) * 0.02)
  const date = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10)
  return { date, price: Math.round(price) }
})

// 30-day ETH price klines (fallback)
export const FALLBACK_ETH_KLINES = Array.from({ length: 30 }, (_, i) => {
  const basePrice = 1680
  const t = i / 29
  const price = basePrice * (1 + Math.sin(t * 5.5 + 0.4) * 0.07 + t * 0.09 + Math.sin(t * 12.1) * 0.025)
  const date = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10)
  return { date, price: Math.round(price) }
})

// 30-day SOL price klines (fallback)
export const FALLBACK_SOL_KLINES = Array.from({ length: 30 }, (_, i) => {
  const basePrice = 140
  const t = i / 29
  const price = basePrice * (1 + Math.sin(t * 6.2 + 0.8) * 0.09 + t * 0.12 + Math.sin(t * 11.5) * 0.03)
  const date = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10)
  return { date, price: Math.round(price * 100) / 100 }
})

export const COIN_CATEGORIES: Record<string, string> = {
  BTC: "Currency", ETH: "Smart Contract", BNB: "Exchange",
  SOL: "Smart Contract", XRP: "Currency", ADA: "Smart Contract",
  DOGE: "Meme", AVAX: "Smart Contract", SHIB: "Meme",
  LINK: "Oracle / DeFi", DOT: "Smart Contract", MATIC: "Scaling",
  LTC: "Currency", UNI: "DeFi", AAVE: "DeFi", MKR: "DeFi",
  CRV: "DeFi", COMP: "DeFi", SNX: "DeFi", RUNE: "DeFi",
  OP: "Scaling", ARB: "Scaling", ATOM: "Interoperability",
  NEAR: "Smart Contract", APT: "Smart Contract", SUI: "Smart Contract",
  PEPE: "Meme", FLOKI: "Meme", WIF: "Meme",
  RNDR: "AI / Infra", FET: "AI / Infra", AGIX: "AI / Infra",
  FIL: "Storage", AR: "Storage",
  INJ: "DeFi", TIA: "Modular", PYTH: "Oracle / DeFi",
  ICP: "Smart Contract", ALGO: "Smart Contract", ETC: "Smart Contract",
  BCH: "Currency", TRX: "Smart Contract", XLM: "Currency",
  VET: "Enterprise", HBAR: "Smart Contract", EGLD: "Smart Contract",
  THETA: "Media", SAND: "Gaming / NFT", MANA: "Gaming / NFT", AXS: "Gaming / NFT",
  IMX: "Gaming / NFT", FLOW: "Gaming / NFT", GALA: "Gaming / NFT",
  ZEC: "Privacy", DASH: "Currency", XMR: "Privacy",
}
