"use client"

import * as React from "react"
import { useLocation } from "react-router"

import {
  buildAssistantPagePayload,
  type AssistantClientPagePayload,
  type AssistantDashboardStatsPayload,
  type AssistantSelectedAssetPayload,
  type AssistantToolsUiContext,
} from "~/lib/ai/assistant-client-page-context"

type AssistantChatExtrasValue = {
  toolsOverlay: AssistantToolsUiContext | null
  setToolsOverlay: React.Dispatch<React.SetStateAction<AssistantToolsUiContext | null>>
  assetsUiHints: {
    selectedAsset: AssistantSelectedAssetPayload | null
    dashboardStats: AssistantDashboardStatsPayload | null
  }
  setAssetsUiHints: React.Dispatch<
    React.SetStateAction<{
      selectedAsset: AssistantSelectedAssetPayload | null
      dashboardStats: AssistantDashboardStatsPayload | null
    }>
  >
}

const AssistantChatExtrasContext = React.createContext<AssistantChatExtrasValue | null>(null)

export function AssistantChatExtrasProvider({ children }: { children: React.ReactNode }) {
  const [toolsOverlay, setToolsOverlay] = React.useState<AssistantToolsUiContext | null>(null)
  const [assetsUiHints, setAssetsUiHints] = React.useState<{
    selectedAsset: AssistantSelectedAssetPayload | null
    dashboardStats: AssistantDashboardStatsPayload | null
  }>({ selectedAsset: null, dashboardStats: null })

  const value = React.useMemo(
    () => ({
      toolsOverlay,
      setToolsOverlay,
      assetsUiHints,
      setAssetsUiHints,
    }),
    [toolsOverlay, assetsUiHints],
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
  const { toolsOverlay, assetsUiHints } = useAssistantChatExtras()

  return React.useMemo(
    () =>
      buildAssistantPagePayload({
        pathname: location.pathname,
        tools: location.pathname.startsWith("/tools") ? toolsOverlay : null,
        selectedAsset: assetsUiHints.selectedAsset,
        dashboardStats: assetsUiHints.dashboardStats,
      }),
    [location.pathname, toolsOverlay, assetsUiHints.selectedAsset, assetsUiHints.dashboardStats],
  )
}
