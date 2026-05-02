declare module "turndown" {
  interface TurndownOptions {
    headingStyle?: "setext" | "atx"
    codeBlockStyle?: "indented" | "fenced"
    bulletListMarker?: "-" | "+" | "*"
  }

  type TurndownFilter = string | string[]

  interface TurndownRule {
    filter: TurndownFilter
    replacement: (content: string, node?: unknown) => string
  }

  export default class TurndownService {
    constructor(options?: TurndownOptions)
    addRule(name: string, rule: TurndownRule): void
    turndown(html: string): string
  }
}
