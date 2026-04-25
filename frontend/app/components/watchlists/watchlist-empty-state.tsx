"use client"

import * as React from "react"
import { Search, Star, ArrowRight } from "lucide-react"
import { Button } from "~/components/ui/button"

interface WatchlistEmptyStateProps {
  search: string
  onBrowseAssets: () => void
}

export function WatchlistEmptyState({
  search,
  onBrowseAssets,
}: WatchlistEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center rounded-3xl border border-dashed border-border/50 bg-muted/5">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150" />
        <div className="relative size-20 rounded-3xl bg-card border border-border/50 flex items-center justify-center shadow-2xl">
          {search ? (
            <Search className="size-8 text-muted-foreground" />
          ) : (
            <Star className="size-8 text-primary animate-pulse" />
          )}
        </div>
      </div>
      
      <h3 className="text-2xl font-black tracking-tight mb-2">
        {search ? `No results for "${search}"` : "Your watchlist is empty"}
      </h3>
      <p className="text-sm font-bold text-muted-foreground max-w-sm mb-8 leading-relaxed uppercase tracking-widest text-[10px]">
        {search 
          ? "We couldn't find any assets matching your terminal query. Try searching for a different symbol."
          : "Start monitoring terminal assets by adding them to your personal watchlist for real-time neural insights."
        }
      </p>

      {!search && (
        <Button 
          onClick={onBrowseAssets}
          className="h-12 px-8 rounded-2xl gap-2 font-black text-[10px] uppercase tracking-[0.2em] bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-105 transition-all"
        >
          Browse Market Assets
          <ArrowRight className="size-4" />
        </Button>
      )}
    </div>
  )
}
