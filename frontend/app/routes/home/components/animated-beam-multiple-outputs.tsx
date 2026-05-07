import { useRef } from "react"
import { Newspaper, BarChart2, Brain, MessageSquare, TrendingUp, Activity, Globe, Cpu } from "lucide-react"
import { cn } from "~/lib/utils"
import { AnimatedBeam } from "~/routes/home/components/animated-beam"

const NodeIcon = ({
  icon: Icon,
  label,
  color,
  className,
}: {
  icon: React.ElementType
  label: string
  color: string
  className?: string
}) => (
  <div className={cn("flex flex-col items-center gap-1", className)}>
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]",
        color
      )}
    >
      <Icon className="size-3.5" />
    </div>
    <span className="text-[8px] font-semibold uppercase tracking-wider text-white/25 whitespace-nowrap">{label}</span>
  </div>
)

const CenterNode = ({ nodeRef }: { nodeRef: React.RefObject<HTMLDivElement> }) => (
  <div className="flex flex-col items-center gap-1.5">
    <div
      ref={nodeRef}
      className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-meta-blue/30 bg-meta-blue/15 shadow-[0_0_20px_-4px_oklch(0.55_0.22_255)]"
    >
      <Activity className="size-5 text-meta-blue" />
      <span className="absolute inset-0 rounded-2xl border border-meta-blue/20 animate-ping opacity-30" />
    </div>
    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-meta-blue/60">Tauron</span>
  </div>
)

export default function AnimatedBeamMultipleOutputDemo({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const containerRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLDivElement>(null)
  const newsRef = useRef<HTMLDivElement>(null)
  const exchangeRef = useRef<HTMLDivElement>(null)
  const nlpRef = useRef<HTMLDivElement>(null)
  const onChainRef = useRef<HTMLDivElement>(null)
  const sentimentRef = useRef<HTMLDivElement>(null)
  const forecastRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-[300px] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#08080f]",
        className
      )}
      {...props}
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06),transparent_65%)]" />

      {/* Layout: inputs | center | outputs */}
      <div className="relative z-10 flex w-full items-center justify-between px-8">

        {/* Inputs */}
        <div className="flex flex-col justify-center gap-4">
          <div ref={newsRef}>
            <NodeIcon icon={Newspaper} label="News APIs" color="text-violet-400" />
          </div>
          <div ref={exchangeRef}>
            <NodeIcon icon={BarChart2} label="Exchange" color="text-amber-400" />
          </div>
          <div ref={nlpRef}>
            <NodeIcon icon={Brain} label="NLP Model" color="text-emerald-400" />
          </div>
          <div ref={onChainRef}>
            <NodeIcon icon={Globe} label="On-Chain" color="text-sky-400" />
          </div>
        </div>

        {/* Center */}
        <CenterNode nodeRef={centerRef} />

        {/* Outputs */}
        <div className="flex flex-col justify-center gap-5">
          <div ref={sentimentRef}>
            <NodeIcon icon={TrendingUp} label="Sentiment" color="text-rose-400" />
          </div>
          <div ref={forecastRef}>
            <NodeIcon icon={Cpu} label="Forecast" color="text-meta-blue" />
          </div>
          <div ref={chatRef}>
            <NodeIcon icon={MessageSquare} label="AI Chat" color="text-fuchsia-400" />
          </div>
        </div>
      </div>

      {/* Beams: inputs → center */}
      <AnimatedBeam containerRef={containerRef} fromRef={newsRef} toRef={centerRef} curvature={20} gradientStartColor="#8b5cf6" gradientStopColor="#3b82f6" />
      <AnimatedBeam containerRef={containerRef} fromRef={exchangeRef} toRef={centerRef} curvature={-10} gradientStartColor="#f59e0b" gradientStopColor="#3b82f6" />
      <AnimatedBeam containerRef={containerRef} fromRef={nlpRef} toRef={centerRef} curvature={10} gradientStartColor="#10b981" gradientStopColor="#3b82f6" />
      <AnimatedBeam containerRef={containerRef} fromRef={onChainRef} toRef={centerRef} curvature={-20} gradientStartColor="#0ea5e9" gradientStopColor="#3b82f6" />

      {/* Beams: center → outputs */}
      <AnimatedBeam containerRef={containerRef} fromRef={centerRef} toRef={sentimentRef} curvature={-20} gradientStartColor="#3b82f6" gradientStopColor="#f43f5e" />
      <AnimatedBeam containerRef={containerRef} fromRef={centerRef} toRef={forecastRef} curvature={0} gradientStartColor="#3b82f6" gradientStopColor="#3b82f6" />
      <AnimatedBeam containerRef={containerRef} fromRef={centerRef} toRef={chatRef} curvature={20} gradientStartColor="#3b82f6" gradientStopColor="#d946ef" />
    </div>
  )
}
