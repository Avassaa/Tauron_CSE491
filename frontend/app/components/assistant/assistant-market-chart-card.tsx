"use client"

import * as React from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "~/lib/utils"

export type MarketChartPayload = {
  symbol: string
  closes: number[]
  labels: string[]
  changePct: number | null
  resolution?: string
}

export function AssistantMarketChartCard({
  symbol,
  closes,
  labels,
  changePct,
  resolution,
  className,
}: MarketChartPayload & { className?: string }) {
  const data = React.useMemo(
    () =>
      labels.map((label, i) => ({
        label,
        close: closes[i] ?? 0,
      })),
    [closes, labels],
  )

  const tone =
    changePct == null ? "text-muted-foreground" : changePct >= 0 ? "text-emerald-400" : "text-red-400"

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/25 bg-gradient-to-b from-primary/10 via-transparent to-transparent p-3 shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)] dark:border-cyan-500/25 dark:shadow-[0_0_28px_-10px_rgba(34,211,238,0.35)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Live series
        </span>
        <span className="font-mono text-sm font-semibold text-foreground">{symbol}</span>
        {resolution ? (
          <span className="rounded-full border border-border/80 px-2 py-0.5 text-[10px] text-muted-foreground">
            {resolution}
          </span>
        ) : null}
      </div>
      <div className={cn("mt-1 font-mono text-xs tabular-nums", tone)}>
        {changePct == null ? "Δ n/a" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% over window`}
      </div>
      <div className="mt-3 h-[132px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.15)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} interval="preserveStartEnd" />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 9, fill: "#94a3b8" }}
              width={42}
              tickFormatter={(v) => (typeof v === "number" ? v.toPrecision(4) : String(v))}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.92)",
                border: "1px solid rgba(56,189,248,0.25)",
                borderRadius: 10,
              }}
              labelStyle={{ color: "#e2e8f0", fontSize: 11 }}
              formatter={(value) => [
                typeof value === "number" ? value.toPrecision(6) : String(value ?? ""),
                "Close",
              ]}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke="url(#tauronChartStroke)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: "#22d3ee" }}
            />
            <defs>
              <linearGradient id="tauronChartStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
