export type AssistantPromptIcon =
  | "shield"
  | "activity"
  | "bell"
  | "newspaper"
  | "list"
  | "trending"
  | "grid"

export type AssistantQuickPrompt = {
  id: string
  label: string
  cardTitle: string
  cardDescription: string
  protocolLabel: string
  icon: AssistantPromptIcon
  /** Shown in the blueprint editor around the asset pill. */
  templateParts?: { before: string; after: string }
  build: (topic: string) => string
}

const FALLBACK_TOPIC = "the asset I care about"

function topicOrFallback(raw: string): string {
  const t = raw.trim()
  return t || FALLBACK_TOPIC
}

function buildFromParts(before: string, after: string, topic: string): string {
  return before + topicOrFallback(topic) + after
}

export const ASSISTANT_QUICK_PROMPTS: AssistantQuickPrompt[] = [
  {
    id: "risk",
    label: "Risk analysis",
    cardTitle: "Risk scan",
    cardDescription: "Volatility and sizing from recent price action.",
    protocolLabel: "Risk analysis protocol",
    icon: "shield",
    templateParts: {
      before: "Analyze the short-term risk level for ",
      after: " using recent price action. Summarize volatility and practical cautions for sizing.",
    },
    build: (topic) =>
      buildFromParts(
        "Analyze the short-term risk level for ",
        " using recent price action. Summarize volatility and practical cautions for sizing.",
        topic,
      ),
  },
  {
    id: "market_status",
    label: "Market status",
    cardTitle: "Market pulse",
    cardDescription: "Live context and what your tools show right now.",
    protocolLabel: "Market status protocol",
    icon: "activity",
    templateParts: {
      before: "What is the current market status for ",
      after: "? Include live context and anything notable from your tools.",
    },
    build: (topic) =>
      buildFromParts(
        "What is the current market status for ",
        "? Include live context and anything notable from your tools.",
        topic,
      ),
  },
  {
    id: "price_alert",
    label: "Set a price alert",
    cardTitle: "Price alert",
    cardDescription: "Suggested triggers from recent volatility.",
    protocolLabel: "Alert preparation protocol",
    icon: "bell",
    templateParts: {
      before: "Prepare a price alert for ",
      after: ": propose a reasonable trigger based on recent volatility and explain what to watch for.",
    },
    build: (topic) =>
      buildFromParts(
        "Prepare a price alert for ",
        ": propose a reasonable trigger based on recent volatility and explain what to watch for.",
        topic,
      ),
  },
  {
    id: "news",
    label: "News digest",
    cardTitle: "News digest",
    cardDescription: "Curated headlines and sentiment for one symbol.",
    protocolLabel: "News digest protocol",
    icon: "newspaper",
    templateParts: {
      before: "Give a concise curated news and sentiment digest focused on ",
      after: ".",
    },
    build: (topic) => buildFromParts("Give a concise curated news and sentiment digest focused on ", ".", topic),
  },
  {
    id: "watchlists",
    label: "My watchlists",
    cardTitle: "Watchlists",
    cardDescription: "Primary and named lists—what you are tracking.",
    protocolLabel: "Portfolio context",
    icon: "list",
    build: () =>
      "Summarize what's on my watchlists (primary and named lists). Call the watchlist tools if needed.",
  },
  {
    id: "movers",
    label: "Top movers",
    cardTitle: "Top movers",
    cardDescription: "Volume leaders and gainers at a glance.",
    protocolLabel: "Movers scan",
    icon: "trending",
    build: () =>
      "Show me today's top market movers by volume and by gainers—keep it scannable with your market-movers tool.",
  },
  {
    id: "grid",
    label: "Grid metrics",
    cardTitle: "Grid metrics",
    cardDescription: "Assets-style 1h/7d context vs chop or trend.",
    protocolLabel: "Grid metrics protocol",
    icon: "grid",
    templateParts: {
      before: "For ",
      after:
        ", summarize the Assets-style grid metrics (1h/7d moves and volume context) and what that implies for near-term chop versus trend.",
    },
    build: (topic) =>
      buildFromParts(
        "For ",
        ", summarize the Assets-style grid metrics (1h/7d moves and volume context) and what that implies for near-term chop versus trend.",
        topic,
      ),
  },
]

/** First four prompts shown as large starter cards (2×2). */
export const ASSISTANT_FEATURED_PROMPT_IDS = ["risk", "market_status", "price_alert", "news"] as const
