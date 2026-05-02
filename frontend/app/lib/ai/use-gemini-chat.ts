"use client"

import * as React from "react"

import { useChat, type UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport, type ChatOnFinishCallback } from "ai"

export function useGeminiChat(opts?: {
  id?: string
  initialMessages?: UIMessage[]
  /** @deprecated Prefer naming this 'afterReply'; kept for callers. Runs when the assistant message has finished streaming. */
  onResponse?: () => void
  onFinish?: ChatOnFinishCallback<UIMessage>
}) {
  const sessionIdRef = React.useRef(opts?.id)
  sessionIdRef.current = opts?.id

  const callbacksRef = React.useRef({ onFinish: opts?.onFinish, onResponse: opts?.onResponse })
  callbacksRef.current = { onFinish: opts?.onFinish, onResponse: opts?.onResponse }

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        credentials: "same-origin",
        headers: (): Record<string, string> => {
          if (typeof window === "undefined") return {}
          const token = localStorage.getItem("access_token")?.trim()
          if (!token) return {}
          return { Authorization: `Bearer ${token}` }
        },
        body: () => {
          let access_token: string | undefined
          if (typeof window !== "undefined") {
            const t = localStorage.getItem("access_token")?.trim()
            if (t) access_token = t
          }
          return {
            id: sessionIdRef.current,
            ...(access_token ? { access_token } : {}),
          }
        },
      }),
    [],
  )

  const onFinish = React.useCallback<ChatOnFinishCallback<UIMessage>>((event) => {
    void callbacksRef.current.onFinish?.(event)
    callbacksRef.current.onResponse?.()
  }, [])

  return useChat({
    id: opts?.id,
    messages: opts?.initialMessages,
    transport,
    onFinish,
  })
}
