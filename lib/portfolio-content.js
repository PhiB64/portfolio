/**
 * Contenu éditorial du portfolio, sous forme de données pures — aucun JSX.
 *
 * Why ce fichier existe : `components/cube/project-content.jsx` mélangeait la
 * donnée et le rendu. La donnée sert aussi au Worker du chat, qui doit
 * connaître les projets, les compétences et les liens du site sans les recopier
 * dans son system prompt. Extraite ici, elle devient importable par Node, ce qui
 * permet à `scripts/build-chat-content.mjs` d'en tirer le digest publié.
 *
 * Conséquence : toute modification du contenu visible sur le site se répercute
 * automatiquement chez l'assistant, sans redéployer le Worker.
 */

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
      { title: "React Native", desc: "Applications natives Android et iOS — navigation Stack/Tab, accès aux APIs système, notifications push." },
      { title: "Flutter", desc: "Interfaces riches, widgets personnalisés, animations fluides, performances natives." },
      { title: "Publication sur les stores", desc: "Builds et mise en ligne — application Alumni disponible sur l'App Store et Google Play." },
      { title: "Synchronisation d'API", desc: "Consommation d'API REST, gestion d'état, cache et mode hors-ligne — appliquée dans Alumni et El Niu al Mar." },
      { title: "Responsive & Mobile-First", desc: "Approche mobile-first appliquée sur tous les projets web, testée et validée sur mobiles et tablettes." },
    ],
    features: ["Connexion utilisateur", "Notifications push", "Caméra", "Géolocalisation", "Stockage local", "Synchronisation API"],
  },
  {
    label: "Projets",
    title: "Des réalisations concrètes, du code en production.",
    profile: {
      bio: [
        "Développeur full stack indépendant basé dans les Pyrénées-Atlantiques, je conçois des applications performantes de bout en bout : interface, API, base de données et déploiement.",
        "Mon approche repose sur la simplicité, l'accessibilité et un code propre. Chaque projet est pensé comme une expérience soignée, utile et durable.",
      ],
      stats: [
        { value: "8", label: "projets livrés" },
        { value: "6", label: "domaines d'expertise" },
        { value: "3", label: "bases de données" },
        { value: "1", label: "app mobile en ligne" },
      ],
      cvUrl: "/cv.pdf",
    },
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

/**
 * Parcours et savoir-faire hors développement — source : CV.
 *
 * Pourquoi une constante à part et non une nouvelle section du tableau : ces
 * informations n'ont pas leur place sur une face du cube, qui est organisée par
 * domaine technique. Elles sont en revanche exactement ce qu'un visiteur demande
 * en premier (« d'où viens-tu ? », « comment es-tu arrivé au développement ? »),
 * et le site ne les disait nulle part.
 *
 * Elles sont donc destinées au digest du chat (`scripts/build-chat-content.mjs`),
 * qui les publie. Rien de tout cela n'est affiché sur le site : c'est une seule
 * source de vérité pour le bot, sans toucher à l'interface existante.
 *
 * Les dates sont celles du CV, qui n'est pas à jour. Elles sont donc formulées
 * en années, pas en mois, et les formulations à durée (« depuis », « pendant »)
 * sont préférées aux dates limites — une information périmée est moins fausse
 * qu'une date fausse.
 */
export const CAREER_CONTENT = {
  reconversion:
    "Développeur full stack en reconversion professionnelle. Avant le développement, j'ai tenu une carrière dans le management et la gestion d'équipe pendant plusieurs dizaines d'années, ce qui m'apporte une rigueur et une maturité que je n'aurais pas acquises en partant directement de la formation.",
  formation: [
    "Développeur Web et Web Mobile, AFEC Pau, depuis mars 2025.",
    "Titre professionnel Développeur Web et Web Mobile obtenu en décembre 2025.",
    "Formation Concepteur Développeur d'Applications suivie depuis janvier, après le titre professionnel.",
  ],
  avant: [
    "2008 : formation Force de vente, SPIR Communication.",
    "1990 à 1993 : DEUG Droit, Université des Sciences Sociales Toulouse 1.",
    "1989 à 1990 : BTS Maintenance des Systèmes, Lycée Technique Terre Rouge, Cahors.",
  ],
  management: [
    "Encadrement d'équipes pluridisciplinaires, jusqu'à 35 collaborateurs.",
    "Coordination opérationnelle : plannings, contrôle qualité, accompagnement.",
    "Gestion des ressources humaines : recrutement, formation, suivi disciplinaire.",
    "Pilotage commercial : objectifs, performance, relation client.",
    "Organisation d'événements et d'opérations commerciales.",
    "Gestion administrative et respect des normes : hygiène, sécurité, flux monétaires.",
  ],
  method: [
    "Architecture modulaire et tests unitaires.",
    "Documentation technique et documentation utilisateur.",
    "Analyse des besoins et rédaction de cahiers des charges.",
    "Déploiement : Netlify, Vercel, Render, gestion multi-environnements.",
  ],
  langues: "Espagnol : niveau intermédiaire, à l'oral comme à l'écrit. Anglais : débutant. Portugais : débutant. Le français est sa langue maternelle.",
  soft: "Adaptabilité, prise de décision, gestion de crise, pragmatisme, sens du facilitation.",
  permis: "Titulaire des permis B et D.",
};
