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

/**
 * Niveaux de titre de la section, décalés d'un cran.
 *
 * Ce rendu sert à deux emplacements, et ils n'ont pas la même place dans la
 * hiérarchie du document :
 *
 * - l'overlay projet, où il est le seul contenu de la boîte de dialogue. Le
 *   titre de section est alors le `h1` du document (il est repris par
 *   `aria-labelledby`) et les sous-titres ses `h2` ;
 * - la page `/projects`, qui contient les six sections à la suite. Un seul `h1`
 *   doit nommer la page ; chaque section est alors un `h2`, ses sous-parties un
 *   `h3`, et les éléments de liste un `h4`. Six `h1` sur une page donneraient au
 *   lecteur d'écran six annonces « titre de niveau 1 » et au moteur de recherche
 *   six sujets concurrents plutôt qu'un seul.
 *
 * Le décalage passe donc par les mêmes balises, et `0` — la valeur par défaut —
 * restitue exactement le balisage de l'overlay. C'est ce qui permet à la page de
 * ne pas dupliquer le contenu : elle appelle ce rendu, elle ne le réécrit pas.
 *
 * @param {number} offset
 * @returns {{title: string, section: string, item: string}}
 */
function headingTags(offset) {
  return {
    title: `h${1 + offset}`,
    section: `h${2 + offset}`,
    item: `h${3 + offset}`,
  };
}

/**
 * Identifiant d'ancre stable pour une section, dérivé de son libellé.
 *
 * `renderProjectContent` n'expose pas de slug et n'en a pas besoin : seul le
 * titrage de la page statique a besoin d'ancres, et le libellé — déjà unique et
 * déjà en minuscules dans les données — suffit à les produire.
 *
 * @param {{label?: string}} section
 * @returns {string}
 */
export function sectionSlug(section) {
  return String(section?.label ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Contenu d'une section de projet, partagé par l'overlay et la page statique.
 *
 * Fonction pure, sans état ni effet : c'est ce qui permet à une page serveur de
 * l'appeler et de recevoir du HTML déjà rendu. `onContact` reste facultatif — la
 * page statique ne le fournit pas, donc l'appel à l'action, qui n'y aurait aucun
 * gestionnaire, n'y est pas rendu.
 *
 * @param {number} i - index de la section dans `PROJECT_CONTENT`
 * @param {{onContact?: () => void, headingOffset?: number, titleId?: string}} [options]
 * @returns {import("react").ReactNode[]}
 */
export function renderProjectContent(i, { onContact, headingOffset = 0, titleId = "project-overlay-title" } = {}) {
  const p = PROJECT_CONTENT[i];
  if (!p) return [];
  const H = headingTags(headingOffset);

  const PageIcon = PAGE_ICONS[i];
  const items = [];
  items.push(
    <div key="hero">
      <p className="flex items-center gap-2 text-[#00a5b0] tracking-[0.2em] uppercase text-sm mb-4">
        <PageIcon size={16} />
        {p.label}
      </p>
      {/* `id` repris par `aria-labelledby` du dialog parent : c'est ce titre
          qui nomme l'overlay projet aux lecteurs d'écran. La page statique lui
          passe son propre `id`, sinon les six sections porteraient le même. */}
      <H.title id={titleId} className="text-5xl font-bold text-white mb-6">{p.title}</H.title>
      <div className="w-16 h-0.5 bg-[#00a5b0] mb-16" />
    </div>
  );
  if (p.profile) {
    items.push(
      <section key="profile" className="mb-20">
        <H.section className="text-2xl font-bold text-[#00a5b0] mb-6">À propos de moi</H.section>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
          {p.profile.bio.map((par, j) => <p key={j} className="text-[#94a3b8] leading-relaxed mb-4">{par}</p>)}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {p.profile.stats.map((s, j) => (
              <div key={j} className="text-center border border-[#1e293b] rounded-lg p-4">
                <p className="text-3xl font-bold text-[#00a5b0]">{s.value}</p>
                <p className="text-xs uppercase tracking-widest text-[#7c8ca1] mt-1">{s.label}</p>
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
        <H.section className="text-2xl font-bold text-[#00a5b0] mb-6">Présentation</H.section>
        {p.presentation.map((par, j) => <p key={j} className="text-[#94a3b8] leading-relaxed mb-4">{par}</p>)}
      </section>
    );
  }
  if (p.skills && p.skills.length > 0) {
    items.push(
      <section key="skills" className="mb-20">
        <H.section className="text-2xl font-bold text-[#00a5b0] mb-8">{i === 0 ? "Mes compétences" : i === 1 ? "Mes outils" : "Mes compétences"}</H.section>
        <div className="grid gap-6">
          {p.skills.map((s, j) => (
            <div key={j} className="border-l-2 border-[#00a5b0] pl-5">
              <H.item className="flex items-center gap-2 text-lg font-bold text-white mb-2">
                {skillIcon(s.title)} {s.title}
              </H.item>
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
        <H.section className="text-2xl font-bold text-[#00a5b0] mb-6">{featureLabel}</H.section>
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
        <H.section className="text-2xl font-bold text-[#00a5b0] mb-6">Objectif</H.section>
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
        <H.section className="text-2xl font-bold text-[#00a5b0] mb-6">Ma philosophie</H.section>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
          <p className="text-[#94a3b8] leading-relaxed italic">&ldquo;{p.philosophy}&rdquo;</p>
        </div>
      </section>
    );
  }
  if (p.projects) {
    items.push(
      <section key="projects" className="mb-20">
        <H.section className="text-2xl font-bold text-[#00a5b0] mb-8">Projets</H.section>
        <div className="grid gap-6">
          {p.projects.map((pr, j) => (
            <div key={j} className="border border-[#1e293b] rounded-lg p-6 bg-[#0f172a]">
              <H.item className="text-xl font-bold text-white mb-1">{pr.title}</H.item>
              <p className="text-[#00a5b0] text-sm mb-2">{pr.tags}</p>
              <p className="text-[#94a3b8] mb-2">{pr.desc}</p>
              {pr.details && <p className="text-[#7c8ca1] text-sm mb-4">{pr.details}</p>}
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
        <H.section className="text-2xl font-bold text-[#00a5b0] mb-6">Ma méthode de travail</H.section>
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
          <H.section className="text-2xl font-bold text-white mb-3">Un projet en tête ?</H.section>
          <p className="text-[#94a3b8] mb-8">Discutons de votre besoin — réponse rapide garantie.</p>
          <button
            onClick={onContact}
            className="bg-[#00a5b0] text-[#0a0f1c] tracking-[0.2em] uppercase text-xs px-8 py-4 rounded hover:bg-[#00a5b0]/80 transition-colors duration-200 cursor-pointer border-0 inline-flex items-center gap-2"
          >
            <Mail size={14} /> Me contacter
          </button>
        </div>
      </section>
    );
  }
  return items;
}
