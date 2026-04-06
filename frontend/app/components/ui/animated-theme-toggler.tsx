"use client"

import { Moon, Sun } from "lucide-react"

import { useAppTheme } from "~/theme-context"
import { cn } from "~/lib/utils"

const togglerBase =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 shadow-none outline-none ring-0 ring-offset-0 transition-opacity focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:size-4"

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {}

export function AnimatedThemeToggler({ className, ...rest }: AnimatedThemeTogglerProps) {
  const { theme } = useAppTheme()
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      data-theme-toggle=""
      className={cn(togglerBase, "cursor-pointer hover:opacity-80", className)}
      {...rest}
    >
      {isDark ? <Sun /> : <Moon />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
