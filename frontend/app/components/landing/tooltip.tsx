'use client';

import * as React from 'react';
import { cn } from "~/lib/utils";

const TooltipContext = React.createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
  delayDuration: number;
}>({
  open: false,
  setOpen: () => {},
  delayDuration: 0,
});

export function TooltipProvider({
  children,
  delayDuration = 0,
}: {
  children: React.ReactNode;
  delayDuration?: number;
}) {
  return <>{children}</>;
}

export function Tooltip({
  children,
  delayDuration = 0,
}: {
  children: React.ReactNode;
  delayDuration?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = React.useCallback(() => {
    if (delayDuration > 0) {
      timeoutRef.current = setTimeout(() => setOpen(true), delayDuration);
    } else {
      setOpen(true);
    }
  }, [delayDuration]);

  const hide = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpen(false);
  }, []);

  React.useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <TooltipContext.Provider value={{ open, setOpen, delayDuration }}>
      <div
        className="relative inline-flex"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  if (!asChild || !React.isValidElement(children)) {
    return <>{children}</>;
  }
  return <>{children}</>;
}

export function TooltipContent({
  children,
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { open } = React.useContext(TooltipContext);

  if (!open) return null;

  return (
    <div
      role="tooltip"
      className={cn(
        'absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
