"use client"

import * as React from "react"
import { ChevronRight, PencilLine, UserRound } from "lucide-react"

import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Skeleton } from "~/components/ui/skeleton"
import { getMe } from "~/lib/auth-client"
import { Link } from "react-router"

type ProfileViewModel = {
  username: string
  email: string
  fullName: string
}

const FALLBACK_PROFILE: ProfileViewModel = {
  username: "testoglu",
  email: "testoglu@tauron.dev",
  fullName: "Test Testoglu",
}

function toFullName(username: string): string {
  const cleaned = username.trim()
  if (!cleaned) return FALLBACK_PROFILE.fullName
  return cleaned
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")
}

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<ProfileViewModel>(FALLBACK_PROFILE)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const token = localStorage.getItem("access_token")
    const storedUsername = localStorage.getItem("username")?.trim() || FALLBACK_PROFILE.username
    const storedEmail = localStorage.getItem("email")?.trim() || FALLBACK_PROFILE.email
    const storedFullName = localStorage.getItem("full_name")?.trim() || toFullName(storedUsername)

    setProfile({
      username: storedUsername,
      email: storedEmail,
      fullName: storedFullName,
    })

    if (!token) {
      setLoading(false)
      return
    }

    getMe(token)
      .then((me) => {
        const apiFullName = me.full_name?.trim()
        const next = {
          username: me.username,
          email: me.email,
          fullName: apiFullName || storedFullName || toFullName(me.username),
        }
        setProfile(next)
        localStorage.setItem("username", next.username)
        localStorage.setItem("email", next.email)
        localStorage.setItem("full_name", next.fullName)
      })
      .catch(() => {
        // Keep best-effort local values.
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

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
            <span className="font-medium">Profile</span>
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
                Profile Information
              </button>
            </aside>

            <section className="space-y-5">
              {loading ? (
                <>
                  <div className="rounded-xl border bg-muted/60 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Skeleton className="mt-0.5 h-4 w-4 rounded" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-56" />
                          <Skeleton className="h-3 w-80" />
                        </div>
                      </div>
                      <Skeleton className="h-9 w-28 rounded-md" />
                    </div>
                  </div>

                  <div className="rounded-xl border">
                    <div className="border-b px-5 py-4">
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="mt-2 h-4 w-72" />
                    </div>
                    <div className="space-y-4 px-5 py-4">
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-14 w-full rounded-lg" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-xl border bg-muted/60 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <ChevronRight className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <div className="font-semibold">{profile.fullName}</div>
                        <div className="text-sm text-muted-foreground">
                          Manage your public profile details and account identity.
                        </div>
                      </div>
                    </div>
                    <Button type="button" className="gap-2" asChild>
                      <Link to="/profile/edit">
                        <PencilLine className="size-4" />
                        Edit profile
                      </Link>
                    </Button>
                  </div>

                  <div className="rounded-xl border">
                    <div className="border-b px-5 py-4">
                      <div className="text-xl font-semibold">Profile Details</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Basic account information fetched from your current session.
                      </p>
                    </div>

                    <div className="space-y-4 px-5 py-4">
                      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-md border p-2 text-muted-foreground">
                            <UserRound className="size-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">Username</div>
                            <div className="text-xs text-muted-foreground">
                              Used for your account identifier.
                            </div>
                          </div>
                        </div>
                        <div className="text-sm font-medium">{profile.username}</div>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div>
                          <div className="text-sm font-medium">Email</div>
                          <div className="text-xs text-muted-foreground">
                            Login and notification address.
                          </div>
                        </div>
                        <div className="text-sm font-medium">{profile.email}</div>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div>
                          <div className="text-sm font-medium">Full Name</div>
                          <div className="text-xs text-muted-foreground">
                            Display name shown on your profile.
                          </div>
                        </div>
                        <div className="text-sm font-medium">{profile.fullName}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
