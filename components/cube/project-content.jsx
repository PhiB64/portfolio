import { Globe, Layers, Code2, Smartphone, Zap, Server, Package, Wand2, Play, Cpu, Box, Shield, Mail, Database, Cloud, MapPin, ChevronRight, ExternalLink, Terminal, Rocket, Download } from "lucide-react";
import { PROJECT_CONTENT } from "../../lib/portfolio-content";

const PAGE_ICONS = [Globe, Layers, Server, Database, Smartphone, Rocket];

// Icône par compétence, déduite du libellé. Tableau plutôt que cascade de
// `if` : l'ordre des tests devient explicite, « react native » doit être
// évalué avant « react », et l'ajout d'une compétence se fait en une ligne.
// Le repli `null` laisse le CPU générique.
const ICON_SIZE = 15;
const ICON_CLASS = "text-[#00a5b0] shrink-0";
const SKILL_ICON_RULES = [
  [["html"], Globe],
  [["css", "scss"], Layers],
  [["javascript", "ecmascript"], Code2],
  [["responsive", "mobile-first", "react native", "flutter", "store", "synchronisation"], Smartphone],
  [["react"], Zap],
  [["next"], Server],
  [["vite"], Package],
  [["tailwind"], Wand2],
  [["gsap", "framer", "lenis"], Play],
  [["node", "express"], Terminal],
  [["strapi"], Layers],
  [["docker", "nginx"], Box],
  [["sécurité", "jwt"], Shield],
  [["email", "nodemailer", "resend"], Mail],
  [["postgres", "mongo", "maria", "sql", "base"], Database],
  [["cloudinary", "cloud"], Cloud],
  [["leaflet", "carte"], MapPin],
  [["pwa"], Smartphone],
];

// Résolu une seule fois : le libellé d'une compétence ne change pas pendant
// la vie du module, et le recalcul à chaque rendu n'était jamais justifié.
const SKILL_ICONS = new Map();
SKILL_ICON_RULES.forEach(([tokens, Icon], priority) => {
  tokens.forEach((token) => {
    if (!SKILL_ICONS.has(token)) SKILL_ICONS.set(token, { Icon, priority });
  });
});

