import { fetchBinanceLastPrice } from "~/lib/server/binance-spot"
import {
  verifyAssistantConfirmationToken,
  type PendingAssistantConfirmation,
} from "~/lib/ai/assistant-tool-token.server"
import { internalJsonFetch } from "~/lib/ai/gemini-internal-api"

function parseAuth(request: Request, bodyToken?: unknown): string | null {
  const fromHeader = request.headers.get("Authorization")?.trim() || ""
  const tokenRaw = typeof bodyToken === "string" ? bodyToken.trim() : ""
  if (fromHeader.length > 0) return fromHeader.startsWith("Bearer ") ? fromHeader : `Bearer ${fromHeader}`
  if (tokenRaw.length > 0) return tokenRaw.startsWith("Bearer ") ? tokenRaw : `Bearer ${tokenRaw}`
  return null
}

async function executeWatchlist(payload: PendingAssistantConfirmation & { kind: "watchlist" }, authHeader: string) {
  const path = `/users/me/watchlist/${payload.assetId}`
  const res =
    payload.action === "add"
      ? await internalJsonFetch<unknown>(path, { authHeader, method: "PUT" })
      : await internalJsonFetch<unknown>(path, { authHeader, method: "DELETE" })
  if (!res.ok) {
    const msg =
      payload.action === "remove" && res.status === 404
        ? `${payload.symbol} was not on your watchlist.`
        : `Watchlist API error (${res.status}).`
    return Response.json({ ok: false as const, error: msg }, { status: res.status })
  }
  return Response.json({
    ok: true as const,
    widget: "watchlist_update" as const,
    symbol: payload.symbol,
    action: payload.action,
    message:
      payload.action === "add"
        ? `${payload.symbol} added to your watchlist.`
        : `${payload.symbol} removed from your watchlist.`,
  })
}

function binancePair(symbol: string): string | null {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized || normalized === "USDT") return null
  return `${normalized}USDT`
}

async function executePriceAlert(
  payload: PendingAssistantConfirmation & { kind: "price_alert" },
  authHeader: string,
) {
  const pair = binancePair(payload.symbol)
  if (!pair) {
    return Response.json({ ok: false as const, error: "Unsupported symbol for Binance price alerts." }, { status: 400 })
  }
  const currentPrice = await fetchBinanceLastPrice(pair)
  if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return Response.json(
      { ok: false as const, error: "Could not read a live Binance price for this asset." },
      { status: 502 },
    )
  }
  const targetPrice = payload.target_price
  if (targetPrice <= 0) {
    return Response.json({ ok: false as const, error: "Invalid target price." }, { status: 400 })
  }
  const condition = targetPrice >= currentPrice ? ("above" as const) : ("below" as const)
  const res = await internalJsonFetch<unknown>("/users/me/price-alerts", {
    authHeader,
    method: "POST",
    body: {
      asset_id: payload.assetId,
      condition,
      target_price: targetPrice,
      reference_price: currentPrice,
      percentage_change: payload.percentage_change,
    },
  })
  if (!res.ok) {
    return Response.json(
      {
        ok: false as const,
        error:
          typeof res.data === "object" && res.data && "detail" in res.data && typeof (res.data as { detail: unknown }).detail === "string"
            ? (res.data as { detail: string }).detail
            : `Price alert API error (${res.status}).`,
      },
      { status: res.status },
    )
  }
  return Response.json({
    ok: true as const,
    widget: "price_alert_created" as const,
    symbol: payload.symbol,
    message: `Price alert set (${condition} ${targetPrice}).`,
  })
}

export async function handleAssistantConfirmToolPost(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 })
  }

  let body: { confirmation_token?: string; access_token?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const authHeader = parseAuth(request, body.access_token)
  if (!authHeader) {
    return Response.json({ error: "Authentication required." }, { status: 401 })
  }

  const token = typeof body.confirmation_token === "string" ? body.confirmation_token.trim() : ""
  if (!token) {
    return Response.json({ error: "Expected confirmation_token." }, { status: 400 })
  }

  const payload = verifyAssistantConfirmationToken(token)
  if (!payload) {
    return Response.json({ error: "Invalid or expired confirmation." }, { status: 400 })
  }

  if (payload.kind === "watchlist") {
    return executeWatchlist(payload, authHeader)
  }
  return executePriceAlert(payload, authHeader)
}
