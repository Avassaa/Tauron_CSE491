/**
 * Confidence intervals from the compounded path widen quickly in calendar time.
 * Stored values stay faithful to geometry; visualization clamps relative spread so candles
 * and area overlays remain readable versus the midpoint path.
 */

const FORECAST_BAND_DISPLAY_RELATIVE_HALF_WIDTH_CAP_EXCLUSIVE = 0.07

export function clampForecastConfidenceIntervalPairForVisualizationExclusive(payload: Readonly<{
  midpointExclusive: number
  intervalHighExclusive?: number | undefined
  intervalLowExclusive?: number | undefined
}>): Readonly<{ intervalHighExclusive: number | undefined; intervalLowExclusive: number | undefined }> {
  const midpointNumericExclusive = payload.midpointExclusive
  const rawHighFenceExclusive = payload.intervalHighExclusive
  const rawLowFenceExclusive = payload.intervalLowExclusive
  const absoluteMidpointAnchoringExclusive =
    midpointNumericExclusive > 0 ? midpointNumericExclusive : -midpointNumericExclusive
  const capHalfExclusive =
    FORECAST_BAND_DISPLAY_RELATIVE_HALF_WIDTH_CAP_EXCLUSIVE * Math.max(absoluteMidpointAnchoringExclusive, 1e-9)
  if (
    rawHighFenceExclusive == null ||
    rawLowFenceExclusive == null ||
    !Number.isFinite(rawHighFenceExclusive) ||
    !Number.isFinite(rawLowFenceExclusive) ||
    !Number.isFinite(midpointNumericExclusive)
  ) {
    return {
      intervalHighExclusive:
        typeof rawHighFenceExclusive === "number" && Number.isFinite(rawHighFenceExclusive)
          ? rawHighFenceExclusive
          : undefined,
      intervalLowExclusive:
        typeof rawLowFenceExclusive === "number" && Number.isFinite(rawLowFenceExclusive)
          ? rawLowFenceExclusive
          : undefined,
    }
  }
  let resolvedHighFenceExclusive = Math.min(rawHighFenceExclusive, midpointNumericExclusive + capHalfExclusive)
  let resolvedLowFenceExclusive = Math.max(rawLowFenceExclusive, midpointNumericExclusive - capHalfExclusive)
  if (resolvedHighFenceExclusive < resolvedLowFenceExclusive) {
    const midpointBetweenExclusive =
      (Math.min(rawHighFenceExclusive, rawLowFenceExclusive) + Math.max(rawHighFenceExclusive, rawLowFenceExclusive)) / 2
    resolvedHighFenceExclusive = midpointBetweenExclusive + 1e-6
    resolvedLowFenceExclusive = midpointBetweenExclusive - 1e-6
  }
  return {
    intervalHighExclusive: resolvedHighFenceExclusive,
    intervalLowExclusive: resolvedLowFenceExclusive,
  }
}
