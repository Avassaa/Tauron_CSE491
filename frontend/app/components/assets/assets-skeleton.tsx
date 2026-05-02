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
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/50 bg-muted/45">
              <TableHead className="w-[32px] px-1 text-center"></TableHead>
              <TableHead className="w-[32px] font-black text-foreground/70 py-4 px-1 uppercase tracking-widest text-[9px] text-center">
                #
              </TableHead>
              <TableHead className="min-w-[180px] font-black text-foreground/70 py-4 px-6 uppercase tracking-widest text-[9px]">
                Coin
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-right">
                Price
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-center">
                1h
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-center">
                24h
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-center">
                7d
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-4 uppercase tracking-widest text-[9px] text-right">
                24h Volume
              </TableHead>
              <TableHead className="font-black text-foreground/70 py-4 px-6 uppercase tracking-widest text-[9px] text-center">
                Last 7 Days
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i} className="border-border/40">
                <TableCell className="py-4 px-0 w-[40px] text-center">
                  <div className="flex items-center justify-center">
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                </TableCell>
                <TableCell className="py-4 px-1 text-center">
                  <Skeleton className="h-3 w-4 mx-auto" />
                </TableCell>
                <TableCell className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-4 px-4">
                  <div className="flex justify-end">
                    <Skeleton className="h-4 w-16" />
                  </div>
                </TableCell>
                <TableCell className="py-4 px-4">
                  <div className="flex justify-center">
                    <Skeleton className="h-4 w-12" />
                  </div>
                </TableCell>
                <TableCell className="py-4 px-4">
                  <div className="flex justify-center">
                    <Skeleton className="h-4 w-12" />
                  </div>
                </TableCell>
                <TableCell className="py-4 px-4">
                  <div className="flex justify-center">
                    <Skeleton className="h-4 w-12" />
                  </div>
                </TableCell>
                <TableCell className="py-4 px-4">
                  <div className="flex justify-end">
                    <Skeleton className="h-4 w-20" />
                  </div>
                </TableCell>
                <TableCell className="py-4 px-6">
                  <div className="flex justify-center">
                    <Skeleton className="h-8 w-24 rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
