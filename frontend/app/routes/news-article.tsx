"use client"

import * as React from "react"
import { Link, useParams } from "react-router"
import { ArrowLeft, Newspaper } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

import { DATE_FNS_LOCALE } from "~/lib/date-locale"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { Button } from "~/components/ui/button"
import { Card, CardContent, sentimentScoreToCardRim } from "~/components/ui/card"
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

  const dp = item?.data_points_used as Record<string, unknown> | null | undefined
  const headline = typeof dp?.title === "string" ? dp.title : null
  const sourceOriginalTitle =
    typeof dp?.original_title === "string" ? dp.original_title : null
  const source = typeof dp?.source === "string" ? dp.source : null
  const storyDateStr = item?.published_at ?? item?.created_at
  const storyDate = storyDateStr ? new Date(storyDateStr) : null
  const displayDate = storyDate && !Number.isNaN(storyDate.getTime()) ? storyDate : null
  const glassRim = item ? sentimentScoreToCardRim(item.sentiment_score) : "none"

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
        className="relative flex-1 overflow-y-auto"
        style={{ paddingTop: "var(--market-banner-offset, 0px)" }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -left-[9%] top-[12%] h-[min(260px,34vh)] w-[min(340px,40vw)] rounded-full bg-blue-500/12 blur-[115px] dark:bg-blue-400/10" />
          <div className="absolute -right-[9%] top-[20%] h-[min(260px,34vh)] w-[min(340px,40vw)] rounded-full bg-sky-400/12 blur-[115px] dark:bg-sky-500/10" />
        </div>
        <div className="relative z-[1] mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 md:p-8">
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

              {headline ? (
                <h1 className="text-2xl font-semibold tracking-tight">{headline}</h1>
              ) : (
                <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <Newspaper className="size-7 text-primary" />
                  Curated summary
                </h1>
              )}
              {sourceOriginalTitle ? (
                <p className="text-sm text-muted-foreground">
                  Original headline: {sourceOriginalTitle}
                </p>
              ) : null}

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
                      {format(displayDate, "MMM d, yyyy · HH:mm", { locale: DATE_FNS_LOCALE })}
                    </time>
                    <span className="ml-1">
                      ({formatDistanceToNow(displayDate, { addSuffix: true, locale: DATE_FNS_LOCALE })})
                    </span>
                  </span>
                ) : null}
              </div>

              {item.article_content ? (
                <Card rim={glassRim} surface="plain" className="gap-0 py-0">
                  <CardContent className="space-y-4 py-6">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      Full article
                    </h2>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{item.article_content}</p>
                  </CardContent>
                </Card>
              ) : (
                <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Full source article text is not stored for this item (older or manually created entries may omit it).
                </p>
              )}

              <Card rim={glassRim} surface="plain" className="gap-0 py-0">
                <CardContent className="space-y-4 py-6">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Curated summary
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{item.summary}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
