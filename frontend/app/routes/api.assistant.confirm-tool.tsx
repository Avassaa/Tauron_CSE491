import type { Route } from "./+types/api.assistant.confirm-tool"
import { handleAssistantConfirmToolPost } from "~/lib/ai/assistant-confirm-tool.server"

export async function loader() {
  return Response.json({
    ok: true,
    description:
      "POST JSON `{ confirmation_token: string, access_token?: string }` with Bearer auth to execute a pending assistant action after UI confirmation.",
  })
}

export async function action(args: Route.ActionArgs) {
  return handleAssistantConfirmToolPost(args.request)
}
