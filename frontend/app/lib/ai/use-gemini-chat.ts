"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"

const transport = new DefaultChatTransport({ api: "/api/chat" })

/**
 * Client hook for streaming chat with Gemini (`POST /api/chat`).
 * Requires `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` on the server (same key).
 */
export function useGeminiChat() {
  return useChat({ transport })
}
