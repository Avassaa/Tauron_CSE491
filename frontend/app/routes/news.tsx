"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"

import { DATE_FNS_LOCALE } from "~/lib/date-locale"
import { Newspaper, RefreshCw } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { Button } from "~/components/ui/button"
import { AssetPagination } from "~/components/assets"
import { apiGet, apiPost, type CuratedNewsResponse, type PaginatedResponse } from "~/lib/api-client"
import { cn } from "~/lib/utils"

type NewsScrapeAcceptedResponse = {
  status: "accepted"
  message: string
}

function formatSentiment(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "Neutral"
  if (score > 0.15) return "Bullish"
  if (score < -0.15) return "Bearish"
  return "Neutral"
}

function sentimentBadgeClass(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "bg-muted text-muted-foreground"
  if (score > 0.15) return "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-600/30"
  if (score < -0.15) return "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-600/30"
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
      <div
        className="relative flex-1 overflow-y-auto"
        style={{ paddingTop: "var(--market-banner-offset, 0px)" }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -left-[9%] top-[12%] h-[min(260px,34vh)] w-[min(340px,40vw)] rounded-full bg-blue-500/22 blur-[115px] dark:bg-blue-400/18" />
          <div className="absolute -right-[9%] top-[20%] h-[min(260px,34vh)] w-[min(340px,40vw)] rounded-full bg-sky-400/22 blur-[115px] dark:bg-sky-500/18" />
        </div>
        <div className="relative z-[1] mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-8">
          <div className="rounded-xl border bg-muted/20 p-4">
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
            newsItems.map((item) => {
              const storyRaw = item.published_at ?? item.created_at
              const storyDate = new Date(storyRaw)
              const dp = item.data_points_used
              const headline =
                typeof dp === "object" && dp && typeof dp.title === "string" ? dp.title : null
              return (
                <Link
                  key={item.id}
                  to={`/news/${item.id}`}
                  className="block rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-md transition-colors supports-[backdrop-filter]:bg-card/40 hover:border-primary/30 hover:bg-card/65"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
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
                          className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-primary"
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
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {item.summary}
                  </p>
                  <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-primary/80">
                    Read full article →
                  </p>
                </Link>
              )
            })
          )}

          <AssetPagination page={page} totalPages={totalPages} setPage={setPage} loading={loading} />
        </div>
      </div>
    </DashboardLayout>
  )
}
