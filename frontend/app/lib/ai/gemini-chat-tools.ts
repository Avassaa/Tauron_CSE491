import { tool } from "ai"
import { z } from "zod"

import { resolveMarketSeriesForAssistant } from "~/lib/ai/gemini-chat-market-series.server"
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
    /**
     * Primary market tool: resolve an asset and optionally fetch OHLC series plus an educational risk readout.
     */
    get_market_data: tool({
      description:
        "Resolve a tracked crypto asset by ticker and optionally fetch recent closes for an inline chart plus volatility context. Prefer this instead of guessing prices.",
      inputSchema: z.object({
        symbol: z.string().describe("Base ticker without quote, e.g. BTC or SOL."),
        include_chart: z.boolean().optional().default(false).describe("When true, fetch OHLC closes for chart rendering."),
        include_risk: z.boolean().optional().default(false).describe("When true (usually with chart), add heuristic risk bands."),
        lookbackHours: z.number().min(6).max(720).optional().default(168),
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

        if (!include_chart) {
          return {
            ok: true as const,
            widget: "asset_quote" as const,
            assetId: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            hint: "Enable include_chart when the user wants a visual series or volatility context.",
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
          }
        }

        const riskOverlay =
          include_risk ? riskOverlayFromCloses(series.closes) : null

        return {
          ok: true as const,
          widget: "market_chart" as const,
          assetId: asset.id,
          symbol: asset.symbol,
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

    /**
     * Proposal only — surfaces Confirm/Cancel in the UI; mutation runs after confirmation.
     */
    prepare_watchlist_change: tool({
      description:
        "Prepare adding or removing an asset from the user primary watchlist. Never claims completion—the UI must confirm sensitive mutations.",
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
        const confirmation_token = signAssistantConfirmation({
          v: 1,
          kind: "watchlist",
          action,
          assetId: asset.id,
          symbol: asset.symbol,
          exp: createExpiry(),
        })
        return {
          ok: true as const,
          widget: "watchlist_confirmation" as const,
          symbol: asset.symbol,
          action,
          confirmation_token,
          message:
            action === "add"
              ? `Add ${asset.symbol} to your primary watchlist?`
              : `Remove ${asset.symbol} from your primary watchlist?`,
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
