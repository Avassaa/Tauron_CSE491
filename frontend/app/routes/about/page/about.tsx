import type { Route } from "./+types/about";
import { useRef } from "react";
import { ArrowDown, Brain, Globe, Layers } from "lucide-react";
import { BeamsBackground } from "~/components/landing/beams-background";
import { AboutValues } from "../components/about-values";
import { TeamSection } from "../components/team-section";
import { AboutCTA } from "../components/cta";
import { AboutWorkflow } from "../components/about-workflow";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About — Tauron" },
    {
      name: "description",
      content:
        "Learn about Tauron's mission, methodology, and the team behind financial intelligence.",
    },
  ];
}

const pillars = [
  {
    icon: <Globe className="size-5 text-indigo-400" />,
    title: "Global Scraping",
    desc: "10+ real-time financial news sources aggregated continuously.",
  },
  {
    icon: <Brain className="size-5 text-violet-400" />,
    title: "AI Synthesis",
    desc: "LLMs transform raw articles into concise, unbiased summaries.",
  },
  {
    icon: <Layers className="size-5 text-sky-400" />,
    title: "Market Intelligence",
    desc: "Sentiment scores and predictive signals on every asset.",
  },
];

export default function AboutPage() {
  const methodologyRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);

  const scrollToMethodology = () => {
    methodologyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToTeam = () => {
    teamRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <BeamsBackground intensity="medium">
      <div className="relative min-h-screen w-full overflow-x-hidden pb-24 pt-28">
        <div className="mx-auto max-w-7xl space-y-24 px-6">

          {/* ── Hero ─────────────────────────────────────────────── */}
          <div className="flex flex-col items-center text-center">
            <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground/50 dark:text-white/25">
              Est. 2025
            </p>

            <h1 className="max-w-4xl text-5xl font-black leading-[1.05] tracking-tight text-foreground dark:text-white md:text-7xl">
              Financial intelligence,{" "}
              <span className="text-meta-blue">redefined.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground dark:text-white/55">
              Tauron is an advanced R&D ecosystem that bridges complex market data
              and actionable investor insights — powered by AI, built for those
              who refuse to settle for noise.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={scrollToMethodology}
                className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                Explore Methodology
              </button>
              <button
                type="button"
                onClick={scrollToTeam}
                className="flex items-center gap-2 rounded-full border border-border px-8 py-3 text-sm font-bold text-foreground/70 transition-all hover:border-border/80 hover:text-foreground dark:border-white/10 dark:text-white/50 dark:hover:text-white"
              >
                Meet the team
              </button>
            </div>

            <div className="mt-16 flex flex-col items-center gap-2 text-muted-foreground/40 dark:text-white/20">
              <ArrowDown className="size-4 animate-bounce" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Scroll</span>
            </div>
          </div>

          {/* ── 3 pillars ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {pillars.map((p, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-md transition-all duration-500 hover:bg-muted/50 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-indigo-500/5 blur-3xl transition-all duration-700 group-hover:bg-indigo-500/10" />
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted dark:border-white/10 dark:bg-neutral-900">
                  {p.icon}
                </div>
                <h3 className="mb-2 text-base font-black tracking-tight text-foreground dark:text-white">
                  {p.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground dark:text-white/50">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>

          {/* ── Our Story ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-indigo-500/5 blur-3xl dark:bg-indigo-500/8" />
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border shadow-2xl dark:border-white/8">
                <img
                  src="/assets/images/about.png"
                  alt="Tauron platform"
                  className="h-full w-full object-cover opacity-85 transition-transform duration-700 hover:scale-[1.03] dark:opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent dark:from-neutral-950/50" />
                <div className="absolute bottom-5 left-5 flex items-center gap-2.5 rounded-2xl border border-white/20 bg-black/40 px-4 py-2.5 backdrop-blur-md">
                  <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-white/90">Live market data</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-400">
                  Our Story
                </p>
                <h2 className="text-3xl font-black leading-tight tracking-tight text-foreground dark:text-white md:text-5xl">
                  Beyond data —{" "}
                  <span className="font-light text-meta-blue">meaningful insights.</span>
                </h2>
              </div>

              <div className="space-y-4 text-base leading-relaxed text-muted-foreground dark:text-white/60 md:text-lg">
                <p>
                  Tauron was born from a single research question: can we automate the
                  synthesis of financial news to give investors a clear, unbiased edge?
                </p>
                <p>
                  Our platform combines web scraping, NLP sentiment analysis, and large
                  language models to transform raw information into a proactive
                  decision-support cycle — in real time.
                </p>
              </div>

              <blockquote className="border-l-2 border-indigo-500/40 pl-5">
                <p className="text-sm italic leading-relaxed text-muted-foreground dark:text-white/40">
                  "We don't just aggregate news. We extract the signal hidden inside it."
                </p>
              </blockquote>
            </div>
          </div>

          {/* ── Methodology, Values, Team, CTA ────────────────── */}
          <div className="space-y-20">
            <div ref={methodologyRef}>
              <AboutWorkflow />
            </div>
            <AboutValues />
            <div ref={teamRef}>
              <TeamSection />
            </div>
            <AboutCTA />
          </div>

        </div>
      </div>
    </BeamsBackground>
  );
}
