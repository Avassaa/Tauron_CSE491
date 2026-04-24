"use client"

import * as React from "react"

import { Marquee } from "~/routes/home/components/marquee"
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
  const [visible, setVisible] = React.useState<boolean | null>(null)
  const [tickerMap, setTickerMap] = React.useState<Record<string, TickerEntry>>(() =>
    initialTickerMap(),
  )
  const [connected, setConnected] = React.useState(false)
  const bannerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    setVisible(isMarketBannerVisible())
    return onMarketBannerVisibilityChange((nextVisible) => {
      setVisible(nextVisible)
    })
  }, [])

  React.useEffect(() => {
    const root = document.documentElement
    if (!visible) {
      root.style.setProperty("--market-banner-offset", "0px")
      return () => {
        root.style.setProperty("--market-banner-offset", "0px")
      }
    }

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
    if (!visible) return

    let ws: WebSocket | null = null
    let reconnectTimer: number | null = null
    let closedByCleanup = false

    const applyTickerRows = (rows: Array<{ s?: string; c?: string; P?: string }>) => {
      if (!rows.length) return
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

    const connect = () => {
      ws = new WebSocket("wss://stream.binance.com:9443/ws/!ticker@arr")
      setConnected(false)

      ws.onopen = () => {
        setConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as Array<{ s?: string; c?: string; P?: string }>
          if (Array.isArray(payload)) {
            applyTickerRows(payload)
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

    fetch("https://api.binance.com/api/v3/ticker/24hr")
      .then(async (response) => {
        if (!response.ok) return
        const rows = (await response.json()) as Array<{ symbol?: string; lastPrice?: string; priceChangePercent?: string }>
        const normalized = rows.map((r) => ({
          s: r.symbol,
          c: r.lastPrice,
          P: r.priceChangePercent,
        }))
        applyTickerRows(normalized)
      })
      .catch(() => {})

    connect()

    return () => {
      closedByCleanup = true
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [visible])

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
      <span className="tabular-nums">${ticker.price}</span>
      <span
        className={cn(
          "tabular-nums",
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

  if (visible !== true) return null

  return (
    <div
      ref={bannerRef}
      className="fixed inset-x-0 top-0 z-[9] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <Marquee className="py-2 [--duration:55s] [--gap:1.5rem]" repeat={6}>
        <div className="ml-2 mr-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              connected ? "bg-emerald-500" : "bg-amber-500",
            )}
          />
          {connected ? "Live" : "Reconnecting"}
        </div>
        {tickerItems}
      </Marquee>
    </div>
  )
}
