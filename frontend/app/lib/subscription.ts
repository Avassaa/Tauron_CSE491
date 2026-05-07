export type PlanSlug = "free" | "pro" | "ultra"

export interface SubscriptionFeature {
  text: string
  tooltip?: string
}

export interface SubscriptionPlan {
  slug: PlanSlug
  name: string
  price: { monthly: number; yearly: number }
  description: string
  features: SubscriptionFeature[]
  highlighted?: boolean
  badge?: string
}

export const PLANS: SubscriptionPlan[] = [
  {
    slug: "free",
    name: "Free",
    description: "Core analytics for getting started.",
    price: { monthly: 0, yearly: 0 },
    features: [
      { text: "Core indicators: RSI, MACD, moving averages for BTC & ETH" },
      { text: "Real-time price tracking via Binance API" },
      { text: "Daily forecast summary: directional signals on 4h candles" },
      { text: "Standard dashboard with live market view" },
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    description: "AI-powered predictions for smarter trading.",
    price: { monthly: 20, yearly: 200 },
    highlighted: true,
    badge: "Most Popular",
    features: [
      { text: "AI price predictions: Buy/Sell/Hold signals", tooltip: "Powered by hybrid LSTM-GRU models" },
      { text: "FinBERT sentiment analysis with 0.68 correlation", tooltip: "Sentiment scores from news & social media" },
      { text: "Live Buy/Sell/Hold alerts over WebSocket" },
      { text: "Advanced charting: overlay technical data & sentiment" },
    ],
  },
  {
    slug: "ultra",
    name: "Ultra",
    description: "Train your own model. Full institutional-grade control.",
    price: { monthly: 50, yearly: 500 },
    features: [
      { text: "Custom model training on your selected assets", tooltip: "Configure training parameters and schedules" },
      { text: "On-chain metrics: NVT ratio & exchange net flow (Glassnode)", tooltip: "Network Value to Transactions + exchange inflow/outflow" },
      { text: "Unlimited backtesting with Sharpe Ratio & Max Drawdown" },
      { text: "Priority model access: latest weights, hot-swap updates" },
    ],
  },
]

export function getPlan(slug: PlanSlug | string): SubscriptionPlan {
  return PLANS.find((p) => p.slug === slug) ?? PLANS[0]
}

export function getPlanLabel(slug: PlanSlug | string): string {
  return getPlan(slug).name
}

export const PLAN_COLOR: Record<PlanSlug, string> = {
  free: "text-muted-foreground",
  pro: "text-violet-500 dark:text-violet-400",
  ultra: "text-amber-500 dark:text-amber-400",
}

export const PLAN_BADGE: Record<PlanSlug, string> = {
  free: "border border-border/60 bg-muted/60 text-muted-foreground",
  pro: "border border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  ultra: "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
}
