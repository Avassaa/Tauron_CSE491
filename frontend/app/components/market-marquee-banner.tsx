"use client"

import * as React from "react"

import {
  isMarketBannerVisible,
  onMarketBannerVisibilityChange,
} from "~/lib/market-banner-preferences"
import { cn } from "~/lib/utils"

type TickerEntry = {
  symbol: string
  label: string
  price: string
  changePct: number | null
}

const STREAM_SYMBOLS = [
  { symbol: "btcusdt", label: "BTC/USDT" },
  { symbol: "ethusdt", label: "ETH/USDT" },
  { symbol: "solusdt", label: "SOL/USDT" },
  { symbol: "bnbusdt", label: "BNB/USDT" },
  { symbol: "xrpusdt", label: "XRP/USDT" },
  { symbol: "dogeusdt", label: "DOGE/USDT" },
  { symbol: "adausdt", label: "ADA/USDT" },
  { symbol: "avaxusdt", label: "AVAX/USDT" },
  { symbol: "dotusdt", label: "DOT/USDT" },
  { symbol: "trxusdt", label: "TRX/USDT" },
  { symbol: "usdttry", label: "USDT/TRY" },
] as const

const INITIAL_TICKERS: TickerEntry[] = STREAM_SYMBOLS.map((entry) => ({
  symbol: entry.symbol.toUpperCase(),
  label: entry.label,
  price: "--",
  changePct: null,
}))
const MARKET_BANNER_FALLBACK_HEIGHT_PX = 33

function initialTickerMap(): Record<string, TickerEntry> {
  const map: Record<string, TickerEntry> = {}
  for (const ticker of INITIAL_TICKERS) {
    map[ticker.symbol] = ticker
  }
  return map
}

function formatPrice(value: number): string {
  if (value >= 1000) return value.toFixed(2)
  if (value >= 1) return value.toFixed(4)
  return value.toFixed(6)
}

