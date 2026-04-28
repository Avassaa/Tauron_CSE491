"use client"

import * as React from "react"

type TickerRow = { s?: string; c?: string; P?: string; q?: string }
type TickerMap = Record<string, { price: number; changePct: number; quoteVolume: number }>
type Listener = {
  symbols: Set<string>
  callback: (tickers: TickerMap) => void
}

const listeners = new Map<number, Listener>()
let nextListenerId = 1
let ws: WebSocket | null = null
let reconnectTimer: number | null = null
let closedByManager = false
let currentStreamKey = ""
const cache: TickerMap = {}

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
  for (const { symbols, callback } of listeners.values()) {
    const scoped: TickerMap = {}
    for (const symbol of symbols) {
      const row = cache[symbol]
      if (row) scoped[symbol] = row
    }
    callback(scoped)
  }
}

function mergedSymbols(): string[] {
  const all = new Set<string>()
  for (const { symbols } of listeners.values()) {
    for (const symbol of symbols) all.add(symbol)
  }
  return Array.from(all).sort()
}

function connectForSymbols(symbols: string[]) {
  const streamKey = symbols.join("|")
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

  if (symbols.length === 0) return

  const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join("/")
  ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
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
        changed = true
      }
      if (changed) emit()
    } catch {
      // Ignore malformed packets.
    }
  }
  ws.onclose = () => {
    if (closedByManager) return
    reconnectTimer = window.setTimeout(() => connectForSymbols(mergedSymbols()), 1500)
  }
}

function normalizeSymbols(symbols: string[]): string[] {
  return Array.from(
    new Set(
      symbols
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9]+$/.test(s)),
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
