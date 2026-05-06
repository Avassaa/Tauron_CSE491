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
    const performCheck = (isRetry = false) => {
      try {
        const token = localStorage.getItem("access_token")
        console.log("[AuthGuard] Checking token at", window.location.pathname, ":", !!token, "isRetry:", isRetry)
        if (token && token.trim().length > 0) {
          console.log("[AuthGuard] Token found, setting authenticated")
          setStatus("authenticated")
        } else if (!isRetry) {
          console.log("[AuthGuard] No token found, retrying in 500ms...")
          setTimeout(() => performCheck(true), 500)
        } else {
          console.log("[AuthGuard] Unauthenticated after retry, redirecting to /")
          setStatus("unauthenticated")
          void navigate("/", { replace: true })
        }
      } catch (err) {
        console.error("[AuthGuard] Error during checkAuth:", err)
        setStatus("unauthenticated")
        window.location.replace("/")
      }
    }
    performCheck()
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
