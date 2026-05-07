import { getPublicApiBaseUrl } from "~/lib/public-api-base-url"

export type LoginPayload = {
  email: string
  password: string
}

export type RegisterPayload = {
  email: string
  username: string
  password: string
}

export type AuthSuccess = {
  access_token: string
  token_type: string
  user_id: string
  refresh_token?: string
}

export type RegisterSuccess = AuthSuccess & {
  username: string
  email: string
}

export type UserProfile = {
  id: string
  username: string
  full_name?: string | null
  email: string
  plan?: string
  created_at?: string | null
  preferences?: Record<string, unknown> | null
}

export type UpdateProfilePayload = {
  username?: string
  full_name?: string
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string }
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return data.detail
    }
  } catch {
    // Keep generic fallback.
  }
  return "Authentication request failed."
}

async function request<T>(path: string, body: Record<string, string>): Promise<T> {
  const response = await fetch(`${getPublicApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return (await response.json()) as T
}

export async function login(payload: LoginPayload): Promise<AuthSuccess> {
  return request<AuthSuccess>("/auth/login", payload)
}

export async function register(payload: RegisterPayload): Promise<RegisterSuccess> {
  return request<RegisterSuccess>("/auth/register", payload)
}

export async function refreshToken(refreshToken: string): Promise<AuthSuccess> {
  return request<AuthSuccess>("/auth/refresh", { refresh_token: refreshToken })
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/forgot-password", { email })
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/reset-password", { token, new_password: newPassword })
}

export async function getMe(token: string): Promise<UserProfile> {
  const response = await fetch(`${getPublicApiBaseUrl()}/users/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearSession()
      throw new Error("Session expired. Please sign in again.")
    }
    throw new Error(await parseErrorMessage(response))
  }

  return (await response.json()) as UserProfile
}

export async function patchMe(token: string, payload: UpdateProfilePayload): Promise<UserProfile> {
  const response = await fetch(`${getPublicApiBaseUrl()}/users/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearSession()
      throw new Error("Session expired. Please sign in again.")
    }
    throw new Error(await parseErrorMessage(response))
  }

  return (await response.json()) as UserProfile
}

// ─── Local-only plan management (no backend, no payment) ─────────────────────

export function getLocalPlan(): string {
  if (typeof window === "undefined") return "free"
  return localStorage.getItem("plan") ?? "free"
}

export function setLocalPlan(plan: "free" | "pro" | "ultra"): void {
  localStorage.setItem("plan", plan)
  // Also persist per-user so the plan survives logout → login cycles
  const userId = localStorage.getItem("user_id")
  if (userId) localStorage.setItem(`plan_${userId}`, plan)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tauron:auth-changed"))
  }
}

export function persistSession(
  token: string,
  userId: string,
  extra?: { username?: string; email?: string; refresh_token?: string },
): void {
  localStorage.setItem("access_token", token)
  localStorage.setItem("token_type", "bearer")
  localStorage.setItem("user_id", userId)
  if (extra?.username) localStorage.setItem("username", extra.username)
  if (extra?.email) localStorage.setItem("email", extra.email)
  if (extra?.refresh_token) localStorage.setItem("refresh_token", extra.refresh_token)
  // Restore per-user plan if previously saved, otherwise default to "free"
  const savedPlan = localStorage.getItem(`plan_${userId}`) ?? "free"
  localStorage.setItem("plan", savedPlan)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tauron:auth-changed"))
  }
}

export function clearSession(): void {
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
  localStorage.removeItem("token_type")
  localStorage.removeItem("username")
  localStorage.removeItem("email")
  localStorage.removeItem("plan")
  // Note: plan_<userId> is intentionally kept so the plan is restored on next login
  localStorage.removeItem("user_id")
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tauron:auth-changed"))
  }
}
