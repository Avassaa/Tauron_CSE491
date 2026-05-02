"use client"

import * as React from "react"
import { Bot } from "lucide-react"
import { isReasoningUIPart, isTextUIPart, type UIMessage } from "ai"

import { PromptInputBox } from "~/components/ui/ai-prompt-box"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { MarkdownContent } from "~/components/ui/markdown-content"
import { useGeminiChat } from "~/lib/ai/use-gemini-chat"
import { cn } from "~/lib/utils"

function textFromMessage(m: UIMessage | any): string {
  if (m.parts && m.parts.length > 0) {
    const chunks: string[] = []
    for (const p of m.parts) {
      if (isTextUIPart(p)) chunks.push(p.text)
      else if (isReasoningUIPart(p)) chunks.push(p.text)
    }
    if (chunks.length > 0) return chunks.join("")
  }
  return typeof m.content === "string" ? m.content : ""
}

function friendlyChatError(err: Error): string {
  const raw = err.message?.trim() ?? "Something went wrong."
  try {
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as { error?: string }
      if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error.trim()
    }
  } catch {
    /* use raw */
  }
  return raw
}

function initialsFromUsername(name: string): string {
  const t = name.trim()
  if (!t) return "?"
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase().slice(0, 2)
  }
  return t.slice(0, 2).toUpperCase()
}

export function GeminiChatPanel({ 
  className, 
  id, 
  initialMessages,
  onActivity,
  onNewMessage,
  variant = "default",
}: { 
  className?: string
  id?: string
  initialMessages?: UIMessage[]
  onActivity?: () => void
  onNewMessage?: (text: string) => void
  /** `dock`: full column height, composer pinned to bottom, messages scroll above. */
  variant?: "default" | "dock"
}) {
  const { messages, sendMessage, stop, status, error } = useGeminiChat({ 
    id, 
    initialMessages,
    onResponse: () => onActivity?.()
  })
  const streaming = status === "streaming" || status === "submitted"
  const endRef = React.useRef<HTMLDivElement>(null)

  const [username, setUsername] = React.useState("You")

  React.useEffect(() => {
    const sync = () => setUsername(localStorage.getItem("username")?.trim() || "You")
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("tauron:auth-changed", sync as EventListener)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("tauron:auth-changed", sync as EventListener)
    }
  }, [])

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  const handleSend = async (text: string, files?: File[]) => {
    const t = text.trim()
    if (!t && !files?.length) return
    onNewMessage?.(t || "Media attachment")
    if (files?.length) {
      const dt = new DataTransfer()
      files.forEach((f) => dt.items.add(f))
      await sendMessage({ text: t || "Describe this image.", files: dt.files })
      return
    }
    await sendMessage({ text: t })
  }

  const userInitials = initialsFromUsername(username)
  const isDock = variant === "dock"

  const composer = (
    <PromptInputBox
      onSend={(msg, files) => void handleSend(msg, files)}
      onStop={streaming ? () => void stop() : undefined}
      isLoading={streaming}
      placeholder="Ask the assistant…"
      textareaMaxHeight={isDock ? 112 : undefined}
      className={cn(isDock ? "rounded-2xl p-1.5" : "")}
    />
  )

  const errorBanner = error ? (
    <p
      className={cn(
        "rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive",
        isDock ? "mx-0 shrink-0" : "",
      )}
      role="alert"
    >
      {friendlyChatError(error)}
    </p>
  ) : null

  const messageScroll = (
    <div
      className={cn(
        "min-h-0 overflow-y-auto overscroll-contain px-1 sm:px-2",
        !isDock && "min-h-[min(280px,calc(100svh-280px))]",
        !isDock && "flex-1",
      )}
    >
      <div className="space-y-5 pb-2 pt-1">
        {messages.length === 0 ? (
          <div className={cn(isDock ? "py-4 text-center sm:py-6" : "py-10 text-center")}>
            <p className="text-base font-medium text-foreground">Say hello to your assistant</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Ask about markets, news, or ideas for your watchlist. Answers show up here as they&apos;re written.
            </p>
          </div>
        ) : null}

        {messages.map((m, i) => {
          const text = textFromMessage(m)
          const isUser = m.role === "user"
          const isLast = i === messages.length - 1
          const showTyping = !isUser && streaming && isLast && !text

          return (
            <div key={m.id} className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
              <div className="flex max-w-[min(100%,560px)] gap-3">
                {isUser ? (
                  <>
                    <Avatar size="sm" className="mt-0.5 shrink-0 border border-border shadow-sm">
                      <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {username}
                      </span>
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                          "bg-primary text-primary-foreground",
                        )}
                      >
                        <div className="whitespace-pre-wrap break-words">{text}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted shadow-sm"
                      title="Gemini"
                    >
                      <Bot className="h-4 w-4 text-primary" aria-hidden />
                      <span className="sr-only">Assistant</span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Chatbot
                      </span>
                      <div
                        className={cn(
                          "rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm",
                        )}
                      >
                        <div className="w-full">
                          {showTyping ? (
                            <span className="text-muted-foreground">Thinking…</span>
                          ) : (
                            <MarkdownContent>{text}</MarkdownContent>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}

        <div ref={endRef} className="h-px w-full shrink-0" aria-hidden />
      </div>
    </div>
  )

  return (
    <div
      className={cn(
        "min-h-0 w-full flex-1",
        isDock ? "grid grid-rows-[minmax(0,1fr)_auto] gap-2" : "flex flex-col gap-4",
        className,
      )}
    >
      {messageScroll}
      {!isDock ? (
        <>
          {errorBanner}
          <div className="shrink-0">{composer}</div>
        </>
      ) : (
        <div className="flex min-h-0 shrink-0 flex-col gap-2 border-t border-border/50 bg-background px-2 pb-2 pt-2 shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.08)] sm:px-3 dark:shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.35)]">
          {errorBanner}
          {composer}
        </div>
      )}
    </div>
  )
}
