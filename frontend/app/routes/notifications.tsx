"use client"

import * as React from "react"
import { AlarmClock, Bell, Check, CheckCheck, ChevronDown, Info, SlidersHorizontal } from "lucide-react"

import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { Button } from "~/components/ui/button"
import { glassPanelSurface } from "~/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Separator } from "~/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Skeleton } from "~/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { apiGet, apiPatch, type NotificationResponse, type PaginatedResponse } from "~/lib/api-client"
import { subscribeToNotificationPush } from "~/lib/notification-stream"
import { cn } from "~/lib/utils"
import { AuthGuard } from "~/components/auth-guard"

function formatRelativeTime(value: string): string {
  const createdAt = new Date(value).getTime()
  const diffSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000))
  if (diffSeconds < 60) return "just now"
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function getNotificationCondition(item: NotificationResponse) {
  const condition = item.payload?.condition
  return condition === "above" || condition === "below" ? condition : null
}

function NotificationIcon({ item }: { item: NotificationResponse }) {
  if (item.type === "price_alert") return <AlarmClock className="size-4" />
  return <Info className="size-4" />
}

type NotificationFilter = "all" | "unread" | "read"

const NOTIFICATION_FILTER_OPTIONS: { value: NotificationFilter; label: string; description: string }[] = [
  { value: "all", label: "All", description: "Every notification" },
  { value: "unread", label: "Unread", description: "Not marked as read" },
  { value: "read", label: "Read", description: "Already opened" },
]

export default function NotificationsPage() {
  const mainScrollRef = React.useRef<HTMLDivElement>(null)
  const [items, setItems] = React.useState<NotificationResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [filter, setFilter] = React.useState<NotificationFilter>("all")

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiGet<PaginatedResponse<NotificationResponse>>("/users/me/notifications", {
        page_size: 50,
      })
      setItems(response.items)
    } catch {
      setItems([])
      setError("Could not load notifications.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  React.useEffect(() => {
    return subscribeToNotificationPush((notification) => {
      setItems((prev) => {
        if (prev.some((item) => item.id === notification.id)) return prev
        return [notification, ...prev].slice(0, 50)
      })
    })
  }, [])

  const markRead = async (id: string) => {
    try {
      await apiPatch<NotificationResponse>(`/users/me/notifications/${id}/read`)
      await refresh()
    } catch {
      setError("Could not update this notification.")
    }
  }

  const markAllRead = async () => {
    try {
      await apiPatch<{ updated: number }>("/users/me/notifications/read-all")
      await refresh()
    } catch {
      setError("Could not mark notifications as read.")
    }
  }

  const unreadCount = items.filter((item) => !item.is_read).length

  const filteredItems = React.useMemo(() => {
    if (filter === "unread") return items.filter((i) => !i.is_read)
    if (filter === "read") return items.filter((i) => i.is_read)
    return items
  }, [items, filter])

  const filterLabel = NOTIFICATION_FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? "All"

  return (
    <AuthGuard>
      <SidebarProvider className="h-svh max-h-[100svh] min-h-0 overflow-hidden">
        <AppSidebar />
        <MarketMarqueeBanner />
        <SidebarInset
          className="flex min-h-0 flex-col overflow-hidden"
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
                    <span className="font-medium">Notifications</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent variant="inverted" side="bottom">
                  All alerts and system messages
                </TooltipContent>
              </Tooltip>
            </div>
            <NotificationInbox />
          </header>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div ref={mainScrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto p-4 scrollbar-none">
              <section className="space-y-5">
                <div
                  className={cn(
                    glassPanelSurface,
                    "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border-border/55 bg-white/80 px-5 py-4 shadow-sm backdrop-blur-xl backdrop-saturate-125 dark:bg-background/45",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <Bell className="size-4 text-primary" />
                      Notification inbox
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {unreadCount > 0
                        ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                        : "You are all caught up."}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-10 rounded-2xl px-3 text-[10px] font-black uppercase tracking-wider">
                          <SlidersHorizontal className="mr-1 size-3.5" />
                          {filterLabel}
                          <ChevronDown className="ml-1 size-3 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {NOTIFICATION_FILTER_OPTIONS.map((option) => (
                          <DropdownMenuItem
                            key={option.value}
                            onSelect={() => setFilter(option.value)}
                            className="flex cursor-pointer items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold">{option.label}</div>
                              <div className="text-[10px] text-muted-foreground">{option.description}</div>
                            </div>
                            {filter === option.value ? <Check className="size-3 shrink-0 text-primary" aria-hidden /> : null}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {unreadCount === 0 ? (
                      <Button type="button" variant="outline" className="gap-2" disabled>
                        <CheckCheck className="size-4" />
                        Mark all read
                      </Button>
                    ) : (
                      <Tooltip delayDuration={400}>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="outline" className="gap-2" onClick={markAllRead}>
                            <CheckCheck className="size-4" />
                            Mark all read
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent variant="inverted" side="left">
                          Mark every notification as read
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    glassPanelSurface,
                    "overflow-hidden rounded-2xl border-border/55 bg-white/80 shadow-sm backdrop-blur-xl backdrop-saturate-125 dark:bg-background/45",
                  )}
                >
                  <div className="border-b border-border/40 bg-white/50 px-5 py-4 backdrop-blur-md dark:bg-background/30">
                    <div className="text-xl font-semibold">All notifications</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Price alert notifications and future system messages appear here.
                    </p>
                  </div>

                  {error ? (
                    <div className="border-b border-destructive/30 bg-destructive/10 px-5 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                  {loading ? (
                    <div className="space-y-3 p-5">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                      {items.length === 0 ? "No notifications yet." : "No notifications match this filter."}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredItems.map((item) => (
                        (() => {
                          const condition = getNotificationCondition(item)
                          return (
                        <button
                          key={item.id}
                          type="button"
                          className={cn(
                            "relative flex w-full gap-4 px-5 py-4 text-left transition-colors",
                            item.is_read ?
                              "bg-transparent text-muted-foreground hover:bg-white/55 dark:hover:bg-white/[0.04]"
                            : "bg-primary/8 text-foreground shadow-[inset_4px_0_0_hsl(var(--primary))] backdrop-blur-sm hover:bg-primary/12 dark:bg-primary/12",
                          )}
                          onClick={() => {
                            if (!item.is_read) void markRead(item.id)
                          }}
                        >
                          <div
                            className={cn(
                              "mt-0.5 flex size-9 shrink-0 items-center justify-center",
                              item.is_read ? "text-muted-foreground" : "text-primary",
                            )}
                          >
                            <NotificationIcon item={item} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className={cn(
                                    "truncate",
                                    item.is_read ? "font-medium text-muted-foreground" : "font-semibold text-foreground"
                                  )}
                                >
                                  {item.title}
                                </span>
                                {condition ? (
                                  <span
                                    className={cn(
                                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                                      condition === "above"
                                        ? "bg-green-500/10 text-green-600"
                                        : "bg-red-500/10 text-red-600"
                                    )}
                                  >
                                    {condition}
                                  </span>
                                ) : null}
                                {!item.is_read ? (
                                  <span className="size-2 rounded-full bg-blue-500" aria-label="Unread" />
                                ) : null}
                              </div>
                              <span className={cn("shrink-0 text-sm", item.is_read ? "text-muted-foreground" : "font-medium text-foreground")}>
                                {formatRelativeTime(item.created_at)}
                              </span>
                            </div>
                            <p className={cn("mt-1 text-sm", item.is_read ? "text-muted-foreground" : "text-foreground/80")}>
                              {item.message}
                            </p>
                          </div>
                        </button>
                          )
                        })()
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}
