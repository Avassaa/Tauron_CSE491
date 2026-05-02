"use client"

import * as React from "react"

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min
}

/** Four pools/streaks: random anchor each load (blue “emergency light on glass”). */
const LIGHT_COUNT = 4

export function GlassBackdropSeed() {
  React.useLayoutEffect(() => {
    const root = document.documentElement
    for (let i = 1; i <= LIGHT_COUNT; i++) {
      root.style.setProperty(`--glass-light-${i}-x`, `${rnd(12, 88)}%`)
      root.style.setProperty(`--glass-light-${i}-y`, `${rnd(10, 90)}%`)
    }
  }, [])

  return null
}
