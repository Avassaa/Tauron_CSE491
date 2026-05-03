"use client"

import * as React from "react"
import { Loader2, Menu, MessageSquare, Search, SquarePen } from "lucide-react"

import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export type ChatSession = {
  session_id: string
  title: string
  created_at: string
}

const geminiIconBtn =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"

const geminiShell =
  "border-zinc-700/80 bg-[#1e1f20] text-zinc-100 shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] dark:border-zinc-700 dark:bg-[#1e1f20]"

function InvertedTip({ label, side = "bottom", children }: { label: string; side?: "bottom" | "top" | "left" | "right"; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} variant="inverted">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function ChatHistorySidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  isLoading,
  className,
  compact,
  collapsible = false,
  defaultOpen = true,
  density = "standard",
  onDockRailExpandedChange,
}: {
  sessions: ChatSession[]
  currentSessionId: string
  onSelectSession: (id: string) => void
  onNewChat: () => void
  isLoading?: boolean
  className?: string
  compact?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
  density?: "standard" | "dock"
  /** Dock + collapsible only: `true` when the wide history panel is open (overlay mode). */
  onDockRailExpandedChange?: (expanded: boolean) => void
}) {
  const [historyOpen, setHistoryOpen] = React.useState(defaultOpen)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const useDockOverlay = density === "dock" && collapsible

  React.useEffect(() => {
    if (!useDockOverlay) return
    onDockRailExpandedChange?.(historyOpen)
  }, [historyOpen, useDockOverlay, onDockRailExpandedChange])

  const open = !collapsible || historyOpen
  const showNewChatLabel = !(compact ?? false)

  const expandedWidth =
    density === "dock" ? "w-[7.875rem] min-w-[7.875rem] sm:w-[13rem] sm:min-w-[13rem]" : "w-64 min-w-64"

  const collapsedWidth = "w-12 min-w-12"

  const visibleSessions =
    searchQuery.trim() ?
      sessions.filter((s) => s.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : sessions

  const rail = (
    <div
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 motion-reduce:transition-none",
        geminiShell,
        useDockOverlay && "absolute left-0 top-0 z-30 h-full shadow-[4px_0_24px_rgba(0,0,0,0.18)]",
        open ? expandedWidth : collapsedWidth,
        className,
      )}
    >
      {collapsible && !open ? (
        <div className="flex flex-col items-center gap-1 border-zinc-700/70 border-b py-2">
          <InvertedTip label="Expand menu" side="right">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={geminiIconBtn}
              aria-label="Expand chat history menu"
              aria-expanded={false}
              onClick={() => setHistoryOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </Button>
          </InvertedTip>
          <InvertedTip label="New chat" side="right">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={geminiIconBtn}
              aria-label="New chat"
              onClick={onNewChat}
            >
              <SquarePen className="h-5 w-5" aria-hidden />
            </Button>
          </InvertedTip>
          <InvertedTip label="Search chats" side="right">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={geminiIconBtn}
              aria-label="Search chats"
              onClick={() => {
                setSearchOpen(true)
                setHistoryOpen(true)
              }}
            >
              <Search className="h-5 w-5" aria-hidden />
            </Button>
          </InvertedTip>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-1 px-2 py-2.5 sm:gap-2 sm:px-3">
            {collapsible ? (
              <InvertedTip label="Collapse menu">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={geminiIconBtn}
                  aria-label="Collapse chat history menu"
                  aria-expanded={true}
                  onClick={() => {
                    setSearchOpen(false)
                    setHistoryOpen(false)
                  }}
                >
                  <Menu className="h-5 w-5" aria-hidden />
                </Button>
              </InvertedTip>
            ) : (
              <span className="min-w-[2.5rem]" aria-hidden />
            )}
            <InvertedTip label="Search chats">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={geminiIconBtn}
                aria-label="Search chats"
                aria-pressed={searchOpen}
                onClick={() => setSearchOpen((v) => !v)}
              >
                <Search className="h-5 w-5" aria-hidden />
              </Button>
            </InvertedTip>
          </div>

          <div className="px-2 pb-2 sm:px-3">
            <InvertedTip label="Start a new conversation">
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start gap-3 rounded-xl py-3 pl-3 pr-2 text-left font-normal text-zinc-200 hover:bg-white/10 hover:text-white",
                  !showNewChatLabel && "justify-center px-2 py-2.5",
                )}
                onClick={onNewChat}
              >
                <SquarePen className="h-5 w-5 shrink-0 text-zinc-300" aria-hidden />
                {showNewChatLabel ? (
                  <>
                    <span className={cn(density === "dock" ? "truncate text-[13px] sm:text-[15px]" : "truncate text-[15px]")}>
                      New chat
                    </span>
                  </>
                ) : null}
              </Button>
            </InvertedTip>

            {searchOpen ? (
              <label className="mt-2 block">
                <span className="sr-only">Search conversations</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats…"
                  className={cn(
                    "w-full rounded-lg border border-zinc-600/90 bg-black/35 px-3 py-2 text-sm text-white placeholder:text-zinc-500",
                    "focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/40",
                  )}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </label>
            ) : null}
          </div>

          <ScrollArea className={cn("min-h-0 flex-1", density === "dock" ? "px-2 pb-4 sm:px-3" : "px-2 pb-4 sm:px-3")}>
            {isLoading ? (
              <div className="flex items-center justify-center p-6 text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div
                className={cn(
                  "px-2 text-center text-zinc-500",
                  density === "dock" ? "py-6 text-[11px] leading-snug sm:text-xs" : "py-8 text-sm",
                )}
              >
                No previous chats.
              </div>
            ) : visibleSessions.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-zinc-500">No chats match your search.</div>
            ) : (
              <div className="flex flex-col gap-0.5 pr-2 pb-2">
                {visibleSessions.map((session) => (
                  <InvertedTip label={session.title} key={session.session_id}>
                    <button
                      type="button"
                      onClick={() => onSelectSession(session.session_id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        density === "dock" ? "text-xs sm:text-sm" : "text-sm",
                        currentSessionId === session.session_id ?
                          "bg-white/12 font-medium text-white"
                        : "text-zinc-400 hover:bg-white/8 hover:text-zinc-100",
                      )}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      <span className="truncate">{session.title}</span>
                    </button>
                  </InvertedTip>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  )

  if (!useDockOverlay) {
    return rail
  }

  return (
    <>
      {historyOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-20 bg-black/45 backdrop-blur-[1px] transition-opacity motion-reduce:backdrop-blur-none"
          aria-label="Close chat history menu"
          onClick={() => {
            setSearchOpen(false)
            setHistoryOpen(false)
          }}
        />
      ) : null}
      {rail}
    </>
  )
}
