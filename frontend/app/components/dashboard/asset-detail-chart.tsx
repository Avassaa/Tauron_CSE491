"use client"

import * as React from "react"
import { Area, Bar, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, Customized } from "recharts"
import type { ChartConfig } from "~/components/ui/chart"
import { ChartContainer } from "~/components/ui/chart"

const chartConfig = {
  price: { label: "Price", color: "var(--chart-1)" },
  volume: { label: "Volume", color: "var(--meta-blue)" },
} satisfies ChartConfig

function makePriceTooltip(strokeColor: string) {
  return function PriceTooltip({ active, payload, label }: any) {
    if (!active || !payload || payload.length === 0) return null
    const raw = payload[0]?.payload ?? {}
    const price = raw.price as number | undefined
    const volume = raw.volume as number | undefined

    const fmtPrice = (v: number) =>
      `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const fmtVol = (v: number) => {
      if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
      if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
      if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`
      return `$${v.toFixed(2)}`
    }
    const dateStr = label
      ? new Date(label as string).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
      : ""

    return (
      <div style={{
        background: "var(--popover, rgba(10,12,18,0.96))",
        border: "1px solid var(--border, rgba(255,255,255,0.09))",
        borderRadius: 10,
        padding: "10px 14px",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        minWidth: 200,
        pointerEvents: "none",
        fontFamily: "inherit",
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.03em" }}>
          {dateStr}
        </p>
        {price !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: strokeColor, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 700 }}>Price:</span>
            <span style={{ fontSize: 12, color: "var(--foreground)", fontWeight: 800, marginLeft: "auto" }}>{fmtPrice(price)}</span>
          </div>
        )}
        {volume !== undefined && volume > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--meta-blue)", opacity: 0.8, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 700 }}>Vol:</span>
            <span style={{ fontSize: 12, color: "var(--foreground)", fontWeight: 800, marginLeft: "auto" }}>{fmtVol(volume)}</span>
          </div>
        )}
      </div>
    )
  }
}

export function AssetDetailChart({
  data,
  trend = "up",
  config,
  currentPrice: externalCurrentPrice,
  mode = "both",
  formatCurrency = (value) => `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 })}`,
  formatCompactCurrency,
}: {
  data: any[],
  trend?: "up" | "down",
  config?: any,
  currentPrice?: number,
  mode?: "price" | "volume" | "both",
  formatCurrency?: (value?: number) => string,
  formatCompactCurrency?: (value?: number) => string,
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  if (!data || data.length === 0) return null

  const isUp = trend === "up"
  const strokeColor = isUp ? "#16a34a" : "#ef4444"
  const gradientId = isUp ? "fillPriceDetailUp" : "fillPriceDetailDown"

  const currentPrice = externalCurrentPrice ?? (data[data.length - 1]?.price || 0)
  const formattedCurrentPrice =
    formatCompactCurrency?.(currentPrice) ??
    (currentPrice >= 1000 ? formatCurrency(currentPrice) : formatCurrency(currentPrice))
  const showPrice = mode === "price" || mode === "both"
  const showVolume = mode === "volume" || mode === "both"
  const formatVolume = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
    return value.toFixed(2)
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="relative h-full w-full outline-none focus:outline-none [&_svg]:outline-none [&_svg]:focus:outline-none"
    >
      <ChartContainer
        config={config || chartConfig}
        className="aspect-auto h-full w-full outline-none [&>svg]:outline-none"
      >
        <ComposedChart data={data} margin={{ top: 10, right: 45, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillPriceDetailUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="fillPriceDetailDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />

          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(v, index) => {
              const date = new Date(v as string)
              const firstDate = new Date(data[0].date)
              const isSameDay = date.toDateString() === firstDate.toDateString()

              // If it's the same day (intraday), show time. 
              // Optionally show date only on the first tick.
              if (data.length > 1 && new Date(data[data.length - 1].date).toDateString() === firstDate.toDateString()) {
                if (index === 0) {
                  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
                return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
              }

              return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: "bold" }}
          />
          {showPrice && (
            <YAxis
              yAxisId="price"
              orientation="right"
              domain={["auto", "auto"]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: "bold" }}
              tickFormatter={value => {
                const numeric = Number(value)
                if (numeric >= 1000 && formatCompactCurrency) return formatCompactCurrency(numeric)
                return formatCurrency(numeric)
              }}
              width={60}
            />
          )}

          <YAxis yAxisId="volume" orientation="right" domain={[0, "dataMax * 4"]} hide={!showVolume || showPrice} />

          {showVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="var(--meta-blue)"
              opacity={mode === "both" ? 0.4 : 1.0}
              radius={[2, 2, 0, 0]}
              isAnimationActive={true}
              animationDuration={400}
              animationEasing="ease-in-out"
            />
          )}

          {showPrice && (
            <Area
              yAxisId="price"
              dataKey="price"
              type="monotone"
              fill={`url(#${gradientId})`}
              stroke={strokeColor}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: strokeColor, stroke: "var(--background)", strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={400}
              animationEasing="ease-in-out"
            />
          )}

          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3", opacity: 0.5 }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null
              const dateText = new Date(String(label)).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })
              const priceRow = payload.find((entry) => entry.dataKey === "price")
              const volumeRow = payload.find((entry) => entry.dataKey === "volume")

              return (
                <div className="rounded-xl border border-border bg-popover/90 backdrop-blur-md p-3 text-[10px] shadow-2xl min-w-[140px]">
                  <div className="mb-2 font-black text-muted-foreground uppercase tracking-widest opacity-50 border-b border-border pb-1.5">
                    {dateText}
                  </div>
                  <div className="space-y-1.5">
                    {showPrice && priceRow && (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="size-1.5 rounded-full" style={{ backgroundColor: strokeColor }} />
                          <span className="font-bold text-muted-foreground uppercase">Price</span>
                        </div>
                        <span className="font-black tabular-nums">{formatCurrency(Number(priceRow.value))}</span>
                      </div>
                    )}
                    {showVolume && volumeRow && (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="size-1.5 rounded-full bg-blue-500" />
                          <span className="font-bold text-muted-foreground uppercase">Volume</span>
                        </div>
                        <span className="font-black tabular-nums">{formatVolume(Number(volumeRow.value))}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            }}
          />

          {showPrice ? (
            <ReferenceLine
              y={currentPrice}
              yAxisId="price"
              stroke={strokeColor}
              strokeDasharray="3 3"
              opacity={0.4}
            />
          ) : null}

          {/* 
          Customized is the ultimate way to draw on top of everything. 
          It renders after all chart elements are done.
        */}
          <Customized component={(props: any) => {
            const { viewBox, yAxisMap } = props;
            if (!showPrice || !viewBox || !yAxisMap?.price) return null;

            const y = yAxisMap.price.scale(currentPrice);
            const { width, x } = viewBox;
            const rightX = x + width;

            return (
              <g className="recharts-layer recharts-reference-line">
                <rect
                  x={rightX}
                  y={y - 10}
                  width={50}
                  height={20}
                  fill={strokeColor}
                  rx={4}
                  style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))' }}
                />
                <text
                  x={rightX + 25}
                  y={y + 4}
                  fill="#fff"
                  fontSize={10}
                  fontWeight="bold"
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  {formattedCurrentPrice}
                </text>
              </g>
            );
          }} />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}
