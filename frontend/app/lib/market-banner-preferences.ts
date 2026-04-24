const MARKET_BANNER_STORAGE_KEY = "show_market_banner"
const MARKET_BANNER_EVENT = "market-banner-visibility-change"

export function isMarketBannerVisible(): boolean {
  if (typeof window === "undefined") return true
  const raw = localStorage.getItem(MARKET_BANNER_STORAGE_KEY)
  if (raw === null) return true
  return raw !== "false"
}

export function setMarketBannerVisible(visible: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(MARKET_BANNER_STORAGE_KEY, visible ? "true" : "false")
  window.dispatchEvent(
    new CustomEvent(MARKET_BANNER_EVENT, { detail: { visible } }),
  )
}

export function onMarketBannerVisibilityChange(
  callback: (visible: boolean) => void,
): () => void {
  if (typeof window === "undefined") return () => {}

  const customHandler = (event: Event) => {
    const detail = (event as CustomEvent<{ visible?: boolean }>).detail
    if (typeof detail?.visible === "boolean") {
      callback(detail.visible)
      return
    }
    callback(isMarketBannerVisible())
  }

  const storageHandler = (event: StorageEvent) => {
    if (event.key !== MARKET_BANNER_STORAGE_KEY) return
    callback(event.newValue !== "false")
  }

  window.addEventListener(MARKET_BANNER_EVENT, customHandler)
  window.addEventListener("storage", storageHandler)
  return () => {
    window.removeEventListener(MARKET_BANNER_EVENT, customHandler)
    window.removeEventListener("storage", storageHandler)
  }
}
