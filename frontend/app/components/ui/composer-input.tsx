"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { CornerDownLeft } from "lucide-react"

import { ComposerInputFull } from "~/components/ui/composer-input-full"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Textarea } from "~/components/ui/textarea"

/** Frosted glass panel — translucent fill + blur/saturate (light & dark). */
const composerGlassSurface =
  "relative isolate overflow-hidden rounded-xl border border-border/50 bg-white/88 text-card-foreground shadow-sm backdrop-blur-xl backdrop-saturate-125 dark:border-border/50 dark:bg-background/85 dark:backdrop-blur-xl dark:backdrop-saturate-125"

/** Stronger fill when the composer sits on a busy page (e.g. news comments). */
const composerEmbeddedSurface =
  "relative isolate overflow-hidden rounded-b-lg border border-border/50 bg-white/[0.94] text-card-foreground shadow-md shadow-black/5 backdrop-blur-xl backdrop-saturate-150 dark:border-border/55 dark:bg-zinc-950/92 dark:shadow-black/30"

export interface Attachment {
  id: string
  fileName: string
  fileType: "image" | "document"
  thumbnailUrl?: string
}

function useSendShortcutModifierLabel(): "⌘" | "Ctrl" | null {
  const [mod, setMod] = React.useState<"⌘" | "Ctrl" | null>(null)
  React.useEffect(() => {
    setMod(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘" : "Ctrl")
  }, [])
  return mod
}

function SendShortcutHint({ mod }: { mod: "⌘" | "Ctrl" | null }) {
  if (!mod) return null
  return (
    <span className="pointer-events-none inline text-[10px] text-muted-foreground sm:text-[11px]">
      <kbd className="rounded border border-border/80 bg-muted/80 px-1 py-px font-mono text-[10px] leading-none shadow-sm">
        {mod}
      </kbd>
      <span className="mx-0.5">+</span>
      <kbd className="rounded border border-border/80 bg-muted/80 px-1 py-px font-mono text-[10px] leading-none shadow-sm">
        Enter
      </kbd>
      <span className="ml-1">to send</span>
    </span>
  )
}

export interface ComposerInputProps extends React.HTMLAttributes<HTMLDivElement> {
  onSend: (message: string, attachments: Attachment[]) => void
  initialAttachments?: Attachment[]
  placeholder?: string
  /** Full composer with formatting toolbar (default). Use ``minimal`` for a compact inline send. */
  variant?: "full" | "minimal"
  disabled?: boolean
  sendLabel?: string
  initialMessage?: string
  /** Clear textarea after send (demo only). Integration usually remounts via ``key``. */
  clearOnSend?: boolean
  /** Flush layout inside a parent card: no outer frame / blur ring (e.g. comments). */
  embedded?: boolean
  /** Default matches API `CreateNewsCommentRequest` (markdown may embed base64 images). */
  maxLength?: number
}

type MinimalProps = Omit<ComposerInputProps, "variant"> & { variant?: "minimal" }

const ComposerInputMinimal = React.forwardRef<HTMLDivElement, MinimalProps>(
  (
    {
      className,
      onSend,
      initialAttachments = [],
      placeholder = "Type your message...",
      disabled = false,
      sendLabel = "Send",
      initialMessage = "",
      clearOnSend = false,
      embedded = false,
      maxLength = 2_000_000,
      ...props
    },
    ref,
  ) => {
    const [message, setMessage] = React.useState(initialMessage)
    const [attachments, setAttachments] = React.useState<Attachment[]>(initialAttachments)
    const sendShortcutMod = useSendShortcutModifierLabel()

    React.useEffect(() => {
      setMessage(initialMessage)
    }, [initialMessage])

    const handleSend = () => {
      const t = message.trim()
      if (!t && attachments.length === 0) return
      onSend(message, attachments)
      if (clearOnSend) {
        setMessage("")
        setAttachments([])
      }
    }

    const shellClass = embedded
      ? cn(
          composerEmbeddedSurface,
          "focus-within:ring-2 focus-within:ring-ring/90 focus-within:ring-offset-0",
        )
      : cn(
          composerGlassSurface,
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        )

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full flex-col transition-all duration-200",
          shellClass,
          className,
        )}
        {...props}
      >
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className="min-h-[100px] w-full resize-none border-0 bg-transparent px-3 py-3 pr-[5.5rem] pb-12 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
          <SendShortcutHint mod={sendShortcutMod} />
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pointer-events-auto ml-auto shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={disabled || (!message.trim() && attachments.length === 0)}
              className="gap-1.5 shadow-sm"
            >
              <CornerDownLeft className="size-4 opacity-80" />
              {sendLabel}
            </Button>
          </motion.div>
        </div>
      </div>
    )
  },
)

ComposerInputMinimal.displayName = "ComposerInputMinimal"

const ComposerInput = React.forwardRef<HTMLDivElement, ComposerInputProps>(
  ({ variant = "full", ...props }, ref) => {
    if (variant === "minimal") {
      return <ComposerInputMinimal ref={ref} {...props} variant="minimal" />
    }
    return <ComposerInputFull ref={ref} {...props} />
  },
)

ComposerInput.displayName = "ComposerInput"

export { ComposerInput }
