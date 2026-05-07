"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"

import { DATE_FNS_LOCALE } from "~/lib/date-locale"
import { Newspaper, RefreshCw, Sparkles } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { Button } from "~/components/ui/button"
import { AssetPagination } from "~/components/assets"
import { glassCardSurface } from "~/components/ui/card"
import { MarkdownContent } from "~/components/ui/markdown-content"
import { apiGet, apiPost, type CuratedNewsResponse, type PaginatedResponse } from "~/lib/api-client"
import { cn } from "~/lib/utils"

type NewsScrapeAcceptedResponse = {
  status: "accepted"
  message: string
}

type NewsFeedQuickInsight = {
  sentiment: string
  impactScore: number
  summary: string
}

function formatSentiment(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "Neutral"
  if (score > 0.15) return "Bullish"
  if (score < -0.15) return "Bearish"
  return "Neutral"
}

function sentimentBadgeClass(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "bg-muted text-muted-foreground"
  if (score > 0.15) {
    return "border border-green-600/25 bg-green-500/12 text-green-600 shadow-[0_0_20px_-12px_rgba(34,197,94,0.28)] dark:border-green-500/30 dark:text-green-400 dark:shadow-[0_0_22px_-10px_rgba(74,222,128,0.22)]"
  }
  if (score < -0.15) {
    return "border border-red-600/25 bg-red-500/12 text-red-600 shadow-[0_0_20px_-12px_rgba(248,113,113,0.22)] dark:text-red-400"
  }
  return "bg-muted text-muted-foreground"
}

