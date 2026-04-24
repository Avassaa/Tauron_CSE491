"use client"

import * as React from "react"
import { ChevronRight, SlidersHorizontal } from "lucide-react"

import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { Switch } from "~/components/ui/switch"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Separator } from "~/components/ui/separator"
import {
  isMarketBannerVisible,
  onMarketBannerVisibilityChange,
  setMarketBannerVisible,
} from "~/lib/market-banner-preferences"

export default function SettingsPage() {
  const [showMarketBanner, setShowMarketBannerState] = React.useState(true)

  React.useEffect(() => {
    setShowMarketBannerState(isMarketBannerVisible())
    return onMarketBannerVisibilityChange((visible) => {
      setShowMarketBannerState(visible)
    })
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="font-medium">Settings</span>
        </header>
        <div className="flex min-h-[calc(100svh-3.5rem)] flex-1 overflow-auto p-4">
          <div className="grid w-full gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-1">
              <button
                type="button"
                className="w-full rounded-md bg-muted px-3 py-2 text-left text-sm text-foreground"
              >
                Display
              </button>
            </aside>
            <section className="space-y-5">
              <div className="flex items-center justify-between rounded-xl border bg-muted/60 px-5 py-4">
                <div className="flex items-start gap-3">
                  <ChevronRight className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <div className="font-semibold">You&apos;re using free plan</div>
                    <div className="text-sm text-muted-foreground">
                      You can add components to your app by upgrading to the next plan.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  View plans
                </button>
              </div>

              <div className="rounded-xl border">
                <div className="border-b px-5 py-4">
                  <div className="text-xl font-semibold">Display</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Control visibility of the live market marquee banner.
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-3 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-md border p-2 text-muted-foreground">
                      <SlidersHorizontal className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Show market ticker banner</div>
                      <div className="text-xs text-muted-foreground">
                        Overlay marquee shown at the top of all pages.
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={showMarketBanner}
                    onCheckedChange={(checked) => {
                      setShowMarketBannerState(checked)
                      setMarketBannerVisible(checked)
                    }}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
