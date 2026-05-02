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
          console.error(
            "[chat] GET /chat-history failed:",
            histRes.status,
            histRes.statusText,
            await histRes.text(),
          )
        }
      }
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

  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <MarketMarqueeBanner />
        <SidebarInset
          style={{
            paddingTop: "var(--market-banner-offset, 0px)",
          }}
        >
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
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
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span className="inline-flex rounded-md">
                    <span className="font-medium">AI Chat</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent variant="inverted" side="bottom">
                  Full-screen assistant workspace
                </TooltipContent>
              </Tooltip>
            </div>
            <NotificationInbox />
          </header>
          
          <div className="flex flex-1 min-h-0 w-full overflow-hidden">
            <ChatHistorySidebar
              collapsible
              defaultOpen={true}
              density="standard"
              sessions={sessions}
              currentSessionId={currentSessionId ?? ""}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              isLoading={isLoadingSessions}
            />
            
            <div className="flex min-w-0 flex-1 flex-col gap-3 px-5 py-5 pb-8 sm:px-8 sm:py-6 md:px-10">
              <p className="shrink-0 text-sm text-muted-foreground">
                Chat with Tauron&apos;s assistant—quick answers and explanations, right in your workspace.
              </p>
              {chatReady && currentSessionId ? (
                /* Force remount when session changes to reset internal SDK state safely */
                <GeminiChatPanel
                  key={currentSessionId}
                  id={currentSessionId}
                  initialMessages={initialMessages}
                  onActivity={handleActivity}
                  onNewMessage={handleOptimisticSession}
                  className="min-h-0 flex-1"
                />
              ) : (
                <div className="flex min-h-[min(280px,calc(100svh-280px))] flex-1 items-center justify-center text-muted-foreground">
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
