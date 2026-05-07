"use client"

import * as React from "react"
import { Link } from "react-router"
import { Bell, TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "~/lib/utils"
import { apiGet, type PriceAlertResponse } from "~/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card"
import { CardTitleWithTooltip } from "~/components/dashboard/card-title-with-tooltip"
import { AssetIcon } from "~/components/asset-icon"
import { Skeleton } from "~/components/ui/skeleton"
import { DATE_FNS_LOCALE } from "~/lib/date-locale"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"

function formatPrice(price: number): string {
  if (price >= 1000)
    return price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
  if (price >= 1) return `$${price.toFixed(4)}`
  if (price >= 0.0001) return `$${price.toFixed(6)}`
  return `$${price.toExponential(3)}`
}

function AlertRow({ alert }: { alert: PriceAlertResponse }) {
  const isAbove = alert.condition === "above"
  const isTriggered = !!alert.triggered_at
  const isActive = alert.is_active && !isTriggered

  const timeAgo = isTriggered
    ? formatDistanceToNow(new Date(alert.triggered_at!), { addSuffix: true, locale: DATE_FNS_LOCALE })
    : formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: DATE_FNS_LOCALE })

  const progress = (() => {
    if (!alert.last_checked_price || !alert.reference_price || !alert.target_price) return null
    const range = alert.target_price - alert.reference_price
    if (Math.abs(range) < 0.000001) return null
    const current = alert.last_checked_price - alert.reference_price
    return Math.max(0, Math.min(100, (current / range) * 100))
  })()

  return (
    <div className={cn(
      "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
      "hover:bg-muted/50",
      isTriggered && "opacity-60",
    )}>
      {/* Asset icon */}
      <div className="size-8 shrink-0 overflow-hidden rounded-full">
        <AssetIcon symbol={alert.symbol} alt={alert.symbol} fallbackClassName="text-[7px]" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black tracking-tight">{alert.symbol}</span>
          <span className={cn(
            "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
            isAbove
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
          )}>
            {isAbove ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
            {isAbove ? "Above" : "Below"} {formatPrice(alert.target_price)}
          </span>
          {/* Status badge */}
          <span className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
            isTriggered
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : isActive
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}>
            {isTriggered ? "Triggered" : isActive ? "Active" : "Paused"}
          </span>
        </div>

        {/* Progress bar */}
        {progress !== null && isActive && (
          <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isAbove ? "bg-emerald-500" : "bg-rose-500",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/60">
          {alert.last_checked_price && (
            <span>Current: <span className="font-bold text-foreground/70">{formatPrice(alert.last_checked_price)}</span></span>
          )}
          <span className="ml-auto">{timeAgo}</span>
        </div>
      </div>
    </div>
  )
}

function AlertSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="size-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}

export function DashboardAlerts() {
  const [alerts, setAlerts] = React.useState<PriceAlertResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const [selectedSymbol, setSelectedSymbol] = React.useState<string>("all")

  const fetchAlerts = React.useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await apiGet<PriceAlertResponse[]>("/users/me/price-alerts")
      const sorted = [...data].sort((a, b) => {
        const scoreA = a.triggered_at ? 2 : a.is_active ? 1 : 0
        const scoreB = b.triggered_at ? 2 : b.is_active ? 1 : 0
        if (scoreB !== scoreA) return scoreB - scoreA
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      setAlerts(sorted)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void fetchAlerts() }, [fetchAlerts])

  const uniqueSymbols = React.useMemo(
    () => Array.from(new Set(alerts.map((a) => a.symbol))).sort(),
    [alerts],
  )

  const visibleAlerts = selectedSymbol === "all"
    ? alerts
    : alerts.filter((a) => a.symbol === selectedSymbol)

  const triggeredCount = visibleAlerts.filter((a) => !!a.triggered_at).length
  const activeCount = visibleAlerts.filter((a) => a.is_active && !a.triggered_at).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitleWithTooltip tooltip="Your price alerts. Triggered alerts fired when the price crossed your target. Progress bar shows current price relative to target range.">
            Price Alerts
          </CardTitleWithTooltip>
          <div className="flex items-center gap-2">
            {uniqueSymbols.length > 1 && (
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger className="h-7 w-[90px] rounded-xl border-border/50 bg-card/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {uniqueSymbols.map((sym) => (
                    <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <button
              type="button"
              onClick={() => void fetchAlerts()}
              disabled={loading}
              className={cn(
                "flex items-center gap-1 rounded-xl px-2 py-1",
                "border border-border/50 bg-card/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
                "transition-all hover:border-border/70 hover:text-foreground",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            </button>
          </div>
        </div>
        <CardDescription className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <span>Recent price alerts</span>
          {!loading && !error && (
            <span className="flex gap-2 ml-auto normal-case font-normal tracking-normal text-xs">
              {triggeredCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">{triggeredCount} triggered</span>
              )}
              {activeCount > 0 && (
                <span className="text-primary">{activeCount} active</span>
              )}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2">
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, i) => <AlertSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Could not load alerts.
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Bell className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No price alerts yet.</p>
            <Link
              to="/assets"
              className="text-xs text-primary hover:underline underline-offset-2"
            >
              Create your first alert →
            </Link>
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No alerts for {selectedSymbol}.
          </div>
        ) : (
          <div className="max-h-[268px] overflow-y-auto space-y-0.5">
            {visibleAlerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
