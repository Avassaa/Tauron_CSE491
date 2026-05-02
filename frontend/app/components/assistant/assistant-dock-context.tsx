"use client"

import * as React from "react"

type AssistantDockContextValue = {
  open: boolean
  setOpen: (next: boolean) => void
  toggle: () => void
}

const AssistantDockContext = React.createContext<AssistantDockContextValue | null>(null)

export function AssistantDockProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  const value = React.useMemo(
    (): AssistantDockContextValue => ({
      open,
      setOpen,
      toggle: () => setOpen((o) => !o),
    }),
    [open],
  )

  return <AssistantDockContext.Provider value={value}>{children}</AssistantDockContext.Provider>
}

export function useAssistantDock() {
  const ctx = React.useContext(AssistantDockContext)
  if (!ctx) {
    throw new Error("useAssistantDock must be used within AssistantDockProvider")
  }
  return ctx
}
