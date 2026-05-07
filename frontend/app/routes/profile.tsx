"use client"

import * as React from "react"
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  KeyRound,
  LayoutList,
  PencilLine,
  Shield,
  Star,
  Trash2,
  TrendingUp,
  User,
  X,
  Save,
} from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"

import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { NotificationInbox } from "~/components/dashboard/notification-inbox"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { Skeleton } from "~/components/ui/skeleton"
import { getMe, patchMe } from "~/lib/auth-client"
import {
  apiGet,
  apiPost,
  apiPatch,
  type PriceAlertResponse,
  type WatchlistEntryResponse,
  type WatchlistListResponse,
} from "~/lib/api-client"
import { AuthGuard } from "~/components/auth-guard"
import { DATE_FNS_LOCALE } from "~/lib/date-locale"

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "profile" | "security" | "activity"

type ProfileViewModel = {
  username: string
  email: string
  fullName: string
  createdAt: string | null
}

const FALLBACK: ProfileViewModel = {
  username: "testoglu",
  email: "testoglu@tauron.dev",
  fullName: "Test Testoglu",
  createdAt: null,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFullName(username: string): string {
  const cleaned = username.trim()
  if (!cleaned) return FALLBACK.fullName
  return cleaned
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ")
}

function memberSince(iso: string | null): string {
  if (!iso) return "—"
  try {
    return format(new Date(iso), "MMMM yyyy", { locale: DATE_FNS_LOCALE })
  } catch {
    return "—"
  }
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: DATE_FNS_LOCALE })
  } catch {
    return "—"
  }
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile Information", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "activity", label: "Activity", icon: Bell },
]

// ─── Field row ───────────────────────────────────────────────────────────────

function FieldRow({
  label,
  sub,
  children,
}: {
  label: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      <div className="shrink-0 text-right">{children}</div>
    </div>
  )
}

