"use client"

import * as React from "react"
import {
  Activity,
  Bell,
  Bot,
  LayoutGrid,
  ListTodo,
  Newspaper,
  RefreshCw,
  Shield,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react"
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
import { DeleteChatConfirmDialog } from "~/components/assistant/delete-chat-confirm-dialog"
import { AssistantToolApprovalContext } from "~/components/assistant/assistant-tool-approval-context"
import { useAssistantClientPagePayload } from "~/components/assistant/assistant-chat-extras-context"
import { PromptInputBox } from "~/components/ui/ai-prompt-box"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import { glassPanelSurface } from "~/components/ui/card"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import { MarkdownContent } from "~/components/ui/markdown-content"

import { useGeminiChat } from "~/lib/ai/use-gemini-chat"
import {
  ASSISTANT_FEATURED_PROMPT_IDS,
  ASSISTANT_QUICK_PROMPTS,
  type AssistantPromptIcon,
  type AssistantQuickPrompt,
} from "~/lib/ai/assistant-quick-prompts"
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

const PROMPT_ICONS: Record<AssistantPromptIcon, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  activity: Activity,
  bell: Bell,
  newspaper: Newspaper,
  list: ListTodo,
  trending: TrendingUp,
  grid: LayoutGrid,
}

function AssistantQuickBubble({
  q,
  selected,
  onClick,
  compact,
}: {
  q: AssistantQuickPrompt
  selected: boolean
  onClick: () => void
  compact?: boolean
}) {
  const Icon = PROMPT_ICONS[q.icon]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={q.label}
      className={cn(
        "group inline-flex min-w-0 max-w-full items-center rounded-lg text-left transition-colors duration-200",
        compact ?
          "min-h-[2rem] min-w-[6.25rem] justify-center gap-2 px-2.5 py-1.5 text-[12px] leading-snug sm:min-h-[2.25rem] sm:py-2"
        : "gap-1.5 px-2.5 py-2 text-[12px] leading-snug sm:py-2.5",
        "border-0 bg-background/70 text-foreground shadow-none backdrop-blur-md",
        "dark:bg-white/[0.06] dark:text-foreground",
        "hover:bg-background/92 hover:shadow-md dark:hover:bg-white/[0.1]",
        selected && "bg-primary/18 text-primary dark:bg-primary/24",
      )}
    >
      <Icon
        className={cn(
          "shrink-0 text-primary",
          compact ? "size-3.5" : "size-4",
          selected ? "opacity-100" : "opacity-80",
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate font-semibold tracking-tight">{q.label}</span>
    </button>
  )
}

function AssistantWelcomeHero({
  onSelectPrompt,
  activeId,
  isDock,
}: {
  onSelectPrompt: (q: AssistantQuickPrompt) => void
  activeId: string | null
  isDock: boolean
}) {
  const featured = (ASSISTANT_FEATURED_PROMPT_IDS as readonly string[])
    .map((id) => ASSISTANT_QUICK_PROMPTS.find((p) => p.id === id))
    .filter((p): p is AssistantQuickPrompt => Boolean(p))

  return (
    <div
      className={cn(
        "mx-auto flex w-full min-w-0 max-w-2xl scroll-mt-3 flex-col items-center px-2 text-center sm:px-3",
        isDock ? "py-2" : "py-4 sm:py-5",
      )}
    >
      <div className="mb-3 flex items-center justify-center">
        <Zap
          className={cn(
            "origin-center text-sky-400 dark:text-sky-300",
            isDock ?
              "h-11 w-9 sm:h-12 sm:w-10"
            : "h-12 w-10 sm:h-14 sm:w-11",
            "scale-y-[1.14]",
            "drop-shadow-[0_0_14px_rgba(56,189,248,0.88),0_0_32px_rgba(56,189,248,0.5)]",
            "dark:drop-shadow-[0_0_16px_rgba(56,189,248,0.95),0_0_38px_rgba(56,189,248,0.58)]",
          )}
          aria-hidden
        />
      </div>
      <h2
        className={cn(
          "font-semibold tracking-tight text-foreground",
          isDock ? "text-base sm:text-lg" : "text-lg sm:text-xl",
        )}
      >
        How can we assist your strategy?
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        Ask for risk scans, live market context, alerts, and watchlist tools—all synced with your Tauron workspace.
      </p>

      <div
        className={cn(
          "mx-auto mt-3 grid w-full max-w-2xl grid-cols-1 gap-x-3 gap-y-2 sm:mt-4 sm:grid-cols-2",
          isDock && "mt-3",
        )}
      >
        {featured.map((q) => {
          const Icon = PROMPT_ICONS[q.icon]
          const selected = activeId === q.id
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelectPrompt(q)}
              className={cn(
                "flex w-full min-w-0 flex-row items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors duration-200",
                "border-0 bg-background/55 shadow-none backdrop-blur-md dark:bg-white/[0.04]",
                "hover:bg-background/85 dark:hover:bg-white/[0.07]",
                selected && "bg-primary/[0.12] dark:bg-primary/[0.16]",
              )}
            >
              <Icon
                className={cn("size-3.5 shrink-0 text-primary", selected ? "opacity-100" : "opacity-75")}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                  {q.cardTitle}
                </div>
                <p className="line-clamp-2 text-left text-xs leading-snug text-muted-foreground">{q.cardDescription}</p>
              </div>
            </button>
          )
        })}
      </div>

      {!isDock ?
        <div className="mt-3 flex w-full min-w-0 max-w-2xl flex-wrap justify-center gap-1.5 sm:mt-4 sm:gap-2">
          {ASSISTANT_QUICK_PROMPTS.map((q) => (
            <AssistantQuickBubble
              key={q.id}
              q={q}
              selected={activeId === q.id}
              onClick={() => onSelectPrompt(q)}
            />
          ))}
        </div>
      : null}

      <p className="mx-auto mt-3 w-full max-w-sm px-2 text-center text-[8px] uppercase leading-tight tracking-wider text-muted-foreground/75 [text-wrap:balance] sm:mt-4 sm:text-[9px]">
        Tauron AI can make mistakes. Verify critical trade data.
      </p>
    </div>
  )
}

