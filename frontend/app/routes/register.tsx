import { Link, redirect } from "react-router"
import { ArrowLeft } from "lucide-react"

import { getMe, persistSession, register } from "~/lib/auth-client"
import { RegisterForm } from "~/components/register-form"
import { AnimatedThemeToggler } from "~/components/ui/animated-theme-toggler"
import type { Route } from "./+types/register"

type RegisterActionData = {
  error?: string
}

export async function clientAction(args: Route.ClientActionArgs) {
  const formData = await args.request.formData()
  const username = String(formData.get("username") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!username || !email || !password) {
    return { error: "Username, email and password are required." } satisfies RegisterActionData
  }

  try {
    const result = await register({ username, email, password })
    persistSession(result.access_token, result.user_id, {
      username: result.username,
      email: result.email,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not register."
    return { error: message } satisfies RegisterActionData
  }

  if (typeof window !== "undefined") {
    const { toast } = await import("sonner")
    toast.success("Account created successfully.")
    // Small delay to ensure state is committed and navigation is stable
    await new Promise((r) => setTimeout(r, 100))
  }
  throw redirect("/dashboard")
}

export async function clientLoader() {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token")
    if (token) {
      try {
        await getMe(token)
        throw redirect("/dashboard")
      } catch (err) {
        // Re-throw redirect responses — don't treat them as auth failures.
        if (err instanceof Response) throw err
        // Only clear session for real auth errors (e.g. 401).
        localStorage.removeItem("access_token")
        localStorage.removeItem("token_type")
        localStorage.removeItem("user_id")
        localStorage.removeItem("username")
        localStorage.removeItem("email")
      }
    }
  }
  return null
}

export async function action(_args: Route.ActionArgs) {
  return {
    error: "Client-side actions are required. Please enable JavaScript.",
  } satisfies RegisterActionData
}

export default function RegisterPage() {
  return (
    <div className="relative grid min-h-svh lg:grid-cols-2">
      <div className="absolute start-4 top-4 z-20 md:start-8 md:top-8">
        <Link
          to="/"
          className="group flex items-center gap-2 text-sm font-medium text-zinc-500 transition-all hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          <div className="flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-white/50 shadow-sm backdrop-blur-sm transition-all group-hover:bg-white dark:border-white/10 dark:bg-white/5 dark:group-hover:bg-white/10">
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          </div>
          <span className="tracking-tight">Back to home page</span>
        </Link>
      </div>
      <div className="absolute end-4 top-4 z-20 md:end-6 md:top-6">
        <AnimatedThemeToggler className="text-foreground" />
      </div>
      <div className="flex flex-col p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <RegisterForm />
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
      </div>
    </div>
  )
}
