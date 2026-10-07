/**
 * Contenu éditorial **anglais** — structure identique à `fr.js`.
 *
 * Fichier traduit, donc deux règles s'imposent.
 *
 * 1. Aucune clé ne change. Même nesting, même nombre d'éléments, mêmes noms de
 *    champs. C'est ce qui permet à `getContent(lang)` de substituer l'une par
 *    l'autre sans que le rendu s'en aperçoive, et aux tests de comparer les
 *    deux. Une clé renommée ici casse la page anglaise sans casser le français,
 *    ce qui en fait le défaut le plus coûteux à rattraper : on le voit une fois
 *    en ligne, pas dans CI.
 *
 * 2. Aucune valeur inventée. Les chiffres, les noms de technologies, les URLs et
 *    les dates sont ceux de `fr.js`. Un contenu anglais qui promet plus que le
 *    contenu français serait une variante de marketing, pas une traduction.
 *
 * Les commentaires d'intention vivent dans `fr.js`, qui reste la source
 * canonique : ils expliquent pourquoi ces blocs existent, ce qui est indépendant
 * de la langue. Ici ne figurent que les écarts propres à l'anglais.
 *
 * ---------------------------------------------------------------------------
 * Les trois écarts qui ne sont pas du vocabulaire
 * ---------------------------------------------------------------------------
 *
 * - **Les URLs de `USAGE_CONTENT` ne portent aucun préfixe.** L'anglais étant la
 *   langue par défaut, la rubrique REACT est à `?project=2`, et c'est la version
 *   française qui porte `/fr?project=2`. C'est la seule valeur qui dépend de la
 *   langue, et elle est écrite en dur ici par commodité — c'est une dette : le
 *   préfixe devrait être dérivé de la locale quand le build sera paramétré, sinon
 *   un jour un `?project=` forgottera son `/fr`, et l'assistant enverra le
 *   visiteur sur la page anglaise en lui disant qu'il est sur la bonne.
 *   `lib/content/parity.test.js` garde les deux versions de cette ligne
 *   synchronisées.
 *
 * - **Les libellés de faces sont traduits.** `USAGE_CONTENT` énumère les onglets
 *   (WEB, REACT, …, PROJETS) parce que l'assistant doit pouvoir nommer la
 *   rubrique que le visiteur voit. Sur la page anglaise, le visiteur voit
 *   PROJECTS, donc c'est PROJECTS qu'il faut écrire. Les `?project=N` ne bougent
 *   pas : ils sont indexés, pas nommés.
 *
 * - **`langues` décrit un niveau réel, pas un niveau flatteur.** L'anglais est
 *   annoncé « intermediate, spoken and written », et le français reste « French
 *   is his native language » — les deux faits tiennent sur la même ligne, ce qui
 *   est cohérent avec un portfolio bilingual qui se veut crédible.
 *
 *   Le niveau a été relevé de « débutant » à « intermédiaire » à la demande de
 *   Philippe, alors que le CV — qui n'est pas à jour, comme le signale le
 *   commentaire de `CAREER_CONTENT` dans `fr.js` — indique encore le niveau
 *   d'origine. C'est le CV qui est en retard, pas ce fichier.
 *
 *   La règle à tenir si le niveau bouge encore : `fr.js` d'abord, `en.js`
 *   ensuite, dans la même passe. Les deux phrases sont traduites l'une de
 *   l'autre, donc les laisser diverger reviendrait à afficher deux niveaux
 *   différents au même visiteur selon la page qu'il ouvre.
 */

import { CONTACT, CONTACT_LOCATION } from "./contact.js";

