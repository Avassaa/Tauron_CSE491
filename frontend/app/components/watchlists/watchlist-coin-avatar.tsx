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
import { AssetIcon } from "~/components/asset-icon"

export function WatchlistCoinAvatar({ asset }: { asset: AssetResponse }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar size="sm">
          <AssetIcon symbol={asset.symbol} alt={`${asset.symbol} icon`} />
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
