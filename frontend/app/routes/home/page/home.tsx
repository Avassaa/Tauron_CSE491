import type { Route } from "./+types/home";
import { Link } from "react-router";
import {
  ArrowRight,
  Globe,
  Cpu,
  Zap,
  MessageSquare,
} from "lucide-react";

import { BeamsBackground } from "~/components/landing/beams-background";
import AnimatedBeamMultipleOutputDemo from "~/routes/home/components/animated-beam-multiple-outputs";
import { LineShadowText } from "~/routes/home/components/line-shadow-text";
import { cn } from "~/lib/utils";

// ─── Data ─────────────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  { label: "BTC/USDT", price: "67,842.30", change: +2.14, up: true },
  { label: "ETH/USDT", price: "3,521.18", change: +1.87, up: true },
  { label: "SOL/USDT", price: "178.44", change: -0.63, up: false },
  { label: "BNB/USDT", price: "594.20", change: +0.92, up: true },
  { label: "XRP/USDT", price: "0.6218", change: -1.21, up: false },
  { label: "DOGE/USDT", price: "0.1632", change: +3.40, up: true },
  { label: "ADA/USDT", price: "0.4871", change: -0.44, up: false },
  { label: "AVAX/USDT", price: "38.92", change: +1.55, up: true },
];

const steps = [
  {
    number: "01",
    icon: <Globe className="size-5 text-sky-400" />,
    color: "sky",
    title: "Aggregate",
    desc: "10+ news sources and live exchange APIs feed continuously into our time-series database.",
  },
  {
    number: "02",
    icon: <Cpu className="size-5 text-violet-400" />,
    color: "violet",
    title: "Analyse",
    desc: "NLP and LLM models extract sentiment; LSTM, GRU, and XGBoost generate price forecasts.",
  },
  {
    number: "03",
    icon: <Zap className="size-5 text-emerald-400" />,
    color: "emerald",
    title: "Act",
    desc: "Dashboard, AI chat, backtesting — all the tools you need to make informed decisions.",
  },
];

const chartData = [
  { date: new Date(Date.now() - 14 * 86400000), revenue: 12000, costs: 9200 },
  { date: new Date(Date.now() - 12 * 86400000), revenue: 13500, costs: 10100 },
  { date: new Date(Date.now() - 10 * 86400000), revenue: 15200, costs: 11800 },
  { date: new Date(Date.now() - 8 * 86400000), revenue: 17500, costs: 13200 },
  { date: new Date(Date.now() - 6 * 86400000), revenue: 18500, costs: 13800 },
  { date: new Date(Date.now() - 4 * 86400000), revenue: 20500, costs: 14800 },
  { date: new Date(Date.now() - 2 * 86400000), revenue: 21000, costs: 15200 },
  { date: new Date(), revenue: 24000, costs: 17400 },
];

const chatMessages = [
  { role: "user", msg: "What's the sentiment for BTC right now?" },
  {
    role: "ai",
    msg: "BTC sentiment is +0.74 (strongly bullish). Key drivers: spot ETF inflows and strong macro data. No major bearish signals.",
  },
  { role: "user", msg: "Should I adjust my stop-loss?" },
  {
    role: "ai",
    msg: "Your backtest shows −11% drawdown in similar macro conditions. Consider tightening to 8% before adding exposure.",
  },
];

