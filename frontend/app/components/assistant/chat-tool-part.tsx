"use client"

import * as React from "react"
import { AlertTriangle, Loader2, Newspaper, Wrench } from "lucide-react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"

import {
  AssistantAssetsGridMetrics,
  parseAssetsGridMetrics,
} from "~/components/assistant/assistant-assets-grid-metrics"
import {
  AssistantLiveQuoteStrip,
  parseLiveMarketSnapshot,
} from "~/components/assistant/assistant-live-quote-strip"
import { AssistantMarketChartCard } from "~/components/assistant/assistant-market-chart-card"
import { AssistantRiskGauge } from "~/components/assistant/assistant-risk-gauge"
import {
  AssistantWatchlistsOverview,
  type NamedWatchlistBlock,
  type WatchlistAssetChip,
} from "~/components/assistant/assistant-watchlists-overview"
import { useAssistantToolApproval } from "~/components/assistant/assistant-tool-approval-context"
import { Button } from "~/components/ui/button"
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

function humanToolTitle(raw: string): string {
  return raw.replace(/_/g, " ")
}

function isRiskOverlay(x: unknown): x is { score: number; label: string; rationale: string } {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as { score?: unknown }).score === "number" &&
    typeof (x as { label?: unknown }).label === "string" &&
    typeof (x as { rationale?: unknown }).rationale === "string"
  )
}

function parseWatchlistAssetChip(x: unknown): WatchlistAssetChip | null {
  if (!x || typeof x !== "object") return null
  const o = x as Record<string, unknown>
  if (typeof o.id !== "string" || typeof o.symbol !== "string") return null
  return {
    id: o.id,
    symbol: o.symbol,
    name: typeof o.name === "string" ? o.name : o.symbol,
  }
}

function parseNamedWatchlistBlock(x: unknown): NamedWatchlistBlock | null {
  if (!x || typeof x !== "object") return null
  const o = x as Record<string, unknown>
  if (typeof o.list_id !== "string" || typeof o.name !== "string") return null
  const rawAssets = Array.isArray(o.assets) ? o.assets : []
  const assets = rawAssets.map(parseWatchlistAssetChip).filter(Boolean) as WatchlistAssetChip[]
  return { list_id: o.list_id, name: o.name, assets }
}

function curatedSentimentPhrase(score: unknown): string {
  if (typeof score !== "number" || !Number.isFinite(score)) return "Neutral"
  if (score > 0.15) return "Bullish"
  if (score < -0.15) return "Bearish"
  return "Neutral"
}

function parseStructuredToolOutput(part: AnyMessagePart): Record<string, unknown> | null {
  if (!isToolUIPart(part) || part.state !== "output-available") return null
  let raw: unknown = part.output
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }
  if (!raw || typeof raw !== "object") return null
  return raw as Record<string, unknown>
}

function SdkRuntimeApprovalGate({ approvalId }: { approvalId: string }) {
  const approve = useAssistantToolApproval()
  const [busy, setBusy] = React.useState(false)

  const run = (approved: boolean) => {
    if (!approve) return
    setBusy(true)
    void Promise.resolve(approve({ id: approvalId, approved })).finally(() => setBusy(false))
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] leading-snug text-foreground">
        One more step lets the server emit your signed Confirm/Cancel card for this sensitive action.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="h-8" disabled={busy || !approve} onClick={() => run(true)}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Continue"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={busy || !approve} onClick={() => run(false)}>
          Stop
        </Button>
      </div>
      {!approve ? <p className="text-[10px] text-destructive">Approval bridge unavailable.</p> : null}
    </div>
  )
}

async function postConfirmedAssistantAction(confirmation_token: string): Promise<Record<string, unknown>> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token")?.trim() : ""
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch("/api/assistant/confirm-tool", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      confirmation_token,
      ...(token ? { access_token: token } : {}),
    }),
  })
  let payload: Record<string, unknown> = {}
  try {
    payload = (await res.json()) as Record<string, unknown>
  } catch {
    payload = {}
  }
  if (!res.ok) {
    const msg =
      typeof payload.error === "string" ? payload.error : `Confirmation failed (${res.status}).`
    throw new Error(msg)
  }
  return payload
}

