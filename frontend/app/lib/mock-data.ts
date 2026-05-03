import type {
  AssetResponse,
  BacktestResultResponse,
  MarketDataResponse,
  MlModelResponse,
  PredictionResponse,
  WatchlistEntryResponse,
} from "./api-client"

function getBasePrice(symbol: string): number {
  const s = symbol.toUpperCase()
  return s === "BTC" ? 65_000
    : s === "ETH" ? 3_500
    : s === "BNB" ? 580
    : s === "SOL" ? 185
    : s === "XRP" ? 0.62
    : s === "ADA" ? 0.48
    : s === "DOGE" ? 0.16
    : s === "AVAX" ? 38
    : s === "LINK" ? 18
    : s === "DOT" ? 9
    : s === "AAVE" ? 320
    : s === "MATIC" ? 1.2
    : s === "NEAR" ? 7.5
    : s === "UNI" ? 12
    : s === "ATOM" ? 11
    : s === "LTC" ? 95
    : 50 + s.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 450
}

// Shared price formula — t ∈ [0, 1] maps over the full selected range.
// Returns deterministic price for any t so historical and predictions connect seamlessly.
function mockPriceAt(t: number, basePrice: number): number {
  const slow = Math.sin(t * 6.6) * 0.045
  const fast = Math.sin(t * 21.3 + 1.3) * 0.018
  const trend = t * 0.07
  return basePrice * (1 + slow + fast + trend)
}

