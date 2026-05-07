import { useRef, type FormEvent } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const stats = [
  { value: "10+", label: "News Sources" },
  { value: "4", label: "AI Models" },
  { value: "Real-time", label: "Market Data" },
  { value: "24h", label: "Support" },
];

export function AboutCTA() {
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = data.get("name")?.toString().trim() ?? "";
    const email = data.get("email")?.toString().trim() ?? "";
    const message = data.get("message")?.toString().trim() ?? "";

    if (!name) { toast.error("Please enter your name."); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Please enter a valid email."); return; }
    if (!message) { toast.error("Please enter a message."); return; }

    const subject = `Message from ${name}`;
    const body = [`Name: ${name}`, `Email: ${email}`, "", message].join("\n");
    toast.success("Opening your email client…");
    window.location.href = `mailto:hello@tauron.ai?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-sm dark:border-white/8 dark:bg-white/[0.02]">
      {/* subtle top glow */}
      <div className="pointer-events-none absolute -top-20 left-1/3 h-40 w-[400px] -translate-x-1/2 rounded-full bg-indigo-500/6 blur-3xl dark:bg-indigo-500/10" />

      {/* Stats strip */}
      <div className="relative flex flex-wrap border-b border-border/60 dark:border-white/8">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex flex-1 min-w-[100px] flex-col items-center gap-1 px-6 py-4 text-center"
          >
            <span className="text-base font-semibold tabular-nums text-foreground dark:text-white/90">
              {s.value}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground dark:text-white/30">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-2">
        {/* Left */}
        <div className="flex flex-col justify-center gap-5 border-b border-border/60 px-8 py-10 lg:border-b-0 lg:border-r lg:px-10 dark:border-white/8">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-500/80 dark:text-indigo-400/60">
              Get in touch
            </p>
            <h2 className="text-2xl font-bold leading-snug tracking-tight text-foreground dark:text-white md:text-[1.75rem]">
              The market doesn't wait.{" "}
              <span className="text-meta-blue">Neither should you.</span>
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground dark:text-white/45">
              Whether you're a researcher, developer, or investor — Tauron turns
              market complexity into a clear, actionable edge.
            </p>
          </div>

          <a
            href="mailto:hello@tauron.ai"
            className="group inline-flex items-center gap-2 self-start rounded-full border border-border/70 bg-muted/60 px-4 py-2 text-xs font-medium text-foreground/70 transition-all hover:border-border hover:bg-muted hover:text-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45 dark:hover:text-white/80"
          >
            <Mail className="size-3.5" />
            hello@tauron.ai
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>

        {/* Right — form */}
        <div className="px-8 py-10 lg:px-10">
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground dark:text-white/35">
                  Name
                </label>
                <input
                  name="name"
                  type="text"
                  placeholder="Your name"
                  className="rounded-lg border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground dark:text-white/35">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  className="rounded-lg border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground dark:text-white/35">
                Message
              </label>
              <textarea
                name="message"
                placeholder="How can we help you?"
                rows={4}
                className="resize-none rounded-lg border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/20"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-neutral-100"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
