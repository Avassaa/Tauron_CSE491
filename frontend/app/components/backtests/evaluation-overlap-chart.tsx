"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { ModelEvaluationPointResponse } from "~/lib/api-client"
import { formatCurrency } from "~/lib/currency"
import { cn } from "~/lib/utils"

const PIXELS_PER_DAY_EXCLUSIVE = 12
const CHART_HEIGHT_PX_EXCLUSIVE = 420
const MIN_CHART_WIDTH_PX_EXCLUSIVE = 800

export type EvaluationOverlapChartProps = {
  points: ModelEvaluationPointResponse[]
  totalPointCountExclusive: number
  visibleCapExclusive: number
  className?: string
}

type ChartDatumExclusive = {
  dayKey: string
  predicted: number
  actual: number
  absoluteError: number
  signedError: number
}

function buildChartDataFromPoints(
  pointSequenceExclusive: ModelEvaluationPointResponse[],
): ChartDatumExclusive[] {
  return pointSequenceExclusive.map((row) => {
    let dayKey = row.time
    try {
      dayKey = format(new Date(row.time), "yyyy-MM-dd")
    } catch {
      /* keep raw ISO */
    }
    return {
      dayKey,
      predicted: row.predicted_value,
      actual: row.actual_close,
      absoluteError: row.absolute_error,
      signedError: row.signed_error,
    }
  })
}

function EvaluationOverlapTooltip(props: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: ChartDatumExclusive }>
}) {
  if (!props.active || !props.payload?.length) return null
  const datum = props.payload[0].payload
  return (
    <div
      className={cn(
        "max-w-xs rounded-xl border border-border/60 bg-popover/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-md",
      )}
    >
      <p className="mb-2 font-mono font-bold text-foreground">{datum.dayKey}</p>
      <div className="grid gap-1.5 font-mono tabular-nums text-[11px]">
        <div className="flex justify-between gap-6">
          <span className="text-blue-500">Predicted</span>
          <span>{formatCurrency(datum.predicted, "USD")}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">PriceUSD</span>
          <span>{formatCurrency(datum.actual, "USD")}</span>
        </div>
        <div className="flex justify-between gap-6 border-t border-border/40 pt-1.5">
          <span className="text-muted-foreground">Abs error</span>
          <span>{formatCurrency(datum.absoluteError, "USD")}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Signed</span>
          <span
            className={cn(
              datum.signedError >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
            )}
          >
            {formatCurrency(datum.signedError, "USD")}
          </span>
        </div>
      </div>
    </div>
  )
}

export function EvaluationOverlapChart({
  points,
  totalPointCountExclusive,
  visibleCapExclusive,
  className,
}: EvaluationOverlapChartProps) {
  const chartDataExclusive = React.useMemo(() => {
    const sortedExclusive = [...points].sort(
      (left, right) => new Date(left.time).getTime() - new Date(right.time).getTime(),
    )
    return buildChartDataFromPoints(sortedExclusive)
  }, [points])

  const chartWidthExclusive = React.useMemo(() => {
    const spanExclusive = Math.max(chartDataExclusive.length, 1)
    return Math.min(
      16000,
      Math.max(MIN_CHART_WIDTH_PX_EXCLUSIVE, spanExclusive * PIXELS_PER_DAY_EXCLUSIVE),
    )
  }, [chartDataExclusive.length])

  const shownCountExclusive = chartDataExclusive.length

  if (shownCountExclusive === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] items-center justify-center rounded-b-xl border-t border-border/40 text-sm text-muted-foreground",
          className,
        )}
      >
        No overlap points in this window.
      </div>
    )
  }

  return (
    <div className={cn("flex w-full flex-col gap-2 overflow-hidden border-none outline-none", className)}>
      <div className="border-b border-border/40 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        Overlap series (showing {shownCountExclusive} of {totalPointCountExclusive}
        {totalPointCountExclusive > visibleCapExclusive ? ` — capped at ${visibleCapExclusive}` : ""})
        <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/80">
          Scroll horizontally to pan the timeline.
        </span>
      </div>
      <div
        className="h-[420px] w-full rounded-b-xl bg-background/5 border-none outline-none ring-0 focus:outline-none focus:ring-0"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartDataExclusive}
            margin={{ top: 20, right: 40, left: 20, bottom: 60 }}
            style={{ outline: "none", border: "none" }}
          >
            <CartesianGrid strokeDasharray="3 6" stroke="rgba(148, 163, 184, 0.22)" />
            <XAxis
              dataKey="dayKey"
              tick={{ fontSize: 9, fill: "rgba(100, 116, 139, 0.92)" }}
              angle={-35}
              textAnchor="end"
              height={52}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(100, 116, 139, 0.92)" }}
              domain={["auto", "auto"]}
              width={56}
              tickFormatter={(v) =>
                typeof v === "number" && Number.isFinite(v)
                  ? v >= 1e6
                    ? `${(v / 1e6).toFixed(2)}M`
                    : v >= 1e3
                      ? `${(v / 1e3).toFixed(1)}k`
                      : v.toFixed(0)
                  : String(v)
              }
            />
            <Tooltip content={<EvaluationOverlapTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Line
              type="monotone"
              dataKey="predicted"
              name="Predicted mid"
              stroke="hsl(217 91% 60%)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={shownCountExclusive < 300}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="PriceUSD (actual)"
              stroke="hsl(215 16% 47%)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={shownCountExclusive < 300}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
