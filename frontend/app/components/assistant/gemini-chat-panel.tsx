"use client"

import * as React from "react"
import { Bot, RefreshCw } from "lucide-react"
import {
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type ChatOnErrorCallback,
  type ChatOnFinishCallback,
  type UIMessage,
} from "ai"

import { AssistantChatToolPart } from "~/components/assistant/chat-tool-part"
import { AssistantToolApprovalContext } from "~/components/assistant/assistant-tool-approval-context"
import { useAssistantClientPagePayload } from "~/components/assistant/assistant-chat-extras-context"
import { PromptInputBox } from "~/components/ui/ai-prompt-box"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import { MarkdownContent } from "~/components/ui/markdown-content"

import { useGeminiChat } from "~/lib/ai/use-gemini-chat"
import type { AssistantClientPagePayload } from "~/lib/ai/assistant-client-page-context"
import { cn } from "~/lib/utils"

function textFromMessage(m: UIMessage): string {
  if (m.parts && m.parts.length > 0) {
    const chunks: string[] = []
    for (const p of m.parts) {
      if (isTextUIPart(p)) chunks.push(p.text)
      else if (isReasoningUIPart(p)) chunks.push(p.text)
    }
    if (chunks.length > 0) return chunks.join("")
  }
  const legacy = (m as unknown as { content?: unknown }).content
  return typeof legacy === "string" ? legacy : ""
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

function AssistantMessageBody({
  message,
  streaming,
  isLast,
}: {
  message: UIMessage
  streaming: boolean
  isLast: boolean
}) {
  const parts = message.parts ?? []
  const blocks: React.ReactNode[] = []
  let textBuf = ""

  const flushText = () => {
    const t = textBuf.trim()
    if (!t) return
    blocks.push(
      <MarkdownContent key={`assistant-md-${blocks.length}`}>{textBuf}</MarkdownContent>,
    )
    textBuf = ""
  }

  for (const part of parts) {
    if (isTextUIPart(part)) {
      textBuf += part.text
      continue
    }
    flushText()
    if (isToolUIPart(part)) {
      const tcId =
        "toolCallId" in part && typeof (part as { toolCallId?: string }).toolCallId === "string"
          ? (part as { toolCallId: string }).toolCallId
          : `${message.id}-${blocks.length}`
      blocks.push(<AssistantChatToolPart key={tcId} part={part} />)
    }
  }
  flushText()

  const fallbackTyping = streaming && isLast && blocks.length === 0 && !textFromMessage(message).trim()

  return (
    <div className="flex w-full flex-col gap-3">
      {blocks}
      {fallbackTyping ? <span className="text-muted-foreground">Thinking…</span> : null}
    </div>
  )
}

function UserMessageBody({ message }: { message: UIMessage }) {
  const texts: string[] = []
  const images: React.ReactNode[] = []
  for (const part of message.parts ?? []) {
    if (isTextUIPart(part)) texts.push(part.text)
    else if (isFileUIPart(part) && part.mediaType.startsWith("image/")) {
      images.push(
        <a key={`${part.url}-${images.length}`} href={part.url} target="_blank" rel="noreferrer">
          <img
            src={part.url}
            alt={part.filename ?? "attachment"}
            className="max-h-44 rounded-xl border border-border object-cover shadow-sm"
          />
        </a>,
      )
    }
  }
  const body = texts.join("") || textFromMessage(message)
  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 ? <div className="flex flex-wrap gap-2">{images}</div> : null}
      {body.trim() ? (
        <div className="whitespace-pre-wrap break-words">{body}</div>
      ) : images.length > 0 ? null : (
        <div className="text-xs italic opacity-80">Attachment</div>
      )}
    </div>
  )
}

export function GeminiChatPanel({
  className,
  id,
  initialMessages,
  onActivity,
  onNewMessage,
  onAssistantFinish,
  onChatError,
  variant = "default",
}: {
  className?: string
  id?: string
  initialMessages?: UIMessage[]
  /** Legacy alias invoked after a successful assistant reply completes streaming. */
  onActivity?: () => void
  onNewMessage?: (text: string) => void
  onAssistantFinish?: ChatOnFinishCallback<UIMessage>
  onChatError?: ChatOnErrorCallback
  variant?: "default" | "dock"
}) {
  const clientPagePayload = useAssistantClientPagePayload()
  const clientPagePayloadRef = React.useRef<AssistantClientPagePayload | null>(null)
  clientPagePayloadRef.current = clientPagePayload

  const {
    messages,
    sendMessage,
    stop,
    regenerate,
    clearError,
    status,
    error,
    addToolApprovalResponse,
    setMessages,
  } = useGeminiChat({
    id,
    initialMessages,
    onResponse: () => onActivity?.(),
    onFinish: onAssistantFinish,
    onError: onChatError ?? ((err) => console.error("[GeminiChatPanel]", err)),
    clientPagePayloadRef,
  })
  const streaming = status === "streaming" || status === "submitted"
  const endRef = React.useRef<HTMLDivElement>(null)

  const [username, setUsername] = React.useState("You")

  React.useEffect(() => {
    setMessages(initialMessages ?? [])
  }, [id, initialMessages, setMessages])

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

  const statusLabel =
    status === "submitted"
      ? "Sending…"
      : status === "streaming"
        ? "Streaming…"
        : status === "error"
          ? "Error"
          : null

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
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive",
        isDock ? "mx-0 shrink-0" : "",
      )}
      role="alert"
    >
      <p>{friendlyChatError(error)}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => clearError()}>
          Dismiss
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 gap-1"
          onClick={() => void regenerate()}
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Retry last reply
        </Button>
      </div>
    </div>
  ) : null

  const messageScroll = (
    <div
      className={cn(
        "min-h-0 overflow-y-auto overscroll-contain px-1 sm:px-2",
        isDock && "min-w-0",
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
          const isUser = m.role === "user"
          const isLast = i === messages.length - 1

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
                        <UserMessageBody message={m} />
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
                        <AssistantMessageBody message={m} streaming={streaming} isLast={isLast} />
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
    <AssistantToolApprovalContext.Provider value={addToolApprovalResponse ?? null}>
      <div
        className={cn(
          "min-h-0 w-full flex-1",
          isDock ? "grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-2 overflow-hidden" : "flex flex-col gap-4",
          className,
        )}
      >
        {messageScroll}
        {!isDock ? (
          <>
            {statusLabel ? (
              <p className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">{statusLabel}</p>
            ) : null}
            {errorBanner}
            <div className="shrink-0">{composer}</div>
          </>
        ) : (
          <div className="flex min-h-0 shrink-0 flex-col gap-2 border-t border-border/50 bg-background px-2 pb-2 pt-2 shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.08)] sm:px-3 dark:shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.35)]">
            {statusLabel ? (
              <p className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">{statusLabel}</p>
            ) : null}
            {errorBanner}
            {composer}
          </div>
        )}
      </div>
    </AssistantToolApprovalContext.Provider>
  )
}
