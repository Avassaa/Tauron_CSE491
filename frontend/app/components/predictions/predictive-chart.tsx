import * as React from "react"
import {
  createChart,
  ColorType,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts"
import { format } from "date-fns"
import { useAppTheme } from "~/theme-context"
import { finalizeHistogramDataset, type LightweightHistogramDatum } from "~/lib/lightweight-chart-histogram"
import { clampForecastConfidenceIntervalPairForVisualizationExclusive } from "~/lib/prediction-display-bands"

interface PredictiveChartProps {
  historicalData: {
    time: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }[]
  predictions: {
    time: number
    value: number
    ciHigh?: number
    ciLow?: number
  }[]
  lastPredictedValue?: number
}

export function PredictiveChart({ historicalData, predictions, lastPredictedValue }: PredictiveChartProps) {
  const { theme } = useAppTheme()
  const isDark = theme === "dark"

  const chartContainerRef = React.useRef<HTMLDivElement>(null)
  const tooltipRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<IChartApi | null>(null)

  React.useEffect(() => {
    if (!chartContainerRef.current) return

    const safeHistorical = historicalData.filter(
      (row): row is NonNullable<typeof row> =>
        row != null &&
        Number.isFinite(row.time) &&
        Number.isFinite(row.open) &&
        Number.isFinite(row.high) &&
        Number.isFinite(row.low) &&
        Number.isFinite(row.close),
    )
    const safePredictions = predictions.filter(
      (row): row is NonNullable<typeof row> =>
        row != null && Number.isFinite(row.time) && Number.isFinite(row.value),
    )

    const finalizeAscendingUniqueCandles = (
      entries: CandlestickData<Time>[],
    ): CandlestickData<Time>[] => {
      const sorted = [...entries].sort((a, b) => Number(a.time) - Number(b.time))
      const output: CandlestickData<Time>[] = []
      for (const row of sorted) {
        const prior = output[output.length - 1]
        if (prior != null && Number(prior.time) === Number(row.time)) {
          output[output.length - 1] = row
        } else {
          output.push(row)
        }
      }
      return output
    }

    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth })
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#000000" : "#ffffff" },
        textColor: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)",
        fontSize: 12,
        fontFamily: "Inter, sans-serif",
      },
      grid: {
        vertLines: { color: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.05)", style: LineStyle.Solid },
        horzLines: { color: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.05)", style: LineStyle.Solid },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          width: 1,
          color: isDark ? "rgba(0, 255, 204, 0.5)" : "rgba(13, 148, 136, 0.5)",
          style: LineStyle.LargeDashed,
          labelBackgroundColor: isDark ? "#00ffcc" : "#0d9488",
        },
        horzLine: {
          width: 1,
          color: isDark ? "rgba(0, 255, 204, 0.5)" : "rgba(13, 148, 136, 0.5)",
          style: LineStyle.LargeDashed,
          labelBackgroundColor: isDark ? "#00ffcc" : "#0d9488",
        },
      },
      timeScale: {
        borderColor: isDark ? "rgba(30, 41, 59, 0.2)" : "rgba(203, 213, 225, 0.5)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: isDark ? "rgba(30, 41, 59, 0.2)" : "rgba(203, 213, 225, 0.5)",
        scaleMargins: { top: 0.05, bottom: 0.1 },
        borderVisible: false,
      },
      handleScroll: false,
      handleScale: false,
    })

    chartRef.current = chart

    // 1. Candlestick Series (Historical)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: isDark ? "#00ffcc" : "#0d9488",
      downColor: isDark ? "#ff4d6d" : "#e11d48",
      borderVisible: false,
      wickUpColor: isDark ? "#00ffcc" : "#0d9488",
      wickDownColor: isDark ? "#ff4d6d" : "#e11d48",
    })
    candleSeries.setData(
      finalizeAscendingUniqueCandles(
        safeHistorical.map((row) => ({
          time: row.time as Time,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
        })),
      ),
    )

    // 2. Volume Series (Histogram)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume", // separate scale
    })

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 }, // Very slim at bottom
      visible: false, // Hide the scale labels on the right
    })

    const historicalVolume: LightweightHistogramDatum[] = safeHistorical.map((d) => ({
      time: d.time as Time,
      value: d.volume,
      color: Number.isFinite(d.open) && d.close >= d.open
        ? (isDark ? "rgba(38, 166, 154, 0.2)" : "rgba(5, 150, 105, 0.2)")
        : (isDark ? "rgba(239, 83, 80, 0.2)" : "rgba(220, 38, 38, 0.2)"),
    }))

    const forecastVolume: LightweightHistogramDatum[] = safePredictions.map((p) => ({
      time: p.time as Time,
      value: 320,
      color: isDark ? "rgba(41, 98, 255, 0.08)" : "rgba(37, 99, 235, 0.07)",
    }))

    volumeSeries.setData(finalizeHistogramDataset([...historicalVolume, ...forecastVolume]))

    // 3. Predicted Candlestick Series
    const predictionSeries = chart.addSeries(CandlestickSeries, {
      upColor: isDark ? "rgba(0, 255, 204, 0.65)" : "rgba(13, 148, 136, 0.65)",
      downColor: isDark ? "rgba(255, 77, 109, 0.65)" : "rgba(225, 29, 72, 0.65)",
      borderVisible: true,
      borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)",
      wickUpColor: isDark ? "rgba(0, 255, 204, 0.65)" : "rgba(13, 148, 136, 0.65)",
      wickDownColor: isDark ? "rgba(255, 77, 109, 0.65)" : "rgba(225, 29, 72, 0.65)",
      priceLineVisible: true,
      lastValueVisible: true,
    })

    const predictiveRaw: CandlestickData<Time>[] = []
    let lastClose =
      safeHistorical.length > 0
        ? safeHistorical[safeHistorical.length - 1].close
        : (safePredictions[0]?.value ??
          (typeof lastPredictedValue === "number" && Number.isFinite(lastPredictedValue)
            ? lastPredictedValue
            : 0))

    safePredictions.forEach((p) => {
      const open = lastClose
      const close = p.value
      const fencedBundleExclusive =
        clampForecastConfidenceIntervalPairForVisualizationExclusive({
          midpointExclusive: p.value,
          intervalHighExclusive: typeof p.ciHigh === "number" && Number.isFinite(p.ciHigh) ? p.ciHigh : undefined,
          intervalLowExclusive: typeof p.ciLow === "number" && Number.isFinite(p.ciLow) ? p.ciLow : undefined,
        })
      const bodyTopFenceExclusive = Math.max(open, close)
      const bodyBottomFenceExclusive = Math.min(open, close)
      const resolvedHighFenceExclusive =
        typeof fencedBundleExclusive.intervalHighExclusive === "number"
          ? Math.max(bodyTopFenceExclusive, fencedBundleExclusive.intervalHighExclusive)
          : bodyTopFenceExclusive
      const resolvedLowFenceExclusive =
        typeof fencedBundleExclusive.intervalLowExclusive === "number"
          ? Math.min(bodyBottomFenceExclusive, fencedBundleExclusive.intervalLowExclusive)
          : bodyBottomFenceExclusive

      predictiveRaw.push({
        time: p.time as Time,
        open,
        high: resolvedHighFenceExclusive,
        low: resolvedLowFenceExclusive,
        close,
      })
      lastClose = close
    })

    predictionSeries.setData(finalizeAscendingUniqueCandles(predictiveRaw))

    // Ensure the chart spreads out to fill the entire container width
    chart.timeScale().fitContent()

    // Tooltip logic
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > (chartContainerRef.current?.clientWidth || 0) ||
        param.point.y < 0 ||
        param.point.y > (chartContainerRef.current?.clientHeight || 0)
      ) {
        if (tooltipRef.current) tooltipRef.current.style.display = "none"
      } else {
        if (tooltipRef.current) {
          const time = param.time as number
          const candle = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined
          const predCandle = param.seriesData.get(predictionSeries) as CandlestickData<Time> | undefined
          const histRow = safeHistorical.find((h) => h.time === time)
          const predRow = safePredictions.find((p) => p.time === time)

          const actualCandle =
            candle ??
            (histRow
              ? ({
                  open: histRow.open,
                  high: histRow.high,
                  low: histRow.low,
                  close: histRow.close,
                } satisfies Pick<CandlestickData<Time>, "open" | "high" | "low" | "close">)
              : undefined)

          const modelCandle =
            predCandle ??
            (predRow
              ? (() => {
                  const openResolvedFenceExclusive =
                    histRow !== undefined &&
                    histRow.close !== undefined &&
                    Number.isFinite(histRow.close)
                      ? histRow.close
                      : predRow.value
                  const fencedBundleExclusiveTooltipOuter =
                    clampForecastConfidenceIntervalPairForVisualizationExclusive({
                      midpointExclusive: predRow.value,
                      intervalHighExclusive:
                        typeof predRow.ciHigh === "number" && Number.isFinite(predRow.ciHigh)
                          ? predRow.ciHigh
                          : undefined,
                      intervalLowExclusive:
                        typeof predRow.ciLow === "number" && Number.isFinite(predRow.ciLow)
                          ? predRow.ciLow
                          : undefined,
                    })
                  const bodyTopFenceExclusiveTooltipOuter = Math.max(
                    openResolvedFenceExclusive,
                    predRow.value,
                  )
                  const bodyBottomFenceExclusiveTooltipOuter = Math.min(
                    openResolvedFenceExclusive,
                    predRow.value,
                  )
                  const highFenceDisplayedExclusive =
                    typeof fencedBundleExclusiveTooltipOuter.intervalHighExclusive === "number"
                      ? Math.max(
                          bodyTopFenceExclusiveTooltipOuter,
                          fencedBundleExclusiveTooltipOuter.intervalHighExclusive,
                        )
                      : bodyTopFenceExclusiveTooltipOuter
                  const lowFenceDisplayedExclusive =
                    typeof fencedBundleExclusiveTooltipOuter.intervalLowExclusive === "number"
                      ? Math.min(
                          bodyBottomFenceExclusiveTooltipOuter,
                          fencedBundleExclusiveTooltipOuter.intervalLowExclusive,
                        )
                      : bodyBottomFenceExclusiveTooltipOuter
                  return {
                    open: openResolvedFenceExclusive,
                    high: highFenceDisplayedExclusive,
                    low: lowFenceDisplayedExclusive,
                    close: predRow.value,
                  }
                })()
              : undefined)

          if (!actualCandle && !modelCandle) {
            tooltipRef.current.style.display = "none"
            return
          }

          tooltipRef.current.style.display = "block"
          const formattedDate = format(new Date(time * 1000), "MMM d, yyyy HH:mm")

          const ohlcRows = (
            label: string,
            accentClass: string,
            data: Pick<CandlestickData<Time>, "open" | "high" | "low" | "close">,
          ) => `
              <div class="mb-1.5 mt-2 first:mt-0">
                <div class="text-[9px] font-black uppercase tracking-widest ${accentClass} mb-1">${label}</div>
                <div class="grid grid-cols-2 gap-x-5 gap-y-1">
                  <div class="flex justify-between gap-3"><span class="text-[8px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}">O</span><span class="text-[11px] font-black tabular-nums ${isDark ? 'text-white/90' : 'text-black/90'}">${data.open.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>
                  <div class="flex justify-between gap-3"><span class="text-[8px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}">H</span><span class="text-[11px] font-black tabular-nums ${isDark ? 'text-white/90' : 'text-black/90'}">${data.high.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>
                  <div class="flex justify-between gap-3"><span class="text-[8px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}">L</span><span class="text-[11px] font-black tabular-nums ${isDark ? 'text-white/90' : 'text-black/90'}">${data.low.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>
                  <div class="flex justify-between gap-3"><span class="text-[8px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}">C</span><span class="text-[11px] font-black tabular-nums ${isDark ? 'text-white/90' : 'text-black/90'}">${data.close.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>
                </div>
              </div>
            `

          tooltipRef.current.innerHTML = `
            <div class="flex flex-col gap-1 min-w-[200px]">
              <div class="flex items-center justify-between border-b ${isDark ? "border-white/10" : "border-black/10"} pb-2 mb-1">
                <span class="text-[10px] font-black uppercase tracking-[0.1em] ${isDark ? "text-slate-500" : "text-slate-400"}">${formattedDate}</span>
              </div>
              ${actualCandle ? ohlcRows("Actual (market)", isDark ? "text-emerald-400" : "text-emerald-600", actualCandle) : ""}
              ${modelCandle ? ohlcRows("Model forecast", isDark ? "text-blue-400" : "text-blue-600", modelCandle) : ""}
            </div>
          `

          let y = param.point.y + 15
          let left = param.point.x + 15

          if (left > (chartContainerRef.current?.clientWidth || 0) - 220) {
            left = param.point.x - 225
          }

          if (y > (chartContainerRef.current?.clientHeight || 0) - 160) {
            y = param.point.y - 170
          }

          tooltipRef.current.style.left = left + "px"
          tooltipRef.current.style.top = y + "px"
        }
      }
    })

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
    }
  }, [historicalData, predictions, isDark, lastPredictedValue])

  return (
    <div className="relative h-full w-full group">
      <div
        className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-background/70 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/50"
        aria-hidden
      >
        <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
          <span className="size-1.5 shrink-0 rounded-full bg-teal-400" />
          Actual candles
        </span>
        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <span className="size-1.5 shrink-0 rounded-full bg-blue-400" />
          Model path
        </span>
      </div>
      <style>{`
        /* Hide TradingView Logo */
        a[href*="tradingview"] { display: none !important; }
      `}</style>
      <div ref={chartContainerRef} className="h-full w-full" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-50 hidden min-w-[180px] rounded-xl border border-border/50 bg-background/80 p-3.5 shadow-2xl backdrop-blur-xl dark:bg-black/80 dark:border-white/10"
        style={{ transition: "none" }}
      />

      {/* Volume Label Overlay */}
      <div className="pointer-events-none absolute bottom-[6%] left-4 z-10 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 dark:bg-black/20 border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-[1px] items-end h-2.5">
            <div className="w-[2px] h-1.5 bg-foreground/30 dark:bg-white/30 rounded-full animate-[pulse_2s_infinite]" />
            <div className="w-[2px] h-2.5 bg-foreground/50 dark:bg-white/50 rounded-full animate-[pulse_2s_infinite_200ms]" />
            <div className="w-[2px] h-1.5 bg-foreground/30 dark:bg-white/30 rounded-full animate-[pulse_2s_infinite_400ms]" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 dark:text-white/40">Market Volume Flow</span>
        </div>
      </div>
    </div>
  )
}
