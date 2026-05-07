import type { Route } from "./+types/faqs";
import { BeamsBackground } from "~/components/landing/beams-background";
import { ChevronDown, CreditCard, LayoutGrid, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "FAQ - Tauron" },
    {
      name: "description",
      content: "Frequently asked questions about Tauron's AI models, predictions, and data sources.",
    },
  ];
}

const CATEGORIES = [
  { id: "general", label: "General", icon: LayoutGrid },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "account", label: "Account & Login", icon: ShieldCheck },
];

const FAQ_DATA: Record<string, { question: string; answer: string }[]> = {
  general: [
    {
      question: "How does Tauron predict cryptocurrency prices?",
      answer: "Tauron uses machine learning models trained on historical market data, on-chain metrics, and technical indicators. Our engine identifies patterns across multiple timeframes to generate predictive signals for supported assets."
    },
    {
      question: "Where does the data come from?",
      answer: "We aggregate real-time price and volume data from major cryptocurrency exchanges, combined with on-chain metrics and news sentiment scraped continuously from 10+ global financial sources."
    },
    {
      question: "How often is the data updated?",
      answer: "Market price data is streamed in real-time. News articles are scraped and processed continuously, with AI-generated summaries and sentiment scores updated as new content arrives."
    },
    {
      question: "Is Tauron's analysis financial advice?",
      answer: "No. Tauron is an analytical research tool. All predictions, sentiment scores, and insights are for informational purposes only and should not be treated as investment advice. Always do your own research before making financial decisions."
    },
    {
      question: "Which cryptocurrencies are supported?",
      answer: "We currently support Bitcoin (BTC), Ethereum (ETH), and Solana (SOL) as primary Layer 1 assets, with coverage planned to expand to additional tokens over time."
    },
    {
      question: "Does Tauron have an AI chat assistant?",
      answer: "Yes. The AI Chat feature lets you ask questions about market conditions, asset performance, and news in natural language. The assistant draws on Tauron's live data and analysis pipeline to provide contextual answers."
    }
  ],
  subscription: [
    {
      question: "What is the difference between Free and Pro?",
      answer: "The Free plan gives you access to the core dashboard, news feed, watchlist, and basic market data. Pro unlocks advanced AI-powered analysis, extended backtest results, priority data access, and enhanced alert capabilities."
    },
    {
      question: "How do I upgrade my plan?",
      answer: "You can upgrade directly from the Settings page under the Subscription tab. Select your desired plan and follow the on-screen steps to complete the upgrade."
    },
    {
      question: "Can I switch back to the Free plan?",
      answer: "Yes. You can change your plan at any time from the Subscription section in Settings. Downgrades take effect immediately."
    },
    {
      question: "Are there any usage limits on the Free plan?",
      answer: "The Free plan includes access to the main platform features with standard data refresh rates. Pro removes these limits and enables advanced analytical features across all supported assets."
    }
  ],
  account: [
    {
      question: "How do I reset my password?",
      answer: "Click 'Forgot Password' on the login page and enter your registered email address. You will receive a secure reset link — these links expire after a short window for security."
    },
    {
      question: "Is my account data secure?",
      answer: "Yes. All data is transmitted over encrypted connections and passwords are stored as secure hashes — your plain-text password is never stored anywhere on our servers."
    },
    {
      question: "Can I change my username or full name?",
      answer: "Yes. Go to your Profile page and click 'Edit profile'. You can update your username and full name directly from there without leaving the page."
    },
    {
      question: "Can I change my registered email address?",
      answer: "Email addresses are currently fixed to the one used at registration. If you need to update your email, please reach out to us at hello@tauron.ai."
    },
    {
      question: "How do I set up price alerts?",
      answer: "Navigate to any asset page or the Watchlist section and configure an alert with your target price and condition (above or below). You will be notified automatically when the condition is triggered."
    }
  ]
};

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState("general");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = FAQ_DATA[activeCategory];

  return (
    <BeamsBackground intensity="subtle">
      <div className="relative min-h-screen w-full pt-32 pb-24 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold tracking-tight text-foreground dark:text-white mb-6"
          >
            Frequently Asked <span className="text-meta-blue">Questions</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground dark:text-white/60"
          >
            Everything you need to know about Tauron's intelligence platform.
          </motion.p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12 p-1.5 bg-neutral-100/50 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-border dark:border-white/10 w-fit mx-auto">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setOpenIndex(null);
                }}
                className={cn(
                  "relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer overflow-hidden",
                  isActive
                    ? "text-white shadow-lg"
                    : "text-muted-foreground hover:text-foreground dark:hover:text-white"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-meta-blue"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={cn("w-4 h-4 relative z-10", isActive ? "text-white" : "text-muted-foreground")} />
                <span className="relative z-10">{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {faqs.map((faq, index) => {
                const isOpen = openIndex === index;
                return (
                  <div
                    key={index}
                    className={cn(
                      "border rounded-2xl overflow-hidden transition-all duration-300",
                      "bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm",
                      "border-border dark:border-white/10",
                      isOpen ? "shadow-lg border-meta-blue/20" : "hover:border-foreground/20 dark:hover:border-white/20"
                    )}
                  >
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="w-full flex items-center justify-between p-6 text-left focus:outline-none cursor-pointer"
                    >
                      <h3 className="text-lg font-medium text-foreground dark:text-white pr-8">
                        {faq.question}
                      </h3>
                      <ChevronDown
                        className={cn(
                          "w-5 h-5 text-muted-foreground dark:text-white/50 transition-transform duration-300 flex-shrink-0",
                          isOpen && "transform rotate-180 text-meta-blue"
                        )}
                      />
                    </button>
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        isOpen ? "max-h-96 opacity-100 pb-6 px-6" : "max-h-0 opacity-0"
                      )}
                    >
                      <p className="text-muted-foreground dark:text-white/70 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer hint */}
        <p className="mt-12 text-center text-sm text-muted-foreground dark:text-white/30">
          Can't find what you're looking for?{" "}
          <a
            href="mailto:hello@tauron.ai"
            className="text-foreground underline-offset-4 hover:underline dark:text-white/60 dark:hover:text-white/80 transition-colors"
          >
            hello@tauron.ai
          </a>
        </p>
      </div>
    </BeamsBackground>
  );
}
