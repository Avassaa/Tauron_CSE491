"use client"

import * as React from "react"
import { AlarmClock, Bell, CheckCheck, Info, LayoutGrid } from "lucide-react"
import { Link } from "react-router"

import { Button } from "~/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { apiGet, apiPatch, type NotificationResponse, type PaginatedResponse } from "~/lib/api-client"
import { subscribeToNotificationPush } from "~/lib/notification-stream"
import { cn } from "~/lib/utils"

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
  if (item.type === "price_alert") return <AlarmClock className="size-5" />
  return <Info className="size-5" />
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
          page_size: 6,
        }),
        apiGet<{ count: number }>("/users/me/notifications/unread-count"),
      ])
      setItems(list.items)
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
        return [notification, ...prev].slice(0, 6)
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
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-background px-1 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={12} className="w-[360px] overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="text-lg font-semibold">Notifications</div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              aria-label="Mark all notifications as read"
            >
              <CheckCheck className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" asChild aria-label="Open notifications page">
              <Link to="/notifications">
                <LayoutGrid className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
        {loading && items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            {items.map((item) => (
              (() => {
                const condition = getNotificationCondition(item)
                return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "relative flex w-full gap-4 border-b px-5 py-4 text-left transition-colors last:border-b-0",
                  item.is_read
                    ? "bg-background text-muted-foreground hover:bg-muted/40"
                    : "bg-blue-500/10 text-foreground shadow-[inset_3px_0_0_hsl(var(--primary))] ring-1 ring-inset ring-blue-500/10 hover:bg-blue-500/15"
                )}
                onClick={() => {
                  if (!item.is_read) void markRead(item.id)
                }}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full",
                    item.is_read
                      ? "text-muted-foreground"
                      : "bg-primary/10 text-primary"
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