export const MOCK_ASSETS: AssetResponse[] = [
  { id: "1", symbol: "BTC", name: "Bitcoin", category: "Currency", coingecko_id: "bitcoin", is_active: true, created_at: new Date().toISOString() },
  { id: "2", symbol: "ETH", name: "Ethereum", category: "Smart Contract", coingecko_id: "ethereum", is_active: true, created_at: new Date().toISOString() },
  { id: "3", symbol: "USDT", name: "Tether", category: "Stablecoin", coingecko_id: "tether", is_active: true, created_at: new Date().toISOString() },
  { id: "4", symbol: "SOL", name: "Solana", category: "Smart Contract", coingecko_id: "solana", is_active: true, created_at: new Date().toISOString() },
  { id: "5", symbol: "ADA", name: "Cardano", category: "Smart Contract", coingecko_id: "cardano", is_active: true, created_at: new Date().toISOString() },
  { id: "6", symbol: "XRP", name: "XRP", category: "Currency", coingecko_id: "ripple", is_active: true, created_at: new Date().toISOString() },
  { id: "7", symbol: "DOT", name: "Polkadot", category: "Smart Contract", coingecko_id: "polkadot", is_active: true, created_at: new Date().toISOString() },
  { id: "8", symbol: "DOGE", name: "Dogecoin", category: "Meme", coingecko_id: "dogecoin", is_active: true, created_at: new Date().toISOString() },
  { id: "9", symbol: "AVAX", name: "Avalanche", category: "Smart Contract", coingecko_id: "avalanche-2", is_active: true, created_at: new Date().toISOString() },
  { id: "10", symbol: "LINK", name: "Chainlink", category: "Oracle", coingecko_id: "chainlink", is_active: true, created_at: new Date().toISOString() },
  { id: "11", symbol: "SHIB", name: "Shiba Inu", category: "Meme", coingecko_id: "shiba-inu", is_active: true, created_at: new Date().toISOString() },
  { id: "12", symbol: "MATIC", name: "Polygon", category: "Scaling", coingecko_id: "matic-network", is_active: true, created_at: new Date().toISOString() },
  { id: "13", symbol: "LTC", name: "Litecoin", category: "Currency", coingecko_id: "litecoin", is_active: true, created_at: new Date().toISOString() },
  { id: "14", symbol: "NEAR", name: "Near", category: "Smart Contract", coingecko_id: "near", is_active: true, created_at: new Date().toISOString() },
  { id: "15", symbol: "UNI", name: "Uniswap", category: "DeFi", coingecko_id: "uniswap", is_active: true, created_at: new Date().toISOString() },
  { id: "16", symbol: "ICP", name: "Internet Computer", category: "Smart Contract", coingecko_id: "internet-computer", is_active: true, created_at: new Date().toISOString() },
  { id: "17", symbol: "DAI", name: "Dai", category: "Stablecoin", coingecko_id: "dai", is_active: true, created_at: new Date().toISOString() },
  { id: "18", symbol: "BCH", name: "Bitcoin Cash", category: "Currency", coingecko_id: "bitcoin-cash", is_active: true, created_at: new Date().toISOString() },
  { id: "19", symbol: "STX", name: "Stacks", category: "Layer 2", coingecko_id: "blockstack", is_active: true, created_at: new Date().toISOString() },
  { id: "20", symbol: "ATOM", name: "Cosmos", category: "Interoperability", coingecko_id: "cosmos", is_active: true, created_at: new Date().toISOString() },
  { id: "21", symbol: "OP", name: "Optimism", category: "Scaling", coingecko_id: "optimism", is_active: true, created_at: new Date().toISOString() },
  { id: "22", symbol: "ARB", name: "Arbitrum", category: "Scaling", coingecko_id: "arbitrum", is_active: true, created_at: new Date().toISOString() },
  { id: "23", symbol: "APT", name: "Aptos", category: "Smart Contract", coingecko_id: "aptos", is_active: true, created_at: new Date().toISOString() },
  { id: "24", symbol: "SUI", name: "Sui", category: "Smart Contract", coingecko_id: "sui", is_active: true, created_at: new Date().toISOString() },
  { id: "25", symbol: "PEPE", name: "Pepe", category: "Meme", coingecko_id: "pepe", is_active: true, created_at: new Date().toISOString() },
  { id: "26", symbol: "RNDR", name: "Render", category: "AI", coingecko_id: "render-token", is_active: true, created_at: new Date().toISOString() },
  { id: "27", symbol: "FET", name: "Fetch.ai", category: "AI", coingecko_id: "fetch-ai", is_active: true, created_at: new Date().toISOString() },
  { id: "28", symbol: "TIA", name: "Celestia", category: "Modular", coingecko_id: "celestia", is_active: true, created_at: new Date().toISOString() },
  { id: "29", symbol: "INJ", name: "Injective", category: "DeFi", coingecko_id: "injective-protocol", is_active: true, created_at: new Date().toISOString() },
  { id: "30", symbol: "FIL", name: "Filecoin", category: "Storage", coingecko_id: "filecoin", is_active: true, created_at: new Date().toISOString() },
  { id: "31", symbol: "VET", name: "VeChain", category: "Supply Chain", coingecko_id: "vechain", is_active: true, created_at: new Date().toISOString() },
  { id: "32", symbol: "ALGO", name: "Algorand", category: "Smart Contract", coingecko_id: "algorand", is_active: true, created_at: new Date().toISOString() },
  { id: "33", symbol: "QNT", name: "Quant", category: "Interoperability", coingecko_id: "quant-network", is_active: true, created_at: new Date().toISOString() },
  { id: "34", symbol: "IMX", name: "Immutable", category: "Gaming", coingecko_id: "immutable-x", is_active: true, created_at: new Date().toISOString() },
  { id: "35", symbol: "EGLD", name: "MultiversX", category: "Smart Contract", coingecko_id: "elrond-erd-2", is_active: true, created_at: new Date().toISOString() },
  { id: "36", symbol: "THETA", name: "Theta Network", category: "Streaming", coingecko_id: "theta-token", is_active: true, created_at: new Date().toISOString() },
  { id: "37", symbol: "HBAR", name: "Hedera", category: "Smart Contract", coingecko_id: "hedera-hashgraph", is_active: true, created_at: new Date().toISOString() },
  { id: "38", symbol: "AAVE", name: "Aave", category: "DeFi", coingecko_id: "aave", is_active: true, created_at: new Date().toISOString() },
  { id: "39", symbol: "MKR", name: "Maker", category: "DeFi", coingecko_id: "maker", is_active: true, created_at: new Date().toISOString() },
  { id: "40", symbol: "SNX", name: "Synthetix", category: "DeFi", coingecko_id: "synthetix-network-token", is_active: true, created_at: new Date().toISOString() },
  { id: "41", symbol: "GRT", name: "The Graph", category: "Indexing", coingecko_id: "the-graph", is_active: true, created_at: new Date().toISOString() },
  { id: "42", symbol: "BNB", name: "BNB", category: "Exchange", coingecko_id: "binancecoin", is_active: true, created_at: new Date().toISOString() },
  { id: "43", symbol: "TRX", name: "TRON", category: "Smart Contract", coingecko_id: "tron", is_active: true, created_at: new Date().toISOString() },
  { id: "44", symbol: "XLM", name: "Stellar", category: "Payments", coingecko_id: "stellar", is_active: true, created_at: new Date().toISOString() },
  { id: "45", symbol: "ETC", name: "Ethereum Classic", category: "Smart Contract", coingecko_id: "ethereum-classic", is_active: true, created_at: new Date().toISOString() },
  { id: "46", symbol: "EOS", name: "EOS", category: "Smart Contract", coingecko_id: "eos", is_active: true, created_at: new Date().toISOString() },
  { id: "47", symbol: "XTZ", name: "Tezos", category: "Smart Contract", coingecko_id: "tezos", is_active: true, created_at: new Date().toISOString() },
  { id: "48", symbol: "SAND", name: "The Sandbox", category: "Gaming", coingecko_id: "the-sandbox", is_active: true, created_at: new Date().toISOString() },
  { id: "49", symbol: "MANA", name: "Decentraland", category: "Gaming", coingecko_id: "decentraland", is_active: true, created_at: new Date().toISOString() },
  { id: "50", symbol: "AXS", name: "Axie Infinity", category: "Gaming", coingecko_id: "axie-infinity", is_active: true, created_at: new Date().toISOString() },
  { id: "51", symbol: "RUNE", name: "THORChain", category: "DeFi", coingecko_id: "thorchain", is_active: true, created_at: new Date().toISOString() },
  { id: "52", symbol: "FLOW", name: "Flow", category: "NFT", coingecko_id: "flow", is_active: true, created_at: new Date().toISOString() },
  { id: "53", symbol: "KAVA", name: "Kava", category: "DeFi", coingecko_id: "kava", is_active: true, created_at: new Date().toISOString() },
  { id: "54", symbol: "GALA", name: "Gala", category: "Gaming", coingecko_id: "gala", is_active: true, created_at: new Date().toISOString() },
  { id: "55", symbol: "LDO", name: "Lido DAO", category: "DeFi", coingecko_id: "lido-dao", is_active: true, created_at: new Date().toISOString() },
  { id: "56", symbol: "CRV", name: "Curve DAO", category: "DeFi", coingecko_id: "curve-dao-token", is_active: true, created_at: new Date().toISOString() },
  { id: "57", symbol: "COMP", name: "Compound", category: "DeFi", coingecko_id: "compound-governance-token", is_active: true, created_at: new Date().toISOString() },
  { id: "58", symbol: "ZEC", name: "Zcash", category: "Privacy", coingecko_id: "zcash", is_active: true, created_at: new Date().toISOString() },
  { id: "59", symbol: "DASH", name: "Dash", category: "Payments", coingecko_id: "dash", is_active: true, created_at: new Date().toISOString() },
  { id: "60", symbol: "MINA", name: "Mina Protocol", category: "Zero Knowledge", coingecko_id: "mina-protocol", is_active: true, created_at: new Date().toISOString() },
]