export const PROJECT_CONTENT = [
  {
    label: "Web Development",
    title: "Designing modern, high-performance and accessible web experiences.",
    presentation: [
      "Web development is far more than assembling technologies together. Every project is designed to offer smooth navigation, a coherent visual identity and a user experience that feels good on every screen.",
      "I pay particular attention to HTML semantics, loading performance, SEO and WCAG accessibility, in order to build sites that are reliable, long-lasting and inclusive.",
    ],
    skills: [
      { title: "HTML5", desc: "Semantic structure, WCAG accessibility, markup optimised for organic search." },
      { title: "CSS3 / SCSS", desc: "Animations, Flexbox, Grid, CSS variables, modular SCSS architecture (used in CoolBooking and the Watch One landing page)." },
      { title: "JavaScript ES2024", desc: "Dynamic interfaces, DOM manipulation, event handling, Fetch API, native modules." },
      { title: "Responsive Design", desc: "Mobile-first, media queries, multi-device testing — applied to every project delivered." },
    ],
    features: ["Showcase sites", "Landing pages", "Event portals", "CMS interfaces", "Dashboards", "Web applications", "WCAG accessibility", "GSAP animations"],
    philosophy: "A website should be fast, intuitive and pleasant to use. Technology is only worth it when it genuinely improves the user's experience.",
  },
  {
    label: "Front-end Frameworks",
    title: "Building reactive, scalable and high-performance interfaces.",
    presentation: [
      "Modern frameworks make it possible to build rich applications while keeping the codebase structured and easy to maintain.",
      "I use React 19 and Next.js 15 in real production projects, alongside advanced animation tooling (GSAP, Framer Motion) and smooth scrolling (Lenis).",
    ],
    skills: [
      { title: "React 19", desc: "Reusable components, Hooks, Context API, state management, Server Components." },
      { title: "Next.js 15", desc: "App Router, hybrid SSR/SSG, optimised SEO, image loading, Vercel deployment — used in production on the APD project." },
      { title: "Vite", desc: "Ultra-fast React development build, used for the CoolBooking frontend." },
      { title: "Tailwind CSS v4", desc: "Utility-first CSS, design tokens, fast responsive work — used with Next.js 15 on APD." },
      { title: "GSAP 3 · Framer Motion", desc: "Scroll-driven animations, page transitions, reveal effects — integrated into the APD project." },
      { title: "Lenis · Leaflet", desc: "Smooth scrolling and interactive geolocated maps — deployed in production." },
    ],
    approach: ["independent", "reusable", "easy to test", "scalable"],
  },
  {
    label: "Back-end",
    title: "Bringing applications to life with a robust, secure architecture.",
    presentation: [
      "The server is the heart of an application. It orchestrates data exchanges, secures access and handles communication with databases.",
      "I design REST APIs with Node.js/Express and headless CMSs with Strapi v5, in TypeScript, for decoupled architectures that are production-ready.",
    ],
    skills: [
      { title: "Node.js + Express", desc: "REST API, modular routing, middlewares, error handling — layered architecture (controllers / services / repositories) applied in Volunteer Platform and CoolBooking." },
      { title: "Strapi v5 + TypeScript", desc: "Open-source headless CMS, custom content types, auto-generated API, upload/email plugins — used in production for APD." },
      { title: "Docker · NGINX · SSL", desc: "Containerisation with Docker Compose, NGINX reverse proxy with an SSL certificate — deployed in Formalis (e-learning)." },
      { title: "Security", desc: "JWT, bcrypt, Joi validation, rate-limiting, CORS, OWASP protection — implemented in CoolBooking, APD and Volunteer Platform." },
      { title: "Nodemailer / Resend", desc: "Transactional email, contact forms, automatic notifications — integrated into Strapi (APD)." },
    ],
    features: ["JWT authentication", "Role management", "File upload", "Full CRUD", "REST API", "Transactional email", "Data validation", "SQL migrations"],
  },
  {
    label: "Databases & Cloud",
    title: "Structuring, securing and making data available everywhere.",
    presentation: [
      "A high-performance application rests on reliable data management. I have worked with three different database engines, chosen to suit each project's needs.",
      "I also handle deployment and media through cloud services, with straightforward CI/CD pipelines and separated environments.",
    ],
    skills: [
      { title: "PostgreSQL", desc: "The APD project's primary relational database — schemas, migrations, optimised queries, hosted on Render." },
      { title: "MongoDB", desc: "CoolBooking's NoSQL database — collections, documents, aggregation, Mongoose models." },
      { title: "MariaDB / MySQL", desc: "CoolBooking's relational variant — table design, joins, parameterised queries." },
      { title: "Cloudinary", desc: "Media CDN — image and video upload, automatic transformations, secure storage for APD." },
    ],
    features: ["Vercel", "Netlify", "Render", "Cloudinary", "GitHub Actions", "Environment variables", "Production build", "Continuous deployment"],
    approach: ["fast", "reliable", "secure", "easy to deploy"],
  },
  {
    label: "Mobile Development",
    title: "Building modern mobile applications for Android and iOS.",
    presentation: [
      "Mobile use cases demand interfaces that are simple, fast and precisely adapted to the constraints of smartphones.",
      "My command of responsive design and cross-platform frameworks lets me build coherent experiences across every screen size.",
    ],
    skills: [
      { title: "React Native", desc: "Native Android and iOS applications — Stack/Tab navigation, system API access, push notifications." },
      { title: "Flutter", desc: "Rich interfaces, custom widgets, fluid animations, native performance." },
      { title: "Store publication", desc: "Builds and releases — the Alumni app is live on the App Store and Google Play." },
      { title: "API synchronisation", desc: "Consuming REST APIs, state management, caching and offline mode — applied in Alumni and El Niu al Mar." },
      { title: "Responsive & mobile-first", desc: "Mobile-first approach applied to every web project, tested and validated on phones and tablets." },
    ],
    features: ["User login", "Push notifications", "Camera", "Geolocation", "Local storage", "API synchronisation"],
  },
  {
    label: "Projects",
    title: "Concrete work, running in production.",
    profile: {
      bio: [
        "An independent full stack developer based in the Pyrénées-Atlantiques, I build high-performance applications end to end: interface, API, database and deployment.",
        "My approach rests on simplicity, accessibility and clean code. Every project is designed as a polished experience — useful and built to last.",
      ],
      stats: [
        { value: "8", label: "projects shipped" },
        { value: "6", label: "areas of expertise" },
        { value: "3", label: "databases" },
        { value: "1", label: "live mobile app" },
      ],
      cvUrl: "/cv.pdf",
    },
    presentation: [
      "Each project below solves a real problem end to end: design, development, deployment.",
      "Several were collaborative (pull requests, code review, working branches), and some are available online.",
    ],
    projects: [
      {
        title: "Alumni Sup Saint-Dominique",
        tags: "Next.js · Express · React Native · Node.js · App Store · Google Play",
        desc: "A complete alumni platform for the Sup Saint-Dominique network of former students — web and mobile.",
        details: "Alumni directory, job offers, events, news, mentoring, internal messaging, authentication. The React Native mobile app is available on the App Store and Google Play. 500+ registered members, 50+ events organised.",
        links: [
          { label: "Live", href: "http://alumni.sup-saintdominique.fr/" },
        ],
      },
      {
        title: "El Niu al Mar",
        tags: "Next.js · React Native · Cloudinary · Vercel",
        desc: "Showcase site and mobile app for a luxury villa at Port de la Selva, Catalonia.",
        details: "Villa presentation (4 suites, pool, sea view), availability calendar, online booking system, photo gallery, testimonials. Mobile app built alongside the website.",
        links: [
          { label: "Live", href: "https://elniualmar.vercel.app/" },
          { label: "GitHub", href: "https://github.com/PhiB64/elniualmar" },
        ],
      },
      {
        title: "Art & Patrimoine de Doazit",
        tags: "Next.js 15 · React 19 · Tailwind v4 · Strapi v5 · PostgreSQL · TypeScript · Cloudinary",
        desc: "Showcase site for a cultural association in the Landes, with a decoupled Jamstack architecture.",
        details: "Historic buildings, photo galleries, blog, video interviews, Leaflet map, contact form, donations. Deployed in production on Vercel (frontend) and Render (Strapi). GSAP + Framer Motion + Lenis.",
        links: [
          { label: "Live", href: "https://apd-three.vercel.app/" },
          { label: "GitHub", href: "https://github.com/PhiB64/apd" },
        ],
      },
      {
        title: "CoolBooking",
        tags: "React 19 · Vite · Node.js · Express · MongoDB · MariaDB · SCSS",
        desc: "Full-stack platform for booking seasonal holiday rentals.",
        details: "JWT registration/login, listings, bookings, user-to-user messaging, favourites. Decoupled architecture: React frontend (Vite) plus two separate backends (MongoDB and MariaDB). Collaborative project.",
        links: [
          { label: "Demo", href: "https://coolbooking.netlify.app/" },
          { label: "Frontend", href: "https://github.com/PhiB64/coolbooking-react" },
          { label: "Backend", href: "https://github.com/PhiB64/backend-coolbooking" },
        ],
      },
      {
        title: "Watch One Landing Page",
        tags: "HTML · SCSS · Responsive · Collaborative (×4)",
        desc: "Responsive landing page for a watch brand, built by a team of 4 developers.",
        details: "Faithful to the mockup, modular SCSS architecture, accessibility, collaborative GitHub workflow (pull requests, code review).",
        links: [
          { label: "GitHub", href: "https://github.com/PhiB64/landing_page_watch_one" },
        ],
      },
      {
        title: "Events Portal",
        tags: "HTML · CSS · Vanilla JavaScript",
        desc: "Web portal for managing and displaying cultural events.",
        details: "Responsive interface, WCAG accessibility tested and corrected, dynamic interactions in vanilla JavaScript with no external dependency.",
        links: [
          { label: "GitHub", href: "https://github.com/PhiB64/portail-evenements-philippe" },
        ],
      },
      {
        title: "Volunteer Platform",
        tags: "Node.js · Express · MariaDB · JWT · Joi",
        desc: "REST API matching volunteers with non-profit organisations — CCP2 course project.",
        details: "Layered architecture (controllers / services / repositories / validators), JWT authentication, role management, assignments, applications, Joi validation. Fully documented in Postman.",
        links: [
          { label: "API Docs", href: "https://documenter.getpostman.com/view/46341307/2sB3Hooz3h" },
          { label: "GitHub", href: "https://github.com/PhiB64/volunteer-platform" },
        ],
      },
      {
        title: "Formalis",
        tags: "Node.js · MySQL · NGINX · Docker Compose · SSL",
        desc: "Containerised e-learning platform with an HTTPS reverse proxy and a database.",
        details: "Stack orchestrated with Docker Compose: Node.js API, MySQL, NGINX (reverse proxy + SSL certificate). Functional and technical specifications, ERD/schema design, documented health checks.",
        links: [
          { label: "GitHub", href: "https://github.com/PhiB64/formalis" },
        ],
      },
    ],
    process: [
      "Needs analysis and technical scoping",
      "Architecture design (front / back / database)",
      "Iterative development by feature",
      "Testing, code review and fixes",
      "Deployment and environment configuration",
      "Documentation and maintenance",
    ],
  },
];

