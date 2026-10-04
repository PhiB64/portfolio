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

/**
 * Coordonnées de Philippe — source unique.
 *
 * Elles étaient écrites en dur à cinq endroits : `components/contact-overlay.jsx`
 * (constante locale), `app/layout.js` (JSON-LD), `USAGE_CONTENT` ci-dessous,
 * le repli du Worker (`fallbackStream`) et le README. Changer d'adresse
 * n'en changeait qu'un, et rien ne le signalait — le visiteur pouvait écrire à
 * une adresse périmée pendant que le JSON-LD en annonçait une autre aux
 * moteurs.
 *
 * Le repli du Worker est le cas le plus sensible : il s'affiche quand le site
 * est injoignable, donc quand personne ne peut vérifier l'adresse. Il importe
 * ce bloc au lieu de le recopier — esbuild l'inline au déploiement, et le
 * Worker n'a toujours rien à charger au moment de la requête.
 *
 * Chaque champ est un littéral, jamais une valeur dérivée au moment de l'appel :
 * `phoneDisplay` est formaté pour l'œil, `phoneHref` pour `tel:`, et
 * `phoneInternational` pour le JSON-LD. Les trois sont différents à dessein.
 *
 * La localité est la seule exception : `CONTACT_LOCATION` en tire la ligne
 * affichée, parce que le JSON-LD a besoin de `city`, `region` et
 * `departmentCode` séparément.
 */
export const CONTACT = {
  email: "philippebarbosa64@gmail.com",
  phoneDisplay: "06 51 30 59 16",
  phoneHref: "tel:0651305916",
  phoneInternational: "+33651305916",
  githubUrl: "https://github.com/PhiB64",
  githubLabel: "github.com/PhiB64",
  linkedinUrl: "https://www.linkedin.com/in/philippe-barbosa/",
  linkedinLabel: "linkedin.com/in/philippe-barbosa",
  city: "Lons",
  region: "Pyrénées-Atlantiques",
  departmentCode: "64",
};

/** Localité, telle qu'affichée dans l'écran CONTACT. */
export const CONTACT_LOCATION = `${CONTACT.city} · ${CONTACT.region} (${CONTACT.departmentCode})`;

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
  /**
   * Identité : nom, métier actuel, en une phrase.
   *
   * Pourquoi ces trois lignes existent séparément du reste du parcours. Le digest
   * était écrit entièrement à la première personne, à partir des faces du cube :
   * il décrivait un métier, jamais la personne. « C'est qui Philippe ? » n'y
   * trouvait donc aucune réponse — le nom « Philippe Barbosa » n'apparaissait
   * nulle part dans les 12 000 caractères publiés. Le modèle se rabattait alors
   * sur la seule phrase d'identité du system prompt (« je suis l'assistant de
   * Philippe »), qui devenait sa réponse à une question qui portait sur Philippe.
   *
   * Ces lignes sont placées en tête de digest par le script, pour que la réponse
   * soit lisible sans parcourir les projets. Elles restent dans `CAREER_CONTENT`
   * et pas dans le Worker, pour ne pas créer une seconde source de vérité.
   *
   * Elles reprennent les termes de `PROJECT_CONTENT[].profile.bio`, qui est la
   * même phrase affichée sur la face « Projets » du cube, mais à la troisième
   * personne et sans « je ». Deux formulations du même fait, donc : si le `bio`
   * du site change, ces trois lignes sont à mettre à jour avec lui.
   */
  identite: [
    "Philippe Barbosa est développeur full stack indépendant, basé dans les Pyrénées-Atlantiques.",
    "Il conçoit des applications performantes de bout en bout : interface, API, base de données et déploiement.",
    "Il accorde de l'importance à la simplicité, à l'accessibilité et à un code propre : chaque projet est pensé comme une expérience soignée, utile et durable.",
  ],
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

