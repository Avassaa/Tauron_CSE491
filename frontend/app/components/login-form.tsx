"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Link, Form, useActionData, useNavigation } from "react-router"
import { toast } from "sonner"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"

type LoginFormProps = Omit<
  React.ComponentProps<typeof Form>,
  "method" | "onSubmit" | "replace" | "encType"
>

export function LoginForm({ className, ...props }: LoginFormProps) {
  const actionData = useActionData() as { error?: string } | undefined
  const navigation = useNavigation()
  const pending = navigation.state === "submitting"
  const [showPassword, setShowPassword] = React.useState(false)
  const [invalidFields, setInvalidFields] = React.useState<Set<string>>(new Set())
  const invalidTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (invalidTimerRef.current !== null) {
        window.clearTimeout(invalidTimerRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (actionData?.error) {
      toast.error(actionData.error)
    }
  }, [actionData?.error])

  const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "").trim()
    const password = String(formData.get("password") ?? "")
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    const nextInvalid = new Set<string>()
    const messages: string[] = []

    if (!email) {
      nextInvalid.add("email")
      messages.push("Email is required.")
    } else if (!emailPattern.test(email)) {
      nextInvalid.add("email")
      messages.push("Please enter a valid email address.")
    }

    if (!password) {
      nextInvalid.add("password")
      messages.push("Password is required.")
    }

    if (nextInvalid.size === 0) {
      setInvalidFields(new Set())
      return
    }

    event.preventDefault()
    setInvalidFields(nextInvalid)
    toast.error(messages[0] ?? "Please fix the highlighted fields.")
    if (invalidTimerRef.current !== null) {
      window.clearTimeout(invalidTimerRef.current)
    }
    invalidTimerRef.current = window.setTimeout(() => {
      setInvalidFields(new Set())
    }, 3000)
  }, [])

  return (
    <Form
      method="post"
      replace
      noValidate
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <Link
            to="/"
            className="mb-1 cursor-pointer text-4xl font-semibold tracking-tight text-foreground no-underline hover:opacity-90 md:text-5xl"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Tauron
          </Link>
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>
        <Field>
          <FieldLabel
            htmlFor="email"
            className={cn(invalidFields.has("email") && "text-destructive")}
          >
            Email
          </FieldLabel>
          <Input
            id="email"
            name="email"
            type="text"
            inputMode="email"
            autoComplete="username"
            placeholder="m@example.com"
            disabled={pending}
            aria-invalid={invalidFields.has("email")}
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel
              htmlFor="password"
              className={cn(invalidFields.has("password") && "text-destructive")}
            >
              Password
            </FieldLabel>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              disabled={pending}
              aria-invalid={invalidFields.has("password")}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
              disabled={pending}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Spinner className="size-4" />
                Signing in
              </>
            ) : (
              "Login"
            )}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="underline underline-offset-4">
            Sign up
          </Link>
        </FieldDescription>
      </FieldGroup>
    </Form>
  )
}
