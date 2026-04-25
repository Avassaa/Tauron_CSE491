"use client"

import * as React from "react"
import { AppSidebar } from "./app-sidebar"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Separator } from "~/components/ui/separator"
import { DashboardClientOnly } from "./dashboard-client-only"
import { AuthGuard } from "~/components/auth-guard"

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
  return (
    <DashboardClientOnly fallback={fallback || <DefaultFallback title={typeof title === 'string' ? title : "Loading"} />}>
      <AuthGuard>
        <SidebarProvider>
          <AppSidebar />
          <MarketMarqueeBanner />
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <header className="sticky top-[var(--market-banner-offset,0px)] z-20 flex h-14 shrink-0 items-center justify-between border-b bg-background/50 px-4 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <div className="flex items-center gap-2">
                  {typeof title === "string" ? (
                    <span className="font-medium">{title}</span>
                  ) : (
                    title
                  )}
                </div>
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </header>
            <main className="flex flex-1 flex-col overflow-hidden">
              {children}
            </main>
          </div>
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
