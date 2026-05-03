import { getPublicApiBaseUrl } from "~/lib/public-api-base-url"

const REQUEST_TIMEOUT_MS = 8000

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

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("refresh_token")
}

function clearSessionLocally(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
  localStorage.removeItem("token_type")
  localStorage.removeItem("user_id")
  localStorage.removeItem("username")
  localStorage.removeItem("email")
  window.dispatchEvent(new CustomEvent("tauron:auth-changed"))
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

  const url = `${getPublicApiBaseUrl()}${path}`
  if (!params) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.append(k, String(v))
  }
  const qsStr = qs.toString()
  return qsStr ? `${url}?${qsStr}` : url
}

// ─── Auto-Refresh Fetch Wrapper ───────────────────────────────────────────────

let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await fetch(`${getPublicApiBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      clearSessionLocally()
      return null
    }

    const data = await res.json()
    localStorage.setItem("access_token", data.access_token)
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token)
    }
    window.dispatchEvent(new CustomEvent("tauron:auth-changed"))
    return data.access_token
  } catch (error) {
    clearSessionLocally()
    return null
  }
}

function authHeadersWithoutJsonContentType(): Record<string, string> {
  const h = { ...(authHeaders() as Record<string, string>) }
  delete h["Content-Type"]
  return h
}

async function fetchWithAuth(url: string, options: RequestInit): Promise<Response> {
  options.headers = authHeaders()
  options.signal = timeoutSignal()

  let res = await fetch(url, options)

  if (res.status === 401) {
    // Attempt to refresh token
    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false
        refreshPromise = null
      })
    }

    const newToken = await refreshPromise
    if (newToken) {
      // Retry request with new token
      options.headers = authHeaders()
      options.signal = timeoutSignal() // new signal for retry
      res = await fetch(url, options)
    }
  }

  return res
}

async function fetchWithAuthForm(url: string, form: FormData): Promise<Response> {
  const init: RequestInit = {
    method: "POST",
    headers: authHeadersWithoutJsonContentType(),
    body: form,
    signal: timeoutSignal(),
  }
  let res = await fetch(url, init)
  if (res.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise
    if (newToken) {
      init.headers = authHeadersWithoutJsonContentType()
      init.signal = timeoutSignal()
      res = await fetch(url, init)
    }
  }
  return res
}


// ─── User-facing (JWT) ────────────────────────────────────────────────────────

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const res = await fetchWithAuth(buildUrl(path, params), { method: "GET" })
  return handleResponse<T>(res)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(`${getPublicApiBaseUrl()}${path}`, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiPostFormData<T>(path: string, form: FormData): Promise<T> {
  const res = await fetchWithAuthForm(`${getPublicApiBaseUrl()}${path}`, form)
  return handleResponse<T>(res)
}

export async function uploadCommentImage(file: File): Promise<string> {
  const form = new FormData()
  form.append("file", file, file.name)
  const data = await apiPostFormData<{ url: string }>("/comment-images", form)
  return data.url
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(`${getPublicApiBaseUrl()}${path}`, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(`${getPublicApiBaseUrl()}${path}`, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const res = await fetchWithAuth(`${getPublicApiBaseUrl()}${path}`, { method: "DELETE" })
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
  const res = await fetch(`${getPublicApiBaseUrl()}${path}`, {
    method: "POST",
    headers: adminHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}

export async function adminPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${getPublicApiBaseUrl()}${path}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(),
  })
  return handleResponse<T>(res)
}

export async function adminDelete<T = void>(path: string): Promise<T> {
  const res = await fetch(`${getPublicApiBaseUrl()}${path}`, {
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
  /** Raw scraped article body when linked to ``news_data`` (detail GET only). */
  article_content?: string | null
}

/** User comment on a curated news story (`POST/GET …/curated-news/:id/comments`). */
export interface NewsCommentResponse {
  id: string
  curated_news_id: string
  user_id: string
  username: string
  content: string
  created_at: string
  updated_at?: string | null
  parent_comment_id?: string | null
  parent_username?: string | null
}

export interface PredictionResponse {
  time: string
  asset_id: string
  model_id: string
  predicted_value: number
  confidence_interval_high: number | null
  confidence_interval_low: number | null
}

export interface AssetPredictionSummaryResponse {
  asset_id: string
  symbol: string
  name: string
  latest_prediction?: number
  confidence_score?: number
  trend_signal?: string
  volatility?: number
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
