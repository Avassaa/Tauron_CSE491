"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

interface AssetPaginationProps {
  page: number
  totalPages: number
  setPage: (page: number) => void
  loading: boolean
  className?: string
}

export function AssetPagination({
  page,
  totalPages,
  setPage,
  loading,
  className,
}: AssetPaginationProps) {
  if (totalPages <= 1) return null

  const renderPageButtons = () => {
    const buttons = []
    const maxVisible = 5

    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    if (start > 1) {
      buttons.push(
        <Button
          key={1}
          variant="ghost"
          size="sm"
          onClick={() => setPage(1)}
          className="size-9 rounded-xl font-black text-[10px]"
        >
          1
        </Button>
      )
      if (start > 2) {
        buttons.push(
          <div key="ellipsis-start" className="flex size-9 items-center justify-center text-muted-foreground">
            <MoreHorizontal className="size-3.5" />
          </div>
        )
      }
    }

    for (let i = start; i <= end; i++) {
      buttons.push(
        <Button
          key={i}
          variant={page === i ? "default" : "ghost"}
          size="sm"
          onClick={() => setPage(i)}
          className={cn(
            "size-9 rounded-xl font-black text-[10px] transition-all",
            page === i
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {i}
        </Button>
      )
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        buttons.push(
          <div key="ellipsis-end" className="flex size-9 items-center justify-center text-muted-foreground">
            <MoreHorizontal className="size-3.5" />
          </div>
        )
      }
      buttons.push(
        <Button
          key={totalPages}
          variant="ghost"
          size="sm"
          onClick={() => setPage(totalPages)}
          className="size-9 rounded-xl font-black text-[10px]"
        >
          {totalPages}
        </Button>
      )
    }

    return buttons
  }

  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage(page - 1)}
        disabled={page === 1 || loading}
        className="h-9 px-4 rounded-xl border-border/50 bg-card/30 hover:bg-card hover:text-primary disabled:opacity-30 transition-all font-black text-[10px] uppercase tracking-wider gap-2"
      >
        <ChevronLeft className="size-3.5" />
        Prev
      </Button>

      <div className="flex items-center gap-1">
        {renderPageButtons()}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage(page + 1)}
        disabled={page === totalPages || loading}
        className="h-9 px-4 rounded-xl border-border/50 bg-card/30 hover:bg-card hover:text-primary disabled:opacity-30 transition-all font-black text-[10px] uppercase tracking-wider gap-2"
      >
        Next
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  )
}
