"use client"

import * as React from "react"
import { AlertTriangle, Loader2, Wrench } from "lucide-react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"

import { AssistantMarketChartCard } from "~/components/assistant/assistant-market-chart-card"
import { AssistantRiskGauge } from "~/components/assistant/assistant-risk-gauge"
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

  if (part.state !== "output-available") {
    return toolShell({
      title: humanToolTitle(name),
      stateLine: <span className="text-[11px] capitalize">{part.state.replace(/-/g, " ")}</span>,
    })
  }

  const out = part.output as Record<string, unknown> | null | undefined

  if (!out || typeof out !== "object") {
    return toolShell({ title: humanToolTitle(name), stateLine: <span className="text-[11px]">Done.</span> })
  }

  if (out.ok === false && typeof out.error === "string") {
    return toolShell({
      title: humanToolTitle(name),
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
    const riskRaw = out.risk_overlay
    const seriesNote = typeof out.series_note === "string" ? out.series_note : null
    return (
      <div className="space-y-3">
        <AssistantMarketChartCard symbol={sym} closes={closes} labels={labels} changePct={changePct} resolution={resolution} />
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
    return toolShell({
      title: "Market snapshot",
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

  if (
    out.widget === "watchlist_confirmation" &&
    typeof out.confirmation_token === "string" &&
    typeof out.message === "string"
  ) {
    return toolShell({
      title: "Watchlist confirmation",
      children: <ConfirmationActions confirmation_token={out.confirmation_token} idleMessage={out.message} />,
    })
  }

  if (
    out.widget === "price_alert_confirmation" &&
    typeof out.confirmation_token === "string" &&
    typeof out.message === "string"
  ) {
    return toolShell({
      title: "Price alert confirmation",
      children: <ConfirmationActions confirmation_token={out.confirmation_token} idleMessage={out.message} />,
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
