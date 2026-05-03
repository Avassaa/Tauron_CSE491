"use client"

import * as React from "react"
import { Activity, BarChart3, Hash, Wallet } from "lucide-react"

import { formatCompact } from "~/lib/currency"
import { cn } from "~/lib/utils"

export type LiveMarketSnapshotUI = {
  last_price_usdt: number | null
  quote_volume_24h_usdt: number | null
  price_change_24h_pct: number | null
  rank_by_liquidity: number | null
  source?: string
}

function pctClass(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "text-muted-foreground"
  return v >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
}

export function parseLiveMarketSnapshot(raw: unknown): LiveMarketSnapshotUI | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null)
  return {
    last_price_usdt: n(o.last_price_usdt),
    quote_volume_24h_usdt: n(o.quote_volume_24h_usdt),
    price_change_24h_pct: n(o.price_change_24h_pct),
    rank_by_liquidity: n(o.rank_by_liquidity),
    source: typeof o.source === "string" ? o.source : undefined,
  }
}

export function AssistantLiveQuoteStrip({
  snapshot,
  className,
}: {
  snapshot: LiveMarketSnapshotUI
  className?: string
}) {
  const vol = snapshot.quote_volume_24h_usdt
  const px = snapshot.last_price_usdt
  const ch24 = snapshot.price_change_24h_pct
  const rk = snapshot.rank_by_liquidity

  const hasAny =
    (vol != null && Number.isFinite(vol)) ||
    (px != null && Number.isFinite(px)) ||
    (ch24 != null && Number.isFinite(ch24)) ||
    (rk != null && Number.isFinite(rk))

  if (!hasAny) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        Live 24h ticker (volume / last / 24h %) unavailable — pair may be missing from Binance feed.
      </p>
    )
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-4",
        "rounded-xl border border-sky-500/15 bg-gradient-to-br from-sky-500/[0.06] to-transparent p-2.5 dark:border-sky-400/10",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <Wallet className="size-3 shrink-0 text-sky-400" aria-hidden />
          Last
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
          {px != null && Number.isFinite(px) ? `$${formatCompact(px)}` : "—"}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <BarChart3 className="size-3 shrink-0 text-sky-400" aria-hidden />
          24h %
        </span>
        <span className={cn("font-mono text-sm font-semibold tabular-nums", pctClass(ch24))}>
          {ch24 != null && Number.isFinite(ch24) ? `${ch24 >= 0 ? "+" : ""}${ch24.toFixed(2)}%` : "—"}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <Activity className="size-3 shrink-0 text-sky-400" aria-hidden />
          24h vol
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground" title="Quote volume (USDT)">
          {vol != null && Number.isFinite(vol) ? `$${formatCompact(vol)}` : "—"}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <Hash className="size-3 shrink-0 text-sky-400" aria-hidden />
          Rank
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
          {rk != null && Number.isFinite(rk) ? `#${Math.round(rk)}` : "—"}
        </span>
      </div>
      <p className="col-span-2 mt-1 text-[9px] leading-tight text-muted-foreground/90 sm:col-span-4">
        Same Binance 24h ticker row as the Assets grid (<span className="font-mono">/assets/live-market</span>).
      </p>
    </div>
  )
}
