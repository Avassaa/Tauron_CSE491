"use client"

import { apiBaseUrl } from "~/lib/api-client"
import type { NotificationResponse } from "~/lib/api-client"

type Listener = (notification: NotificationResponse) => void

const listeners = new Set<Listener>()
let ws: WebSocket | null = null
let reconnectTimer: number | null = null
let pingIntervalId: number | null = null

const RECONNECT_MS = 2000
const PING_INTERVAL_MS = 25_000

function detachWebSocket(socket: WebSocket) {
  socket.onopen = null
  socket.onmessage = null
  socket.onerror = null
  socket.onclose = null
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("access_token")
}

function buildNotificationsWsUrl(token: string): string {
  const base = apiBaseUrl.trim()
  const wsOrigin = base.startsWith("https")
    ? base.replace(/^https/, "wss")
    : base.replace(/^http/, "ws")
  return `${wsOrigin}/users/me/notifications/ws?token=${encodeURIComponent(token)}`
}

function parseNotificationCreated(raw: unknown): NotificationResponse | null {
  if (!raw || typeof raw !== "object") return null
  const envelope = raw as Record<string, unknown>
  if (envelope.type !== "notification.created") return null
  const row = envelope.notification
  if (!row || typeof row !== "object") return null
  const n = row as Record<string, unknown>
  if (typeof n.id !== "string") return null
  const payload = n.payload
  return {
    id: n.id,
    user_id: typeof n.user_id === "string" ? n.user_id : String(n.user_id ?? ""),
    type: typeof n.type === "string" ? n.type : "",
    title: typeof n.title === "string" ? n.title : "",
    message: typeof n.message === "string" ? n.message : "",
    payload:
      payload !== null && payload !== undefined && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null,
    is_read: Boolean(n.is_read),
    read_at: typeof n.read_at === "string" || n.read_at === null ? (n.read_at as string | null) : null,
    created_at: typeof n.created_at === "string" ? n.created_at : new Date().toISOString(),
  }
}

function emitToListeners(notification: NotificationResponse) {
  for (const listener of listeners) {
    try {
      listener(notification)
    } catch {
      // Listener errors must not tear down the socket.
    }
  }
}

function clearPingInterval() {
  if (pingIntervalId !== null) {
    window.clearInterval(pingIntervalId)
    pingIntervalId = null
  }
}

function teardownSocket() {
  clearPingInterval()
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    detachWebSocket(ws)
    ws.close()
    ws = null
  }
}

function scheduleReconnect() {
  if (listeners.size === 0 || reconnectTimer !== null) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connectIfNeeded()
  }, RECONNECT_MS)
}

function connectIfNeeded() {
  const token = getAccessToken()
  if (!token || listeners.size === 0) {
    teardownSocket()
    return
  }
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
    return
  }

  teardownSocket()

  try {
    ws = new WebSocket(buildNotificationsWsUrl(token))
  } catch {
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    clearPingInterval()
    const sendPing = () => {
      const socket = ws
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      try {
        socket.send(JSON.stringify({ type: "ping" }))
      } catch {
        // Ignore send failures; onclose will reconnect.
      }
    }
    sendPing()
    pingIntervalId = window.setInterval(sendPing, PING_INTERVAL_MS)
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string) as unknown
      if (
        data &&
        typeof data === "object" &&
        (data as Record<string, unknown>).type === "pong"
      ) {
        return
      }
      const notification = parseNotificationCreated(data)
      if (notification) emitToListeners(notification)
    } catch {
      // Ignore malformed frames.
    }
  }

  ws.onerror = () => {
    // onclose will reconnect.
  }

  ws.onclose = () => {
    clearPingInterval()
    ws = null
    if (listeners.size === 0) return
    if (!getAccessToken()) return
    scheduleReconnect()
  }
}

/** Subscribe to realtime notification.created pushes (shared WebSocket). */
export function subscribeToNotificationPush(listener: Listener): () => void {
  listeners.add(listener)
  connectIfNeeded()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      teardownSocket()
    }
  }
}

function onAuthChanged() {
  teardownSocket()
  connectIfNeeded()
}

if (typeof window !== "undefined") {
  window.addEventListener("tauron:auth-changed", onAuthChanged)
  window.addEventListener("storage", (event) => {
    if (event.key === "access_token") {
      onAuthChanged()
    }
  })
}
