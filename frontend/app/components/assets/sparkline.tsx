"use client"

import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts"

interface SparklineProps {
  data: number[]
  isUp: boolean
}

export function Sparkline({ data, isUp }: SparklineProps) {
  // Filter out any zero or null values that might break the scale
  const chartData = data.filter(v => v > 0).map((val, i) => ({ value: val, index: i }))
  const color = isUp ? "#22c55e" : "#ef4444"

  if (chartData.length === 0) return <div className="h-10 w-24 bg-muted/5 rounded" />

  return (
    <div className="h-10 w-24 outline-none pointer-events-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <YAxis domain={["auto", "auto"]} hide />
          <defs>
            <linearGradient id={`gradient-${isUp ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${isUp ? "up" : "down"})`}
            isAnimationActive={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