/**
 * Traduction de `CAREER_CONTENT`.
 *
 * Deux difficultés propres à l'anglais, résolues ici plutôt que laissées au
 * lecteur.
 *
 * `identite` : le français dit « je » à la première personne, parce qu'il est
 * cité tel quel dans le digest. L'anglais bascule naturellement à la troisième
 * personne, ce qui est plus correct pour un texte qui décrit quelqu'un. Les
 * trois lignes restent courtes et directes, parce que tout le raisonnement
 * du digest repose sur le fait qu'elles sont en tête.
 *
 * `avant` : le français reconstitue une chronologie par les intitulés
 * (« 1990 à 1993 : DEUG Droit »). L'anglais garde la même structure, avec
 * « 1990 to 1993 », pour que le modèle n'ait pas à réordonner mentalement.
 *
 * Les intitulés de diplômes restent en français : DEUG, BTS et BTS Maintenance
 * des Systèmes sont des diplômes français nommés, sans équivalent anglais
 * exact. Les traduire par un approximatif (« Higher National Diploma »)
 * inventerait un diplôme qui n'existe pas sous ce nom.
 */
export const CAREER_CONTENT = {
  identite: [
    "Philippe Barbosa is an independent full stack developer, based in the Pyrénées-Atlantiques.",
    "He builds high-performance applications end to end: interface, API, database and deployment.",
    "He places importance on simplicity, accessibility and clean code: every project is designed as a polished experience — useful and built to last.",
  ],
  /**
   * Traduction de `contact` — mêmes faits, pris aux mêmes sources, au même
   * rang : le test de parité compare l'ordre des clés, pas seulement leur
   * présence.
   *
   * Le téléphone et l'e-mail ne se traduisent pas ; la localité reprend
   * `CONTACT_LOCATION`, invariant de langue. Seule la disponibilité est
   * rédigée en anglais.
   */
  contact: [
    `Based in ${CONTACT_LOCATION}.`,
    `Phone: ${CONTACT.phoneDisplay}.`,
    `E-mail: ${CONTACT.email}.`,
    "Open to contract and collaboration opportunities.",
  ],
  reconversion:
    "Full stack developer, retraining professionally. Before development, I spent several decades in management and team leadership, which gives me a rigour and maturity I would not have gained by going straight into a training course.",
  formation: [
    "Web and Mobile Web Developer, AFEC Pau, since March 2025.",
    "Professional qualification as Web and Mobile Web Developer, obtained in December 2025.",
    "Application Developer Design training, started in January, following the professional qualification.",
  ],
  avant: [
    "2008: sales training, SPIR Communication.",
    "1990 to 1993: DEUG Droit (law degree), Toulouse 1 Social Sciences University.",
    "1989 to 1990: BTS Maintenance des Systèmes, Lycée Technique Terre Rouge, Cahors.",
  ],
  management: [
    "Management of multidisciplinary teams, up to 35 staff.",
    "Operational coordination: scheduling, quality control, support.",
    "Human resources management: recruitment, training, performance follow-up.",
    "Commercial leadership: targets, performance, client relationships.",
    "Organisation of events and commercial operations.",
    "Administrative management and regulatory compliance: hygiene, safety, cash flows.",
  ],
  method: [
    "Modular architecture and unit tests.",
    "Technical documentation and user documentation.",
    "Needs analysis and specification writing.",
    "Deployment: Netlify, Vercel, Render, multi-environment management.",
  ],
  langues: "Spanish: intermediate, spoken and written. English: intermediate, spoken and written. Portuguese: beginner. French is his native language.",
  soft: "Adaptability, decision-making, crisis management, pragmatism, facilitation skills.",
  permis: "Holds B and D driving licences.",
};

