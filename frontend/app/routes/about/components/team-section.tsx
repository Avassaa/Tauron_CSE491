import { Github, Linkedin } from "lucide-react";

const team = [
  {
    name: "İrem KARAKAPLAN",
    role: "Project Manager & AI Researcher",
    image: "/assets/images/ceo.jpg",
    links: { github: "https://github.com/iremkrkaplan", linkedin: "#" },
  },
  {
    name: "Baha TÜTÜNCÜOĞLU",
    role: "Software Architect & Data Engineer",
    image: "/assets/images/cfo.jpg",
    links: { github: "https://github.com/Avassaa", linkedin: "#" },
  },
  {
    name: "Veysel Reşit ÇAÇAN",
    role: "NLP Specialist & Backend Developer",
    image: "/assets/images/cto.jpg",
    links: { github: "https://github.com/Chillyfeely", linkedin: "#" },
  },
  {
    name: "Sude AKINCI",
    role: "UI/UX Designer & Frontend Developer",
    image: "/assets/images/coo.jpg",
    links: { github: "https://github.com/sudeakinci", linkedin: "#" },
  },
];

export function TeamSection() {
  return (
    <section className="py-12 relative z-10">
      <div className="flex flex-col items-center mb-12 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          Our <span className="text-white/40">Team</span>
        </h2>
        <p className="text-white/50 max-w-2xl text-base md:text-lg leading-relaxed">
          A dedicated group of computer engineering students from Akdeniz University 
          developing next-generation financial intelligence.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {team.map((member, index) => (
          <div
            key={index}
            className="group relative flex flex-col items-center rounded-3xl border border-white/5 bg-neutral-900/40 p-6 transition-all duration-500 hover:border-white/10 hover:bg-neutral-800/50"
          >
            {/* Image Container */}
            <div className="relative mb-6 h-48 w-48 overflow-hidden rounded-2xl border border-white/5 shadow-2xl">
              <img
                src={member.image}
                alt={member.name}
                className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0 group-hover:opacity-100 opacity-60"
              />
              {/* Overlay for social links on hover */}
              <div className="absolute inset-0 flex items-center justify-center gap-3 bg-neutral-950/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <a
                  href={member.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${member.name} GitHub`}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <Github size={16} />
                </a>
                <a
                  href={member.links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${member.name} LinkedIn`}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <Linkedin size={16} />
                </a>
              </div>
            </div>

            <div className="text-center">
              <h4 className="text-lg font-bold text-white tracking-tight leading-tight">
                {member.name}
              </h4>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400/80">
                {member.role}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}