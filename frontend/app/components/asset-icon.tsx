"use client"

import * as React from "react"

import { cn } from "~/lib/utils"

type AssetIconProps = {
  symbol: string
  alt?: string
  className?: string
  fallbackClassName?: string
}

export function AssetIcon({
  symbol,
  alt,
  className,
  fallbackClassName,
}: AssetIconProps) {
  const [sourceIndex, setSourceIndex] = React.useState(0)
  const normalizedSymbol = symbol.toLowerCase()
  const sources = [
    `https://assets.coincap.io/assets/icons/${normalizedSymbol}@2x.png`,
    `https://cryptoicons.org/api/icon/${normalizedSymbol}/64`,
  ]

  React.useEffect(() => {
    setSourceIndex(0)
  }, [symbol])

  if (sourceIndex >= sources.length) {
    return (
      <span
        className={cn(
          "flex size-full items-center justify-center font-black uppercase text-primary",
          fallbackClassName
        )}
      >
        {symbol.slice(0, 3).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={sources[sourceIndex]}
      alt={alt ?? `${symbol} icon`}
      className={cn("size-full object-contain", className)}
      onError={() => setSourceIndex((current) => current + 1)}
    />
  )
}
