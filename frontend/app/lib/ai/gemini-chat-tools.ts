import { tool } from "ai"
import { z } from "zod"

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

type MarketRow = {
  time: string
  close: number
  open: number
  high: number
  low: number
  volume: number
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

export function createTauronFinanceTools(ctx: { authHeader: string | null }) {
  const { authHeader } = ctx

  return {
    getAssetPrice: tool({
      description:
        "Resolve a tracked asset by symbol (e.g. BTC, SOL) and return metadata from Tauron. Requires user JWT.",
      inputSchema: z.object({
        symbol: z.string().describe("Base asset ticker without quote, e.g. BTC"),
      }),
      execute: async ({ symbol }) => {
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
        return {
          ok: true as const,
          widget: "asset_quote" as const,
          assetId: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          hint: "Price snapshots come from client-side streams or dedicated charts; offer qualitative guidance unless another tool returned numeric series.",
        }
      },
    }),

    renderMarketChart: tool({
      description:
        "Fetch recent OHLCV closes for an asset symbol and return a compact series for an inline chart widget. Requires JWT.",
      inputSchema: z.object({
        symbol: z.string(),
        lookbackHours: z.number().min(6).max(720).optional().default(168),
        resolution: z.enum(["1h", "4h", "1d"]).optional().default("1h"),
      }),
      execute: async ({ symbol, lookbackHours, resolution }) => {
        if (!authHeader) return authRequired()
        const { found, detail } = await findAssetsBySymbol(symbol, authHeader)
        if (!found.length) {
          return {
            ok: false as const,
            error: detail ?? "Asset not found.",
          }
        }
        const asset = found[0]
        const timeTo = new Date()
        const timeFrom = new Date(timeTo.getTime() - lookbackHours * 60 * 60 * 1000)
        const qs = new URLSearchParams({
          asset_id: asset.id,
          time_from: timeFrom.toISOString(),
          time_to: timeTo.toISOString(),
          resolution,
          page_size: "200",
          page: "1",
        })
        const md = await internalJsonFetch<Paginated<MarketRow>>(`/market-data?${qs}`, {
          authHeader,
          method: "GET",
        })
        if (!md.ok || !md.data?.items?.length) {
          return {
            ok: false as const,
            symbol: asset.symbol,
            error: `Market data unavailable (${md.status}).`,
          }
        }
        const sorted = [...md.data.items].sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        )
        const closes = sorted.map((r) => r.close)
        const labels = sorted.map((r) =>
          new Date(r.time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" }),
        )
        const lastClose = closes[closes.length - 1]
        const firstClose = closes[0]
        const changePct =
          firstClose && lastClose && firstClose !== 0 ? ((lastClose - firstClose) / firstClose) * 100 : null

        return {
          ok: true as const,
          widget: "market_chart" as const,
          assetId: asset.id,
          symbol: asset.symbol,
          resolution,
          closes,
          labels,
          changePct,
          sampleCount: closes.length,
        }
      },
    }),

    updateWatchlist: tool({
      description:
        "Add or remove a tracked asset from the signed-in user’s primary watchlist via Tauron API.",
      inputSchema: z.object({
        symbol: z.string(),
        action: z.enum(["add", "remove"]),
      }),
      execute: async ({ symbol, action }) => {
        if (!authHeader) return authRequired()
        const { found, detail } = await findAssetsBySymbol(symbol, authHeader)
        if (!found.length) {
          return { ok: false as const, error: detail ?? "Asset not found." }
        }
        const asset = found[0]
        const path = `/users/me/watchlist/${asset.id}`
        const res =
          action === "add"
            ? await internalJsonFetch<unknown>(path, { authHeader, method: "PUT" })
            : await internalJsonFetch<unknown>(path, { authHeader, method: "DELETE" })
        if (!res.ok) {
          return {
            ok: false as const,
            symbol: asset.symbol,
            action,
            error:
              action === "remove" && res.status === 404
                ? `${asset.symbol} was not on your watchlist.`
                : `Watchlist API error (${res.status}).`,
          }
        }
        return {
          ok: true as const,
          widget: "watchlist_update" as const,
          symbol: asset.symbol,
          action,
          message:
            action === "add"
              ? `${asset.symbol} added to your watchlist.`
              : `${asset.symbol} removed from your watchlist.`,
        }
      },
    }),
  }
}
