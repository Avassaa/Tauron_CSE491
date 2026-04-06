"use client"

import * as React from "react"

export type AppTheme = "light" | "dark"

const STORAGE_KEY = "theme"

function subscribeThemechange(listener: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("themechange", listener)
  return () => window.removeEventListener("themechange", listener)
}

function readStoredTheme(): AppTheme {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    if (t === "dark" || t === "light") return t
  } catch {
    /* ignore */
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function getThemeSnapshot(): AppTheme {
  if (typeof document === "undefined") return "light"
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function getServerSnapshot(): AppTheme {
  return "light"
}

export function applyThemeToDocument(theme: AppTheme) {
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
  root.style.colorScheme = theme
  root.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("themechange"))
}

export function useAppTheme() {
  const theme = React.useSyncExternalStore(
    subscribeThemechange,
    getThemeSnapshot,
    getServerSnapshot,
  )

  const setTheme = React.useCallback((t: AppTheme) => {
    applyThemeToDocument(t)
  }, [])

  const toggleTheme = React.useCallback(() => {
    const next: AppTheme = getThemeSnapshot() === "dark" ? "light" : "dark"
    applyThemeToDocument(next)
  }, [])

  return React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )
}
