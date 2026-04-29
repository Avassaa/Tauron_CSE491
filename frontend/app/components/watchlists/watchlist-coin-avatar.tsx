import * as React from "react"
import { type AssetResponse } from "~/lib/api-client"
import {
  Avatar,
  AvatarFallback,
} from "~/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"

export function WatchlistCoinAvatar({ asset }: { asset: AssetResponse }) {
  const [fallbackTried, setFallbackTried] = React.useState(false)
  const [errored, setErrored] = React.useState(false)

  React.useEffect(() => {
    setFallbackTried(false)
    setErrored(false)
  }, [asset.symbol])

  const iconUrl = fallbackTried
    ? `https://assets.coincap.io/assets/icons/${asset.symbol.toLowerCase()}@2x.png`
    : `https://cryptoicons.org/api/icon/${asset.symbol.toLowerCase()}/64`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar size="sm">
          {!errored ? (
            <img
              src={iconUrl}
              alt={`${asset.symbol} icon`}
              className="size-full object-cover"
              onError={() => {
                if (!fallbackTried) {
                  setFallbackTried(true)
                  return
                }
                setErrored(true)
              }}
            />
          ) : null}
          <AvatarFallback className="text-[9px] font-black">
            {asset.symbol.slice(0, 3).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>
        {asset.name} ({asset.symbol})
      </TooltipContent>
    </Tooltip>
  )
}
