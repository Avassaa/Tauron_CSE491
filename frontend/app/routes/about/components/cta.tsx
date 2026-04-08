import { useState, useRef, useEffect, type FormEvent } from "react";
import { Mail, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export function AboutCTA() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTriggerButton, setShowTriggerButton] = useState(true);
  const formRef = useRef<HTMLDivElement>(null);
  const contactFormRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name")?.toString().trim() ?? "";
    const email = formData.get("email")?.toString().trim() ?? "";
    const message = formData.get("message")?.toString().trim() ?? "";

    // Manual validation
    if (!name) {
      toast.error("Please enter your name");
      return;
    }
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!message) {
      toast.error("Please enter your message");
      return;
    }

    const subject = `New Contact Message from ${name}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      "",
      "Message:",
      message,
    ].join("\n");

    toast.success("Opening your email client...");
    window.location.href = `mailto:hello@tauron.ai?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    if (prevIsOpen.current === isOpen) {
      return;
    }
    prevIsOpen.current = isOpen;

    const duration = 700;
    const startTime = performance.now();
    const startScrollY = window.scrollY;
    let animationFrameId = 0;

    const easeInOutCubic = (value: number) => {
      return value < 0.5
        ? 4 * value * value * value
        : 1 - Math.pow(-2 * value + 2, 3) / 2;
    };

    const animateScroll = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      // calculate current max possible scroll to stay at the bottom
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const targetScrollTop = Math.max(0, maxScroll);

      const nextScrollTop = startScrollY + (targetScrollTop - startScrollY) * easedProgress;

      window.scrollTo({ top: nextScrollTop, behavior: "auto" });

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(animateScroll);
      }
    };

    animationFrameId = window.requestAnimationFrame(animateScroll);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (isOpen) {
      setShowTriggerButton(false);
    } else {
      timeoutId = setTimeout(() => {
        setShowTriggerButton(true);
      }, 700);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isOpen]);

  return (
    <section className="p-8 lg:p-12 rounded-[2.5rem] border border-border bg-card/80 backdrop-blur-md overflow-hidden relative transition-all duration-700 ease-in-out shadow-sm dark:border-white/10 dark:bg-gradient-to-b dark:from-white/[0.05] dark:to-transparent dark:shadow-none">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px]" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className={`text-center transition-all duration-500 ${isOpen ? "mb-10" : "mb-4"}`}>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground dark:text-white mb-2 tracking-tight">
            Ready to <span className="text-meta-blue">Navigate</span> the Future?
          </h2>
          <p className="text-muted-foreground dark:text-white/60 max-w-lg mx-auto text-base md:text-lg leading-relaxed">
            Whether you are a researcher, developer, or investor, Tauron simplifies your
            interaction with financial markets.
          </p>

          {!isOpen && showTriggerButton && (
            <button
              onClick={() => setIsOpen(true)}
              className="mt-8 px-8 py-2.5 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all active:scale-[0.98] text-sm"
            >
              Get in Touch
            </button>
          )}
        </div>

        <div
          ref={formRef}
          className={`grid transition-all duration-700 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
        >
          <div className="overflow-hidden">
            <div className="relative pt-8 border-t border-border dark:border-white/5 mt-4">
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-0 flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-all text-[10px] uppercase tracking-widest font-bold dark:text-white/30 dark:hover:text-white"
                aria-label="Minimize form"
              >
                Minimize <ChevronUp size={14} />
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr,2fr] gap-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-foreground dark:text-white mb-1">Contact Information</h3>
                    <p className="text-muted-foreground dark:text-white/50 text-sm leading-relaxed italic">
                      Expert support within 24 hours.
                    </p>
                  </div>

                  <a
                    href="mailto:hello@tauron.ai"
                    className="flex gap-4 items-center group cursor-pointer transition-opacity hover:opacity-80"
                  >
                    <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted group-hover:border-indigo-500/50 transition-colors dark:border-white/10 dark:bg-white/5">
                      <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-foreground dark:text-white text-xs font-semibold">Get in Touch</h4>
                      <p className="text-indigo-700 dark:text-indigo-300 text-sm font-medium">hello@tauron.ai</p>
                    </div>
                  </a>
                </div>

                <form ref={contactFormRef} className="space-y-5" onSubmit={handleSubmit} noValidate>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-muted-foreground pl-1 uppercase tracking-widest dark:text-white/40">Name</label>
                      <input
                        name="name"
                        type="text"
                        placeholder="Your Name"
                        required
                        className="w-full border border-input bg-background rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-indigo-500/40 transition-all placeholder:text-muted-foreground dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder:text-white/10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-muted-foreground pl-1 uppercase tracking-widest dark:text-white/40">Email</label>
                      <input
                        name="email"
                        type="email"
                        placeholder="Email Address"
                        required
                        className="w-full border border-input bg-background rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-indigo-500/40 transition-all placeholder:text-muted-foreground dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder:text-white/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground pl-1 uppercase tracking-widest dark:text-white/40">Message</label>
                    <textarea
                      name="message"
                      placeholder="How can we help?"
                      rows={4}
                      required
                      className="w-full border border-input bg-background rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-indigo-500/40 transition-all resize-none placeholder:text-muted-foreground dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder:text-white/10"
                    />
                  </div>
                  <button type="submit" className="w-full py-4 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all duration-150 cursor-pointer flex items-center justify-center dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:hover:shadow-[0_20px_50px_rgba(255,255,255,0.1)]">
                    Send Message
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
