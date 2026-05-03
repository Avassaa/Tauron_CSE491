"use client"

import * as React from "react"
import { useLocation } from "react-router"

import {
  buildAssistantPagePayload,
  type AssistantClientPagePayload,
  type AssistantToolsUiContext,
} from "~/lib/ai/assistant-client-page-context"

type AssistantChatExtrasValue = {
  toolsOverlay: AssistantToolsUiContext | null
  setToolsOverlay: React.Dispatch<React.SetStateAction<AssistantToolsUiContext | null>>
}

const AssistantChatExtrasContext = React.createContext<AssistantChatExtrasValue | null>(null)

export function AssistantChatExtrasProvider({ children }: { children: React.ReactNode }) {
  const [toolsOverlay, setToolsOverlay] = React.useState<AssistantToolsUiContext | null>(null)

  const value = React.useMemo(
    () => ({
      toolsOverlay,
      setToolsOverlay,
    }),
    [toolsOverlay],
  )

  return (
    <AssistantChatExtrasContext.Provider value={value}>{children}</AssistantChatExtrasContext.Provider>
  )
}

export function useAssistantChatExtras(): AssistantChatExtrasValue {
  const ctx = React.useContext(AssistantChatExtrasContext)
  if (!ctx) {
    throw new Error("useAssistantChatExtras must be used within AssistantChatExtrasProvider")
  }
  return ctx
}

export function useAssistantClientPagePayload(): AssistantClientPagePayload {
  const location = useLocation()
  const { toolsOverlay } = useAssistantChatExtras()

  return React.useMemo(
    () =>
      buildAssistantPagePayload({
        pathname: location.pathname,
        tools: location.pathname.startsWith("/tools") ? toolsOverlay : null,
      }),
    [location.pathname, toolsOverlay],
  )
}
