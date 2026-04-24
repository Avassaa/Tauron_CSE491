"use client"

import * as React from "react"

import { Toaster } from "~/components/ui/sonner"
import { applyThemeToDocument } from "~/theme-context"

export function AppProviders({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("theme")
      if (stored === "dark" || stored === "light") {
        applyThemeToDocument(stored)
      }
    } catch {
      // Ignore localStorage access issues.
    }
  }, [])

  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
