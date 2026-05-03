import { convertToModelMessages, isTextUIPart, stepCountIs, streamText, type UIMessage } from "ai"

import { createTauronFinanceTools } from "~/lib/ai/gemini-chat-tools"
import { formatAssistantPageContextForSystemPrompt } from "~/lib/ai/assistant-client-page-context"
import { internalJsonFetch, resolveInternalApiBaseUrl } from "~/lib/ai/gemini-internal-api"
import { getGeminiChatModel, resolveGeminiApiKey } from "~/lib/ai/gemini-model"
import { TAURON_CHAT_SYSTEM_PROMPT } from "~/lib/ai/gemini-system-prompt"

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

export async function handleGeminiChatPost(request: Request): Promise<Response> {
  resolveInternalApiBaseUrl()

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

  let body: { messages?: UIMessage[]; id?: string; access_token?: string; clientPageContext?: unknown }
  try {
    body = (await request.json()) as {
      messages?: UIMessage[]
      id?: string
      access_token?: string
      clientPageContext?: unknown
    }
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
      const res = await internalJsonFetch<{ detail?: string }>(`/chat-history`, {
        authHeader,
        method: "POST",
        body: {
          session_id: sessionId,
          role,
          content,
        },
      })
      if (!res.ok) {
        console.error(`[api/chat] Failed to save DB message: ${res.status}`, res.rawBody)
      }
    } catch (err) {
      console.error("[api/chat] Failed to save chat message to DB:", err)
    }
  }

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
    const tools = createTauronFinanceTools({ authHeader })

    const ctxBlock = formatAssistantPageContextForSystemPrompt(body.clientPageContext)
    const systemPrompt =
      ctxBlock.trim().length > 0 ?
        `${TAURON_CHAT_SYSTEM_PROMPT}

---
Current UI context (authoritative for navigation + live form state):
${ctxBlock}
---`
      : TAURON_CHAT_SYSTEM_PROMPT

    const streamStartedAt = Date.now()
    const result = streamText({
      model: getGeminiChatModel(),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(12),
      onFinish: async ({ text, usage, finishReason }) => {
        console.info(
          "[chat-stream]",
          JSON.stringify({
            sessionId,
            ms: Date.now() - streamStartedAt,
            finishReason,
            usage,
          }),
        )
        await saveMessageToDb("assistant", text ?? "")
      },
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
