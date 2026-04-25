/**
 * Centralized API client for Tauron backend.
 * Reads access_token from localStorage and attaches Bearer header.
 */

const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1"

export const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  DEFAULT_API_BASE_URL

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

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const data = (await res.json()) as { detail?: string }
      if (data?.detail) message = data.detail
    } catch { /* ignore */ }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  let url = `${apiBaseUrl}${path}`
  if (params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.append(k, String(v))
    }
    const qsStr = qs.toString()
    if (qsStr) url += `?${qsStr}`
  }
  const res = await fetch(url, { headers: authHeaders() })
  return handleResponse<T>(res)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PUT",
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  return handleResponse<T>(res)
}

/** Admin-only calls — uses X-Admin-Key header (no JWT needed) */
export async function adminGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  let url = `${apiBaseUrl}${path}`
  if (params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.append(k, String(v))
    }
    const qsStr = qs.toString()
    if (qsStr) url += `?${qsStr}`
  }
  const res = await fetch(url, { headers: adminHeaders() })
  return handleResponse<T>(res)
}

export async function adminPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: adminHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function adminPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function adminDelete<T = void>(path: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: adminHeaders(),
  })
  return handleResponse<T>(res)
}

// ─── Shared types ────────────────────────────────────────────────────────────

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
