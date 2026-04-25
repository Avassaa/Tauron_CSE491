"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown, Activity } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Badge } from "~/components/ui/badge"
import { getAssetStats } from "~/lib/mock-data"
import type { AssetResponse } from "~/lib/api-client"

interface AssetTableProps {
  assets: AssetResponse[]
  search: string
  currentPage: number
  pageSize: number
  sortConfig: {
    key: "name" | "symbol" | "category" | "is_active" | "activity"
    direction: "asc" | "desc"
  } | null
  handleSort: (key: "name" | "symbol" | "category" | "is_active" | "activity") => void
  setSelectedAsset: (asset: AssetResponse) => void
}

export function AssetTable({
  assets,
  search,
  currentPage,
  pageSize,
  sortConfig,
  handleSort,
  setSelectedAsset,
}: AssetTableProps) {
  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return null
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="ml-1 size-3" />
    ) : (
      <ChevronDown className="ml-1 size-3" />
    )
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md overflow-hidden shadow-2xl shadow-primary/5">
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/50 bg-muted/20">
              <TableHead className="w-[40px] font-black text-foreground/70 py-4 px-2 uppercase tracking-widest text-[10px] text-center">
                #
              </TableHead>
              <TableHead
                className="font-black text-foreground/70 py-4 px-6 uppercase tracking-widest text-[10px] cursor-pointer hover:text-primary transition-colors flex items-center whitespace-nowrap"
                onClick={() => handleSort("name")}
              >
                Coin <SortIcon column="name" />
              </TableHead>
              <TableHead
                className="hidden md:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] cursor-pointer hover:text-primary transition-colors text-center whitespace-nowrap"
                onClick={() => handleSort("symbol")}
              >
                <div className="flex items-center justify-center">
                  Symbol <SortIcon column="symbol" />
                </div>
              </TableHead>
              <TableHead
                className="hidden sm:table-cell font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] cursor-pointer hover:text-primary transition-colors text-center whitespace-nowrap"
                onClick={() => handleSort("category")}
              >
                <div className="flex items-center justify-center">
                  Category <SortIcon column="category" />
                </div>
              </TableHead>
              <TableHead
                className="font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
                onClick={() => handleSort("is_active")}
              >
                <div className="flex items-center justify-center">
                  Status <SortIcon column="is_active" />
                </div>
              </TableHead>
              <TableHead
                className="font-black text-foreground/70 py-4 uppercase tracking-widest text-[10px] text-center cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
                onClick={() => handleSort("activity")}
              >
                <div className="flex items-center justify-center">
                  Activity <SortIcon column="activity" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset, index) => {
              const stats = getAssetStats(asset.symbol)

              return (
                <TableRow
                  key={asset.id}
                  className="group cursor-pointer border-border/40 transition-all hover:bg-primary/[0.03]"
                  onClick={() => setSelectedAsset(asset)}
                >
                  <TableCell className="py-4 px-2 text-center">
                    <span className="text-[10px] font-black text-muted-foreground/60">
                      {(currentPage - 1) * pageSize + index + 1}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 font-black text-primary ring-1 ring-primary/20 group-hover:scale-110 transition-transform shrink-0">
                        {asset.symbol.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                          {asset.name}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-4 text-center">
                    <Badge variant="secondary" className="font-mono font-bold text-xs bg-muted/50 text-muted-foreground border-none">
                      {asset.symbol}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell py-4 text-center">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                      {asset.category || "General"}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <div className={`size-1.5 rounded-full ${asset.is_active ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/30"}`} />
                      <span className={`text-[10px] font-black uppercase tracking-wider ${asset.is_active ? "text-green-500" : "text-muted-foreground"}`}>
                        {asset.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                      {stats.isUp ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20">
                          <span className="text-[10px] font-black text-green-500 uppercase">Bullish</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20">
                          <span className="text-[10px] font-black text-red-500 uppercase">Bearish</span>
                        </div>
                      )}
                      <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 hidden sm:inline">
                        View Detail →
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
