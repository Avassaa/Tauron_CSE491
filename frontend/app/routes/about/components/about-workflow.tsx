import { Share2, Zap, Fingerprint, TrendingUp } from "lucide-react";

const steps = [
  {
    title: "Multi-Source Gathering",
    desc: "Real-time extraction of raw data from 10+ global financial news outlets.",
    icon: <Share2 className="w-5 h-5 text-indigo-400" />
  },
  {
    title: "Semantic Analysis",
    desc: "Refining noise into signal using high-precision NLP and Sentiment Analysis.",
    icon: <Fingerprint className="w-5 h-5 text-indigo-400" />
  },
  {
    title: "Contextual Synthesis",
    desc: "LLM-driven rephrasing to create original, concise, and unbiased summaries.",
    icon: <Zap className="w-5 h-5 text-indigo-400" />
  },
  {
    title: "Predictive Edge",
    desc: "Transforming synthesized intelligence into proactive decision support.",
    icon: <TrendingUp className="w-5 h-5 text-indigo-400" />
  }
];

export function AboutWorkflow() {
  return (
    <section className="py-12 border-t border-white/5">
      <div className="text-center mb-10">
        <h3 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Our Methodology</h3>
        <p className="text-white/50 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
          The pipeline behind Tauron's intelligence cycle.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {steps.map((step, i) => (
          <div key={i} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
            <div className="mb-4 p-3 w-fit rounded-xl bg-indigo-500/10 border border-indigo-500/20 group-hover:scale-110 transition-transform">
              {step.icon}
            </div>
            <h4 className="text-white font-bold text-lg mb-2 tracking-tight">{step.title}</h4>
            <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}