"use client"

import * as React from "react"
import { LogOut } from "lucide-react"
import { Link } from "react-router"

import {
  Avatar,
  AvatarFallback,
} from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { Separator } from "~/components/ui/separator"
import { clearSession, getMe } from "~/lib/auth-client"
import { cn } from "~/lib/utils"

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
      .catch(() => {})
  }, [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-sidebar-foreground outline-hidden ring-sidebar-ring transition-colors",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "focus-visible:ring-2",
            "group-data-[collapsible=icon]:justify-center"
          )}
        >
          <Avatar size="sm" className="ring-2 ring-sidebar-border">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate font-medium group-data-[collapsible=icon]:hidden">
            {user.name}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        side="top"
        align="start"
        sideOffset={8}
      >
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-primary text-primary-foreground">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <Separator className="my-3" />
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
          asChild
        >
          <Link
            to="/login"
            onClick={() => {
              clearSession()
            }}
          >
            <LogOut className="size-4 shrink-0" />
            Log out
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  )
}
