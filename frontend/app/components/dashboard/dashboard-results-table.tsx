"use client"

import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { cn } from "~/lib/utils"
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { CardTitleWithTooltip } from "~/components/dashboard/card-title-with-tooltip"
import { AssetIcon } from "~/components/asset-icon"
import type { DashboardCoin } from "~/hooks/use-dashboard-data"
import { FALLBACK_COINS } from "~/lib/dashboard-placeholder-data"

interface DashboardResultsTableProps {
  coins?: DashboardCoin[]
}

function formatPrice(price: number | null): string {
  if (price === null) return "—"
  if (price >= 1000)
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  if (price >= 1) return `$${price.toFixed(4)}`
  if (price >= 0.0001) return `$${price.toFixed(6)}`
  return `$${price.toExponential(3)}`
}

function formatVolume(vol: number | null): string {
  if (vol === null) return "—"
  if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(2)}B`
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`
  return `$${vol.toLocaleString()}`
}

function MoverTable({
  rows,
  side,
}: {
  rows: DashboardCoin[]
  side: "gain" | "loss"
}) {
  const isGain = side === "gain"
  return (
    <div className="flex flex-col gap-2">
      {/* Sub-header */}
      <div className={cn(
        "flex items-center gap-1.5 px-1",
      )}>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
          isGain
            ? "border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
            : "border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
        )}>
          {isGain ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {isGain ? "Gainers" : "Losers"}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border/50">
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 w-8">#</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Asset</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-right">Price</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-right">24h %</TableHead>
            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hidden lg:table-cell">Volume</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((coin, idx) => {
            const change = coin.price_change_24h ?? 0
            const isUp = change >= 0
            return (
              <TableRow
                key={`${coin.symbol}-${idx}`}
                className="border-border/40 hover:bg-primary/[0.02] transition-colors"
              >
                <TableCell className="text-muted-foreground font-mono text-xs w-8">
                  {coin.rank <= 999 ? coin.rank : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="size-7 shrink-0 overflow-hidden rounded-full">
                      <AssetIcon symbol={coin.symbol} alt={coin.symbol} fallbackClassName="text-[8px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-sm tracking-tight truncate">{coin.symbol}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[80px]">{coin.name}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-bold tabular-nums">
                  {formatPrice(coin.price)}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 tabular-nums font-black text-sm",
                      isUp
                        ? "text-green-500 dark:text-green-400"
                        : "text-red-500 dark:text-red-400"
                    )}
                  >
                    {isUp
                      ? <ArrowUpRight className="size-3 shrink-0" />
                      : <ArrowDownRight className="size-3 shrink-0" />}
                    {isUp ? "+" : ""}{change.toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground font-mono text-xs hidden lg:table-cell">
                  {formatVolume(coin.volume)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function DashboardResultsTable({ coins }: DashboardResultsTableProps) {
  const source = coins && coins.length > 0 ? coins : FALLBACK_COINS
  const withChange = source.filter((c) => c.price_change_24h != null)

  const gainers = [...withChange]
    .sort((a, b) => (b.price_change_24h ?? 0) - (a.price_change_24h ?? 0))
    .slice(0, 5)

  const losers = [...withChange]
    .sort((a, b) => (a.price_change_24h ?? 0) - (b.price_change_24h ?? 0))
    .slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitleWithTooltip
          className="text-base font-black tracking-tight"
          infoLabel="About this table"
          tooltip="Top 5 gainers and top 5 losers by 24-hour price change from the current live market snapshot."
        >
          Top Movers
        </CardTitleWithTooltip>
        <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          24h gainers &amp; losers · live market data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:divide-x xl:divide-border/40 xl:gap-0">
          <MoverTable rows={gainers} side="gain" />
          <div className="xl:pl-6">
            <MoverTable rows={losers} side="loss" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