function AssistantQuickChipsRow({
  activeId,
  onSelectPrompt,
  compact,
}: {
  activeId: string | null
  onSelectPrompt: (q: AssistantQuickPrompt) => void
  compact?: boolean
}) {
  return (
    <div className={cn("flex w-full min-w-0 flex-wrap content-center justify-center gap-1.5 sm:gap-2")}>
      {ASSISTANT_QUICK_PROMPTS.map((q) => (
        <AssistantQuickBubble
          key={q.id}
          q={q}
          selected={activeId === q.id}
          onClick={() => onSelectPrompt(q)}
          compact={compact}
        />
      ))}
    </div>
  )
}

export function GeminiChatPanel({
  className,
  id,
  initialMessages,
  onActivity,
  onNewMessage,
  onRequestDeleteConversation,
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
  /** When set, right-click the message area opens a menu to delete this conversation from history. */
  onRequestDeleteConversation?: () => void | Promise<void>
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
  const [deleteConversationOpen, setDeleteConversationOpen] = React.useState(false)
  const [activePrompt, setActivePrompt] = React.useState<AssistantQuickPrompt | null>(null)
  const [assetSlot, setAssetSlot] = React.useState("")
  const [composerSeed, setComposerSeed] = React.useState<{ text: string; nonce: number } | null>(null)

  const applyPrompt = React.useCallback((q: AssistantQuickPrompt) => {
    if (q.templateParts) {
      setActivePrompt(q)
      setAssetSlot("")
    } else {
      setActivePrompt(null)
      setAssetSlot("")
      setComposerSeed({ text: q.build(""), nonce: Date.now() })
    }
  }, [])

  const clearPromptTemplate = React.useCallback(() => {
    setActivePrompt(null)
    setAssetSlot("")
    setComposerSeed({ text: "", nonce: Date.now() })
  }, [])

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
    if (messages.length === 0) return
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  const handleSend = async (text: string, files?: File[]) => {
    const t = text.trim()
    if (!t && !files?.length) return
    onNewMessage?.(t || "Media attachment")
    setActivePrompt(null)
    setAssetSlot("")
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

  const promptTemplate = React.useMemo(() => {
    if (!activePrompt?.templateParts) return null
    return {
      protocolLabel: activePrompt.protocolLabel,
      beforeText: activePrompt.templateParts.before,
      afterText: activePrompt.templateParts.after,
      slotValue: assetSlot,
      onSlotChange: setAssetSlot,
      buildMessage: (slot: string) => activePrompt.build(slot),
      onDismiss: clearPromptTemplate,
    }
  }, [activePrompt, assetSlot, clearPromptTemplate])

  const composer = (
    <PromptInputBox
      onSend={(msg, files) => void handleSend(msg, files)}
      onStop={streaming ? () => void stop() : undefined}
      isLoading={streaming}
      placeholder="Ask the assistant…"
      textareaMaxHeight={isDock ? 112 : undefined}
      composerSeed={composerSeed ?? undefined}
      promptTemplate={promptTemplate}
      className={cn(
        isDock ? "rounded-2xl border-border/60 bg-white/75 p-1.5 shadow-sm backdrop-blur-md dark:border-border/50 dark:bg-background/40" : "",
      )}
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

  const messageScrollInner = (
    <div className="space-y-5 pb-2 pt-3 sm:pt-4">
      {messages.length === 0 ? (
        <div className="flex w-full justify-center">
          <AssistantWelcomeHero onSelectPrompt={applyPrompt} activeId={activePrompt?.id ?? null} isDock={isDock} />
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
                      Tauron AI
                    </span>
                    <div
                      className={cn(
                        "rounded-2xl border px-3.5 py-2.5 text-sm text-foreground shadow-sm",
                        isDock
                          ? cn(glassPanelSurface, "border-border/60")
                          : "border-border bg-background",
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
  )

  const messageScroll = (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-1 sm:px-2",
        isDock && "min-w-0",
      )}
    >
      {messageScrollInner}
    </div>
  )

  const messageAreaCore =
    onRequestDeleteConversation ?
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            {messageScroll}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuLabel className="text-muted-foreground">This conversation</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => setDeleteConversationOpen(true)}>
            <Trash2 className="size-4" />
            Delete chat
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    : messageScroll

  /** Single grid/flex child so the scroll region gets a bounded height (ContextMenu uses a fragment). */
  const messageArea = (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        !isDock && "min-h-[min(280px,calc(100svh-280px))]",
      )}
    >
      {messageAreaCore}
    </div>
  )

  return (
    <AssistantToolApprovalContext.Provider value={addToolApprovalResponse ?? null}>
      {onRequestDeleteConversation ?
        <DeleteChatConfirmDialog
          open={deleteConversationOpen}
          onOpenChange={setDeleteConversationOpen}
          title="Delete this chat?"
          description="This conversation will be removed from your history. This cannot be undone."
          confirmLabel="Delete chat"
          onConfirm={() => void onRequestDeleteConversation()}
        />
      : null}
      <div
        className={cn(
          "min-h-0 w-full flex-1",
          isDock ? "grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-2 overflow-hidden" : "flex flex-col gap-4",
          className,
        )}
      >
        {messageArea}
        {!isDock ? (
          <>
            {messages.length === 0 ?
              <AssistantQuickChipsRow activeId={activePrompt?.id ?? null} onSelectPrompt={applyPrompt} />
            : null}
            {statusLabel ? (
              <p className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">{statusLabel}</p>
            ) : null}
            {errorBanner}
            <div className="shrink-0">{composer}</div>
          </>
        ) : (
          <div className="flex min-h-0 min-w-0 shrink-0 flex-col gap-2">
            {messages.length === 0 ?
              <div className="flex justify-center px-2 pt-1 sm:px-3">
                <AssistantQuickChipsRow
                  compact
                  activeId={activePrompt?.id ?? null}
                  onSelectPrompt={applyPrompt}
                />
              </div>
            : null}
            <div className="flex min-h-0 min-w-0 flex-col gap-2 border-t border-border/50 bg-white/72 px-2 pb-2 pt-2 shadow-[0_-8px_28px_-6px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:px-3 dark:bg-background/45 dark:shadow-[0_-8px_28px_-6px_rgba(0,0,0,0.4)]">
              {statusLabel ? (
                <p className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">{statusLabel}</p>
              ) : null}
              {errorBanner}
              {composer}
            </div>
          </div>
        )}
      </div>
    </AssistantToolApprovalContext.Provider>
  )
}
