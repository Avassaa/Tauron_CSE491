/**
 * Base URL for the FastAPI app (includes `/api/v1`, no trailing slash).
 *
 * When `VITE_API_BASE_URL` is unset, the browser uses same-origin `/api/v1` so
 * Vite can proxy to the backend in dev — avoids CORS killing session/history fetches.
 */
export function getPublicApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  if (typeof window !== "undefined") return `${window.location.origin}/api/v1`
  return "http://127.0.0.1:8000/api/v1"
}
