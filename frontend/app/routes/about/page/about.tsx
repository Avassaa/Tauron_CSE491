import type { Route } from "./+types/about";
import { useRef } from "react";
import { BeamsBackground } from "@/components/beams-background";
import { AboutValues } from "../components/about-values";
import { TeamSection } from "../components/team-section";
import { AboutCTA } from "../components/cta";
import { AboutWorkflow } from "../components/about-workflow";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About" },
    {
      name: "description",
      content:
        "Learn about Tauron's mission, methodology, and team behind financial intelligence.",
    },
  ];
}

export default function AboutPage() {
  const methodologyRef = useRef<HTMLDivElement>(null);

  const scrollToMethodology = () => {
    methodologyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <BeamsBackground intensity="medium">
      <div className="relative min-h-screen w-full overflow-x-hidden pt-28 pb-16 px-6">
        <div className="max-w-7xl mx-auto space-y-12">

          {/* Hero Section */}
          <div className="text-center">
            <h1 className="text-4xl md:text-7xl font-bold tracking-tight text-foreground dark:text-white mb-6">
              The Future of <span className="text-meta-blue">Financial Intelligence</span>
            </h1>
            <p className="max-w-3xl mx-auto text-base md:text-lg text-muted-foreground dark:text-white/60 leading-relaxed">
              Founded in 2025, Tauron is an advanced R&D ecosystem dedicated to
              bridging the gap between complex market data and actionable investor insights.
            </p>
          </div>

          {/* Our Story Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative group">
              <div className="absolute -inset-4 bg-foreground/5 rounded-[2rem] blur-2xl group-hover:bg-foreground/10 transition-all duration-700 dark:bg-white/5 dark:group-hover:bg-white/10" />
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border bg-muted shadow-2xl dark:border-white/10 dark:bg-neutral-900">
                <img
                  src="/assets/images/about.png"
                  alt="stock image"
                  className="object-cover w-full h-full opacity-90 group-hover:scale-105 transition-transform duration-700 dark:opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent dark:from-neutral-950/60" />
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-3xl md:text-5xl font-bold text-foreground dark:text-white tracking-tight text-balance leading-tight">
                Beyond Data <br />
                <span className="text-meta-blue font-light">Meaningful Insights</span>
              </h2>

              <div className="space-y-4 text-muted-foreground dark:text-white/70 text-base md:text-lg leading-relaxed">
                <p>
                  Tauron was born from a simple yet powerful research focus:
                  Can we automate the synthesis of financial news to provide
                  investors with a clear, unbiased edge?
                </p>
                <p>
                  Our platform utilizes cutting-edge Web Scraping and Sentiment Analysis
                  to filter through the noise of global markets. By integrating
                  NLP with Large Language Models, we transform
                  raw information into a proactive decision-support cycle.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={scrollToMethodology}
                  className="px-8 py-3 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all cursor-pointer active:scale-[0.98] dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  Explore Methodology
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-9">
            <div ref={methodologyRef}>
              <AboutWorkflow />
            </div>
            <AboutValues />
            <TeamSection />
            <AboutCTA />
          </div>

        </div>
      </div>
    </BeamsBackground>
  );
}
