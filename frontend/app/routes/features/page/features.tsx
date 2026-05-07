"use client"

import * as React from "react"
import { Link } from "react-router"
import {
  BarChart2,
  Brain,
  TrendingUp,
  MessageSquare,
  FlaskConical,
  LayoutGrid,
  Bell,
  ShieldCheck,
  BookOpen,
  ListChecks,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"
import { BeamsBackground } from "~/components/landing/beams-background"
import { LineShadowText } from "~/routes/home/components/line-shadow-text"
import { cn } from "~/lib/utils"

export function meta() {
  return [
    { title: "Features — Tauron" },
    {
      name: "description",
      content:
        "Explore every tool Tauron offers — from real-time dashboards and AI news synthesis to ML price predictions and strategy backtesting.",
    },
  ]
}

function useIsLoggedIn() {
  const [loggedIn, setLoggedIn] = React.useState(false)
  React.useEffect(() => {
    setLoggedIn(!!localStorage.getItem("access_token"))
    const handler = () => setLoggedIn(!!localStorage.getItem("access_token"))
    window.addEventListener("tauron:auth-changed", handler)
    return () => window.removeEventListener("tauron:auth-changed", handler)
  }, [])
  return loggedIn
}

// ─── Feature data ──────────────────────────────────────────────────────────────

const PRIMARY_FEATURES = [
  {
    icon: <BarChart2 className="size-5 text-sky-400" />,
    glow: "bg-sky-500/8 group-hover:bg-sky-500/14",
    label: "Real-time Dashboard",
    desc: "Live OHLCV charts, interactive portfolio metrics, and customizable date-range filters — all backed by our TimescaleDB time-series engine.",
    bullets: ["OHLCV candlestick & area charts", "Adjustable date-range filters", "Volume-weighted metrics"],
  },
  {
    icon: <Brain className="size-5 text-violet-400" />,
    glow: "bg-violet-500/8 group-hover:bg-violet-500/14",
    label: "AI News Feed",
    desc: "Our NLP and LLM pipeline ingests 10+ real-time financial news sources, extracts sentiment signals, and synthesises each article into a concise, unbiased summary.",
    bullets: ["Sentiment score −1 → +1 per asset", "Per-asset curation — no noise", "Source attribution & timestamps"],
  },
  {
    icon: <TrendingUp className="size-5 text-emerald-400" />,
    glow: "bg-emerald-500/8 group-hover:bg-emerald-500/14",
    label: "ML Price Predictions",
    desc: "Multiple deep-learning and ensemble architectures trained on historical OHLCV data. Browse model versions, see training metrics, and inspect confidence bands.",
    bullets: ["LSTM · GRU · XGBoost models", "Per-model version tracking", "Visual confidence bands on charts"],
  },
  {
    icon: <MessageSquare className="size-5 text-amber-400" />,
    glow: "bg-amber-500/8 group-hover:bg-amber-500/14",
    label: "AI Chat Assistant",
    desc: "A RAG-powered assistant grounded in Tauron's own knowledge base. Ask about market conditions, indicators, recent news, or portfolio strategy — without hallucinations.",
    bullets: ["RAG — no hallucinated external data", "Asset-aware context injection", "Persistent conversation history"],
  },
  {
    icon: <FlaskConical className="size-5 text-rose-400" />,
    glow: "bg-rose-500/8 group-hover:bg-rose-500/14",
    label: "Backtesting Engine",
    desc: "Replay any trading strategy against years of historical market data. See total return, Sharpe ratio, and maximum drawdown alongside a full equity curve.",
    bullets: ["Total return · Sharpe · Max drawdown", "Full equity curve visualisation", "Per-trade log & inspection"],
  },
  {
    icon: <LayoutGrid className="size-5 text-indigo-400" />,
    glow: "bg-indigo-500/8 group-hover:bg-indigo-500/14",
    label: "Market Heatmap",
    desc: "Instantly spot winners and losers across the entire crypto market with a colour-coded treemap that scales cell size by market cap.",
    bullets: ["Color-coded by % change", "Market-cap-weighted cell sizing", "Click to open asset detail"],
  },
]

const SECONDARY_FEATURES = [
  {
    icon: <ListChecks className="size-4 text-meta-blue" />,
    label: "Smart Watchlists",
    desc: "Save and organise assets across custom lists. Your watchlist persists across sessions and powers personalised news curation.",
  },
  {
    icon: <Bell className="size-4 text-meta-blue" />,
    label: "Notification Centre",
    desc: "Get alerted on price thresholds, sentiment shifts, and model signal changes for any tracked asset.",
  },
  {
    icon: <BookOpen className="size-4 text-meta-blue" />,
    label: "Technical Indicators",
    desc: "RSI, MACD, Bollinger Bands, SMA, and EMA surfaced directly in the chart interface — and used as ML model features.",
  },
  {
    icon: <ShieldCheck className="size-4 text-meta-blue" />,
    label: "JWT-secured API",
    desc: "Every endpoint is protected by server-side JWT authorisation. Your watchlists, chat history, and backtest results stay private.",
  },
]


// ─── Components ────────────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  glow,
  label,
  desc,
  bullets,
}: (typeof PRIMARY_FEATURES)[0]) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border bg-card/60 p-7 backdrop-blur-md transition-all duration-500 hover:bg-muted/50 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]">
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl transition-all duration-700",
          glow,
        )}
      />
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted dark:border-white/10 dark:bg-neutral-900">
        {icon}
      </div>
      <h3 className="mb-2 text-base font-black tracking-tight text-foreground dark:text-white">
        {label}
      </h3>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground dark:text-white/55">
        {desc}
      </p>
      <ul className="space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-meta-blue" />
            <span className="text-xs text-muted-foreground dark:text-white/50">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  const loggedIn = useIsLoggedIn()

  return (
    <BeamsBackground intensity="medium">
      <div className="relative min-h-screen w-full overflow-x-hidden pb-24 pt-28">
        <div className="mx-auto max-w-7xl space-y-24 px-6">

          {/* ── Hero ──────────────────────────────────────────── */}
          <div className="flex flex-col items-center text-center">
            <h1 className="max-w-4xl text-5xl font-black leading-[1.05] tracking-tight text-foreground dark:text-white md:text-7xl">
              Every tool you need{" "}
              <LineShadowText className="text-meta-blue" shadowColor="oklch(0.55 0.22 255)">
                to trade smarter.
              </LineShadowText>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground dark:text-white/55">
              Tauron brings real-time market data, AI news synthesis, ML price
              forecasting, and strategy backtesting into one unified platform — no
              coding required.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                to={loggedIn ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                {loggedIn ? "Go to Dashboard" : "Get started free"}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-border px-8 py-3 text-sm font-bold text-foreground/70 transition-all hover:border-border/80 hover:text-foreground dark:border-white/10 dark:text-white/50 dark:hover:text-white"
              >
                View pricing
              </Link>
            </div>
          </div>

          {/* ── Primary feature cards ─────────────────────────── */}
          <div>
            <div className="mb-10 text-center">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-400">
                Core Modules
              </p>
              <h2 className="text-3xl font-black leading-tight tracking-tight text-foreground dark:text-white md:text-5xl">
                Built for the full{" "}
                <span className="font-light text-meta-blue">research cycle.</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PRIMARY_FEATURES.map((f) => (
                <FeatureCard key={f.label} {...f} />
              ))}
            </div>
          </div>

          {/* ── AI Chat deep dive ─────────────────────────────── */}
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-amber-400">
                  AI Assistant
                </p>
                <h2 className="text-3xl font-black leading-tight tracking-tight text-foreground dark:text-white md:text-5xl">
                  Ask anything about{" "}
                  <span className="font-light text-meta-blue">the market.</span>
                </h2>
              </div>
              <p className="text-base leading-relaxed text-muted-foreground dark:text-white/60 md:text-lg">
                The AI Chat is powered by a{" "}
                <span className="font-semibold text-foreground dark:text-white">
                  Retrieval-Augmented Generation
                </span>{" "}
                pipeline grounded in Tauron's own knowledge base. It pulls live
                asset data, recent news summaries, and your watchlist context
                into every response — so answers are always current and
                grounded.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground dark:text-white/60">
                {[
                  "Explain any technical indicator in plain language",
                  "Summarise recent news for a specific asset",
                  "Compare strategy outcomes from your backtests",
                  "Persistent per-session conversation history",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                to={loggedIn ? "/chat" : "/login"}
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-bold text-foreground/70 transition-all hover:border-border/80 hover:text-foreground dark:border-white/10 dark:text-white/50 dark:hover:text-white"
              >
                Open AI Chat <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-border bg-muted/40 p-6 dark:border-white/8 dark:bg-neutral-900/60">
              <div className="space-y-3">
                {[
                  { role: "user", msg: "What's the current sentiment for BTC?" },
                  {
                    role: "ai",
                    msg: "BTC sentiment is +0.68 (bullish) based on the last 24 h news cycle. Key drivers: spot ETF inflows and positive macro data. No major bearish signals detected.",
                  },
                  { role: "user", msg: "Should I adjust my position?" },
                  {
                    role: "ai",
                    msg: "Your backtest shows a 34% drawdown during similar macro conditions in Q4 2022. Consider tightening your stop-loss to 8% before adding exposure.",
                  },
                ].map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                      m.role === "user"
                        ? "ml-auto rounded-br-sm bg-meta-blue/20 text-foreground dark:text-white/90"
                        : "rounded-bl-sm border border-border bg-card dark:border-white/8 dark:bg-white/[0.04] dark:text-white/80",
                    )}
                  >
                    {m.role === "ai" && (
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-meta-blue">
                        Tauron AI
                      </span>
                    )}
                    {m.msg}
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-amber-500/8 blur-3xl" />
            </div>
          </div>

          {/* ── Backtesting deep dive ─────────────────────────── */}
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="relative order-2 overflow-hidden rounded-3xl border border-border bg-muted/40 p-6 dark:border-white/8 dark:bg-neutral-900/60 lg:order-1">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-white/30">
                Backtest · BTC/USDT · 90-day window
              </p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Total Return", value: "+42.6%", color: "text-emerald-400" },
                  { label: "Sharpe Ratio", value: "1.84", color: "text-sky-400" },
                  { label: "Max Drawdown", value: "−11.2%", color: "text-rose-400" },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-border bg-background/60 p-3 text-center dark:border-white/8 dark:bg-black/30"
                  >
                    <p className={cn("text-lg font-black", m.color)}>{m.value}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground dark:text-white/40">
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="relative h-28 overflow-hidden rounded-xl border border-border bg-background/40 dark:border-white/8 dark:bg-black/20">
                <svg
                  viewBox="0 0 400 100"
                  className="absolute inset-0 h-full w-full"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="btcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.55 0.22 255)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="oklch(0.55 0.22 255)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 80 C20 75, 40 60, 60 55 S100 40, 120 35 S160 28, 180 30 S220 20, 240 18 S280 10, 300 12 S340 8, 360 6 S380 5, 400 4 L400 100 L0 100 Z"
                    fill="url(#btcGrad)"
                  />
                  <path
                    d="M0 80 C20 75, 40 60, 60 55 S100 40, 120 35 S160 28, 180 30 S220 20, 240 18 S280 10, 300 12 S340 8, 360 6 S380 5, 400 4"
                    fill="none"
                    stroke="oklch(0.55 0.22 255)"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="pointer-events-none absolute -top-10 -left-10 h-44 w-44 rounded-full bg-rose-500/6 blur-3xl" />
            </div>

            <div className="order-1 space-y-6 lg:order-2">
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-rose-400">
                  Backtesting Engine
                </p>
                <h2 className="text-3xl font-black leading-tight tracking-tight text-foreground dark:text-white md:text-5xl">
                  Validate before you{" "}
                  <span className="font-light text-meta-blue">commit.</span>
                </h2>
              </div>
              <p className="text-base leading-relaxed text-muted-foreground dark:text-white/60 md:text-lg">
                Replay any strategy against years of historical OHLCV data.
                Tauron calculates risk-adjusted performance metrics and renders a
                full equity curve — so you know exactly how your strategy would
                have behaved under real market conditions.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground dark:text-white/60">
                {[
                  "Sharpe ratio and max drawdown out of the box",
                  "Full equity curve with per-trade annotations",
                  "Run multiple configurations and compare results",
                  "All results stored and accessible in your history",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                to={loggedIn ? "/backtests" : "/login"}
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-bold text-foreground/70 transition-all hover:border-border/80 hover:text-foreground dark:border-white/10 dark:text-white/50 dark:hover:text-white"
              >
                Open Backtesting <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* ── Secondary features ────────────────────────────── */}
          <div>
            <div className="mb-10 text-center">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground/50 dark:text-white/25">
                Also included
              </p>
              <h2 className="text-2xl font-black tracking-tight text-foreground dark:text-white md:text-4xl">
                The details that make the difference.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SECONDARY_FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="group rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-md transition-all duration-300 hover:bg-muted/50 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted dark:border-white/10 dark:bg-neutral-900">
                    {f.icon}
                  </div>
                  <h3 className="mb-1.5 text-sm font-black tracking-tight text-foreground dark:text-white">
                    {f.label}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground dark:text-white/50">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA ───────────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 px-8 py-16 text-center backdrop-blur-md dark:border-white/8 dark:bg-white/[0.02]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-meta-blue/5 via-transparent to-indigo-500/5" />
            <div className="relative">
              <h2 className="mb-4 text-3xl font-black tracking-tight text-foreground dark:text-white md:text-5xl">
                Ready to see it in action?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-base text-muted-foreground dark:text-white/55">
                Create a free account and explore the full platform — no credit
                card required.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  to={loggedIn ? "/dashboard" : "/register"}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  {loggedIn ? "Go to Dashboard" : "Start for free"} <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-8 py-3 text-sm font-bold text-foreground/70 transition-all hover:text-foreground dark:border-white/10 dark:text-white/50 dark:hover:text-white"
                >
                  Compare plans
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </BeamsBackground>
  )
}
