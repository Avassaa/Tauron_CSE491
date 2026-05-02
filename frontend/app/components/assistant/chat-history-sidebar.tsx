"use client"

import * as React from "react"
import { MessageSquarePlus, MessageSquare, Loader2 } from "lucide-react"

import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { cn } from "~/lib/utils"

export type ChatSession = {
  session_id: string
  title: string
  created_at: string
}

export function ChatHistorySidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  isLoading,
  className,
  compact,
}: {
  sessions: ChatSession[]
  currentSessionId: string
  onSelectSession: (id: string) => void
  onNewChat: () => void
  isLoading?: boolean
  className?: string
  /** Icon-only new chat (narrow sidebars / dock). */
  compact?: boolean
}) {
  return (
    <div className={cn("flex h-full w-64 shrink-0 flex-col border-r bg-muted/20", className)}>
      <div className={cn("p-4", compact && "p-2")}>
        <Button
          onClick={onNewChat}
          className={cn("w-full justify-start gap-2", compact && "justify-center px-0")}
          variant="outline"
          size={compact ? "icon" : "default"}
          title="New chat"
          aria-label="New chat"
        >
          <MessageSquarePlus className="h-4 w-4" />
          {!compact ? <span>New Chat</span> : null}
        </Button>
      </div>
      <ScrollArea className={cn("flex-1 px-3 pb-4", compact && "px-1.5")}>
        {isLoading ? (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No previous chats.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sessions.map((session) => (
              <button
                key={session.session_id}
                onClick={() => onSelectSession(session.session_id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  currentSessionId === session.session_id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={session.title}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">{session.title}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