// ─── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab({
  profile,
  watchlistCount,
  listCount,
  alertCount,
  loadingStats,
  onProfileUpdated,
}: {
  profile: ProfileViewModel
  watchlistCount: number
  listCount: number
  alertCount: number
  loadingStats: boolean
  onProfileUpdated: (next: ProfileViewModel) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState({ username: "", fullName: "" })
  const [saving, setSaving] = React.useState(false)

  const initial = (profile.username || profile.fullName || "U").charAt(0).toUpperCase()

  const startEdit = () => {
    setDraft({ username: profile.username, fullName: profile.fullName })
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const saveEdit = async () => {
    if (saving) return
    const username = draft.username.trim()
    const fullName = draft.fullName.trim()
    if (!username) { toast.error("Username is required."); return }
    if (!fullName) { toast.error("Full name is required."); return }
    setSaving(true)
    const id = toast.loading("Saving profile…")
    try {
      const token = localStorage.getItem("access_token") ?? ""
      const updated = await patchMe(token, { username, full_name: fullName })
      const next: ProfileViewModel = {
        username: updated.username,
        email: updated.email,
        fullName: updated.full_name?.trim() || fullName,
        createdAt: profile.createdAt,
      }
      localStorage.setItem("username", next.username)
      localStorage.setItem("email", next.email)
      localStorage.setItem("full_name", next.fullName)
      onProfileUpdated(next)
      setEditing(false)
      toast.success("Profile updated.", { id })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.", { id })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-14 ring-2 ring-zinc-200/70 dark:ring-zinc-700/60">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xl font-bold">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-xl font-semibold">{profile.fullName}</div>
              <div className="mt-0.5 text-sm text-muted-foreground">@{profile.username}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Member since {memberSince(profile.createdAt)}
              </div>
            </div>
          </div>
          {!editing && (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-2 self-start sm:self-auto"
              onClick={startEdit}
            >
              <PencilLine className="size-4" />
              Edit profile
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x border-b text-center">
          <div className="flex flex-col items-center gap-1 py-4">
            {loadingStats ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              <span className="text-2xl font-bold">{watchlistCount}</span>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="size-3.5" />
              Watchlist
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 py-4">
            {loadingStats ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              <span className="text-2xl font-bold">{listCount}</span>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LayoutList className="size-3.5" />
              Lists
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 py-4">
            {loadingStats ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              <span className="text-2xl font-bold">{alertCount}</span>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5" />
              Active alerts
            </div>
          </div>
        </div>

        {/* Fields – view or edit */}
        {editing ? (
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={draft.username}
                onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
                disabled={saving}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fullname">Full Name</Label>
              <Input
                id="edit-fullname"
                value={draft.fullName}
                onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
                disabled={saving}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled readOnly className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving} className="gap-1.5">
                <X className="size-3.5" />
                Cancel
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={saving} className="gap-1.5">
                <Save className="size-3.5" />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y px-5">
            <FieldRow label="Username" sub="Account identifier">
              <span className="font-mono text-sm">{profile.username}</span>
            </FieldRow>
            <FieldRow label="Email" sub="Login and notification address">
              <span className="text-sm">{profile.email}</span>
            </FieldRow>
            <FieldRow label="Full Name" sub="Display name shown on your profile">
              <span className="text-sm">{profile.fullName}</span>
            </FieldRow>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [confirm, setConfirm] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)

  const handleClose = () => {
    if (deleting) return
    setConfirm("")
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (confirm !== "DELETE") {
      toast.error('Type DELETE to confirm.')
      return
    }
    setDeleting(true)
    const id = toast.loading("Deleting account…")
    try {
      await apiPost("/users/me/delete-request")
      toast.success("Deletion request submitted. Our team will contact you.", { id, duration: 6000 })
      handleClose()
    } catch {
      toast.error("Please contact support to delete your account.", { id })
      handleClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription className="pt-1">
            This action is <span className="font-semibold text-foreground">permanent and irreversible</span>.
            All your data, watchlists, alerts, and chat history will be erased.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Type <span className="font-mono font-semibold text-foreground">DELETE</span> below to confirm.
          </p>
          <Input
            placeholder="DELETE"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={deleting}
            className="font-mono"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting || confirm !== "DELETE"}
            className="bg-red-800 text-white hover:bg-red-900 focus-visible:ring-red-800"
          >
            <Trash2 className="size-4" />
            {deleting ? "Deleting…" : "Delete my account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Security tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [confirmPw, setConfirmPw] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const handleChangePassword = async () => {
    if (saving) return
    if (!current || !next || !confirmPw) { toast.error("All fields are required."); return }
    if (next.length < 8) { toast.error("New password must be at least 8 characters."); return }
    if (next !== confirmPw) { toast.error("Passwords do not match."); return }
    setSaving(true)
    const id = toast.loading("Changing password…")
    try {
      await apiPost("/users/me/password", { current_password: current, new_password: next })
      toast.success("Password changed successfully.", { id })
      setCurrent(""); setNext(""); setConfirmPw("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password.", { id })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Change password */}
      <div className="rounded-xl border">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2 text-base font-semibold">
            <KeyRound className="size-4" />
            Change Password
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your password. You will need your current password to confirm.
          </p>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="sec-current">Current Password</Label>
            <Input
              id="sec-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              disabled={saving}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sec-new">New Password</Label>
            <Input
              id="sec-new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sec-confirm">Confirm New Password</Label>
            <Input
              id="sec-confirm"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button onClick={handleChangePassword} disabled={saving} className="gap-2">
              <KeyRound className="size-4" />
              {saving ? "Changing…" : "Change Password"}
            </Button>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30">
        <div className="border-b border-destructive/30 px-5 py-4">
          <div className="flex items-center gap-2 text-base font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            Danger Zone
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Irreversible actions for your account.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-medium">Delete account</div>
            <div className="text-xs text-muted-foreground">
              Permanently delete your account and all associated data.
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 gap-2 bg-red-800 text-white hover:bg-red-900"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  )
}

// ─── Activity tab ─────────────────────────────────────────────────────────────

function ActivityTab() {
  const [watchlist, setWatchlist] = React.useState<WatchlistEntryResponse[]>([])
  const [alerts, setAlerts] = React.useState<PriceAlertResponse[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    Promise.all([
      apiGet<WatchlistEntryResponse[]>("/users/me/watchlist").catch(() => [] as WatchlistEntryResponse[]),
      apiGet<PriceAlertResponse[]>("/users/me/price-alerts").catch(() => [] as PriceAlertResponse[]),
    ]).then(([wl, al]) => {
      setWatchlist(wl)
      setAlerts(al)
      setLoading(false)
    })
  }, [])

  const activeAlerts = alerts.filter((a) => a.is_active)
  const triggeredAlerts = alerts.filter((a) => !a.is_active && a.triggered_at)

  return (
    <div className="space-y-5">
      {/* Watchlist */}
      <div className="rounded-xl border">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Star className="size-4" />
            Watchlist
            {!loading && (
              <Badge variant="secondary" className="text-xs">
                {watchlist.length} assets
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Assets you are currently tracking.</p>
        </div>

        {loading ? (
          <div className="space-y-2 px-5 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : watchlist.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center text-muted-foreground">
            <Star className="size-7 opacity-30" />
            <p className="text-sm">No assets on your watchlist yet.</p>
          </div>
        ) : (
          <ul className="divide-y overflow-y-auto" style={{ maxHeight: watchlist.length > 5 ? "300px" : undefined }}>
            {watchlist.map(({ asset }) => (
              <li
                key={asset.id}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-md bg-muted text-xs font-bold">
                    {asset.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{asset.symbol}</div>
                    <div className="text-xs text-muted-foreground">{asset.name}</div>
                  </div>
                </div>
                {asset.category && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {asset.category}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Price alerts */}
      <div className="rounded-xl border">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="size-4" />
            Price Alerts
            {!loading && activeAlerts.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeAlerts.length} active
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your configured price alert rules.
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 px-5 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center text-muted-foreground">
            <BellOff className="size-7 opacity-30" />
            <p className="text-sm">No price alerts configured.</p>
          </div>
        ) : (
          <ul className="divide-y overflow-y-auto" style={{ maxHeight: alerts.length > 5 ? "300px" : undefined }}>
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-8 items-center justify-center rounded-md text-xs font-bold ${
                      alert.is_active
                        ? "bg-primary/10 text-primary"
                        : alert.triggered_at
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {alert.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {alert.symbol}{" "}
                      <span className="text-muted-foreground font-normal">
                        {alert.condition === "above" ? "rises above" : "drops below"}{" "}
                        ${alert.target_price.toLocaleString()}
                      </span>
                    </div>
                    {alert.triggered_at ? (
                      <div className="text-xs text-emerald-500">
                        Triggered {timeAgo(alert.triggered_at)}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Created {timeAgo(alert.created_at)}
                      </div>
                    )}
                  </div>
                </div>
                <Badge
                  variant={alert.is_active ? "secondary" : "outline"}
                  className={`shrink-0 text-xs ${
                    alert.triggered_at && !alert.is_active
                      ? "border-emerald-500/30 text-emerald-500"
                      : ""
                  }`}
                >
                  {alert.is_active ? "Active" : alert.triggered_at ? "Triggered" : "Inactive"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border">
        <div className="flex items-center gap-4 border-b px-5 py-5">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x border-b">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 py-4">
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="divide-y px-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [tab, setTab] = React.useState<Tab>("profile")
  const [profile, setProfile] = React.useState<ProfileViewModel>(FALLBACK)
  const [loading, setLoading] = React.useState(true)
  const [watchlistCount, setWatchlistCount] = React.useState(0)
  const [listCount, setListCount] = React.useState(0)
  const [alertCount, setAlertCount] = React.useState(0)
  const [loadingStats, setLoadingStats] = React.useState(true)

  React.useEffect(() => {
    const token = localStorage.getItem("access_token")
    const storedUsername = localStorage.getItem("username")?.trim() || FALLBACK.username
    const storedEmail = localStorage.getItem("email")?.trim() || FALLBACK.email
    const storedFullName = localStorage.getItem("full_name")?.trim() || toFullName(storedUsername)

    setProfile({
      username: storedUsername,
      email: storedEmail,
      fullName: storedFullName,
      createdAt: localStorage.getItem("created_at") || null,
    })

    if (!token) { setLoading(false); return }

    getMe(token)
      .then((me) => {
        const apiFullName = me.full_name?.trim()
        const next: ProfileViewModel = {
          username: me.username,
          email: me.email,
          fullName: apiFullName || storedFullName || toFullName(me.username),
          createdAt: me.created_at ?? null,
        }
        setProfile(next)
        localStorage.setItem("username", next.username)
        localStorage.setItem("email", next.email)
        localStorage.setItem("full_name", next.fullName)
        if (next.createdAt) localStorage.setItem("created_at", next.createdAt)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) { setLoadingStats(false); return }
    Promise.all([
      apiGet<WatchlistEntryResponse[]>("/users/me/watchlist").catch(() => [] as WatchlistEntryResponse[]),
      apiGet<WatchlistListResponse[]>("/users/me/watchlists").catch(() => [] as WatchlistListResponse[]),
      apiGet<PriceAlertResponse[]>("/users/me/price-alerts").catch(() => [] as PriceAlertResponse[]),
    ]).then(([wl, lists, alerts]) => {
      setWatchlistCount(wl.length)
      setListCount(lists.length)
      setAlertCount(alerts.filter((a) => a.is_active).length)
      setLoadingStats(false)
    })
  }, [])

  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <MarketMarqueeBanner />
        <SidebarInset style={{ paddingTop: "var(--market-banner-offset, 0px)" }} className="flex flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <span className="font-medium">Profile</span>
            </div>
            <NotificationInbox />
          </header>

          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Mobile tab bar */}
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2 lg:hidden">
              {NAV.map((item) => {
                const Icon = item.icon
                const active = tab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div className="grid w-full gap-4 p-3 sm:gap-6 sm:p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              {/* Desktop left nav */}
              <aside className="hidden space-y-1 lg:block">
                {NAV.map((item) => {
                  const Icon = item.icon
                  const active = tab === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      {item.label}
                    </button>
                  )
                })}
              </aside>

              {/* Content */}
              <section className="min-w-0 space-y-4 sm:space-y-5">
                {loading && tab === "profile" ? (
                  <ProfileSkeleton />
                ) : tab === "profile" ? (
                  <ProfileTab
                    profile={profile}
                    watchlistCount={watchlistCount}
                    listCount={listCount}
                    alertCount={alertCount}
                    loadingStats={loadingStats}
                    onProfileUpdated={setProfile}
                  />
                ) : tab === "security" ? (
                  <SecurityTab />
                ) : (
                  <ActivityTab />
                )}
              </section>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}