/**
 * Traduction de `STACK_CONTENT`.
 *
 * Les noms de fichiers et de bibliothèques restent en l'identique : un assistant
 * qui reçoit « la bibliothèque `anime.js` » doit pouvoir la reconnaître dans la
 * page. Les chemins de code aussi, sinon il ne saura pas quoi ouvrir. Seule la
 * prose change.
 */
export const STACK_CONTENT = [
  "This portfolio is built with Next.js 16 (App Router, static export), React 19 and Tailwind CSS v4, and deployed on GitHub Pages. It is written in JavaScript, not TypeScript.",
  "The cube is CSS 3D, not real-time 3D: it uses CSS 3D transforms (rotateX, rotateY, translateZ under a 1200px perspective). There is no three.js, no WebGL and no canvas in the project — saying \"three.js\" or \"WebGL\" would be wrong.",
  "The six faces are plain HTML elements, `<video>` and `<img>`, served from `public/` as `.webm` or `.webp`. The animations are driven by GSAP and anime.js.",
  "The content of every section comes from a single data file, `lib/content/fr.js` for the French version and `lib/content/en.js` for the English one; the digest you are reading is built at build time from those same files.",
  "Vite, Strapi, Framer Motion, Lenis and Next.js 15 mentioned further down belong to Philippe's other projects, not to this site.",
];

