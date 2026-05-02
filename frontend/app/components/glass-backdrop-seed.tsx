"use client"

import * as React from "react"

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min
}

/** Six soft pools: random anchor each load (blue “emergency light on glass”). Wider range = more of the page covered. */
const LIGHT_COUNT = 6

export function GlassBackdropSeed() {
  React.useLayoutEffect(() => {
    const root = document.documentElement
    for (let i = 1; i <= LIGHT_COUNT; i++) {
      root.style.setProperty(`--glass-light-${i}-x`, `${rnd(4, 96)}%`)
      root.style.setProperty(`--glass-light-${i}-y`, `${rnd(4, 96)}%`)
    }
  }, [])

  return null
}
