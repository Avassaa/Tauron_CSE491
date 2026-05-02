"use client"

import * as React from "react"
import { Link, Form, useActionData, useNavigation } from "react-router"
import { toast } from "sonner"

import { forgotPassword } from "~/lib/auth-client"
import { AnimatedThemeToggler } from "~/components/ui/animated-theme-toggler"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import type { Route } from "./+types/forgot-password"

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Tauron - Forgot Password" },
    { name: "description", content: "Recover your Tauron account password." },
  ]
}

type ActionData = {
  error?: string
  success?: boolean
}

export async function clientAction(args: Route.ClientActionArgs) {
  const formData = await args.request.formData()
  const email = String(formData.get("email") ?? "").trim()

  if (!email) {
    return { error: "Email is required." } satisfies ActionData
  }

  try {
    await forgotPassword(email)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed."
    return { error: message } satisfies ActionData
  }

  return { success: true } satisfies ActionData
}

export default function ForgotPasswordPage() {
  const actionData = useActionData() as ActionData | undefined
  const navigation = useNavigation()
  const pending = navigation.state === "submitting"

  React.useEffect(() => {
    if (actionData?.error) {
      toast.error(actionData.error)
    }
    if (actionData?.success) {
      toast.success("If your email is registered, a password reset link has been sent.")
    }
  }, [actionData])

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
              className="flex flex-col gap-6"
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
                  <h1 className="text-2xl font-bold">Forgot password</h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    Enter your email to receive a password reset link
                  </p>
                </div>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="m@example.com"
                    disabled={pending}
                  />
                </Field>
                <Field>
                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? (
                      <>
                        <Spinner className="size-4" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </Field>
                <div className="my-1 h-px w-full bg-border" aria-hidden />
                <FieldDescription className="text-center">
                  Remember your password?{" "}
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
