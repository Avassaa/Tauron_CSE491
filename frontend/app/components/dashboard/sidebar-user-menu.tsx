"use client"

import * as React from "react"
import { ProfileDropdown } from "~/components/ui/profile-dropdown"
import { clearSession, getMe, getLocalPlan } from "~/lib/auth-client"
import { PLAN_BADGE, type PlanSlug } from "~/lib/subscription"
import { cn } from "~/lib/utils"

const FALLBACK_USER = {
  name: "Test testoglu",
  email: "testoglu@tauron.dev",
  initials: "TT",
}

const PLAN_NAME_MAP: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
}

export function SidebarUserMenu() {
  const [user, setUser] = React.useState(FALLBACK_USER)
  const [plan, setPlan] = React.useState<PlanSlug>(getLocalPlan() as PlanSlug)

  React.useEffect(() => {
    const token = localStorage.getItem("access_token")
    const storedName = localStorage.getItem("username")
    const storedEmail = localStorage.getItem("email")

    if (storedName || storedEmail) {
      const name = storedName?.trim() || FALLBACK_USER.name
      const email = storedEmail?.trim() || FALLBACK_USER.email
      setUser({
        name,
        email,
        initials:
          name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("") || FALLBACK_USER.initials,
      })
    }

    if (!token) return

    getMe(token)
      .then((me) => {
        const name = me.username
        const email = me.email
        localStorage.setItem("username", name)
        localStorage.setItem("email", email)
        setUser({
          name,
          email,
          initials:
            name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? "")
              .join("") || FALLBACK_USER.initials,
        })
      })
      .catch(() => {})
  }, [])

  // Listen for plan changes
  React.useEffect(() => {
    const handleAuthChanged = () => {
      setPlan(getLocalPlan() as PlanSlug)
    }

    window.addEventListener("tauron:auth-changed", handleAuthChanged)
    return () => {
      window.removeEventListener("tauron:auth-changed", handleAuthChanged)
    }
  }, [])

  return (
    <div className="flex flex-col gap-1">
      {/* Plan badge */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 group-data-[collapsible=icon]:hidden">
        <span className={cn(
          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
          PLAN_BADGE[plan],
        )}>
          {PLAN_NAME_MAP[plan]}
        </span>
      </div>

      <ProfileDropdown
        data={{
          name: user.name,
          email: user.email,
          initials: user.initials,
        }}
        className="w-full"
        settingsTo="/settings"
        profileTo="/profile"
        logoutTo="/"
        onLogout={() => {
          clearSession()
        }}
      />
    </div>
  )
}
