import { useRef } from "react"

import { cn } from "~/lib/utils"
import { AnimatedBeam } from "~/routes/home/components/animated-beam"

export default function AnimatedBeamMultipleOutputDemo({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fromRef = useRef<HTMLDivElement>(null)
  const to1Ref = useRef<HTMLDivElement>(null)
  const to2Ref = useRef<HTMLDivElement>(null)
  const to3Ref = useRef<HTMLDivElement>(null)
  const to4Ref = useRef<HTMLDivElement>(null)

  const circleClass =
    "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background text-sm font-medium"

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-[300px] w-full items-center justify-center overflow-hidden rounded-lg bg-background",
        className
      )}
      {...props}
    >
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
        <div ref={fromRef} className={cn(circleClass, "border-primary")}>
          C
        </div>
      </div>
      <div ref={to1Ref} className={cn(circleClass, "absolute left-1/4 top-1/4 border-violet-500")}>
        1
      </div>
      <div ref={to2Ref} className={cn(circleClass, "absolute right-1/4 top-1/4 border-amber-500")}>
        2
      </div>
      <div ref={to3Ref} className={cn(circleClass, "absolute bottom-1/4 left-1/4 border-emerald-500")}>
        3
      </div>
      <div ref={to4Ref} className={cn(circleClass, "absolute bottom-1/4 right-1/4 border-rose-500")}>
        4
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={fromRef}
        toRef={to1Ref}
        curvature={-75}
        gradientStartColor="#8b5cf6"
        gradientStopColor="#ec4899"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={fromRef}
        toRef={to2Ref}
        curvature={-75}
        gradientStartColor="#f59e0b"
        gradientStopColor="#8b5cf6"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={fromRef}
        toRef={to3Ref}
        curvature={75}
        gradientStartColor="#10b981"
        gradientStopColor="#8b5cf6"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={fromRef}
        toRef={to4Ref}
        curvature={75}
        gradientStartColor="#f43f5e"
        gradientStopColor="#8b5cf6"
      />
    </div>
  )
}
