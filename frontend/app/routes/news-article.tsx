"use client"

import * as React from "react"
import { Link, useParams } from "react-router"
import {
  ArrowLeft,
  BookOpen,
  Glasses,
  MoreVertical,
  Newspaper,
  Pencil,
  Reply,
  Trash2,
  X,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"

import { DATE_FNS_LOCALE } from "~/lib/date-locale"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import { MarkdownContent } from "~/components/ui/markdown-content"
import { Card, CardContent } from "~/components/ui/card"
import { ComposerInput, type Attachment } from "~/components/ui/composer-input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useSidebar } from "~/components/ui/sidebar"
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  type CuratedNewsResponse,
  type NewsCommentResponse,
  type PaginatedResponse,
} from "~/lib/api-client"
import {
  buildCommentMarkdownBody,
  EMPTY_COMPOSER_ATTACHMENTS,
  parseCommentMarkdownForEdit,
  resolveCommentAttachmentsToUrls,
} from "~/lib/comment-markdown"
import {
  buildCommentThreadTree,
  type CommentThreadNode,
} from "~/lib/comment-thread"
import { cn } from "~/lib/utils"

const articleCardClass = "gap-0 py-0"
/** Tighter than default cards so the article column feels less empty. */
const articleCardContentClass = "space-y-1.5 py-2 px-2.5 sm:px-3 sm:py-2.5"
const articleCardContentClassRead = "space-y-1.5 py-1 px-2 sm:px-2.5 sm:py-2"

type ReadFontScale = "sm" | "md" | "lg"

const readModeGlassesIconClass: Record<ReadFontScale, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
}

const readFontPresets: Record<
  ReadFontScale,
  { bodyText: string; metaText: string; titleClass: string }
> = {
  sm: {
    bodyText: "text-base leading-[1.75] text-foreground",
    metaText: "text-xs text-muted-foreground",
    titleClass:
      "text-2xl font-semibold tracking-tight text-foreground sm:text-3xl",
  },
  md: {
    bodyText: "text-lg leading-[1.9] text-foreground",
    metaText: "text-sm leading-relaxed text-muted-foreground",
    titleClass:
      "text-3xl font-semibold tracking-tight text-foreground sm:text-4xl",
  },
  lg: {
    bodyText: "text-xl leading-[2] text-foreground sm:text-[1.35rem]",
    metaText: "text-base leading-relaxed text-muted-foreground",
    titleClass:
      "text-4xl font-semibold tracking-tight text-foreground sm:text-5xl",
  },
}

function ReadModeFontSizeToggle({
  readMode,
  readFontScale,
  setReadFontScale,
}: {
  readMode: boolean
  readFontScale: ReadFontScale
  setReadFontScale: React.Dispatch<React.SetStateAction<ReadFontScale>>
}) {
  if (!readMode) return null
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/25 bg-zinc-950/90 p-0.5 shadow-lg backdrop-blur-md"
      role="group"
      aria-label="Article text size"
    >
      {(["sm", "md", "lg"] as const).map((key) => (
        <Button
          key={key}
          type="button"
          variant={readFontScale === key ? "secondary" : "ghost"}
          size="icon"
          className={cn(
            "size-8 shrink-0 text-zinc-100 hover:bg-white/15 hover:text-white [&_svg]:text-current",
            readFontScale === key &&
              "bg-white/25 text-white hover:bg-white/30",
          )}
          aria-label={
            key === "sm" ? "Smaller text" : key === "md" ? "Medium text" : "Larger text"
          }
          aria-pressed={readFontScale === key}
          onClick={() => setReadFontScale(key)}
        >
          <Glasses className={cn("shrink-0", readModeGlassesIconClass[key])} aria-hidden />
        </Button>
      ))}
    </div>
  )
}

function sentimentLabel(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "Neutral"
  if (score > 0.15) return "Bullish"
  if (score < -0.15) return "Bearish"
  return "Neutral"
}

function sentimentClass(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "text-muted-foreground border-muted"
  if (score > 0.15) return "text-green-600 dark:text-green-400 border-green-600/40 bg-green-500/10"
  if (score < -0.15) return "text-red-600 dark:text-red-400 border-red-600/40 bg-red-500/10"
  return "text-muted-foreground border-muted"
}

function commentAvatarInitials(username: string): string {
  const t = username.trim()
  if (!t) return "?"
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]?.[0]
    const b = parts[1]?.[0]
    if (a && b) return `${a}${b}`.toUpperCase()
  }
  return t.slice(0, 2).toUpperCase()
}

