"use client"

import { Button } from "~/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { Separator } from "~/components/ui/separator"

export function SidebarUserMenu() {
  return (
    <Popover>
      <Separator className="my-3" />
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
        asChild
      >
      </Button>
    </Popover>
  )
}
