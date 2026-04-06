import { redirect } from "react-router"

import { LoginForm } from "~/components/login-form"
import { AnimatedThemeToggler } from "~/components/ui/animated-theme-toggler"
import type { Route } from "./+types/login"

export async function clientAction(_args: Route.ClientActionArgs) {
  await new Promise((r) => setTimeout(r, 650))
  if (typeof window !== "undefined") {
    const { toast } = await import("sonner")
    toast.success("Signed in successfully.")
  }
  return redirect("/dashboard")
}

export async function action(_args: Route.ActionArgs) {
  return redirect("/dashboard")
}

export default function LoginPage() {
  return (
    <div className="relative grid min-h-svh lg:grid-cols-2">
      <div className="absolute end-4 top-4 z-20 md:end-6 md:top-6">
        <AnimatedThemeToggler className="text-foreground" />
      </div>
      <div className="flex flex-col p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-neutral-100 dark:bg-muted lg:block">
        <img
          src="/assets/images/login-white.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover dark:hidden"
        />
        <img
          src="/assets/images/login.png"
          alt=""
          className="absolute inset-0 hidden h-full w-full object-cover dark:block"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[42%] bg-gradient-to-b from-black/10 via-black/5 via-38% to-transparent dark:from-neutral-950/85 dark:via-neutral-950/35"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[45%] bg-gradient-to-t from-black/12 via-black/5 via-35% to-transparent dark:from-neutral-950/90 dark:via-neutral-950/40"
          aria-hidden
        />
      </div>
    </div>
  )
}
