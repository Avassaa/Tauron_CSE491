"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Coins,
  Star,
  Wrench,
  Newspaper,
  BrainCircuit,
  FlaskConical,
  MessageSquare,
  Bell,
} from "lucide-react"
import { Link, useLocation } from "react-router"

import { SidebarUserMenu } from "~/components/dashboard/sidebar-user-menu"
import { AnimatedThemeToggler } from "~/components/ui/animated-theme-toggler"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar"

const navMain = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Assets", url: "/assets", icon: Coins },
  { title: "Watchlist", url: "/watchlists", icon: Star },
]

const navAI = [
  { title: "Predictions", url: "/predictions", icon: BrainCircuit },
  { title: "News Feed", url: "/news", icon: Newspaper },
  { title: "Backtests", url: "/backtests", icon: FlaskConical },
  { title: "AI Chat", url: "/chat", icon: MessageSquare },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon" className="bg-background border-r rounded-r-[2.5rem] overflow-hidden" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link
                to="/dashboard"
                className="flex min-w-0 justify-center px-1 font-semibold tracking-tight text-sidebar-foreground no-underline hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
                aria-label="Tauron home"
                style={{ fontFamily: "'Dancing Script', cursive" }}
              >
                <span className="truncate text-2xl group-data-[collapsible=icon]:text-lg md:text-3xl">
                  Tauron
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>AI &amp; Analysis</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navAI.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Utilities</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/tools"}>
                  <Link to="/tools">
                    <Wrench />
                    <span>Tools</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/notifications"}>
                  <Link to="/notifications">
                    <Bell />
                    <span>Notifications</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserMenu />
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
          <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Theme
          </span>
          <div className="flex items-center gap-1">
            <AnimatedThemeToggler className="text-sidebar-foreground" />
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
