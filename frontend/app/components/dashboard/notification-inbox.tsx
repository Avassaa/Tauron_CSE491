"use client"

import * as React from "react"
import { AlarmClock, Bell, CheckCheck, Info, LayoutGrid } from "lucide-react"
import { Link } from "react-router"

import { Button } from "~/components/ui/button"
import { glassPanelSurface } from "~/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { apiGet, apiPatch, type NotificationResponse, type PaginatedResponse } from "~/lib/api-client"
import { subscribeToNotificationPush } from "~/lib/notification-stream"
import { cn } from "~/lib/utils"

/** Fetched batch for the popover; list area is max-height capped so the panel stays ~same size and scrolls. */
const INBOX_POPOVER_PAGE_SIZE = 6
/** ~4 tall rows visible; keeps total popover height near ~470px including header. */
const INBOX_LIST_MAX_HEIGHT_CLASS = "max-h-[26rem]"

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

export function NotificationInbox() {
  const [items, setItems] = React.useState<NotificationResponse[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [loading, setLoading] = React.useState(false)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const [list, count] = await Promise.all([
        apiGet<PaginatedResponse<NotificationResponse>>("/users/me/notifications", {
          page_size: INBOX_POPOVER_PAGE_SIZE,
        }),
        apiGet<{ count: number }>("/users/me/notifications/unread-count"),
      ])
      setItems(list.items.slice(0, INBOX_POPOVER_PAGE_SIZE))
      setUnreadCount(count.count)
    } catch {
      setItems([])
      setUnreadCount(0)
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
        return [notification, ...prev].slice(0, INBOX_POPOVER_PAGE_SIZE)
      })
      if (!notification.is_read) {
        setUnreadCount((count) => count + 1)
      }
    })
  }, [])

  const markRead = async (id: string) => {
    try {
      await apiPatch<NotificationResponse>(`/users/me/notifications/${id}/read`)
      await refresh()
    } catch {
      // Keep existing items; WS push or manual refresh can recover.
    }
  }

  const markAllRead = async () => {
    try {
      await apiPatch<{ updated: number }>("/users/me/notifications/read-all")
      await refresh()
    } catch {
      // Keep existing items; WS push or manual refresh can recover.
    }
  }

  return (
    <Popover onOpenChange={(open) => open && void refresh()}>
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <span className="inline-flex rounded-md">
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="size-5" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-background px-1 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent variant="inverted" side="bottom">
          Notifications — unread and recent alerts
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={12}
        className={cn(
          glassPanelSurface,
          "w-[360px] overflow-hidden rounded-2xl border-border/55 bg-white/88 p-0 shadow-xl backdrop-blur-xl backdrop-saturate-125",
          "dark:border-border/50 dark:bg-background/50",
        )}
      >
        <div className="flex items-center justify-between border-b border-border/40 bg-white/55 px-5 py-3.5 backdrop-blur-md dark:bg-background/35">
          <div className="text-lg font-semibold">Notifications</div>
          <div className="flex items-center gap-1">
            {unreadCount === 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled
                aria-label="Mark all notifications as read"
              >
                <CheckCheck className="size-4" />
              </Button>
            ) : (
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={markAllRead}
                    aria-label="Mark all notifications as read"
                  >
                    <CheckCheck className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent variant="inverted" side="bottom">
                  Mark every notification as read
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="inline-flex rounded-md">
                  <Button variant="ghost" size="icon" className="size-8" asChild aria-label="Open notifications page">
                    <Link to="/notifications">
                      <LayoutGrid className="size-4" />
                    </Link>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent variant="inverted" side="bottom">
                Open full notifications page
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        {loading && items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          <div
            className={cn(
              INBOX_LIST_MAX_HEIGHT_CLASS,
              "overflow-y-auto overscroll-contain overflow-x-hidden scrollbar-none",
            )}
          >
            {items.map((item) => (
              (() => {
                const condition = getNotificationCondition(item)
                return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "relative flex w-full gap-4 border-b border-border/35 px-5 py-4 text-left transition-colors last:border-b-0",
                  item.is_read ?
                    "bg-transparent text-muted-foreground hover:bg-white/55 dark:hover:bg-white/[0.04]"
                  : "bg-primary/8 text-foreground shadow-[inset_3px_0_0_hsl(var(--primary))] backdrop-blur-sm hover:bg-primary/12 dark:bg-primary/12",
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
                    <span
                      className={cn(
                        "truncate text-base",
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
                    <span className={cn("shrink-0 text-sm", item.is_read ? "text-muted-foreground" : "font-medium text-foreground")}>
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "mt-1 line-clamp-2 text-sm",
                      item.is_read ? "text-muted-foreground" : "text-foreground/80"
                    )}
                  >
                    {item.message}
                  </div>
                </div>
              </button>
                )
              })()
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
