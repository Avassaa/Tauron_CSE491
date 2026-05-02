/**
 * Centralized API client for Tauron backend.
 * Reads access_token from localStorage and attaches Bearer header.
 * All requests time out after REQUEST_TIMEOUT_MS milliseconds.
 */

const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1"
const REQUEST_TIMEOUT_MS = 8000

export const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  DEFAULT_API_BASE_URL

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("access_token")
}

function getAdminKey(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("admin_api_key") || null
}

function authHeaders(forceAdmin = false): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const token = getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`
  if (forceAdmin) {
    const adminKey = getAdminKey()
    if (adminKey) headers["X-Admin-Key"] = adminKey
  }
  return headers
}

function adminHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const adminKey = getAdminKey()
  if (adminKey) headers["X-Admin-Key"] = adminKey
  return headers
}

/** Returns an AbortSignal that fires after REQUEST_TIMEOUT_MS. */
function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS)
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const data = (await res.json()) as { detail?: unknown }
      if (typeof data?.detail === "string") {
        message = data.detail
      } else if (data?.detail) {
        message = JSON.stringify(data.detail)
      }
    } catch { /* ignore */ }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  if ((path === "/market-data" || path === "/ml-models") && params?.asset_id !== undefined) {
    const assetId = String(params.asset_id)
    if (!UUID_REGEX.test(assetId)) {
      throw new Error(`Invalid asset_id for ${path}: ${assetId}`)
    }
  }

  const url = `${apiBaseUrl}${path}`
  if (!params) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.append(k, String(v))
  }
  const qsStr = qs.toString()
  return qsStr ? `${url}?${qsStr}` : url
}

// ─── User-facing (JWT) ────────────────────────────────────────────────────────

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: authHeaders(),
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PUT",
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}


export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}

// ─── Admin (X-Admin-Key) ──────────────────────────────────────────────────────

export async function adminGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: adminHeaders(),
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}

export async function adminPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: adminHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}

export async function adminPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}

export async function adminDelete<T = void>(path: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: adminHeaders(),
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  username: string
  email: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface AssetResponse {
  id: string
  symbol: string
  name: string
  category: string | null
  coingecko_id: string | null
  is_active: boolean
  created_at: string
}

export interface WatchlistEntryResponse {
  user_id: string
  asset: AssetResponse
}

export interface PriceAlertResponse {
  id: string
  user_id: string
  asset_id: string
  symbol: string
  condition: "above" | "below"
  target_price: number
  reference_price: number | null
  percentage_change: number | null
  is_active: boolean
  triggered_at: string | null
  last_checked_price: number | null
  created_at: string
  updated_at: string
}

export interface NotificationResponse {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  payload: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface WatchlistListResponse {
  id: string
  user_id: string
  name: string
  created_at: string
}



export interface BacktestResultResponse {
  id: string
  user_id: string | null
  model_id: string | null
  strategy_name: string | null
  total_return: number | null
  sharpe_ratio: number | null
  max_drawdown: number | null
  trades_log: Record<string, unknown> | null
  created_at: string
}

export interface MlModelResponse {
  id: string
  asset_id: string | null
  version_tag: string
  model_type: string | null
  hyperparameters: Record<string, unknown> | null
  training_metrics: Record<string, unknown> | null
  file_path: string | null
  is_active: boolean
  created_at: string
}

export interface MarketDataResponse {
  time: string
  asset_id: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  resolution: string
}

export interface CuratedNewsResponse {
  id: string
  asset_id: string | null
  asset_symbol?: string | null
  summary: string
  sentiment_score: number | null
  data_points_used: Record<string, unknown> | null
  published_at: string | null
  created_at: string
}

export interface PredictionResponse {
  time: string
  asset_id: string
  model_id: string
  predicted_value: number
  confidence_interval_high: number | null
  confidence_interval_low: number | null
}

export interface TechnicalIndicatorResponse {
  time: string
  asset_id: string
  indicator_name: string
  value: number
}

export interface OnChainMetricResponse {
  time: string
  asset_id: string
  metric_name: string
  value: number
}

export interface ChatHistoryResponse {
  id: string
  user_id: string
  session_id: string | null
  role: string
  content: string
  ui_payload: Record<string, unknown> | null
  created_at: string
}

export interface UserPublicResponse {
  id: string
  username: string
  email: string
  created_at: string
}
