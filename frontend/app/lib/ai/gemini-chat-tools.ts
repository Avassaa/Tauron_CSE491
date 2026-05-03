import { tool } from "ai"
import { z } from "zod"

import { computeAssetsGridStyleMetrics } from "~/lib/ai/gemini-binance-grid-metrics.server"
import { resolveMarketSeriesForAssistant } from "~/lib/ai/gemini-chat-market-series.server"
import { fetchLiveMarketSnapshot } from "~/lib/ai/gemini-live-market-snapshot.server"
import {
  createExpiry,
  signAssistantConfirmation,
} from "~/lib/ai/assistant-tool-token.server"
import { internalJsonFetch } from "~/lib/ai/gemini-internal-api"

type Paginated<T> = {
  items: T[]
  total?: number
}

type AssetRow = {
  id: string
  symbol: string
  name: string
}

type WatchlistListRow = {
  id: string
  name: string
}

function slimAsset(a: AssetRow): { id: string; symbol: string; name: string } {
  return { id: a.id, symbol: a.symbol, name: a.name }
}

type CuratedNewsRow = {
  id: string
  asset_id?: string | null
  asset_symbol?: string | null
  summary: string
  sentiment_score: number | null
  published_at: string | null
}

function authRequired() {
  return { ok: false as const, error: "Authentication required for this action." }
}

async function findAssetsBySymbol(symbol: string, authHeader: string | null) {
  const sym = symbol.trim().toUpperCase()
  const qs = new URLSearchParams({
    search: sym,
    page_size: "15",
    page: "1",
  })
  const res = await internalJsonFetch<Paginated<AssetRow>>(`/assets?${qs}`, {
    authHeader,
    method: "GET",
  })
  if (!res.ok || !res.data?.items?.length) {
    return {
      found: [] as AssetRow[],
      status: res.status,
      detail: !authHeader ? "Missing credentials." : `Upstream assets lookup failed (${res.status}).`,
    }
  }
  const exact = res.data.items.filter((a) => a.symbol.toUpperCase() === sym)
  const ranked = exact.length > 0 ? exact : res.data.items
  return { found: ranked, status: res.status, detail: undefined as string | undefined }
}

function riskOverlayFromCloses(closes: number[]): {
  score: number
  label: string
  rationale: string
} | null {
  if (closes.length < 10) return null
  const rets: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]
    const cur = closes[i]
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev === 0) continue
    rets.push(Math.log(cur / prev))
  }
  if (rets.length < 8) return null
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length
  const sigma = Math.sqrt(variance)
  const raw = sigma * Math.sqrt(Math.min(rets.length, 168))
  const score = Math.min(100, Math.max(5, Math.round(raw * 520)))
  let label: string
  let rationale: string
  if (score < 28) {
    label = "Low turbulence"
    rationale = "Recent closes show relatively stable step-to-step behaviour in this window."
  } else if (score < 52) {
    label = "Moderate variability"
    rationale = "Typical oscillation for intraday crypto series—size positions with ordinary caution."
  } else if (score < 72) {
    label = "Elevated swings"
    rationale = "Log-return dispersion is high; widen invalidation buffers and reduce leverage assumptions."
  } else {
    label = "High volatility"
    rationale = "Large swings versus earlier closes—treat sizing and stops conservatively."
  }
  return { score, label, rationale }
}

