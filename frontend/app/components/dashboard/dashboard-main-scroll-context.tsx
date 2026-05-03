"use client"

import * as React from "react"

export const DashboardMainScrollElementContext = React.createContext<HTMLDivElement | null>(null)

export function useDashboardMainScrollElement() {
  return React.useContext(DashboardMainScrollElementContext)
}
