"use client"

import * as React from "react"
import { Treemap, ResponsiveContainer, Tooltip } from "recharts"
import { AssetIcon } from "~/components/asset-icon"
import { cn } from "~/lib/utils"
import { formatCompactCurrency } from "~/lib/currency"

function formatVolumeNotional(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—"
  return `${formatCompactCurrency(amount, "USD")} (USDT)`
}

export type HeatmapSizeBy = "market_cap" | "volume"

interface HeatmapData {
  name: string
  symbol?: string
  value?: number
  change?: number
  children?: HeatmapData[]
  volume24h?: number | null
  marketCap?: number | null
  exchangeRank?: number | null
  usingCapProxy?: boolean
  [key: string]: any
}

interface MarketHeatmapProps {
  data: HeatmapData[]
  sizeBy: HeatmapSizeBy
  onAssetClick?: (symbol: string) => void
}

const getHeatmapColor = (change: number) => {
  if (Math.abs(change) < 0.01) return "var(--muted-foreground)"

  if (change <= -5) return "#7f1d1d"
  if (change <= -2) return "#b91c1c"
  if (change < 0) return "#ef4444"

  if (change < 2) return "#10b981"
  if (change < 5) return "#059669"
  return "#064e3b"
}

const CustomizedContent = React.memo((props: any) => {
  const { x, y, width, height, name, symbol, change, index } = props

  if (width <= 0 || height <= 0) return null

  const safeChange = change ?? 0
  const color = getHeatmapColor(safeChange)

  // MORE GENEROUS THRESHOLDS FOR BETTER ICON VISIBILITY
  const isLarge = width > 110 && height > 100
  const isMedium = width > 55 && height > 55
  const isSmall = width > 20 && height > 20 // Lowered from 28x28
  const isMicro = width > 14 && height > 14

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color.startsWith("var") ? color : color,
          fillOpacity: color.startsWith("var") ? 0.3 : 1,
          transition: "fill 400ms ease-in-out",
          stroke: "var(--border)",
          strokeWidth: 0.5,
          cursor: "pointer",
        }}
        rx={isLarge ? 2 : 0}
        className="hover:brightness-125 transition-all duration-300"
      />

      {color.startsWith("var") && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="currentColor"
          className="text-muted/20 pointer-events-none"
        />
      )}

      {/* 
          ICON LIMIT: 
          Showing icons for the top 150 assets.
      */}
      {isSmall && symbol && index < 150 && (
        <foreignObject
          x={x + width / 2 - (isLarge ? 14 : isMedium ? 10 : 8)}
          y={y + height / 2 - (isLarge ? 40 : isMedium ? 25 : 8)}
          width={isLarge ? 28 : isMedium ? 20 : 16}
          height={isLarge ? 28 : isMedium ? 20 : 16}
          style={{ pointerEvents: "none" }}
        >
          <div className="flex items-center justify-center size-full rounded-full bg-foreground/5 backdrop-blur-[2px] overflow-hidden border border-foreground/10">
            <AssetIcon symbol={symbol} className="size-full object-contain" />
          </div>
        </foreignObject>
      )}

      {isMicro && (
        <g style={{ pointerEvents: "none" }}>
          {isLarge ? (
            <>
              <text
                x={x + width / 2}
                y={y + height / 2 + 10}
                textAnchor="middle"
                fill="currentColor"
                className="text-white"
                fontSize={12}
                fontWeight="800"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
              >
                {name}
              </text>
              <text
                x={x + width / 2}
                y={y + height / 2 + 26}
                textAnchor="middle"
                fill="currentColor"
                className="text-white/80"
                fontSize={10}
                fontWeight="700"
              >
                {safeChange > 0 ? "+" : ""}{safeChange.toFixed(2)}%
              </text>
            </>
          ) : isMedium ? (
            <>
              <text
                x={x + width / 2}
                y={y + height / 2 + 12}
                textAnchor="middle"
                fill="currentColor"
                className="text-white uppercase text-white"
                fontSize={9}
                fontWeight="900"
              >
                {symbol || ""}
              </text>
              <text
                x={x + width / 2}
                y={y + height / 2 + 22}
                textAnchor="middle"
                fill="currentColor"
                className="text-white/80"
                fontSize={8}
                fontWeight="700"
              >
                {safeChange > 0 ? "+" : ""}{safeChange.toFixed(2)}%
              </text>
            </>
          ) : null}
        </g>
      )}
    </g>
  )
})

