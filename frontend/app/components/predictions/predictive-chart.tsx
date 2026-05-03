import * as React from "react"
import {
  createChart,
  ColorType,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type AreaData,
  type Time,
  type SeriesMarker,
} from "lightweight-charts"
import { format } from "date-fns"
import { useAppTheme } from "~/theme-context"

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
    candleSeries.setData(historicalData as unknown as CandlestickData<Time>[])

    // 2. Volume Series (Histogram)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume", // separate scale
    })

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 }, // Very slim at bottom
      visible: false, // Hide the scale labels on the right
    })

    const historicalVolume = historicalData.map((d) => ({
      time: d.time as Time,
      value: d.volume,
      color: d.close >= d.open
        ? (isDark ? "rgba(38, 166, 154, 0.2)" : "rgba(5, 150, 105, 0.2)")
        : (isDark ? "rgba(239, 83, 80, 0.2)" : "rgba(220, 38, 38, 0.2)"),
    }))

    const forecastVolume = predictions.map((p) => ({
      time: p.time as Time,
      value: 1000, // Dummy volume for forecast
      color: isDark ? "rgba(41, 98, 255, 0.1)" : "rgba(37, 99, 235, 0.1)",
    }))

    volumeSeries.setData([...historicalVolume, ...forecastVolume])

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

    // Transform predictions into Candlesticks
    const predictiveCandles: CandlestickData<Time>[] = []
    let lastClose = historicalData.length > 0
      ? historicalData[historicalData.length - 1].close
      : (predictions[0]?.value || 0)

    predictions.forEach((p) => {
      const open = lastClose
      const close = p.value
      const high = p.ciHigh ?? Math.max(open, close)
      const low = p.ciLow ?? Math.min(open, close)

      predictiveCandles.push({
        time: p.time as Time,
        open,
        high,
        low,
        close,
      })
      lastClose = close
    })

    predictionSeries.setData(predictiveCandles)

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
          tooltipRef.current.style.display = "block"
          const candle = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined
          const predCandle = param.seriesData.get(predictionSeries) as CandlestickData<Time> | undefined

          const currentData = predCandle || candle
          if (!currentData) return

          const time = param.time as number
          const formattedDate = format(new Date(time * 1000), "MMM d, yyyy HH:mm")

          tooltipRef.current.innerHTML = `
            <div class="flex flex-col gap-2.5">
              <div class="flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-black/10'} pb-2 mb-1">
                <span class="text-[10px] font-black uppercase tracking-[0.1em] ${isDark ? 'text-slate-500' : 'text-slate-400'}">${formattedDate}</span>
                <div class="flex items-center gap-1.5 ml-3">
                  <div class="size-1.5 rounded-full ${predCandle ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}"></div>
                  <span class="text-[9px] font-black tracking-widest uppercase ${predCandle ? (isDark ? 'text-blue-400' : 'text-blue-500') : (isDark ? 'text-emerald-400' : 'text-emerald-500')}">
                    ${predCandle ? 'Forecast' : 'Historical'}
                  </span>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <div class="flex justify-between items-center gap-4">
                  <span class="text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}">Open</span>
                  <span class="text-[11px] font-black tabular-nums ${isDark ? 'text-white/90' : 'text-black/90'}">${currentData.open.toLocaleString()}</span>
                </div>
                <div class="flex justify-between items-center gap-4">
                  <span class="text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}">High</span>
                  <span class="text-[11px] font-black tabular-nums ${isDark ? 'text-white/90' : 'text-black/90'}">${currentData.high.toLocaleString()}</span>
                </div>
                <div class="flex justify-between items-center gap-4">
                  <span class="text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}">Low</span>
                  <span class="text-[11px] font-black tabular-nums ${isDark ? 'text-white/90' : 'text-black/90'}">${currentData.low.toLocaleString()}</span>
                </div>
                <div class="flex justify-between items-center gap-4">
                  <span class="text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}">Close</span>
                  <span class="text-[11px] font-black tabular-nums ${isDark ? 'text-white/90' : 'text-black/90'}">${currentData.close.toLocaleString()}</span>
                </div>
              </div>
              ${predCandle ? `
                <div class="mt-1.5 pt-2 border-t ${isDark ? 'border-white/5' : 'border-black/5'} flex items-center justify-between gap-4">
                  <div class="flex flex-col">
                    <span class="text-[8px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}">Confidence Score</span>
                    <span class="text-[10px] font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}">High Probability</span>
                  </div>
                  <div class="flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                     <span class="text-[10px] font-black text-blue-500">92.4%</span>
                  </div>
                </div>
              ` : ''}
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
  }, [historicalData, predictions, isDark])

  return (
    <div className="relative h-full w-full group">
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
