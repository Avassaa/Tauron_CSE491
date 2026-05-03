"use client"

import * as React from "react"
import { Layers, Star } from "lucide-react"

import { cn } from "~/lib/utils"

export type WatchlistAssetChip = {
  id: string
  symbol: string
  name: string
}

export type NamedWatchlistBlock = {
  list_id: string
  name: string
  assets: WatchlistAssetChip[]
}

export function AssistantWatchlistsOverview({
  primary_watchlist,
  named_lists,
  className,
}: {
  primary_watchlist: WatchlistAssetChip[]
  named_lists: NamedWatchlistBlock[]
  className?: string
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-violet-500/20 bg-gradient-to-b from-violet-500/[0.08] via-transparent to-cyan-500/[0.06] p-3 shadow-[0_0_32px_-12px_rgba(139,92,246,0.45)] dark:border-violet-400/15",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        <Layers className="size-4 text-violet-400" aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground">Your watchlists</span>
      </div>

      <section className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <Star className="size-3.5 shrink-0 text-amber-400" aria-hidden />
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Primary</h4>
        </div>
        {primary_watchlist.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No assets on your primary watchlist yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {primary_watchlist.map((a) => (
              <li
                key={a.id}
                className="rounded-full border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur-sm"
              >
                <span className="font-mono">{a.symbol}</span>
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">{a.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {named_lists.length > 0 ? (
        <section className="mt-4 space-y-3 border-t border-border/35 pt-3">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Named lists</h4>
          <ul className="space-y-3">
            {named_lists.map((list) => (
              <li
                key={list.list_id}
                className="rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 shadow-inner backdrop-blur-sm dark:bg-black/20"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-foreground">{list.name}</span>
                  <span className="font-mono text-[9px] text-muted-foreground/80">{list.list_id.slice(0, 8)}…</span>
                </div>
                {list.assets.length === 0 ? (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Empty list.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {list.assets.map((a) => (
                      <li
                        key={`${list.list_id}-${a.id}`}
                        className="rounded-md border border-primary/20 bg-primary/[0.06] px-2 py-1 text-[11px] font-medium text-foreground"
                      >
                        <span className="font-mono">{a.symbol}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-3 border-t border-border/35 pt-3 text-[11px] text-muted-foreground">No named watchlists yet.</p>
      )}
    </div>
  )
}
