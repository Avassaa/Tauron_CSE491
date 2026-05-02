"use client"

import * as React from "react"
import { Settings, CreditCard, LogOut, User } from "lucide-react"
import { Link } from "react-router"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { cn } from "~/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

interface Profile {
  name: string
  email: string
  avatar?: string
  initials?: string
  subscription?: string
}

interface MenuItem {
  label: string
  value?: string
  to: string
  icon: React.ReactNode
  external?: boolean
}

const SAMPLE_PROFILE_DATA: Profile = {
  name: "Test testoglu",
  email: "testoglu@tauron.dev",
  initials: "TT",
  subscription: "Free",
}

interface ProfileDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  data?: Profile
  settingsTo?: string
  profileTo?: string
  logoutTo?: string
  onLogout?: () => void
}

export function ProfileDropdown({
  data = SAMPLE_PROFILE_DATA,
  className,
  settingsTo = "/settings",
  profileTo = "/profile",
  logoutTo = "/login",
  onLogout,
  ...props
}: ProfileDropdownProps) {
  const initials =
    data.initials ??
    data.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")

  const menuItems: MenuItem[] = [
    { label: "Profile", to: profileTo, icon: <User className="h-4 w-4" /> },
    {
      label: "Subscription",
      value: data.subscription,
      to: settingsTo,
      icon: <CreditCard className="h-4 w-4" />,
    },
    { label: "Settings", to: settingsTo, icon: <Settings className="h-4 w-4" /> },
  ]

  return (
    <div className={cn("relative", className)} {...props}>
      <DropdownMenu>
        <div className="group relative">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200/60 bg-white p-3 text-left transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50/80 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800/60 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/40 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-none group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none dark:group-data-[collapsible=icon]:border-transparent dark:group-data-[collapsible=icon]:bg-transparent"
            >
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <div className="truncate text-sm font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
                  {data.name}
                </div>
                <div className="truncate text-xs tracking-tight text-zinc-500 dark:text-zinc-400">
                  {data.email}
                </div>
              </div>
              <Avatar size="sm" className="ring-2 ring-zinc-200/70 dark:ring-zinc-700/60">
                {data.avatar ? (
                  <img
                    src={data.avatar}
                    alt={data.name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : null}
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  {initials || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={8}
            className="w-64 origin-bottom-left rounded-2xl border border-zinc-200/60 bg-white/95 p-2 shadow-xl shadow-zinc-900/5 backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/95 dark:shadow-zinc-950/20"
          >
            <div className="space-y-1">
              {menuItems.map((item) => (
                <DropdownMenuItem key={item.label} asChild>
                  <Link
                    to={item.to}
                    className="group flex cursor-pointer items-center rounded-xl border border-transparent p-3 transition-all duration-200 hover:border-zinc-200/50 hover:bg-zinc-100/80 hover:shadow-sm dark:hover:border-zinc-700/50 dark:hover:bg-zinc-800/60"
                  >
                    <div className="flex flex-1 items-center gap-2">
                      {item.icon}
                      <span className="whitespace-nowrap text-sm font-medium leading-tight tracking-tight text-zinc-900 transition-colors group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-zinc-50">
                        {item.label}
                      </span>
                    </div>
                    {item.value ? (
                      <span className="ml-auto rounded-md border border-purple-500/10 bg-purple-50 px-2 py-1 text-xs font-medium tracking-tight text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                        {item.value}
                      </span>
                    ) : null}
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>

            <DropdownMenuSeparator className="my-3 bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-800" />

            <DropdownMenuItem asChild>
              <Link
                to={logoutTo}
                onClick={onLogout}
                // Use replace to prevent the user from navigating back to protected pages after logout
                replace
                className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-red-500/10 p-3 transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/20 hover:shadow-sm"
              >
                <LogOut className="h-4 w-4 text-red-500 group-hover:text-red-600" />
                <span className="text-sm font-medium text-red-500 group-hover:text-red-600">
                  Sign out
                </span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </div>
      </DropdownMenu>
    </div>
  )
}
