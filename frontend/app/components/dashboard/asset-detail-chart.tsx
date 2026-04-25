"use client"

import { Area, Bar, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Customized } from "recharts"
import type { ChartConfig } from "~/components/ui/chart"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart"

const chartConfig = {
  price: {
    label: "Price",
    color: "var(--chart-1)",
  },
  volume: {
    label: "Volume",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig

export function AssetDetailChart({
  data,
  trend = "up",
  config,
  currentPrice: externalCurrentPrice
}: {
  data: any[],
  trend?: "up" | "down",
  config?: any,
  currentPrice?: number
}) {
  if (!data || data.length === 0) return null

  const isUp = trend === "up"
  const strokeColor = isUp ? "#16a34a" : "#ef4444"
  const gradientId = isUp ? "fillPriceDetailUp" : "fillPriceDetailDown"

  const currentPrice = externalCurrentPrice ?? (data[data.length - 1]?.price || 0)
  const formattedCurrentPrice = currentPrice >= 1000 ? `$${(currentPrice / 1000).toFixed(2)}K` : `$${currentPrice.toFixed(2)}`

  return (
    <ChartContainer config={config || chartConfig} className="aspect-auto h-full w-full">
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
          tickFormatter={(value) => {
            const date = new Date(value as string)
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          }}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: "bold" }}
        />
        <YAxis
          yAxisId="price"
          orientation="right"
          domain={['auto', 'auto']}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: "bold" }}
          tickFormatter={(value) => {
            if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
            return `$${value}`
          }}
          width={45}
        />
        <YAxis yAxisId="volume" orientation="right" domain={[0, 'dataMax * 4']} hide />

        <Bar yAxisId="volume" dataKey="volume" fill="var(--color-volume)" opacity={0.2} radius={[2, 2, 0, 0]} />
        <Area
          yAxisId="price"
          dataKey="price"
          type="monotone"
          fill={`url(#${gradientId})`}
          stroke={strokeColor}
          strokeWidth={2}
          animationDuration={800}
          animationEasing="ease-in-out"
        />

        <ChartTooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => new Date(value as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              indicator="dot"
            />
          }
        />

        <ReferenceLine
          y={currentPrice}
          yAxisId="price"
          stroke={strokeColor}
          strokeDasharray="3 3"
          opacity={0.4}
        />

        {/* 
          Customized is the ultimate way to draw on top of everything. 
          It renders after all chart elements are done.
        */}
        <Customized component={(props: any) => {
          const { viewBox, yAxisMap } = props;
          if (!viewBox || !yAxisMap?.price) return null;

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
  )
}
