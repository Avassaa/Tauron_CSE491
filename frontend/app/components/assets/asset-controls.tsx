"use client"

import { Search, RefreshCw, X } from "lucide-react"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"

interface AssetControlsProps {
  search: string
  setSearch: (value: string) => void
  loading: boolean
  fetchAssets: () => void
  sortConfig: {
    key: "name" | "symbol" | "category" | "is_active" | "activity"
    direction: "asc" | "desc"
  } | null
  setSortConfig: (config: any) => void
}

export function AssetControls({
  search,
  setSearch,
  loading,
  fetchAssets,
  sortConfig,
  setSortConfig,
}: AssetControlsProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, symbol or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 pl-11 pr-4 rounded-2xl border-border/50 bg-card/50 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary transition-all font-medium"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={fetchAssets}
          disabled={loading}
          className="h-12 px-6 rounded-2xl gap-2 border-border/50 bg-card/50 hover:bg-card hover:text-primary transition-all font-bold uppercase tracking-wider text-[10px]"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        {sortConfig && (
          <Button
            variant="ghost"
            onClick={() => setSortConfig(null)}
            className="h-12 px-4 rounded-2xl gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 font-bold uppercase tracking-wider text-[10px]"
          >
            <X className="size-3.5" />
            Clear Sort
          </Button>
        )}
      </div>
    </div>
  )
}
