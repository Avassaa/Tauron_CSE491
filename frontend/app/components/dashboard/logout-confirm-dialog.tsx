"use client"

import * as React from "react"
import { LogOut, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Button } from "~/components/ui/button"

interface LogoutConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function LogoutConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
}: LogoutConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Optimized dimensions and typography */}
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="top-[40%] w-[92vw] max-w-[420px] translate-y-[-40%] overflow-hidden border-none bg-transparent p-0 shadow-none ring-0 focus:ring-0 focus-visible:ring-0 rounded-[2.5rem]"
      >
        {/* Liquid Glass Background Layers */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-[2.5rem]">
          {/* Deep Glows */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.15),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(79,70,229,0.1),transparent_70%)]" />

          {/* Noise Texture (Simulated via SVG filter or subtle overlay) */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        </div>

        {/* Theme-reactive Surface with Liquid Glass borders */}
        <div className="relative z-10 overflow-hidden border border-white/20 bg-white/60 p-6 shadow-2xl backdrop-blur-[40px] dark:border-white/10 dark:bg-zinc-900/70 rounded-[2.5rem]">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
              <LogOut className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogHeader className="text-left space-y-0.5">
                <DialogTitle className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                  Sign out?
                </DialogTitle>
                <DialogDescription className="text-[0.8125rem] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Are you sure you want to log out of your dashboard?
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2.5 sm:justify-end">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-10 flex-1 rounded-xl border border-zinc-200/50 bg-zinc-100/50 px-3 text-[0.8125rem] font-semibold text-zinc-600 transition-all hover:bg-zinc-200/50 hover:text-zinc-900 dark:border-white/5 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white sm:flex-initial sm:min-w-[100px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              className="h-10 flex-1 rounded-xl bg-red-600 px-3 text-[0.8125rem] font-bold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-500 hover:shadow-red-600/40 active:scale-95 sm:flex-initial sm:min-w-[110px]"
            >
              Sign Out
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
