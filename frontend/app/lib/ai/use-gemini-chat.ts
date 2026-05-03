"use client"

import * as React from "react"

import { useChat, type UIMessage } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  type ChatOnErrorCallback,
  type ChatOnFinishCallback,
} from "ai"

import type { AssistantClientPagePayload } from "~/lib/ai/assistant-client-page-context"

export function useGeminiChat(opts?: {
  id?: string
  initialMessages?: UIMessage[]
  /** Runs once the assistant message finishes streaming successfully or stops. */
  onResponse?: () => void
  onFinish?: ChatOnFinishCallback<UIMessage>
  onError?: ChatOnErrorCallback
  /** Updated each render; read at send time so `/api/chat` gets pathname + UI snapshots. */
  clientPagePayloadRef?: React.MutableRefObject<AssistantClientPagePayload | null>
}) {
  const sessionIdRef = React.useRef(opts?.id)
  sessionIdRef.current = opts?.id

  const clientPagePayloadRef = opts?.clientPagePayloadRef

  const callbacksRef = React.useRef({
    onFinish: opts?.onFinish,
    onResponse: opts?.onResponse,
    onError: opts?.onError,
  })
  callbacksRef.current = {
    onFinish: opts?.onFinish,
    onResponse: opts?.onResponse,
    onError: opts?.onError,
  }

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
          const pagePayload = clientPagePayloadRef?.current ?? undefined
          return {
            id: sessionIdRef.current,
            ...(access_token ? { access_token } : {}),
            ...(pagePayload ? { clientPageContext: pagePayload } : {}),
          }
        },
      }),
    [clientPagePayloadRef],
  )

  const onFinish = React.useCallback<ChatOnFinishCallback<UIMessage>>((event) => {
    void callbacksRef.current.onFinish?.(event)
    if (!event.isError && !event.isAbort && !event.isDisconnect) {
      callbacksRef.current.onResponse?.()
    }
  }, [])

  const onError = React.useCallback<ChatOnErrorCallback>((error) => {
    callbacksRef.current.onError?.(error)
  }, [])

  return useChat({
    id: opts?.id,
    messages: opts?.initialMessages,
    transport,
    onFinish,
    onError,
  })
}
