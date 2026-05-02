"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import CharacterCount from "@tiptap/extension-character-count"
import Underline from "@tiptap/extension-underline"
import {
  Bold,
  Code,
  CornerDownLeft,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Mic,
  MoreHorizontal,
  Paperclip,
  Quote,
  Trash2,
  Underline as UnderlineIcon,
  Wand2,
  X,
} from "lucide-react"

import { compressImageFileToDataUrl } from "~/lib/comment-markdown"
import { htmlToMarkdown, markdownToHtml } from "~/lib/composer-markdown-io"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"

import type { Attachment, ComposerInputProps } from "~/components/ui/composer-input"

function dataTransferHasFiles(dt: DataTransfer | null): boolean {
  return Boolean(dt?.types?.includes("Files"))
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

const composerGlassSurfaceFull =
  "composer-glass-shell relative isolate overflow-hidden rounded-xl border border-border/50 bg-white/88 text-card-foreground shadow-sm backdrop-blur-xl backdrop-saturate-125 dark:border-border/50 dark:bg-background/85 dark:backdrop-blur-xl dark:backdrop-saturate-125"

const composerEmbeddedSurfaceFull =
  "composer-glass-shell relative isolate overflow-hidden rounded-b-lg border border-border/50 bg-white/[0.94] text-card-foreground shadow-md shadow-black/5 backdrop-blur-xl backdrop-saturate-150 dark:border-border/55 dark:bg-zinc-950/92 dark:shadow-black/30"

const editorShellClass =
  "min-h-[100px] w-full px-2 py-2 text-sm text-foreground outline-none [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror]:outline-none [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/35 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-muted/40 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_strong]:font-semibold [&_code]:rounded [&_code]:border [&_code]:border-border/60 [&_code]:bg-muted/60 [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.9em]"

function runLink(editor: Editor | null) {
  if (!editor) return
  const prev = editor.getAttributes("link").href as string | undefined
  const next = window.prompt("Link URL", prev ?? "https://")
  if (next === null) return
  if (next.trim() === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run()
    return
  }
  let href = next.trim()
  if (!/^https?:\/\//i.test(href)) href = `https://${href}`
  editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
}

export interface ComposerInputFullProps extends Omit<ComposerInputProps, "variant"> {}

export const ComposerInputFull = React.forwardRef<HTMLDivElement, ComposerInputFullProps>(
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
    const [attachments, setAttachments] =
      React.useState<Attachment[]>(initialAttachments)
    const [isFileDragHover, setIsFileDragHover] = React.useState(false)
    const [previewAttachment, setPreviewAttachment] = React.useState<Attachment | null>(null)
    const imageInputRef = React.useRef<HTMLInputElement>(null)
    const sendShortcutMod = useSendShortcutModifierLabel()

    const initialHtml = React.useMemo(() => markdownToHtml(initialMessage), [initialMessage])
    const handleSendRef = React.useRef<(() => void) | null>(null)

    const extensions = React.useMemo(
      () => [
        StarterKit.configure({
          heading: false,
          link: {
            openOnClick: false,
            HTMLAttributes: {
              class:
                "text-primary underline underline-offset-2 font-medium hover:text-primary/90",
            },
          },
        }),
        Underline,
        Placeholder.configure({ placeholder }),
        CharacterCount.configure({
          limit: maxLength,
        }),
      ],
      [maxLength, placeholder],
    )

    const editor = useEditor(
      {
        immediatelyRender: false,
        shouldRerenderOnTransaction: true,
        extensions,
        content: initialHtml,
        editable: !disabled,
        editorProps: {
          attributes: {
            class: cn(editorShellClass, "bg-transparent"),
          },
          handleKeyDown(_view, event) {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              handleSendRef.current?.()
              return true
            }
            return false
          },
        },
      },
      [initialMessage, maxLength, placeholder],
    )

    React.useEffect(() => {
      editor?.setEditable(!disabled)
    }, [editor, disabled])

    React.useEffect(() => {
      const onDragEnd = () => setIsFileDragHover(false)
      window.addEventListener("dragend", onDragEnd)
      return () => window.removeEventListener("dragend", onDragEnd)
    }, [])

    const handleRemoveAttachment = (id: string) => {
      setAttachments((prev) => prev.filter((att) => att.id !== id))
      setPreviewAttachment((p) => (p?.id === id ? null : p))
    }

    const clearAll = () => {
      editor?.commands.clearContent()
      setAttachments([])
      setPreviewAttachment(null)
    }

    const handleSend = React.useCallback(() => {
      if (!editor) return
      const md = htmlToMarkdown(editor.getHTML())
      const emptyDoc = editor.isEmpty && attachments.length === 0
      if (emptyDoc) return
      if (!md.trim() && attachments.length === 0) return
      const chars = editor.storage.characterCount?.characters() ?? md.length
      if (chars > maxLength) return
      onSend(md, attachments)
      if (clearOnSend) {
        editor.commands.clearContent()
        setAttachments([])
      }
    }, [editor, attachments, clearOnSend, maxLength, onSend])

    handleSendRef.current = handleSend

    const addImagesFromFiles = React.useCallback(async (files: FileList | null) => {
      if (!files?.length) return
      const added: Attachment[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        try {
          const thumbnailUrl = await compressImageFileToDataUrl(file)
          added.push({
            id: crypto.randomUUID(),
            fileName: file.name || "image",
            fileType: "image",
            thumbnailUrl,
          })
        } catch {
          toast.error(`Could not add ${file.name || "image"}.`)
        }
      }
      if (added.length) setAttachments((prev) => [...prev, ...added])
    }, [])

    const shellClass = embedded
      ? cn(
          composerEmbeddedSurfaceFull,
          "focus-within:ring-2 focus-within:ring-ring/90 focus-within:ring-offset-0",
        )
      : cn(
          composerGlassSurfaceFull,
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        )

    const charCount = editor?.storage.characterCount?.characters() ?? 0
    const canSend =
      !disabled &&
      editor != null &&
      (!editor.isEmpty || attachments.length > 0) &&
      charCount <= maxLength

    const toolbarItems = editor
      ? [
          {
            icon: Bold,
            tooltip: "Bold",
            active: editor.isActive("bold"),
            onClick: () => editor.chain().focus().toggleBold().run(),
          },
          {
            icon: Italic,
            tooltip: "Italic",
            active: editor.isActive("italic"),
            onClick: () => editor.chain().focus().toggleItalic().run(),
          },
          {
            icon: UnderlineIcon,
            tooltip: "Underline",
            active: editor.isActive("underline"),
            onClick: () => editor.chain().focus().toggleUnderline().run(),
          },
          {
            icon: List,
            tooltip: "Bullet list",
            active: editor.isActive("bulletList"),
            onClick: () => editor.chain().focus().toggleBulletList().run(),
          },
          {
            icon: ListOrdered,
            tooltip: "Numbered list",
            active: editor.isActive("orderedList"),
            onClick: () => editor.chain().focus().toggleOrderedList().run(),
          },
          {
            icon: Quote,
            tooltip: "Quote",
            active: editor.isActive("blockquote"),
            onClick: () => editor.chain().focus().toggleBlockquote().run(),
          },
          {
            icon: Code,
            tooltip: "Code",
            active: editor.isActive("code"),
            onClick: () => editor.chain().focus().toggleCode().run(),
          },
          {
            icon: LinkIcon,
            tooltip: "Link",
            active: editor.isActive("link"),
            onClick: () => runLink(editor),
          },
        ]
      : []

    const actionItems = [
      { icon: Paperclip, tooltip: "Attach File" },
      { icon: Mic, tooltip: "Voice Message" },
      { icon: ImageIcon, tooltip: "Add Image" },
      { icon: Wand2, tooltip: "AI Assist" },
      { icon: MoreHorizontal, tooltip: "More Options" },
    ]

    const dropHighlight =
      !disabled &&
      isFileDragHover &&
      "rounded-[inherit] border-2 border-dashed border-primary/70 bg-primary/[0.07] ring-2 ring-primary/15"

    return (
      <TooltipProvider>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void addImagesFromFiles(e.target.files)
            e.target.value = ""
          }}
        />
        <div
          ref={ref}
          {...props}
          className={cn(
            "relative flex w-full flex-col transition-[border,box-shadow,background-color] duration-200 ease-out",
            shellClass,
            embedded && isFileDragHover && "rounded-lg",
            dropHighlight,
            className,
          )}
          onDragEnter={(e) => {
            if (disabled) return
            if (!dataTransferHasFiles(e.dataTransfer)) return
            e.preventDefault()
            setIsFileDragHover(true)
          }}
          onDragLeave={(e) => {
            if (disabled) return
            const next = e.relatedTarget as Node | null
            if (next && e.currentTarget.contains(next)) return
            setIsFileDragHover(false)
          }}
          onDragOverCapture={(e) => {
            if (disabled) return
            if (!dataTransferHasFiles(e.dataTransfer)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = "copy"
          }}
          onDropCapture={(e) => {
            if (disabled) return
            if (!dataTransferHasFiles(e.dataTransfer)) return
            e.preventDefault()
            e.stopPropagation()
            setIsFileDragHover(false)
            void addImagesFromFiles(e.dataTransfer.files)
          }}
        >
          {isFileDragHover && !disabled ? (
            <div
              className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center rounded-[inherit] bg-background/25 backdrop-blur-[0.5px]"
              aria-hidden
            >
              <span className="rounded-md border border-dashed border-primary/50 bg-background/90 px-4 py-2 text-sm font-medium text-primary shadow-sm">
                Drop images here
              </span>
            </div>
          ) : null}
          <div
            className={cn(
              "flex items-center justify-between p-2",
              embedded
                ? "border-b border-border/50 bg-white/55 dark:bg-zinc-900/50"
                : "border-b border-border/40",
            )}
          >
            <div className="flex flex-wrap items-center gap-1">
              {toolbarItems.map((item, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={item.active ? "secondary" : "ghost"}
                      size="icon"
                      type="button"
                      className="h-8 w-8"
                      disabled={disabled}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault()
                        item.onClick()
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="h-8 w-8 text-destructive"
                  disabled={disabled}
                  onClick={clearAll}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Clear</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className={cn("flex-grow", embedded ? "px-2 pb-1 pt-1" : "p-2")}>
            <EditorContent editor={editor} />
          </div>

          {attachments.length > 0 ? (
            <div className={cn("pb-2", embedded ? "px-2" : "px-4")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                <AnimatePresence>
                  {attachments.map((att) => (
                    <motion.div
                      key={att.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="group relative"
                    >
                      <button
                        type="button"
                        title="View image"
                        disabled={att.fileType !== "image" || !att.thumbnailUrl}
                        onClick={() => {
                          if (att.fileType === "image" && att.thumbnailUrl) setPreviewAttachment(att)
                        }}
                        className={cn(
                          "flex aspect-square w-full cursor-default items-center justify-center overflow-hidden rounded-md bg-muted/70 ring-offset-background backdrop-blur-sm transition-shadow dark:bg-muted/50",
                          att.fileType === "image" &&
                            att.thumbnailUrl &&
                            "cursor-pointer hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        {att.fileType === "image" && att.thumbnailUrl ? (
                          <img
                            src={att.thumbnailUrl}
                            alt={att.fileName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Paperclip className="h-6 w-6 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveAttachment(att.id)
                        }}
                        className="absolute -right-1 -top-1 z-[1] rounded-full border bg-background p-0.5 text-destructive shadow-sm opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                        aria-label="Remove attachment"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-2 gap-y-1 p-2",
              embedded
                ? "border-t border-border/50 bg-white/40 dark:bg-zinc-900/38"
                : "border-t border-border/40",
            )}
          >
            <div className="flex items-center gap-1">
              {actionItems.map((item, index) => {
                const opensImagePicker = index === 0 || index === 2
                const isStub = [1, 3, 4].includes(index)
                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        className="h-8 w-8"
                        disabled={disabled || isStub}
                        onClick={() => {
                          if (opensImagePicker) imageInputRef.current?.click()
                        }}
                      >
                        <item.icon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{opensImagePicker ? "Add image" : item.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-initial sm:gap-3">
              <SendShortcutHint mod={sendShortcutMod} />
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="shrink-0">
                <Button
                  type="button"
                  onClick={() => void handleSend()}
                  size="sm"
                  disabled={!canSend}
                >
                  {sendLabel}
                  <CornerDownLeft className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          </div>
        </div>

        <Dialog
          open={previewAttachment !== null}
          onOpenChange={(open) => {
            if (!open) setPreviewAttachment(null)
          }}
        >
          <DialogContent className="max-w-3xl gap-4">
            <DialogHeader>
              <DialogTitle className="truncate pr-8">
                {previewAttachment?.fileName ?? "Image"}
              </DialogTitle>
            </DialogHeader>
            {previewAttachment?.thumbnailUrl ? (
              <div className="flex max-h-[min(75vh,720px)] justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30">
                <img
                  src={previewAttachment.thumbnailUrl}
                  alt={previewAttachment.fileName}
                  className="max-h-[min(75vh,720px)] w-full object-contain"
                />
              </div>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (previewAttachment) handleRemoveAttachment(previewAttachment.id)
                  setPreviewAttachment(null)
                }}
              >
                Remove image
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    )
  },
)

ComposerInputFull.displayName = "ComposerInputFull"
