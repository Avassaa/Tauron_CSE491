"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { CardTitleWithTooltip } from "~/components/dashboard/card-title-with-tooltip"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "~/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { type DashboardCoin, type KlinePoint, fetchBinanceKlines } from "~/hooks/use-dashboard-data"

const PALETTE = ["#f7931a", "#8b5cf6", "#10b981"]

function parseKlines(raw: unknown[]): KlinePoint[] {
  return (raw as unknown[][])
    .map((k) => ({
      date: new Date(k[0] as number).toISOString().slice(0, 10),
      price: Number.parseFloat(String(k[4] ?? "")),
    }))
    .filter((p) => Number.isFinite(p.price))
}

function indexTo100(klines: KlinePoint[]): number[] {
  if (klines.length === 0) return []
  const base = klines[0].price
  if (!base || base <= 0) return klines.map(() => 100)
  return klines.map((k) => Math.round((k.price / base) * 10000) / 100)
}

interface ChartAreaInteractiveProps {
  coins: DashboardCoin[]
}

export function ChartAreaInteractive({ coins }: ChartAreaInteractiveProps) {
  const [timeRange, setTimeRange] = React.useState("30d")
  const [klineMap, setKlineMap] = React.useState<Record<string, KlinePoint[]>>({})
  const [fetchedFor, setFetchedFor] = React.useState<string>("")

  const top3 = React.useMemo(
    () =>
      [...coins]
        .filter((c) => c.price_change_24h != null)
        .sort((a, b) => (b.price_change_24h ?? 0) - (a.price_change_24h ?? 0))
        .slice(0, 3),
    [coins],
  )

  const symbolKey = top3.map((c) => c.symbol).join(",")

  React.useEffect(() => {
    if (!symbolKey || symbolKey === fetchedFor || top3.length === 0) return
    let cancelled = false
    void (async () => {
      const results = await Promise.allSettled(
        top3.map((c) => fetchBinanceKlines(`${c.symbol}USDT`, "1d", 30)),
      )
      if (cancelled) return
      const map: Record<string, KlinePoint[]> = {}
      results.forEach((r, i) => {
        if (r.status === "fulfilled") map[top3[i].symbol] = parseKlines(r.value)
      })
      setKlineMap(map)
      setFetchedFor(symbolKey)
    })()
    return () => { cancelled = true }
  }, [symbolKey, fetchedFor, top3])

  const sliceDays = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30

  const chartConfig = React.useMemo(
    () =>
      Object.fromEntries(
        top3.map((c, i) => [c.symbol.toLowerCase(), { label: c.symbol, color: PALETTE[i] }]),
      ) as ChartConfig,
    [top3],
  )

  const chartData = React.useMemo(() => {
    if (top3.length === 0) return []
    const firstKlines = klineMap[top3[0].symbol] ?? []
    const sliced0 = firstKlines.length > sliceDays ? firstKlines.slice(-sliceDays) : firstKlines
    if (sliced0.length === 0) return []

    return sliced0.map((point, i) =>
      Object.fromEntries([
        ["date", point.date],
        ...top3.map((c) => {
          const klines = klineMap[c.symbol] ?? []
          const sliced = klines.length > sliceDays ? klines.slice(-sliceDays) : klines
          const indexed = indexTo100(sliced)
          return [c.symbol.toLowerCase(), indexed[i] ?? 100]
        }),
      ]),
    )
  }, [top3, klineMap, sliceDays])

  const finalValues = React.useMemo(
    () =>
      Object.fromEntries(
        top3.map((c) => {
          const klines = klineMap[c.symbol] ?? []
          const sliced = klines.length > sliceDays ? klines.slice(-sliceDays) : klines
          const indexed = indexTo100(sliced)
          return [c.symbol, indexed[indexed.length - 1] ?? 100]
        }),
      ),
    [top3, klineMap, sliceDays],
  )

  const fmtChange = (v: number) => {
    const diff = v - 100
    return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`
  }

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitleWithTooltip tooltip="Normalized performance of today's top 3 gainers indexed to 100 at the start of the period. Values above 100 mean the asset gained relative to period start.">
            Top Gainers Performance
          </CardTitleWithTooltip>
          <CardDescription>
            {top3.length > 0
              ? top3.map((c) => c.symbol).join(" · ")
              : "Loading…"} — indexed to 100 at period start
            {top3.length > 0 && Object.keys(finalValues).length > 0 && (
              <span className="ml-3 inline-flex gap-3 text-[10px] font-black">
                {top3.map((c, i) => (
                  <span key={c.symbol} style={{ color: (finalValues[c.symbol] ?? 100) >= 100 ? "#10b981" : "#f43f5e" }}>
                    {c.symbol} {fmtChange(finalValues[c.symbol] ?? 100)}
                  </span>
                ))}
              </span>
            )}
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="hidden w-[140px] rounded-lg sm:ml-auto sm:flex"
            aria-label="Select time range"
          >
            <SelectValue placeholder="Last 30 days" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="7d" className="rounded-lg">Last 7 days</SelectItem>
            <SelectItem value="14d" className="rounded-lg">Last 14 days</SelectItem>
            <SelectItem value="30d" className="rounded-lg">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto min-h-[260px] h-[260px] w-full"
        >
          <AreaChart data={chartData}>
            <defs>
              {top3.map((c, i) => (
                <linearGradient key={c.symbol} id={`fill_${c.symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE[i]} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={PALETTE[i]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) =>
                new Date(value as string).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={38}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${v}`}
              domain={["auto", "auto"]}
            />
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value as string).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  formatter={(value, name) => [
                    `${Number(value).toFixed(2)} (${Number(value) >= 100 ? "+" : ""}${(Number(value) - 100).toFixed(2)}%)`,
                    String(name).toUpperCase(),
                  ]}
                  indicator="dot"
                />
              }
            />
            {top3.map((c, i) => (
              <Area
                key={c.symbol}
                dataKey={c.symbol.toLowerCase()}
                type="monotone"
                fill={`url(#fill_${c.symbol})`}
                stroke={PALETTE[i]}
                strokeWidth={i === 0 ? 2.5 : 2}
                stackId="none"
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