export function MarketMarqueeBanner() {
  const [visible, setVisible] = React.useState<boolean>(() => isMarketBannerVisible())
  const [tickerMap, setTickerMap] = React.useState<Record<string, TickerEntry>>(() =>
    initialTickerMap(),
  )
  const [connected, setConnected] = React.useState(false)
  const [flashBySymbol, setFlashBySymbol] = React.useState<Record<string, "up" | "down">>({})
  const bannerRef = React.useRef<HTMLDivElement | null>(null)
  const lastPriceBySymbolRef = React.useRef<Record<string, number>>({})
  const flashTimersRef = React.useRef<Record<string, number>>({})

  const queuePriceFlash = React.useCallback((symbol: string, direction: "up" | "down") => {
    setFlashBySymbol((prev) => ({ ...prev, [symbol]: direction }))
    const existing = flashTimersRef.current[symbol]
    if (existing) window.clearTimeout(existing)
    flashTimersRef.current[symbol] = window.setTimeout(() => {
      setFlashBySymbol((prev) => {
        const next = { ...prev }
        delete next[symbol]
        return next
      })
      delete flashTimersRef.current[symbol]
    }, 650)
  }, [])

  React.useEffect(
    () =>
      onMarketBannerVisibilityChange((nextVisible) => {
        setVisible(nextVisible)
      }),
    [],
  )

  React.useLayoutEffect(() => {
    const root = document.documentElement
    if (!visible) {
      root.style.setProperty("--market-banner-offset", "0px")
      return () => {
        root.style.setProperty("--market-banner-offset", "0px")
      }
    }

    // Reserve space immediately to avoid page jump between route transitions.
    root.style.setProperty("--market-banner-offset", `${MARKET_BANNER_FALLBACK_HEIGHT_PX}px`)

    const setOffsetFromHeight = () => {
      const h = bannerRef.current?.offsetHeight ?? 0
      root.style.setProperty("--market-banner-offset", `${h}px`)
    }

    setOffsetFromHeight()

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined" && bannerRef.current) {
      observer = new ResizeObserver(() => {
        setOffsetFromHeight()
      })
      observer.observe(bannerRef.current)
    }

    return () => {
      observer?.disconnect()
      root.style.setProperty("--market-banner-offset", "0px")
    }
  }, [visible])

  React.useEffect(() => {
    return () => {
      for (const timer of Object.values(flashTimersRef.current)) {
        window.clearTimeout(timer)
      }
      flashTimersRef.current = {}
    }
  }, [])

  React.useEffect(() => {
    if (!visible) return

    let ws: WebSocket | null = null
    let reconnectTimer: number | null = null
    let restPollingTimer: number | null = null
    let staleCheckTimer: number | null = null
    let lastUpdateMs = 0
    let closedByCleanup = false

    const applyTickerRows = (rows: Array<{ s?: string; c?: string; P?: string }>) => {
      if (!rows.length) return
      for (const row of rows) {
        const symbol = (row.s || "").toUpperCase()
        if (!symbol) continue
        const nextPrice = Number.parseFloat(row.c || "")
        if (!Number.isFinite(nextPrice)) continue
        const prevPrice = lastPriceBySymbolRef.current[symbol]
        if (Number.isFinite(prevPrice) && nextPrice !== prevPrice) {
          queuePriceFlash(symbol, nextPrice > prevPrice ? "up" : "down")
        }
        lastPriceBySymbolRef.current[symbol] = nextPrice
      }
      setTickerMap((prev) => {
        let changed = false
        const next = { ...prev }
        for (const row of rows) {
          const symbol = (row.s || "").toUpperCase()
          if (!symbol || !(symbol in next)) continue
          const priceNum = Number.parseFloat(row.c || "")
          const changeNum = Number.parseFloat(row.P || "")
          if (!Number.isFinite(priceNum)) continue
          const current = next[symbol]
          const updated: TickerEntry = {
            ...current,
            price: formatPrice(priceNum),
            changePct: Number.isFinite(changeNum) ? changeNum : null,
          }
          next[symbol] = updated
          changed = true
        }
        return changed ? next : prev
      })
    }

    const fetchRestSnapshot = () => {
      fetch("https://api.binance.com/api/v3/ticker/24hr")
        .then(async (response) => {
          if (!response.ok) return
          const rows = (await response.json()) as Array<{
            symbol?: string
            lastPrice?: string
            priceChangePercent?: string
          }>
          const normalized = rows.map((r) => ({
            s: r.symbol,
            c: r.lastPrice,
            P: r.priceChangePercent,
          }))
          applyTickerRows(normalized)
          lastUpdateMs = Date.now()
        })
        .catch(() => {})
    }

    const parseRowsFromPayload = (
      raw: unknown,
    ): Array<{ s?: string; c?: string; P?: string }> => {
      if (Array.isArray(raw)) return raw as Array<{ s?: string; c?: string; P?: string }>
      if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
        const wrapped = (raw as { data?: unknown }).data
        if (Array.isArray(wrapped)) {
          return wrapped as Array<{ s?: string; c?: string; P?: string }>
        }
        if (wrapped && typeof wrapped === "object") {
          return [wrapped as { s?: string; c?: string; P?: string }]
        }
      }
      if (raw && typeof raw === "object") return [raw as { s?: string; c?: string; P?: string }]
      return []
    }

    const connect = () => {
      const streams = STREAM_SYMBOLS.map((item) => `${item.symbol}@ticker`).join("/")
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
      setConnected(false)

      ws.onopen = () => {
        setConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as unknown
          const rows = parseRowsFromPayload(payload)
          if (rows.length > 0) {
            applyTickerRows(rows)
            lastUpdateMs = Date.now()
          }
        } catch {
          // Ignore malformed packets.
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (closedByCleanup) return
        reconnectTimer = window.setTimeout(connect, 1500)
      }
    }

    fetchRestSnapshot()

    // Keep prices moving even when websocket opens but doesn't deliver frames.
    staleCheckTimer = window.setInterval(() => {
      const now = Date.now()
      if (lastUpdateMs === 0 || now - lastUpdateMs > 7000) {
        fetchRestSnapshot()
      }
    }, 3000)

    // Slow polling fallback in restrictive networks.
    restPollingTimer = window.setInterval(() => {
      fetchRestSnapshot()
    }, 20000)

    connect()

    return () => {
      closedByCleanup = true
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      if (restPollingTimer !== null) window.clearInterval(restPollingTimer)
      if (staleCheckTimer !== null) window.clearInterval(staleCheckTimer)
      ws?.close()
    }
  }, [queuePriceFlash, visible])

  const tickers = React.useMemo(
    () =>
      STREAM_SYMBOLS.map((item) => {
        const symbol = item.symbol.toUpperCase()
        return (
          tickerMap[symbol] || {
            symbol,
            label: item.label,
            price: "--",
            changePct: null,
          }
        )
      }),
    [tickerMap],
  )

  const tickerItems = tickers.map((ticker) => (
    <div
      key={ticker.symbol}
      className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs md:text-sm"
    >
      <span className="font-semibold">{ticker.label}</span>
      <span
        className={cn(
          "inline-block min-w-[10ch] px-1 text-right tabular-nums transition-colors duration-300",
          flashBySymbol[ticker.symbol] === "down" && "text-red-500 dark:text-red-400",
          flashBySymbol[ticker.symbol] === "up" && "text-emerald-500 dark:text-emerald-400",
        )}
      >
        ${ticker.price}
      </span>
      <span
        className={cn(
          "inline-block min-w-[8ch] text-right tabular-nums",
          ticker.changePct == null
            ? "text-muted-foreground"
            : ticker.changePct >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400",
        )}
      >
        {ticker.changePct == null ? "--" : `${ticker.changePct >= 0 ? "+" : ""}${ticker.changePct.toFixed(2)}%`}
      </span>
    </div>
  ))

  if (!visible) return null

  return (
    <div
      ref={bannerRef}
      className="fixed inset-x-0 top-0 z-[9] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="overflow-hidden py-2">
        <div className="flex w-max [--duration:55s] will-change-transform [animation:market-ticker_var(--duration)_linear_infinite]">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="ml-2 flex shrink-0 items-center gap-6 pr-6">
              <div className="mr-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    connected ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
                {connected ? "Live" : "Reconnecting"}
              </div>
              {tickerItems}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
