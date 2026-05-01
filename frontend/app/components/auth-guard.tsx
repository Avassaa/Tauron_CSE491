"use client"

/**
 * AuthGuard — renders children only when a valid access_token is in localStorage.
 * On the server (SSR) or while checking, renders the fallback.
 * Once mounted, if there is no token the user is redirected to /login.
 */

import * as React from "react"
import { useNavigate } from "react-router"

export function AuthGuard({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const [status, setStatus] = React.useState<"checking" | "authenticated" | "unauthenticated">(
    "checking",
  )
  const navigate = useNavigate()

  const checkAuth = React.useCallback(() => {
    try {
      const token = localStorage.getItem("access_token")
      if (token && token.trim().length > 0) {
        setStatus("authenticated")
      } else {
        setStatus("unauthenticated")
        void navigate("/", { replace: true })
      }
    } catch {
      // If localStorage is blocked (privacy mode, sandbox), never stay stuck in "checking".
      setStatus("unauthenticated")
      window.location.replace("/")
    }
  }, [navigate])

  React.useEffect(() => {
    // Initial check
    checkAuth()

    // Listen for custom auth events (same-tab logout)
    window.addEventListener("tauron:auth-changed", checkAuth)

    // Listen for storage events (cross-tab logout)
    window.addEventListener("storage", (event) => {
      if (event.key === "access_token") {
        checkAuth()
      }
    })

    // Listen for pageshow events (BFCache handling)
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        checkAuth()
      }
    })

    return () => {
      window.removeEventListener("tauron:auth-changed", checkAuth)
      window.removeEventListener("storage", checkAuth)
      window.removeEventListener("pageshow", checkAuth)
    }
  }, [checkAuth])

  if (status === "checking") {
    return (
      fallback ?? (
        <div
          className="flex min-h-svh w-full items-center justify-center bg-background"
          aria-busy
          aria-label="Checking authentication"
        >
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            <span className="text-sm">Checking authentication…</span>
          </div>
        </div>
      )
    )
  }

  if (status === "unauthenticated") return null

  return <>{children}</>
}
