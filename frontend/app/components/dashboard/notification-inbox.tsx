"use client"

import * as React from "react"
import { Bell, CheckCheck, Info, LayoutGrid, CircleAlert } from "lucide-react"
import { Link } from "react-router"

import { Button } from "~/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { apiGet, apiPatch, type NotificationResponse, type PaginatedResponse } from "~/lib/api-client"

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

function NotificationIcon({ type }: { type: string }) {
  if (type === "price_alert") return <CircleAlert className="size-5" />
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
          page_size: 8,
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
    const interval = window.setInterval(() => {
      void refresh()
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [refresh])

  const markRead = async (id: string) => {
    try {
      await apiPatch<NotificationResponse>(`/users/me/notifications/${id}/read`)
      await refresh()
    } catch {
      // Keep existing items; next polling tick can recover.
    }
  }

  const markAllRead = async () => {
    try {
      await apiPatch<{ updated: number }>("/users/me/notifications/read-all")
      await refresh()
    } catch {
      // Keep existing items; next polling tick can recover.
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
              <button
                key={item.id}
                type="button"
                className="flex w-full gap-4 border-b px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-muted/50"
                onClick={() => {
                  if (!item.is_read) void markRead(item.id)
                }}
              >
                <div className="mt-0.5 text-muted-foreground">
                  <NotificationIcon type={item.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="truncate text-base font-semibold">{item.title}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.message}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