function ConfirmationActions({
  confirmation_token,
  idleMessage,
}: {
  confirmation_token: string
  idleMessage: string
}) {
  const [pending, setPending] = React.useState(false)
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)
  const [declined, setDeclined] = React.useState(false)

  const runConfirm = async () => {
    setPending(true)
    setProblem(null)
    try {
      const payload = await postConfirmedAssistantAction(confirmation_token)
      if (payload.ok === true && typeof payload.message === "string") {
        setDoneMessage(payload.message)
      } else if (typeof payload.message === "string") {
        setDoneMessage(payload.message)
      } else {
        setDoneMessage("Action completed.")
      }
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setPending(false)
    }
  }

  const decline = () => {
    setDeclined(true)
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] leading-snug text-foreground">{idleMessage}</p>
      {problem ? (
        <p className="text-[12px] font-medium text-destructive" role="alert">
          {problem}
        </p>
      ) : null}
      {declined ? (
        <p className="text-[13px] text-muted-foreground">Proposal dismissed — nothing was changed.</p>
      ) : doneMessage ? (
        <p className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">{doneMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="h-8" disabled={pending} onClick={() => void runConfirm()}>
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Confirming…
              </span>
            ) : (
              "Confirm"
            )}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8" disabled={pending} onClick={decline}>
            Cancel
          </Button>
        </div>
      )}
      {!doneMessage && !declined ? (
        <p className="text-[10px] text-muted-foreground">
          Sensitive mutations apply only after Confirm succeeds against your session token.
        </p>
      ) : null}
    </div>
  )
}

