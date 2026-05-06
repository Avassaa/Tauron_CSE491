"use client"

import * as React from "react"
import type { UIMessage } from "@ai-sdk/react"
import { Loader2 } from "lucide-react"

import { GeminiChatPanel } from "~/components/assistant/gemini-chat-panel"
import { ChatHistorySidebar, type ChatSession } from "~/components/assistant/chat-history-sidebar"
import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { AuthGuard } from "~/components/auth-guard"
import { Separator } from "~/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import {
  CHAT_LAST_SESSION_KEY,
  chatItemsToUIMessages,
  HISTORY_PAGE_SIZE,
} from "~/lib/assistant-chat-helpers"
import { getPublicApiBaseUrl } from "~/lib/public-api-base-url"

export default function ChatPage() {
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
        const data = (await res.json()) as ChatSession[]
        setSessions(data)
      } else {
        console.error("[chat] reloadSessionList failed:", res.status, await res.text())
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
        console.error(
          "[chat] GET /chat-history/sessions failed:",
          sessRes.status,
          sessRes.statusText,
          await sessRes.text(),
        )
      }
      setSessions(list)

      // Always open a fresh composer; load a past thread only from the sidebar.
      const id = crypto.randomUUID()
      setCurrentSessionId(id)
      setInitialMessages([])
      localStorage.setItem(CHAT_LAST_SESSION_KEY, id)
    } catch (e) {
      console.error("Failed to bootstrap chat:", e)
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
        console.error("[chat] GET /chat-history failed:", res.status, await res.text())
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

  const handleDeleteSession = React.useCallback(
    async (sessionId: string) => {
      const token = localStorage.getItem("access_token")
      const apiBaseUrl = getPublicApiBaseUrl()
      const wasCurrent = currentSessionId === sessionId

      if (token) {
        const res = await fetch(`${apiBaseUrl}/chat-history/sessions/${encodeURIComponent(sessionId)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok && res.status !== 404) {
          console.error("[chat] DELETE session failed:", res.status, await res.text())
          return
        }
        await reloadSessionList()
      } else {
        setSessions((prev) => prev.filter((s) => String(s.session_id) !== sessionId))
      }

      if (wasCurrent) {
        if (token) {
          const sessRes = await fetch(`${apiBaseUrl}/chat-history/sessions`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (sessRes.ok) {
            const list = (await sessRes.json()) as ChatSession[]
            if (list.length > 0) {
              await handleSelectSession(String(list[0].session_id))
              return
            }
          }
        }
        handleNewChat()
      }
    },
    [currentSessionId, reloadSessionList, handleSelectSession, handleNewChat],
  )

  const handleClearAllSessions = React.useCallback(async () => {
    const token = localStorage.getItem("access_token")
    if (!token) return
    const apiBaseUrl = getPublicApiBaseUrl()
    const res = await fetch(`${apiBaseUrl}/chat-history/sessions`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error("[chat] DELETE all sessions failed:", res.status, await res.text())
      return
    }
    await reloadSessionList()
    handleNewChat()
  }, [reloadSessionList, handleNewChat])

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

  return (
    <AuthGuard>
      <SidebarProvider className="h-svh max-h-[100svh] min-h-0 overflow-hidden">
        <AppSidebar />
        <MarketMarqueeBanner />
        <SidebarInset
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{
            paddingTop: "var(--market-banner-offset, 0px)",
          }}
        >
          <header className="relative z-20 flex min-h-12 shrink-0 items-center justify-between gap-2 border-b bg-background/50 px-4 py-1.5 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span className="inline-flex rounded-md">
                    <SidebarTrigger className="-ml-1" />
                  </span>
                </TooltipTrigger>
                <TooltipContent variant="inverted" side="bottom">
                  Toggle navigation sidebar
                </TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="mr-2 h-4" />
              <div className="min-w-0">
                <span className="font-semibold leading-none text-foreground">Tauron AI Assistant</span>
              </div>
            </div>
            <NotificationInbox />
          </header>
          
          <div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
            <ChatHistorySidebar
              collapsible
              defaultOpen={true}
              density="standard"
              sessions={sessions}
              currentSessionId={currentSessionId ?? ""}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              onClearAllSessions={handleClearAllSessions}
              isLoading={isLoadingSessions}
            />
            
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-5 pb-8 sm:px-8 sm:py-6 md:px-10">
              {chatReady && currentSessionId ? (
                /* Force remount when session changes to reset internal SDK state safely */
                <GeminiChatPanel
                  key={currentSessionId}
                  variant="dock"
                  id={currentSessionId}
                  initialMessages={initialMessages}
                  onActivity={handleActivity}
                  onNewMessage={handleOptimisticSession}
                  onRequestDeleteConversation={
                    currentSessionId ? () => void handleDeleteSession(currentSessionId) : undefined
                  }
                  className="min-h-0 min-w-0 flex-1 basis-0"
                />
              ) : (
                <div className="flex min-h-0 flex-1 basis-0 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
                </div>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}
