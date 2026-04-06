"use client"

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
import { cn } from "~/lib/utils"

const DEMO_USER = {
  name: "Test testoglu",
  email: "testoglu@tauron.dev",
  initials: "TT",
} as const

export function SidebarUserMenu() {
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
              {DEMO_USER.initials}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate font-medium group-data-[collapsible=icon]:hidden">
            {DEMO_USER.name}
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
              {DEMO_USER.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{DEMO_USER.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {DEMO_USER.email}
            </p>
          </div>
        </div>
        <Separator className="my-3" />
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
          asChild
        >
          <Link to="/login">
            <LogOut className="size-4 shrink-0" />
            Log out
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  )
}
