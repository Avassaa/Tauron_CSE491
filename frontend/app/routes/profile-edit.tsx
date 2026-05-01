"use client"

import * as React from "react"
import { Save, UserRound } from "lucide-react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"

import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Skeleton } from "~/components/ui/skeleton"
import { getMe, patchMe } from "~/lib/auth-client"
import { AuthGuard } from "~/components/auth-guard"

type EditableProfile = {
  username: string
  fullName: string
  email: string
}

const FALLBACK_PROFILE: EditableProfile = {
  username: "testoglu",
  fullName: "Test Testoglu",
  email: "testoglu@tauron.dev",
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

export default function ProfileEditPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [profile, setProfile] = React.useState<EditableProfile>(FALLBACK_PROFILE)

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
        // Keep fallback/local values.
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    if (saving) return
    const token = localStorage.getItem("access_token")
    if (!token) {
      toast.error("Please sign in again.")
      return
    }
    const username = profile.username.trim()
    const fullName = profile.fullName.trim()
    if (!username) {
      toast.error("Username is required.")
      return
    }
    if (!fullName) {
      toast.error("Full name is required.")
      return
    }
    setSaving(true)
    const toastId = toast.loading("Saving profile...")
    try {
      const updated = await patchMe(token, {
        username,
        full_name: fullName,
      })
      const next = {
        username: updated.username,
        email: updated.email,
        fullName: updated.full_name?.trim() || fullName,
      }
      setProfile(next)
      localStorage.setItem("username", next.username)
      localStorage.setItem("email", next.email)
      localStorage.setItem("full_name", next.fullName)
      toast.success("Profile updated.", { id: toastId })
      navigate("/profile")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update profile."
      toast.error(message, { id: toastId })
    } finally {
      setSaving(false)
    }
  }

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
              <span className="font-medium">Edit Profile</span>
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
                  <div className="rounded-xl border">
                    <div className="border-b px-5 py-4">
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="mt-2 h-4 w-72" />
                    </div>
                    <div className="space-y-4 px-5 py-4">
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <div className="flex justify-end gap-2 pt-2">
                        <Skeleton className="h-10 w-24 rounded-md" />
                        <Skeleton className="h-10 w-32 rounded-md" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border">
                    <div className="border-b px-5 py-4">
                      <div className="text-xl font-semibold">Edit Profile</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Update your username and full name. Email is read-only.
                      </p>
                    </div>

                    <div className="space-y-5 px-5 py-4">
                      <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                        <div className="rounded-md border p-2 text-muted-foreground">
                          <UserRound className="size-4" />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Public identity details shown in your account profile.
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="profile-username">Username</Label>
                        <Input
                          id="profile-username"
                          value={profile.username}
                          onChange={(event) => {
                            setProfile((prev) => ({ ...prev, username: event.target.value }))
                          }}
                          disabled={saving}
                          maxLength={50}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="profile-full-name">Full Name</Label>
                        <Input
                          id="profile-full-name"
                          value={profile.fullName}
                          onChange={(event) => {
                            setProfile((prev) => ({ ...prev, fullName: event.target.value }))
                          }}
                          disabled={saving}
                          maxLength={100}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="profile-email">Email</Label>
                        <Input id="profile-email" value={profile.email} disabled readOnly />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" asChild>
                          <Link to="/profile">Cancel</Link>
                        </Button>
                        <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
                          <Save className="size-4" />
                          {saving ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}
