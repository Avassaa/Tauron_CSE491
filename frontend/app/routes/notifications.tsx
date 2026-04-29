"use client"

import * as React from "react"
import { Bell, CheckCheck, CircleAlert, Info } from "lucide-react"

import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Skeleton } from "~/components/ui/skeleton"
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
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50"
                        onClick={() => {
                          if (!item.is_read) void markRead(item.id)
                        }}
                      >
                        <div className="mt-0.5 rounded-md border p-2 text-muted-foreground">
                          <NotificationIcon type={item.type} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate font-semibold">{item.title}</span>
                              {!item.is_read ? (
                                <span className="size-2 rounded-full bg-primary" aria-label="Unread" />
                              ) : null}
                            </div>
                            <span className="shrink-0 text-sm text-muted-foreground">
                              {formatRelativeTime(item.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                        </div>
                      </button>
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
