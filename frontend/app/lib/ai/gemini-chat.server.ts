import { existsSync } from "node:fs"
import path from "node:path"
import { config as loadEnv } from "dotenv"
import { convertToModelMessages, isTextUIPart, streamText, type UIMessage } from "ai"

import { getGeminiChatModel, resolveGeminiApiKey } from "~/lib/ai/gemini-model"

function textFromUIMessagePayload(message: UIMessage): string {
  const rawParts =
    message && typeof message === "object" && "parts" in message && Array.isArray((message as { parts?: unknown }).parts)
      ? (message as { parts: unknown[] }).parts
      : []
  const typedParts = rawParts as UIMessage["parts"]
  let fromParts = ""
  for (const p of typedParts) {
    if (isTextUIPart(p)) fromParts += p.text
  }
  if (fromParts.trim()) return fromParts

  const c = message as UIMessage & { content?: unknown }
  return typeof c.content === "string" ? c.content : ""
}

function loadAllDotenv() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "frontend", ".env"),
    path.join(process.cwd(), "frontend", ".env.local"),
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      loadEnv({ path: p, override: true })
    }
  }
}

loadAllDotenv()

function resolveInternalApiBase(): string {
  const internalRaw = process.env.API_INTERNAL_BASE_URL?.trim() ?? ""
  if (internalRaw.length > 0) return internalRaw.replace(/\/$/, "")
  const viteRaw = process.env.VITE_API_BASE_URL?.trim() ?? ""
  if (viteRaw.length > 0 && /^https?:\/\//i.test(viteRaw)) return viteRaw.replace(/\/$/, "")
  return "http://127.0.0.1:8000/api/v1"
}

export async function handleGeminiChatPost(request: Request): Promise<Response> {
  loadAllDotenv()

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 })
  }

  if (!resolveGeminiApiKey()) {
    return Response.json(
      {
        error: "The assistant isn’t available right now. Please try again later.",
      },
      { status: 503 },
    )
  }

  let body: { messages?: UIMessage[], id?: string; access_token?: string }
  try {
    body = (await request.json()) as { messages?: UIMessage[]; id?: string; access_token?: string }
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const { messages, id: sessionId } = body

  const fromHeader = request.headers.get("Authorization")?.trim() || ""
  const tokenRaw = typeof body.access_token === "string" ? body.access_token.trim() : ""
  const authHeader =
    fromHeader.length > 0
      ? fromHeader
      : tokenRaw.length > 0
        ? tokenRaw.startsWith("Bearer ")
          ? tokenRaw
          : `Bearer ${tokenRaw}`
        : null
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Expected a non-empty `messages` array." }, { status: 400 })
  }

  const apiBaseUrl = resolveInternalApiBase()

  const saveMessageToDb = async (role: string, content: string) => {
    if (!authHeader || !sessionId) {
      if (!sessionId) {
        console.warn("[api/chat] Skipped DB persist: missing session id on request body")
      } else if (!authHeader) {
        console.warn("[api/chat] Skipped DB persist: no Authorization header or access_token on body")
      }
      return
    }
    try {
      const res = await fetch(`${apiBaseUrl}/chat-history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          session_id: sessionId,
          role,
          content,
        }),
      })
      if (!res.ok) {
        console.error(`[api/chat] Failed to save DB message: ${res.status} ${res.statusText}`, await res.text())
      }
    } catch (err) {
      console.error("[api/chat] Failed to save chat message to DB:", err)
    }
  }

  // Save the latest user message (last in the array) before streaming so history can load on reload.
  const lastUserMessage = messages[messages.length - 1]
  if (lastUserMessage && lastUserMessage.role === "user") {
    const userText = textFromUIMessagePayload(lastUserMessage).trim()
    await saveMessageToDb("user", userText || "Media attachment")
  }

  try {
    const fixedMessages = messages.map((m) =>
      m.parts && m.parts.length > 0
        ? m
        : { ...m, parts: [{ type: "text" as const, text: textFromUIMessagePayload(m) }] },
    )
    const modelMessages = await convertToModelMessages(fixedMessages as UIMessage[])
    const result = streamText({
      model: getGeminiChatModel(),
      messages: modelMessages,
      onFinish: async (event) => {
        await saveMessageToDb("assistant", event.text)
      }
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (err) => {
        console.error("[api/chat] stream error:", err)
        return err instanceof Error ? err.message : "Assistant failed to respond."
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat request failed."
    console.error("[api/chat]", err)
    return Response.json({ error: message }, { status: 500 })
  }
}