/**
 * Construction du site : avec quoi ce portfolio est fait.
 *
 * Pourquoi cette section existe. Le digest décrivait Philippe et ses réalisations,
 * et rien sur le site lui-même. À la question « quelle technologie pour créer ce
 * portfolio », le modèle n'avait donc rien à quoi répondre et la complétait avec les
 * technologies des autres projets — React, Next.js, Vite, Strapi, GSAP, Framer
 * Motion, Lenis. C'est le mécanisme exact de la FAQ : `PROJECT_CONTENT` décrit ce
 * que Philippe a fait ailleurs, et ces phrases étaient ce que le modèle avait sous
 * les yeux. Il répondait donc juste, mais au mauvais projet, et se trompait en plus
 * sur les versions — le dépôt est en Next.js 16 alors que le digest annonce
 * Next.js 15 pour d'autres projets.
 *
 * Elle est ici, et pas dans les composants, pour la même raison que
 * `USAGE_CONTENT` : elle n'est rendue nulle part, et son seul destinataire est le
 * digest.
 *
 * Le point qui prête le plus à confusion est écrit explicitement. Le cube est en
 * CSS 3D (`rotateX` / `rotateY` / `translateZ` sous une perspective de 1200px), et
 * il n'y a ni three.js ni WebGL dans les dépendances. Un modèle qui décrit un
 * « cube en 3D » part sur du WebGL tout seul, parce que c'est le réflexe pour de la
 * 3D dans un navigateur. Les faces sont des balises HTML classiques, `<video>` et
 * `<img>`, avec `<img>` en secours quand une vidéo ne peut pas être décodée.
 *
 * Comme pour `USAGE_CONTENT`, ces consignes de rédaction ne sont pas une garantie :
 * elles n'avaient pas d'effet mesuré sur l'ancien repli Workers AI, et elles ne
 * remplacent pas la capacité du modèle à être court.
 */
export const STACK_CONTENT = [
  "Ce portfolio est construit avec Next.js 16 (App Router, export statique), React 19 et Tailwind CSS v4, et déployé sur GitHub Pages. Il est écrit en JavaScript, sans TypeScript.",
  "Le cube est une 3D en CSS, pas de la 3D temps réel : ce sont des transformations CSS 3D (rotateX, rotateY, translateZ sous une perspective de 1200px). Il n'y a ni three.js, ni WebGL, ni canvas dans le projet — dire « three.js » ou « WebGL » serait faux.",
  "Les six faces sont des balises HTML classiques, `<video>` et `<img>`, servies depuis `public/` en `.webm` ou `.webp`. Les animations sont pilotées par GSAP et anime.js.",
  "Le contenu de toutes les rubriques vient d'un seul fichier de données, `lib/portfolio-content.js`, et le digest que tu lis est construit au build à partir de ce même fichier.",
  "Vite, Strapi, Framer Motion, Lenis et Next.js 15 cités plus bas appartiennent aux autres projets de Philippe, pas à ce site.",
];

/**
 * Utiliser ce site : comment on le lit et on s'y déplace.
 *
 * Pourquoi cette section existe. Le digest ne décrivait que Philippe et ses
 * projets, alors que la première question d'un visiteur qui arrive devant le
 * cube est souvent « comment ça marche, ici ? ». Sans ces informations,
 * l'assistant répondait qu'il ne les avait pas sous les yeux — à raison : le
 * digest ne les contenait pas. Aucune source du Worker ne pouvait y répondre,
 * le digest étant la seule source de vérité.
 *
 * Elle est ici, et pas dans les composants, pour la même raison que
 * `CAREER_CONTENT` : elle n'est rendue nulle part sur le site, et son
 * destinataire unique est le digest. La mettre dans un composant la
 * distribuerait au DOM sans raison.
 *
 * Chaque ligne décrit un comportement vérifié dans le code du cube, pas une
 * intention. Les points qui prêtent le plus à confusion sont volontairement
 * explicites, parce qu'ils ressemblent à des bugs :
 *
 * - la première révolution ne montre aucune étiquette (`FACE_LABEL_REVEAL_COUNT`
 *   vaut 2 dans `hero-cube.jsx`, le seuil qui fait apparaître un label est le
 *   deuxième passage de la face) ;
 * - le cube se bloque après le second tour et n'accepte plus d'avancer tant que
 *   les six faces n'ont pas été cliquées (`labelPinPRef`, armé quand toutes les
 *   faces ont été vues deux fois, libéré quand toutes les faces étiquetées ont
 *   été ouvertes) ;
 * - la barre d'onglets est masquée tant que la rubrique n'a pas été ouverte, et
 *   `SKIP` la fait apparaître sans qu'aucun clic sur une face soit nécessaire.
 *
 * Deux mots choisis pour ne pas tromper : le site est une page unique, et les
 * rubriques s'ouvrent dans un overlay qui a sa propre adresse (`?project=N`).
 * Dire « les pages » serait faux — il n'y a pas de route par rubrique — et
 * dire « pop-up » ou « modale » serait trompeur, car la rubrique est
 * partageable et se recharge.
 *
 * Une consigne qui s'adresse au visiteur vit ici, à l'intérieur du digest, et
 * pas dans le system prompt du Worker : elle décrit la réponse à donner, donc
 * elle a sa place à côté des faits qu'elle exploite. Elle est écrite à la
 * seconde personne pour que le modèle la reprende sans la reformuler.
 *
 * Limite mesurée, à connaître avant d'en ajouter une de ce genre : ces consignes
 * de rédaction n'étaient pas suivies par l'ancien repli Workers AI. « Résume en deux ou
 * trois phrases, n'énumère pas les dix lignes suivantes » a produit une réponse
 * en dix points numérotés, avec des astérisques de Markdown. Elles peuvent aider
 * un modèle plus fort, mais elles ne remplacent pas la capacité du modèle à être
 * concis — le nettoyage Markdown se fait côté interface, dans `chat-widget.jsx`,
 * ce qui limite les dégâts sans empêcher la réponse d'être longue.
 *
 * Une seconde hypothèse reste à vérifier en production, sur `openrouter/free` :
 * que la ligne « Si un visiteur dit que le cube est bloqué » suffise à obtenir
 * autre chose qu'un « SKIP » seul, réponse que donnait l'ancien repli Workers AI. À
 * défaut, il faudra la reformuler, ou la porter dans le system prompt.
 */
