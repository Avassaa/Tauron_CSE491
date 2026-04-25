"use client"

import * as React from "react"
import { Skeleton } from "~/components/ui/skeleton"

interface WatchlistSkeletonProps {
  viewMode: "grid" | "list"
}

export function WatchlistSkeleton({ viewMode }: WatchlistSkeletonProps) {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 p-5 rounded-3xl border border-border/50 bg-card/30">
            <div className="flex items-center gap-4">
              <Skeleton className="size-12 rounded-2xl bg-muted" />
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton className="h-5 w-2/3 bg-muted" />
                <Skeleton className="h-3 w-1/2 bg-muted" />
              </div>
            </div>
            <div className="flex items-end justify-between mt-4">
              <div className="space-y-2">
                <Skeleton className="h-2 w-16 bg-muted" />
                <Skeleton className="h-4 w-12 bg-muted" />
              </div>
              <Skeleton className="h-4 w-20 bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-border/50 bg-card/30 overflow-hidden">
      <div className="p-4 space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="size-10 rounded-xl bg-muted" />
            <Skeleton className="h-4 flex-1 bg-muted" />
            <Skeleton className="h-4 w-20 bg-muted" />
            <Skeleton className="h-4 w-32 bg-muted" />
            <Skeleton className="h-4 w-24 bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
