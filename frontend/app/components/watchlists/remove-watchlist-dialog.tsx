import * as React from "react"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { type WatchlistListResponse } from "~/lib/api-client"

interface RemoveWatchlistDialogProps {
  watchlist: WatchlistListResponse | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  loading?: boolean
}

export function RemoveWatchlistDialog({
  watchlist,
  onOpenChange,
  onConfirm,
  loading = false,
}: RemoveWatchlistDialogProps) {
  return (
    <Dialog open={watchlist !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove Watchlist</DialogTitle>
          <DialogDescription>
            Remove "{watchlist?.name}" and all assets tracked inside it. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={loading}
          >
            {loading ? "Removing..." : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
