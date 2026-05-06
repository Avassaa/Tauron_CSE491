"use client"

import { TrendingDown, TrendingUp } from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts"

import { CardTitleWithTooltip } from "~/components/dashboard/card-title-with-tooltip"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import type { DashboardCoin, KlinePoint } from "~/hooks/use-dashboard-data"
import {
  COIN_CATEGORIES,
  FALLBACK_BTC_KLINES,
  FALLBACK_COINS,
  FALLBACK_ETH_KLINES,
  FALLBACK_SOL_KLINES,
} from "~/lib/dashboard-placeholder-data"

export {
  ChartAreaInteractive,
  description as chartAreaInteractiveDescription,
} from "./chart-area-interactive"

// Crypto-brand colors (consistent across all charts)
const BTC_COLOR = "#f7931a"
const ETH_COLOR = "#8b5cf6"
const SOL_COLOR = "#10b981"
const GAIN_COLOR = "#22c55e"
const LOSS_COLOR = "#f43f5e"

// ─── Volume Leaders (Bar Chart) ───────────────────────────────────────────────

const volumeConfig = {
  volume: { label: "Volume (B)", color: GAIN_COLOR },
} satisfies ChartConfig

interface ChartBarDefaultProps {
  coins?: DashboardCoin[]
}

export function ChartBarDefault({ coins }: ChartBarDefaultProps) {
  const source = coins && coins.length > 0 ? coins : FALLBACK_COINS
  const top8 = [...source]
    .filter((c) => c.volume != null && c.volume > 0)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 8)

  const data = top8.map((c) => ({
    symbol: c.symbol,
    volume: Math.round(((c.volume ?? 0) / 1_000_000_000) * 100) / 100,
    isUp: (c.price_change_24h ?? 0) >= 0,
  }))

  const totalVol = top8.reduce((s, c) => s + (c.volume ?? 0), 0)
  const totalB = (totalVol / 1_000_000_000).toFixed(1)

  return (
    <Card>
      <CardHeader>
        <CardTitleWithTooltip tooltip="Top 8 cryptocurrencies ranked by 24-hour trading volume. Green = positive 24h change, red = negative.">
          Volume Leaders
        </CardTitleWithTooltip>
        <CardDescription>24h trading volume · top 8</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={volumeConfig} className="min-h-[220px] h-[220px] w-full">
          <BarChart accessibilityLayer data={data} margin={{ bottom: 4 }}>
            <defs>
              <linearGradient id="barGain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GAIN_COLOR} stopOpacity={0.95} />
                <stop offset="100%" stopColor={GAIN_COLOR} stopOpacity={0.45} />
              </linearGradient>
              <linearGradient id="barLoss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LOSS_COLOR} stopOpacity={0.95} />
                <stop offset="100%" stopColor={LOSS_COLOR} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="symbol"
              tickLine={false}
              tickMargin={8}
              axisLine={false}
              tick={{ fontSize: 10, fontWeight: 700 }}
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted)/0.4)", radius: 6 }}
              content={
                <ChartTooltipContent
                  formatter={(value) => [`$${Number(value).toFixed(2)}B`, "Volume"]}
                  hideLabel
                />
              }
            />
            <Bar dataKey="volume" radius={[6, 6, 2, 2]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isUp ? "url(#barGain)" : "url(#barLoss)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 text-sm">
        <div className="flex gap-2 leading-none font-bold text-foreground">
          ${totalB}B combined 24h volume
        </div>
        <div className="flex items-center gap-3 leading-none text-xs">
          <span className="flex items-center gap-1" style={{ color: GAIN_COLOR }}>
            <span className="inline-block size-2 rounded-sm" style={{ background: GAIN_COLOR }} />
            Positive 24h
          </span>
          <span className="flex items-center gap-1" style={{ color: LOSS_COLOR }}>
            <span className="inline-block size-2 rounded-sm" style={{ background: LOSS_COLOR }} />
            Negative 24h
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

// ─── Bitcoin 30D Price (Area Chart) ───────────────────────────────────────────

const btcLineConfig = {
  price: { label: "BTC Price", color: BTC_COLOR },
} satisfies ChartConfig

interface ChartLineDefaultProps {
  btcKlines?: KlinePoint[]
  coins?: DashboardCoin[]
}

export function ChartLineDefault({ btcKlines, coins }: ChartLineDefaultProps) {
  const klines = btcKlines && btcKlines.length > 0 ? btcKlines : FALLBACK_BTC_KLINES
  const data = klines.map((k) => ({ date: k.date, price: k.price }))

  const first = data[0]?.price ?? 0
  const last = data[data.length - 1]?.price ?? 0
  const pct = first > 0 ? ((last - first) / first) * 100 : 0
  const isUp = pct >= 0

  const btcCoin = coins?.find((c) => c.symbol === "BTC")
  const livePrice = btcCoin?.price

  return (
    <Card>
      <CardHeader>
        <CardTitleWithTooltip tooltip="Bitcoin closing price over the last 30 days, sourced from Binance daily klines.">
          Bitcoin Price
        </CardTitleWithTooltip>
        <CardDescription>
          30-day daily close · BTC/USDT
          {livePrice && (
            <span className="ml-2 font-black" style={{ color: BTC_COLOR }}>
              ${livePrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={btcLineConfig} className="min-h-[220px] h-[220px] w-full">
          <AreaChart data={data} margin={{ left: 4, right: 4 }}>
            <defs>
              <linearGradient id="fillBtcPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BTC_COLOR} stopOpacity={0.35} />
                <stop offset="95%" stopColor={BTC_COLOR} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) =>
                new Date(v as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={50}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`}
              domain={["auto", "auto"]}
            />
            <ChartTooltip
              cursor={{ stroke: BTC_COLOR, strokeWidth: 1, strokeDasharray: "4 2" }}
              content={
                <ChartTooltipContent
                  formatter={(value) => [
                    `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                    "BTC",
                  ]}
                  labelFormatter={(v) =>
                    new Date(v as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  hideLabel={false}
                />
              }
            />
            <Area
              dataKey="price"
              type="monotone"
              stroke={BTC_COLOR}
              fill="url(#fillBtcPrice)"
              strokeWidth={2.5}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 text-sm">
        <div className={`flex gap-2 leading-none font-bold ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
          {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {isUp ? "+" : ""}{pct.toFixed(2)}% over 30 days
        </div>
        <div className="leading-none text-muted-foreground text-xs">
          Binance daily klines · BTC/USDT
        </div>
      </CardFooter>
    </Card>
  )
}

// ─── Market Distribution by Category (Pie Chart) ─────────────────────────────

const PIE_COLORS = [
  "#f7931a", // BTC orange → Currency
  "#8b5cf6", // ETH purple → Smart Contract
  "#10b981", // Emerald → DeFi
  "#3b82f6", // Blue → Exchange / Scaling
  "#f43f5e", // Rose → Meme
  "#f59e0b", // Amber → Other
]

const pieConfig: ChartConfig = {
  marketcap: { label: "Market Cap" },
  "Currency": { label: "Currency", color: PIE_COLORS[0] },
  "Smart Contract": { label: "Smart Contract", color: PIE_COLORS[1] },
  "DeFi": { label: "DeFi", color: PIE_COLORS[2] },
  "Scaling": { label: "Scaling", color: PIE_COLORS[3] },
  "Meme": { label: "Meme", color: PIE_COLORS[4] },
  "Other": { label: "Other", color: PIE_COLORS[5] },
}

interface ChartPieSimpleProps {
  coins?: DashboardCoin[]
}

export function ChartPieSimple({ coins }: ChartPieSimpleProps) {
  // Use live coins if they have volume data, otherwise fallback
  const hasLiveVolume = coins && coins.length > 0 && coins.some((c) => (c.volume ?? 0) > 0)
  const source = hasLiveVolume ? coins! : FALLBACK_COINS

  const catMap: Record<string, number> = {}
  for (const coin of source.slice(0, 50)) {
    const cat = COIN_CATEGORIES[coin.symbol] ?? "Other"
    const simpleCat =
      cat === "Oracle / DeFi" ? "DeFi" :
      cat === "AI / Infra" ? "Other" :
      cat === "Gaming / NFT" ? "Other" :
      cat === "Enterprise" ? "Other" :
      cat === "Media" ? "Other" :
      cat === "Interoperability" ? "Smart Contract" :
      cat === "Modular" ? "Smart Contract" :
      cat === "Storage" ? "Other" :
      cat === "Privacy" ? "Currency" :
      cat

    const vol = coin.volume ?? 0
    catMap[simpleCat] = (catMap[simpleCat] ?? 0) + vol
  }

  const sortedCats = Object.entries(catMap)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const data = sortedCats.map(([category, value], i) => ({
    category,
    value: Math.round(value / 1_000_000_000),
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const totalVol = sortedCats.reduce((s, [, v]) => s + v, 0)
  const totalB = (totalVol / 1_000_000_000).toFixed(1)

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">
        <CardTitleWithTooltip tooltip="24h trading volume split by sector across the top 50 coins by volume.">
          Volume by Category
        </CardTitleWithTooltip>
        <CardDescription>Top coins · 24h volume by sector</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={pieConfig}
          className="mx-auto aspect-square h-[220px] min-h-[220px] w-full max-w-[220px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => [`$${Number(value).toFixed(0)}B`, String(name)]}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="category"
              innerRadius={45}
              outerRadius={90}
              strokeWidth={2}
              stroke="hsl(var(--card))"
            >
              {data.map((entry, index) => (
                <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-1.5 text-sm">
        <div className="flex items-center gap-2 leading-none font-bold text-foreground">
          ${totalB}B combined 24h volume
        </div>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 leading-none text-[10px] text-muted-foreground">
          {data.map((d, i) => (
            <span key={d.category} className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              {d.category}
            </span>
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}

// ─── Sector Performance Radar (BTC vs ETH vs SOL) ────────────────────────────

const radarConfig = {
  btc: { label: "BTC", color: BTC_COLOR },
  eth: { label: "ETH", color: ETH_COLOR },
  sol: { label: "SOL", color: SOL_COLOR },
} satisfies ChartConfig

interface ChartRadarLinesOnlyProps {
  coins?: DashboardCoin[]
}

export function ChartRadarLinesOnly({ coins }: ChartRadarLinesOnlyProps) {
  const source = coins && coins.length > 0 ? coins : FALLBACK_COINS
  const btc = source.find((c) => c.symbol === "BTC") ?? FALLBACK_COINS[0]
  const eth = source.find((c) => c.symbol === "ETH") ?? FALLBACK_COINS[1]
  const sol = source.find((c) => c.symbol === "SOL") ?? FALLBACK_COINS[3]

  const offset = 10
  const cap = (v: number | null) =>
    Math.round(Math.max(0, Math.min(25, offset + (v ?? 0))) * 100) / 100

  const data = [
    {
      period: "1h",
      btc: cap(btc.price_change_1h),
      eth: cap(eth.price_change_1h),
      sol: cap(sol.price_change_1h),
    },
    {
      period: "24h",
      btc: cap(btc.price_change_24h),
      eth: cap(eth.price_change_24h),
      sol: cap(sol.price_change_24h),
    },
    {
      period: "7d",
      btc: cap(btc.price_change_7d),
      eth: cap(eth.price_change_7d),
      sol: cap(sol.price_change_7d),
    },
    {
      period: "30d",
      btc: cap(btc.price_change_30d),
      eth: cap(eth.price_change_30d),
      sol: cap(sol.price_change_30d),
    },
  ]

  const fmtChange = (v: number | null) => {
    if (v == null) return "—"
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitleWithTooltip tooltip="Compares BTC, ETH, and SOL performance across 1h, 24h, 7d, and 30d timeframes. Values are offset by +10 so the neutral point sits at the midpoint of each axis.">
          Performance Radar
        </CardTitleWithTooltip>
        <CardDescription>BTC · ETH · SOL across time horizons</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer
          config={radarConfig}
          className="mx-auto aspect-square h-[220px] min-h-[220px] w-full max-w-[220px]"
        >
          <RadarChart data={data}>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  formatter={(value, name) => [
                    `${(Number(value) - offset) >= 0 ? "+" : ""}${(Number(value) - offset).toFixed(2)}%`,
                    String(name).toUpperCase(),
                  ]}
                />
              }
            />
            <PolarAngleAxis
              dataKey="period"
              tick={{ fontSize: 11, fontWeight: 700 }}
            />
            <PolarGrid radialLines={false} />
            <Radar
              dataKey="btc"
              fill={BTC_COLOR}
              fillOpacity={0.18}
              stroke={BTC_COLOR}
              strokeWidth={2}
            />
            <Radar
              dataKey="eth"
              fill={ETH_COLOR}
              fillOpacity={0.15}
              stroke={ETH_COLOR}
              strokeWidth={2}
            />
            <Radar
              dataKey="sol"
              fill={SOL_COLOR}
              fillOpacity={0.15}
              stroke={SOL_COLOR}
              strokeWidth={2}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </RadarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-1 text-sm pt-2">
        <div className="flex gap-4 leading-none text-xs font-bold">
          <span style={{ color: BTC_COLOR }}>BTC 24h {fmtChange(btc.price_change_24h)}</span>
          <span style={{ color: ETH_COLOR }}>ETH 24h {fmtChange(eth.price_change_24h)}</span>
          <span style={{ color: SOL_COLOR }}>SOL 24h {fmtChange(sol.price_change_24h)}</span>
        </div>
      </CardFooter>
    </Card>
  )
}

// ─── BTC vs ETH vs SOL Indexed (Multi-line Chart) ────────────────────────────

const multiLineConfig = {
  btc: { label: "BTC", color: BTC_COLOR },
  eth: { label: "ETH", color: ETH_COLOR },
  sol: { label: "SOL", color: SOL_COLOR },
} satisfies ChartConfig

interface ChartLineMultipleProps {
  btcKlines?: KlinePoint[]
  ethKlines?: KlinePoint[]
  solKlines?: KlinePoint[]
}

function indexTo100(klines: { date: string; price: number }[]) {
  if (!klines.length) return []
  const base = klines[0].price
  if (!base || base <= 0) return klines.map(() => 100)
  return klines.map((k) => Math.round((k.price / base) * 10000) / 100)
}

export function ChartLineMultiple({ btcKlines, ethKlines, solKlines }: ChartLineMultipleProps) {
  const btc = btcKlines && btcKlines.length > 0 ? btcKlines : FALLBACK_BTC_KLINES
  const eth = ethKlines && ethKlines.length > 0 ? ethKlines : FALLBACK_ETH_KLINES
  const sol = solKlines && solKlines.length > 0 ? solKlines : FALLBACK_SOL_KLINES

  const btcIdx = indexTo100(btc)
  const ethIdx = indexTo100(eth)
  const solIdx = indexTo100(sol)

  const data = btc.map((point, i) => ({
    date: point.date,
    btc: btcIdx[i] ?? 100,
    eth: ethIdx[i] ?? 100,
    sol: solIdx[i] ?? 100,
  }))

  const winner = (() => {
    const last = data[data.length - 1]
    if (!last) return "—"
    return [
      { name: "BTC", v: last.btc, color: BTC_COLOR },
      { name: "ETH", v: last.eth, color: ETH_COLOR },
      { name: "SOL", v: last.sol, color: SOL_COLOR },
    ].sort((a, b) => b.v - a.v)[0]
  })()

  return (
    <Card>
      <CardHeader>
        <CardTitleWithTooltip tooltip="BTC, ETH, and SOL price performance over 30 days, each normalized to 100 at the start. Compare which asset delivered the most gains in the period.">
          BTC vs ETH vs SOL — 30D Comparison
        </CardTitleWithTooltip>
        <CardDescription>Normalized to 100 at period start · 30-day window</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={multiLineConfig} className="min-h-[240px] h-[240px] w-full">
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ left: 4, right: 4 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) =>
                new Date(v as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={38}
              tick={{ fontSize: 10 }}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `${Number(v).toFixed(0)}`}
            />
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    `${Number(value).toFixed(2)} (${Number(value) >= 100 ? "+" : ""}${(Number(value) - 100).toFixed(2)}%)`,
                    String(name).toUpperCase(),
                  ]}
                  labelFormatter={(v) =>
                    new Date(v as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                />
              }
            />
            <Line dataKey="btc" type="monotone" stroke={BTC_COLOR} strokeWidth={2.5} dot={false} />
            <Line dataKey="eth" type="monotone" stroke={ETH_COLOR} strokeWidth={2} dot={false} />
            <Line dataKey="sol" type="monotone" stroke={SOL_COLOR} strokeWidth={2} dot={false} strokeDasharray="5 3" />
            <ChartLegend content={<ChartLegendContent />} />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-1">
            <div className="flex items-center gap-2 leading-none font-bold">
              Best performer:{" "}
              {typeof winner === "object" && (
                <span style={{ color: winner.color }} className="font-black">
                  {winner.name}
                </span>
              )}
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground text-xs">
              Based on 30-day normalized returns
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
