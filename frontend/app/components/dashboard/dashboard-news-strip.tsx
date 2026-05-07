"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronRight, Newspaper } from "lucide-react"
import { Link } from "react-router"

import { DATE_FNS_LOCALE } from "~/lib/date-locale"
import { apiGet, type CuratedNewsResponse } from "~/lib/api-client"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"

function getSentimentLabel(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "Neutral"
  if (score > 0.15) return "Bullish"
  if (score < -0.15) return "Bearish"
  return "Neutral"
}

function getSentimentGlow(score: number | null): string {
  if (score == null || !Number.isFinite(score))
    return "dark:bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.10),transparent_65%)] bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.04),transparent_65%)]"
  if (score > 0.15)
    return "dark:bg-[radial-gradient(ellipse_at_top_right,rgba(34,197,94,0.12),transparent_65%)] bg-[radial-gradient(ellipse_at_top_right,rgba(34,197,94,0.04),transparent_65%)]"
  if (score < -0.15)
    return "dark:bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.11),transparent_65%)] bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.04),transparent_65%)]"
  return "dark:bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_65%)] bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.03),transparent_65%)]"
}

function getSentimentBadge(score: number | null): string {
  if (score == null || !Number.isFinite(score))
    return "border border-border/60 bg-muted/60 text-muted-foreground"
  if (score > 0.15)
    return "border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 dark:shadow-[0_0_14px_-6px_rgba(34,197,94,0.45)]"
  if (score < -0.15)
    return "border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 dark:shadow-[0_0_14px_-6px_rgba(239,68,68,0.45)]"
  return "border border-border/60 bg-muted/60 text-muted-foreground"
}

function NewsCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-card/50 p-4 backdrop-blur-xl supports-[backdrop-filter]:bg-card/40">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-3 w-14" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}

function NewsCard({ item }: { item: CuratedNewsResponse }) {
  const dp = item.data_points_used
  const headline =
    typeof dp === "object" && dp !== null && typeof (dp as Record<string, unknown>).title === "string"
      ? (dp as Record<string, unknown>).title as string
      : null

  const dateRaw = item.published_at ?? item.created_at
  const date = new Date(dateRaw)
  const timeAgo = Number.isNaN(date.getTime())
    ? "—"
    : formatDistanceToNow(date, { addSuffix: true, locale: DATE_FNS_LOCALE })

  const summaryText = (item.summary ?? "").replace(/[*_#`]/g, "").trim()
  const truncated = summaryText.length > 140 ? summaryText.slice(0, 140) + "…" : summaryText

  const glowClass = getSentimentGlow(item.sentiment_score)
  const badgeClass = getSentimentBadge(item.sentiment_score)

  return (
    <Link
      to={`/news/${item.id}`}
      className={cn(
        "group relative flex min-h-[160px] cursor-pointer flex-col gap-3 overflow-hidden rounded-3xl p-4",
        "border border-border/50 bg-card/60 backdrop-blur-xl backdrop-saturate-150",
        "supports-[backdrop-filter]:bg-card/45",
        "transition-all duration-300",
        "hover:border-border/80 hover:bg-card/80",
        "hover:shadow-lg hover:shadow-black/8 dark:hover:shadow-black/40",
        "hover:scale-[1.015] active:scale-[0.99]",
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 transition-opacity duration-300 opacity-60 group-hover:opacity-100", glowClass)} />
      <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 ring-1 ring-inset ring-foreground/8 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", badgeClass)}>
            {getSentimentLabel(item.sentiment_score)}
          </span>
          {item.asset_symbol && (
            <span className="rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary">
              {item.asset_symbol}
            </span>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground/60">{timeAgo}</span>
      </div>

      {headline && (
        <p className="relative line-clamp-2 text-sm font-black leading-snug tracking-tight text-foreground transition-colors group-hover:text-foreground/90">
          {headline}
        </p>
      )}

      <p className="relative line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
        {truncated}
      </p>

      <div className="relative mt-auto flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-primary/70 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
        Read more
        <ChevronRight className="size-3" />
      </div>
    </Link>
  )
}

export function DashboardNewsStrip() {
  const [items, setItems] = React.useState<CuratedNewsResponse[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    apiGet<{ items: CuratedNewsResponse[] } | CuratedNewsResponse[]>("/curated-news", { page_size: 5 })
      .then((data) => {
        const all = Array.isArray(data) ? data : (data as { items: CuratedNewsResponse[] }).items ?? []
        if (!cancelled) setItems(all.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-xl border border-border/50 bg-card/60 backdrop-blur-md supports-[backdrop-filter]:bg-card/45">
            <Newspaper className="size-3.5 text-primary" />
          </div>
          <span className="text-sm font-black uppercase tracking-[0.18em] text-foreground/70">
            Latest News
          </span>
        </div>
        <Link
          to="/news"
          className={cn(
            "flex items-center gap-1 rounded-xl px-2.5 py-1.5",
            "border border-primary/25 bg-primary/8 backdrop-blur-md",
            "text-[10px] font-black uppercase tracking-wider text-primary/80",
            "transition-all hover:border-primary/40 hover:bg-primary/15 hover:text-primary",
          )}
        >
          All news
          <ChevronRight className="size-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <NewsCardSkeleton key={i} />)
        ) : items.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-3xl border border-border/40 bg-card/50 py-12 text-center backdrop-blur-xl">
            <Newspaper className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No news available yet.</p>
          </div>
        ) : (
          items.map((item) => <NewsCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}
