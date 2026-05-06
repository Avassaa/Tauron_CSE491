import type { UIMessage } from "@ai-sdk/react"

export const CHAT_LAST_SESSION_KEY = "tauron:last_chat_session_id"
export const HISTORY_PAGE_SIZE = 500

function partsFromUiPayload(raw: unknown): UIMessage["parts"] | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const arr = o.parts
  if (!Array.isArray(arr) || arr.length === 0) return null
  const parts: UIMessage["parts"] = []
  for (const p of arr) {
    if (!p || typeof p !== "object") continue
    const typ = (p as { type?: unknown }).type
    if (typeof typ !== "string" || !typ) continue
    parts.push(p as UIMessage["parts"][number])
  }
  return parts.length > 0 ? parts : null
}

export function chatItemsToUIMessages(items: unknown[]): UIMessage[] {
  return items.map((row) => {
    const i = row as Record<string, unknown>
    const content = typeof i.content === "string" ? i.content : ""
    const id = String(i.id)
    const role = i.role as "user" | "assistant"
    const fromPayload = partsFromUiPayload(i.ui_payload)
    if (fromPayload) {
      return { id, role, parts: fromPayload }
    }
    return {
      id,
      role,
      parts: [{ type: "text", text: content }],
    }
  })
}
