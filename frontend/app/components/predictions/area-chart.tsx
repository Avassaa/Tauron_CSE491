import * as React from "react"
import {
  createChart,
  ColorType,
  LineStyle,
  AreaSeries,
  HistogramSeries,
  type IChartApi,
  type AreaData,
  type Time,
} from "lightweight-charts"
import { format } from "date-fns"
import { useAppTheme } from "~/theme-context"
import { finalizeHistogramDataset, sanitizeAreaSeriesData, type LightweightHistogramDatum } from "~/lib/lightweight-chart-histogram"
import { clampForecastConfidenceIntervalPairForVisualizationExclusive } from "~/lib/prediction-display-bands"

interface AreaChartProps {
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

export function PredictiveAreaChart({ historicalData, predictions, lastPredictedValue }: AreaChartProps) {
  const { theme } = useAppTheme()
  const isDark = theme === "dark"

  const chartContainerRef = React.useRef<HTMLDivElement>(null)
  const tooltipRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<IChartApi | null>(null)

  React.useEffect(() => {
    if (!chartContainerRef.current) return

    const safeHistorical = historicalData.filter(
      (row): row is NonNullable<typeof row> =>
        row != null && Number.isFinite(row.time) && Number.isFinite(row.close),
    )
    const safePredictions = predictions.filter(
      (row): row is NonNullable<typeof row> =>
        row != null && Number.isFinite(row.time) && Number.isFinite(row.value),
    )

    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth })
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#000000" : "#f9fafb" },
        textColor: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.7)",
        fontSize: 11,
        fontFamily: "Inter, sans-serif",
      },
      grid: {
        vertLines: { color: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.08)", style: LineStyle.Solid },
        horzLines: { color: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.08)", style: LineStyle.Solid },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          width: 1,
          color: isDark ? "rgba(96,165,250,0.5)" : "rgba(37,99,235,0.6)",
          style: LineStyle.LargeDashed,
          labelBackgroundColor: isDark ? "#3b82f6" : "#2563eb",
        },
        horzLine: {
          width: 1,
          color: isDark ? "rgba(96,165,250,0.5)" : "rgba(37,99,235,0.6)",
          style: LineStyle.LargeDashed,
          labelBackgroundColor: isDark ? "#3b82f6" : "#2563eb",
        },
      },
      timeScale: {
        borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.12)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.12)",
        scaleMargins: { top: 0.06, bottom: 0.12 },
        borderVisible: false,
      },
      handleScroll: false,
      handleScale: false,
    })

    chartRef.current = chart

    // ── 1. Historical Area Series ───────────────────────────────────────────
    const historicalAreaSeries = chart.addSeries(AreaSeries, {
      lineColor: isDark ? "#00ffcc" : "#0d9488",
      lineWidth: 2,
      topColor: isDark ? "rgba(0,255,204,0.25)" : "rgba(13,148,136,0.2)",
      bottomColor: isDark ? "rgba(0,255,204,0.0)" : "rgba(13,148,136,0.0)",
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: isDark ? "#00ffcc" : "#0d9488",
      crosshairMarkerBackgroundColor: isDark ? "#000000" : "#ffffff",
    })

    const historicalAreaData = sanitizeAreaSeriesData(
      safeHistorical.map((d) => ({ time: d.time, value: d.close })),
    )
    if (historicalAreaData.length > 0) {
      historicalAreaSeries.setData(historicalAreaData as AreaData<Time>[])
    } else {
      historicalAreaSeries.setData([])
    }

    // ── 2. Volume Histogram ─────────────────────────────────────────────────
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    })
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
      visible: false,
    })
    const volumeData: LightweightHistogramDatum[] = safeHistorical.map((d) => ({
      time: d.time as Time,
      value: d.volume,
      color:
        Number.isFinite(d.open) && d.close >= d.open
          ? isDark ? "rgba(0,255,204,0.15)" : "rgba(13,148,136,0.15)"
          : isDark ? "rgba(255,77,109,0.15)" : "rgba(225,29,72,0.15)",
    }))
    const forecastVolume: LightweightHistogramDatum[] = safePredictions.map((p) => ({
      time: p.time as Time,
      value: 320,
      color: isDark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.08)",
    }))
    volumeSeries.setData(finalizeHistogramDataset([...volumeData, ...forecastVolume]))

    // ── 3. Forecast Area Series ─────────────────────────────────────────────
    if (safePredictions.length > 0) {
      const lastHistoricalBar =
        safeHistorical.length > 0 ? safeHistorical[safeHistorical.length - 1] : null
      const firstForecastTime = safePredictions[0].time as number
      const bridgeTime = (
        lastHistoricalBar != null ? lastHistoricalBar.time : firstForecastTime - 86400
      ) as Time
      const resolvedLastPredicted =
        typeof lastPredictedValue === "number" && Number.isFinite(lastPredictedValue)
          ? lastPredictedValue
          : undefined
      const bridgeRawValue =
        lastHistoricalBar != null
          ? lastHistoricalBar.close
          : (resolvedLastPredicted ?? safePredictions[0].value)

      const forecastAreaSeries = chart.addSeries(AreaSeries, {
        lineColor: isDark ? "rgba(96,165,250,0.9)" : "rgba(37,99,235,0.9)",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        topColor: isDark ? "rgba(59,130,246,0.25)" : "rgba(37,99,235,0.2)",
        bottomColor: isDark ? "rgba(59,130,246,0.0)" : "rgba(37,99,235,0.0)",
        priceLineVisible: true,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 5,
        crosshairMarkerBorderColor: isDark ? "#60a5fa" : "#2563eb",
        crosshairMarkerBackgroundColor: isDark ? "#000000" : "#ffffff",
      })

      const forecastData = sanitizeAreaSeriesData([
        { time: bridgeTime, value: bridgeRawValue },
        ...safePredictions.map((p) => ({ time: p.time, value: p.value })),
      ])
      if (forecastData.length > 0) {
        forecastAreaSeries.setData(forecastData as AreaData<Time>[])
      }

      const hasCi = safePredictions.some((p) => {
        const hi = p.ciHigh
        return typeof hi === "number" && Number.isFinite(hi)
      })
      if (hasCi) {
        const ciBandSeries = chart.addSeries(AreaSeries, {
          lineColor: isDark ? "rgba(96,165,250,0.15)" : "rgba(37,99,235,0.1)",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          topColor: isDark ? "rgba(59,130,246,0.08)" : "rgba(37,99,235,0.06)",
          bottomColor: "rgba(0,0,0,0)",
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        const ciData = sanitizeAreaSeriesData([
          { time: bridgeTime, value: bridgeRawValue },
          ...safePredictions
            .filter((p) => typeof p.ciHigh === "number" && Number.isFinite(p.ciHigh))
            .map((p) => {
              const cappedBundleExclusiveOuter =
                clampForecastConfidenceIntervalPairForVisualizationExclusive({
                  midpointExclusive: p.value,
                  intervalHighExclusive: p.ciHigh,
                  intervalLowExclusive:
                    typeof p.ciLow === "number" && Number.isFinite(p.ciLow) ? p.ciLow : undefined,
                })
              const displayedHighFenceExclusiveOuter =
                typeof cappedBundleExclusiveOuter.intervalHighExclusive === "number"
                  ? cappedBundleExclusiveOuter.intervalHighExclusive
                  : p.ciHigh!
              return { time: p.time, value: displayedHighFenceExclusiveOuter }
            }),
        ])
        if (ciData.length > 0) {
          ciBandSeries.setData(ciData as AreaData<Time>[])
        }
      }
    }

    chart.timeScale().fitContent()

    // ── Tooltip ─────────────────────────────────────────────────────────────
    chart.subscribeCrosshairMove((param) => {
      const tooltip = tooltipRef.current
      if (!tooltip) return

      if (
        !param.time ||
        param.point === undefined ||
        param.point.x < 0 ||
        param.point.x > (chartContainerRef.current?.clientWidth || 0) ||
        param.point.y < 0 ||
        param.point.y > (chartContainerRef.current?.clientHeight || 0)
      ) {
        tooltip.style.display = "none"
        return
      }

      const time = param.time as number
      const formattedDate = format(new Date(time * 1000), "MMM d, yyyy HH:mm")

      const actualClose = safeHistorical.find((d) => d.time === time)?.close
      const modelAtTime = safePredictions.find((p) => p.time === time)?.value
      const actualOk = typeof actualClose === "number" && Number.isFinite(actualClose)
      const modelOk = typeof modelAtTime === "number" && Number.isFinite(modelAtTime)

      if (!actualOk && !modelOk) {
        tooltip.style.display = "none"
        return
      }

      const fmt = (n: number) =>
        n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })

      tooltip.style.display = "block"
      tooltip.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"};padding-bottom:8px;margin-bottom:2px">
            <span style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:${isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.35)"}">${formattedDate}</span>
          </div>
          ${actualOk ? `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
            <span style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.12em;color:${isDark ? "#00ffcc" : "#0d9488"}">Actual close</span>
            <span style="font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;color:${isDark ? "#ffffff" : "#000000"}">${fmt(actualClose)}</span>
          </div>` : ""}
          ${modelOk ? `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
            <span style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.12em;color:${isDark ? "#60a5fa" : "#2563eb"}">Model forecast</span>
            <span style="font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;color:${isDark ? "#ffffff" : "#000000"}">${fmt(modelAtTime)}</span>
          </div>` : ""}
        </div>
      `

      let x = param.point.x + 15
      let y = param.point.y + 15
      if (x > (chartContainerRef.current?.clientWidth || 0) - 220) x = param.point.x - 230
      if (y > (chartContainerRef.current?.clientHeight || 0) - 130) y = param.point.y - 140
      tooltip.style.left = x + "px"
      tooltip.style.top = y + "px"
    })

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
    }
  }, [historicalData, predictions, isDark, lastPredictedValue])

  return (
    <div className="relative h-full w-full overflow-hidden [&_a]:hidden [&_.tv-lightweight-charts-logo]:hidden">
      <div
        className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-background/70 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/50"
        aria-hidden
      >
        <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
          <span className="size-1.5 shrink-0 rounded-full bg-teal-400" />
          Actual (close)
        </span>
        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <span className="size-1.5 shrink-0 rounded-full bg-blue-400" />
          Model forecast
        </span>
      </div>
      <div ref={chartContainerRef} className="h-full w-full" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-50 hidden min-w-[190px] rounded-xl border border-border/50 bg-background/80 p-3.5 shadow-2xl backdrop-blur-xl dark:bg-black/80 dark:border-white/10"
        style={{ transition: "none" }}
      />
    </div>
  )
}
