import type { Route } from "./+types/home";
import { CalendarIcon, FileTextIcon } from "@radix-ui/react-icons";
import { BellIcon, Share2Icon } from "lucide-react";

import {
  AreaChart,
  Area,
  Grid,
  XAxis,
} from "~/routes/home/components/area-chart";
import { BeamsBackground } from "@/components/beams-background";
import { BentoCard, BentoGrid } from "@/components/bento-grid";
import { HeroLanding } from "~/routes/home/components/hero-1";
import type { HeroLandingProps } from "~/routes/home/components/hero-1";
import AnimatedBeamMultipleOutputDemo from "~/routes/home/components/animated-beam-multiple-outputs";
import AnimatedListDemo from "~/routes/home/components/animated-list-demo";
import CalendarPlaceholder from "~/routes/home/components/calendar-placeholder";
import { LineShadowText } from "~/routes/home/components/line-shadow-text";
import { Marquee } from "~/routes/home/components/marquee";
import { cn } from "~/lib/utils";

const files = [
  {
    name: "bitcoin.pdf",
    body: "Bitcoin is a cryptocurrency invented in 2008 by an unknown person or group of people using the name Satoshi Nakamoto.",
  },
  {
    name: "finances.xlsx",
    body: "A spreadsheet or worksheet is a file made of rows and columns that help sort data, arrange data easily, and calculate numerical data.",
  },
  {
    name: "logo.svg",
    body: "Scalable Vector Graphics is an Extensible Markup Language-based vector image format for two-dimensional graphics with support for interactivity and animation.",
  },
  {
    name: "keys.gpg",
    body: "GPG keys are used to encrypt and decrypt email, files, directories, and whole disk partitions and to authenticate messages.",
  },
  {
    name: "seed.txt",
    body: "A seed phrase, seed recovery phrase or backup seed phrase is a list of words which store all the information needed to recover Bitcoin funds on-chain.",
  },
];

const features = [
  {
    Icon: FileTextIcon,
    name: "Save your files",
    description: "We automatically save your files as you type.",
    href: "#",
    cta: "Learn more",
    className: "col-span-3 lg:col-span-1",
    background: (
      <Marquee
        pauseOnHover
        className="absolute top-10 [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] [--duration:20s]"
      >
        {files.map((f, idx) => (
          <figure
            key={idx}
            className={cn(
              "relative w-32 cursor-pointer overflow-hidden rounded-xl border p-4",
              "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
              "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]",
              "transform-gpu blur-[1px] transition-all duration-300 ease-out hover:blur-none"
            )}
          >
            <div className="flex flex-row items-center gap-2">
              <div className="flex flex-col">
                <figcaption className="text-sm font-medium text-foreground dark:text-white">
                  {f.name}
                </figcaption>
              </div>
            </div>
            <blockquote className="mt-2 text-xs">{f.body}</blockquote>
          </figure>
        ))}
      </Marquee>
    ),
  },
  {
    Icon: BellIcon,
    name: "Notifications",
    description: "Get notified when something happens.",
    href: "#",
    cta: "Learn more",
    className: "col-span-3 lg:col-span-2",
    background: (
      <AnimatedListDemo className="absolute top-4 right-2 h-[300px] w-full scale-75 border-none [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-90" />
    ),
  },
  {
    Icon: Share2Icon,
    name: "Integrations",
    description: "Supports 100+ integrations and counting.",
    href: "#",
    cta: "Learn more",
    className: "col-span-3 lg:col-span-2",
    background: (
      <AnimatedBeamMultipleOutputDemo className="absolute top-4 right-2 h-[300px] border-none [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-105" />
    ),
  },
  {
    Icon: CalendarIcon,
    name: "Calendar",
    description: "Use the calendar to filter your files by date.",
    className: "col-span-3 lg:col-span-1",
    href: "#",
    cta: "Learn more",
    background: (
      <CalendarPlaceholder
        className="absolute top-10 right-0 origin-top scale-50 rounded-md border [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-[0.55]"
      />
    ),
  },
];

const chartData = [
  { date: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), revenue: 12000, costs: 8500 },
  { date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), revenue: 13500, costs: 9200 },
  { date: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000), revenue: 11000, costs: 7800 },
  { date: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000), revenue: 14500, costs: 10100 },
  { date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), revenue: 13800, costs: 9400 },
  { date: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000), revenue: 15200, costs: 10800 },
  { date: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000), revenue: 16000, costs: 11200 },
  { date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000), revenue: 14800, costs: 10500 },
  { date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), revenue: 15500, costs: 10900 },
  { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), revenue: 14200, costs: 9800 },
  { date: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000), revenue: 16800, costs: 11800 },
  { date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), revenue: 17500, costs: 12400 },
  { date: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000), revenue: 16200, costs: 11500 },
  { date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), revenue: 15800, costs: 11200 },
  { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), revenue: 17200, costs: 12100 },
  { date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), revenue: 18500, costs: 13200 },
  { date: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000), revenue: 17800, costs: 12600 },
  { date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), revenue: 16500, costs: 11700 },
  { date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000), revenue: 19200, costs: 13800 },
  { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), revenue: 18800, costs: 13400 },
  { date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000), revenue: 17500, costs: 12400 },
  { date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), revenue: 19800, costs: 14200 },
  { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), revenue: 20500, costs: 14800 },
  { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), revenue: 19200, costs: 13600 },
  { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), revenue: 21000, costs: 15200 },
  { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), revenue: 21800, costs: 15800 },
  { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), revenue: 20500, costs: 14600 },
  { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), revenue: 22500, costs: 16200 },
  { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), revenue: 23200, costs: 16800 },
  { date: new Date(), revenue: 24000, costs: 17400 },
];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Tauron" },
    { name: "description", content: "Transform your business with AI-powered solutions." },
  ];
}

