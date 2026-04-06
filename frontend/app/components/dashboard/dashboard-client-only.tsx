"use client"

import * as React from "react"

/**
 * Renders children only after mount so sidebar + provider never run during SSR.
 * Avoids `useSidebar` / context mismatches with React Router SSR + Vite.
 */
export function DashboardClientOnly({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback: React.ReactNode
}) {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])
  if (!ready) return fallback
  return children
}
