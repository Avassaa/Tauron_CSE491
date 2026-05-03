import { createHmac, timingSafeEqual } from "node:crypto"
import path from "node:path"
import { existsSync } from "node:fs"
import { config as loadEnv } from "dotenv"

function loadAllDotenvOnce() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "frontend", ".env"),
    path.join(process.cwd(), "frontend", ".env.local"),
  ]
  for (const p of candidates) {
    if (existsSync(p)) loadEnv({ path: p, override: true })
  }
}

let loaded = false
function ensureEnv() {
  if (!loaded) {
    loadAllDotenvOnce()
    loaded = true
  }
}

function confirmationSecret(): string {
  ensureEnv()
  const explicit = process.env.TAURON_TOOL_CONFIRM_SECRET?.trim()
  if (explicit) return explicit
  const gemini = process.env.GEMINI_API_KEY?.trim()
  if (gemini) return gemini
  return "tauron-dev-tool-confirmation-secret"
}

export type PendingWatchlistConfirmation = {
  v: 1
  kind: "watchlist"
  action: "add" | "remove"
  assetId: string
  symbol: string
  exp: number
}

export type PendingPriceAlertConfirmation = {
  v: 1
  kind: "price_alert"
  assetId: string
  symbol: string
  target_price: number
  percentage_change: number | null
  exp: number
}

export type PendingAssistantConfirmation = PendingWatchlistConfirmation | PendingPriceAlertConfirmation

const TTL_MS = 15 * 60 * 1000

export function createExpiry(): number {
  return Date.now() + TTL_MS
}

export function signAssistantConfirmation(payload: PendingAssistantConfirmation): string {
  const secret = confirmationSecret()
  const body = Buffer.from(JSON.stringify(payload), "utf8")
  const sig = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body.toString("base64url")}.${sig}`
}

export function verifyAssistantConfirmationToken(token: string): PendingAssistantConfirmation | null {
  const secret = confirmationSecret()
  const trimmed = token.trim()
  const dot = trimmed.lastIndexOf(".")
  if (dot <= 0) return null
  const bodyB64 = trimmed.slice(0, dot)
  const sig = trimmed.slice(dot + 1)
  let bodyJson: string
  try {
    bodyJson = Buffer.from(bodyB64, "base64url").toString("utf8")
  } catch {
    return null
  }
  const expected = createHmac("sha256", secret).update(Buffer.from(bodyJson, "utf8")).digest("base64url")
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(sig)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(bodyJson) as unknown
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const o = parsed as PendingAssistantConfirmation
  if (o.v !== 1 || typeof o.exp !== "number") return null
  if (Date.now() > o.exp) return null
  if (o.kind === "watchlist") {
    if ((o.action !== "add" && o.action !== "remove") || typeof o.assetId !== "string" || typeof o.symbol !== "string") {
      return null
    }
    return o
  }
  if (o.kind === "price_alert") {
    if (
      typeof o.assetId !== "string" ||
      typeof o.symbol !== "string" ||
      typeof o.target_price !== "number" ||
      !(o.percentage_change === null || typeof o.percentage_change === "number")
    ) {
      return null
    }
    return o
  }
  return null
}