function skillIcon(title) {
  const t = String(title).toLowerCase();
  let best = null;
  SKILL_ICONS.forEach((entry, token) => {
    if (!t.includes(token)) return;
    if (!best || entry.priority < best.priority) best = entry;
  });
  const Icon = best ? best.Icon : Cpu;
  return <Icon size={ICON_SIZE} className={ICON_CLASS} />;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export { PROJECT_CONTENT };

export function renderProjectContent(i, { onContact } = {}) {
  const p = PROJECT_CONTENT[i];

  const PageIcon = PAGE_ICONS[i];
  const items = [];
  items.push(
    <div key="hero">
      <p className="flex items-center gap-2 text-[#00a5b0] tracking-[0.2em] uppercase text-sm mb-4">
        <PageIcon size={16} />
        {p.label}
      </p>
      <h1 className="text-5xl font-bold text-white mb-6">{p.title}</h1>
      <div className="w-16 h-0.5 bg-[#00a5b0] mb-16" />
    </div>
  );
  if (p.profile) {
    items.push(
      <section key="profile" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">À propos de moi</h2>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
          {p.profile.bio.map((par, j) => <p key={j} className="text-[#94a3b8] leading-relaxed mb-4">{par}</p>)}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {p.profile.stats.map((s, j) => (
              <div key={j} className="text-center border border-[#1e293b] rounded-lg p-4">
                <p className="text-3xl font-bold text-[#00a5b0]">{s.value}</p>
                <p className="text-xs uppercase tracking-widest text-[#64748b] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          {p.profile.cvUrl && (
            <div className="text-center mt-8">
              <a
                href={`${BASE}${p.profile.cvUrl}`}
                download
                className="inline-flex items-center gap-2 text-xs tracking-widest uppercase border border-[#00a5b0]/50 text-[#00a5b0] rounded-full px-5 py-2.5 hover:bg-[#00a5b0]/10 transition-colors duration-200"
              >
                <Download size={13} /> Télécharger mon CV
              </a>
            </div>
          )}
        </div>
      </section>
    );
  }
  if (p.presentation) {
    items.push(
      <section key="presentation" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">Présentation</h2>
        {p.presentation.map((par, j) => <p key={j} className="text-[#94a3b8] leading-relaxed mb-4">{par}</p>)}
      </section>
    );
  }
  if (p.skills && p.skills.length > 0) {
    items.push(
      <section key="skills" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-8">{i === 0 ? "Mes compétences" : i === 1 ? "Mes outils" : "Mes compétences"}</h2>
        <div className="grid gap-6">
          {p.skills.map((s, j) => (
            <div key={j} className="border-l-2 border-[#00a5b0] pl-5">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-2">
                {skillIcon(s.title)} {s.title}
              </h3>
              <p className="text-[#94a3b8] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (p.features && p.features.length > 0) {
    const featureLabel = i === 2 ? "Fonctionnalités" : i === 0 ? "Ce que je réalise" : "Fonctionnalités";
    items.push(
      <section key="features" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">{featureLabel}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {p.features.map((f, j) => (
            <div key={j} className="text-[#94a3b8] flex items-center gap-2">
              <ChevronRight size={14} className="text-[#00a5b0] shrink-0" /> {f}
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (p.approach) {
    items.push(
      <section key="approach" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">Objectif</h2>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
          <div className="grid grid-cols-2 gap-3">
            {p.approach.map((a, j) => (
              <div key={j} className="text-[#94a3b8] flex items-center gap-2">
                <ChevronRight size={14} className="text-[#00a5b0] shrink-0" /> {a}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (p.philosophy) {
    items.push(
      <section key="philosophy" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">Ma philosophie</h2>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
          <p className="text-[#94a3b8] leading-relaxed italic">&ldquo;{p.philosophy}&rdquo;</p>
        </div>
      </section>
    );
  }
  if (p.projects) {
    items.push(
      <section key="projects" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-8">Projets</h2>
        <div className="grid gap-6">
          {p.projects.map((pr, j) => (
            <div key={j} className="border border-[#1e293b] rounded-lg p-6 bg-[#0f172a]">
              <h3 className="text-xl font-bold text-white mb-1">{pr.title}</h3>
              <p className="text-[#00a5b0] text-sm mb-2">{pr.tags}</p>
              <p className="text-[#94a3b8] mb-2">{pr.desc}</p>
              {pr.details && <p className="text-[#64748b] text-sm mb-4">{pr.details}</p>}
              {pr.links && pr.links.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {pr.links.map((l, k) => (
                    <a
                      key={k}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs tracking-widest uppercase border border-[#00a5b0]/50 text-[#00a5b0] rounded-full px-3 py-1 hover:bg-[#00a5b0]/10 transition-colors duration-200"
                    >
                      {l.label} <ExternalLink size={11} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (p.process) {
    items.push(
      <section key="process" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">Ma méthode de travail</h2>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
          <p className="text-[#94a3b8] mb-6">Chaque projet suit un processus rigoureux :</p>
          <div className="grid gap-4">
            {p.process.map((step, j) => (
              <div key={j} className="flex items-center gap-4 text-[#94a3b8]">
                <span className="text-[#00a5b0] font-bold text-sm w-6">{String(j + 1).padStart(2, "0")}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (typeof onContact === "function") {
    items.push(
      <section key="cta" className="mb-20 text-center">
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-10">
          <h2 className="text-2xl font-bold text-white mb-3">Un projet en tête ?</h2>
          <p className="text-[#94a3b8] mb-8">Discutons de votre besoin — réponse rapide garantie.</p>
          <button
            onClick={onContact}
            className="bg-[#00a5b0] text-white tracking-[0.2em] uppercase text-xs px-8 py-4 rounded hover:bg-[#00a5b0]/80 transition-colors duration-200 cursor-pointer border-0 inline-flex items-center gap-2"
          >
            <Mail size={14} /> Me contacter
          </button>
        </div>
      </section>
    );
  }
  return items;
}
