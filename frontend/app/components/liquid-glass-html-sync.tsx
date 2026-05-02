"use client"

import * as React from "react"

import {
  onLiquidGlassChange,
  syncLiquidGlassDocumentAttribute,
} from "~/lib/liquid-glass-preferences"

/** Applies ``data-solid-cards`` on `<html>` from localStorage (see `app.css`). */
export function LiquidGlassHtmlSync() {
  React.useEffect(() => {
    syncLiquidGlassDocumentAttribute()
    return onLiquidGlassChange(() => {
      syncLiquidGlassDocumentAttribute()
    })
  }, [])
  return null
}
