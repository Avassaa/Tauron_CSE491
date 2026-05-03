"use client"

import * as React from "react"
import { AlertTriangle, Loader2, Wrench } from "lucide-react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"

import { AssistantMarketChartCard } from "~/components/assistant/assistant-market-chart-card"
import { cn } from "~/lib/utils"

function toolShell({
  title,
  children,
  stateLine,
}: {
  title: string
  children?: React.ReactNode
  stateLine?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-muted/25 px-3 py-2 text-xs text-muted-foreground",
        "shadow-inner shadow-black/10 dark:border-white/10 dark:bg-black/25",
      )}
    >
      <div className="flex items-center gap-2 font-semibold uppercase tracking-wide text-foreground">
        <Wrench className="size-3.5 shrink-0 text-primary" aria-hidden />
        {title}
      </div>
      {stateLine ? <div className="mt-2">{stateLine}</div> : null}
      {children ? <div className="mt-2 space-y-2">{children}</div> : null}
    </div>
  )
}

type AnyMessagePart = NonNullable<UIMessage["parts"]>[number]

export function AssistantChatToolPart({ part }: { part: AnyMessagePart }) {
  if (!isToolUIPart(part)) return null

  const name = getToolName(part)

  if (part.state === "input-streaming" || part.state === "input-available") {
    return toolShell({
      title: name.replace(/_/g, " "),
      stateLine: (
        <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Calling tool…
        </span>
      ),
    })
  }

  if (part.state === "output-error") {
    return toolShell({
      title: name.replace(/_/g, " "),
      stateLine: (
        <span className="inline-flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-3.5" aria-hidden />
          {part.errorText}
        </span>
      ),
    })
  }

  if (part.state !== "output-available") {
    return toolShell({
      title: name.replace(/_/g, " "),
      stateLine: <span className="text-[11px] capitalize">{part.state.replace(/-/g, " ")}</span>,
    })
  }

  const out = part.output as Record<string, unknown> | null | undefined

  if (!out || typeof out !== "object") {
    return toolShell({ title: name.replace(/_/g, " "), stateLine: <span className="text-[11px]">Done.</span> })
  }

  if (out.ok === false && typeof out.error === "string") {
    return toolShell({
      title: name.replace(/_/g, " "),
      stateLine: (
        <span className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3.5" aria-hidden />
          {out.error}
        </span>
      ),
    })
  }

  if (out.widget === "market_chart" && Array.isArray(out.closes) && Array.isArray(out.labels)) {
    const closes = out.closes.filter((n): n is number => typeof n === "number")
    const labels = out.labels.filter((s): s is string => typeof s === "string")
    const sym = typeof out.symbol === "string" ? out.symbol : name
    const changePct = typeof out.changePct === "number" ? out.changePct : null
    const resolution = typeof out.resolution === "string" ? out.resolution : undefined
    return (
      <AssistantMarketChartCard symbol={sym} closes={closes} labels={labels} changePct={changePct} resolution={resolution} />
    )
  }

  if (out.widget === "asset_quote") {
    return toolShell({
      title: "Asset lookup",
      children: (
        <dl className="grid gap-1 text-[13px] text-foreground">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Symbol</dt>
            <dd className="font-mono">{String(out.symbol ?? "")}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{String(out.name ?? "")}</dd>
          </div>
          {typeof out.hint === "string" ? (
            <p className="mt-1 border-t border-border/60 pt-2 text-[11px] leading-snug text-muted-foreground">{out.hint}</p>
          ) : null}
        </dl>
      ),
    })
  }

  if (out.widget === "watchlist_update" && typeof out.message === "string") {
    return toolShell({
      title: "Watchlist",
      stateLine: <span className="text-[13px] text-foreground">{out.message}</span>,
    })
  }

  return toolShell({
    title: name.replace(/_/g, " "),
    children: (
      <pre className="max-h-40 overflow-auto rounded-lg bg-black/40 p-2 font-mono text-[11px] text-zinc-200 dark:bg-black/55">
        {JSON.stringify(out, null, 2)}
      </pre>
    ),
  })
}
