import { ShieldCheck, Lightbulb, Users } from "lucide-react";

const values = [
  {
    title: "Trust & Transparency",
    description:
      "We prioritize data integrity and financial clarity, ensuring every AI-synthesized insight is traceable and unbiased for our users.",
    icon: <ShieldCheck className="w-5 h-5 text-indigo-400" />,
    index: 1,
    tag: "Integrity"
  },
  {
    title: "Continuous Innovation",
    description:
      "Integrating state-of-the-art AI research into daily market interactions to bridge the gap between complex data and investor awareness.",
    icon: <Lightbulb className="w-5 h-5 text-amber-400" />,
    index: 2,
    tag: "Future-Ready"
  },
  {
    title: "Community Growth",
    description:
      "Empowering individuals through accessible financial education and proactive support to build a stronger, more informed investor community.",
    icon: <Users className="w-5 h-5 text-rose-400" />,
    index: 3,
    tag: "Empowerment"
  },
];

export function AboutValues() {
  return (
    <section className="py-12 relative z-10">
      <div className="flex flex-col items-center mb-10 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          Our <span className="text-white/40">Core Values</span>
        </h2>
        <p className="text-white/50 max-w-2xl text-base md:text-lg leading-relaxed">
          The principles that drive our research and define our commitment to 
          transforming financial intelligence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {values.map((value) => (
          <div
            key={value.index}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]"
          >
            {/* Soft Glow Effect */}
            <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-indigo-500/5 blur-3xl transition-all duration-700 group-hover:bg-indigo-500/10" />

            <div>
              <div className="flex justify-between items-start mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 border border-white/10 transition-transform duration-500 group-hover:scale-110">
                  {value.icon}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 border border-white/5 px-2 py-1 rounded bg-neutral-950/50">
                  {value.tag}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
                {value.title}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-400 group-hover:text-neutral-300 transition-colors">
                {value.description}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                Ethical Standard
              </span>
              <div className="h-1 w-1 rounded-full bg-indigo-500/20 group-hover:bg-indigo-400 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}