
import { existsSync } from "node:fs"
import path from "node:path"
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

export function resolveInternalApiBaseUrl(): string {
  ensureEnv()
  const internalRaw = process.env.API_INTERNAL_BASE_URL?.trim() ?? ""
  if (internalRaw.length > 0) return internalRaw.replace(/\/$/, "")
  const viteRaw = process.env.VITE_API_BASE_URL?.trim() ?? ""
  if (viteRaw.length > 0 && /^https?:\/\//i.test(viteRaw)) return viteRaw.replace(/\/$/, "")
  return "http://127.0.0.1:8000/api/v1"
}

export type InternalJsonFetchInit = {
  authHeader: string | null
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  body?: unknown
}

export async function internalJsonFetch<T>(
  pathAndQuery: string,
  init: InternalJsonFetchInit,
): Promise<{ ok: boolean; status: number; data?: T; rawBody: string }> {
  ensureEnv()
  const base = resolveInternalApiBaseUrl()
  const suffix = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`
  const url = `${base}${suffix}`
  const headers: Record<string, string> = {}
  const method = init.method ?? "GET"
  if (init.body !== undefined) headers["Content-Type"] = "application/json"
  if (init.authHeader?.trim()) {
    const raw = init.authHeader.trim()
    headers.Authorization = raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`
  }
  const res = await fetch(url, {
    method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const rawBody = await res.text()
  let data: T | undefined
  try {
    data = rawBody ? (JSON.parse(rawBody) as T) : undefined
  } catch {
    data = undefined
  }
  return { ok: res.ok, status: res.status, data, rawBody }
}
