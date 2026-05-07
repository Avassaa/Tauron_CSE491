"use client"

import * as React from "react"
import { AppSidebar } from "./app-sidebar"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Separator } from "~/components/ui/separator"
import { DashboardClientOnly } from "./dashboard-client-only"
import { AuthGuard } from "~/components/auth-guard"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import {
  AssistantDockSplitMain,
  AssistantDockToolbarButton,
} from "~/components/assistant/assistant-dock-ui"
import { DashboardMainScrollElementContext } from "~/components/dashboard/dashboard-main-scroll-context"

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string | React.ReactNode
  fallback?: React.ReactNode
  actions?: React.ReactNode
}

export function DashboardLayout({
  children,
  title,
  fallback,
  actions,
}: DashboardLayoutProps) {
  const [mainScrollEl, setMainScrollEl] = React.useState<HTMLDivElement | null>(null)
  const [mainPortalEl, setMainPortalEl] = React.useState<HTMLDivElement | null>(null)

  return (
    <DashboardClientOnly fallback={fallback || <DefaultFallback title={typeof title === 'string' ? title : "Loading"} />}>
      <AuthGuard>
        <SidebarProvider className="h-svh max-h-[100svh] min-h-0 overflow-hidden">
          <AppSidebar />
          <MarketMarqueeBanner />
          <DashboardMainScrollElementContext.Provider value={{ scrollEl: mainScrollEl, portalEl: mainPortalEl }}>
            <SidebarInset
              className="min-h-0 overflow-hidden"
              style={{ paddingTop: "var(--market-banner-offset, 0px)" }}
            >
              <header
                data-app-shell-header
                className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/50 px-4 backdrop-blur-md"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <SidebarTrigger className="-ml-1 shrink-0" />
                  <Separator orientation="vertical" className="mr-2 h-4 shrink-0" />
                  <div className="flex min-w-0 items-center gap-2">
                    {typeof title === "string" ? (
                      <span className="font-medium">{title}</span>
                    ) : (
                      title
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {actions}
                  <AssistantDockToolbarButton />
                  <NotificationInbox />
                </div>
              </header>
              <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-visible sm:overflow-hidden">
                <AssistantDockSplitMain outerClassName="min-h-0 min-w-0 flex-1">
                  <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" ref={setMainPortalEl}>
                    <div
                      ref={setMainScrollEl}
                      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto pt-0"
                    >
                      {children}
                    </div>
                  </div>
                </AssistantDockSplitMain>
              </div>
            </SidebarInset>
          </DashboardMainScrollElementContext.Provider>
        </SidebarProvider>
      </AuthGuard>
    </DashboardClientOnly>
  )
}

function DefaultFallback({ title }: { title: string }) {
  return (
    <div className="flex min-h-svh w-full bg-background" aria-busy aria-label={`Loading ${title}`}>
      <div className="hidden w-64 shrink-0 animate-pulse border-r bg-sidebar md:block" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-14 shrink-0 animate-pulse border-b bg-background" />
        <div className="flex flex-1 flex-col gap-4 p-8">
          <div className="h-10 w-64 animate-pulse rounded-xl bg-muted/50" />
          <div className="h-full w-full animate-pulse rounded-2xl bg-muted/50" />
        </div>
      </div>
    </div>
  )
}
