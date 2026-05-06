"use client"

import { Search, RefreshCw, X, ChevronDown, Check, SlidersHorizontal } from "lucide-react"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { type CurrencyCode, CURRENCIES } from "~/lib/currency"

interface AssetControlsProps {
  search: string
  setSearch: (value: string) => void
  loading: boolean
  fetchAssets: () => void
  sortConfig: {
    key: string
    direction: "asc" | "desc"
  } | null
  setSortConfig: (config: any) => void
  quoteCurrency: CurrencyCode
  setQuoteCurrency: (currency: CurrencyCode) => void
}

const MARKET_SORT_OPTIONS = [
  { label: "Most popular", description: "Lowest market rank first", key: "rank", direction: "asc" as const },
  { label: "Volume", description: "Highest trading volume first", key: "volume", direction: "desc" as const },
  { label: "Top gainers 24h", description: "Best 24h performance", key: "change24h", direction: "desc" as const },
  { label: "Top losers 24h", description: "Worst 24h performance", key: "change24h", direction: "asc" as const },
  { label: "Price high to low", description: "Highest price first", key: "price", direction: "desc" as const },
  { label: "Name A-Z", description: "Alphabetical order", key: "name", direction: "asc" as const },
]

export function AssetControls({
  search,
  setSearch,
  loading,
  fetchAssets,
  sortConfig,
  setSortConfig,
  quoteCurrency,
  setQuoteCurrency,
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
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 md:h-12 rounded-xl md:rounded-2xl px-2 md:px-3 text-[9px] md:text-[10px] font-black uppercase tracking-wider">
              <SlidersHorizontal className="mr-1 size-3 md:size-3.5" />
              Filter
              <ChevronDown className="ml-1 size-2.5 md:size-3 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {MARKET_SORT_OPTIONS.map((option) => {
              const active =
                sortConfig?.key === option.key && sortConfig.direction === option.direction
              return (
                <DropdownMenuItem
                  key={`${option.key}-${option.direction}`}
                  onSelect={() => setSortConfig({ key: option.key, direction: option.direction })}
                  className="flex cursor-pointer items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold">{option.label}</div>
                    <div className="text-[10px] text-muted-foreground">{option.description}</div>
                  </div>
                  {active ? <Check className="size-3 text-primary" /> : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 md:h-12 rounded-xl md:rounded-2xl px-2 md:px-3 text-[9px] md:text-[10px] font-black uppercase tracking-wider">
              {quoteCurrency}
              <ChevronDown className="ml-1 size-2.5 md:size-3 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[110px]">
            {CURRENCIES.map((currency) => (
              <DropdownMenuItem
                key={currency}
                onSelect={() => setQuoteCurrency(currency)}
                className="flex cursor-pointer items-center justify-between text-[10px] font-bold uppercase"
              >
                {currency}
                {currency === quoteCurrency ? <Check className="size-3 text-primary" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          onClick={fetchAssets}
          disabled={loading}
          className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl border-border/50 bg-card/50 hover:bg-card hover:text-primary transition-all"
        >
          <RefreshCw className={`size-3 md:size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>

        {sortConfig && (
          <Button
            variant="ghost"
            onClick={() => setSortConfig(null)}
            className="h-10 md:h-12 px-3 md:px-4 rounded-xl md:rounded-2xl gap-1.5 md:gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 font-bold uppercase tracking-wider text-[9px] md:text-[10px]"
          >
            <X className="size-3 md:size-3.5" />
            <span className="hidden sm:inline">Clear Sort</span>
            <span className="sm:hidden">Clear</span>
          </Button>
        )}
      </div>
    </div>
  )
}
