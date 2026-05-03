import { existsSync } from "node:fs"
import path from "node:path"
import { config as loadEnv } from "dotenv"
import { generateObject } from "ai"
import { z } from "zod"

import { getGeminiChatModel, resolveGeminiApiKey } from "~/lib/ai/gemini-model"

function loadAllDotenv() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "frontend", ".env"),
    path.join(process.cwd(), "frontend", ".env.local"),
  ]
  for (const p of candidates) {
    if (existsSync(p)) loadEnv({ path: p, override: true })
  }
}

const QuickInsightSchema = z.object({
  headline: z.string(),
  bullets: z.array(z.string()).max(8),
  risk_note: z.string(),
  sentiment: z.enum(["bullish", "neutral", "bearish"]),
})

const PredictionOutlineSchema = z.object({
  horizon: z.string(),
  scenarios: z.array(
    z.object({
      label: z.string(),
      probability_hint: z.enum(["low", "medium", "high"]),
      thesis: z.string(),
    }),
  ),
  model_limitations: z.string(),
})

export async function handleGeminiInsightsPost(request: Request): Promise<Response> {
  loadAllDotenv()

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 })
  }

  if (!resolveGeminiApiKey()) {
    return Response.json({ error: "Assistant unavailable (missing Gemini API key)." }, { status: 503 })
  }

  let body: {
    mode?: "quick_insight" | "prediction_outline"
    symbol?: string
    context?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const mode = body.mode ?? "quick_insight"
  const symbol = typeof body.symbol === "string" ? body.symbol.trim() : ""
  const context = typeof body.context === "string" ? body.context.trim() : ""

  const started = Date.now()

  try {
    if (mode === "quick_insight") {
      const { object } = await generateObject({
        model: getGeminiChatModel(),
        schema: QuickInsightSchema,
        prompt: [
          "You summarize synthetic finance scenarios for educational UX.",
          symbol ? `Primary symbol: ${symbol}.` : "No symbol locked.",
          context ? `Operator notes: ${context}` : "",
          "Return ONLY schema-compliant JSON fields (no prose outside JSON).",
        ]
          .filter(Boolean)
          .join("\n"),
      })
      console.info("[insights]", JSON.stringify({ mode, ms: Date.now() - started }))
      return Response.json({ mode, insight: object })
    }

    const { object } = await generateObject({
      model: getGeminiChatModel(),
      schema: PredictionOutlineSchema,
      prompt: [
        "Produce an educational prediction outline without guaranteeing outcomes.",
        symbol ? `Asset focus: ${symbol}.` : "",
        context ? `Context: ${context}` : "",
        "Stay conservative; emphasize uncertainty.",
      ]
        .filter(Boolean)
        .join("\n"),
    })
    console.info("[insights]", JSON.stringify({ mode, ms: Date.now() - started }))
    return Response.json({ mode, prediction_outline: object })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Insight generation failed."
    console.error("[insights]", err)
    return Response.json({ error: message }, { status: 500 })
  }
}
