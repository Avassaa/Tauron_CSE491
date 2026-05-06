import type { ContentPart, StepResult, ToolSet } from "ai"

function jsonSafe(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value)) as unknown
  } catch {
    if (value === undefined || value === null) return value
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
    return String(value)
  }
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/**
 * Builds JSON-serializable UI message parts (text + tool cards) from streamText steps
 * so assistant charts/tools can be replayed from chat history.
 */
export function buildPersistedAssistantUiParts<T extends ToolSet>(steps: readonly StepResult<T>[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []

  for (const step of steps) {
    for (const part of step.content) {
      if (!part || typeof part !== "object" || !("type" in part)) continue
      const p = part as ContentPart<T>

      if (p.type === "text") {
        const t = typeof p.text === "string" ? p.text.trim() : ""
        if (t) out.push({ type: "text", text: p.text, state: "done" })
        continue
      }

      if (p.type === "tool-result") {
        out.push({
          type: `tool-${String(p.toolName)}`,
          toolCallId: p.toolCallId,
          state: "output-available",
          input: jsonSafe(p.input),
          output: jsonSafe(p.output),
        })
        continue
      }

      if (p.type === "tool-error") {
        out.push({
          type: `tool-${String(p.toolName)}`,
          toolCallId: p.toolCallId,
          state: "output-error",
          input: jsonSafe(p.input),
          errorText: errorText(p.error),
        })
      }
    }
  }

  const seenIds = new Set<string>()
  for (const p of out) {
    const id = p.toolCallId
    if (typeof id === "string") seenIds.add(id)
  }
  for (const step of steps) {
    for (const tr of step.toolResults) {
      if (tr.type !== "tool-result" || seenIds.has(tr.toolCallId)) continue
      seenIds.add(tr.toolCallId)
      out.push({
        type: `tool-${String(tr.toolName)}`,
        toolCallId: tr.toolCallId,
        state: "output-available",
        input: jsonSafe(tr.input),
        output: jsonSafe(tr.output),
      })
    }
  }

  return out
}

export function assistantBodyTextFromFinish<T extends ToolSet>(
  text: string | undefined,
  steps: readonly StepResult<T>[],
): string {
  const trimmed = (text ?? "").trim()
  if (trimmed) return trimmed
  const fromSteps = steps
    .map((s) => (typeof s.text === "string" ? s.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim()
  return fromSteps
}