export default function Home() {
  const heroProps: HeroLandingProps = {
    title: "Transform Your Business with AI-Powered Solutions",
    description: "Revolutionize your workflow with our cutting-edge artificial intelligence platform.",
    announcementBanner: {
      text: "New feature release!",
      linkText: "Check out our AI Assistant",
      linkHref: "/features/ai-assistant"
    },
    callToActions: [
      { text: "Start Free Trial", href: "/signup", variant: "primary" },
      { text: "Watch Demo", href: "/demo", variant: "secondary" }
    ],
    titleSize: "large",
    className: "min-h-screen"
  };

  return (
    <BeamsBackground intensity="strong">
      <HeroLanding {...heroProps} embedInBackground />
      <div className="relative w-full overflow-x-hidden px-6 pt-28 pb-16">
        <div className="mx-auto max-w-7xl space-y-24">
          <section>
            <h2 className="mb-10 text-center text-3xl font-semibold leading-none tracking-tighter text-foreground text-balance dark:text-white sm:text-4xl md:text-5xl lg:text-6xl">
              Our <LineShadowText className="text-meta-blue" shadowColor="oklch(0.55 0.22 255)">Features</LineShadowText>
            </h2>
            <BentoGrid>
              {features.map((feature, idx) => (
                <BentoCard key={idx} {...feature} />
              ))}
            </BentoGrid>
          </section>

          <section className="space-y-24">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div className="space-y-4 text-foreground dark:text-white">
                <div className="overflow-hidden pb-2">
                  <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    <LineShadowText className="text-meta-blue" shadowColor="oklch(0.55 0.22 255)">AI-driven</LineShadowText> insights for your data
                  </h3>
                </div>
                <p className="text-lg leading-relaxed text-foreground/90 dark:text-white/90">
                  We turn raw market data into actionable intelligence. Our platform
                  uses advanced analytics so you can make <span className="text-meta-blue font-medium">informed decisions</span> faster.
                </p>
                <p className="text-muted-foreground dark:text-white/80">
                  Real-time processing, transparent metrics, and enterprise-grade reliability.
                </p>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/40 dark:border-white/10 dark:bg-neutral-900/60">
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80"
                  alt="Analytics dashboard"
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div className="relative order-2 overflow-hidden rounded-2xl border border-border bg-muted/40 dark:border-white/10 dark:bg-neutral-900/60 lg:order-1">
                <img
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80"
                  alt="Data intelligence"
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
              <div className="order-1 space-y-4 text-foreground dark:text-white lg:order-2">
                <div className="overflow-hidden pb-2">
                  <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    From noise to <LineShadowText className="text-meta-blue" shadowColor="oklch(0.55 0.22 255)">signal</LineShadowText>
                  </h3>
                </div>
                <p className="text-lg leading-relaxed text-foreground/90 dark:text-white/90">
                  Filter the market noise with our <span className="text-meta-blue font-medium">NLP and LLM</span> pipeline.
                  Get clear, unbiased insights tailored to your strategy.
                </p>
                <p className="text-muted-foreground dark:text-white/80">
                  Built for researchers and investors who demand accuracy.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-12 text-center text-3xl font-semibold leading-none tracking-tighter text-foreground text-balance dark:text-white sm:text-4xl md:text-5xl lg:text-6xl">
              <LineShadowText className="text-meta-blue" shadowColor="oklch(0.55 0.22 255)">Profit</LineShadowText> is Guaranteed
            </h2>
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div className="space-y-6 text-foreground dark:text-white">
                <p className="text-lg leading-relaxed text-foreground/90 dark:text-white/90">
                  Our AI-powered platform delivers consistent, data-driven insights
                  so you can make <span className="text-meta-blue font-medium">informed decisions</span>. Revenue and cost tracking
                  in one place.
                </p>
                <ul className="space-y-3 text-muted-foreground dark:text-white/80">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-meta-blue" />
                    Real-time <span className="text-meta-blue">revenue and cost</span> analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-meta-blue" />
                    Transparent, auditable metrics
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-meta-blue" />
                    Built for <span className="text-meta-blue">scale and reliability</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-muted/60 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-black/40">
                <AreaChart data={chartData} className="h-[280px] w-full" aspectRatio="16 / 9">
                  <Grid horizontal />
                  <Area
                    dataKey="revenue"
                    fill="var(--chart-line-primary)"
                    fillOpacity={0.3}
                    fadeEdges
                  />
                  <Area
                    dataKey="costs"
                    fill="var(--chart-line-secondary)"
                    fillOpacity={0.3}
                    fadeEdges
                  />
                  <XAxis />
                </AreaChart>
              </div>
            </div>
          </section>
        </div>
      </div>
    </BeamsBackground>
  );
}
