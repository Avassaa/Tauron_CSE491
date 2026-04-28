"use client"

import * as React from "react"
import { ProfileDropdown } from "~/components/ui/profile-dropdown"
import { clearSession, getMe } from "~/lib/auth-client"

const FALLBACK_USER = {
  name: "Test testoglu",
  email: "testoglu@tauron.dev",
  initials: "TT",
}

export function SidebarUserMenu() {
  const [user, setUser] = React.useState(FALLBACK_USER)

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
      .catch(() => { })
  }, [])

  return (
    <ProfileDropdown
      data={{
        name: user.name,
        email: user.email,
        initials: user.initials,
        subscription: "Free",
      }}
      className="w-full"
      settingsTo="/settings"
      profileTo="/profile"
      logoutTo="/login"
      onLogout={() => {
        clearSession()
      }}
    />
  )
}
