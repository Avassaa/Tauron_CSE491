"use client"

import * as React from "react"
import { redirect, Link, Form, useActionData, useNavigation, useSearchParams } from "react-router"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { resetPassword } from "~/lib/auth-client"
import { AnimatedThemeToggler } from "~/components/ui/animated-theme-toggler"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "~/components/ui/field"
import { PasswordInput } from "~/components/ui/password-input"
import { Spinner } from "~/components/ui/spinner"
import type { Route } from "./+types/reset-password"

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Tauron - Reset Password" },
    { name: "description", content: "Set a new password for your Tauron account." },
  ]
}

type ActionData = {
  error?: string
}

export async function clientAction(args: Route.ClientActionArgs) {
  const formData = await args.request.formData()
  const token = String(formData.get("token") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!token) {
    return { error: "Invalid or missing reset token." } satisfies ActionData
  }
  if (!password) {
    return { error: "Password is required." } satisfies ActionData
  }

  try {
    await resetPassword(token, password)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password reset failed."
    return { error: message } satisfies ActionData
  }

  if (typeof window !== "undefined") {
    const { toast } = await import("sonner")
    toast.success("Password has been reset successfully. You can now login.")
  }
  throw redirect("/login")
}

export default function ResetPasswordPage() {
  const actionData = useActionData() as ActionData | undefined
  const navigation = useNavigation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") || ""
  
  const pending = navigation.state === "submitting"
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [hasSubmitted, setHasSubmitted] = React.useState(false)
  const [invalidFields, setInvalidFields] = React.useState<Set<string>>(new Set())
  const invalidTimerRef = React.useRef<number | null>(null)

  const hasMinLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecialChar = /[@#$^&*()_\-+=./']/.test(password) && !/[^A-Za-z0-9@#$^&*()_\-+=./']/.test(password)

  const isValidPassword = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecialChar
  const isMatch = password === confirmPassword

  const showPasswordCriteria = hasSubmitted || password.length > 0
  const isPasswordError = showPasswordCriteria && !isValidPassword

  const matchError =
    (hasSubmitted || confirmPassword.length > 0) && !isMatch
      ? "Passwords do not match."
      : null

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
      setHasSubmitted(true)
      
      const nextInvalid = new Set<string>()
      const messages: string[] = []

      if (!password) {
        nextInvalid.add("password")
        messages.push("Password is required.")
      } else if (!isValidPassword) {
        nextInvalid.add("password")
        messages.push("Password does not meet the requirements.")
      }

      if (!confirmPassword) {
        nextInvalid.add("passwordConfirm")
        messages.push("Confirm password is required.")
      } else if (!isMatch) {
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
    [password, confirmPassword, isValidPassword, isMatch],
  )

  return (
    <div className="relative grid min-h-svh lg:grid-cols-2">
      <div className="absolute end-4 top-4 z-20 md:end-6 md:top-6">
        <AnimatedThemeToggler className="text-foreground" />
      </div>
      <div className="flex flex-col p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <Form
              method="post"
              replace
              noValidate
              onSubmit={handleSubmit}
              className="flex flex-col gap-6"
            >
              <input type="hidden" name="token" value={token} />
              
              <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                  <Link
                    to="/"
                    className="mb-1 cursor-pointer text-4xl font-semibold tracking-tight text-foreground no-underline hover:opacity-90 md:text-5xl"
                    style={{ fontFamily: "'Dancing Script', cursive" }}
                  >
                    Tauron
                  </Link>
                  <h1 className="text-2xl font-bold">Reset Password</h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    Enter your new password below
                  </p>
                </div>
                
                {!token && (
                  <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                    No reset token found in the URL. Please use the link sent to your email.
                  </div>
                )}

                <Field>
                  <FieldLabel 
                    htmlFor="password"
                    className={cn(invalidFields.has("password") && "text-destructive")}
                  >
                    New Password
                  </FieldLabel>
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    disabled={pending || !token}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={isPasswordError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {showPasswordCriteria ? (
                    <ul className="mt-2 space-y-1 text-[0.8rem] ml-1">
                      <li className={cn("transition-all duration-200", hasMinLength ? "text-muted-foreground line-through opacity-70" : "text-destructive font-medium")}>
                        • At least 8 characters long
                      </li>
                      <li className={cn("transition-all duration-200", hasUpper ? "text-muted-foreground line-through opacity-70" : "text-destructive font-medium")}>
                        • At least one uppercase letter
                      </li>
                      <li className={cn("transition-all duration-200", hasLower ? "text-muted-foreground line-through opacity-70" : "text-destructive font-medium")}>
                        • At least one lowercase letter
                      </li>
                      <li className={cn("transition-all duration-200", hasNumber ? "text-muted-foreground line-through opacity-70" : "text-destructive font-medium")}>
                        • At least one number (0-9)
                      </li>
                      <li className={cn("transition-all duration-200", hasSpecialChar ? "text-muted-foreground line-through opacity-70" : "text-destructive font-medium")}>
                        • One symbol from {"(@#$^&*()-_+=./')"}
                      </li>
                    </ul>
                  ) : (
                    <FieldDescription>Choose a strong new password.</FieldDescription>
                  )}
                </Field>

                <Field>
                  <FieldLabel 
                    htmlFor="passwordConfirm"
                    className={cn(invalidFields.has("passwordConfirm") && "text-destructive")}
                  >
                    Confirm Password
                  </FieldLabel>
                  <PasswordInput
                    id="passwordConfirm"
                    name="passwordConfirm"
                    autoComplete="new-password"
                    disabled={pending || !token}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={matchError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {matchError ? (
                    <p className="text-[0.8rem] font-medium text-destructive">{matchError}</p>
                  ) : (
                    <FieldDescription>Retype your password to confirm.</FieldDescription>
                  )}
                </Field>

                <Field>
                  <Button type="submit" className="w-full" disabled={pending || !token}>
                    {pending ? (
                      <>
                        <Spinner className="size-4" />
                        Resetting...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </Field>
                <div className="my-1 h-px w-full bg-border" aria-hidden />
                <FieldDescription className="text-center">
                  <Link to="/login" className="underline underline-offset-4">
                    Back to login
                  </Link>
                </FieldDescription>
              </FieldGroup>
            </Form>
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
