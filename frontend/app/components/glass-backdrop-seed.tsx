"use client"

import * as React from "react"

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min
}

const ANCHORS = {
  /** Strong tint near top edge */
  top: () => ({ x: rnd(22, 78), y: rnd(3, 16) }),
  /** Strong tint near bottom edge */
  bottom: () => ({ x: rnd(22, 78), y: rnd(84, 97) }),
  bottomLeft: () => ({ x: rnd(6, 26), y: rnd(76, 97) }),
  bottomRight: () => ({ x: rnd(74, 94), y: rnd(76, 97) }),
  topLeft: () => ({ x: rnd(6, 26), y: rnd(3, 20) }),
  topRight: () => ({ x: rnd(74, 94), y: rnd(3, 20) }),
  left: () => ({ x: rnd(4, 16), y: rnd(28, 72) }),
  right: () => ({ x: rnd(84, 96), y: rnd(28, 72) }),
  center: () => ({ x: rnd(38, 62), y: rnd(38, 62) }),
} as const

type AnchorKey = keyof typeof ANCHORS

function pickDistinctAnchors(): [AnchorKey, AnchorKey] {
  const keys = Object.keys(ANCHORS) as AnchorKey[]
  const a1 = keys[Math.floor(Math.random() * keys.length)]!
  let a2 = keys[Math.floor(Math.random() * keys.length)]!
  let guard = 0
  while (a2 === a1 && guard++ < 12) {
    a2 = keys[Math.floor(Math.random() * keys.length)]!
  }
  return [a1, a2]
}

/** Linear-gradient angle: first stop hugs the edge that matches the primary anchor. */
function lineAngleForPrimary(anchor: AnchorKey): number {
  switch (anchor) {
    case "bottom":
    case "bottomLeft":
    case "bottomRight":
      return rnd(-18, 18)
    case "top":
    case "topLeft":
    case "topRight":
      return rnd(168, 192)
    case "left":
      return rnd(80, 100)
    case "right":
      return rnd(260, 280)
    case "center":
    default:
      return rnd(0, 360)
  }
}

function ellipseFor(anchor: AnchorKey) {
  if (anchor === "center") {
    return { sx: rnd(92, 128), sy: rnd(88, 118) }
  }
  if (
    anchor === "bottomLeft" ||
    anchor === "bottomRight" ||
    anchor === "topLeft" ||
    anchor === "topRight"
  ) {
    return { sx: rnd(64, 96), sy: rnd(58, 92) }
  }
  return { sx: rnd(76, 112), sy: rnd(70, 104) }
}

/**
 * Sets `--glass-*` on `<html>`: two radial washes at randomly chosen screen regions
 * (bottom, center, corners, etc.) plus a linear wash aligned to the primary region.
 */
export function GlassBackdropSeed() {
  React.useLayoutEffect(() => {
    const root = document.documentElement
    const [primary, secondary] = pickDistinctAnchors()
    const p1 = ANCHORS[primary]()
    const p2 = ANCHORS[secondary]()
    const e1 = ellipseFor(primary)
    const e2 = ellipseFor(secondary)

    root.style.setProperty("--glass-gradient-angle", `${lineAngleForPrimary(primary)}deg`)
    root.style.setProperty("--glass-r1-x", `${p1.x}%`)
    root.style.setProperty("--glass-r1-y", `${p1.y}%`)
    root.style.setProperty("--glass-r2-x", `${p2.x}%`)
    root.style.setProperty("--glass-r2-y", `${p2.y}%`)
    root.style.setProperty("--glass-r1-sx", `${e1.sx}%`)
    root.style.setProperty("--glass-r1-sy", `${e1.sy}%`)
    root.style.setProperty("--glass-r2-sx", `${e2.sx}%`)
    root.style.setProperty("--glass-r2-sy", `${e2.sy}%`)
  }, [])

  return null
}
