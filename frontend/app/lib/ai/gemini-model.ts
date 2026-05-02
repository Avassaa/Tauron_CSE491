import { createGoogleGenerativeAI } from "@ai-sdk/google"

/** Default matches common Google AI / project setups; override with `GEMINI_MODEL`. */
const DEFAULT_MODEL = "gemini-2.0-flash"

export function resolveGeminiApiKey(): string | undefined {
  const fromBackendName = process.env.GEMINI_API_KEY?.trim()
  const fromSdkName = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  return fromBackendName || fromSdkName || undefined
}

/**
 * New model instance each call so we never keep a Google client created
 * before `dotenv` loaded the API key.
 */
export function getGeminiChatModel() {
  const apiKey = resolveGeminiApiKey()
  const id = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
  return createGoogleGenerativeAI({ apiKey })(id)
}
