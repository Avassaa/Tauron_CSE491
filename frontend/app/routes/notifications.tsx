"use client"

import * as React from "react"
import { AlarmClock, Bell, CheckCheck, Info } from "lucide-react"

import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Skeleton } from "~/components/ui/skeleton"
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

export default function NotificationsPage() {
  const [items, setItems] = React.useState<NotificationResponse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

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

  return (
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
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="font-medium">Notifications</span>
          </div>
          <NotificationInbox />
        </header>

        <div className="flex min-h-[calc(100svh-3.5rem)] flex-1 overflow-auto p-4">
          <div className="grid w-full gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-1">
              <button
                type="button"
                className="w-full rounded-md bg-muted px-3 py-2 text-left text-sm text-foreground"
              >
                Inbox
              </button>
            </aside>
            <section className="space-y-5">
              <div className="flex items-center justify-between rounded-xl border bg-muted/60 px-5 py-4">
                <div className="min-w-0">
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
                <Button type="button" variant="outline" className="gap-2" onClick={markAllRead} disabled={unreadCount === 0}>
                  <CheckCheck className="size-4" />
                  Mark all read
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <div className="border-b px-5 py-4">
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
                ) : items.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No notifications yet.
                  </div>
                ) : (
                  <div className="divide-y">
                    {items.map((item) => (
                      (() => {
                        const condition = getNotificationCondition(item)
                        return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "relative flex w-full gap-4 px-5 py-4 text-left transition-colors",
                          item.is_read
                            ? "bg-background text-muted-foreground hover:bg-muted/40"
                            : "bg-blue-500/10 text-foreground shadow-[inset_4px_0_0_hsl(var(--primary))] ring-1 ring-inset ring-blue-500/10 hover:bg-blue-500/15"
                        )}
                        onClick={() => {
                          if (!item.is_read) void markRead(item.id)
                        }}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border",
                            item.is_read
                              ? "border-border text-muted-foreground"
                              : "border-primary/15 bg-primary/10 text-primary"
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
  )
}