function curatedNewsBarTitle(
  item: CuratedNewsResponse | null,
  loading: boolean,
  error: string | null,
): string {
  if (loading) return "News article"
  if (error || !item) return "News article"
  const dp = item.data_points_used as Record<string, unknown> | null | undefined
  const headline = typeof dp?.title === "string" ? dp.title.trim() : ""
  return headline || "Curated summary"
}

function NewsCommentCard({
  node,
  depth,
  meId,
  onReply,
  onEdit,
  onDelete,
}: {
  node: CommentThreadNode
  depth: number
  meId: string | null
  onReply: (id: string, username: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const c = node
  const t = new Date(c.created_at)
  const when =
    !Number.isNaN(t.getTime())
      ? formatDistanceToNow(t, { addSuffix: true, locale: DATE_FNS_LOCALE })
      : ""
  const isMine = meId != null && c.user_id === meId
  const edited =
    !!c.updated_at &&
    new Date(c.updated_at).getTime() > new Date(c.created_at).getTime()

  return (
    <li
      className={cn(
        "rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5 sm:px-3.5",
        depth > 0 && "ml-3 border-l-2 border-l-primary/25 sm:ml-4",
      )}
    >
      <div className="flex gap-2.5 sm:gap-3">
        <Avatar size="sm" className="mt-0.5 shrink-0">
          <AvatarFallback className="text-[10px] font-semibold">
            {commentAvatarInitials(c.username)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-foreground">{c.username}</span>
              {edited ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Updated
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {when ? (
                <time
                  className="text-[10px] text-muted-foreground"
                  dateTime={c.created_at}
                >
                  {when}
                </time>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label="Reply"
                title="Reply"
                onClick={() => onReply(c.id, c.username)}
              >
                <Reply className="size-4" aria-hidden />
              </Button>
              {isMine ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      aria-label="Comment actions"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[9rem]">
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={() => onEdit(c.id)}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      className="gap-2"
                      onSelect={() => onDelete(c.id)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
          {c.parent_username ? (
            <p className="mb-1.5 text-[11px] text-muted-foreground">
              Replying to{" "}
              <span className="font-semibold text-foreground">@{c.parent_username}</span>
            </p>
          ) : null}
          <MarkdownContent>{c.content}</MarkdownContent>
        </div>
      </div>
      {node.children.length > 0 ? (
        <ul className="mt-3 space-y-3 border-t border-border/30 pt-3">
          {node.children.map((ch) => (
            <NewsCommentCard
              key={ch.id}
              node={ch}
              depth={depth + 1}
              meId={meId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** Renders in ``DashboardLayout`` header — must use ``useSidebar`` (inside ``SidebarProvider``). */
function NewsArticleHeaderActions({
  readMode,
  setReadMode,
}: {
  readMode: boolean
  setReadMode: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const { setOpen, setOpenMobile } = useSidebar()

  React.useEffect(() => {
    if (readMode) {
      setOpen(false)
      setOpenMobile(false)
    }
  }, [readMode, setOpen, setOpenMobile])

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant={readMode ? "secondary" : "outline"}
        size="sm"
        onClick={() => setReadMode((r) => !r)}
        className="gap-1.5"
      >
        <BookOpen className="size-4 shrink-0" />
        {readMode ? "Exit read mode" : "Read mode"}
      </Button>
      <Button type="button" variant="outline" size="sm" asChild>
        <Link to="/news" className="gap-2">
          <ArrowLeft className="size-4 shrink-0" />
          Back to feed
        </Link>
      </Button>
    </div>
  )
}

export default function CuratedNewsDetailPage() {
  const [readMode, setReadMode] = React.useState(false)
  const [headerTitle, setHeaderTitle] = React.useState("News article")

  return (
    <DashboardLayout
      title={
        <span className="block min-w-0 truncate font-medium" title={headerTitle}>
          {headerTitle}
        </span>
      }
      actions={<NewsArticleHeaderActions readMode={readMode} setReadMode={setReadMode} />}
    >
      <NewsArticleBody
        readMode={readMode}
        setReadMode={setReadMode}
        setHeaderTitle={setHeaderTitle}
      />
    </DashboardLayout>
  )
}

function NewsArticleBody({
  readMode,
  setReadMode,
  setHeaderTitle,
}: {
  readMode: boolean
  setReadMode: React.Dispatch<React.SetStateAction<boolean>>
  setHeaderTitle: React.Dispatch<React.SetStateAction<string>>
}) {
  const [readFontScale, setReadFontScale] = React.useState<ReadFontScale>("md")
  const { newsId } = useParams()
  const [item, setItem] = React.useState<CuratedNewsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [comments, setComments] = React.useState<NewsCommentResponse[]>([])
  const [commentsTotal, setCommentsTotal] = React.useState(0)
  const [commentsLoading, setCommentsLoading] = React.useState(false)
  const [commentsError, setCommentsError] = React.useState<string | null>(null)
  const [posting, setPosting] = React.useState(false)
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null)
  const [replyingTo, setReplyingTo] = React.useState<{
    id: string
    username: string
  } | null>(null)
  const [commentToDeleteId, setCommentToDeleteId] = React.useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false)
  const [composerKey, setComposerKey] = React.useState(0)
  const composerDockRef = React.useRef<HTMLDivElement>(null)
  const [meId, setMeId] = React.useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("user_id") : null,
  )

  const scrollComposerIntoView = React.useCallback(() => {
    window.setTimeout(() => {
      composerDockRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      })
    }, 80)
  }, [])

  React.useEffect(() => {
    document.documentElement.toggleAttribute("data-news-read-mode", readMode)
    return () => document.documentElement.removeAttribute("data-news-read-mode")
  }, [readMode])

  React.useEffect(() => {
    if (!readMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReadMode(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [readMode, setReadMode])

  React.useEffect(() => {
    const sync = () => setMeId(localStorage.getItem("user_id"))
    sync()
    window.addEventListener("tauron:auth-changed", sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener("tauron:auth-changed", sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const refreshComments = React.useCallback(async () => {
    if (!newsId) return
    const page = await apiGet<PaginatedResponse<NewsCommentResponse>>(
      `/curated-news/${newsId}/comments`,
      { page: 1, page_size: 100 },
    )
    setComments(page.items)
    setCommentsTotal(page.total)
  }, [newsId])

  React.useEffect(() => {
    if (!newsId) {
      setLoading(false)
      setError("Missing article id.")
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const row = await apiGet<CuratedNewsResponse>(`/curated-news/${newsId}`)
        if (!cancelled) setItem(row)
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Could not load article.")
          setItem(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [newsId])

  React.useEffect(() => {
    if (!newsId || !item) {
      setComments([])
      setCommentsTotal(0)
      return
    }
    let cancelled = false
    setCommentsLoading(true)
    setCommentsError(null)
    void (async () => {
      try {
        await refreshComments()
      } catch (e) {
        if (!cancelled) {
          setCommentsError(e instanceof Error ? e.message : "Could not load comments.")
          setComments([])
        }
      } finally {
        if (!cancelled) setCommentsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [newsId, item?.id, refreshComments])

  React.useEffect(() => {
    setHeaderTitle(curatedNewsBarTitle(item, loading, error))
  }, [item, loading, error, setHeaderTitle])

  const dp = item?.data_points_used as Record<string, unknown> | null | undefined
  const headline = typeof dp?.title === "string" ? dp.title : null
  const sourceOriginalTitle =
    typeof dp?.original_title === "string" ? dp.original_title : null
  const source = typeof dp?.source === "string" ? dp.source : null
  const storyDateStr = item?.published_at ?? item?.created_at
  const storyDate = storyDateStr ? new Date(storyDateStr) : null
  const displayDate = storyDate && !Number.isNaN(storyDate.getTime()) ? storyDate : null

  const editComposerState = React.useMemo(() => {
    if (editingCommentId == null) return null
    const raw = comments.find((c) => c.id === editingCommentId)?.content ?? ""
    return parseCommentMarkdownForEdit(raw)
  }, [editingCommentId, comments])

  const commentTree = React.useMemo(
    () => buildCommentThreadTree(comments),
    [comments],
  )

  React.useEffect(() => {
    if (editingCommentId) setReplyingTo(null)
  }, [editingCommentId])

  async function handleComposerSend(message: string, attachments: Attachment[]) {
    if (!newsId || posting) return
    let resolved = attachments
    try {
      resolved = await resolveCommentAttachmentsToUrls(attachments)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload images.")
      return
    }
    const content = buildCommentMarkdownBody(message, resolved).trim()
    if (!content) return
    setPosting(true)
    setCommentsError(null)
    try {
      if (editingCommentId) {
        await apiPatch<NewsCommentResponse>(
          `/curated-news/${newsId}/comments/${editingCommentId}`,
          { content },
        )
        toast.success("Comment updated")
        setEditingCommentId(null)
      } else {
        await apiPost<NewsCommentResponse>(`/curated-news/${newsId}/comments`, {
          content,
          ...(replyingTo ? { parent_comment_id: replyingTo.id } : {}),
        })
        toast.success("Comment posted")
        setReplyingTo(null)
      }
      await refreshComments()
      setComposerKey((k) => k + 1)
    } catch (e) {
      setCommentsError(e instanceof Error ? e.message : "Could not save comment.")
      toast.error(e instanceof Error ? e.message : "Could not save comment.")
    } finally {
      setPosting(false)
    }
  }

  const pendingDeleteComment = commentToDeleteId
    ? comments.find((c) => c.id === commentToDeleteId)
    : undefined

  async function confirmDeleteComment() {
    if (!newsId || !commentToDeleteId) return
    const commentId = commentToDeleteId
    setDeleteSubmitting(true)
    setCommentsError(null)
    try {
      await apiDelete(`/curated-news/${newsId}/comments/${commentId}`)
      toast.success("Comment removed")
      setCommentToDeleteId(null)
      if (editingCommentId === commentId) setEditingCommentId(null)
      await refreshComments()
      setComposerKey((k) => k + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.")
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const preset = readFontPresets[readFontScale]
  const bodyText = readMode ? preset.bodyText : "text-sm leading-7 text-foreground"
  const metaText = readMode ? preset.metaText : "text-xs text-muted-foreground"
  const titleClass = readMode ? preset.titleClass : "text-2xl font-semibold tracking-tight"

  return (
    <>
    <div
      className="relative flex-1 overflow-y-auto"
      style={{ paddingTop: "var(--market-banner-offset, 0px)" }}
    >
      {readMode ? (
        <div className="pointer-events-none fixed inset-0 z-40 bg-black" aria-hidden />
      ) : null}
      {readMode ? (
        <div className="pointer-events-none fixed top-[calc(var(--market-banner-offset,0px)+0.5rem)] right-4 z-[60] sm:right-5 dark">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="pointer-events-auto gap-1.5 shadow-lg"
            onClick={() => setReadMode(false)}
          >
            <X className="size-4 shrink-0" />
            Exit read mode
          </Button>
        </div>
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden",
          readMode && "hidden",
        )}
        aria-hidden
      >
        <div className="absolute -left-[9%] top-[12%] h-[min(260px,34vh)] w-[min(340px,40vw)] rounded-full bg-blue-500/12 blur-[115px] dark:bg-blue-400/10" />
        <div className="absolute -right-[9%] top-[20%] h-[min(260px,34vh)] w-[min(340px,40vw)] rounded-full bg-sky-400/12 blur-[115px] dark:bg-sky-500/10" />
      </div>
      <div
        className={cn(
          "relative mx-auto flex w-full flex-col gap-3 px-2.5 py-3 sm:gap-4 sm:px-3 md:py-4 md:px-4",
          readMode
            ? "dark z-50 w-full max-w-[min(100%,88rem)] px-2 py-3 sm:px-3 sm:py-4 md:px-4"
            : "z-[1] max-w-5xl",
        )}
      >
        {loading ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : !item ? (
          <div className="text-sm text-muted-foreground">No data.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide",
                  sentimentClass(item.sentiment_score),
                )}
              >
                {sentimentLabel(item.sentiment_score)}
              </span>
              {item.asset_symbol ? (
                <Link
                  to="/assets"
                  className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary hover:bg-primary/20"
                  title="View assets (search for this symbol)"
                >
                  {item.asset_symbol}
                </Link>
              ) : null}
            </div>

            {headline ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <h1 className={cn(titleClass, "min-w-0 flex-1")}>{headline}</h1>
                <ReadModeFontSizeToggle
                  readMode={readMode}
                  readFontScale={readFontScale}
                  setReadFontScale={setReadFontScale}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <h1 className={cn("flex min-w-0 flex-1 items-center gap-2", titleClass)}>
                  <Newspaper className="size-7 shrink-0 text-primary" />
                  Curated summary
                </h1>
                <ReadModeFontSizeToggle
                  readMode={readMode}
                  readFontScale={readFontScale}
                  setReadFontScale={setReadFontScale}
                />
              </div>
            )}
            {sourceOriginalTitle ? (
              <p className={cn(metaText)}>Original headline: {sourceOriginalTitle}</p>
            ) : null}

            <div className={cn("flex flex-wrap gap-4", metaText)}>
              {source ? (
                <span>
                  Source: <span className="font-medium text-foreground">{source}</span>
                </span>
              ) : null}
              {displayDate ? (
                <span>
                  Published:{" "}
                  <time dateTime={displayDate.toISOString()} className="font-medium text-foreground">
                    {format(displayDate, "MMM d, yyyy · HH:mm", { locale: DATE_FNS_LOCALE })}
                  </time>
                  <span className="ml-1">
                    ({formatDistanceToNow(displayDate, { addSuffix: true, locale: DATE_FNS_LOCALE })})
                  </span>
                </span>
              ) : null}
            </div>

            {item.article_content ? (
              <Card className={articleCardClass}>
                <CardContent
                  className={readMode ? articleCardContentClassRead : articleCardContentClass}
                >
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Full article
                  </h2>
                  <p className={cn("whitespace-pre-wrap", bodyText)}>{item.article_content}</p>
                </CardContent>
              </Card>
            ) : (
              <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-2.5 py-2 text-sm text-muted-foreground">
                Full source article text is not stored for this item (older or manually created entries may omit it).
              </p>
            )}

            <Card className={articleCardClass}>
              <CardContent
                className={readMode ? articleCardContentClassRead : articleCardContentClass}
              >
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Curated summary
                </h2>
                <MarkdownContent textClassName={bodyText} className="mt-0.5">
                  {item.summary}
                </MarkdownContent>
              </CardContent>
            </Card>

            {!readMode ? (
              <Card className={cn(articleCardClass, "overflow-hidden")}>
                <CardContent className="flex flex-col gap-0 p-0">
                  <div
                    className={cn(
                      articleCardContentClass,
                      "border-b border-border/50 pb-2.5 pt-2.5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        Comments
                      </h2>
                      {commentsTotal > 0 ? (
                        <span className="text-xs text-muted-foreground">{commentsTotal}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className={cn(articleCardContentClass, "flex-1 space-y-3")}>
                  {commentsError ? (
                    <p className="text-sm text-destructive">{commentsError}</p>
                  ) : null}
                  {commentsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading comments…</p>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No comments yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {commentTree.map((node) => (
                        <NewsCommentCard
                          key={node.id}
                          node={node}
                          depth={0}
                          meId={meId}
                          onReply={(id, username) => {
                            setEditingCommentId(null)
                            setReplyingTo({ id, username })
                            scrollComposerIntoView()
                          }}
                          onEdit={(id) => {
                            setReplyingTo(null)
                            setEditingCommentId((cur) => (cur === id ? null : id))
                          }}
                          onDelete={setCommentToDeleteId}
                        />
                      ))}
                    </ul>
                  )}
                  </div>
                  <div
                    ref={composerDockRef}
                    className="mt-auto scroll-mt-20 border-t border-border/50"
                  >
                    {editingCommentId ? (
                      <p className="border-b border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                        Editing a comment — use Save in the composer, or{" "}
                        <button
                          type="button"
                          className="font-semibold text-primary underline-offset-2 hover:underline"
                          onClick={() => {
                            setEditingCommentId(null)
                            setComposerKey((k) => k + 1)
                          }}
                        >
                          Cancel
                        </button>
                        .
                      </p>
                    ) : replyingTo ? (
                      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                        <span>
                          Replying to{" "}
                          <span className="font-semibold text-foreground">
                            @{replyingTo.username}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline"
                          onClick={() => setReplyingTo(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                    <ComposerInput
                      key={`${composerKey}-${editingCommentId ?? "new"}`}
                      variant="full"
                      embedded
                      maxLength={2_000_000}
                      placeholder={
                        editingCommentId
                          ? "Edit your comment…"
                          : replyingTo
                            ? `Reply to ${replyingTo.username}…`
                            : "Share your thoughts…"
                      }
                      sendLabel={editingCommentId ? "Save" : "Post"}
                      initialMessage={editComposerState?.text ?? ""}
                      initialAttachments={
                        editComposerState?.attachments ?? EMPTY_COMPOSER_ATTACHMENTS
                      }
                      disabled={posting}
                      clearOnSend={false}
                      onSend={(msg, att) => void handleComposerSend(msg, att)}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </div>

    <Dialog
      open={commentToDeleteId !== null}
      onOpenChange={(open) => {
        if (!open) setCommentToDeleteId(null)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete comment?</DialogTitle>
          <DialogDescription>
            This will permanently remove your comment. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {pendingDeleteComment?.content ? (
          <div
            className="max-h-32 overflow-y-auto rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground"
            aria-label="Comment to delete"
          >
            <MarkdownContent>{pendingDeleteComment.content}</MarkdownContent>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCommentToDeleteId(null)}
            disabled={deleteSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void confirmDeleteComment()}
            disabled={deleteSubmitting}
          >
            {deleteSubmitting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
