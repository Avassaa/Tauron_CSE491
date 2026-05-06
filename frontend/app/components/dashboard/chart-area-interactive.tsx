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
import type { KlinePoint } from "~/hooks/use-dashboard-data"
import {
  FALLBACK_BTC_KLINES,
  FALLBACK_ETH_KLINES,
  FALLBACK_SOL_KLINES,
} from "~/lib/dashboard-placeholder-data"

export const description = "BTC vs ETH vs SOL — normalized performance"

// Crypto-brand colors
const BTC_COLOR = "#f7931a"
const ETH_COLOR = "#8b5cf6"
const SOL_COLOR = "#10b981"

const chartConfig = {
  btc: { label: "BTC", color: BTC_COLOR },
  eth: { label: "ETH", color: ETH_COLOR },
  sol: { label: "SOL", color: SOL_COLOR },
} satisfies ChartConfig

interface ChartAreaInteractiveProps {
  btcKlines?: KlinePoint[]
  ethKlines?: KlinePoint[]
  solKlines?: KlinePoint[]
}

function indexTo100(klines: KlinePoint[]): number[] {
  if (klines.length === 0) return []
  const base = klines[0].price
  if (!base || base <= 0) return klines.map(() => 100)
  return klines.map((k) => Math.round((k.price / base) * 10000) / 100)
}

export function ChartAreaInteractive({
  btcKlines,
  ethKlines,
  solKlines,
}: ChartAreaInteractiveProps) {
  const [timeRange, setTimeRange] = React.useState("30d")

  const btc = btcKlines && btcKlines.length > 0 ? btcKlines : FALLBACK_BTC_KLINES
  const eth = ethKlines && ethKlines.length > 0 ? ethKlines : FALLBACK_ETH_KLINES
  const sol = solKlines && solKlines.length > 0 ? solKlines : FALLBACK_SOL_KLINES

  const sliceDays = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30

  const sliceKlines = (k: KlinePoint[]) =>
    k.length > sliceDays ? k.slice(k.length - sliceDays) : k

  const btcSliced = sliceKlines(btc)
  const ethSliced = sliceKlines(eth)
  const solSliced = sliceKlines(sol)

  const btcIdx = indexTo100(btcSliced)
  const ethIdx = indexTo100(ethSliced)
  const solIdx = indexTo100(solSliced)

  const chartData = btcSliced.map((point, i) => ({
    date: point.date,
    btc: btcIdx[i] ?? 100,
    eth: ethIdx[i] ?? 100,
    sol: solIdx[i] ?? 100,
  }))

  const btcFinal = btcIdx[btcIdx.length - 1] ?? 100
  const ethFinal = ethIdx[ethIdx.length - 1] ?? 100
  const solFinal = solIdx[solIdx.length - 1] ?? 100

  const fmtChange = (v: number) => {
    const diff = v - 100
    return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`
  }

  const colorFor = (v: number) => (v >= 100 ? "#10b981" : "#f43f5e")

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitleWithTooltip tooltip="Normalized performance of BTC, ETH, and SOL indexed to 100 at the start of the period. Values above 100 mean the asset gained; below 100 means it lost.">
            Performance Index
          </CardTitleWithTooltip>
          <CardDescription>
            BTC · ETH · SOL — indexed to 100 at period start
            <span className="ml-3 inline-flex gap-3 text-[10px] font-black">
              <span style={{ color: btcFinal >= 100 ? "#10b981" : "#f43f5e" }}>
                BTC {fmtChange(btcFinal)}
              </span>
              <span style={{ color: ethFinal >= 100 ? "#10b981" : "#f43f5e" }}>
                ETH {fmtChange(ethFinal)}
              </span>
              <span style={{ color: solFinal >= 100 ? "#10b981" : "#f43f5e" }}>
                SOL {fmtChange(solFinal)}
              </span>
            </span>
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
              <linearGradient id="fillBtc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BTC_COLOR} stopOpacity={0.35} />
                <stop offset="95%" stopColor={BTC_COLOR} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillEth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ETH_COLOR} stopOpacity={0.30} />
                <stop offset="95%" stopColor={ETH_COLOR} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillSol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SOL_COLOR} stopOpacity={0.28} />
                <stop offset="95%" stopColor={SOL_COLOR} stopOpacity={0.02} />
              </linearGradient>
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
            <Area
              dataKey="sol"
              type="monotone"
              fill="url(#fillSol)"
              stroke={SOL_COLOR}
              strokeWidth={2}
              stackId="none"
            />
            <Area
              dataKey="eth"
              type="monotone"
              fill="url(#fillEth)"
              stroke={ETH_COLOR}
              strokeWidth={2}
              stackId="none"
            />
            <Area
              dataKey="btc"
              type="monotone"
              fill="url(#fillBtc)"
              stroke={BTC_COLOR}
              strokeWidth={2.5}
              stackId="none"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