export function AssistantChatToolPart({ part }: { part: AnyMessagePart }) {
  if (!isToolUIPart(part)) return null

  const name = getToolName(part)

  if (part.state === "input-streaming" || part.state === "input-available") {
    return toolShell({
      title: humanToolTitle(name),
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
      title: humanToolTitle(name),
      stateLine: (
        <span className="inline-flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-3.5" aria-hidden />
          {part.errorText}
        </span>
      ),
    })
  }

  if (part.state === "approval-requested") {
    const nm = getToolName(part)
    if (nm === "prepare_price_alert" || nm === "prepare_watchlist_change") {
      const approvalObj =
        "approval" in part &&
        part.approval &&
        typeof part.approval === "object" &&
        part.approval !== null &&
        "id" in part.approval &&
        typeof (part.approval as { id: unknown }).id === "string"
          ? (part.approval as { id: string })
          : null
      if (approvalObj?.id) {
        return toolShell({
          title: humanToolTitle(nm),
          children: <SdkRuntimeApprovalGate approvalId={approvalObj.id} />,
        })
      }
    }
  }

  if (part.state === "output-denied") {
    return toolShell({
      title: humanToolTitle(name),
      stateLine: (
        <span className="text-[13px] text-muted-foreground">
          Runtime approval declined—proposal was not generated.
        </span>
      ),
    })
  }

  if (part.state !== "output-available") {
    return toolShell({
      title: humanToolTitle(name),
      stateLine: <span className="text-[11px] capitalize">{part.state.replace(/-/g, " ")}</span>,
    })
  }

  const out = parseStructuredToolOutput(part)

  if (!out) {
    return toolShell({ title: humanToolTitle(name), stateLine: <span className="text-[11px]">Done.</span> })
  }

  if (out.ok === false && typeof out.error === "string") {
    const partialGrid = parseAssetsGridMetrics(out.assets_grid_metrics)
    const partialLive =
      "live_market" in out ? parseLiveMarketSnapshot(out.live_market) : null
    return (
      <div className="space-y-2">
        {partialGrid ? <AssistantAssetsGridMetrics metrics={partialGrid} /> : null}
        {partialLive ? <AssistantLiveQuoteStrip snapshot={partialLive} /> : null}
        {toolShell({
          title: humanToolTitle(name),
          stateLine: (
            <span className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5" aria-hidden />
              {out.error}
            </span>
          ),
        })}
      </div>
    )
  }

  if (out.widget === "market_chart" && Array.isArray(out.closes) && Array.isArray(out.labels)) {
    const closes = out.closes.filter((n): n is number => typeof n === "number")
    const labels = out.labels.filter((s): s is string => typeof s === "string")
    const sym = typeof out.symbol === "string" ? out.symbol : name
    const changePct = typeof out.changePct === "number" ? out.changePct : null
    const resolution = typeof out.resolution === "string" ? out.resolution : undefined
    const riskRaw = out.risk_overlay
    const seriesNote = typeof out.series_note === "string" ? out.series_note : null
    const chartNote = typeof out.chart_changePct_note === "string" ? out.chart_changePct_note : null
    const gridMetrics = parseAssetsGridMetrics(out.assets_grid_metrics)
    const liveSnap = parseLiveMarketSnapshot(out.live_market)
    return (
      <div className="space-y-3">
        {gridMetrics ? <AssistantAssetsGridMetrics metrics={gridMetrics} /> : null}
        {liveSnap ? <AssistantLiveQuoteStrip snapshot={liveSnap} /> : null}
        <AssistantMarketChartCard symbol={sym} closes={closes} labels={labels} changePct={changePct} resolution={resolution} />
        {chartNote ? (
          <p className="text-[10px] leading-snug text-muted-foreground/90">{chartNote}</p>
        ) : null}
        {seriesNote ? (
          <p className="text-[10px] leading-snug text-muted-foreground">{seriesNote}</p>
        ) : null}
        {isRiskOverlay(riskRaw) ? (
          <AssistantRiskGauge score={riskRaw.score} label={riskRaw.label} rationale={riskRaw.rationale} />
        ) : null}
      </div>
    )
  }

  if (out.widget === "asset_quote") {
    const gridMetrics = parseAssetsGridMetrics(out.assets_grid_metrics)
    const liveSnap = parseLiveMarketSnapshot(out.live_market)
    return toolShell({
      title: "Market snapshot",
      children: (
        <div className="space-y-3">
          {gridMetrics ? <AssistantAssetsGridMetrics metrics={gridMetrics} /> : null}
          {liveSnap ? <AssistantLiveQuoteStrip snapshot={liveSnap} /> : null}
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
        </div>
      ),
    })
  }

  if (out.widget === "watchlists_overview" && out.ok === true) {
    const primaryRaw = Array.isArray(out.primary_watchlist) ? out.primary_watchlist : []
    const primary_watchlist = primaryRaw.map(parseWatchlistAssetChip).filter(Boolean) as WatchlistAssetChip[]
    const namedRaw = Array.isArray(out.named_lists) ? out.named_lists : []
    const named_lists = namedRaw.map(parseNamedWatchlistBlock).filter(Boolean) as NamedWatchlistBlock[]
    return (
      <AssistantWatchlistsOverview primary_watchlist={primary_watchlist} named_lists={named_lists} />
    )
  }

  if (out.widget === "news_digest" && typeof out.symbol === "string") {
    const rows = Array.isArray(out.items) ? out.items : []
    const headerNote = typeof out.message === "string" ? out.message : null
    return toolShell({
      title: `Curated news · ${out.symbol}`,
      stateLine: (
        <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <Newspaper className="size-3.5 shrink-0 text-primary" aria-hidden />
          {rows.length} {rows.length === 1 ? "story" : "stories"}
        </span>
      ),
      children:
        rows.length === 0 && headerNote ? (
          <p className="text-[13px] text-muted-foreground">{headerNote}</p>
        ) : (
          <ul className="space-y-3">
            {headerNote ? (
              <li className="text-[12px] italic text-muted-foreground">{headerNote}</li>
            ) : null}
            {rows.map((entry, idx) => {
              if (!entry || typeof entry !== "object") return null
              const r = entry as Record<string, unknown>
              const summary = typeof r.summary === "string" ? r.summary : ""
              const phrase = curatedSentimentPhrase(r.sentiment_score)
              if (!summary.trim()) return null
              return (
                <li key={typeof r.id === "string" ? r.id : `news-${idx}`} className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                      {phrase}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug text-foreground">{summary}</p>
                </li>
              )
            })}
          </ul>
        ),
    })
  }

  if (
    out.widget === "watchlist_confirmation" &&
    typeof out.confirmation_token === "string" &&
    out.confirmation_token.trim().length > 0
  ) {
    const token = out.confirmation_token.trim()
    const idleMsg =
      typeof out.message === "string" && out.message.trim().length > 0
        ? out.message.trim()
        : "Confirm this primary-watchlist change."
    const namedList =
      typeof out.named_list_id === "string" && out.named_list_id.trim().length > 0 ?
        out.named_list_id.trim()
      : null
    return toolShell({
      title: namedList ? "Named watchlist confirmation" : "Watchlist confirmation",
      stateLine:
        namedList ?
          <span className="text-[10px] font-mono text-muted-foreground">List id · {namedList}</span>
        : undefined,
      children: <ConfirmationActions confirmation_token={token} idleMessage={idleMsg} />,
    })
  }

  if (
    out.widget === "price_alert_confirmation" &&
    typeof out.confirmation_token === "string" &&
    out.confirmation_token.trim().length > 0
  ) {
    const token = out.confirmation_token.trim()
    const idleMsg =
      typeof out.message === "string" && out.message.trim().length > 0
        ? out.message.trim()
        : "Confirm this Binance-linked price alert proposal."
    return toolShell({
      title: "Price alert confirmation",
      children: <ConfirmationActions confirmation_token={token} idleMessage={idleMsg} />,
    })
  }

  if (out.widget === "watchlist_update" && typeof out.message === "string") {
    return toolShell({
      title: "Watchlist",
      stateLine: <span className="text-[13px] text-foreground">{out.message}</span>,
    })
  }

  if (out.widget === "price_alert_created" && typeof out.message === "string") {
    return toolShell({
      title: "Price alert",
      stateLine: <span className="text-[13px] text-foreground">{out.message}</span>,
    })
  }

  return toolShell({
    title: humanToolTitle(name),
    children: (
      <pre className="max-h-40 overflow-auto rounded-lg bg-black/40 p-2 font-mono text-[11px] text-zinc-200 dark:bg-black/55">
        {JSON.stringify(out, null, 2)}
      </pre>
    ),
  })
}
