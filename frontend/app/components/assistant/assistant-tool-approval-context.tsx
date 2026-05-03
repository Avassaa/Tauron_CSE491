"use client"

import * as React from "react"

import type { ChatAddToolApproveResponseFunction } from "ai"

export const AssistantToolApprovalContext = React.createContext<ChatAddToolApproveResponseFunction | null>(null)

export function useAssistantToolApproval(): ChatAddToolApproveResponseFunction | null {
  return React.useContext(AssistantToolApprovalContext)
}
