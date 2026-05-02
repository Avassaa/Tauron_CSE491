import { marked } from "marked"
import TurndownService from "turndown"

let markedOptionsApplied = false
function ensureMarkedOptions() {
  if (markedOptionsApplied) return
  marked.setOptions({ breaks: true, gfm: true })
  markedOptionsApplied = true
}

export function markdownToHtml(markdown: string): string {
  const src = markdown.trim()
  if (!src) return ""
  ensureMarkedOptions()
  return marked.parse(src, { async: false }) as string
}

let turndown: TurndownService | null = null

function getTurndown(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    })
    turndown.addRule("underline", {
      filter: ["u"],
      replacement(content: string) {
        return "__" + content + "__"
      },
    })
  }
  return turndown
}

/** Serialize TipTap / ProseMirror HTML back to markdown for API storage. */
export function htmlToMarkdown(html: string): string {
  const raw = (html || "").trim()
  if (!raw || raw === "<p></p>") return ""
  return getTurndown().turndown(raw).trim()
}
