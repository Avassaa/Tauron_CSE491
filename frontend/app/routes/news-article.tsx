"use client"

import * as React from "react"
import { Link, useParams } from "react-router"
import { ArrowLeft, Newspaper } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { Button } from "~/components/ui/button"
import { apiGet, type CuratedNewsResponse } from "~/lib/api-client"
import { cn } from "~/lib/utils"

function sentimentLabel(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "Neutral"
  if (score > 0.15) return "Bullish"
  if (score < -0.15) return "Bearish"
  return "Neutral"
}

function sentimentClass(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "text-muted-foreground border-muted"
  if (score > 0.15) return "text-green-600 dark:text-green-400 border-green-600/40 bg-green-500/10"
  if (score < -0.15) return "text-red-600 dark:text-red-400 border-red-600/40 bg-red-500/10"
  return "text-muted-foreground border-muted"
}

export default function CuratedNewsDetailPage() {
  const { newsId } = useParams()
  const [item, setItem] = React.useState<CuratedNewsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!newsId) {
      setLoading(false)
      setError("Missing article id.")
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const row = await apiGet<CuratedNewsResponse>(`/curated-news/${newsId}`)
        if (!cancelled) setItem(row)
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Could not load article.")
          setItem(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [newsId])

  const dp = item?.data_points_used
  const originalTitle = typeof dp?.title === "string" ? dp.title : null
  const source = typeof dp?.source === "string" ? dp.source : null
  const storyDateStr = item?.published_at ?? item?.created_at
  const storyDate = storyDateStr ? new Date(storyDateStr) : null
  const displayDate = storyDate && !Number.isNaN(storyDate.getTime()) ? storyDate : null

  return (
    <DashboardLayout
      title="News article"
      actions={
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/news" className="gap-2">
            <ArrowLeft className="size-4" />
            Back to feed
          </Link>
        </Button>
      }
    >
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingTop: "var(--market-banner-offset, 0px)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
          {loading ? (
            <div className="rounded-xl border p-8 text-sm text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : !item ? (
            <div className="text-sm text-muted-foreground">No data.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide",
                    sentimentClass(item.sentiment_score),
                  )}
                >
                  {sentimentLabel(item.sentiment_score)}
                </span>
                {item.asset_symbol ? (
                  <Link
                    to="/assets"
                    className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary hover:bg-primary/20"
                    title="View assets (search for this symbol)"
                  >
                    {item.asset_symbol}
                  </Link>
                ) : null}
              </div>

              {originalTitle ? (
                <h1 className="text-2xl font-semibold tracking-tight">{originalTitle}</h1>
              ) : (
                <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <Newspaper className="size-7 text-primary" />
                  Curated summary
                </h1>
              )}

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {source ? (
                  <span>
                    Source: <span className="font-medium text-foreground">{source}</span>
                  </span>
                ) : null}
                {displayDate ? (
                  <span>
                    Published:{" "}
                    <time dateTime={displayDate.toISOString()} className="font-medium text-foreground">
                      {format(displayDate, "MMM d, yyyy · HH:mm")}
                    </time>
                    <span className="ml-1">({formatDistanceToNow(displayDate, { addSuffix: true })})</span>
                  </span>
                ) : null}
              </div>

              <article className="rounded-xl border bg-card/50 p-6">
                <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{item.summary}</p>
              </article>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
