import type { Route } from "./+types/api.insights"
import { handleGeminiInsightsPost } from "~/lib/ai/gemini-insights.server"

export async function loader() {
  return Response.json({
    ok: true,
    description:
      "POST JSON `{ mode: \"quick_insight\" | \"prediction_outline\" | \"news_feed_quick\", symbol?: string, context?: string }` for structured Gemini JSON (generateObject).",
  })
}

export async function action(args: Route.ActionArgs) {
  return handleGeminiInsightsPost(args.request)
}
