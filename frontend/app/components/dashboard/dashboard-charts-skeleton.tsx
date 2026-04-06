"use client"

import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

export function DashboardChartsSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </CardHeader>
        <CardContent>
          <Skeleton className="min-h-[280px] w-full rounded-md" />
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-full max-w-[10rem]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="min-h-[220px] w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent>
          <Skeleton className="min-h-[260px] w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  )
}
