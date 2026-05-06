"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

import { cn } from "~/lib/utils"

const defaultMdText = "text-sm leading-relaxed text-foreground"

function createMarkdownComponents(bodyTextClassName: string) {
  return {
    p: ({ className, ...props }: React.ComponentProps<"p">) => (
      <p className={cn("mb-2 last:mb-0", bodyTextClassName, className)} {...props} />
    ),
    strong: ({ className, ...props }: React.ComponentProps<"strong">) => (
      <strong className={cn("font-semibold text-foreground", className)} {...props} />
    ),
    em: ({ className, ...props }: React.ComponentProps<"em">) => (
      <em className={cn("italic", bodyTextClassName, className)} {...props} />
    ),
    u: ({ className, ...props }: React.ComponentProps<"u">) => (
      <u className={cn("underline underline-offset-2", bodyTextClassName, className)} {...props} />
    ),
    a: ({ className, href, children, ...props }: React.ComponentProps<"a">) => (
      <a
        href={href}
        className={cn("text-primary underline underline-offset-2 hover:text-primary/90", className)}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),
    img: ({ className, src, alt, ...props }: React.ComponentProps<"img">) => (
      <img
        src={src}
        alt={alt ?? ""}
        className={cn(
          "my-2 h-auto max-h-96 w-full max-w-full rounded-lg border border-border/50 bg-muted/20 object-contain",
          className,
        )}
        loading="lazy"
        {...props}
      />
    ),
    code: ({ className, children, ...props }: React.ComponentProps<"code">) => {
      const isBlock = /language-/.test(className ?? "")
      if (isBlock) {
        return (
          <code className={cn("block w-full whitespace-pre text-xs text-foreground", className)} {...props}>
            {children}
          </code>
        )
      }
      return (
        <code
          className={cn(
            "rounded border border-border/60 bg-muted/60 px-1 py-0.5 font-mono text-[0.9em] text-foreground",
            className,
          )}
          {...props}
        >
          {children}
        </code>
      )
    },
    pre: ({ className, ...props }: React.ComponentProps<"pre">) => (
      <pre
        className={cn(
          "my-2 max-h-48 overflow-x-auto overflow-y-auto rounded-lg border border-border/60 bg-muted/40 p-2 font-mono text-xs text-foreground",
          className,
        )}
        {...props}
      />
    ),
    ul: ({ className, ...props }: React.ComponentProps<"ul">) => (
      <ul className={cn("my-2 list-disc space-y-1 pl-5", bodyTextClassName, className)} {...props} />
    ),
    ol: ({ className, ...props }: React.ComponentProps<"ol">) => (
      <ol className={cn("my-2 list-decimal space-y-1 pl-5", bodyTextClassName, className)} {...props} />
    ),
    li: ({ className, ...props }: React.ComponentProps<"li">) => (
      <li className={cn("leading-relaxed", className)} {...props} />
    ),
    blockquote: ({ className, ...props }: React.ComponentProps<"blockquote">) => (
      <blockquote
        className={cn(
          "my-2 border-l-2 border-primary/35 py-0.5 pl-3 text-muted-foreground italic",
          className,
        )}
        {...props}
      />
    ),
    h1: ({ className, ...props }: React.ComponentProps<"h1">) => (
      <h1 className={cn("mb-1 mt-3 text-base font-semibold first:mt-0", bodyTextClassName, className)} {...props} />
    ),
    h2: ({ className, ...props }: React.ComponentProps<"h2">) => (
      <h2 className={cn("mb-1 mt-2 text-sm font-semibold first:mt-0", bodyTextClassName, className)} {...props} />
    ),
    h3: ({ className, ...props }: React.ComponentProps<"h3">) => (
      <h3 className={cn("mb-1 mt-2 text-sm font-semibold first:mt-0", bodyTextClassName, className)} {...props} />
    ),
    del: ({ className, ...props }: React.ComponentProps<"del">) => (
      <del className={cn("line-through opacity-90", bodyTextClassName, className)} {...props} />
    ),
    table: ({ className, children, ...props }: React.ComponentProps<"table">) => (
      <div className="my-2 max-w-full overflow-x-auto">
        <table
          className={cn(
            "w-full border-collapse border border-border/60 text-sm",
            bodyTextClassName,
            className,
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    thead: ({ className, ...props }: React.ComponentProps<"thead">) => (
      <thead className={cn("bg-muted/40", className)} {...props} />
    ),
    th: ({ className, ...props }: React.ComponentProps<"th">) => (
      <th
        className={cn("border border-border/60 px-2 py-1.5 text-left font-semibold", className)}
        {...props}
      />
    ),
    td: ({ className, ...props }: React.ComponentProps<"td">) => (
      <td className={cn("border border-border/60 px-2 py-1.5 align-top", className)} {...props} />
    ),
  } as const
}

export interface MarkdownContentProps {
  children: string
  className?: string
  /**
   * Optional body copy class (font size, leading, color). When omitted, ``tone`` selects a default.
   */
  textClassName?: string
  /**
   * Visual weight for default body text when ``textClassName`` is not set.
   */
  tone?: "default" | "muted"
}

/**
 * Renders GitHub-flavored-style markdown (bold, lists, links, etc.). Single newlines become line breaks.
 */
export function MarkdownContent({ children, className, textClassName, tone = "default" }: MarkdownContentProps) {
  const bodyClass =
    textClassName ??
    (tone === "muted" ? "text-sm leading-relaxed text-muted-foreground" : defaultMdText)

  const mdComponents = React.useMemo(() => createMarkdownComponents(bodyClass), [bodyClass])

  return (
    <div className={cn("min-w-0 [&>*:first-child]:mt-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
