import { BrainCircuit, Newspaper, LineChart } from "lucide-react";

const values = [
  {
    title: "AI-Powered Analysis",
    description:
      "We don't just collect news; we analyze it using Natural Language Processing (NLP) and Large Language Models (LLM) to conduct integrated data mining processes.",
    icon: <BrainCircuit className="w-6 h-6 text-cyan-400" />,
    index: 1,
    tag: "NLP & LLM"
  },
  {
    title: "Autonomous Content",
    description:
      "Utilizing web scraping and rephrasing techniques, we synthesize complex financial data from over 10 global sources into original, easy-to-understand news content.",
    icon: <Newspaper className="w-6 h-6 text-emerald-400" />,
    index: 2,
    tag: "Web Scraping"
  },
  {
    title: "Decision Support",
    description:
      "By measuring market sentiment, Tauron provides a guide that reduces the time burden on investors and enables proactive decision-making.",
    icon: <LineChart className="w-6 h-6 text-purple-400" />,
    index: 3,
    tag: "Predictive Insight"
  },
];

export function AboutValues() {
  return (
    <section className="py-24 relative z-10">
      <div className="flex flex-col items-center mb-16 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 italic tracking-tight">
          Tauron <span className="text-white/40 font-light not-italic">Core Technologies</span>
        </h2>
        <p className="text-white/50 max-w-2xl text-base md:text-lg text-balance leading-relaxed">
          Combining AI-powered content generation with investment decision support systems
          to enhance financial literacy and market awareness.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {values.map((value) => (
          <div
            key={value.index}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/5 bg-neutral-900/40 p-8 transition-all duration-500 hover:border-white/20 hover:bg-neutral-800/60 shadow-2xl"
          >
            <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5 blur-3xl transition-all duration-700 group-hover:bg-white/15" />

            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-950 border border-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                  {value.icon}
                </div>
                <span className="text-[10px] font-mono text-neutral-600 bg-neutral-950 px-2 py-1 rounded border border-white/5">
                  {value.tag}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                {value.title}
              </h3>
              <p className="text-base leading-relaxed text-neutral-400 group-hover:text-neutral-300 transition-colors">
                {value.description}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                AI Workflow
              </span>
              <div className="h-1 w-1 rounded-full bg-white/20 group-hover:bg-white/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}