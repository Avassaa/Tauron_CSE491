"use client"

import * as React from "react"
import { TrendingDown, TrendingUp } from "lucide-react"

import { cn } from "~/lib/utils"

function pctTone(v: number | null): { text: string; Icon: typeof TrendingUp } {
  if (v == null || !Number.isFinite(v)) return { text: "text-muted-foreground", Icon: TrendingUp }
  return v >= 0 ?
      { text: "text-emerald-500 dark:text-emerald-400", Icon: TrendingUp }
    : { text: "text-red-500 dark:text-red-400", Icon: TrendingDown }
}

function MetricTile({
  label,
  value,
}: {
  label: string
  value: number | null
}) {
  const { text, Icon } = pctTone(value)
  const formatted =
    value != null && Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "—"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/20 bg-gradient-to-br from-white/[0.07] to-transparent px-3 py-2.5",
        "shadow-inner backdrop-blur-md dark:border-white/10 dark:from-white/[0.05]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.12),transparent_55%)]" />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <Icon className={cn("size-3.5 shrink-0 opacity-80", text)} aria-hidden />
      </div>
      <div className={cn("relative mt-1 font-mono text-lg font-semibold tabular-nums tracking-tight", text)}>
        {formatted}
      </div>
      <p className="relative mt-1 text-[9px] leading-tight text-muted-foreground/90">Assets grid formula</p>
    </div>
  )
}

export type AssetsGridMetricsPayload = {
  price_change_1h: number | null
  price_change_7d: number | null
  methodology?: string
}

export function AssistantAssetsGridMetrics({
  metrics,
  className,
}: {
  metrics: AssetsGridMetricsPayload
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/90">Grid parity</span>
        <span className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricTile label="1h" value={metrics.price_change_1h} />
        <MetricTile label="7d" value={metrics.price_change_7d} />
      </div>
      {metrics.methodology?.trim() ? (
        <p className="text-[10px] leading-snug text-muted-foreground/90">{metrics.methodology}</p>
      ) : null}
    </div>
  )
}

export function parseAssetsGridMetrics(raw: unknown): AssetsGridMetricsPayload | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null)
  return {
    price_change_1h: n(o.price_change_1h),
    price_change_7d: n(o.price_change_7d),
    methodology: typeof o.methodology === "string" ? o.methodology : undefined,
  }
}