export function createTauronFinanceTools(ctx: { authHeader: string | null }) {
  const { authHeader } = ctx

  return {
    get_user_watchlists: tool({
      description:
        "List the user's primary watchlist and all named watchlists with the assets in each. Call when the user asks what's on their watchlist, which lists exist, or before changing membership.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!authHeader) return authRequired()

        const [primaryRes, listsRes] = await Promise.all([
          internalJsonFetch<Array<{ asset: AssetRow }>>(`/users/me/watchlist`, { authHeader, method: "GET" }),
          internalJsonFetch<WatchlistListRow[]>(`/users/me/watchlists`, { authHeader, method: "GET" }),
        ])

        if (!primaryRes.ok) {
          return {
            ok: false as const,
            error: `Primary watchlist unavailable (${primaryRes.status}).`,
          }
        }
        if (!listsRes.ok) {
          return {
            ok: false as const,
            error: `Named watchlists unavailable (${listsRes.status}).`,
          }
        }

        const primaryAssets = (primaryRes.data ?? []).map((e) => slimAsset(e.asset))

        const named_lists: Array<{ list_id: string; name: string; assets: ReturnType<typeof slimAsset>[] }> = []
        const lists = listsRes.data ?? []
        await Promise.all(
          lists.map(async (list) => {
            const assetsRes = await internalJsonFetch<Array<{ asset: AssetRow }>>(
              `/users/me/watchlists/${list.id}/assets`,
              { authHeader, method: "GET" },
            )
            const assets = assetsRes.ok ? (assetsRes.data ?? []).map((e) => slimAsset(e.asset)) : []
            named_lists.push({
              list_id: list.id,
              name: list.name,
              assets,
            })
          }),
        )

        return {
          ok: true as const,
          widget: "watchlists_overview" as const,
          primary_watchlist: primaryAssets,
          named_lists,
        }
      },
    }),

    get_market_data: tool({
      description:
        "Resolve a tracked crypto asset by ticker. Returns assets_grid_metrics (1h/7d % like the Assets grid), live_market when authenticated (Binance 24h last price, quote volume, 24h % — same /assets/live-market feed as the UI), and optional OHLC charts. You must set include_chart true to return a plottable series (market_chart); otherwise the client only shows the quote card (asset_quote) with no graph. For should-I-buy / hold / add questions, prefer include_chart true and include_risk true together, and also call get_curated_news_digest for the same symbol.",
      inputSchema: z.object({
        symbol: z.string().describe("Base ticker without quote, e.g. BTC or SOL."),
        include_chart: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Set true whenever the user wants a visible chart/graph (English or Turkish: grafik, çiz, görsel, saatlik seri). False returns quote numbers only — no chart widget.",
          ),
        include_risk: z.boolean().optional().default(false).describe("When true (usually with chart), add heuristic risk bands."),
        lookbackHours: z.number().min(1).max(720).optional().default(168),
        resolution: z.enum(["1h", "4h", "1d"]).optional().default("1h"),
      }),
      execute: async ({ symbol, include_chart, include_risk, lookbackHours, resolution }) => {
        if (!authHeader) return authRequired()
        const { found, detail } = await findAssetsBySymbol(symbol, authHeader)
        if (!found.length) {
          return {
            ok: false as const,
            symbol: symbol.trim().toUpperCase(),
            error: detail ?? "Asset not found.",
          }
        }
        const asset = found[0]
        const [assets_grid_metrics, live_market] = await Promise.all([
          computeAssetsGridStyleMetrics(asset.symbol),
          fetchLiveMarketSnapshot(authHeader, asset.symbol),
        ])

        if (!include_chart) {
          return {
            ok: true as const,
            widget: "asset_quote" as const,
            assetId: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            assets_grid_metrics,
            live_market,
            hint: "Snapshot only (no price chart in this response). Grid 1h/7d % and 24h volume match the Assets page. To draw a chart next turn, use include_chart true with lookbackHours + resolution; chart changePct is for that window, not the grid columns.",
          }
        }

        const series = await resolveMarketSeriesForAssistant({
          authHeader,
          assetId: asset.id,
          symbol: asset.symbol,
          lookbackHours,
          resolution,
        })
        if ("error" in series) {
          return {
            ok: false as const,
            symbol: asset.symbol,
            error: series.error,
            assets_grid_metrics,
            live_market,
          }
        }

        const riskOverlay =
          include_risk ? riskOverlayFromCloses(series.closes) : null

        return {
          ok: true as const,
          widget: "market_chart" as const,
          assetId: asset.id,
          symbol: asset.symbol,
          assets_grid_metrics,
          live_market,
          chart_changePct_note:
            "changePct below is for the requested lookbackHours/resolution series, not the Assets grid 1h/7d columns.",
          resolution: series.resolutionLabel,
          closes: series.closes,
          labels: series.labels,
          changePct: series.changePct,
          sampleCount: series.sampleCount,
          series_source: series.seriesSource,
          ...(series.seriesSource === "binance"
            ? {
                series_note:
                  "Series source: Binance spot (Tauron OHLC empty for this window). Educational context only.",
              }
            : {}),
          ...(riskOverlay ? { risk_overlay: riskOverlay } : {}),
        }
      },
    }),

    get_curated_news_digest: tool({
      description:
        "Query Tauron curated news from the same API as the News page. Omit symbol for the latest headlines across all assets; pass a ticker (e.g. BTC) to filter by that asset.",
      inputSchema: z.object({
        symbol: z
          .string()
          .optional()
          .describe(
            "Base ticker without quote (BTC, SOL). Leave empty for a global recent feed when the user asks for general/crypto headlines without naming one coin.",
          ),
        max_items: z.number().min(1).max(20).optional().default(10),
      }),
      execute: async ({ symbol, max_items }) => {
        if (!authHeader) return authRequired()

        const mapItems = (rawItems: CuratedNewsRow[]) =>
          rawItems.map((row) => ({
            id: row.id,
            asset_symbol: row.asset_symbol ?? null,
            summary: row.summary?.trim() ?? "",
            sentiment_score: row.sentiment_score,
            published_at: row.published_at,
          }))

        const sym = symbol?.trim() ?? ""
        if (!sym) {
          const qs = new URLSearchParams({
            page: "1",
            page_size: String(max_items),
          })
          const res = await internalJsonFetch<Paginated<CuratedNewsRow>>(`/curated-news?${qs}`, {
            authHeader,
            method: "GET",
          })
          if (!res.ok) {
            return {
              ok: false as const,
              error: `Curated news unavailable (${res.status}).`,
            }
          }
          const rawItems = res.data?.items ?? []
          const items = mapItems(rawItems)
          if (!items.length) {
            return {
              ok: true as const,
              widget: "news_digest" as const,
              symbol: "Recent headlines",
              feed_scope: "global" as const,
              items,
              message: "No curated news in the database yet.",
            }
          }
          return {
            ok: true as const,
            widget: "news_digest" as const,
            symbol: "Recent headlines",
            feed_scope: "global" as const,
            items,
          }
        }

        const { found, detail } = await findAssetsBySymbol(sym, authHeader)
        if (!found.length) {
          return { ok: false as const, error: detail ?? "Asset not found." }
        }
        const asset = found[0]
        const qs = new URLSearchParams({
          asset_id: asset.id,
          page_size: String(max_items),
          page: "1",
        })
        const res = await internalJsonFetch<Paginated<CuratedNewsRow>>(`/curated-news?${qs}`, {
          authHeader,
          method: "GET",
        })
        if (!res.ok) {
          return {
            ok: false as const,
            symbol: asset.symbol,
            error: `Curated news unavailable (${res.status}).`,
          }
        }
        const rawItems = res.data?.items ?? []
        const items = mapItems(rawItems)
        if (!items.length) {
          return {
            ok: true as const,
            widget: "news_digest" as const,
            symbol: asset.symbol,
            feed_scope: "asset" as const,
            items,
            message: "No curated news rows matched this asset yet.",
          }
        }
        return {
          ok: true as const,
          widget: "news_digest" as const,
          symbol: asset.symbol,
          feed_scope: "asset" as const,
          items,
        }
      },
    }),

    get_market_movers: tool({
      description:
        "Rank Binance USDT spot pairs: highest quote volume, top 24h gainers or losers, or most volatile by window (1h / 6h / 24h / 1d / 7d). Use when the user asks for biggest movers, most volume, winners/losers, or volatility leaders without naming a ticker.",
      inputSchema: z.object({
        metric: z
          .enum(["volume", "gainer", "loser", "volatile"])
          .describe("volume = 24h quote volume; gainer/loser = 24h %% change; volatile = absolute %% move over window."),
        window: z
          .enum(["1h", "6h", "24h", "1d", "7d"])
          .optional()
          .default("24h")
          .describe("For volatile only (ignored for volume/gainer/loser). 24h/1d use ticker; 1h/6h/7d scan liquid pairs with klines."),
        limit: z.number().min(1).max(25).optional().default(10),
      }),
      execute: async ({ metric, window, limit }) => {
        if (!authHeader) return authRequired()
        const qs = new URLSearchParams({
          metric,
          window,
          limit: String(limit),
        })
        const res = await internalJsonFetch<{
          metric: string
          window: string
          methodology: string
          items: Array<{
            rank: number
            symbol: string
            last_price_usdt: number | null
            quote_volume_24h_usdt: number | null
            price_change_24h_pct: number | null
            sort_value: number
            note?: string
          }>
        }>(`/assets/market-movers?${qs}`, { authHeader, method: "GET" })
        if (!res.ok) {
          return {
            ok: false as const,
            error: `Market movers unavailable (${res.status}).`,
          }
        }
        const data = res.data
        if (!data) {
          return { ok: false as const, error: "Empty response from market movers." }
        }
        return {
          ok: true as const,
          widget: "market_movers" as const,
          metric: data.metric,
          window: data.window,
          methodology: data.methodology,
          items: data.items ?? [],
        }
      },
    }),

    prepare_watchlist_change: tool({
      description:
        "Prepare adding or removing an asset from the primary watchlist or a named list (use named_list_id from get_user_watchlists). Never claims completion—the UI must confirm sensitive mutations.",
      inputSchema: z.object({
        symbol: z.string(),
        action: z.enum(["add", "remove"]),
        named_list_id: z
          .string()
          .uuid()
          .optional()
          .describe("UUID of a named list from get_user_watchlists; omit for the primary watchlist."),
      }),
      execute: async ({ symbol, action, named_list_id }) => {
        if (!authHeader) return authRequired()
        const { found, detail } = await findAssetsBySymbol(symbol, authHeader)
        if (!found.length) {
          return { ok: false as const, error: detail ?? "Asset not found." }
        }
        const asset = found[0]

        let listName: string | undefined
        if (named_list_id?.trim()) {
          const listsRes = await internalJsonFetch<WatchlistListRow[]>(`/users/me/watchlists`, {
            authHeader,
            method: "GET",
          })
          const match = listsRes.data?.find((l) => l.id === named_list_id.trim())
          if (!listsRes.ok || !match) {
            return {
              ok: false as const,
              error: "Named watchlist not found. Call get_user_watchlists for valid list IDs.",
            }
          }
          listName = match.name
        }

        const confirmation_token = signAssistantConfirmation({
          v: 1,
          kind: "watchlist",
          action,
          assetId: asset.id,
          symbol: asset.symbol,
          ...(named_list_id?.trim() ?
            { listId: named_list_id.trim(), listName }
          : {}),
          exp: createExpiry(),
        })

        const targetLabel =
          listName ? `named list “${listName}”` : "your primary watchlist"

        return {
          ok: true as const,
          widget: "watchlist_confirmation" as const,
          symbol: asset.symbol,
          action,
          named_list_id: named_list_id?.trim() ?? null,
          confirmation_token,
          message:
            action === "add"
              ? `Add ${asset.symbol} to ${targetLabel}?`
              : `Remove ${asset.symbol} from ${targetLabel}?`,
        }
      },
    }),

    prepare_price_alert: tool({
      description:
        "Prepare a Binance-linked price alert at a numeric target. Requires confirmation before the alert is persisted.",
      inputSchema: z.object({
        symbol: z.string(),
        target_price: z.number().positive(),
        preset_move_percent: z
          .number()
          .optional()
          .nullable()
          .describe("Optional preset move % mirrored from UI; omit when user typed an absolute target manually."),
      }),
      execute: async ({ symbol, target_price, preset_move_percent }) => {
        if (!authHeader) return authRequired()
        const { found, detail } = await findAssetsBySymbol(symbol, authHeader)
        if (!found.length) {
          return { ok: false as const, error: detail ?? "Asset not found." }
        }
        const asset = found[0]
        const normalized = asset.symbol.trim().toUpperCase()
        if (normalized === "USDT") {
          return { ok: false as const, error: "USDT cannot use directional Binance alerts in this flow." }
        }
        const pct =
          preset_move_percent === undefined || preset_move_percent === null ? null : preset_move_percent
        const confirmation_token = signAssistantConfirmation({
          v: 1,
          kind: "price_alert",
          assetId: asset.id,
          symbol: asset.symbol,
          target_price,
          percentage_change: pct,
          exp: createExpiry(),
        })
        return {
          ok: true as const,
          widget: "price_alert_confirmation" as const,
          symbol: asset.symbol,
          target_price,
          confirmation_token,
          message: `Create a ${asset.symbol} alert when spot crosses ${target_price}?`,
        }
      },
    }),
  }
}
