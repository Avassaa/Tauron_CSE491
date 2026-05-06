"use client"

import * as React from "react"

interface DashboardScrollContextType {
  scrollEl: HTMLDivElement | null
  portalEl: HTMLDivElement | null
}

export const DashboardMainScrollElementContext = React.createContext<DashboardScrollContextType>({
  scrollEl: null,
  portalEl: null,
})

export function useDashboardMainScroll() {
  return React.useContext(DashboardMainScrollElementContext)
}

// Keep the old hook for compatibility if needed, but update its implementation
export function useDashboardMainScrollElement() {
  return React.useContext(DashboardMainScrollElementContext).scrollEl
}
