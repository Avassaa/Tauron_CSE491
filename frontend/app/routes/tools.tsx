"use client"

import * as React from "react"
import { ArrowRightLeft } from "lucide-react"

import { AppSidebar } from "~/components/dashboard/app-sidebar"
import { MarketMarqueeBanner } from "~/components/market-marquee-banner"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"

type CurrencyCode = "USD" | "EUR" | "TRY" | "GBP" | "JPY" | "CAD" | "AUD" | "CHF"

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  TRY: "Turkish Lira",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  CHF: "Swiss Franc",
}

const FALLBACK_USD_BASE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.93,
  TRY: 38.65,
  GBP: 0.8,
  JPY: 154.2,
  CAD: 1.37,
  AUD: 1.52,
  CHF: 0.91,
}

const CURRENCIES = Object.keys(CURRENCY_LABELS) as CurrencyCode[]
const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price"

function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<CurrencyCode, number>
): number {
  if (!Number.isFinite(amount)) return 0
  const amountInUsd = amount / rates[from]
  return amountInUsd * rates[to]
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function getUsdtPerCurrency(
  currency: CurrencyCode,
  tickerBySymbol: Record<string, string>
): number | null {
  if (currency === "USD") return 1

  const direct = toNumber(tickerBySymbol[`${currency}USDT`])
  if (direct && direct > 0) return direct

  const inverse = toNumber(tickerBySymbol[`USDT${currency}`])
  if (inverse && inverse > 0) return 1 / inverse

  return null
}

function buildUsdBaseRatesFromBinance(
  tickerBySymbol: Record<string, string>
): Record<CurrencyCode, number> {
  const next = { ...FALLBACK_USD_BASE_RATES }
  for (const currency of CURRENCIES) {
    const usdtPerCurrency = getUsdtPerCurrency(currency, tickerBySymbol)
    if (usdtPerCurrency == null || usdtPerCurrency <= 0) continue
    // Approximate USD with USDT for converter use.
    next[currency] = 1 / usdtPerCurrency
  }
  next.USD = 1
  return next
}

export default function ToolsPage() {
  const [amount, setAmount] = React.useState("1")
  const [fromCurrency, setFromCurrency] = React.useState<CurrencyCode>("USD")
  const [toCurrency, setToCurrency] = React.useState<CurrencyCode>("TRY")
  const [usdBaseRates, setUsdBaseRates] = React.useState<Record<CurrencyCode, number>>(
    FALLBACK_USD_BASE_RATES
  )
  const [ratesStatus, setRatesStatus] = React.useState<"loading" | "live" | "fallback">("loading")
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<Date | null>(null)

  const numericAmount = Number.parseFloat(amount)
  const converted = convertAmount(numericAmount, fromCurrency, toCurrency, usdBaseRates)

  const formattedResult = Number.isFinite(converted)
    ? converted.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })
    : "0.00"

  const switchCurrencies = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  React.useEffect(() => {
    let cancelled = false

    const refreshRates = async () => {
      try {
        const response = await fetch(BINANCE_TICKER_URL)
        if (!response.ok) throw new Error("Failed to fetch Binance tickers")

        const rows = (await response.json()) as Array<{ symbol?: string; price?: string }>
        const tickerBySymbol: Record<string, string> = {}
        for (const row of rows) {
          if (!row.symbol || !row.price) continue
          tickerBySymbol[row.symbol.toUpperCase()] = row.price
        }

        const liveRates = buildUsdBaseRatesFromBinance(tickerBySymbol)
        if (cancelled) return
        setUsdBaseRates(liveRates)
        setRatesStatus("live")
        setLastUpdatedAt(new Date())
      } catch {
        if (cancelled) return
        setUsdBaseRates(FALLBACK_USD_BASE_RATES)
        setRatesStatus("fallback")
      }
    }

    void refreshRates()
    const intervalId = window.setInterval(() => {
      void refreshRates()
    }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <MarketMarqueeBanner />
      <SidebarInset
        style={{
          paddingTop: "var(--market-banner-offset, 0px)",
        }}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="font-medium">Tools</span>
        </header>
        <div className="flex min-h-[calc(100svh-3.5rem)] flex-1 overflow-auto p-4">
          <div className="grid w-full gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-1">
              <button
                type="button"
                className="w-full rounded-md bg-muted px-3 py-2 text-left text-sm text-foreground"
              >
                Currency Converter
              </button>
            </aside>
            <section className="space-y-5">
              <div className="rounded-xl border">
                <div className="border-b px-5 py-4">
                  <div className="text-xl font-semibold">Currency Converter</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Convert from selected currency to another using dropdowns.
                  </p>
                </div>
                <div className="space-y-4 px-5 py-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_1fr] md:items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="amount">
                        Amount
                      </label>
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        step="any"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="Enter amount"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">From</label>
                      <Select
                        value={fromCurrency}
                        onValueChange={(value) => setFromCurrency(value as CurrencyCode)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select source currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency} - {CURRENCY_LABELS[currency]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-center md:pb-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={switchCurrencies}
                        aria-label="Switch currencies"
                      >
                        <ArrowRightLeft className="size-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">To</label>
                      <Select
                        value={toCurrency}
                        onValueChange={(value) => setToCurrency(value as CurrencyCode)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select target currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency} - {CURRENCY_LABELS[currency]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Converted Amount</p>
                    <p className="mt-1 text-3xl font-semibold">
                      {formattedResult} {toCurrency}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {ratesStatus === "live"
                        ? `Rate basis: live Binance ticker data${lastUpdatedAt ? ` (updated ${lastUpdatedAt.toLocaleTimeString()})` : ""}.`
                        : ratesStatus === "loading"
                          ? "Rate basis: loading Binance data..."
                          : "Rate basis: Binance unavailable, using fallback rates."}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