// ─── Meta ─────────────────────────────────────────────────────────────────────

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Tauron — AI-Powered Crypto Intelligence" },
    {
      name: "description",
      content:
        "Real-time market data, AI news synthesis, ML price forecasting, and strategy backtesting in one unified platform.",
    },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <BeamsBackground intensity="strong">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen w-full flex-col items-center justify-center px-6 pb-0">

        <div className="flex w-full max-w-5xl flex-col items-center text-center">

          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-1 rounded-full border border-white/[0.14] bg-white/[0.04] px-4 py-1.5 text-sm">
            <span className="text-white/40">New feature release!</span>
            <Link to="/login" className="flex items-center gap-1 font-semibold text-white/90 hover:text-white transition-colors">
              Check out our AI Assistant <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {/* Heading */}
          <h1 className="text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold leading-[1.06] tracking-tight text-white">
            Transform Your Business with AI-Powered Solutions
          </h1>

          {/* Subtext */}
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/50">
            Tauron turns raw market noise into actionable intelligence —
            AI news synthesis, ML forecasts, and strategy backtesting in one place.
          </p>

          {/* Buttons */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-neutral-200 active:scale-[0.98]"
            >
              Start for free
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/55 transition-colors hover:text-white"
            >
              Explore features <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        {/* Hero bottom fade */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-background dark:to-neutral-950" />
      </section>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="relative w-full overflow-x-hidden px-6 pb-24 pt-24">
        <div className="mx-auto max-w-7xl space-y-28">

          {/* ── How it works ────────────────────────────────────── */}
          <section>
            <div className="mb-12 text-center">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground/40 dark:text-white/25">
                How it works
              </p>
              <h2 className="text-3xl font-black tracking-tight text-foreground dark:text-white md:text-5xl">
                Three steps to{" "}
                <LineShadowText className="text-meta-blue" shadowColor="oklch(0.55 0.22 255)">
                  clarity.
                </LineShadowText>
              </h2>
            </div>

            <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="absolute top-8 left-[calc(16.5%+1.5rem)] right-[calc(16.5%+1.5rem)] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent dark:via-white/10 md:block" />
              {steps.map((s) => (
                <div key={s.number} className="relative flex flex-col items-center gap-4 text-center">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card dark:border-white/8 dark:bg-neutral-900">
                    {s.icon}
                    <span className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-meta-blue text-[9px] font-black text-white">
                      {s.number.slice(1)}
                    </span>
                  </div>
                  <div>
                    <h3 className="mb-1.5 text-base font-black tracking-tight text-foreground dark:text-white">
                      {s.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground dark:text-white/50">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── AI + News — 2 column ────────────────────────────── */}
          <section>
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-black tracking-tight text-foreground dark:text-white md:text-5xl">
                Intelligence at{" "}
                <LineShadowText className="text-meta-blue" shadowColor="oklch(0.55 0.22 255)">
                  your fingertips.
                </LineShadowText>
              </h2>
              <p className="mt-4 text-base text-muted-foreground dark:text-white/50">
                Ask the AI assistant anything, or let the live news feed do the work.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              {/* Chat — wider */}
              <div className="relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-border bg-card/60 px-6 pt-6 pb-0 backdrop-blur-md dark:border-white/8 dark:bg-white/[0.02] lg:col-span-3">
                <div className="mb-1 flex items-center gap-2">
                  <MessageSquare className="size-4 text-meta-blue" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground dark:text-white/40">
                    AI Assistant
                  </span>
                </div>
                {chatMessages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[88%] rounded-2xl px-4 py-3 text-sm",
                      m.role === "user"
                        ? "ml-auto rounded-br-sm bg-meta-blue/20 text-foreground dark:text-white/90"
                        : "rounded-bl-sm border border-border bg-background/60 dark:border-white/8 dark:bg-white/[0.04] dark:text-white/80",
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
                <div className="pointer-events-none absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-meta-blue/6 blur-3xl" />
              </div>

              {/* News feed */}
              <div className="flex flex-col gap-3 lg:col-span-2">
                <div className="space-y-3 [mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%)]">
                  {[
                    {
                      tag: "BTC", score: 0.74,
                      headline: "Spot ETF inflows hit record high as institutional demand surges",
                      summary: "Bitcoin ETF products recorded their largest single-day inflow since launch, driven by major asset managers adding exposure ahead of the next halving cycle.",
                      ago: "3m ago",
                    },
                    {
                      tag: "ETH", score: 0.68,
                      headline: "Layer-2 activity drives bullish momentum ahead of upgrade",
                      summary: "On-chain data shows transaction volumes on Ethereum L2 networks surpassing mainnet for the first time, signalling growing ecosystem maturity.",
                      ago: "18m ago",
                    },
                    {
                      tag: "SOL", score: -0.21,
                      headline: "Network congestion raises concerns among validators",
                      summary: "Several Solana validators reported elevated block times during peak hours, prompting calls for protocol-level improvements in the upcoming release.",
                      ago: "41m ago",
                    },
                    {
                      tag: "BNB", score: 0.51,
                      headline: "Exchange volumes rebound as macro sentiment improves",
                      summary: "BNB Chain decentralised exchange volumes climbed 22% week-over-week as broader risk appetite returned following positive US inflation data.",
                      ago: "1h ago",
                    },
                  ].map((item, i) => {
                    const isUp = item.score > 0.15
                    const isDown = item.score < -0.15
                    const label = isUp ? "Bullish" : isDown ? "Bearish" : "Neutral"
                    const badgeClass = isUp
                      ? "border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 dark:shadow-[0_0_14px_-6px_rgba(34,197,94,0.45)]"
                      : isDown
                        ? "border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 dark:shadow-[0_0_14px_-6px_rgba(239,68,68,0.45)]"
                        : "border border-border/60 bg-muted/60 text-muted-foreground"
                    const glowClass = isUp
                      ? "dark:bg-[radial-gradient(ellipse_at_top_right,rgba(34,197,94,0.12),transparent_65%)]"
                      : isDown
                        ? "dark:bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.11),transparent_65%)]"
                        : "dark:bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_65%)]"
                    return (
                      <div
                        key={i}
                        className="group relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-3xl border border-border/50 bg-card/60 p-4 backdrop-blur-xl transition-all duration-300 hover:border-border/80 hover:bg-card/80 hover:scale-[1.015]"
                      >
                        <div className={cn("pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-100", glowClass)} />
                        <div className="relative flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", badgeClass)}>
                              {label}
                            </span>
                            <span className="rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary">
                              {item.tag}
                            </span>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground/60">{item.ago}</span>
                        </div>
                        <p className="relative line-clamp-2 text-xs font-black leading-snug tracking-tight text-foreground">
                          {item.headline}
                        </p>
                        <p className="relative line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {item.summary}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* ── Data pipeline ───────────────────────────────────── */}
          <section className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#08080f]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-meta-blue/40 to-transparent" />
              <AnimatedBeamMultipleOutputDemo className="h-[300px] w-full border-none rounded-none" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/25 to-transparent" />
            </div>
            <div className="space-y-5">
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-sky-400">
                  Data Pipeline
                </p>
                <h2 className="text-3xl font-black leading-tight tracking-tight text-foreground dark:text-white md:text-4xl">
                  Everything flows{" "}
                  <span className="font-light text-meta-blue">into one signal.</span>
                </h2>
              </div>
              <p className="text-base leading-relaxed text-muted-foreground dark:text-white/60">
                News scrapers, exchange APIs, NLP models, and LLMs all connect
                into one unified pipeline — you see the output, not the complexity.
              </p>
              <Link
                to="/features"
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-bold text-foreground/70 transition-all hover:text-foreground dark:border-white/10 dark:text-white/50 dark:hover:text-white"
              >
                See how it's built <ArrowRight className="size-4" />
              </Link>
            </div>
          </section>

          {/* ── CTA ─────────────────────────────────────────────── */}
          <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] dark:bg-white/[0.02]">
            {/* Top accent */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-meta-blue/30 to-transparent" />

            {/* Soft radial glow — dimmed */}
            <div className="pointer-events-none absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-meta-blue/6 blur-3xl" />

            <div className="relative px-8 py-12 text-center">
              <h2 className="mb-4 text-3xl font-black tracking-tight text-foreground dark:text-white md:text-4xl">
                Ready to trade smarter?
              </h2>
              <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-muted-foreground dark:text-white/40">
                Create a free account and get immediate access to the full
                Tauron platform — no credit card required.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/register"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  Get started free
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-bold text-foreground/60 transition-all hover:text-foreground dark:border-white/10 dark:text-white/40 dark:hover:text-white/80"
                >
                  View pricing
                </Link>
              </div>

              {/* Social proof strip */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                {[
                  { value: "10+", label: "News sources" },
                  { value: "3", label: "ML models" },
                  { value: "∞", label: "Backtests" },
                  { value: "Free", label: "To start" },
                ].map((s, i, arr) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-xs font-black text-foreground/60 dark:text-white/50">{s.value}</span>
                    <span className="text-xs text-muted-foreground dark:text-white/25">{s.label}</span>
                    {i < arr.length - 1 && <span className="ml-2 h-3 w-px bg-border dark:bg-white/10" />}
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>
    </BeamsBackground>
  );
}