export default function NewsPage() {
  const pageSize = 20
  const [newsItems, setNewsItems] = React.useState<CuratedNewsResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [scrapeLoading, setScrapeLoading] = React.useState(false)
  const [curateLoading, setCurateLoading] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)

  const [feedAiInsight, setFeedAiInsight] = React.useState<NewsFeedQuickInsight | null>(null)
  const [feedAiLoading, setFeedAiLoading] = React.useState(false)
  const [feedAiError, setFeedAiError] = React.useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchCuratedNews = React.useCallback(async (targetPage: number) => {
    setError(null)
    try {
      const response = await apiGet<PaginatedResponse<CuratedNewsResponse>>("/curated-news", {
        page: targetPage,
        page_size: pageSize,
      })
      setNewsItems(response.items)
      setTotal(response.total)
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Could not load curated news feed."
      setError(message)
      setNewsItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  React.useEffect(() => {
    void fetchCuratedNews(page)
  }, [fetchCuratedNews, page])

  React.useEffect(() => {
    setFeedAiInsight(null)
    setFeedAiError(null)
  }, [page])

  const handleGetNews = async () => {
    setScrapeLoading(true)
    try {
      const result = await apiPost<NewsScrapeAcceptedResponse>("/news/scrape")
      toast.success(result.message || "News scrape queued.")
      // Worker runs in background; refresh once now and once after a short delay.
      await fetchCuratedNews(page)
      window.setTimeout(() => {
        void fetchCuratedNews(page)
      }, 4000)
    } catch (scrapeError) {
      const message =
        scrapeError instanceof Error ? scrapeError.message : "Could not trigger news scrape."
      toast.error(message)
    } finally {
      setScrapeLoading(false)
    }
  }

  const handleQuickFeedInsight = async () => {
    if (newsItems.length === 0) {
      toast.error("Load news before requesting an AI glance.")
      return
    }
    setFeedAiLoading(true)
    setFeedAiError(null)
    try {
      const stitched = newsItems
        .slice(0, 14)
        .map((item, i) => {
          const dp = item.data_points_used
          const headline =
            typeof dp === "object" && dp && typeof dp.title === "string" ? dp.title : `Story ${i + 1}`
          const summ = (item.summary ?? "").slice(0, 320)
          return `${i + 1}. ${headline}\n${summ}`
        })
        .join("\n\n")
      const token = localStorage.getItem("access_token")?.trim()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch("/api/insights", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({
          mode: "news_feed_quick",
          context: stitched,
        }),
      })
      const json = (await res.json()) as { insight?: NewsFeedQuickInsight; error?: string }
      if (!res.ok) throw new Error(json.error ?? `Insight failed (${res.status}).`)
      if (!json.insight) throw new Error("Malformed insight response.")
      setFeedAiInsight(json.insight)
      toast.success("Feed insight ready.")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate insight."
      setFeedAiError(msg)
      toast.error(msg)
    } finally {
      setFeedAiLoading(false)
    }
  }

  const handleCurateNews = async () => {
    setCurateLoading(true)
    try {
      const result = await apiPost<NewsScrapeAcceptedResponse>("/news/curate")
      toast.success(result.message || "News curation queued.")
      await fetchCuratedNews(page)
      window.setTimeout(() => {
        void fetchCuratedNews(page)
      }, 4000)
    } catch (curateError) {
      const message =
        curateError instanceof Error ? curateError.message : "Could not trigger news curation."
      toast.error(message)
    } finally {
      setCurateLoading(false)
    }
  }

  return (
    <DashboardLayout
      title="News Feed"
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => void handleQuickFeedInsight()}
            disabled={feedAiLoading || newsItems.length === 0 || loading}
          >
            <Sparkles className={`size-4 ${feedAiLoading ? "animate-pulse" : ""}`} />
            {feedAiLoading ? "Analyzing…" : "Quick AI glance"}
          </Button>
          <Button type="button" onClick={handleCurateNews} disabled={curateLoading} className="gap-2" variant="outline">
            <RefreshCw className={`size-4 ${curateLoading ? "animate-spin" : ""}`} />
            {curateLoading ? "Curating..." : "Curate News"}
          </Button>
          <Button type="button" onClick={handleGetNews} disabled={scrapeLoading} className="gap-2">
            <RefreshCw className={`size-4 ${scrapeLoading ? "animate-spin" : ""}`} />
            {scrapeLoading ? "Getting News..." : "Get News"}
          </Button>
        </div>
      }
    >
      <div className="relative flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -left-[9%] top-[12%] h-[min(260px,34vh)] w-[min(340px,40vw)] rounded-full bg-blue-500/12 blur-[115px] dark:bg-blue-400/10" />
          <div className="absolute -right-[9%] top-[20%] h-[min(260px,34vh)] w-[min(340px,40vw)] rounded-full bg-sky-400/12 blur-[115px] dark:bg-sky-500/10" />
        </div>
        <div className="relative z-[1] mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 md:gap-6 md:px-8 md:py-8">
          <div className="rounded-xl border border-border/50 bg-muted/25 p-4 md:p-5">
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <Newspaper className="size-5 text-primary" />
              Curated News
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fresh summaries generated from scraped crypto news.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Showing page {page} of {totalPages} ({total} items)
            </p>
          </div>

          {feedAiError ? (
            <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {feedAiError}
            </div>
          ) : null}

          {feedAiInsight ? (
            <div className="rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-transparent to-fuchsia-500/10 p-4 shadow-[0_0_28px_-14px_rgba(34,211,238,0.35)] md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  AI feed glance
                </span>
                <span className="rounded-full border border-border/70 px-2 py-0.5 font-mono text-xs text-foreground">
                  Impact {feedAiInsight.impactScore}/100
                </span>
              </div>
              <p className="mt-2 text-base font-semibold text-foreground">{feedAiInsight.sentiment}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feedAiInsight.summary}</p>
              <p className="mt-3 text-[10px] italic text-muted-foreground">
                Generated object JSON for UX—informational only, not trading advice.
              </p>
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-xl border p-8 text-sm text-muted-foreground">Loading news...</div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : newsItems.length === 0 ? (
            <div className="rounded-xl border p-8 text-sm text-muted-foreground">
              No curated news yet. Click Get News to trigger scraping and curation.
            </div>
          ) : (
            <div className="flex flex-col gap-4 md:gap-5">
              {newsItems.map((item) => {
                const storyRaw = item.published_at ?? item.created_at
                const storyDate = new Date(storyRaw)
                const dp = item.data_points_used
                const headline =
                  typeof dp === "object" && dp && typeof dp.title === "string" ? dp.title : null
                return (
                  <Link
                    key={item.id}
                    to={`/news/${item.id}`}
                    className={cn(
                      glassCardSurface,
                      "block px-4 py-4 transition-colors hover:bg-background/70 md:px-5",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="relative z-[1] flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-xs font-semibold",
                            sentimentBadgeClass(item.sentiment_score),
                          )}
                        >
                          {formatSentiment(item.sentiment_score)}
                        </span>
                        {item.asset_symbol ? (
                          <span
                            className="rounded-full border border-primary/20 bg-primary/8 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-primary shadow-[0_0_18px_-12px_hsl(var(--primary)/0.28)]"
                            title="Linked asset (see article page for assets link)"
                          >
                            {item.asset_symbol}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Number.isNaN(storyDate.getTime())
                          ? "—"
                          : formatDistanceToNow(storyDate, { addSuffix: true, locale: DATE_FNS_LOCALE })}
                      </span>
                    </div>
                    {headline ? (
                      <h2 className="mt-2 text-sm font-semibold leading-snug text-foreground">{headline}</h2>
                    ) : null}
                    <div className="mt-2 max-h-[5.75rem] overflow-hidden text-ellipsis">
                      <MarkdownContent tone="muted">{item.summary}</MarkdownContent>
                    </div>
                    <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-primary/80">
                      Read full article →
                    </p>
                  </Link>
                )
              })}
            </div>
          )}

          <AssetPagination page={page} totalPages={totalPages} setPage={setPage} loading={loading} />
        </div>
      </div>
    </DashboardLayout>
  )
}
