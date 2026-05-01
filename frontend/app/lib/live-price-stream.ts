"use client"

import * as React from "react"

type TickerRow = { s?: string; c?: string; P?: string; q?: string }
type TickerMap = Record<string, { price: number; changePct: number; quoteVolume: number }>
type Listener = {
  symbols: Set<string>
  callback: (tickers: TickerMap) => void
  lastTickers: TickerMap
}

const listeners = new Map<number, Listener>()
let nextListenerId = 1
let ws: WebSocket | null = null
let reconnectTimer: number | null = null
let closedByManager = false
let currentStreamKey = ""
let reconnectDelayMs = 1500
const cache: TickerMap = {}
const dirtySymbols = new Set<string>()
let emitTimer: number | null = null
const BATCH_EMIT_DELAY_MS = 250

function parseRows(payload: unknown): TickerRow[] {
  if (Array.isArray(payload)) return payload as TickerRow[]
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    const wrapped = (payload as { data?: unknown }).data
    if (Array.isArray(wrapped)) return wrapped as TickerRow[]
    if (wrapped && typeof wrapped === "object") return [wrapped as TickerRow]
  }
  if (payload && typeof payload === "object") return [payload as TickerRow]
  return []
}

function emit() {
  if (emitTimer !== null) {
    window.clearTimeout(emitTimer)
    emitTimer = null
  }
  for (const listener of listeners.values()) {
    const { symbols, callback } = listener
    const scoped: TickerMap = {}
    for (const symbol of symbols) {
      const row = cache[symbol]
      if (row) scoped[symbol] = row
    }

    const previous = listener.lastTickers
    const previousKeys = Object.keys(previous)
    const nextKeys = Object.keys(scoped)
    const hasChanged =
      previousKeys.length !== nextKeys.length ||
      nextKeys.some((key) => {
        const prev = previous[key]
        const next = scoped[key]
        return (
          !prev ||
          prev.price !== next.price ||
          prev.changePct !== next.changePct ||
          prev.quoteVolume !== next.quoteVolume
        )
      })

    if (!hasChanged) continue
    listener.lastTickers = scoped
    callback(scoped)
  }
  dirtySymbols.clear()
}

function shouldFlushImmediately() {
  for (const { symbols } of listeners.values()) {
    if (symbols.size === 0) continue
    let changedForListener = 0
    for (const symbol of symbols) {
      if (dirtySymbols.has(symbol)) changedForListener += 1
    }
    if (changedForListener >= Math.max(1, Math.ceil(symbols.size / 2))) {
      return true
    }
  }
  return false
}

function scheduleEmit() {
  if (dirtySymbols.size === 0) return
  if (shouldFlushImmediately()) {
    emit()
    return
  }
  if (emitTimer !== null) return
  emitTimer = window.setTimeout(() => {
    emit()
  }, BATCH_EMIT_DELAY_MS)
}

function mergedSymbols(): string[] {
  const all = new Set<string>()
  for (const { symbols } of listeners.values()) {
    for (const symbol of symbols) all.add(symbol)
  }
  return Array.from(all).sort()
}

function connectForSymbols(symbols: string[]) {
  const limitedSymbols = symbols.slice(0, 80)
  const streamKey = limitedSymbols.join("|")
  if (streamKey === currentStreamKey) return
  currentStreamKey = streamKey

  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  closedByManager = true
  ws?.close()
  ws = null
  closedByManager = false

  if (limitedSymbols.length === 0) return

  const streams = limitedSymbols.map((s) => `${s.toLowerCase()}@ticker`).join("/")
  ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
  ws.onopen = () => {
    reconnectDelayMs = 1500
  }
  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as unknown
      const rows = parseRows(payload)
      let changed = false
      for (const row of rows) {
        const symbol = (row.s || "").toUpperCase()
        const price = Number.parseFloat(row.c || "")
        if (!symbol || !Number.isFinite(price)) continue
        const changePct = Number.parseFloat(row.P || "")
        const quoteVolume = Number.parseFloat(row.q || "")
        cache[symbol] = {
          price,
          changePct: Number.isFinite(changePct) ? changePct : 0,
          quoteVolume: Number.isFinite(quoteVolume) ? quoteVolume : 0,
        }
        dirtySymbols.add(symbol)
        changed = true
      }
      if (changed) scheduleEmit()
    } catch {
      // Ignore malformed packets.
    }
  }
  ws.onerror = () => {}
  ws.onclose = () => {
    if (closedByManager) return
    reconnectTimer = window.setTimeout(() => connectForSymbols(mergedSymbols()), reconnectDelayMs)
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 10000)
  }
}

function normalizeSymbols(symbols: string[]): string[] {
  const allowedQuotes = ["USDT", "USDC", "BUSD", "TRY", "EUR", "GBP", "JPY", "RUB", "CAD", "AUD", "CHF", "CNY"]
  return Array.from(
    new Set(
      symbols
        .map((s) => s.trim().toUpperCase())
        .filter((s) => {
          if (!/^[A-Z0-9]+$/.test(s)) return false
          const quote = allowedQuotes.find((q) => s.endsWith(q))
          if (!quote) return false
          const base = s.slice(0, s.length - quote.length)
          return /^[A-Z0-9]{2,12}$/.test(base)
        }),
    ),
  ).sort()
}

export function useLiveTickers(symbols: string[]): TickerMap {
  const [tickers, setTickers] = React.useState<TickerMap>({})
  const normalized = React.useMemo(() => normalizeSymbols(symbols), [symbols])
  const key = React.useMemo(() => normalized.join("|"), [normalized])

  React.useEffect(() => {
    const id = nextListenerId++
    listeners.set(id, {
      symbols: new Set(normalized),
      callback: setTickers,
      lastTickers: {},
    })
    connectForSymbols(mergedSymbols())
    emit()

    return () => {
      listeners.delete(id)
      connectForSymbols(mergedSymbols())
    }
  }, [key])

  return tickers
}