function HeatmapTooltipBody({ active, payload, sizeBy }: { active?: boolean; payload?: any[]; sizeBy: HeatmapSizeBy }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload as HeatmapData
  if (!data.symbol) return null
  const isPositive = (data.change ?? 0) >= 0
  const isNeutral = Math.abs(data.change ?? 0) < 0.01

  const rankText =
    data.exchangeRank != null && Number.isFinite(data.exchangeRank) ? `#${Math.round(data.exchangeRank)}` : "—"

  return (
    <div className="rounded-2xl border border-border bg-popover/90 p-4 backdrop-blur-xl shadow-2xl ring-1 ring-white/10">
      <div className="flex items-center gap-3 mb-3 border-b border-border pb-3">
        <div className="size-8 overflow-hidden rounded-xl bg-muted p-1.5 border border-border">
          <AssetIcon symbol={data.symbol} className="size-full" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-sm text-foreground tracking-tight leading-none">{data.name}</span>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">{data.symbol}</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-12">
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Performance</span>
          <span className={cn("text-xs font-black tabular-nums", isNeutral ? "text-muted-foreground" : isPositive ? "text-emerald-500" : "text-rose-500")}>
            {isNeutral ? "± 0.00%" : (isPositive ? "▲ +" : "▼ ") + (data.change ?? 0).toFixed(2) + "%"}
          </span>
        </div>

        {sizeBy === "volume" ? (
          <>
            <div className="flex items-center justify-between gap-12">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">24h volume</span>
              <span className="text-xs font-black text-foreground tabular-nums text-right max-w-[min(200px,55vw)] leading-tight">
                {formatVolumeNotional(data.volume24h)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-12">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Volume rank</span>
              <span className="text-xs font-black text-foreground tabular-nums">{rankText}</span>
            </div>
          </>
        ) : data.usingCapProxy ? (
          <>
            <div className="flex items-center justify-between gap-12">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">24h volume</span>
              <span className="text-xs font-black text-foreground tabular-nums text-right max-w-[min(200px,55vw)] leading-tight">
                {formatVolumeNotional(data.volume24h)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-12">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Volume rank</span>
              <span className="text-xs font-black text-foreground tabular-nums">{rankText}</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-snug pt-0.5 border-t border-border/60 mt-2">
              Market cap is not available from this feed. Tile size uses the same Binance 24h volume ranking as above.
            </p>
          </>
        ) : (
          <div className="flex items-center justify-between gap-12">
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Market cap</span>
            <span className="text-xs font-black text-foreground tabular-nums">
              {(() => {
                const cap = data.marketCap
                if (cap == null || !Number.isFinite(cap)) return "—"
                return formatCompactCurrency(cap, "USD")
              })()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function MarketHeatmap({ data, sizeBy, onAssetClick }: MarketHeatmapProps) {
  const chartData = React.useMemo(() => data || [], [data])
  if (chartData.length === 0) return null

  return (
    <div className="w-full h-full min-h-[550px] rounded-[2rem] border border-border/50 bg-card/20 p-1.5 backdrop-blur-md shadow-2xl overflow-hidden glass-surface">
      <div className="w-full h-full rounded-[1.8rem] overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={chartData}
            dataKey="value"
            stroke="none"
            isAnimationActive={false}
            content={<CustomizedContent />}
            onClick={(node: any) => node?.symbol && onAssetClick?.(node.symbol)}
          >
            <Tooltip
              content={(props) => <HeatmapTooltipBody {...props} sizeBy={sizeBy} />}
              cursor={{ strokeOpacity: 0 }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
