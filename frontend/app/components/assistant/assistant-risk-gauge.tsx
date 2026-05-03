"use client"

import { cn } from "~/lib/utils"

export type RiskGaugePayload = {
  score: number
  label: string
  rationale: string
}

export function AssistantRiskGauge({ score, label, rationale, className }: RiskGaugePayload & { className?: string }) {
  const clamped = Math.min(100, Math.max(0, score))
  const hue = clamped < 33 ? 165 : clamped < 66 ? 48 : 0

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/15 bg-gradient-to-br from-amber-500/8 via-transparent to-fuchsia-500/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:border-fuchsia-500/20",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Volatility readout
        </span>
        <span className="rounded-full border border-border/70 px-2 py-0.5 font-mono text-[11px] text-foreground">
          {clamped}/100
        </span>
      </div>
      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${clamped}%`,
              background: `linear-gradient(90deg, hsl(${hue},85%,45%), hsl(${Math.min(hue + 40, 320)},90%,58%))`,
              boxShadow: `0 0 18px hsla(${hue},90%,52%,0.35)`,
            }}
          />
        </div>
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{label}</div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{rationale}</p>
      <p className="mt-2 text-[10px] italic text-muted-foreground/90">
        Heuristic over OHLC closes—educational context only, not a formal risk model.
      </p>
    </div>
  )
}
