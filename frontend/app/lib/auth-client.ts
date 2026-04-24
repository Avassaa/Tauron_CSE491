const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1"

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || DEFAULT_API_BASE_URL

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
}

export type RegisterSuccess = AuthSuccess & {
  username: string
  email: string
}

export type UserProfile = {
  id: string
  username: string
  email: string
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
  const response = await fetch(`${apiBaseUrl}${path}`, {
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

export async function getMe(token: string): Promise<UserProfile> {
  const response = await fetch(`${apiBaseUrl}/users/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return (await response.json()) as UserProfile
}

export function persistSession(
  token: string,
  userId: string,
  extra?: { username?: string; email?: string },
): void {
  localStorage.setItem("access_token", token)
  localStorage.setItem("token_type", "bearer")
  localStorage.setItem("user_id", userId)
  if (extra?.username) {
    localStorage.setItem("username", extra.username)
  }
  if (extra?.email) {
    localStorage.setItem("email", extra.email)
  }
}

export function clearSession(): void {
  localStorage.removeItem("access_token")
  localStorage.removeItem("token_type")
  localStorage.removeItem("user_id")
  localStorage.removeItem("username")
  localStorage.removeItem("email")
}
