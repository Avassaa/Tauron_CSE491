import * as React from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { type WatchlistListResponse } from "~/lib/api-client"

interface RenameWatchlistDialogProps {
  watchlist: WatchlistListResponse | null
  onOpenChange: (open: boolean) => void
  onConfirm: (newName: string) => Promise<void>
  loading?: boolean
}

export function RenameWatchlistDialog({
  watchlist,
  onOpenChange,
  onConfirm,
  loading = false,
}: RenameWatchlistDialogProps) {
  const [name, setName] = React.useState("")

  React.useEffect(() => {
    if (watchlist) {
      setName(watchlist.name)
    } else {
      setName("")
    }
  }, [watchlist])

  const handleRename = async () => {
    const trimmed = name.trim()
    if (!trimmed || !watchlist) return
    await onConfirm(trimmed)
  }

  return (
    <Dialog open={watchlist !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Watchlist</DialogTitle>
          <DialogDescription>
            Update the name shown on the watchlists page.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Watchlist name"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) {
              e.preventDefault()
              void handleRename()
            }
          }}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleRename()} disabled={loading || !name.trim() || name === watchlist?.name}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
