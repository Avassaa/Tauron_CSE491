"use client"

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

interface CreateWatchlistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => Promise<void>
  loading?: boolean
}

export function CreateWatchlistDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: CreateWatchlistDialogProps) {
  const [name, setName] = React.useState("")

  React.useEffect(() => {
    if (!open) setName("")
  }, [open])

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await onConfirm(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Watchlist</DialogTitle>
          <DialogDescription>
            Enter a name to create a watchlist for this account.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Long Term, Scalps, AI Picks"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) {
              e.preventDefault()
              void handleCreate()
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
          <Button onClick={() => void handleCreate()} disabled={loading || !name.trim()}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
