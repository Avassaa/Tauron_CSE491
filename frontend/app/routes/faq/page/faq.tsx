"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { BeamsBackground } from "~/components/landing/beams-background"
import { LineShadowText } from "~/routes/home/components/line-shadow-text"
import { cn } from "~/lib/utils"

// ─── Data ─────────────────────────────────────────────────────────────────────

const FAQ_CATEGORIES = [
  {
    category: "Platform Overview",
    items: [
      {
        question: "What is Tauron?",
        answer:
          "Tauron is an AI-powered crypto analytics platform built for researchers and investors. It combines real-time market data, machine learning price forecasts, NLP-driven news synthesis, and strategy backtesting in a single unified dashboard — turning raw market noise into actionable intelligence.",
      },
      {
        question: "Who is Tauron built for?",
        answer:
          "Tauron is designed for crypto investors, quantitative researchers, and finance students who want more than raw price data. Whether you're running algorithmic strategies, tracking sentiment across assets, or exploring ML-driven forecasts, Tauron gives you the tools to go deeper without writing your own infrastructure.",
      },
      {
        question: "Does Tauron require any coding knowledge?",
        answer:
          "No coding is required to use Tauron's dashboard, watchlists, news feed, or AI chat. Advanced features like the Backtesting module expose performance metrics and equity curves in a visual interface. The underlying models and pipelines are managed by the platform.",
      },
    ],
  },
  {
    category: "Dashboard & Data",
    items: [
      {
        question: "What does the Dashboard show?",
        answer:
          "The Dashboard gives you a live overview of your tracked assets with OHLCV (open, high, low, close, volume) charts, interactive portfolio metrics, and customizable date-range filters. All chart data is fetched directly from our backend's TimescaleDB time-series database.",
      },
      {
        question: "Which technical indicators are available?",
        answer:
          "Tauron computes RSI (Relative Strength Index), MACD (Moving Average Convergence Divergence), Bollinger Bands, simple and exponential moving averages, and volume-weighted metrics. These are surfaced in the charting interface and also used as features for the ML prediction models.",
      },
      {
        question: "How often is market data updated?",
        answer:
          "Price and volume data is ingested continuously from exchange APIs and processed into our time-series database. The dashboard reflects near real-time data, while historical OHLCV series go back several years for backtesting and model training purposes.",
      },
    ],
  },
  {
    category: "AI & Machine Learning",
    items: [
      {
        question: "How does the AI News feed work?",
        answer:
          "Our backend runs an NLP and LLM pipeline that ingests news articles from multiple sources, extracts key market signals, and synthesises them into concise summaries with a sentiment score ranging from −1 (strongly bearish) to +1 (strongly bullish). The feed is curated per asset so you only see what matters to your tracked coins.",
      },
      {
        question: "What ML models are available for price prediction?",
        answer:
          "Tauron trains and serves several architectures including LSTM (Long Short-Term Memory), GRU (Gated Recurrent Unit), and XGBoost. Each model version is versioned and tracked with its training metrics. You can browse all registered models and see which version is currently active for each asset on the ML Models page.",
      },
      {
        question: "What is the AI Chat and how does it work?",
        answer:
          "The AI Chat is a RAG (Retrieval-Augmented Generation) powered assistant grounded in Tauron's own knowledge base. It can answer questions about market conditions, explain technical indicators, summarise recent news for a given asset, and discuss portfolio strategy — without hallucinating or inventing external data. Conversations are stored per session.",
      },
    ],
  },
  {
    category: "Backtesting & Strategy",
    items: [
      {
        question: "What is the Backtesting module?",
        answer:
          "The Backtesting module lets you replay a trading strategy against historical market data and evaluate its performance. Results include total return, Sharpe ratio, and maximum drawdown, along with a full equity curve chart so you can visualise how the strategy evolved over time.",
      },
      {
        question: "What metrics does the backtest report?",
        answer:
          "Each backtest run reports total return (overall P&L), Sharpe ratio (risk-adjusted return), and maximum drawdown (largest peak-to-trough decline). The trades log is also stored, which powers the equity curve visualisation and allows detailed per-trade inspection.",
      },
    ],
  },
  {
    category: "Account & Watchlist",
    items: [
      {
        question: "What is the Watchlist?",
        answer:
          "The Watchlist lets you save and organise the crypto assets you want to track. You can add any asset from the platform's registry and remove it at any time. The list is tied to your user account and persists across sessions.",
      },
      {
        question: "How do I update my profile or change my password?",
        answer:
          "Go to Settings (accessible from the sidebar footer). The Profile section lets you update your username and email. The Password section allows you to change your password — you'll need to enter your current password to confirm the change.",
      },
      {
        question: "Is my data private?",
        answer:
          "Yes. Your watchlist, chat history, and backtest results are stored against your user account and are not visible to other users. Authentication uses JWT tokens and all API calls are protected by server-side authorization checks.",
      },
    ],
  },
]