/**
 * Traduction de `USAGE_CONTENT`.
 *
 * Ce bloc est le plus sensible à la traduction : il ne décrit pas des faits, il
 * décrit **ce que voit et ce que peut faire le visiteur**. Une formulation
 * française traduite de travers produirait un assistant qui dit à un visiteur
 * anglais de chercher un bouton qui n'est pas là.
 *
 * Deux règles tenues dans tout le bloc :
 *
 * - le vocabulaire d'interface est celui du code (SKIP, CONTACT, « ← BACK »),
 *   jamais son équivalent français. Un visiteur anglais voit « SKIP » sur le
 *   bouton ; dire « IGNORER » dans le digest enverrait le visiteur à la recherche
 *   d'un mot absent du site. Même règle pour « ← BACK », qui est la traduction
 *   de « ← RETOUR » sans changer la touche que l'utilisateur doit viser ;
 * - `?project=N` n'est jamais traduit ni réordonné : ces numéros sont indexés.
 *
 * La seule ligne qui dépend de la langue est celle des adresses directes : elle
 * ne porte aucun préfixe, parce que l'anglais est la langue par défaut et sert
 * donc la racine. C'est la version française qui est préfixée par `/fr`. Voir
 * l'écart décrit en tête de fichier.
 */
export const USAGE_CONTENT = [
  "The site is a single page, with no menu and no scrollbar: everything fits inside a 3D cube that scrolling turns, with a wheel or a finger. Clicking the face facing the screen opens it; on a keyboard, use Enter or Space.",
  "The cube has one rule that surprises people: its labels stay blurred and illegible for the entire first revolution, and only become readable on the second pass. After that it locks and no longer moves until all six faces have been opened. This is neither a bug nor an aesthetic choice — it is how it behaves.",
  "To get past that lock, there is the SKIP button at the bottom right: it sweeps across the six faces, unlocks the end and reveals the tabs all at once. Once the animation has finished, it turns into a back arrow to the intro.",
  "The tabs at the top are the six sections — WEB, REACT, BACKEND, DATABASE, MOBILE, PROJECTS — plus CONTACT. They stay hidden until the section has been opened: a tab appears only after the click on its face, or after SKIP.",
  "A section opens as a full-screen page over the cube, with its own URL, so it can be shared and reloaded. It closes with \"← BACK\": top left on desktop, bottom of the page on mobile. The icon at the top left of the screen, on the other hand, returns to the intro.",
  `CONTACT opens the contact details and a form; the message is sent from the browser, with no attachment. To write directly: ${CONTACT.email}`,
  "CONTACT is the only tab without its own URL: it is an overlay, not a routed section, so it has no `?project=`. The six numbers map to WEB, REACT, BACKEND, DATABASE, MOBILE and PROJECTS, in that order. Never assign a `?project=N` to CONTACT, and never invent a form URL: for the form, simply say \"the CONTACT tab of the site\".",
  "Direct addresses, to quote plainly as soon as the question concerns a section, a project, the CV or contact: WEB https://phib64.github.io/portfolio/?project=1 · REACT ?project=2 · BACKEND ?project=3 · DATABASE ?project=4 · MOBILE ?project=5 · PROJECTS ?project=6 · CV https://phib64.github.io/portfolio/cv.pdf",
  "On mobile, the site is designed for portrait: in landscape it shows \"Rotate your device\".",
];