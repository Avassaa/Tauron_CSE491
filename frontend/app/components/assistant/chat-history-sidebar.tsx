"use client"

import * as React from "react"
import { Loader2, Menu, MessageSquare, MoreVertical, Search, SquarePen, Trash2 } from "lucide-react"

import { DeleteChatConfirmDialog } from "~/components/assistant/delete-chat-confirm-dialog"
import { glassPanelSurface } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export type ChatSession = {
  session_id: string
  title: string
  created_at: string
}

const geminiIconBtn =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"

const dockHistoryRailSurface = cn(
  glassPanelSurface,
  "text-foreground shadow-[inset_-1px_0_0_rgba(0,0,0,0.04)] dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]",
)

const sessionPopoverContent =
  "w-44 border-border bg-popover p-1 text-popover-foreground shadow-xl"

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
  onDeleteSession,
  onClearAllSessions,
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
  /** Permanently remove one conversation from the server (and local list). */
  onDeleteSession?: (id: string) => void | Promise<void>
  /** Remove every stored chat for this user. */
  onClearAllSessions?: () => void | Promise<void>
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
  const [sessionMenuOpenId, setSessionMenuOpenId] = React.useState<string | null>(null)
  const [deleteOneOpen, setDeleteOneOpen] = React.useState(false)
  const [deleteOneTarget, setDeleteOneTarget] = React.useState<{ id: string; title: string } | null>(null)
  const [clearAllOpen, setClearAllOpen] = React.useState(false)

  const useDockOverlay = density === "dock" && collapsible

  React.useEffect(() => {
    if (!useDockOverlay) return
    onDockRailExpandedChange?.(historyOpen)
  }, [historyOpen, useDockOverlay, onDockRailExpandedChange])

  const open = !collapsible || historyOpen
  const showNewChatLabel = !(compact ?? false)

  const expandedWidth =
    density === "dock" ? "w-[9.875rem] min-w-[9.875rem] sm:w-[16.25rem] sm:min-w-[16.25rem]" : "w-64 min-w-64"

  const collapsedWidth = "w-12 min-w-12"

  const visibleSessions =
    searchQuery.trim() ?
      sessions.filter((s) => s.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      : sessions

  const rail = (
    <div
      className={cn(
        "flex h-full max-w-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 motion-reduce:transition-none",
        dockHistoryRailSurface,
        useDockOverlay && "absolute left-0 top-0 z-30 h-full shadow-[4px_0_24px_rgba(0,0,0,0.14)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.35)]",
        open ? expandedWidth : collapsedWidth,
        className,
      )}
    >
      {collapsible && !open ? (
        <div className="flex flex-col items-center gap-1 border-sidebar-border border-b py-2">
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
                  "h-auto w-full justify-start gap-3 rounded-xl py-3 pl-3 pr-2 text-left font-normal text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  !showNewChatLabel && "justify-center px-2 py-2.5",
                )}
                onClick={onNewChat}
              >
                <SquarePen className="h-5 w-5 shrink-0 text-sidebar-foreground/70" aria-hidden />
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
                    "w-full rounded-lg border border-sidebar-border bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
                    "focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/40",
                  )}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </label>
            ) : null}
          </div>

          <ScrollArea className={cn("min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden", density === "dock" ? "px-2 pb-4 sm:px-3" : "px-2 pb-4 sm:px-3")}>
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
              <div className="flex w-full min-w-0 max-w-full flex-col gap-0.5 pb-2">
                {visibleSessions.map((session) => (
                  <div
                    key={session.session_id}
                    className={cn(
                      "group relative w-full min-w-0 max-w-full overflow-hidden rounded-xl transition-colors",
                      currentSessionId === session.session_id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
                    )}
                  >
                    <InvertedTip label={session.title}>
                      <button
                        type="button"
                        onClick={() => onSelectSession(session.session_id)}
                        className={cn(
                          "flex min-h-[2.5rem] w-full min-w-0 max-w-full items-center gap-2 overflow-hidden py-2 text-left transition-colors sm:gap-3",
                          onDeleteSession ? "pl-2.5 pr-10 sm:pl-3 sm:pr-11" : "px-2.5 sm:px-3",
                          density === "dock" ? "text-xs sm:text-sm" : "py-2.5 text-sm",
                          currentSessionId === session.session_id ?
                            "font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                        )}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-start">{session.title}</span>
                      </button>
                    </InvertedTip>
                    {onDeleteSession ?
                      <div className="absolute inset-y-0 right-0 z-10 flex items-center">
                        <Popover
                          open={sessionMenuOpenId === session.session_id}
                          onOpenChange={(next) => setSessionMenuOpenId(next ? session.session_id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-full min-h-[2.5rem] shrink-0 rounded-none rounded-r-xl px-2 text-sidebar-foreground/60 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent/80 data-[state=open]:bg-sidebar-accent/80 sm:px-2.5",
                                density === "dock" && "px-1.5 sm:px-2",
                              )}
                              aria-label={`Chat options: ${session.title}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            side="right"
                            className={sessionPopoverContent}
                            onCloseAutoFocus={(e) => e.preventDefault()}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-9 w-full justify-start gap-2 rounded-md px-2 text-sm font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                setSessionMenuOpenId(null)
                                setDeleteOneTarget({ id: session.session_id, title: session.title })
                                setDeleteOneOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                              Delete chat
                            </Button>
                          </PopoverContent>
                        </Popover>
                      </div>
                    : null}
                  </div>
                ))}
                {onClearAllSessions && sessions.length > 0 ?
                  <div className="mt-2 border-sidebar-border border-t pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start gap-2 rounded-xl py-2.5 pl-3 pr-2 text-left text-xs text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setClearAllOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Clear all chats
                    </Button>
                  </div>
                  : null}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  )

  const dialogs = (
    <>
      <DeleteChatConfirmDialog
        open={deleteOneOpen}
        onOpenChange={(o) => {
          setDeleteOneOpen(o)
          if (!o) setDeleteOneTarget(null)
        }}
        title="Delete this chat?"
        description={
          deleteOneTarget ?
            `“${deleteOneTarget.title.length > 80 ? `${deleteOneTarget.title.slice(0, 80)}…` : deleteOneTarget.title}” will be removed from your history. This cannot be undone.`
            : "This conversation will be removed from your history. This cannot be undone."
        }
        confirmLabel="Delete chat"
        onConfirm={async () => {
          if (deleteOneTarget && onDeleteSession) await onDeleteSession(deleteOneTarget.id)
        }}
      />
      <DeleteChatConfirmDialog
        open={clearAllOpen}
        onOpenChange={setClearAllOpen}
        title="Clear all chats?"
        description="Every assistant conversation in your history will be deleted. This cannot be undone."
        confirmLabel="Clear all"
        onConfirm={async () => {
          if (onClearAllSessions) await onClearAllSessions()
        }}
      />
    </>
  )

  if (!useDockOverlay) {
    return (
      <>
        {rail}
        {dialogs}
      </>
    )
  }

  return (
    <>
      {historyOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-20 bg-background/45 backdrop-blur-sm transition-opacity dark:bg-background/80 dark:backdrop-blur-md motion-reduce:backdrop-blur-none"
          aria-label="Close chat history menu"
          onClick={() => {
            setSearchOpen(false)
            setHistoryOpen(false)
          }}
        />
      ) : null}
      {rail}
      {dialogs}
    </>
  )
}
