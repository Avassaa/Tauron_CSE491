import { Link } from "react-router";

const sections = [
  {
    title: "Product",
    links: [
      { name: "Features", href: "/#features" },
      { name: "Methodology", href: "/about#methodology" },
      { name: "Pricing", href: "/pricing" },
      { name: "FAQs", href: "/faqs" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About", href: "/about" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="w-full py-10 lg:py-16 border-t border-border bg-card/30 backdrop-blur-sm dark:bg-neutral-950/50 rounded-t-[2rem] lg:rounded-t-[3rem]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20">
          <div className="lg:col-span-4 space-y-4">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="text-xl font-bold tracking-tight text-foreground dark:text-white">Tauron</span>
            </Link>
            <p className="text-muted-foreground dark:text-white/60 text-sm leading-relaxed max-w-sm">
              Empowering global investors with advanced financial intelligence, real-time sentiment analysis, and AI-driven market insights.
            </p>
          </div>

          {/* nav sections */}
          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
            {sections.map((section) => (
              <div key={section.title} className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-widest text-foreground dark:text-white">
                  {section.title}
                </h4>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground hover:text-indigo-600 dark:text-white/50 dark:hover:text-indigo-400 transition-colors"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* bottom */}
        <div className="mt-10 pt-6 border-t border-border dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-muted-foreground dark:text-white/30">
          <p>© {new Date().getFullYear()} Tauron. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="#" className="hover:text-foreground dark:hover:text-white transition-colors">Terms of Service</Link>
            <Link to="#" className="hover:text-foreground dark:hover:text-white transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