export const USAGE_CONTENT = [
  "Le site est une page unique, sans menu ni barre de défilement : tout tient dans un cube en 3D que le défilement fait tourner, molette ou doigt. Un clic sur la face face à l'écran l'ouvre ; au clavier, Entrée ou Espace.",
  "Le cube a une règle qui surprend : ses étiquettes sont floues et illisibles pendant toute la première révolution, et ne se lisent qu'au second tour. Ensuite il se bloque et n'avance plus tant que les six faces n'ont pas été ouvertes. Ce n'est ni une panne ni un choix esthétique, c'est son comportement.",
  "Contre ce blocage, il y a le bouton SKIP en bas à droite : il joue le balayage des six faces, débloque la fin et affiche les onglets d'un coup. Une fois l'animation finie, il devient une flèche de retour vers l'intro.",
  "Les onglets du haut sont les six rubriques — WEB, REACT, BACKEND, DATABASE, MOBILE, PROJETS — plus CONTACT. Ils restent masqués tant que la rubrique n'a pas été ouverte : un onglet n'apparaît qu'après le clic sur sa face, ou après SKIP.",
  "Une rubrique s'ouvre en page plein écran par-dessus le cube, avec sa propre adresse, donc partageable et rechargeable. Elle se ferme avec « ← RETOUR » : en haut à gauche sur computer, en bas de page sur téléphone. L'icône en haut à gauche de l'écran, elle, ramène à l'intro.",
  `CONTACT ouvre les coordonnées et un formulaire, le message partant du navigateur, sans pièce jointe. Pour écrire directement : ${CONTACT.email}`,
  "CONTACT est le seul onglet sans adresse propre : c'est une surcouche, pas une rubrique routée, et il n'a donc aucun `?project=`. Les six numéros vont à WEB, REACT, BACKEND, DATABASE, MOBILE et PROJETS, dans cet ordre. Ne jamais attribuer un `?project=N` à CONTACT, et ne jamais inventer une adresse de formulaire : pour le formulaire, dire simplement « l'onglet CONTACT du site ».",
  "Adresses directes, à citer en clair dès que la question porte sur la rubrique, une réalisation, le CV ou le contact : WEB https://phib64.github.io/portfolio/?project=1 · REACT ?project=2 · BACKEND ?project=3 · DATABASE ?project=4 · MOBILE ?project=5 · PROJETS ?project=6 · CV https://phib64.github.io/portfolio/cv.pdf",
  "Sur téléphone, le site est en portrait : en paysage il affiche « Tournez votre appareil ».",
];
