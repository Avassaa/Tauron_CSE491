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
      answer: "Tauron utilizes advanced machine learning models trained on historical market data, on-chain metrics, and technical indicators. Our engine analyzes patterns to provide predictive insights for various timeframes."
    },
    {
      question: "Where does the data come from?",
      answer: "We aggregate data from major exchanges like Binance and Kraken for price action, and utilize specialized providers for on-chain metrics and real-time news sentiment analysis."
    },
    {
      question: "How often is the data updated?",
      answer: "Market price data is tracked in real-time, while technical indicators and sentiment analysis are refreshed every minute to ensure the most up-to-date insights."
    },
    {
      question: "Is Tauron's analysis financial advice?",
      answer: "No. Tauron is an analytical tool designed for research and educational purposes. All data and predictions should be used as part of a broader research strategy. Always consult with a financial advisor before making investment decisions."
    },
    {
      question: "Which cryptocurrencies are supported?",
      answer: "We currently support major Layer 1 assets like Bitcoin (BTC), Ethereum (ETH), and Solana (SOL), with plans to expand our coverage to a wider range of DeFi and emerging tokens soon."
    }
  ],
  subscription: [
    {
      question: "What is included in the Pro plan?",
      answer: "The Pro plan includes advanced LLM-powered market analysis, real-time institutional-grade alerts, unlimited historical data access, and API keys for custom integrations."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Absolutely. You can manage and cancel your subscription at any time directly from your account settings. You will retain access until the end of your current billing period."
    },
    {
      question: "Do you offer a free trial?",
      answer: "Yes! We offer a 7-day free trial for new users to explore our complete suite of Pro features. No credit card is required to start your trial."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards."
    }
  ],
  account: [
    {
      question: "How do I reset my password?",
      answer: "Click the 'Forgot Password' link on the login page. We'll send a secure reset link to your registered email address. For security, these links expire after 30 minutes."
    },
    {
      question: "Is my account data secure?",
      answer: "Security is our top priority. We use industry-standard AES-256 encryption for data at rest and TLS 1.3 for all data in transit. We also offer robust multi-factor authentication (MFA)."
    },
    {
      question: "Can I change my registered email?",
      answer: "Yes, you can update your email address in the 'Security' section of your profile settings. You will need to verify both your old and new email addresses for security purposes."
    },
    {
      question: "How do I enable 2FA?",
      answer: "Navigate to Account Settings > Security and click 'Enable 2FA'. We currently support TOTP-based authentication apps like Google Authenticator or 1Password."
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
      </div>
    </BeamsBackground>
  );
}
