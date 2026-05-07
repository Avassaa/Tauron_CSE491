import type { Time } from "lightweight-charts"

export type LightweightHistogramDatum = {
  time: Time
  value: number
  color: string
}

export function coerceHistogramVolume(candidate: unknown): number {
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate
  }
  if (typeof candidate === "string" && candidate.trim() !== "") {
    const parsedNumber = Number(candidate.trim())
    if (Number.isFinite(parsedNumber)) {
      return parsedNumber
    }
  }
  return 0
}

export function coerceFiniteSeriesValue(candidate: unknown): number | undefined {
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate
  }
  if (typeof candidate === "string" && candidate.trim() !== "") {
    const parsedNumber = Number(candidate.trim())
    if (Number.isFinite(parsedNumber)) {
      return parsedNumber
    }
  }
  return undefined
}

/** Ascending time, finite values only, duplicate timestamps keep the last row (model beats bridge when both exist). */
export function sanitizeAreaSeriesData(
  entries: ReadonlyArray<{ time: Time | number; value: unknown }>,
): { time: Time; value: number }[] {
  const normalized = entries
    .map((entry) => ({
      unixSeconds: Number(entry.time),
      value: coerceFiniteSeriesValue(entry.value),
    }))
    .filter((row) => Number.isFinite(row.unixSeconds) && row.value !== undefined)

  normalized.sort((a, b) => a.unixSeconds - b.unixSeconds)

  const dedupedAscending: { time: Time; value: number }[] = []
  for (const row of normalized) {
    const prior = dedupedAscending[dedupedAscending.length - 1]
    if (prior != null && Number(prior.time) === row.unixSeconds) {
      dedupedAscending[dedupedAscending.length - 1] = {
        time: row.unixSeconds as Time,
        value: row.value!,
      }
    } else {
      dedupedAscending.push({
        time: row.unixSeconds as Time,
        value: row.value!,
      })
    }
  }
  return dedupedAscending
}

export function finalizeHistogramDataset(entries: LightweightHistogramDatum[]): LightweightHistogramDatum[] {
  const normalized = entries.map((entry) => ({
    unixSeconds: Number(entry.time),
    value: coerceHistogramVolume(entry.value),
    color:
      typeof entry.color === "string" && entry.color.length > 0
        ? entry.color
        : "rgba(148,149,157,0.25)",
  }))

  const finiteOnly = normalized.filter((row) => Number.isFinite(row.unixSeconds))
  finiteOnly.sort((a, b) => a.unixSeconds - b.unixSeconds)

  const ordered: LightweightHistogramDatum[] = []
  let priorUnixSeconds: number | null = null
  for (const row of finiteOnly) {
    if (priorUnixSeconds === row.unixSeconds) {
      continue
    }
    priorUnixSeconds = row.unixSeconds
    ordered.push({
      time: row.unixSeconds as Time,
      value: row.value,
      color: row.color,
    })
  }

  return ordered
}
