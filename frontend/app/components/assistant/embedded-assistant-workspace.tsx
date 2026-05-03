"use client"

import * as React from "react"
import type { UIMessage } from "@ai-sdk/react"
import { Loader2, X } from "lucide-react"

import { GeminiChatPanel } from "~/components/assistant/gemini-chat-panel"
import { ChatHistorySidebar, type ChatSession } from "~/components/assistant/chat-history-sidebar"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import {
  CHAT_LAST_SESSION_KEY,
  chatItemsToUIMessages,
  HISTORY_PAGE_SIZE,
} from "~/lib/assistant-chat-helpers"
import { getPublicApiBaseUrl } from "~/lib/public-api-base-url"
import { cn } from "~/lib/utils"

export function EmbeddedAssistantWorkspace({
  onRequestClose,
  className,
}: {
  onRequestClose?: () => void
  className?: string
}) {
  const [sessions, setSessions] = React.useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null)
  const [initialMessages, setInitialMessages] = React.useState<UIMessage[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = React.useState(true)
  const [chatReady, setChatReady] = React.useState(false)

  const reloadSessionList = React.useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return
      const apiBaseUrl = getPublicApiBaseUrl()
      const res = await fetch(`${apiBaseUrl}/chat-history/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setSessions((await res.json()) as ChatSession[])
      } else {
        console.error("[assistant-dock] reloadSessionList failed:", res.status, await res.text())
      }
    } catch (e) {
      console.error("Failed to load chat sessions:", e)
    }
  }, [])

  const bootstrap = React.useCallback(async () => {
    setChatReady(false)
    setIsLoadingSessions(true)
    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        setCurrentSessionId(crypto.randomUUID())
        setInitialMessages([])
        setSessions([])
        return
      }
      const apiBaseUrl = getPublicApiBaseUrl()
      const sessRes = await fetch(`${apiBaseUrl}/chat-history/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      let list: ChatSession[] = []
      if (sessRes.ok) {
        list = (await sessRes.json()) as ChatSession[]
      } else {
        console.error("[assistant-dock] GET sessions failed:", sessRes.status, await sessRes.text())
      }
      setSessions(list)

      if (list.length === 0) {
        const id = crypto.randomUUID()
        setCurrentSessionId(id)
        setInitialMessages([])
        localStorage.setItem(CHAT_LAST_SESSION_KEY, id)
      } else {
        const stored = localStorage.getItem(CHAT_LAST_SESSION_KEY)
        const resolvedId =
          stored && list.some((s) => String(s.session_id) === stored)
            ? stored
            : String(list[0].session_id)
        setCurrentSessionId(resolvedId)
        localStorage.setItem(CHAT_LAST_SESSION_KEY, resolvedId)

        const msgUrl = `${apiBaseUrl}/chat-history?${new URLSearchParams({
          session_id: resolvedId,
          page: "1",
          page_size: String(HISTORY_PAGE_SIZE),
        })}`
        const histRes = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (histRes.ok) {
          const data = (await histRes.json()) as { items?: unknown[] }
          setInitialMessages(chatItemsToUIMessages(data.items ?? []))
        } else {
          setInitialMessages([])
          console.error("[assistant-dock] GET history failed:", histRes.status, await histRes.text())
        }
      }
    } catch (e) {
      console.error("Assistant dock bootstrap:", e)
      const id = crypto.randomUUID()
      setCurrentSessionId(id)
      setInitialMessages([])
      localStorage.setItem(CHAT_LAST_SESSION_KEY, id)
    } finally {
      setIsLoadingSessions(false)
      setChatReady(true)
    }
  }, [])

  React.useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const handleSelectSession = React.useCallback(async (sessionId: string) => {
    localStorage.setItem(CHAT_LAST_SESSION_KEY, sessionId)
    setCurrentSessionId(sessionId)
    setInitialMessages([])
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return
      const apiBaseUrl = getPublicApiBaseUrl()
      const msgUrl = `${apiBaseUrl}/chat-history?${new URLSearchParams({
        session_id: sessionId,
        page: "1",
        page_size: String(HISTORY_PAGE_SIZE),
      })}`
      const res = await fetch(msgUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = (await res.json()) as { items?: unknown[] }
        setInitialMessages(chatItemsToUIMessages(data.items ?? []))
      } else {
        console.error("[assistant-dock] GET /chat-history failed:", res.status, await res.text())
        setInitialMessages([])
      }
    } catch (e) {
      console.error("Failed to load chat messages:", e)
    }
  }, [])

  const handleNewChat = React.useCallback(() => {
    const id = crypto.randomUUID()
    setCurrentSessionId(id)
    setInitialMessages([])
    localStorage.setItem(CHAT_LAST_SESSION_KEY, id)
  }, [])

  const handleActivity = React.useCallback(() => {
    setTimeout(reloadSessionList, 800)
  }, [reloadSessionList])

  const handleOptimisticSession = React.useCallback((text: string) => {
    const sid = currentSessionId
    if (!sid) return
    setSessions((prev) => {
      if (prev.some((s) => String(s.session_id) === sid)) return prev
      return [
        {
          session_id: sid,
          title: text.length > 50 ? text.slice(0, 50) + "..." : text,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]
    })
  }, [currentSessionId])

  const [dockHistoryRailExpanded, setDockHistoryRailExpanded] = React.useState(false)

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background", className)}>
      {onRequestClose ? (
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-2 sm:px-3">
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            AI assistant
          </span>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onRequestClose}
                aria-label="Close assistant panel"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent variant="inverted">Close assistant panel</TooltipContent>
          </Tooltip>
        </div>
      ) : null}

      <div className="relative flex min-h-0 min-w-0 flex-1 basis-0 overflow-hidden pb-2">
        <div
          className={cn(
            "relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-0",
            dockHistoryRailExpanded ? "px-2 sm:px-3" : "pl-12 pr-2 sm:pr-3",
          )}
        >
          <p className="sr-only">
            Ask markets, news, or watchlists. History syncs with the Chat page.
          </p>
          {chatReady && currentSessionId ? (
            <GeminiChatPanel
              key={currentSessionId}
              variant="dock"
              id={currentSessionId}
              initialMessages={initialMessages}
              onActivity={handleActivity}
              onNewMessage={handleOptimisticSession}
              className="min-h-0 min-w-0 flex-1 basis-0"
            />
          ) : (
            <div className="flex min-h-0 flex-1 basis-0 items-center justify-center text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
            </div>
          )}
        </div>
        <ChatHistorySidebar
          collapsible
          defaultOpen={false}
          density="dock"
          sessions={sessions}
          currentSessionId={currentSessionId ?? ""}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          isLoading={isLoadingSessions}
          onDockRailExpandedChange={setDockHistoryRailExpanded}
        />
      </div>
    </div>
  )
}
