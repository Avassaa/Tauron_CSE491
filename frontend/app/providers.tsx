"use client"

import * as React from "react"

import { GlassBackdropSeed } from "~/components/glass-backdrop-seed"
import { AssistantDockProvider } from "~/components/assistant/assistant-dock-context"
import { LiquidGlassHtmlSync } from "~/components/liquid-glass-html-sync"
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
      <LiquidGlassHtmlSync />
      <GlassBackdropSeed />
      <AssistantDockProvider>{children}</AssistantDockProvider>
      <Toaster />
    </>
  )
}
