"use client"

import * as React from "react"
import { Link, Form, useNavigation } from "react-router"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { PasswordInput } from "~/components/ui/password-input"
import { Spinner } from "~/components/ui/spinner"

type SignupFormProps = Omit<
  React.ComponentProps<typeof Form>,
  "method" | "onSubmit" | "replace" | "encType"
>

export function SignupForm({ className, ...props }: SignupFormProps) {
  const navigation = useNavigation()
  const pending = navigation.state === "submitting"

  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [hasSubmitted, setHasSubmitted] = React.useState(false)

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

  const isFormValid = password.length > 0 && confirmPassword.length > 0 && isValidPassword && isMatch

  return (
    <Form
      method="post"
      replace
      noValidate
      className={cn("flex flex-col gap-6", className)}
      onSubmit={(e) => {
        setHasSubmitted(true)
        if (!isFormValid) {
          e.preventDefault()
        }
      }}
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
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your details below to create your account
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="Ada"
              disabled={pending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              placeholder="Lovelace"
              disabled={pending}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="m@example.com"
            disabled={pending}
          />
        </Field>
        <Field>
          <div className="space-y-1">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              disabled={pending}
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
            ) : null}
          </div>
        </Field>
        <Field>
          <div className="space-y-1">
            <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              disabled={pending}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={matchError ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {matchError ? (
              <p className="text-[0.8rem] font-medium text-destructive">{matchError}</p>
            ) : null}
          </div>
        </Field>
        <Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Spinner className="size-4" />
                Signing up
              </>
            ) : (
              "Sign Up"
            )}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          Already have an account?{" "}
          <Link to="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </FieldDescription>
      </FieldGroup>
    </Form>
  )
}
