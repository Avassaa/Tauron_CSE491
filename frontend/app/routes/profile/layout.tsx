import { Outlet, NavLink } from "react-router"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { User, Shield, Bell, Palette, CreditCard } from "lucide-react"

export default function ProfileLayout() {
  const sections = [
    { name: "Profile", icon: User, to: "/profile/settings" },
    { name: "Account", icon: CreditCard, to: "/profile/account" },
    { name: "Security", icon: Shield, to: "/profile/security" },
    { name: "Notifications", icon: Bell, to: "/profile/notifications" },
    { name: "Appearance", icon: Palette, to: "/profile/appearance" },
  ]

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-muted-foreground text-lg mt-2">
            Manage your account settings, security preferences, and dashboard experience.
          </p>
        </div>

        <Separator className="opacity-50" />

        <div className="grid gap-10 md:grid-cols-[200px_1fr]">
          <aside className="space-y-4">
            <nav className="flex flex-col space-y-2">
              {sections.map((section) => (
                <NavLink key={section.name} to={section.to} className="w-full">
                  {({ isActive }) => (
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={`justify-start gap-3 h-11 px-4 w-full ${isActive ? 'font-semibold' : ''}`}
                    >
                      <section.icon className="size-4 opacity-70" />
                      {section.name}
                    </Button>
                  )}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
