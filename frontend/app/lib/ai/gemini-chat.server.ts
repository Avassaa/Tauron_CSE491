import { existsSync } from "node:fs"
import path from "node:path"
import { config as loadEnv } from "dotenv"
import { convertToModelMessages, streamText, type UIMessage } from "ai"

import { getGeminiChatModel, resolveGeminiApiKey } from "~/lib/ai/gemini-model"

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

  let body: { messages?: UIMessage[] }
  try {
    body = (await request.json()) as { messages?: UIMessage[] }
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const { messages } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Expected a non-empty `messages` array." }, { status: 400 })
  }

  try {
    const modelMessages = await convertToModelMessages(messages)
    const result = streamText({
      model: getGeminiChatModel(),
      messages: modelMessages,
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
