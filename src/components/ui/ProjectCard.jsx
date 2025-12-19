import { Pill } from "./Pill";

export function ProjectCard({ project }) {
  return (
    <article className="group relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-white/20 hover:bg-white/10">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/0 via-fuchsia-500/0 to-emerald-500/0 opacity-0 transition group-hover:opacity-100" />
      <div className="relative">
        <h3 className="text-lg font-semibold text-white">{project.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
          {project.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {project.stack.map((s) => (
            <Pill key={s}>{s}</Pill>
          ))}
        </div>

        {project.links && project.links.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-3">
            {project.links.map((l) => (
              <a
                key={`${l.label}-${l.href}`}
                href={l.href}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-slate-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
              >
                {l.label}
                <span
                  aria-hidden="true"
                  className="transition group-hover:translate-x-0.5"
                >
                  →
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
