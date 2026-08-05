import { Globe, Layers, Code2, Smartphone, Zap, Server, Package, Wand2, Play, Cpu, Box, Shield, Mail, Database, Cloud, MapPin, ChevronRight, ExternalLink, Terminal, Rocket } from "lucide-react";

const PAGE_ICONS = [Globe, Layers, Server, Database, Smartphone, Rocket];

export const PROJECT_CONTENT = [
  {
    label: "Développement Web",
    title: "Concevoir des expériences web modernes, performantes et accessibles.",
    presentation: [
      "Le développement web est bien plus que l'assemblage de technologies. Chaque projet est pensé pour offrir une navigation fluide, une identité visuelle cohérente et une expérience utilisateur agréable sur tous les supports.",
      "J'accorde une attention particulière à la sémantique HTML, aux performances de chargement, au SEO et à l'accessibilité WCAG afin de créer des sites fiables, durables et inclusifs.",
    ],
    skills: [
      { title: "HTML5", desc: "Structure sémantique, accessibilité WCAG, balisage optimisé pour le référencement naturel." },
      { title: "CSS3 / SCSS", desc: "Animations, Flexbox, Grid, variables CSS, architecture SCSS modulaire (utilisée dans CoolBooking et Landing Page Watch One)." },
      { title: "JavaScript ES2024", desc: "Interfaces dynamiques, manipulation du DOM, gestion des événements, Fetch API, modules natifs." },
      { title: "Responsive Design", desc: "Mobile-first, media queries, tests multi-supports — appliqué sur tous les projets livrés." },
    ],
    features: ["Sites vitrines", "Landing pages", "Portails d'événements", "Interfaces CMS", "Tableaux de bord", "Applications Web", "Accessibilité WCAG", "Animations GSAP"],
    philosophy: "Un site internet doit être rapide, intuitif et agréable à utiliser. La technique n'a de valeur que lorsqu'elle améliore réellement l'expérience utilisateur.",
  },
  {
    label: "Frameworks Front-end",
    title: "Créer des interfaces réactives, évolutives et performantes.",
    presentation: [
      "Les frameworks modernes permettent de développer des applications riches tout en conservant un code structuré et facilement maintenable.",
      "J'utilise React 19 et Next.js 15 dans des projets réels en production, associés à des outils d'animation avancés (GSAP, Framer Motion) et de navigation fluide (Lenis).",
    ],
    skills: [
      { title: "React 19", desc: "Composants réutilisables, Hooks, Context API, gestion d'état, Server Components." },
      { title: "Next.js 15", desc: "App Router, SSR/SSG hybride, SEO optimisé, chargement d'images, déploiement Vercel — utilisé en production sur le projet APD." },
      { title: "Vite", desc: "Build ultra-rapide pour le développement React, utilisé dans le frontend CoolBooking." },
      { title: "Tailwind CSS v4", desc: "Utility-first CSS, tokens de design, responsive rapide — utilisé dans Next.js 15 + APD." },
      { title: "GSAP 3 · Framer Motion", desc: "Animations scroll-driven, transitions de pages, reveal effects — intégrés dans le projet APD." },
      { title: "Lenis · Leaflet", desc: "Smooth scroll et cartes interactives géolocalisées — déployés en production." },
    ],
    approach: ["indépendant", "réutilisable", "facilement testable", "évolutif"],
  },
  {
    label: "Back-end",
    title: "Donner vie aux applications grâce à une architecture robuste et sécurisée.",
    presentation: [
      "Le serveur constitue le cœur d'une application. Il orchestre les échanges de données, sécurise les accès et assure la communication avec les bases de données.",
      "Je conçois des API REST avec Node.js/Express et des CMS headless avec Strapi v5, en TypeScript, pour des architectures découplées prêtes pour la production.",
    ],
    skills: [
      { title: "Node.js + Express", desc: "API REST, routing modulaire, middlewares, gestion des erreurs — architecture en couches (controllers / services / repositories) appliquée dans Volunteer Platform et CoolBooking." },
      { title: "Strapi v5 + TypeScript", desc: "Headless CMS open-source, content-types personnalisés, API auto-générée, plugins upload/email — utilisé en production pour l'APD." },
      { title: "Docker · NGINX · SSL", desc: "Conteneurisation avec Docker Compose, reverse proxy NGINX avec certificat SSL — déployé dans Formalis (e-learning)." },
      { title: "Sécurité", desc: "JWT, bcrypt, validation Joi, rate-limiting, CORS, protection OWASP — implémentés dans CoolBooking, APD et Volunteer Platform." },
      { title: "Nodemailer / Resend", desc: "Emails transactionnels, formulaires de contact, notifications automatiques — intégrés dans Strapi (APD)." },
    ],
    features: ["Authentification JWT", "Gestion des rôles", "Upload de fichiers", "CRUD complet", "API REST", "Emails transactionnels", "Validation des données", "Migrations SQL"],
  },
  {
    label: "Bases de données & Cloud",
    title: "Organiser, sécuriser et rendre les données accessibles partout.",
    presentation: [
      "Une application performante repose sur une gestion fiable des données. J'ai travaillé avec trois moteurs de bases de données distincts selon les besoins de chaque projet.",
      "Je gère également le déploiement et les médias via des services cloud, avec des pipelines de CI/CD simples et des environnements séparés.",
    ],
    skills: [
      { title: "PostgreSQL", desc: "Base relationnelle principale de l'APD — schémas, migrations, requêtes optimisées, hébergement Render." },
      { title: "MongoDB", desc: "Base NoSQL de CoolBooking — collections, documents, agrégation, modèles Mongoose." },
      { title: "MariaDB / MySQL", desc: "Variante relationnelle de CoolBooking — conception des tables, jointures, requêtes paramétrées." },
      { title: "Cloudinary", desc: "CDN de médias — upload d'images et vidéos, transformations automatiques, stockage sécurisé pour l'APD." },
    ],
    features: ["Vercel", "Netlify", "Render", "Cloudinary", "GitHub Actions", "Variables d'environnement", "Build production", "Déploiement continu"],
    approach: ["rapides", "fiables", "sécurisées", "facilement déployables"],
  },
  {
    label: "Développement Mobile",
    title: "Créer des applications mobiles modernes pour Android et iOS.",
    presentation: [
      "Les usages mobiles imposent des interfaces simples, rapides et parfaitement adaptées aux contraintes des smartphones.",
      "Ma maîtrise du responsive design et des frameworks cross-platform me permet de concevoir des expériences cohérentes sur toutes les tailles d'écran.",
    ],
    skills: [
      { title: "React Native", desc: "Applications natives performantes, navigation Stack/Tab, accès aux APIs système." },
      { title: "Flutter", desc: "Interfaces riches, widgets personnalisés, animations fluides, performances natives." },
      { title: "Responsive & Mobile-First", desc: "Approche mobile-first appliquée sur tous les projets web — testé et validé sur mobiles et tablettes." },
    ],
    features: ["Connexion utilisateur", "Notifications push", "Caméra", "Géolocalisation", "Stockage local", "Synchronisation API"],
  },
  {
    label: "Projets",
    title: "Des réalisations concrètes, du code en production.",
    presentation: [
      "Chaque projet ci-dessous représente une problématique réelle résolue de bout en bout : conception, développement, déploiement.",
      "Plusieurs sont collaboratifs (pull requests, code review, branches de travail) et certains sont accessibles en ligne.",
    ],
    projects: [
      {
        title: "CoolBooking",
        tags: "React 19 · Vite · Node.js · Express · MongoDB · MariaDB · SCSS",
        desc: "Plateforme full-stack de réservation de locations saisonnières.",
        details: "Inscription/connexion JWT, annonces, réservations, messagerie entre utilisateurs, favoris. Architecture découplée : frontend React (Vite) + deux backends distincts (MongoDB et MariaDB). Projet collaboratif.",
        links: [
          { label: "Demo", href: "https://coolbooking.netlify.app/" },
          { label: "Frontend", href: "https://github.com/PhiB64/coolbooking-react" },
          { label: "Backend", href: "https://github.com/PhiB64/backend-coolbooking" },
        ],
      },
      {
        title: "Alumni Sup Saint-Dominique",
        tags: "Next.js · Express · React Native · Node.js · App Store · Google Play",
        desc: "Plateforme alumni complète pour le réseau des anciens élèves de Sup Saint-Dominique — web et mobile.",
        details: "Annuaire des alumni, offres d'emploi, événements, actualités, mentorat, messagerie interne, authentification. Application mobile React Native disponible sur App Store et Google Play. 500+ membres inscrits, 50+ événements organisés.",
        links: [
          { label: "Live", href: "http://alumni.sup-saintdominique.fr/" },
        ],
      },
      {
        title: "Art & Patrimoine de Doazit",
        tags: "Next.js 15 · React 19 · Tailwind v4 · Strapi v5 · PostgreSQL · TypeScript · Cloudinary",
        desc: "Site vitrine pour une association culturelle des Landes, architecture Jamstack découplée.",
        details: "Édifices historiques, galeries photos, blog, interviews vidéo, carte Leaflet, formulaire de contact, dons. Déployé en production sur Vercel (frontend) et Render (Strapi). GSAP + Framer Motion + Lenis.",
        links: [
          { label: "Live", href: "https://apd-three.vercel.app/" },
          { label: "GitHub", href: "https://github.com/PhiB64/apd" },
        ],
      },
      {
        title: "Landing Page Watch One",
        tags: "HTML · SCSS · Responsive · Collaboratif (×4)",
        desc: "Landing page responsive pour une marque de montres, réalisée en équipe de 4 développeurs.",
        details: "Design fidèle à la maquette, architecture SCSS modulaire, accessibilité, workflow GitHub collaboratif (pull requests, révision de code).",
        links: [
          { label: "GitHub", href: "https://github.com/PhiB64/landing_page_watch_one" },
        ],
      },
      {
        title: "Portail Événements",
        tags: "HTML · CSS · JavaScript vanilla",
        desc: "Portail web de gestion et d'affichage d'événements culturels.",
        details: "Interface responsive, accessibilité WCAG testée et corrigée, interactions dynamiques en JavaScript natif sans dépendance externe.",
        links: [
          { label: "GitHub", href: "https://github.com/PhiB64/portail-evenements-philippe" },
        ],
      },
      {
        title: "El Niu al Mar",
        tags: "Next.js · React Native · Cloudinary · Vercel",
        desc: "Site vitrine et application mobile pour une villa de luxe à Port de la Selva, Catalogne.",
        details: "Présentation de la villa (4 suites, piscine, vue mer), calendrier de disponibilités, système de réservation en ligne, galerie photos, témoignages. Application mobile en parallèle du site web.",
        links: [
          { label: "Live", href: "https://elniualmar.vercel.app/" },
          { label: "GitHub", href: "https://github.com/PhiB64/elniualmar" },
        ],
      },
      {
        title: "Volunteer Platform",
        tags: "Node.js · Express · MariaDB · JWT · Joi",
        desc: "API REST de mise en relation entre bénévoles et associations — projet CCP2.",
        details: "Architecture en couches (controllers / services / repositories / validators), authentification JWT, gestion des rôles, missions, candidatures, validation Joi. Documentation complète via Postman.",
        links: [
          { label: "API Docs", href: "https://documenter.getpostman.com/view/46341307/2sB3Hooz3h" },
          { label: "GitHub", href: "https://github.com/PhiB64/volunteer-platform" },
        ],
      },
      {
        title: "Formalis",
        tags: "Node.js · MySQL · NGINX · Docker Compose · SSL",
        desc: "Plateforme e-learning conteneurisée avec reverse proxy HTTPS et base de données.",
        details: "Stack orchestrée par Docker Compose : API Node.js, MySQL, NGINX (reverse proxy + certificat SSL). Spécifications fonctionnelles et techniques, MCD/MLD, health checks documentés.",
        links: [
          { label: "GitHub", href: "https://github.com/PhiB64/formalis" },
        ],
      },
    ],
    process: [
      "Analyse des besoins et cadrage technique",
      "Conception de l'architecture (front / back / BDD)",
      "Développement itératif par fonctionnalités",
      "Tests, révision de code et corrections",
      "Déploiement et configuration des environnements",
      "Documentation et maintenance",
    ],
  },
];