export const MOCK_WATCHLIST: WatchlistEntryResponse[] = MOCK_ASSETS.slice(0, 25).map(asset => ({
  user_id: "demo-user",
  asset
}))

export const MOCK_BACKTESTS: BacktestResultResponse[] = [
  {
    id: "bt-1",
    user_id: "demo-user",
    model_id: "model-1",
    strategy_name: "Trend Following LSTM",
    total_return: 0.245,
    sharpe_ratio: 1.85,
    max_drawdown: -0.12,
    trades_log: {
      equity_curve: [10000, 10200, 10150, 10400, 10600, 10550, 10800, 11200, 11100, 11500, 11800, 12100, 12450],
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "bt-2",
    user_id: "demo-user",
    model_id: "model-2",
    strategy_name: "Mean Reversion GRU",
    total_return: 0.158,
    sharpe_ratio: 1.42,
    max_drawdown: -0.08,
    trades_log: {
      equity_curve: [10000, 10100, 10050, 10200, 10300, 10450, 10400, 10600, 10750, 10900, 11200, 11580],
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
]

export const MOCK_MODELS: MlModelResponse[] = [
  {
    id: "model-btc-1",
    asset_id: "1",
    version_tag: "v1.2.4-stable",
    model_type: "LSTM",
    hyperparameters: { learning_rate: 0.001, epochs: 100, batch_size: 32, hidden_layers: [64, 32] },
    training_metrics: { rmse: 0.0245, mae: 0.0182, r2: 0.89 },
    file_path: "models/btc_lstm_v1.2.4.pt",
    is_active: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: "model-btc-2",
    asset_id: "1",
    version_tag: "v2.0.0-beta",
    model_type: "GRU",
    hyperparameters: { learning_rate: 0.005, epochs: 150, batch_size: 64 },
    training_metrics: { rmse: 0.0152, mae: 0.0110, r2: 0.94 },
    file_path: "models/btc_gru_v2.0.0.pt",
    is_active: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "model-btc-3",
    asset_id: "1",
    version_tag: "v1.0.0-legacy",
    model_type: "RNN",
    hyperparameters: { learning_rate: 0.01, epochs: 50 },
    training_metrics: { rmse: 0.0452, mae: 0.0310, r2: 0.72 },
    file_path: "models/btc_rnn_v1.0.0.pt",
    is_active: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: "model-eth-1",
    asset_id: "2",
    version_tag: "v1.5.2-stable",
    model_type: "LSTM",
    hyperparameters: { learning_rate: 0.001, epochs: 120 },
    training_metrics: { rmse: 0.0312, mae: 0.0210, r2: 0.85 },
    file_path: "models/eth_lstm_v1.5.2.pt",
    is_active: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
  },
  {
    id: "model-eth-2",
    asset_id: "2",
    version_tag: "v1.1.0-beta",
    model_type: "Transformer",
    hyperparameters: { d_model: 128, nhead: 4 },
    training_metrics: { rmse: 0.0122, mae: 0.0090, r2: 0.96 },
    file_path: "models/eth_trans_v1.1.0.pt",
    is_active: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
]

export const MOCK_MARKET_DATA = Array.from({ length: 30 }).map((_, i) => ({
  time: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString(),
  asset_id: "bitcoin",
  open: 60000 + Math.random() * 5000,
  high: 66000 + Math.random() * 5000,
  low: 58000 + Math.random() * 5000,
  close: 62000 + Math.random() * 5000,
  volume: 1000000 + Math.random() * 500000,
  resolution: "1d",
}))

export const MOCK_MARKET_STATS_FALLBACK = {
  price: 64240.12,
  change24h: 2.45,
  volume: 1200000000000
}

export const MOCK_DASHBOARD_RESULTS = [
  { label: "Total Volume", start: "1.2M", end: "1.5M", value: "25%", isPositive: true },
  { label: "Active Users", start: "450", end: "620", value: "37%", isPositive: true },
  { label: "API Latency", start: "120ms", end: "95ms", value: "-21%", isPositive: true },
  { label: "Success Rate", start: "98.2%", end: "99.5%", value: "1.3%", isPositive: true },
]

/**
 * Returns deterministic mock data for a given asset symbol and time range.
 */
export const getAssetStats = (symbol: string, timeRange: string = "24h") => {
  const hash = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  // Variation factor based on timeRange
  const rangeFactor = 
    timeRange === "1h" ? 0.2 : 
    timeRange === "24h" ? 1.0 : 
    timeRange === "7d" ? 3.5 : 
    timeRange === "30d" ? 8.0 : 1.0

  const isUp = (hash + timeRange.length) % 2 === 0
  const price = 50000 + (hash % 10000) + (rangeFactor * 100)
  const changeValue = ((hash % 15) * rangeFactor).toFixed(1)
  const change = (isUp ? "+" : "-") + changeValue + "%"
  
  // Medium-resolution organic deterministic sparkline points (Random walk)
  const points = []
  let currentVal = 20 + (hash % 10)
  const steps = 25
  const volatility = rangeFactor * 2 + 5
  
  for (let i = 0; i <= steps; i++) {
    // High volatility semi-deterministic step with balanced range
    const step = ((hash + i * 19 + timeRange.length) % (volatility * 2 + 1)) - volatility
    currentVal = Math.max(8, Math.min(32, currentVal + step))
    points.push(`${i * (100 / steps)},${currentVal}`)
  }
  const sparkline = points.join(" L ")

  return {
    price,
    change,
    isUp,
    marketCap: `$${((hash * 13) % 2000).toFixed(1)}B`,
    volume: `$${((hash * 7) % 500).toFixed(1)}B`,
    supply: `${((hash * 19) % 100).toFixed(1)}M`,
    sparkline
  }
}

/**
 * Historical OHLCV candles for the first 65% of the selected range.
 * Connects seamlessly with generateMockPredictions at t=0.65.
 */
export function generateMockMarketData(
  assetId: string,
  symbol: string,
  days: number = 30,
): MarketDataResponse[] {
  const basePrice = getBasePrice(symbol)
  const histDays = Math.ceil(days * 0.65)
  const rangMs = days * 86_400_000

  return Array.from({ length: histDays }).map((_, i) => {
    // Use i/histDays (not i/(histDays-1)) so the last candle sits strictly
    // before t=0.65, avoiding a duplicate timestamp with the first prediction point.
    const t = (i / histDays) * 0.65
    const tPrev = (Math.max(0, i - 1) / histDays) * 0.65
    const close = mockPriceAt(t, basePrice)
    const open = mockPriceAt(tPrev, basePrice)
    const volatility = basePrice * 0.02
    const seed = (i * 37 + 7) % 97
    const high = Math.max(open, close) + volatility * (0.2 + (seed / 97) * 0.8)
    const low = Math.min(open, close) - volatility * (0.2 + ((seed + 31) % 97) / 97 * 0.8)
    const volume = 500_000 + ((i * 137 + 71) % 1_200_000)
    const time = new Date(Date.now() - (1 - t) * rangMs).toISOString()
    return {
      time,
      asset_id: assetId,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(Math.min(low, Math.min(open, close) * 0.999) * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
      resolution: "1d",
    }
  })
}

/**
 * Prediction series: last 35% of the historical range (context/validation)
 * + full `days` into the future (live forecast zone).
 * Query now uses time_to = now+days, so this mock matches the real backend expectation.
 */
export function generateMockPredictions(
  assetId: string,
  symbol: string,
  modelId: string,
  days: number = 30,
): PredictionResponse[] {
  const basePrice = getBasePrice(symbol)
  const startT = 0.65  // begins at the historical handoff point
  const endT = 2.0     // ends exactly `days` into the future (t=1 is now, t=2 is now+days)
  const rangMs = days * 86_400_000

  // Span = 0.35 past context + 1.0 future forecast = 1.35 × days, one candle per day
  const forecastSpanDays = days * 1.35
  const totalPoints = Math.max(5, Math.ceil(forecastSpanDays))

  return Array.from({ length: totalPoints }).map((_, i) => {
    const progress = totalPoints === 1 ? 0 : i / (totalPoints - 1)
    const t = startT + progress * (endT - startT)
    const predicted = mockPriceAt(t, basePrice)
    // CI widens as forecast extends further into the future (0.8% → 3.5%)
    const ciPct = 0.008 + progress * 0.027
    const ci = predicted * ciPct
    const time = new Date(Date.now() - (1 - t) * rangMs).toISOString()
    return {
      time,
      asset_id: assetId,
      model_id: modelId,
      predicted_value: Math.round(predicted * 100) / 100,
      confidence_interval_high: Math.round((predicted + ci) * 100) / 100,
      confidence_interval_low: Math.round((predicted - ci) * 100) / 100,
    }
  })
}

export const generateMockChartData = (basePrice: number = 60000, points: number = 50) => {
  return Array.from({ length: points }).map((_, i) => {
    const date = new Date(Date.now() - (points - 1 - i) * 60 * 60 * 1000).toISOString()
    // Use index for semi-deterministic behavior
    const price = basePrice + Math.sin(i * 0.5) * (basePrice * 0.05) + ((i * 17) % 100)
    return {
      date,
      price,
      confidence: price * 0.95
    }
  })
}
