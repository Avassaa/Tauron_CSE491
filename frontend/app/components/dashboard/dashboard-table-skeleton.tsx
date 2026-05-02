"use client"

import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"

export function DashboardTableSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-full max-w-md" />
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "rounded-lg overflow-hidden border border-border/40 bg-white/24 backdrop-blur-md dark:bg-background/28",
          )}
        >
          <div className="grid grid-cols-4 gap-2 border-b border-border/40 bg-white/18 dark:bg-muted/12 p-3">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="ml-auto h-4 w-12" />
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="grid grid-cols-4 items-center gap-2 border-b border-border/30 p-3 last:border-0"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="ml-auto h-4 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
