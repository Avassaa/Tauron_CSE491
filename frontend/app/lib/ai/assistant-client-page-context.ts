export type AssistantPriceAlertsUiContext = {
  symbol: string
  name?: string
  presetMovePercent: string
  goalPriceInput: string
  goalPriceEdited: boolean
  approximateUsdSpot?: string | null
}

export type AssistantToolsUiContext = {
  focusedPanelId: string
  focusedPanelLabel: string
  priceAlerts?: AssistantPriceAlertsUiContext
}

export type AssistantClientPagePayload = {
  pathname: string
  sectionTitle: string
  sectionDescription: string
  tools?: AssistantToolsUiContext | null
}

export const TOOLS_PANEL_LABELS: Record<string, string> = {
  currency: "Currency Converter",
  "price-alerts": "Price Alerts",
  "market-sentiment": "Market Sentiment",
  "watchlist-insights": "Watchlist Insights",
}

export function pathnameToAssistantSection(pathname: string): Pick<
  AssistantClientPagePayload,
  "sectionTitle" | "sectionDescription"
> {
  const path = pathname.replace(/\/+$/, "") || "/"

  if (path.startsWith("/assets"))
    return {
      sectionTitle: "Assets",
      sectionDescription:
        "Browse ranked crypto assets, sparklines, watchlist toggles, and open the asset detail sheet from this grid.",
    }
  if (path.startsWith("/tools"))
    return {
      sectionTitle: "Tools",
      sectionDescription:
        "Workspace utilities: Currency Converter, Price Alerts (Binance-linked alarms), Market Sentiment analysis, and Watchlist Insights.",
    }
  if (path.startsWith("/watchlists"))
    return {
      sectionTitle: "Watchlists",
      sectionDescription: "Manage named watchlists and membership for tracked assets.",
    }
  if (path.startsWith("/dashboard"))
    return {
      sectionTitle: "Dashboard",
      sectionDescription: "Main overview canvas after sign-in.",
    }
  if (path.startsWith("/chat"))
    return {
      sectionTitle: "AI Chat",
      sectionDescription: "Full-page assistant workspace with session history sidebar.",
    }
  if (path.startsWith("/news"))
    return {
      sectionTitle: "News",
      sectionDescription: "Curated market articles for tracked assets.",
    }
  if (path.startsWith("/notifications"))
    return {
      sectionTitle: "Notifications",
      sectionDescription: "User alerts and inbox-style notices.",
    }
  if (path.startsWith("/predictions"))
    return {
      sectionTitle: "Predictions",
      sectionDescription: "Model-backed forecasts UI where enabled.",
    }
  if (path.startsWith("/profile"))
    return {
      sectionTitle: "Profile",
      sectionDescription: "Account profile.",
    }
  if (path.startsWith("/settings"))
    return {
      sectionTitle: "Settings",
      sectionDescription: "Application preferences.",
    }

  return {
    sectionTitle: "Tauron app",
    sectionDescription: `Authenticated route: ${path}. Help with markets and dashboard tasks.`,
  }
}

export function buildAssistantPagePayload(args: {
  pathname: string
  tools?: AssistantToolsUiContext | null
}): AssistantClientPagePayload {
  const meta = pathnameToAssistantSection(args.pathname)
  return {
    pathname: args.pathname,
    sectionTitle: meta.sectionTitle,
    sectionDescription: meta.sectionDescription,
    tools: args.pathname.startsWith("/tools") ? args.tools ?? undefined : undefined,
  }
}

/** Server-side: defensive stringify for system prompt augmentation. */
export function formatAssistantPageContextForSystemPrompt(raw: unknown): string {
  if (!raw || typeof raw !== "object") return ""
  const o = raw as Partial<AssistantClientPagePayload>
  if (typeof o.pathname !== "string" || typeof o.sectionTitle !== "string") return ""

  const lines: string[] = []
  lines.push(`Pathname: ${o.pathname}`)
  lines.push(`Primary section: ${o.sectionTitle}`)
  if (typeof o.sectionDescription === "string") lines.push(`Section summary: ${o.sectionDescription}`)

  const tools = o.tools
  if (tools && typeof tools === "object") {
    if (typeof tools.focusedPanelLabel === "string") {
      lines.push(`Tools — focused panel: ${tools.focusedPanelLabel}`)
    }
    if (typeof tools.focusedPanelId === "string") {
      lines.push(`Tools — focused panel id: ${tools.focusedPanelId}`)
    }

    const pa = tools.priceAlerts
    if (pa && typeof pa === "object") {
      lines.push("--- Price Alerts control state (same row as conversation — trust these symbols over user typos)")
      if (typeof pa.symbol === "string") lines.push(`Dropdown-selected asset symbol: ${pa.symbol}`)
      if (typeof pa.name === "string") lines.push(`Dropdown-selected asset name: ${pa.name}`)
      if (typeof pa.presetMovePercent === "string") lines.push(`Preset move (%): ${pa.presetMovePercent}`)
      if (typeof pa.goalPriceInput === "string") lines.push(`Goal price input field value: ${pa.goalPriceInput}`)
      if (typeof pa.goalPriceEdited === "boolean") {
        lines.push(`User manually edited goal price: ${pa.goalPriceEdited ? "yes" : "no"}`)
      }
      if (typeof pa.approximateUsdSpot === "string" && pa.approximateUsdSpot.trim()) {
        lines.push(`Approximate spot shown next to inputs (USD): ${pa.approximateUsdSpot}`)
      }
    }
  }

  return lines.join("\n")
}
