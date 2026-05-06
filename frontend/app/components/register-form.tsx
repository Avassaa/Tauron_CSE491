"use client"

import * as React from "react"
import { Eye, EyeOff, Check, X, ShieldCheck } from "lucide-react"
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

type RegisterFormProps = Omit<
  React.ComponentProps<typeof Form>,
  "method" | "onSubmit" | "replace" | "encType"
>

export function RegisterForm({ className, ...props }: RegisterFormProps) {
  const actionData = useActionData() as { error?: string } | undefined
  const navigation = useNavigation()
  const pending = navigation.state === "submitting"
  const [showPassword, setShowPassword] = React.useState(false)
  const [passwordValue, setPasswordValue] = React.useState("")
  const [invalidFields, setInvalidFields] = React.useState<Set<string>>(new Set())
  const invalidTimerRef = React.useRef<number | null>(null)

  const requirements = [
    { label: "At least 8 characters", met: passwordValue.length >= 8 },
    { label: "At least one uppercase letter", met: /[A-Z]/.test(passwordValue) },
    { label: "At least one lowercase letter", met: /[a-z]/.test(passwordValue) },
    { label: "At least one number", met: /\d/.test(passwordValue) },
    { label: "At least one special character", met: /[^A-Za-z0-9]/.test(passwordValue) },
  ]

  const allRequirementsMet = requirements.every((r) => r.met)

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

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      const formData = new FormData(event.currentTarget)
      const username = String(formData.get("username") ?? "").trim()
      const email = String(formData.get("email") ?? "").trim()
      const password = String(formData.get("password") ?? "")
      const passwordConfirm = String(formData.get("passwordConfirm") ?? "")
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      const nextInvalid = new Set<string>()
      const messages: string[] = []

      if (!username) {
        nextInvalid.add("username")
        messages.push("Username is required.")
      }

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
      } else if (!allRequirementsMet) {
        nextInvalid.add("password")
        const missing = requirements.filter(r => !r.met).map(r => r.label).join(", ")
        messages.push(`Password must meet all requirements: ${missing}`)
      }

      if (!passwordConfirm) {
        nextInvalid.add("passwordConfirm")
        messages.push("Confirm password is required.")
      } else if (passwordConfirm !== password) {
        nextInvalid.add("passwordConfirm")
        messages.push("Passwords do not match.")
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
    },
    [allRequirementsMet, requirements],
  )

  return (
    <Form
      method="post"
      noValidate
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <FieldGroup className="gap-3.5">
        <div className="flex flex-col items-center gap-1 text-center mb-2">
          <Link
            to="/"
            className="mb-1 cursor-pointer text-4xl font-semibold tracking-tight text-foreground no-underline hover:opacity-90 md:text-5xl"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Tauron
          </Link>
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your details below to register
          </p>
        </div>
        <Field>
          <FieldLabel
            htmlFor="username"
            className={cn(invalidFields.has("username") && "text-destructive")}
          >
            Username
          </FieldLabel>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            disabled={pending}
            aria-invalid={invalidFields.has("username")}
          />
        </Field>
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
            autoComplete="email"
            placeholder="m@example.com"
            disabled={pending}
            aria-invalid={invalidFields.has("email")}
          />
          <FieldDescription>
            Use a valid email address.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel
            htmlFor="password"
            className={cn(invalidFields.has("password") && "text-destructive")}
          >
            Password
          </FieldLabel>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              disabled={pending}
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              aria-invalid={invalidFields.has("password")}
              className={cn(
                "pr-10 transition-all duration-300",
                allRequirementsMet && passwordValue.length > 0 && "border-emerald-500/50 ring-emerald-500/20 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30 dark:border-emerald-500/40"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
              disabled={pending}
            >
              {showPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </div>

          {passwordValue.length > 0 && !allRequirementsMet && (
            <div className="mt-2 space-y-1 px-0.5">
              {requirements.filter(r => !r.met).map((req, i) => (
                <div key={i} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <X className="size-3 text-red-500 stroke-[3]" />
                  <span className="text-[12px] font-medium text-red-500 dark:text-red-400">
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Field>
        <Field>
          <FieldLabel
            htmlFor="passwordConfirm"
            className={cn(invalidFields.has("passwordConfirm") && "text-destructive")}
          >
            Confirm password
          </FieldLabel>
          <div className="relative">
            <Input
              id="passwordConfirm"
              name="passwordConfirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              disabled={pending}
              aria-invalid={invalidFields.has("passwordConfirm")}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
              disabled={pending}
            >
              {showPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </div>
          <FieldDescription>Retype your password to confirm.</FieldDescription>
        </Field>
        <Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Spinner className="size-4" />
                Creating account
              </>
            ) : (
              "Register"
            )}
          </Button>
        </Field>
        <div className="my-1 h-px w-full bg-border" aria-hidden />
        <FieldDescription className="text-center">
          Already have an account?{" "}
          <Link to="/login" className="underline underline-offset-4">
            Login
          </Link>
        </FieldDescription>
      </FieldGroup>
    </Form>
  )
}