// ─── Accordion item ────────────────────────────────────────────────────────────

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="border-b border-border/50 last:border-0 dark:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 py-5 text-left transition-colors hover:text-foreground/80"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-foreground dark:text-white">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-out",
          open ? "max-h-96 pb-5" : "max-h-0",
        )}
      >
        <p className="text-sm leading-relaxed text-muted-foreground dark:text-white/65">
          {answer}
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function meta() {
  return [
    { title: "FAQ — Tauron" },
    { name: "description", content: "Frequently asked questions about Tauron's crypto analytics platform." },
  ]
}

export default function FaqPage() {
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null)

  const displayed = activeCategory
    ? FAQ_CATEGORIES.filter((c) => c.category === activeCategory)
    : FAQ_CATEGORIES

  return (
    <BeamsBackground intensity="medium">
      <div className="relative min-h-screen w-full overflow-x-hidden px-6 pb-24 pt-28">
        <div className="mx-auto max-w-4xl">

          {/* Hero */}
          <div className="mb-14 text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground text-balance dark:text-white md:text-6xl">
              Frequently{" "}
              <LineShadowText className="text-meta-blue" shadowColor="oklch(0.55 0.22 255)">
                Asked
              </LineShadowText>{" "}
              Questions
            </h1>
            <p className="mx-auto max-w-xl text-base text-muted-foreground dark:text-white/65 md:text-lg">
              Everything you need to know about Tauron — from the dashboard and AI
              news feed to backtesting and ML models.
            </p>
          </div>

          {/* Category filter pills */}
          <div className="mb-10 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                activeCategory === null
                  ? "border-meta-blue bg-meta-blue/10 text-meta-blue"
                  : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground dark:border-white/15 dark:text-white/60 dark:hover:text-white",
              )}
            >
              All
            </button>
            {FAQ_CATEGORIES.map((cat) => (
              <button
                key={cat.category}
                type="button"
                onClick={() =>
                  setActiveCategory(
                    activeCategory === cat.category ? null : cat.category,
                  )
                }
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  activeCategory === cat.category
                    ? "border-meta-blue bg-meta-blue/10 text-meta-blue"
                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground dark:border-white/15 dark:text-white/60 dark:hover:text-white",
                )}
              >
                {cat.category}
              </button>
            ))}
          </div>

          {/* FAQ groups */}
          <div className="space-y-10">
            {displayed.map((group) => (
              <div key={group.category}>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground dark:text-white/40">
                  {group.category}
                </h2>
                <div className="rounded-2xl border border-border/60 bg-background/60 px-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  {group.items.map((item) => (
                    <FaqItem
                      key={item.question}
                      question={item.question}
                      answer={item.answer}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 rounded-2xl border border-border/60 bg-muted/40 px-8 py-10 text-center dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-2 text-xl font-semibold text-foreground dark:text-white">
              Still have questions?
            </h3>
            <p className="mb-6 text-sm text-muted-foreground dark:text-white/60">
              Chat directly with our AI assistant — it's trained on Tauron's
              documentation and can answer questions about your account in real time.
            </p>
            <a
              href="/chat"
              className="inline-flex items-center rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
            >
              Open AI Chat
            </a>
          </div>

        </div>
      </div>
    </BeamsBackground>
  )
}
