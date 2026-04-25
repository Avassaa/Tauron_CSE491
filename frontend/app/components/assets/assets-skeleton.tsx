"use client"

import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"

export function AssetsSkeleton() {
  return (
    <div className="rounded-2xl border bg-card/50 overflow-hidden backdrop-blur-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b bg-muted/20">
            <TableHead className="py-4 px-6">Coin</TableHead>
            <TableHead className="py-4 text-center">Symbol</TableHead>
            <TableHead className="py-4 text-center">Category</TableHead>
            <TableHead className="py-4 text-center">Status</TableHead>
            <TableHead className="py-4 text-center">Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i} className="border-border/40">
              <TableCell className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-4">
                <div className="flex justify-center">
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              </TableCell>
              <TableCell className="py-4">
                <div className="flex justify-center">
                  <Skeleton className="h-4 w-20" />
                </div>
              </TableCell>
              <TableCell className="py-4">
                <div className="flex justify-center items-center gap-1.5">
                  <Skeleton className="h-1.5 w-1.5 rounded-full" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </TableCell>
              <TableCell className="py-4">
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
