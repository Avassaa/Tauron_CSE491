import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, UNSAFE_withComponentProps, Outlet, UNSAFE_withErrorBoundaryProps, isRouteErrorResponse, Meta, Links, ScrollRestoration, Scripts } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import * as React from "react";
import React__default, { createContext, useRef, useId as useId$1, useState as useState$1, useMemo, useEffect as useEffect$1, useCallback, Children, isValidElement, useContext, useLayoutEffect } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { FileTextIcon, CalendarIcon } from "@radix-ui/react-icons";
import { ArrowRight, BellIcon, Share2Icon, ShieldCheck, Lightbulb, Users, Github, Linkedin, ChevronUp, Mail, Share2, Fingerprint, Zap, TrendingUp } from "lucide-react";
import { localPoint } from "@visx/event";
import { curveMonotoneX } from "@visx/curve";
import { GridRows, GridColumns } from "@visx/grid";
import { ParentSize } from "@visx/responsive";
import { scaleTime, scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { bisector } from "d3-array";
import { useSpring, useMotionTemplate, motion, AnimatePresence } from "motion/react";
import useMeasure from "react-use-measure";
import { createPortal } from "react-dom";
const streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders
    });
  }
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");
    let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
    let timeoutId = setTimeout(
      () => abort(),
      streamTimeout + 1e3
    );
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId);
              timeoutId = void 0;
              callback();
            }
          });
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          pipe(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
function cn$1(...inputs) {
  return twMerge(clsx(inputs));
}
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return /* @__PURE__ */ jsx(
      Comp,
      {
        className: cn$1(buttonVariants({ variant, size, className })),
        ref,
        ...props
      }
    );
  }
);
Button.displayName = "Button";
function MenuToggleIcon({
  open,
  className,
  fill = "none",
  stroke = "currentColor",
  strokeWidth = 2.5,
  strokeLinecap = "round",
  strokeLinejoin = "round",
  duration = 500,
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      strokeWidth,
      fill,
      stroke,
      viewBox: "0 0 32 32",
      strokeLinecap,
      strokeLinejoin,
      className: cn$1(
        "transition-transform ease-in-out",
        open && "-rotate-45",
        className
      ),
      style: {
        transitionDuration: `${duration}ms`
      },
      ...props,
      children: [
        /* @__PURE__ */ jsx(
          "path",
          {
            className: cn$1(
              "transition-all ease-in-out",
              open ? "[stroke-dasharray:20_300] [stroke-dashoffset:-32.42px]" : "[stroke-dasharray:12_63]"
            ),
            style: {
              transitionDuration: `${duration}ms`
            },
            d: "M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
          }
        ),
        /* @__PURE__ */ jsx("path", { d: "M7 16 27 16" })
      ]
    }
  );
}
function useScroll(threshold) {
  const [scrolled, setScrolled] = React__default.useState(false);
  const onScroll = React__default.useCallback(() => {
    if (typeof window === "undefined") return;
    setScrolled(window.scrollY > threshold);
  }, [threshold]);
  React__default.useEffect(() => {
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);
  React__default.useEffect(() => {
    onScroll();
  }, [onScroll]);
  return scrolled;
}
function Header() {
  const [open, setOpen] = React__default.useState(false);
  const scrolled = useScroll(10);
  const links2 = [
    { label: "Features", href: "#" },
    { label: "Pricing", href: "#" },
    { label: "About", href: "/about" }
  ];
  React__default.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return /* @__PURE__ */ jsxs(
    "header",
    {
      className: cn$1(
        "sticky top-0 z-50 mx-auto w-full max-w-5xl border-b border-transparent md:rounded-xl md:border md:transition-all md:ease-out",
        !scrolled && !open && "bg-transparent",
        (scrolled || open) && "border-white/10 bg-black/25 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-black/20",
        {
          "md:top-4 md:max-w-4xl md:shadow-xl": scrolled && !open,
          "bg-black/30": open
        }
      ),
      children: [
        /* @__PURE__ */ jsxs(
          "nav",
          {
            className: cn$1(
              "flex h-14 w-full items-center justify-between px-4 text-white/90 md:h-12 md:transition-all md:ease-out",
              { "md:px-2": scrolled }
            ),
            children: [
              /* @__PURE__ */ jsx("a", { href: "/", className: "cursor-pointer text-3xl font-semibold tracking-tight text-white no-underline hover:text-white md:text-4xl", style: { fontFamily: "'Dancing Script', cursive" }, children: "Tauron" }),
              /* @__PURE__ */ jsxs("div", { className: "hidden items-center gap-2 md:flex", children: [
                links2.map((link, i) => /* @__PURE__ */ jsx("a", { className: cn$1(buttonVariants({ variant: "ghost" }), "cursor-pointer text-white/90 hover:text-white hover:bg-white/10"), href: link.href, children: link.label }, i)),
                /* @__PURE__ */ jsx(Button, { variant: "outline", className: "cursor-pointer border-white/30 text-white hover:bg-white/10 hover:text-white", children: "Sign In" }),
                /* @__PURE__ */ jsx(Button, { className: "cursor-pointer bg-white text-black hover:bg-white/90", children: "Get Started" })
              ] }),
              /* @__PURE__ */ jsx(Button, { size: "icon", variant: "outline", onClick: () => setOpen(!open), className: "cursor-pointer border-white/30 text-white hover:bg-white/10 hover:text-white md:hidden", children: /* @__PURE__ */ jsx(MenuToggleIcon, { open, className: "size-5", duration: 300 }) })
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: cn$1(
              "fixed top-14 right-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden border-y border-white/10 bg-black/30 backdrop-blur-xl md:hidden",
              open ? "block" : "hidden"
            ),
            children: /* @__PURE__ */ jsxs(
              "div",
              {
                "data-slot": open ? "open" : "closed",
                className: cn$1(
                  "flex h-full w-full flex-col justify-between gap-y-2 p-4",
                  "data-[slot=open]:animate-in data-[slot=open]:zoom-in-95 data-[slot=closed]:animate-out data-[slot=closed]:zoom-out-95 ease-out"
                ),
                children: [
                  /* @__PURE__ */ jsx("div", { className: "grid gap-y-2", children: links2.map((link) => /* @__PURE__ */ jsx(
                    "a",
                    {
                      className: cn$1(
                        buttonVariants({ variant: "ghost", className: "justify-start" }),
                        "cursor-pointer text-white/90 hover:text-white hover:bg-white/10"
                      ),
                      href: link.href,
                      children: link.label
                    },
                    link.label
                  )) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
                    /* @__PURE__ */ jsx(Button, { variant: "outline", className: "w-full cursor-pointer border-white/30 text-white hover:bg-white/10 hover:text-white", children: "Sign In" }),
                    /* @__PURE__ */ jsx(Button, { className: "w-full cursor-pointer bg-white text-black hover:bg-white/90", children: "Get Started" })
                  ] })
                ]
              }
            )
          }
        )
      ]
    }
  );
}
const links = () => [{
  rel: "preconnect",
  href: "https://fonts.googleapis.com"
}, {
  rel: "preconnect",
  href: "https://fonts.gstatic.com",
  crossOrigin: "anonymous"
}, {
  rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
}, {
  rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500;600;700&display=swap"
}];
function Layout({
  children
}) {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      children: [children, /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
}
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx(Header, {}), /* @__PURE__ */ jsx(Outlet, {})]
  });
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2({
  error
}) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  }
  return /* @__PURE__ */ jsxs("main", {
    className: "pt-16 p-4 container mx-auto",
    children: [/* @__PURE__ */ jsx("h1", {
      children: message
    }), /* @__PURE__ */ jsx("p", {
      children: details
    }), stack]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  Layout,
  default: root,
  links
}, Symbol.toStringTag, { value: "Module" }));
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
const chartCssVars = {
  background: "var(--chart-background)",
  linePrimary: "var(--chart-line-primary)",
  crosshair: "var(--chart-crosshair)",
  grid: "var(--chart-grid)"
};
const ChartContext = createContext(null);
function ChartProvider({
  children,
  value
}) {
  return /* @__PURE__ */ jsx(ChartContext.Provider, { value, children });
}
function useChart() {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error(
      "useChart must be used within a ChartProvider. Make sure your component is wrapped in <AreaChart>."
    );
  }
  return context;
}
function useChartInteraction({
  xScale,
  yScale,
  data,
  lines,
  margin,
  xAccessor,
  bisectDate,
  canInteract
}) {
  const [tooltipData, setTooltipData] = useState$1(null);
  const [selection, setSelection] = useState$1(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const resolveTooltipFromX = useCallback(
    (pixelX) => {
      const x0 = xScale.invert(pixelX);
      const index = bisectDate(data, x0, 1);
      const d0 = data[index - 1];
      const d1 = data[index];
      if (!d0) {
        return null;
      }
      let d = d0;
      let finalIndex = index - 1;
      if (d1) {
        const d0Time = xAccessor(d0).getTime();
        const d1Time = xAccessor(d1).getTime();
        if (x0.getTime() - d0Time > d1Time - x0.getTime()) {
          d = d1;
          finalIndex = index;
        }
      }
      const yPositions = {};
      for (const line of lines) {
        const value = d[line.dataKey];
        if (typeof value === "number") {
          yPositions[line.dataKey] = yScale(value) ?? 0;
        }
      }
      return {
        point: d,
        index: finalIndex,
        x: xScale(xAccessor(d)) ?? 0,
        yPositions
      };
    },
    [xScale, yScale, data, lines, xAccessor, bisectDate]
  );
  const resolveIndexFromX = useCallback(
    (pixelX) => {
      const x0 = xScale.invert(pixelX);
      const index = bisectDate(data, x0, 1);
      const d0 = data[index - 1];
      const d1 = data[index];
      if (!d0) {
        return 0;
      }
      if (d1) {
        const d0Time = xAccessor(d0).getTime();
        const d1Time = xAccessor(d1).getTime();
        if (x0.getTime() - d0Time > d1Time - x0.getTime()) {
          return index;
        }
      }
      return index - 1;
    },
    [xScale, data, xAccessor, bisectDate]
  );
  const getChartX = useCallback(
    (event, touchIndex = 0) => {
      let point = null;
      if ("touches" in event) {
        const touch = event.touches[touchIndex];
        if (!touch) {
          return null;
        }
        const svg = event.currentTarget.ownerSVGElement;
        if (!svg) {
          return null;
        }
        point = localPoint(svg, touch);
      } else {
        point = localPoint(event);
      }
      if (!point) {
        return null;
      }
      return point.x - margin.left;
    },
    [margin.left]
  );
  const handleMouseMove = useCallback(
    (event) => {
      const chartX = getChartX(event);
      if (chartX === null) {
        return;
      }
      if (isDraggingRef.current) {
        const startX = Math.min(dragStartXRef.current, chartX);
        const endX = Math.max(dragStartXRef.current, chartX);
        setSelection({
          startX,
          endX,
          startIndex: resolveIndexFromX(startX),
          endIndex: resolveIndexFromX(endX),
          active: true
        });
        return;
      }
      const tooltip = resolveTooltipFromX(chartX);
      if (tooltip) {
        setTooltipData(tooltip);
      }
    },
    [getChartX, resolveTooltipFromX, resolveIndexFromX]
  );
  const handleMouseLeave = useCallback(() => {
    setTooltipData(null);
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
    }
    setSelection(null);
  }, []);
  const handleMouseDown = useCallback(
    (event) => {
      const chartX = getChartX(event);
      if (chartX === null) {
        return;
      }
      isDraggingRef.current = true;
      dragStartXRef.current = chartX;
      setTooltipData(null);
      setSelection(null);
    },
    [getChartX]
  );
  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
    }
    setSelection(null);
  }, []);
  const handleTouchStart = useCallback(
    (event) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        const chartX = getChartX(event, 0);
        if (chartX === null) {
          return;
        }
        const tooltip = resolveTooltipFromX(chartX);
        if (tooltip) {
          setTooltipData(tooltip);
        }
      } else if (event.touches.length === 2) {
        event.preventDefault();
        setTooltipData(null);
        const x0 = getChartX(event, 0);
        const x1 = getChartX(event, 1);
        if (x0 === null || x1 === null) {
          return;
        }
        const startX = Math.min(x0, x1);
        const endX = Math.max(x0, x1);
        setSelection({
          startX,
          endX,
          startIndex: resolveIndexFromX(startX),
          endIndex: resolveIndexFromX(endX),
          active: true
        });
      }
    },
    [getChartX, resolveTooltipFromX, resolveIndexFromX]
  );
  const handleTouchMove = useCallback(
    (event) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        const chartX = getChartX(event, 0);
        if (chartX === null) {
          return;
        }
        const tooltip = resolveTooltipFromX(chartX);
        if (tooltip) {
          setTooltipData(tooltip);
        }
      } else if (event.touches.length === 2) {
        event.preventDefault();
        const x0 = getChartX(event, 0);
        const x1 = getChartX(event, 1);
        if (x0 === null || x1 === null) {
          return;
        }
        const startX = Math.min(x0, x1);
        const endX = Math.max(x0, x1);
        setSelection({
          startX,
          endX,
          startIndex: resolveIndexFromX(startX),
          endIndex: resolveIndexFromX(endX),
          active: true
        });
      }
    },
    [getChartX, resolveTooltipFromX, resolveIndexFromX]
  );
  const handleTouchEnd = useCallback(() => {
    setTooltipData(null);
    setSelection(null);
  }, []);
  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);
  const interactionHandlers = canInteract ? {
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  } : {};
  const interactionStyle = {
    cursor: canInteract ? "crosshair" : "default",
    touchAction: "none"
  };
  return {
    tooltipData,
    setTooltipData,
    selection,
    clearSelection,
    interactionHandlers,
    interactionStyle
  };
}
const TICKER_ITEM_HEIGHT = 24;
function DateTicker({ currentIndex, labels, visible }) {
  const parsedLabels = useMemo(() => {
    return labels.map((label) => {
      const parts = label.split(" ");
      const month = parts[0] || "";
      const day = parts[1] || "";
      return { month, day, full: label };
    });
  }, [labels]);
  const monthIndices = useMemo(() => {
    const uniqueMonths = [];
    const indices = [];
    parsedLabels.forEach((label, index) => {
      if (uniqueMonths.length === 0 || uniqueMonths.at(-1) !== label.month) {
        uniqueMonths.push(label.month);
        indices.push(index);
      }
    });
    return { uniqueMonths, indices };
  }, [parsedLabels]);
  const currentMonthIndex = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= parsedLabels.length) {
      return 0;
    }
    const currentMonth = parsedLabels[currentIndex]?.month;
    return monthIndices.uniqueMonths.indexOf(currentMonth || "");
  }, [currentIndex, parsedLabels, monthIndices]);
  const prevMonthIndexRef = useRef(-1);
  const dayY = useSpring(0, { stiffness: 400, damping: 35 });
  const monthY = useSpring(0, { stiffness: 400, damping: 35 });
  useEffect$1(() => {
    dayY.set(-currentIndex * TICKER_ITEM_HEIGHT);
  }, [currentIndex, dayY]);
  useEffect$1(() => {
    if (currentMonthIndex >= 0) {
      const isFirstRender = prevMonthIndexRef.current === -1;
      const monthChanged = prevMonthIndexRef.current !== currentMonthIndex;
      if (isFirstRender || monthChanged) {
        monthY.set(-currentMonthIndex * TICKER_ITEM_HEIGHT);
        prevMonthIndexRef.current = currentMonthIndex;
      }
    }
  }, [currentMonthIndex, monthY]);
  if (!visible || labels.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsx(
    motion.div,
    {
      className: "overflow-hidden rounded-full bg-zinc-900 px-4 py-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900",
      layout: true,
      transition: {
        layout: { type: "spring", stiffness: 400, damping: 35 }
      },
      children: /* @__PURE__ */ jsx("div", { className: "relative h-6 overflow-hidden", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center gap-1", children: [
        /* @__PURE__ */ jsx("div", { className: "relative h-6 overflow-hidden", children: /* @__PURE__ */ jsx(motion.div, { className: "flex flex-col", style: { y: monthY }, children: monthIndices.uniqueMonths.map((month) => /* @__PURE__ */ jsx(
          "div",
          {
            className: "flex h-6 shrink-0 items-center justify-center",
            children: /* @__PURE__ */ jsx("span", { className: "whitespace-nowrap font-medium text-sm", children: month })
          },
          month
        )) }) }),
        /* @__PURE__ */ jsx("div", { className: "relative h-6 overflow-hidden", children: /* @__PURE__ */ jsx(motion.div, { className: "flex flex-col", style: { y: dayY }, children: parsedLabels.map((label, index) => /* @__PURE__ */ jsx(
          "div",
          {
            className: "flex h-6 shrink-0 items-center justify-center",
            children: /* @__PURE__ */ jsx("span", { className: "whitespace-nowrap font-medium text-sm", children: label.day })
          },
          `${label.day}-${index}`
        )) }) })
      ] }) })
    }
  );
}
function TooltipDot({
  x,
  y,
  visible,
  color,
  size = 5,
  strokeColor = chartCssVars.background,
  strokeWidth = 2
}) {
  const crosshairSpringConfig = { stiffness: 300, damping: 30 };
  const animatedX = useSpring(x, crosshairSpringConfig);
  const animatedY = useSpring(y, crosshairSpringConfig);
  useEffect$1(() => {
    animatedX.set(x);
    animatedY.set(y);
  }, [x, y, animatedX, animatedY]);
  if (!visible) {
    return null;
  }
  return /* @__PURE__ */ jsx(
    motion.circle,
    {
      cx: animatedX,
      cy: animatedY,
      fill: color,
      r: size,
      stroke: strokeColor,
      strokeWidth
    }
  );
}
function resolveWidth(width) {
  if (typeof width === "number") {
    return width;
  }
  switch (width) {
    case "line":
      return 1;
    case "thin":
      return 2;
    case "medium":
      return 4;
    case "thick":
      return 8;
    default:
      return 1;
  }
}
function TooltipIndicator({
  x,
  height,
  visible,
  width = "line",
  span,
  columnWidth,
  colorEdge = chartCssVars.crosshair,
  colorMid = chartCssVars.crosshair,
  fadeEdges = true,
  gradientId = "tooltip-indicator-gradient"
}) {
  const pixelWidth = span !== void 0 && columnWidth !== void 0 ? span * columnWidth : resolveWidth(width);
  const crosshairSpringConfig = { stiffness: 300, damping: 30 };
  const animatedX = useSpring(x - pixelWidth / 2, crosshairSpringConfig);
  useEffect$1(() => {
    animatedX.set(x - pixelWidth / 2);
  }, [x, animatedX, pixelWidth]);
  if (!visible) {
    return null;
  }
  const edgeOpacity = fadeEdges ? 0 : 1;
  return /* @__PURE__ */ jsxs("g", { children: [
    /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: gradientId, x1: "0%", x2: "0%", y1: "0%", y2: "100%", children: [
      /* @__PURE__ */ jsx(
        "stop",
        {
          offset: "0%",
          style: { stopColor: colorEdge, stopOpacity: edgeOpacity }
        }
      ),
      /* @__PURE__ */ jsx("stop", { offset: "10%", style: { stopColor: colorEdge, stopOpacity: 1 } }),
      /* @__PURE__ */ jsx("stop", { offset: "50%", style: { stopColor: colorMid, stopOpacity: 1 } }),
      /* @__PURE__ */ jsx("stop", { offset: "90%", style: { stopColor: colorEdge, stopOpacity: 1 } }),
      /* @__PURE__ */ jsx(
        "stop",
        {
          offset: "100%",
          style: { stopColor: colorEdge, stopOpacity: edgeOpacity }
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx(
      motion.rect,
      {
        fill: `url(#${gradientId})`,
        height,
        width: pixelWidth,
        x: animatedX,
        y: 0
      }
    )
  ] });
}
function TooltipContent({ title, rows, children }) {
  const [measureRef, bounds] = useMeasure({ debounce: 0, scroll: false });
  const [committedHeight, setCommittedHeight] = useState$1(null);
  const committedChildrenStateRef = useRef(null);
  const frameRef = useRef(null);
  const hasChildren = !!children;
  const markerKey = hasChildren ? "has-marker" : "no-marker";
  const isWaitingForSettlement = committedChildrenStateRef.current !== null && committedChildrenStateRef.current !== hasChildren;
  useEffect$1(() => {
    if (bounds.height <= 0) {
      return;
    }
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (isWaitingForSettlement) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = requestAnimationFrame(() => {
          setCommittedHeight(bounds.height);
          committedChildrenStateRef.current = hasChildren;
        });
      });
    } else {
      setCommittedHeight(bounds.height);
      committedChildrenStateRef.current = hasChildren;
    }
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [bounds.height, hasChildren, isWaitingForSettlement]);
  const shouldAnimate = committedHeight !== null;
  return /* @__PURE__ */ jsx(
    motion.div,
    {
      animate: committedHeight !== null ? { height: committedHeight } : void 0,
      className: "overflow-hidden",
      initial: false,
      transition: shouldAnimate ? {
        type: "spring",
        stiffness: 500,
        damping: 35,
        mass: 0.8
      } : { duration: 0 },
      children: /* @__PURE__ */ jsxs("div", { className: "px-3 py-2.5", ref: measureRef, children: [
        title && /* @__PURE__ */ jsx("div", { className: "mb-2 font-medium text-chart-tooltip-foreground text-xs", children: title }),
        /* @__PURE__ */ jsx("div", { className: "space-y-1.5", children: rows.map((row) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "flex items-center justify-between gap-4",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: "h-2.5 w-2.5 shrink-0 rounded-full",
                    style: { backgroundColor: row.color }
                  }
                ),
                /* @__PURE__ */ jsx("span", { className: "text-chart-tooltip-muted text-sm", children: row.label })
              ] }),
              /* @__PURE__ */ jsx("span", { className: "font-medium text-chart-tooltip-foreground text-sm tabular-nums", children: typeof row.value === "number" ? row.value.toLocaleString() : row.value })
            ]
          },
          `${row.label}-${row.color}`
        )) }),
        /* @__PURE__ */ jsx(AnimatePresence, { mode: "wait", children: children && /* @__PURE__ */ jsx(
          motion.div,
          {
            animate: { opacity: 1, filter: "blur(0px)" },
            className: "mt-2",
            exit: { opacity: 0, filter: "blur(4px)" },
            initial: { opacity: 0, filter: "blur(4px)" },
            transition: { duration: 0.2, ease: "easeOut" },
            children
          },
          markerKey
        ) })
      ] })
    }
  );
}
function TooltipBox({
  x,
  y,
  visible,
  containerRef,
  containerWidth,
  containerHeight,
  offset = 16,
  className = "",
  children,
  left: leftOverride,
  top: topOverride,
  flipped: flippedOverride
}) {
  const tooltipRef = useRef(null);
  const [tooltipWidth, setTooltipWidth] = useState$1(180);
  const [tooltipHeight, setTooltipHeight] = useState$1(80);
  const [mounted, setMounted] = useState$1(false);
  useEffect$1(() => {
    setMounted(true);
  }, []);
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const w = tooltipRef.current.offsetWidth;
      const h = tooltipRef.current.offsetHeight;
      if (w > 0 && w !== tooltipWidth) {
        setTooltipWidth(w);
      }
      if (h > 0 && h !== tooltipHeight) {
        setTooltipHeight(h);
      }
    }
  }, [tooltipWidth, tooltipHeight]);
  const shouldFlipX = x + tooltipWidth + offset > containerWidth;
  const targetX = shouldFlipX ? x - offset - tooltipWidth : x + offset;
  const targetY = Math.max(
    offset,
    Math.min(y - tooltipHeight / 2, containerHeight - tooltipHeight - offset)
  );
  const prevFlipRef = useRef(shouldFlipX);
  const [flipKey, setFlipKey] = useState$1(0);
  useEffect$1(() => {
    if (prevFlipRef.current !== shouldFlipX) {
      setFlipKey((k) => k + 1);
      prevFlipRef.current = shouldFlipX;
    }
  }, [shouldFlipX]);
  const springConfig = { stiffness: 100, damping: 20 };
  const animatedLeft = useSpring(targetX, springConfig);
  const animatedTop = useSpring(targetY, springConfig);
  useEffect$1(() => {
    animatedLeft.set(targetX);
  }, [targetX, animatedLeft]);
  useEffect$1(() => {
    animatedTop.set(targetY);
  }, [targetY, animatedTop]);
  const finalLeft = leftOverride ?? animatedLeft;
  const finalTop = topOverride ?? animatedTop;
  const isFlipped = flippedOverride ?? shouldFlipX;
  const transformOrigin = isFlipped ? "right top" : "left top";
  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  if (!visible) {
    return null;
  }
  return createPortal(
    /* @__PURE__ */ jsx(
      motion.div,
      {
        animate: { opacity: 1 },
        className: cn("pointer-events-none absolute z-50", className),
        exit: { opacity: 0 },
        initial: { opacity: 0 },
        ref: tooltipRef,
        style: { left: finalLeft, top: finalTop },
        transition: { duration: 0.1 },
        children: /* @__PURE__ */ jsx(
          motion.div,
          {
            animate: { scale: 1, opacity: 1, x: 0 },
            className: "min-w-[140px] overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg backdrop-blur-md",
            initial: { scale: 0.85, opacity: 0, x: isFlipped ? 20 : -20 },
            style: { transformOrigin },
            transition: { type: "spring", stiffness: 300, damping: 25 },
            children
          },
          flipKey
        )
      }
    ),
    container
  );
}
function ChartTooltip({
  showDatePill = true,
  showCrosshair = true,
  showDots = true,
  content,
  rows: rowsRenderer,
  children,
  className = ""
}) {
  const {
    tooltipData,
    width,
    height,
    innerHeight,
    margin,
    columnWidth,
    lines,
    xAccessor,
    dateLabels,
    containerRef,
    orientation,
    barXAccessor
  } = useChart();
  const isHorizontal = orientation === "horizontal";
  const [mounted, setMounted] = useState$1(false);
  useEffect$1(() => {
    setMounted(true);
  }, []);
  const visible = tooltipData !== null;
  const x = tooltipData?.x ?? 0;
  const xWithMargin = x + margin.left;
  const firstLineDataKey = lines[0]?.dataKey;
  const firstLineY = firstLineDataKey ? tooltipData?.yPositions[firstLineDataKey] ?? 0 : 0;
  const yWithMargin = firstLineY + margin.top;
  const crosshairSpringConfig = { stiffness: 300, damping: 30 };
  const animatedX = useSpring(xWithMargin, crosshairSpringConfig);
  useEffect$1(() => {
    animatedX.set(xWithMargin);
  }, [xWithMargin, animatedX]);
  const tooltipRows = useMemo(() => {
    if (!tooltipData) {
      return [];
    }
    if (rowsRenderer) {
      return rowsRenderer(tooltipData.point);
    }
    return lines.map((line) => ({
      color: line.stroke,
      label: line.dataKey,
      value: tooltipData.point[line.dataKey] ?? 0
    }));
  }, [tooltipData, lines, rowsRenderer]);
  const title = useMemo(() => {
    if (!tooltipData) {
      return void 0;
    }
    if (barXAccessor) {
      return barXAccessor(tooltipData.point);
    }
    return xAccessor(tooltipData.point).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  }, [tooltipData, barXAccessor, xAccessor]);
  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  const tooltipContent = /* @__PURE__ */ jsxs(Fragment, { children: [
    showCrosshair && /* @__PURE__ */ jsx(
      "svg",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-0",
        height: "100%",
        width: "100%",
        children: /* @__PURE__ */ jsx("g", { transform: `translate(${margin.left},${margin.top})`, children: /* @__PURE__ */ jsx(
          TooltipIndicator,
          {
            colorEdge: chartCssVars.crosshair,
            colorMid: chartCssVars.crosshair,
            columnWidth,
            fadeEdges: true,
            height: innerHeight,
            visible,
            width: "line",
            x
          }
        ) })
      }
    ),
    showDots && visible && !isHorizontal && /* @__PURE__ */ jsx(
      "svg",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-0",
        height: "100%",
        width: "100%",
        children: /* @__PURE__ */ jsx("g", { transform: `translate(${margin.left},${margin.top})`, children: lines.map((line) => /* @__PURE__ */ jsx(
          TooltipDot,
          {
            color: line.stroke,
            strokeColor: chartCssVars.background,
            visible,
            x: tooltipData?.xPositions?.[line.dataKey] ?? x,
            y: tooltipData?.yPositions[line.dataKey] ?? 0
          },
          line.dataKey
        )) })
      }
    ),
    /* @__PURE__ */ jsx(
      TooltipBox,
      {
        className,
        containerHeight: height,
        containerRef,
        containerWidth: width,
        top: isHorizontal ? void 0 : margin.top,
        visible,
        x: xWithMargin,
        y: isHorizontal ? yWithMargin : margin.top,
        children: content ? content({
          point: tooltipData?.point ?? {},
          index: tooltipData?.index ?? 0
        }) : /* @__PURE__ */ jsx(TooltipContent, { rows: tooltipRows, title, children })
      }
    ),
    showDatePill && dateLabels.length > 0 && visible && !isHorizontal && /* @__PURE__ */ jsx(
      motion.div,
      {
        className: "pointer-events-none absolute z-50",
        style: {
          left: animatedX,
          transform: "translateX(-50%)",
          bottom: 4
        },
        children: /* @__PURE__ */ jsx(
          DateTicker,
          {
            currentIndex: tooltipData?.index ?? 0,
            labels: dateLabels,
            visible
          }
        )
      }
    )
  ] });
  return createPortal(tooltipContent, container);
}
function Grid({
  horizontal = true,
  vertical = false,
  numTicksRows = 5,
  numTicksColumns = 10,
  rowTickValues,
  stroke = chartCssVars.grid,
  strokeOpacity = 1,
  strokeWidth = 1,
  strokeDasharray = "4,4",
  fadeHorizontal = true,
  fadeVertical = false
}) {
  const { xScale, yScale, innerWidth, innerHeight, orientation, barScale } = useChart();
  const isHorizontalBarChart = orientation === "horizontal" && barScale;
  const columnScale = isHorizontalBarChart ? yScale : xScale;
  const uniqueId = useId$1();
  const hMaskId = `grid-rows-fade-${uniqueId}`;
  const hGradientId = `${hMaskId}-gradient`;
  const vMaskId = `grid-cols-fade-${uniqueId}`;
  const vGradientId = `${vMaskId}-gradient`;
  return /* @__PURE__ */ jsxs("g", { className: "chart-grid", children: [
    horizontal && fadeHorizontal && /* @__PURE__ */ jsxs("defs", { children: [
      /* @__PURE__ */ jsxs("linearGradient", { id: hGradientId, x1: "0%", x2: "100%", y1: "0%", y2: "0%", children: [
        /* @__PURE__ */ jsx("stop", { offset: "0%", style: { stopColor: "white", stopOpacity: 0 } }),
        /* @__PURE__ */ jsx("stop", { offset: "10%", style: { stopColor: "white", stopOpacity: 1 } }),
        /* @__PURE__ */ jsx("stop", { offset: "90%", style: { stopColor: "white", stopOpacity: 1 } }),
        /* @__PURE__ */ jsx(
          "stop",
          {
            offset: "100%",
            style: { stopColor: "white", stopOpacity: 0 }
          }
        )
      ] }),
      /* @__PURE__ */ jsx("mask", { id: hMaskId, children: /* @__PURE__ */ jsx(
        "rect",
        {
          fill: `url(#${hGradientId})`,
          height: innerHeight,
          width: innerWidth,
          x: "0",
          y: "0"
        }
      ) })
    ] }),
    vertical && fadeVertical && /* @__PURE__ */ jsxs("defs", { children: [
      /* @__PURE__ */ jsxs("linearGradient", { id: vGradientId, x1: "0%", x2: "0%", y1: "0%", y2: "100%", children: [
        /* @__PURE__ */ jsx("stop", { offset: "0%", style: { stopColor: "white", stopOpacity: 0 } }),
        /* @__PURE__ */ jsx("stop", { offset: "10%", style: { stopColor: "white", stopOpacity: 1 } }),
        /* @__PURE__ */ jsx("stop", { offset: "90%", style: { stopColor: "white", stopOpacity: 1 } }),
        /* @__PURE__ */ jsx(
          "stop",
          {
            offset: "100%",
            style: { stopColor: "white", stopOpacity: 0 }
          }
        )
      ] }),
      /* @__PURE__ */ jsx("mask", { id: vMaskId, children: /* @__PURE__ */ jsx(
        "rect",
        {
          fill: `url(#${vGradientId})`,
          height: innerHeight,
          width: innerWidth,
          x: "0",
          y: "0"
        }
      ) })
    ] }),
    horizontal && /* @__PURE__ */ jsx("g", { mask: fadeHorizontal ? `url(#${hMaskId})` : void 0, children: /* @__PURE__ */ jsx(
      GridRows,
      {
        numTicks: rowTickValues ? void 0 : numTicksRows,
        scale: yScale,
        stroke,
        strokeDasharray,
        strokeOpacity,
        strokeWidth,
        tickValues: rowTickValues,
        width: innerWidth
      }
    ) }),
    vertical && columnScale && /* @__PURE__ */ jsx("g", { mask: fadeVertical ? `url(#${vMaskId})` : void 0, children: /* @__PURE__ */ jsx(
      GridColumns,
      {
        height: innerHeight,
        numTicks: numTicksColumns,
        scale: columnScale,
        stroke,
        strokeDasharray,
        strokeOpacity,
        strokeWidth
      }
    ) })
  ] });
}
function XAxisLabel({
  label,
  x,
  crosshairX,
  isHovering,
  tickerHalfWidth
}) {
  const fadeBuffer = 20;
  const fadeRadius = tickerHalfWidth + fadeBuffer;
  let opacity = 1;
  if (isHovering && crosshairX !== null) {
    const distance = Math.abs(x - crosshairX);
    if (distance < tickerHalfWidth) {
      opacity = 0;
    } else if (distance < fadeRadius) {
      opacity = (distance - tickerHalfWidth) / fadeBuffer;
    }
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "absolute",
      style: {
        left: x,
        bottom: 12,
        width: 0,
        display: "flex",
        justifyContent: "center"
      },
      children: /* @__PURE__ */ jsx(
        motion.span,
        {
          animate: { opacity },
          className: cn("whitespace-nowrap text-chart-label text-xs"),
          initial: { opacity: 1 },
          transition: { duration: 0.4, ease: "easeInOut" },
          children: label
        }
      )
    }
  );
}
function XAxis({ numTicks = 5, tickerHalfWidth = 50 }) {
  const { xScale, margin, tooltipData, containerRef } = useChart();
  const [mounted, setMounted] = useState$1(false);
  useEffect$1(() => {
    setMounted(true);
  }, []);
  const labelsToShow = useMemo(() => {
    const domain = xScale.domain();
    const startDate = domain[0];
    const endDate = domain[1];
    if (!(startDate && endDate)) {
      return [];
    }
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const timeRange = endTime - startTime;
    const tickCount = Math.max(2, numTicks);
    const dates = [];
    for (let i = 0; i < tickCount; i++) {
      const t = i / (tickCount - 1);
      const time = startTime + t * timeRange;
      dates.push(new Date(time));
    }
    return dates.map((date) => ({
      date,
      x: (xScale(date) ?? 0) + margin.left,
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      })
    }));
  }, [xScale, margin.left, numTicks]);
  const isHovering = tooltipData !== null;
  const crosshairX = tooltipData ? tooltipData.x + margin.left : null;
  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  return createPortal(
    /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0", children: labelsToShow.map((item) => /* @__PURE__ */ jsx(
      XAxisLabel,
      {
        crosshairX,
        isHovering,
        label: item.label,
        tickerHalfWidth,
        x: item.x
      },
      `${item.label}-${item.x}`
    )) }),
    container
  );
}
function Area({
  dataKey,
  fill = chartCssVars.linePrimary,
  fillOpacity = 0.4,
  stroke,
  strokeWidth = 2,
  curve = curveMonotoneX,
  animate = true,
  showLine = true,
  showHighlight = true,
  gradientToOpacity = 0,
  fadeEdges = false
}) {
  const {
    data,
    xScale,
    yScale,
    innerHeight,
    innerWidth,
    tooltipData,
    selection,
    isLoaded,
    animationDuration,
    xAccessor
  } = useChart();
  const pathRef = useRef(null);
  const [pathLength, setPathLength] = useState$1(0);
  const [clipWidth, setClipWidth] = useState$1(0);
  const uniqueId = useId$1();
  const gradientId = useMemo(
    () => `area-gradient-${dataKey}-${Math.random().toString(36).slice(2, 9)}`,
    [dataKey]
  );
  const strokeGradientId = useMemo(
    () => `area-stroke-gradient-${dataKey}-${Math.random().toString(36).slice(2, 9)}`,
    [dataKey]
  );
  const edgeMaskId = `area-edge-mask-${dataKey}-${uniqueId}`;
  const edgeGradientId = `${edgeMaskId}-gradient`;
  const resolvedStroke = stroke || fill;
  useEffect$1(() => {
    if (pathRef.current && animate) {
      const len = pathRef.current.getTotalLength();
      if (len > 0) {
        setPathLength(len);
        if (!isLoaded) {
          requestAnimationFrame(() => {
            setClipWidth(innerWidth);
          });
        }
      }
    }
  }, [animate, innerWidth, isLoaded]);
  const findLengthAtX = useCallback(
    (targetX) => {
      const path = pathRef.current;
      if (!path || pathLength === 0) {
        return 0;
      }
      let low = 0;
      let high = pathLength;
      const tolerance = 0.5;
      while (high - low > tolerance) {
        const mid = (low + high) / 2;
        const point = path.getPointAtLength(mid);
        if (point.x < targetX) {
          low = mid;
        } else {
          high = mid;
        }
      }
      return (low + high) / 2;
    },
    [pathLength]
  );
  const segmentBounds = useMemo(() => {
    if (!pathRef.current || pathLength === 0) {
      return { startLength: 0, segmentLength: 0, isActive: false };
    }
    if (selection?.active) {
      const startLength2 = findLengthAtX(selection.startX);
      const endLength2 = findLengthAtX(selection.endX);
      return {
        startLength: startLength2,
        segmentLength: endLength2 - startLength2,
        isActive: true
      };
    }
    if (!tooltipData) {
      return { startLength: 0, segmentLength: 0, isActive: false };
    }
    const idx = tooltipData.index;
    const startIdx = Math.max(0, idx - 1);
    const endIdx = Math.min(data.length - 1, idx + 1);
    const startPoint = data[startIdx];
    const endPoint = data[endIdx];
    if (!(startPoint && endPoint)) {
      return { startLength: 0, segmentLength: 0, isActive: false };
    }
    const startX = xScale(xAccessor(startPoint)) ?? 0;
    const endX = xScale(xAccessor(endPoint)) ?? 0;
    const startLength = findLengthAtX(startX);
    const endLength = findLengthAtX(endX);
    return {
      startLength,
      segmentLength: endLength - startLength,
      isActive: true
    };
  }, [
    tooltipData,
    selection,
    data,
    xScale,
    pathLength,
    xAccessor,
    findLengthAtX
  ]);
  const springConfig = { stiffness: 180, damping: 28 };
  const offsetSpring = useSpring(0, springConfig);
  const segmentLengthSpring = useSpring(0, springConfig);
  const animatedDasharray = useMotionTemplate`${segmentLengthSpring} ${pathLength}`;
  useEffect$1(() => {
    offsetSpring.set(-segmentBounds.startLength);
    segmentLengthSpring.set(segmentBounds.segmentLength);
  }, [
    segmentBounds.startLength,
    segmentBounds.segmentLength,
    offsetSpring,
    segmentLengthSpring
  ]);
  const getY = useCallback(
    (d) => {
      const value = d[dataKey];
      return typeof value === "number" ? yScale(value) ?? 0 : 0;
    },
    [dataKey, yScale]
  );
  const isHovering = tooltipData !== null || selection?.active === true;
  const easing = "cubic-bezier(0.85, 0, 0.15, 1)";
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("defs", { children: [
      /* @__PURE__ */ jsxs("linearGradient", { id: gradientId, x1: "0%", x2: "0%", y1: "0%", y2: "100%", children: [
        /* @__PURE__ */ jsx(
          "stop",
          {
            offset: "0%",
            style: { stopColor: fill, stopOpacity: fillOpacity }
          }
        ),
        /* @__PURE__ */ jsx(
          "stop",
          {
            offset: "100%",
            style: { stopColor: fill, stopOpacity: gradientToOpacity }
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("linearGradient", { id: strokeGradientId, x1: "0%", x2: "100%", y1: "0%", y2: "0%", children: [
        /* @__PURE__ */ jsx(
          "stop",
          {
            offset: "0%",
            style: { stopColor: resolvedStroke, stopOpacity: 0 }
          }
        ),
        /* @__PURE__ */ jsx(
          "stop",
          {
            offset: "15%",
            style: { stopColor: resolvedStroke, stopOpacity: 1 }
          }
        ),
        /* @__PURE__ */ jsx(
          "stop",
          {
            offset: "85%",
            style: { stopColor: resolvedStroke, stopOpacity: 1 }
          }
        ),
        /* @__PURE__ */ jsx(
          "stop",
          {
            offset: "100%",
            style: { stopColor: resolvedStroke, stopOpacity: 0 }
          }
        )
      ] }),
      fadeEdges && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs(
          "linearGradient",
          {
            id: edgeGradientId,
            x1: "0%",
            x2: "100%",
            y1: "0%",
            y2: "0%",
            children: [
              /* @__PURE__ */ jsx(
                "stop",
                {
                  offset: "0%",
                  style: { stopColor: "white", stopOpacity: 0 }
                }
              ),
              /* @__PURE__ */ jsx(
                "stop",
                {
                  offset: "20%",
                  style: { stopColor: "white", stopOpacity: 1 }
                }
              ),
              /* @__PURE__ */ jsx(
                "stop",
                {
                  offset: "80%",
                  style: { stopColor: "white", stopOpacity: 1 }
                }
              ),
              /* @__PURE__ */ jsx(
                "stop",
                {
                  offset: "100%",
                  style: { stopColor: "white", stopOpacity: 0 }
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsx("mask", { id: edgeMaskId, children: /* @__PURE__ */ jsx(
          "rect",
          {
            fill: `url(#${edgeGradientId})`,
            height: innerHeight,
            width: innerWidth,
            x: "0",
            y: "0"
          }
        ) })
      ] })
    ] }),
    animate && /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsx("clipPath", { id: `grow-clip-area-${dataKey}`, children: /* @__PURE__ */ jsx(
      "rect",
      {
        height: innerHeight + 20,
        style: {
          transition: !isLoaded && clipWidth > 0 ? `width ${animationDuration}ms ${easing}` : "none"
        },
        width: isLoaded ? innerWidth : clipWidth,
        x: 0,
        y: 0
      }
    ) }) }),
    /* @__PURE__ */ jsx("g", { clipPath: animate ? `url(#grow-clip-area-${dataKey})` : void 0, children: /* @__PURE__ */ jsxs(
      motion.g,
      {
        animate: { opacity: isHovering && showHighlight ? 0.6 : 1 },
        initial: { opacity: 1 },
        transition: { duration: 0.4, ease: "easeInOut" },
        children: [
          /* @__PURE__ */ jsx("g", { mask: fadeEdges ? `url(#${edgeMaskId})` : void 0, children: /* @__PURE__ */ jsx(
            AreaClosed,
            {
              curve,
              data,
              fill: `url(#${gradientId})`,
              x: (d) => xScale(xAccessor(d)) ?? 0,
              y: getY,
              yScale
            }
          ) }),
          showLine && /* @__PURE__ */ jsx(
            LinePath,
            {
              curve,
              data,
              innerRef: pathRef,
              stroke: `url(#${strokeGradientId})`,
              strokeLinecap: "round",
              strokeWidth,
              x: (d) => xScale(xAccessor(d)) ?? 0,
              y: getY
            }
          )
        ]
      }
    ) }),
    showHighlight && showLine && isHovering && isLoaded && pathRef.current && /* @__PURE__ */ jsx(
      motion.path,
      {
        animate: { opacity: 1 },
        d: pathRef.current.getAttribute("d") || "",
        exit: { opacity: 0 },
        fill: "none",
        initial: { opacity: 0 },
        stroke: resolvedStroke,
        strokeLinecap: "round",
        strokeWidth,
        style: {
          strokeDasharray: animatedDasharray,
          strokeDashoffset: offsetSpring
        },
        transition: { duration: 0.4, ease: "easeInOut" }
      }
    )
  ] });
}
const DEFAULT_MARGIN = { top: 40, right: 40, bottom: 40, left: 40 };
function isPostOverlayComponent(child) {
  const childType = child.type;
  if (childType.__isChartMarkers) {
    return true;
  }
  const componentName = typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
  return componentName === "ChartMarkers" || componentName === "MarkerGroup";
}
function extractAreaConfigs(children) {
  const configs = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    const childType = child.type;
    const componentName = typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
    const props = child.props;
    const isAreaComponent = componentName === "Area" || child.type === Area || props && typeof props.dataKey === "string" && props.dataKey.length > 0;
    if (isAreaComponent && props?.dataKey) {
      configs.push({
        dataKey: props.dataKey,
        stroke: props.stroke || props.fill || "var(--chart-line-primary)",
        strokeWidth: props.strokeWidth || 2
      });
    }
  });
  return configs;
}
function ChartInner({
  width,
  height,
  data,
  xDataKey,
  margin,
  animationDuration,
  children,
  containerRef
}) {
  const [isLoaded, setIsLoaded] = useState$1(false);
  const lines = useMemo(() => extractAreaConfigs(children), [children]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const xAccessor = useCallback(
    (d) => {
      const value = d[xDataKey];
      return value instanceof Date ? value : new Date(value);
    },
    [xDataKey]
  );
  const bisectDate = useMemo(
    () => bisector((d) => xAccessor(d)).left,
    [xAccessor]
  );
  const xScale = useMemo(() => {
    const dates = data.map((d) => xAccessor(d));
    const minTime = Math.min(...dates.map((d) => d.getTime()));
    const maxTime = Math.max(...dates.map((d) => d.getTime()));
    return scaleTime({
      range: [0, innerWidth],
      domain: [new Date(minTime), new Date(maxTime)]
    });
  }, [innerWidth, data, xAccessor]);
  const columnWidth = useMemo(() => {
    if (data.length < 2) {
      return 0;
    }
    return innerWidth / (data.length - 1);
  }, [innerWidth, data.length]);
  const yScale = useMemo(() => {
    let maxValue = 0;
    for (const line of lines) {
      for (const d of data) {
        const value = d[line.dataKey];
        if (typeof value === "number" && value > maxValue) {
          maxValue = value;
        }
      }
    }
    if (maxValue === 0) {
      maxValue = 100;
    }
    return scaleLinear({
      range: [innerHeight, 0],
      domain: [0, maxValue * 1.1],
      nice: true
    });
  }, [innerHeight, data, lines]);
  const dateLabels = useMemo(
    () => data.map(
      (d) => xAccessor(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      })
    ),
    [data, xAccessor]
  );
  useEffect$1(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, animationDuration);
    return () => clearTimeout(timer);
  }, [animationDuration]);
  const canInteract = isLoaded;
  const {
    tooltipData,
    setTooltipData,
    selection,
    clearSelection,
    interactionHandlers,
    interactionStyle
  } = useChartInteraction({
    xScale,
    yScale,
    data,
    lines,
    margin,
    xAccessor,
    bisectDate,
    canInteract
  });
  if (width < 10 || height < 10) {
    return null;
  }
  const preOverlayChildren = [];
  const postOverlayChildren = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    if (isPostOverlayComponent(child)) {
      postOverlayChildren.push(child);
    } else {
      preOverlayChildren.push(child);
    }
  });
  const contextValue = {
    data,
    xScale,
    yScale,
    width,
    height,
    innerWidth,
    innerHeight,
    margin,
    columnWidth,
    tooltipData,
    setTooltipData,
    containerRef,
    lines,
    isLoaded,
    animationDuration,
    xAccessor,
    dateLabels,
    selection,
    clearSelection
  };
  return /* @__PURE__ */ jsx(ChartProvider, { value: contextValue, children: /* @__PURE__ */ jsxs("svg", { "aria-hidden": "true", height, width, children: [
    /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsx("clipPath", { id: "chart-area-grow-clip", children: /* @__PURE__ */ jsx(
      "rect",
      {
        height: innerHeight + 20,
        style: {
          transition: isLoaded ? "none" : `width ${animationDuration}ms cubic-bezier(0.85, 0, 0.15, 1)`
        },
        width: isLoaded ? innerWidth : 0,
        x: 0,
        y: 0
      }
    ) }) }),
    /* @__PURE__ */ jsx("rect", { fill: "transparent", height, width, x: 0, y: 0 }),
    /* @__PURE__ */ jsxs(
      "g",
      {
        ...interactionHandlers,
        style: interactionStyle,
        transform: `translate(${margin.left},${margin.top})`,
        children: [
          /* @__PURE__ */ jsx(
            "rect",
            {
              fill: "transparent",
              height: innerHeight,
              width: innerWidth,
              x: 0,
              y: 0
            }
          ),
          preOverlayChildren,
          postOverlayChildren
        ]
      }
    )
  ] }) });
}
function AreaChart({
  data,
  xDataKey = "date",
  margin: marginProp,
  animationDuration = 1100,
  aspectRatio = "2 / 1",
  className = "",
  children
}) {
  const containerRef = useRef(null);
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cn("relative w-full", className),
      ref: containerRef,
      style: { aspectRatio, touchAction: "none" },
      children: /* @__PURE__ */ jsx(ParentSize, { debounceTime: 10, children: ({ width, height }) => /* @__PURE__ */ jsx(
        ChartInner,
        {
          animationDuration,
          containerRef,
          data,
          height,
          margin,
          width,
          xDataKey,
          children
        }
      ) })
    }
  );
}
function createBeam(width, height) {
  const angle = -35 + Math.random() * 10;
  return {
    x: Math.random() * width * 1.5 - width * 0.25,
    y: Math.random() * height * 1.5 - height * 0.25,
    width: 30 + Math.random() * 60,
    length: height * 2.5,
    angle,
    speed: 0.6 + Math.random() * 1.2,
    opacity: 0.12 + Math.random() * 0.16,
    hue: 190 + Math.random() * 70,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03
  };
}
function BeamsBackground({
  className,
  children,
  intensity = "strong",
  fixed = false
}) {
  const canvasRef = useRef(null);
  const beamsRef = useRef([]);
  const animationFrameRef = useRef(0);
  const [mounted, setMounted] = useState$1(false);
  const MINIMUM_BEAMS = 20;
  const opacityMap = {
    subtle: 0.7,
    medium: 0.85,
    strong: 1
  };
  useEffect$1(() => {
    setMounted(true);
  }, []);
  useEffect$1(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      const totalBeams = MINIMUM_BEAMS * 1.5;
      beamsRef.current = Array.from(
        { length: totalBeams },
        () => createBeam(canvas.width, canvas.height)
      );
    };
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    function resetBeam(beam, index, totalBeams) {
      if (!canvas) return beam;
      const column = index % 3;
      const spacing = canvas.width / 3;
      beam.y = canvas.height + 100;
      beam.x = column * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
      beam.width = 100 + Math.random() * 100;
      beam.speed = 0.5 + Math.random() * 0.4;
      beam.hue = 190 + index * 70 / totalBeams;
      beam.opacity = 0.2 + Math.random() * 0.1;
      return beam;
    }
    function drawBeam(ctx2, beam) {
      ctx2.save();
      ctx2.translate(beam.x, beam.y);
      ctx2.rotate(beam.angle * Math.PI / 180);
      const pulsingOpacity = beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2) * opacityMap[intensity];
      const gradient = ctx2.createLinearGradient(0, 0, 0, beam.length);
      gradient.addColorStop(0, `hsla(${beam.hue}, 85%, 65%, 0)`);
      gradient.addColorStop(
        0.1,
        `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity * 0.5})`
      );
      gradient.addColorStop(
        0.4,
        `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity})`
      );
      gradient.addColorStop(
        0.6,
        `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity})`
      );
      gradient.addColorStop(
        0.9,
        `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity * 0.5})`
      );
      gradient.addColorStop(1, `hsla(${beam.hue}, 85%, 65%, 0)`);
      ctx2.fillStyle = gradient;
      ctx2.fillRect(-beam.width / 2, 0, beam.width, beam.length);
      ctx2.restore();
    }
    function animate() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = "blur(35px)";
      const totalBeams = beamsRef.current.length;
      beamsRef.current.forEach((beam, index) => {
        beam.y -= beam.speed;
        beam.pulse += beam.pulseSpeed;
        if (beam.y + beam.length < -100) {
          resetBeam(beam, index, totalBeams);
        }
        drawBeam(ctx, beam);
      });
      animationFrameRef.current = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      window.removeEventListener("resize", updateCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [intensity, mounted]);
  if (!mounted) {
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: cn$1(
          "relative w-full overflow-hidden bg-neutral-950",
          fixed ? "min-h-0" : "min-h-screen",
          className
        ),
        children: children ? /* @__PURE__ */ jsx("div", { className: cn$1("relative z-10 w-full", !fixed && "min-h-screen"), children }) : null
      }
    );
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn$1(
        "relative w-full overflow-hidden bg-neutral-950",
        fixed ? "min-h-0" : "min-h-screen",
        className
      ),
      children: [
        /* @__PURE__ */ jsx(
          "canvas",
          {
            ref: canvasRef,
            className: fixed ? "fixed inset-0 z-0" : "absolute inset-0",
            style: { filter: "blur(15px)" }
          }
        ),
        /* @__PURE__ */ jsx(
          motion.div,
          {
            className: "absolute inset-0 bg-neutral-950/5",
            animate: {
              opacity: [0.05, 0.15, 0.05]
            },
            transition: {
              duration: 10,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY
            },
            style: {
              backdropFilter: "blur(50px)"
            }
          }
        ),
        children ? /* @__PURE__ */ jsx(
          "div",
          {
            className: cn$1(
              "relative z-10 w-full",
              !fixed && "min-h-screen"
            ),
            children
          }
        ) : /* @__PURE__ */ jsx("div", { className: "relative z-10 flex h-screen w-full items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-6 px-4 text-center", children: [
          /* @__PURE__ */ jsxs(
            motion.h1,
            {
              className: "text-6xl font-semibold tracking-tighter text-white md:text-7xl lg:text-8xl",
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.8 },
              children: [
                "Beams",
                /* @__PURE__ */ jsx("br", {}),
                "Background"
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            motion.p,
            {
              className: "text-lg tracking-tighter text-white/70 md:text-2xl lg:text-3xl",
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.8 },
              children: "For your pleasure"
            }
          )
        ] }) })
      ]
    }
  );
}
const BentoGrid = ({ children, className, ...props }) => {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cn(
        "grid w-full auto-rows-[22rem] grid-cols-3 gap-4",
        className
      ),
      ...props,
      children
    }
  );
};
const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  ...props
}) => /* @__PURE__ */ jsxs(
  "div",
  {
    className: cn(
      "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl",
      "bg-black border border-white/10 transform-gpu",
      "[box-shadow:0_0_0_1px_rgba(255,255,255,.05),0_2px_4px_rgba(0,0,0,.2)]",
      className
    ),
    ...props,
    children: [
      /* @__PURE__ */ jsx("div", { children: background }),
      /* @__PURE__ */ jsxs("div", { className: "p-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "pointer-events-none z-10 flex transform-gpu flex-col gap-1 transition-all duration-300 lg:group-hover:-translate-y-10", children: [
          /* @__PURE__ */ jsx(Icon, { className: "h-12 w-12 origin-left transform-gpu text-white/90 transition-all duration-300 ease-in-out group-hover:scale-75" }),
          /* @__PURE__ */ jsx("h3", { className: "text-xl font-semibold text-white", children: name }),
          /* @__PURE__ */ jsx("p", { className: "max-w-lg text-white/60", children: description })
        ] }),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: cn(
              "pointer-events-none flex w-full translate-y-0 transform-gpu flex-row items-center transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:hidden"
            ),
            children: /* @__PURE__ */ jsx(
              Button,
              {
                variant: "link",
                asChild: true,
                size: "sm",
                className: "pointer-events-auto p-0 text-white/80 hover:text-white",
                children: /* @__PURE__ */ jsxs("a", { href, children: [
                  cta,
                  /* @__PURE__ */ jsx(ArrowRight, { className: "ms-2 h-4 w-4 rtl:rotate-180" })
                ] })
              }
            )
          }
        )
      ] }),
      /* @__PURE__ */ jsx(
        "div",
        {
          className: cn(
            "pointer-events-none absolute bottom-0 hidden w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex"
          ),
          children: /* @__PURE__ */ jsx(
            Button,
            {
              variant: "link",
              asChild: true,
              size: "sm",
              className: "pointer-events-auto p-0 text-white/80 hover:text-white",
              children: /* @__PURE__ */ jsxs("a", { href, children: [
                cta,
                /* @__PURE__ */ jsx(ArrowRight, { className: "ms-2 h-4 w-4 rtl:rotate-180" })
              ] })
            }
          )
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-white/[.03]" })
    ]
  },
  name
);
const motionElements = {
  article: motion.article,
  div: motion.div,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  h5: motion.h5,
  h6: motion.h6,
  li: motion.li,
  p: motion.p,
  section: motion.section,
  span: motion.span
};
function LineShadowText({
  children,
  shadowColor = "black",
  className,
  as: Component = "span",
  ...props
}) {
  const MotionComponent = motionElements[Component];
  return /* @__PURE__ */ jsx(
    MotionComponent,
    {
      style: { "--shadow-color": shadowColor },
      className: cn(
        "relative z-0 inline-flex",
        "after:absolute after:top-[0.04em] after:left-[0.04em] after:content-[attr(data-text)]",
        "after:bg-[linear-gradient(45deg,transparent_45%,var(--shadow-color)_45%,var(--shadow-color)_55%,transparent_0)]",
        "after:-z-10 after:bg-[length:0.06em_0.06em] after:bg-clip-text after:text-transparent",
        "after:animate-line-shadow",
        className
      ),
      "data-text": children,
      ...props,
      children
    }
  );
}
const defaultProps = {
  titleSize: "large",
  callToActions: [
    { text: "Get started", href: "#", variant: "primary" },
    { text: "Learn more", href: "#", variant: "secondary" }
  ]
};
function HeroLanding(props) {
  const {
    title,
    description,
    announcementBanner,
    callToActions,
    titleSize,
    className,
    embedInBackground = false
  } = { ...defaultProps, ...props };
  const getTitleSizeClasses = () => {
    switch (titleSize) {
      case "small":
        return "text-2xl sm:text-3xl md:text-5xl";
      case "medium":
        return "text-2xl sm:text-4xl md:text-6xl";
      case "large":
      default:
        return "text-3xl sm:text-5xl md:text-7xl";
    }
  };
  const renderCallToAction = (cta, index) => {
    if (cta.variant === "primary") {
      return /* @__PURE__ */ jsx(
        "a",
        {
          href: cta.href,
          className: "rounded-lg bg-primary px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors",
          children: cta.text
        },
        index
      );
    } else {
      return /* @__PURE__ */ jsxs(
        "a",
        {
          href: cta.href,
          className: "text-xs sm:text-sm/6 font-semibold text-foreground hover:text-muted-foreground transition-colors",
          children: [
            cta.text,
            " ",
            /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "→" })
          ]
        },
        index
      );
    }
  };
  const inner = /* @__PURE__ */ jsx("div", { className: "relative min-h-screen w-screen overflow-x-hidden text-white [&_a]:text-white/90 [&_a:hover]:text-white [&_a.rounded-lg.bg-primary]:bg-white [&_a.rounded-lg.bg-primary]:text-neutral-950 [&_a.rounded-lg.bg-primary:hover]:bg-white/90", children: /* @__PURE__ */ jsx("div", { className: "relative isolate flex min-h-screen flex-col justify-center overflow-hidden px-6 pt-0", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-4xl pt-10 sm:pt-12", children: [
    announcementBanner && /* @__PURE__ */ jsx("div", { className: "hidden sm:mb-2 sm:flex sm:justify-center", children: /* @__PURE__ */ jsxs("div", { className: "relative rounded-full px-2 py-1 text-xs text-white/70 ring-1 ring-white/20 transition-all hover:ring-white/40 sm:px-3 sm:text-sm/6", children: [
      announcementBanner.text,
      " ",
      /* @__PURE__ */ jsxs("a", { href: announcementBanner.linkHref, className: "font-semibold text-white transition-colors hover:text-white/80", children: [
        /* @__PURE__ */ jsx("span", { "aria-hidden": "true", className: "absolute inset-0" }),
        announcementBanner.linkText,
        " ",
        /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "→" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
      /* @__PURE__ */ jsx("h1", { className: `${getTitleSizeClasses()} font-semibold tracking-tight text-balance text-white`, children: title }),
      /* @__PURE__ */ jsx("p", { className: "mt-6 text-base font-medium text-pretty text-white/80 sm:mt-8 sm:text-lg sm:text-xl/8", children: description }),
      callToActions && callToActions.length > 0 && /* @__PURE__ */ jsx("div", { className: "mt-8 sm:mt-10 flex items-center justify-center gap-x-4 sm:gap-x-6", children: callToActions.map((cta, index) => renderCallToAction(cta, index)) })
    ] })
  ] }) }) });
  if (embedInBackground) {
    return inner;
  }
  return /* @__PURE__ */ jsx(BeamsBackground, { intensity: "medium", className, children: inner });
}
const { useEffect, useId, useState } = React__default;
const AnimatedBeam = ({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  // Include the reverse prop
  duration = Math.random() * 3 + 4,
  delay = 0,
  pathColor = "gray",
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = "#ffaa40",
  gradientStopColor = "#9c40ff",
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0
}) => {
  const id = useId();
  const [pathD, setPathD] = useState("");
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  const gradientCoordinates = reverse ? {
    x1: ["90%", "-10%"],
    x2: ["100%", "0%"],
    y1: ["0%", "0%"],
    y2: ["0%", "0%"]
  } : {
    x1: ["10%", "110%"],
    x2: ["0%", "100%"],
    y1: ["0%", "0%"],
    y2: ["0%", "0%"]
  };
  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const rectA = fromRef.current.getBoundingClientRect();
        const rectB = toRef.current.getBoundingClientRect();
        const svgWidth = containerRect.width;
        const svgHeight = containerRect.height;
        setSvgDimensions({ width: svgWidth, height: svgHeight });
        const startX = rectA.left - containerRect.left + rectA.width / 2 + startXOffset;
        const startY = rectA.top - containerRect.top + rectA.height / 2 + startYOffset;
        const endX = rectB.left - containerRect.left + rectB.width / 2 + endXOffset;
        const endY = rectB.top - containerRect.top + rectB.height / 2 + endYOffset;
        const controlY = startY - curvature;
        const d = `M ${startX},${startY} Q ${(startX + endX) / 2},${controlY} ${endX},${endY}`;
        setPathD(d);
      }
    };
    const resizeObserver = new ResizeObserver(() => {
      updatePath();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    updatePath();
    return () => {
      resizeObserver.disconnect();
    };
  }, [
    containerRef,
    fromRef,
    toRef,
    curvature,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset
  ]);
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      fill: "none",
      width: svgDimensions.width,
      height: svgDimensions.height,
      xmlns: "http://www.w3.org/2000/svg",
      className: cn(
        "pointer-events-none absolute top-0 left-0 transform-gpu stroke-2",
        className
      ),
      viewBox: `0 0 ${svgDimensions.width} ${svgDimensions.height}`,
      children: [
        /* @__PURE__ */ jsx(
          "path",
          {
            d: pathD,
            stroke: pathColor,
            strokeWidth: pathWidth,
            strokeOpacity: pathOpacity,
            strokeLinecap: "round"
          }
        ),
        /* @__PURE__ */ jsx(
          "path",
          {
            d: pathD,
            strokeWidth: pathWidth,
            stroke: `url(#${id})`,
            strokeOpacity: "1",
            strokeLinecap: "round"
          }
        ),
        /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs(
          motion.linearGradient,
          {
            className: "transform-gpu",
            id,
            gradientUnits: "userSpaceOnUse",
            initial: {
              x1: "0%",
              x2: "0%",
              y1: "0%",
              y2: "0%"
            },
            animate: {
              x1: gradientCoordinates.x1,
              x2: gradientCoordinates.x2,
              y1: gradientCoordinates.y1,
              y2: gradientCoordinates.y2
            },
            transition: {
              delay,
              duration,
              ease: [0.16, 1, 0.3, 1],
              repeat: Infinity,
              repeatDelay: 0
            },
            children: [
              /* @__PURE__ */ jsx("stop", { stopColor: gradientStartColor, stopOpacity: "0" }),
              /* @__PURE__ */ jsx("stop", { stopColor: gradientStartColor }),
              /* @__PURE__ */ jsx("stop", { offset: "32.5%", stopColor: gradientStopColor }),
              /* @__PURE__ */ jsx(
                "stop",
                {
                  offset: "100%",
                  stopColor: gradientStopColor,
                  stopOpacity: "0"
                }
              )
            ]
          }
        ) })
      ]
    }
  );
};
function AnimatedBeamMultipleOutputDemo({
  className,
  ...props
}) {
  const containerRef = useRef(null);
  const fromRef = useRef(null);
  const to1Ref = useRef(null);
  const to2Ref = useRef(null);
  const to3Ref = useRef(null);
  const to4Ref = useRef(null);
  const circleClass = "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background text-sm font-medium";
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: containerRef,
      className: cn(
        "relative flex h-[300px] w-full items-center justify-center overflow-hidden rounded-lg bg-background",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsx("div", { className: "absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2", children: /* @__PURE__ */ jsx("div", { ref: fromRef, className: cn(circleClass, "border-primary"), children: "C" }) }),
        /* @__PURE__ */ jsx("div", { ref: to1Ref, className: cn(circleClass, "absolute left-1/4 top-1/4 border-violet-500"), children: "1" }),
        /* @__PURE__ */ jsx("div", { ref: to2Ref, className: cn(circleClass, "absolute right-1/4 top-1/4 border-amber-500"), children: "2" }),
        /* @__PURE__ */ jsx("div", { ref: to3Ref, className: cn(circleClass, "absolute bottom-1/4 left-1/4 border-emerald-500"), children: "3" }),
        /* @__PURE__ */ jsx("div", { ref: to4Ref, className: cn(circleClass, "absolute bottom-1/4 right-1/4 border-rose-500"), children: "4" }),
        /* @__PURE__ */ jsx(
          AnimatedBeam,
          {
            containerRef,
            fromRef,
            toRef: to1Ref,
            curvature: -75,
            gradientStartColor: "#8b5cf6",
            gradientStopColor: "#ec4899"
          }
        ),
        /* @__PURE__ */ jsx(
          AnimatedBeam,
          {
            containerRef,
            fromRef,
            toRef: to2Ref,
            curvature: -75,
            gradientStartColor: "#f59e0b",
            gradientStopColor: "#8b5cf6"
          }
        ),
        /* @__PURE__ */ jsx(
          AnimatedBeam,
          {
            containerRef,
            fromRef,
            toRef: to3Ref,
            curvature: 75,
            gradientStartColor: "#10b981",
            gradientStopColor: "#8b5cf6"
          }
        ),
        /* @__PURE__ */ jsx(
          AnimatedBeam,
          {
            containerRef,
            fromRef,
            toRef: to4Ref,
            curvature: 75,
            gradientStartColor: "#f43f5e",
            gradientStopColor: "#8b5cf6"
          }
        )
      ]
    }
  );
}
function AnimatedListItem({ children }) {
  const animations = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, originY: 0 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: "spring", stiffness: 350, damping: 40 }
  };
  return /* @__PURE__ */ jsx(motion.div, { ...animations, layout: true, className: "mx-auto w-full", children });
}
const AnimatedList = React__default.memo(
  ({ children, className, delay = 1e3, ...props }) => {
    const [index, setIndex] = useState$1(0);
    const childrenArray = useMemo(
      () => React__default.Children.toArray(children),
      [children]
    );
    useEffect$1(() => {
      let timeout = null;
      if (index < childrenArray.length - 1) {
        timeout = setTimeout(() => {
          setIndex((prevIndex) => (prevIndex + 1) % childrenArray.length);
        }, delay);
      }
      return () => {
        if (timeout !== null) {
          clearTimeout(timeout);
        }
      };
    }, [index, delay, childrenArray.length]);
    const itemsToShow = useMemo(() => {
      const result = childrenArray.slice(0, index + 1).reverse();
      return result;
    }, [index, childrenArray]);
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: cn(`flex flex-col items-center gap-4`, className),
        ...props,
        children: /* @__PURE__ */ jsx(AnimatePresence, { children: itemsToShow.map((item) => /* @__PURE__ */ jsx(AnimatedListItem, { children: item }, item.key)) })
      }
    );
  }
);
AnimatedList.displayName = "AnimatedList";
const notifications = [
  { id: 1, title: "New message", body: "You have a new message from the team." },
  { id: 2, title: "Update complete", body: "Your export has finished processing." },
  { id: 3, title: "Reminder", body: "Meeting with the team in 30 minutes." },
  { id: 4, title: "File shared", body: "Someone shared a document with you." }
];
function AnimatedListDemo({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    AnimatedList,
    {
      className,
      delay: 2e3,
      ...props,
      children: notifications.map((n) => /* @__PURE__ */ jsxs(
        "div",
        {
          className: cn(
            "flex w-full items-center gap-3 rounded-lg border px-3 py-2",
            "border-neutral-950/[.1] bg-neutral-950/[.02]",
            "dark:border-neutral-50/[.1] dark:bg-neutral-50/[.08]"
          ),
          children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10", children: /* @__PURE__ */ jsx(BellIcon, { className: "h-4 w-4 text-primary" }) }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-0.5", children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-neutral-900 dark:text-neutral-100", children: n.title }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: n.body })
            ] })
          ]
        },
        n.id
      ))
    }
  );
}
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DATES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
const selectedDate = 11;
function CalendarPlaceholder({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn(
        "w-fit rounded-md border border-border bg-background p-2",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsx("div", { className: "mb-1 text-center text-xs font-medium", children: "May 2022" }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-7 gap-0.5 text-center text-[10px]", children: [
          DAYS.map((d) => /* @__PURE__ */ jsx("div", { className: "font-medium text-muted-foreground", children: d }, d)),
          DATES.map((d) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: cn(
                "h-5 w-5 rounded transition-colors hover:bg-accent text-[10px]",
                d === selectedDate && "bg-primary text-primary-foreground hover:bg-primary/90"
              ),
              children: d
            },
            d
          ))
        ] })
      ]
    }
  );
}
function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      ...props,
      className: cn(
        "group flex [gap:var(--gap)] overflow-hidden p-2 [--duration:40s] [--gap:1rem]",
        {
          "flex-row": !vertical,
          "flex-col": vertical
        },
        className
      ),
      children: Array(repeat).fill(0).map((_, i) => /* @__PURE__ */ jsx(
        "div",
        {
          className: cn("flex shrink-0 justify-around [gap:var(--gap)]", {
            "animate-marquee flex-row": !vertical,
            "animate-marquee-vertical flex-col": vertical,
            "group-hover:[animation-play-state:paused]": pauseOnHover,
            "[animation-direction:reverse]": reverse
          }),
          children
        },
        i
      ))
    }
  );
}
const files = [{
  name: "bitcoin.pdf",
  body: "Bitcoin is a cryptocurrency invented in 2008 by an unknown person or group of people using the name Satoshi Nakamoto."
}, {
  name: "finances.xlsx",
  body: "A spreadsheet or worksheet is a file made of rows and columns that help sort data, arrange data easily, and calculate numerical data."
}, {
  name: "logo.svg",
  body: "Scalable Vector Graphics is an Extensible Markup Language-based vector image format for two-dimensional graphics with support for interactivity and animation."
}, {
  name: "keys.gpg",
  body: "GPG keys are used to encrypt and decrypt email, files, directories, and whole disk partitions and to authenticate messages."
}, {
  name: "seed.txt",
  body: "A seed phrase, seed recovery phrase or backup seed phrase is a list of words which store all the information needed to recover Bitcoin funds on-chain."
}];
const features = [{
  Icon: FileTextIcon,
  name: "Save your files",
  description: "We automatically save your files as you type.",
  href: "#",
  cta: "Learn more",
  className: "col-span-3 lg:col-span-1",
  background: /* @__PURE__ */ jsx(Marquee, {
    pauseOnHover: true,
    className: "absolute top-10 [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] [--duration:20s]",
    children: files.map((f, idx) => /* @__PURE__ */ jsxs("figure", {
      className: cn("relative w-32 cursor-pointer overflow-hidden rounded-xl border p-4", "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]", "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]", "transform-gpu blur-[1px] transition-all duration-300 ease-out hover:blur-none"),
      children: [/* @__PURE__ */ jsx("div", {
        className: "flex flex-row items-center gap-2",
        children: /* @__PURE__ */ jsx("div", {
          className: "flex flex-col",
          children: /* @__PURE__ */ jsx("figcaption", {
            className: "text-sm font-medium dark:text-white",
            children: f.name
          })
        })
      }), /* @__PURE__ */ jsx("blockquote", {
        className: "mt-2 text-xs",
        children: f.body
      })]
    }, idx))
  })
}, {
  Icon: BellIcon,
  name: "Notifications",
  description: "Get notified when something happens.",
  href: "#",
  cta: "Learn more",
  className: "col-span-3 lg:col-span-2",
  background: /* @__PURE__ */ jsx(AnimatedListDemo, {
    className: "absolute top-4 right-2 h-[300px] w-full scale-75 border-none [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-90"
  })
}, {
  Icon: Share2Icon,
  name: "Integrations",
  description: "Supports 100+ integrations and counting.",
  href: "#",
  cta: "Learn more",
  className: "col-span-3 lg:col-span-2",
  background: /* @__PURE__ */ jsx(AnimatedBeamMultipleOutputDemo, {
    className: "absolute top-4 right-2 h-[300px] border-none [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-105"
  })
}, {
  Icon: CalendarIcon,
  name: "Calendar",
  description: "Use the calendar to filter your files by date.",
  className: "col-span-3 lg:col-span-1",
  href: "#",
  cta: "Learn more",
  background: /* @__PURE__ */ jsx(CalendarPlaceholder, {
    className: "absolute top-10 right-0 origin-top scale-50 rounded-md border [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-[0.55]"
  })
}];
const chartData = [{
  date: new Date(Date.now() - 29 * 24 * 60 * 60 * 1e3),
  revenue: 12e3,
  costs: 8500
}, {
  date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1e3),
  revenue: 13500,
  costs: 9200
}, {
  date: new Date(Date.now() - 27 * 24 * 60 * 60 * 1e3),
  revenue: 11e3,
  costs: 7800
}, {
  date: new Date(Date.now() - 26 * 24 * 60 * 60 * 1e3),
  revenue: 14500,
  costs: 10100
}, {
  date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1e3),
  revenue: 13800,
  costs: 9400
}, {
  date: new Date(Date.now() - 24 * 24 * 60 * 60 * 1e3),
  revenue: 15200,
  costs: 10800
}, {
  date: new Date(Date.now() - 23 * 24 * 60 * 60 * 1e3),
  revenue: 16e3,
  costs: 11200
}, {
  date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1e3),
  revenue: 14800,
  costs: 10500
}, {
  date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1e3),
  revenue: 15500,
  costs: 10900
}, {
  date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1e3),
  revenue: 14200,
  costs: 9800
}, {
  date: new Date(Date.now() - 19 * 24 * 60 * 60 * 1e3),
  revenue: 16800,
  costs: 11800
}, {
  date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1e3),
  revenue: 17500,
  costs: 12400
}, {
  date: new Date(Date.now() - 17 * 24 * 60 * 60 * 1e3),
  revenue: 16200,
  costs: 11500
}, {
  date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1e3),
  revenue: 15800,
  costs: 11200
}, {
  date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1e3),
  revenue: 17200,
  costs: 12100
}, {
  date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3),
  revenue: 18500,
  costs: 13200
}, {
  date: new Date(Date.now() - 13 * 24 * 60 * 60 * 1e3),
  revenue: 17800,
  costs: 12600
}, {
  date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1e3),
  revenue: 16500,
  costs: 11700
}, {
  date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1e3),
  revenue: 19200,
  costs: 13800
}, {
  date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1e3),
  revenue: 18800,
  costs: 13400
}, {
  date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1e3),
  revenue: 17500,
  costs: 12400
}, {
  date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1e3),
  revenue: 19800,
  costs: 14200
}, {
  date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3),
  revenue: 20500,
  costs: 14800
}, {
  date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1e3),
  revenue: 19200,
  costs: 13600
}, {
  date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1e3),
  revenue: 21e3,
  costs: 15200
}, {
  date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3),
  revenue: 21800,
  costs: 15800
}, {
  date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3),
  revenue: 20500,
  costs: 14600
}, {
  date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1e3),
  revenue: 22500,
  costs: 16200
}, {
  date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1e3),
  revenue: 23200,
  costs: 16800
}, {
  date: /* @__PURE__ */ new Date(),
  revenue: 24e3,
  costs: 17400
}];
function meta$1({}) {
  return [{
    title: "Tauron"
  }, {
    name: "description",
    content: "Transform your business with AI-powered solutions."
  }];
}
const home = UNSAFE_withComponentProps(function Home() {
  const heroProps = {
    title: "Transform Your Business with AI-Powered Solutions",
    description: "Revolutionize your workflow with our cutting-edge artificial intelligence platform.",
    announcementBanner: {
      text: "New feature release!",
      linkText: "Check out our AI Assistant",
      linkHref: "/features/ai-assistant"
    },
    callToActions: [{
      text: "Start Free Trial",
      href: "/signup",
      variant: "primary"
    }, {
      text: "Watch Demo",
      href: "/demo",
      variant: "secondary"
    }],
    titleSize: "large",
    className: "min-h-screen"
  };
  return /* @__PURE__ */ jsxs(BeamsBackground, {
    intensity: "strong",
    children: [/* @__PURE__ */ jsx(HeroLanding, {
      ...heroProps,
      embedInBackground: true
    }), /* @__PURE__ */ jsx("div", {
      className: "relative w-full overflow-x-hidden px-6 pt-28 pb-16",
      children: /* @__PURE__ */ jsxs("div", {
        className: "mx-auto max-w-7xl space-y-24",
        children: [/* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsxs("h2", {
            className: "mb-12 text-center text-3xl font-semibold leading-none tracking-tighter text-white text-balance sm:text-4xl md:text-5xl lg:text-6xl",
            children: ["Tauron", " ", /* @__PURE__ */ jsx(LineShadowText, {
              className: "italic",
              shadowColor: "white",
              children: "Profit"
            }), " ", "is Guaranteed"]
          }), /* @__PURE__ */ jsxs("div", {
            className: "grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "space-y-6 text-white",
              children: [/* @__PURE__ */ jsx("p", {
                className: "text-lg leading-relaxed text-white/90",
                children: "Our AI-powered platform delivers consistent, data-driven insights so you can make informed decisions. Revenue and cost tracking in one place."
              }), /* @__PURE__ */ jsxs("ul", {
                className: "space-y-3 text-white/80",
                children: [/* @__PURE__ */ jsxs("li", {
                  className: "flex items-center gap-2",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "h-1.5 w-1.5 rounded-full bg-white/60"
                  }), "Real-time revenue and cost analytics"]
                }), /* @__PURE__ */ jsxs("li", {
                  className: "flex items-center gap-2",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "h-1.5 w-1.5 rounded-full bg-white/60"
                  }), "Transparent, auditable metrics"]
                }), /* @__PURE__ */ jsxs("li", {
                  className: "flex items-center gap-2",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "h-1.5 w-1.5 rounded-full bg-white/60"
                  }), "Built for scale and reliability"]
                })]
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm",
              children: /* @__PURE__ */ jsxs(AreaChart, {
                data: chartData,
                className: "h-[280px] w-full",
                aspectRatio: "16 / 9",
                children: [/* @__PURE__ */ jsx(Grid, {
                  horizontal: true
                }), /* @__PURE__ */ jsx(Area, {
                  dataKey: "revenue",
                  fill: "var(--chart-line-primary)",
                  fillOpacity: 0.3,
                  fadeEdges: true
                }), /* @__PURE__ */ jsx(Area, {
                  dataKey: "costs",
                  fill: "var(--chart-line-secondary)",
                  fillOpacity: 0.3,
                  fadeEdges: true
                }), /* @__PURE__ */ jsx(XAxis, {}), /* @__PURE__ */ jsx(ChartTooltip, {
                  rows: (point) => [{
                    color: "var(--chart-line-primary)",
                    label: "Revenue",
                    value: `$${point.revenue?.toLocaleString()}`
                  }, {
                    color: "var(--chart-line-secondary)",
                    label: "Costs",
                    value: `$${point.costs?.toLocaleString()}`
                  }]
                })]
              })
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsxs("h2", {
            className: "mb-10 text-center text-3xl font-semibold leading-none tracking-tighter text-white text-balance sm:text-4xl md:text-5xl lg:text-6xl",
            children: ["Our", " ", /* @__PURE__ */ jsx(LineShadowText, {
              className: "italic",
              shadowColor: "white",
              children: "Features"
            })]
          }), /* @__PURE__ */ jsx(BentoGrid, {
            children: features.map((feature, idx) => /* @__PURE__ */ jsx(BentoCard, {
              ...feature
            }, idx))
          })]
        })]
      })
    })]
  });
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: home,
  meta: meta$1
}, Symbol.toStringTag, { value: "Module" }));
const values = [
  {
    title: "Trust & Transparency",
    description: "We prioritize data integrity and financial clarity, ensuring every AI-synthesized insight is traceable and unbiased for our users.",
    icon: /* @__PURE__ */ jsx(ShieldCheck, { className: "w-5 h-5 text-indigo-400" }),
    index: 1,
    tag: "Integrity"
  },
  {
    title: "Continuous Innovation",
    description: "Integrating state-of-the-art AI research into daily market interactions to bridge the gap between complex data and investor awareness.",
    icon: /* @__PURE__ */ jsx(Lightbulb, { className: "w-5 h-5 text-amber-400" }),
    index: 2,
    tag: "Future-Ready"
  },
  {
    title: "Community Growth",
    description: "Empowering individuals through accessible financial education and proactive support to build a stronger, more informed investor community.",
    icon: /* @__PURE__ */ jsx(Users, { className: "w-5 h-5 text-rose-400" }),
    index: 3,
    tag: "Empowerment"
  }
];
function AboutValues() {
  return /* @__PURE__ */ jsxs("section", { className: "py-12 relative z-10", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center mb-10 text-center", children: [
      /* @__PURE__ */ jsxs("h2", { className: "text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight", children: [
        "Our ",
        /* @__PURE__ */ jsx("span", { className: "text-white/40", children: "Core Values" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "text-white/50 max-w-2xl text-base md:text-lg leading-relaxed", children: "The principles that drive our research and define our commitment to transforming financial intelligence." })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: values.map((value) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]",
        children: [
          /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-indigo-500/5 blur-3xl transition-all duration-700 group-hover:bg-indigo-500/10" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-start mb-5", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 border border-white/10 transition-transform duration-500 group-hover:scale-110", children: value.icon }),
              /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase tracking-widest text-neutral-500 border border-white/5 px-2 py-1 rounded bg-neutral-950/50", children: value.tag })
            ] }),
            /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold text-white mb-2 tracking-tight", children: value.title }),
            /* @__PURE__ */ jsx("p", { className: "text-sm leading-relaxed text-neutral-400 group-hover:text-neutral-300 transition-colors", children: value.description })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 pt-4 border-t border-white/5 flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600", children: "Ethical Standard" }),
            /* @__PURE__ */ jsx("div", { className: "h-1 w-1 rounded-full bg-indigo-500/20 group-hover:bg-indigo-400 animate-pulse" })
          ] })
        ]
      },
      value.index
    )) })
  ] });
}
const team = [
  {
    name: "İrem KARAKAPLAN",
    role: "Project Manager & AI Researcher",
    image: "https://github.com/iremkrkaplan.png?size=400",
    links: { github: "https://github.com/iremkrkaplan", linkedin: "https://www.linkedin.com/in/irem-karakaplan/" }
  },
  {
    name: "Baha TÜTÜNCÜOĞLU",
    role: "Software Architect & Data Engineer",
    image: "https://github.com/Avassaa.png?size=400",
    links: { github: "https://github.com/Avassaa", linkedin: "https://www.linkedin.com/in/baha-tutuncuoglu/" }
  },
  {
    name: "Veysel Reşit ÇAÇAN",
    role: "NLP Specialist & Backend Developer",
    image: "https://github.com/Chillyfeely.png?size=400",
    links: { github: "https://github.com/Chillyfeely", linkedin: "https://www.linkedin.com/in/veysel-re%C5%9Fit-%C3%A7a%C3%A7an/" }
  },
  {
    name: "Sude AKINCI",
    role: "UI/UX Designer & Frontend Developer",
    image: "https://github.com/sudeakinci.png?size=400",
    links: { github: "https://github.com/sudeakinci", linkedin: "https://www.linkedin.com/in/sudeakinci/" }
  }
];
function TeamSection() {
  return /* @__PURE__ */ jsxs("section", { className: "py-12 relative z-10", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center mb-12 text-center", children: [
      /* @__PURE__ */ jsxs("h2", { className: "text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight", children: [
        "Our ",
        /* @__PURE__ */ jsx("span", { className: "text-white/40", children: "Team" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "text-white/50 max-w-2xl text-base md:text-lg leading-relaxed", children: "A dedicated group of computer engineering students from Akdeniz University developing next-generation financial intelligence." })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6", children: team.map((member, index) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: "group relative flex flex-col items-center rounded-3xl border border-white/5 bg-neutral-900/40 p-6 transition-all duration-500 hover:border-white/10 hover:bg-neutral-800/50",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "relative mb-6 h-48 w-48 overflow-hidden rounded-2xl border border-white/5 shadow-2xl", children: [
            /* @__PURE__ */ jsx(
              "img",
              {
                src: member.image,
                alt: member.name,
                className: "h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0 group-hover:opacity-100 opacity-60"
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 flex items-center justify-center gap-3 bg-neutral-950/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100", children: [
              /* @__PURE__ */ jsx(
                "a",
                {
                  href: member.links.github,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  "aria-label": `${member.name} GitHub`,
                  className: "p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors",
                  children: /* @__PURE__ */ jsx(Github, { size: 16 })
                }
              ),
              /* @__PURE__ */ jsx(
                "a",
                {
                  href: member.links.linkedin,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  "aria-label": `${member.name} LinkedIn`,
                  className: "p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors",
                  children: /* @__PURE__ */ jsx(Linkedin, { size: 16 })
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
            /* @__PURE__ */ jsx("h4", { className: "text-lg font-bold text-white tracking-tight leading-tight", children: member.name }),
            /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400/80", children: member.role })
          ] })
        ]
      },
      index
    )) })
  ] });
}
function AboutCTA() {
  const [isOpen, setIsOpen] = useState$1(false);
  const [showTriggerButton, setShowTriggerButton] = useState$1(true);
  const formRef = useRef(null);
  const contactFormRef = useRef(null);
  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get("name")?.toString().trim() ?? "";
    const email = formData.get("email")?.toString().trim() ?? "";
    const message = formData.get("message")?.toString().trim() ?? "";
    const subject = `New Contact Message from ${name || "Website Visitor"}`;
    const body = [
      `Name: ${name || "-"}`,
      `Email: ${email || "-"}`,
      "",
      "Message:",
      message || "-"
    ].join("\n");
    window.location.href = `mailto:hello@tauron.ai?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  useEffect$1(() => {
    if (!isOpen) {
      return;
    }
    if (!contactFormRef.current) {
      return;
    }
    const duration = 700;
    const offset = 96;
    const startTime = performance.now();
    const startScrollY = window.scrollY;
    let animationFrameId = 0;
    const easeInOutCubic = (value) => {
      return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
    };
    const animateScroll = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = easeInOutCubic(progress);
      const targetElement = contactFormRef.current;
      if (!targetElement) {
        return;
      }
      const dynamicTargetTop = window.scrollY + targetElement.getBoundingClientRect().top - offset;
      const nextScrollTop = startScrollY + (dynamicTargetTop - startScrollY) * easedProgress;
      window.scrollTo({ top: Math.max(0, nextScrollTop), behavior: "auto" });
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(animateScroll);
      }
    };
    animationFrameId = window.requestAnimationFrame(animateScroll);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen]);
  useEffect$1(() => {
    let timeoutId;
    if (isOpen) {
      setShowTriggerButton(false);
    } else {
      timeoutId = setTimeout(() => {
        setShowTriggerButton(true);
      }, 700);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isOpen]);
  return /* @__PURE__ */ jsxs("section", { className: "p-8 lg:p-12 rounded-[2.5rem] bg-gradient-to-b from-white/[0.05] to-transparent border border-white/10 backdrop-blur-md overflow-hidden relative transition-all duration-700 ease-in-out", children: [
    /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px]" }),
    /* @__PURE__ */ jsxs("div", { className: "relative z-10 max-w-5xl mx-auto", children: [
      /* @__PURE__ */ jsxs("div", { className: `text-center transition-all duration-500 ${isOpen ? "mb-10" : "mb-4"}`, children: [
        /* @__PURE__ */ jsxs("h2", { className: "text-3xl md:text-5xl font-bold text-white mb-2 tracking-tight", children: [
          "Ready to ",
          /* @__PURE__ */ jsx("span", { className: "text-white/70", children: "Navigate" }),
          " the Future?"
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-white/60 max-w-lg mx-auto text-base md:text-lg leading-relaxed", children: "Whether you are a researcher, developer, or investor, Tauron simplifies your interaction with financial markets." }),
        !isOpen && showTriggerButton && /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setIsOpen(true),
            className: "mt-8 px-8 py-2.5 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all active:scale-[0.98] text-sm",
            children: "Get in Touch"
          }
        )
      ] }),
      /* @__PURE__ */ jsx(
        "div",
        {
          ref: formRef,
          className: `grid transition-all duration-700 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`,
          children: /* @__PURE__ */ jsx("div", { className: "overflow-hidden", children: /* @__PURE__ */ jsxs("div", { className: "relative pt-8 border-t border-white/5 mt-4", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setIsOpen(false),
                className: "absolute top-4 right-0 flex items-center gap-1.5 text-white/30 hover:text-white transition-all text-[10px] uppercase tracking-widest font-bold",
                "aria-label": "Minimize form",
                children: [
                  "Minimize ",
                  /* @__PURE__ */ jsx(ChevronUp, { size: 14 })
                ]
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-[1fr,2fr] gap-8", children: [
              /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold text-white mb-1", children: "Contact Information" }),
                  /* @__PURE__ */ jsx("p", { className: "text-white/50 text-sm leading-relaxed italic", children: "Expert support within 24 hours." })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex gap-4 items-center group cursor-pointer", children: [
                  /* @__PURE__ */ jsx("div", { className: "flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 border border-white/10 group-hover:border-indigo-500/50 transition-colors", children: /* @__PURE__ */ jsx(Mail, { className: "w-4 h-4 text-indigo-400" }) }),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("h4", { className: "text-white text-xs font-semibold", children: "Get in Touch" }),
                    /* @__PURE__ */ jsx("p", { className: "text-indigo-300 text-sm font-medium", children: "hello@tauron.ai" })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("form", { ref: contactFormRef, className: "space-y-5", onSubmit: handleSubmit, children: [
                /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
                  /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
                    /* @__PURE__ */ jsx("label", { className: "text-[10px] font-medium text-white/40 pl-1 uppercase tracking-widest", children: "Name" }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        name: "name",
                        type: "text",
                        placeholder: "Your Name",
                        required: true,
                        className: "w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-all placeholder:text-white/10"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
                    /* @__PURE__ */ jsx("label", { className: "text-[10px] font-medium text-white/40 pl-1 uppercase tracking-widest", children: "Email" }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        name: "email",
                        type: "email",
                        placeholder: "Email Address",
                        required: true,
                        className: "w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-all placeholder:text-white/10"
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsx("label", { className: "text-[10px] font-medium text-white/40 pl-1 uppercase tracking-widest", children: "Message" }),
                  /* @__PURE__ */ jsx(
                    "textarea",
                    {
                      name: "message",
                      placeholder: "How can we help?",
                      rows: 4,
                      required: true,
                      className: "w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-all resize-none placeholder:text-white/10"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx("button", { type: "submit", className: "w-full py-4 rounded-full bg-white text-black text-sm font-bold hover:bg-neutral-200 hover:shadow-[0_20px_50px_rgba(255,255,255,0.1)] transition-all duration-150 cursor-pointer flex items-center justify-center", children: "Send Message" })
              ] })
            ] })
          ] }) })
        }
      )
    ] })
  ] });
}
const steps = [
  {
    title: "Multi-Source Gathering",
    desc: "Real-time extraction of raw data from 10+ global financial news outlets.",
    icon: /* @__PURE__ */ jsx(Share2, { className: "w-5 h-5 text-indigo-400" })
  },
  {
    title: "Semantic Analysis",
    desc: "Refining noise into signal using high-precision NLP and Sentiment Analysis.",
    icon: /* @__PURE__ */ jsx(Fingerprint, { className: "w-5 h-5 text-indigo-400" })
  },
  {
    title: "Contextual Synthesis",
    desc: "LLM-driven rephrasing to create original, concise, and unbiased summaries.",
    icon: /* @__PURE__ */ jsx(Zap, { className: "w-5 h-5 text-indigo-400" })
  },
  {
    title: "Predictive Edge",
    desc: "Transforming synthesized intelligence into proactive decision support.",
    icon: /* @__PURE__ */ jsx(TrendingUp, { className: "w-5 h-5 text-indigo-400" })
  }
];
function AboutWorkflow() {
  return /* @__PURE__ */ jsxs("section", { className: "py-12 border-t border-white/5", children: [
    /* @__PURE__ */ jsxs("div", { className: "text-center mb-10", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight", children: "Our Methodology" }),
      /* @__PURE__ */ jsx("p", { className: "text-white/50 max-w-2xl mx-auto text-base md:text-lg leading-relaxed", children: "The pipeline behind Tauron's intelligence cycle." })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6", children: steps.map((step, i) => /* @__PURE__ */ jsxs("div", { className: "p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group", children: [
      /* @__PURE__ */ jsx("div", { className: "mb-4 p-3 w-fit rounded-xl bg-indigo-500/10 border border-indigo-500/20 group-hover:scale-110 transition-transform", children: step.icon }),
      /* @__PURE__ */ jsx("h4", { className: "text-white font-bold text-lg mb-2 tracking-tight", children: step.title }),
      /* @__PURE__ */ jsx("p", { className: "text-white/50 text-sm leading-relaxed", children: step.desc })
    ] }, i)) })
  ] });
}
function meta({}) {
  return [{
    title: "About"
  }, {
    name: "description",
    content: "Learn about Tauron's mission, methodology, and team behind financial intelligence."
  }];
}
const about = UNSAFE_withComponentProps(function AboutPage() {
  const methodologyRef = useRef(null);
  const scrollToMethodology = () => {
    methodologyRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };
  return /* @__PURE__ */ jsx(BeamsBackground, {
    intensity: "medium",
    children: /* @__PURE__ */ jsx("div", {
      className: "relative min-h-screen w-full overflow-x-hidden pt-28 pb-16 px-6",
      children: /* @__PURE__ */ jsxs("div", {
        className: "max-w-7xl mx-auto space-y-12",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "text-center",
          children: [/* @__PURE__ */ jsxs("h1", {
            className: "text-4xl md:text-7xl font-bold tracking-tight text-white mb-6",
            children: ["The Future of ", /* @__PURE__ */ jsx("span", {
              className: "text-white/70",
              children: "Financial Intelligence"
            })]
          }), /* @__PURE__ */ jsx("p", {
            className: "max-w-3xl mx-auto text-base md:text-lg text-white/60 leading-relaxed",
            children: "Founded in 2025, Tauron is an advanced R&D ecosystem dedicated to bridging the gap between complex market data and actionable investor insights."
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "grid grid-cols-1 lg:grid-cols-2 gap-12 items-center",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "relative group",
            children: [/* @__PURE__ */ jsx("div", {
              className: "absolute -inset-4 bg-white/5 rounded-[2rem] blur-2xl group-hover:bg-white/10 transition-all duration-700"
            }), /* @__PURE__ */ jsxs("div", {
              className: "relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-neutral-900 shadow-2xl",
              children: [/* @__PURE__ */ jsx("img", {
                src: "/assets/images/about.png",
                alt: "stock image",
                className: "object-cover w-full h-full opacity-80 group-hover:scale-105 transition-transform duration-700"
              }), /* @__PURE__ */ jsx("div", {
                className: "absolute inset-0 bg-gradient-to-t from-neutral-950/60 to-transparent"
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "space-y-6",
            children: [/* @__PURE__ */ jsxs("h2", {
              className: "text-3xl md:text-5xl font-bold text-white tracking-tight text-balance leading-tight",
              children: ["Beyond Data ", /* @__PURE__ */ jsx("br", {}), /* @__PURE__ */ jsx("span", {
                className: "text-white/40 font-light",
                children: "Meaningful Insights"
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "space-y-4 text-white/70 text-base md:text-lg leading-relaxed",
              children: [/* @__PURE__ */ jsx("p", {
                children: "Tauron was born from a simple yet powerful research focus: Can we automate the synthesis of financial news to provide investors with a clear, unbiased edge?"
              }), /* @__PURE__ */ jsx("p", {
                children: "Our platform utilizes cutting-edge Web Scraping and Sentiment Analysis to filter through the noise of global markets. By integrating NLP with Large Language Models, we transform raw information into a proactive decision-support cycle."
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "pt-2",
              children: /* @__PURE__ */ jsx("button", {
                onClick: scrollToMethodology,
                className: "px-8 py-3 rounded-full bg-white text-black text-sm font-bold hover:bg-neutral-200 transition-all cursor-pointer active:scale-[0.98]",
                children: "Explore Methodology"
              })
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "space-y-9",
          children: [/* @__PURE__ */ jsx("div", {
            ref: methodologyRef,
            children: /* @__PURE__ */ jsx(AboutWorkflow, {})
          }), /* @__PURE__ */ jsx(AboutValues, {}), /* @__PURE__ */ jsx(TeamSection, {}), /* @__PURE__ */ jsx(AboutCTA, {})]
        })]
      })
    })
  });
});
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: about,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-Ctjporz1.js", "imports": ["/assets/chunk-EPOLDU6W-B4KiOFaT.js", "/assets/index-BLwFtPHP.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": true, "module": "/assets/root-DSzhZTwj.js", "imports": ["/assets/chunk-EPOLDU6W-B4KiOFaT.js", "/assets/index-BLwFtPHP.js", "/assets/button-714Eg0MO.js", "/assets/utils-yMAG7bfM.js"], "css": ["/assets/root-Btf3oECN.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/home/page/home": { "id": "routes/home/page/home", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/home-6DiyBPvc.js", "imports": ["/assets/chunk-EPOLDU6W-B4KiOFaT.js", "/assets/index-BLwFtPHP.js", "/assets/utils-yMAG7bfM.js", "/assets/beams-background-DNr2fNdb.js", "/assets/button-714Eg0MO.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/about/page/about": { "id": "routes/about/page/about", "parentId": "root", "path": "about", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/about-Dg8q3rT9.js", "imports": ["/assets/chunk-EPOLDU6W-B4KiOFaT.js", "/assets/beams-background-DNr2fNdb.js", "/assets/utils-yMAG7bfM.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-e874f00c.js", "version": "e874f00c", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_subResourceIntegrity": false, "unstable_trailingSlashAwareDataRequests": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/home/page/home": {
    id: "routes/home/page/home",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route1
  },
  "routes/about/page/about": {
    id: "routes/about/page/about",
    parentId: "root",
    path: "about",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
