import { Github, Linkedin } from "lucide-react";

const team = [
  {
    name: "İrem KARAKAPLAN",
    role: "Project Manager & AI Researcher",
    image: "https://github.com/iremkrkaplan.png?size=400",
    links: { github: "https://github.com/iremkrkaplan", linkedin: "https://www.linkedin.com/in/irem-karakaplan/" },
  },
  {
    name: "Baha TÜTÜNCÜOĞLU",
    role: "Software Architect & Data Engineer",
    image: "https://github.com/Avassaa.png?size=400",
    links: { github: "https://github.com/Avassaa", linkedin: "https://www.linkedin.com/in/baha-tutuncuoglu/" },
  },
  {
    name: "Veysel Reşit ÇAÇAN",
    role: "NLP Specialist & Backend Developer",
    image: "https://github.com/Chillyfeely.png?size=400",
    links: { github: "https://github.com/Chillyfeely", linkedin: "https://www.linkedin.com/in/veysel-re%C5%9Fit-%C3%A7a%C3%A7an/" },
  },
  {
    name: "Sude AKINCI",
    role: "UI/UX Designer & Frontend Developer",
    image: "https://github.com/sudeakinci.png?size=400",
    links: { github: "https://github.com/sudeakinci", linkedin: "https://www.linkedin.com/in/sudeakinci/" },
  },
];

export function TeamSection() {
  return (
    <section className="py-12 relative z-10">
      <div className="flex flex-col items-center mb-12 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-foreground dark:text-white mb-4 tracking-tight">
          Our <span className="text-meta-blue">Team</span>
        </h2>
        <p className="text-muted-foreground dark:text-white/50 max-w-2xl text-base md:text-lg leading-relaxed">
          A dedicated group of computer engineering students from Akdeniz University
          developing next-generation financial intelligence.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {team.map((member, index) => (
          <div
            key={index}
            className="group relative flex flex-col items-center rounded-3xl border border-border bg-card p-6 shadow-sm transition-all duration-500 hover:bg-muted/60 dark:border-white/5 dark:bg-neutral-900/40 dark:shadow-none dark:hover:border-white/10 dark:hover:bg-neutral-800/50"
          >
            <div className="relative mb-6 h-48 w-48 overflow-hidden rounded-2xl border border-border shadow-2xl dark:border-white/5">
              <img
                src={member.image}
                alt={member.name}
                className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0 group-hover:opacity-100 opacity-60 dark:opacity-60"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:bg-neutral-950/40">
                <a
                  href={member.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${member.name} GitHub`}
                  className="p-2 rounded-full bg-background/90 text-foreground hover:bg-muted dark:bg-white/10 dark:hover:bg-white/20 dark:text-white"
                >
                  <Github size={16} />
                </a>
                <a
                  href={member.links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${member.name} LinkedIn`}
                  className="p-2 rounded-full bg-background/90 text-foreground hover:bg-muted dark:bg-white/10 dark:hover:bg-white/20 dark:text-white"
                >
                  <Linkedin size={16} />
                </a>
              </div>
            </div>

            <div className="text-center">
              <h4 className="text-lg font-bold text-foreground dark:text-white tracking-tight leading-tight">
                {member.name}
              </h4>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400/80">
                {member.role}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
