/** Persisted “liquid glass” (frosted / translucent UI). Off → solid opaque cards, no backdrop blur. */

const STORAGE_KEY = "tauron_liquid_glass"
const EVENT = "tauron:liquid-glass-change"

export function isLiquidGlassEnabled(): boolean {
  if (typeof window === "undefined") return true
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) return true
  return raw !== "false"
}

export function setLiquidGlassEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false")
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { enabled } }))
}

export function onLiquidGlassChange(callback: (enabled: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {}

  const handler = (event: Event) => {
    const d = (event as CustomEvent<{ enabled?: boolean }>).detail
    if (typeof d?.enabled === "boolean") {
      callback(d.enabled)
      return
    }
    callback(isLiquidGlassEnabled())
  }

  const storageHandler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return
    callback(e.newValue !== "false")
  }

  window.addEventListener(EVENT, handler)
  window.addEventListener("storage", storageHandler)
  return () => {
    window.removeEventListener(EVENT, handler)
    window.removeEventListener("storage", storageHandler)
  }
}

/** Sync ``document.documentElement`` — solid-cards mode when liquid glass is off. */
export function syncLiquidGlassDocumentAttribute(): void {
  if (typeof document === "undefined") return
  const solid = !isLiquidGlassEnabled()
  document.documentElement.toggleAttribute("data-solid-cards", solid)
}
