export const PROJECT_CONTENT = [
  {
    emoji: "🌐",
    label: "Développement Web",
    title: "Concevoir des expériences web modernes, performantes et accessibles.",
    presentation: [
      "Le développement web est bien plus que l'assemblage de technologies. Chaque projet est pensé pour offrir une navigation fluide, une identité visuelle cohérente et une expérience utilisateur agréable sur tous les supports.",
      "J'accorde une attention particulière à la qualité du code, aux performances de chargement, au référencement naturel et à l'accessibilité afin de créer des sites fiables et durables.",
    ],
    skills: [
      { title: "HTML5", desc: "Structure sémantique, accessibilité et référencement naturel." },
      { title: "CSS3", desc: "Création d'interfaces modernes grâce aux animations, Flexbox, Grid et effets visuels avancés." },
      { title: "JavaScript", desc: "Développement d'interfaces dynamiques et interactives utilisant les dernières fonctionnalités ECMAScript." },
      { title: "Responsive Design", desc: "Des applications parfaitement adaptées aux smartphones, tablettes et ordinateurs." },
    ],
    features: ["Sites vitrines", "Landing Pages", "Portfolios", "Tableaux de bord", "Interfaces administrateur", "Applications Web"],
    philosophy: "Un site internet doit être rapide, intuitif et agréable à utiliser. La technique n'a de valeur que lorsqu'elle améliore réellement l'expérience utilisateur.",
  },
  {
    emoji: "⚛️",
    label: "Frameworks Front-end",
    title: "Créer des interfaces réactives, évolutives et performantes.",
    presentation: [
      "Les frameworks modernes permettent de développer des applications riches tout en conservant un code structuré et facilement maintenable.",
      "J'utilise principalement React pour construire des interfaces modulaires capables d'évoluer facilement au fil des besoins.",
    ],
    skills: [
      { title: "React", desc: "Développement basé sur les composants réutilisables, gestion des états, Hooks, Context API, navigation." },
      { title: "Next.js", desc: "Optimisation du référencement, rendu hybride, performances, chargement optimisé." },
      { title: "Tailwind CSS", desc: "Création rapide d'interfaces élégantes tout en conservant une excellente maintenabilité." },
    ],
    features: [],
    approach: ["indépendant", "réutilisable", "facilement testable", "évolutif"],
  },
  {
    emoji: "⚙️",
    label: "Back-end",
    title: "Donner vie aux applications grâce à une architecture robuste et sécurisée.",
    presentation: [
      "Le serveur constitue le cœur d'une application. Il orchestre les échanges de données, sécurise les accès et assure la communication avec les bases de données.",
      "Je développe des API REST performantes en privilégiant une architecture claire et évolutive.",
    ],
    skills: [
      { title: "Node.js", desc: "Serveur JavaScript haute performance." },
      { title: "Express", desc: "Création d'API REST, routing, middlewares, gestion des erreurs." },
      { title: "Sécurité", desc: "Authentification JWT, hashage des mots de passe, validation des données, protection contre les attaques courantes." },
    ],
    features: ["Authentification", "Gestion des utilisateurs", "Upload de fichiers", "CRUD complet", "API REST", "Documentation"],
  },
  {
    emoji: "☁️",
    label: "Bases de données & Cloud",
    title: "Organiser, sécuriser et rendre les données accessibles partout.",
    presentation: [
      "Une application performante repose sur une gestion fiable des données.",
      "Je conçois des bases optimisées et adaptées aux besoins de chaque projet.",
    ],
    skills: [
      { title: "MariaDB / MySQL / PostgreSQL", desc: "Conception relationnelle, optimisation des requêtes." },
      { title: "MongoDB", desc: "Collections, documents, agrégation." },
    ],
    features: ["Cloudinary", "Render", "Netlify", "Vercel", "GitHub"],
    approach: ["rapides", "fiables", "sécurisées", "facilement déployables"],
  },
  {
    emoji: "📱",
    label: "Développement Mobile",
    title: "Créer des applications mobiles modernes pour Android et iOS.",
    presentation: [
      "Les usages mobiles imposent des interfaces simples, rapides et parfaitement adaptées aux contraintes des smartphones.",
      "Je développe des applications multiplateformes capables d'offrir une expérience utilisateur fluide sur Android comme sur iOS.",
    ],
    skills: [
      { title: "React Native", desc: "Applications natives performantes, navigation, notifications, accès aux fonctionnalités du téléphone." },
      { title: "Flutter", desc: "Interfaces riches, animations, widgets, excellentes performances." },
      { title: "Android", desc: "Création d'APK, compilation, publication, optimisation." },
    ],
    features: ["Connexion utilisateur", "Notifications", "Caméra", "Géolocalisation", "Stockage local", "Synchronisation"],
  },
  {
    emoji: "🚀",
    label: "Projets",
    title: "Chaque projet est une démonstration concrète de mes compétences.",
    presentation: [
      "Au-delà des technologies, ce sont les réalisations qui témoignent d'un savoir-faire.",
      "Chaque projet représente une problématique réelle, une réflexion technique et une solution conçue pour répondre aux besoins des utilisateurs.",
    ],
    projects: [
      { title: "CoolBooking", tags: "React • Node.js • MariaDB", desc: "Plateforme de réservation de locations saisonnières.", details: "Gestion des hébergements, calendrier de réservation, espace propriétaire, administration." },
      { title: "Art & Patrimoine", tags: "React • API REST • Cloudinary", desc: "Application dédiée à la découverte du patrimoine culturel.", details: "" },
      { title: "Application Mobile", tags: "Flutter • React Native", desc: "Développement multiplateforme.", details: "Notifications, synchronisation, authentification." },
    ],
    process: [
      "Analyse des besoins",
      "Conception de l'architecture",
      "Développement des fonctionnalités",
      "Tests et validation",
      "Déploiement",
      "Maintenance et évolutions",
    ],
  },
];

export function renderProjectContent(i) {
  const p = PROJECT_CONTENT[i];
  const items = [];
  items.push(
    <div key="hero">
      <p className="text-[#00a5b0] tracking-[0.2em] uppercase text-sm mb-4">{p.emoji} {p.label}</p>
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
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
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
              <span className="text-[#00a5b0]">✦</span> {f}
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
                <span className="text-[#00a5b0]">✦</span> {a}
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
              {pr.details && <p className="text-[#64748b] text-sm">{pr.details}</p>}
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