export function renderProjectContent(i) {
  const p = PROJECT_CONTENT[i];

  // Map skill title keywords to a Lucide icon.
  const skillIcon = (title) => {
    const t = title.toLowerCase();
    if (t.includes("html")) return <Globe size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("css") || t.includes("scss")) return <Layers size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("javascript") || t.includes("ecmascript")) return <Code2 size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("responsive") || t.includes("mobile-first")) return <Smartphone size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("react") && !t.includes("native")) return <Zap size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("react native")) return <Smartphone size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("next")) return <Server size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("vite")) return <Package size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("tailwind")) return <Wand2 size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("gsap") || t.includes("framer") || t.includes("lenis")) return <Play size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("node") || t.includes("express")) return <Terminal size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("strapi")) return <Layers size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("docker") || t.includes("nginx")) return <Box size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("sécurité") || t.includes("jwt")) return <Shield size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("email") || t.includes("nodemailer") || t.includes("resend")) return <Mail size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("postgres") || t.includes("mongo") || t.includes("maria") || t.includes("sql")) return <Database size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("cloudinary")) return <Cloud size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("leaflet") || t.includes("carte")) return <MapPin size={15} className="text-[#00a5b0] shrink-0" />;
    if (t.includes("flutter")) return <Smartphone size={15} className="text-[#00a5b0] shrink-0" />;
    return <Cpu size={15} className="text-[#00a5b0] shrink-0" />;
  };

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
  return items;
}
