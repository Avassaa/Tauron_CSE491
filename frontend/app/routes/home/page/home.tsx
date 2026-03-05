import type { Route } from "./+types/home";
import { HeroLanding } from "~/routes/home/components/hero-1";
import type { HeroLandingProps } from "~/routes/home/components/hero-1";

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

  return <HeroLanding {...heroProps} />;
}
