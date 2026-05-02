"use client"

import { GeminiChatPanel } from "~/components/assistant/gemini-chat-panel"
import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { AuthGuard } from "~/components/auth-guard"
import { Separator } from "~/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"

export default function ChatPage() {
  return (
    <AuthGuard>
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
              <span className="font-medium">AI Chat</span>
            </div>
            <NotificationInbox />
          </header>
          <div className="flex min-h-[calc(100svh-3.5rem)] flex-1 flex-col gap-3 px-5 py-5 pb-8 sm:px-8 sm:py-6 md:px-10">
            <p className="text-sm text-muted-foreground">
              Chat with Tauron&apos;s assistant—quick answers and explanations, right in your workspace.
            </p>
            <GeminiChatPanel className="min-h-0 flex-1" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}
