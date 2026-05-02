import type { UIMessage } from "@ai-sdk/react"

export const CHAT_LAST_SESSION_KEY = "tauron:last_chat_session_id"
export const HISTORY_PAGE_SIZE = 500

export function chatItemsToUIMessages(items: unknown[]): UIMessage[] {
  return items.map((row) => {
    const i = row as Record<string, unknown>
    const content = typeof i.content === "string" ? i.content : ""
    return {
      id: String(i.id),
      role: i.role as "user" | "assistant",
      parts: [{ type: "text", text: content }],
    }
  })
}
