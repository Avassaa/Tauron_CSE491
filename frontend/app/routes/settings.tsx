"use client"

import * as React from "react"
import { ChevronRight, SlidersHorizontal } from "lucide-react"
import { useLocation } from "react-router"

import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { Switch } from "~/components/ui/switch"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Separator } from "~/components/ui/separator"
import { AuthGuard } from "~/components/auth-guard"
import {
  isLiquidGlassEnabled,
  onLiquidGlassChange,
  setLiquidGlassEnabled,
} from "~/lib/liquid-glass-preferences"
import {
  isMarketBannerVisible,
  onMarketBannerVisibilityChange,
  setMarketBannerVisible,
} from "~/lib/market-banner-preferences"
import {
  PricingSection,
  DEFAULT_PRICING_PLANS,
  type Plan,
} from "~/components/landing/pricing-section"
import { PlanUpgradeModal } from "~/components/subscription/plan-upgrade-modal"
import { getLocalPlan } from "~/lib/auth-client"
import type { PlanSlug } from "~/lib/subscription"

const PLAN_SLUG_MAP: Record<string, PlanSlug> = {
  Starter: "free",
  Pro: "pro",
  Enterprise: "enterprise",
}

export default function SettingsPage() {
  const location = useLocation()
  const [showMarketBanner, setShowMarketBannerState] = React.useState(true)
  const [liquidGlass, setLiquidGlassState] = React.useState(true)
  const [upgradePlan, setUpgradePlan] = React.useState<PlanSlug | null>(null)
  const currentPlan = getLocalPlan() as PlanSlug

  // Check URL query param for tab
  const queryParams = new URLSearchParams(location.search)
  const tabFromUrl = queryParams.get("tab") as "display" | "subscription" | null
  const [activeTab, setActiveTab] = React.useState<"display" | "subscription">(
    tabFromUrl === "subscription" ? "subscription" : "display"
  )

  React.useEffect(() => {
    setShowMarketBannerState(isMarketBannerVisible())
    return onMarketBannerVisibilityChange((visible) => {
      setShowMarketBannerState(visible)
    })
  }, [])

  React.useEffect(() => {
    setLiquidGlassState(isLiquidGlassEnabled())
    return onLiquidGlassChange((enabled) => {
      setLiquidGlassState(enabled)
    })
  }, [])

  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <MarketMarqueeBanner />
        <SidebarInset
          style={{
            paddingTop: "var(--market-banner-offset, 0px)",
          }}
          className="flex flex-col overflow-hidden"
        >
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <span className="font-medium">Settings</span>
            </div>
            <NotificationInbox />
          </header>
          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Mobile tab bar */}
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2 lg:hidden">
              {(["display", "subscription"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTab(t)}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
                    activeTab === t
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="grid w-full gap-4 p-3 sm:gap-6 sm:p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="hidden space-y-1 lg:block">
                <button
                  type="button"
                  onClick={() => setActiveTab("display")}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    activeTab === "display"
                      ? "bg-muted text-foreground"
                      : "text-foreground/70 hover:bg-muted/50"
                  }`}
                >
                  Display
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("subscription")}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    activeTab === "subscription"
                      ? "bg-muted text-foreground"
                      : "text-foreground/70 hover:bg-muted/50"
                  }`}
                >
                  Subscription
                </button>
              </aside>
              <section className="space-y-4 sm:space-y-5">
                {activeTab === "display" && (
                  <>
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
                              Live ticker shown at the top of app pages.
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
                      <div className="flex w-full items-center justify-between gap-3 border-t px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-md border p-2 text-muted-foreground">
                            <SlidersHorizontal className="size-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">Liquid glass</div>
                            <div className="text-xs text-muted-foreground">
                              Frosted cards and backdrop blur. Turn off for solid, opaque panels.
                            </div>
                          </div>
                        </div>
                        <Switch
                          checked={liquidGlass}
                          onCheckedChange={(checked) => {
                            setLiquidGlassState(checked)
                            setLiquidGlassEnabled(checked)
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "subscription" && (
                  <>
                    <div className="rounded-xl border">
                      <div className="border-b px-5 py-4">
                        <div className="text-xl font-semibold">Manage Subscription</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Choose or upgrade your subscription plan to unlock more features.
                        </p>
                      </div>
                      <div className="px-5 py-6">
                        <PricingSection
                          plans={DEFAULT_PRICING_PLANS}
                          heading=""
                          description=""
                          onSelectPlan={(plan) => {
                            const slug = PLAN_SLUG_MAP[plan.name]
                            if (!slug) return
                            if (slug !== currentPlan) {
                              setUpgradePlan(slug)
                            }
                          }}
                          currentPlan={currentPlan}
                          isLiquidGlass={liquidGlass}
                          className="!p-0 !space-y-4 !flex !flex-col !items-stretch"
                        />
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>

          {upgradePlan && (
            <PlanUpgradeModal
              targetPlan={upgradePlan}
              open={upgradePlan !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setUpgradePlan(null)
                }
              }}
              onConfirm={() => {
                setUpgradePlan(null)
              }}
            />
          )}
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}
