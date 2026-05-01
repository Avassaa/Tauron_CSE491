"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { Newspaper, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { Button } from "~/components/ui/button"
import { AssetPagination } from "~/components/assets"
import { apiGet, apiPost, type CuratedNewsResponse, type PaginatedResponse } from "~/lib/api-client"

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
        className="flex-1 overflow-y-auto"
        style={{ paddingTop: "var(--market-banner-offset, 0px)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-8">
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
            newsItems.map((item) => (
              <article key={item.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {formatSentiment(item.sentiment_score)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.summary}</p>
              </article>
            ))
          )}

          <AssetPagination page={page} totalPages={totalPages} setPage={setPage} loading={loading} />
        </div>
      </div>
    </DashboardLayout>
  )
}
