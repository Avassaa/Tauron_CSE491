import type { Route } from "./+types/api.chat"
import { handleGeminiChatPost } from "~/lib/ai/gemini-chat.server"

export async function loader() {
  return Response.json({
    ok: true,
    description: "POST JSON `{ messages: UIMessage[] }` for Gemini streaming (UI message protocol).",
  })
}

export async function action(args: Route.ActionArgs) {
  return handleGeminiChatPost(args.request)
}

