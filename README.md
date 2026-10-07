# Portfolio — Philippe Barbosa

Portfolio interactif de **Philippe Barbosa**, Concepteur Développeur Full Stack.

![Portfolio Preview](public/projets.webp)

## Aperçu

Site one-page immersif avec un **cube 3D interactif** qui présente les compétences et projets. Chaque face du cube représente un domaine d'expertise (Web, React, Backend, Database, Mobile, Projets). L'animation est pilotée par le scroll avec des effets visuels avancés (sonar, scramble, morphing).

## Langues

Deux langues, choisies par le chemin de l'URL — jamais par un paramètre, pour
que chaque variante soit indexable et partageable telle quelle.

| URL | Langue |
|---|---|
| `/` | Anglais — la langue par défaut |
| `/projects` | Anglais, page texte |
| `/fr` | Français |
| `/fr/projects` | Français, page texte |

Trois points à connaître avant d'y toucher.

- **`DEFAULT_LOCALE` est l'unique interrupteur.** Il est défini dans
  `lib/content/locales.js` et l'on n'écrit `"en"` ou `"fr"` nulle part ailleurs :
  `localePrefix` en déduit le préfixe d'URL, le `x-default` des métadonnées, la
  priorité du sitemap et le digest de repli du chat. Changer de langue par
  défaut se fait donc à un seul endroit.
- **Chaque langue a son layout racine.** `<html lang>` est un attribut du
  document : il ne peut pas être posé plus bas. D'où `app/(en)/layout.js` et
  `app/(fr)/layout.js`, tous deux rendus par `components/site-shell.jsx`. Le
  nom du groupe n'apparaît jamais dans l'URL — c'est lui qui permet à `/` d'être
  anglais et `/fr` français sans que l'arborescence n'impose l'un ou l'autre.
- **`WORKER_DEFAULT_LANG` doit suivre `DEFAULT_LOCALE`.** Le Worker est déployé
  indépendamment, mais il ne lit la clé `digest` de repli que pour sa langue par
  défaut. Les deux constantes diverger désactiverait ce chemin sans lever la
  moindre erreur.

Les anciennes URL anglaises `/en` et `/en/projects` sont conservées par des
pages statiques, `public/en.html` et `public/en/projects.html`, que le build
copie telles quelles dans `dist/` : elles sont déjà partagées, indexées et
citées dans le CV. `output: "export"` n'applique pas les `redirects` de
`next.config.mjs` — Next.js le signale à chaque build — donc une page HTML avec
un `<meta http-equiv="refresh">` est le seul mécanisme disponible sur un
hébergeur sans serveur. GitHub Pages ne sert pas de HTTP 301, donc le lien
fonctionne mais le signal SEO est plus faible qu'un vrai redirigé.

## Stack Technique

- **Next.js 16** — App Router, export statique (`output: "export"` vers `dist/`)
- **React 19** — Composants client, hooks avancés
- **Tailwind CSS v4** — Styling utilitaire
- **animejs** — Timeline principale du cube (scroll-driven)
- **GSAP** — Brouillage de texte (`lib/scramble.js` uniquement)
- **Lucide React** — Icônes

## Fonctionnalités

- Cube 3D interactif avec 6 faces thématiques (CSS 3D, pas de WebGL)
- Animation scroll-driven avec timeline animejs
- Effets visuels : sonar, scramble de texte, morphing
- Assistant de chat (optionnel) : `NEXT_PUBLIC_CHAT_ENDPOINT` vers un Worker
  Cloudflare qui relaie OpenRouter — sans cette variable, le bouton de chat
  n'est pas rendu (voir `worker/README.md`)
- Formulaire de contact via Formspree (`NEXT_PUBLIC_FORMSPREE_ENDPOINT`),
  repli `mailto` en cas d'échec — voir `components/contact-overlay.jsx`.
  L'envoi est filtré côté client avant tout appel réseau : pot de miel,
  délai minimal de remplissage, bornes de longueur, délai d'expiration.
  Les règles sont dans `lib/contact-form.js`, sans React, donc testées.
- Responsive design (mobile, tablette, desktop)
- Gestion des événements tactiles et pointer
- SEO optimisé (metadata, Open Graph, JSON-LD)
- Version textuelle indexable des rubriques (`/projects`), sans contenu dupliqué
- Déploiement automatique sur GitHub Pages

## Démarrage

### Prérequis

- Node.js **20.9+** — minimum imposé par `next` 16 lui-même, reporté dans le champ
  `engines` de `package.json`. En dessous, `npm install` n'émet qu'un avertissement
  (`EBADENGINE`) : l'échec arrive au lancement de `next dev` ou `next build`.

### Installation

```bash
npm install
```

### Développement

```bash
npm run dev
```

Le site est accessible sur [http://localhost:3000](http://localhost:3000).

### Build de production

```bash
npm run build
```

Le build est exporté dans `dist/` (`next.config.mjs` : `output: "export"`,
`distDir: "dist"` en production). Le script `postbuild` y publie ensuite
`dist/content.json` — le digest que lit l'assistant (voir « Assistant de chat »
ci-dessous).

### Lint

```bash
npm run lint
```

### Tests

```bash
npm test           # une passe
npm run test:watch # en continu
```

Les tests couvrent `lib/` et le Worker — 509 tests, 30 fichiers :

| Module | Fichier de test | Ce qui est vérifié |
|---|---|---|
| `lib/cube-math.js` | `lib/cube-math.test.js` (58 tests) | la géométrie du cube (rotations, paliers de scroll, projection, hit-test) |
| `lib/cube-finale.js` | `lib/cube-finale.test.js` (20 tests) | le contrat de temps de la fin : budgets d'animation, ordre des paliers, skip |
| `lib/cube-timeline.js` | `lib/cube-timeline.test.js` (13 tests) | la construction de la chronologie des apparitions |
| `lib/cube-tour.js` | `lib/cube-tour.test.js` (15 tests) | la tournée tirée au sort des faces |
| `lib/cube-sonar.js` | `lib/cube-sonar.test.js` (10 tests) | la détection du survol et de la distance |
| `lib/cube-viewport.js` | `lib/cube-viewport.test.js` (15 tests) | le contrat de fenêtre : métriques, orientation, verrouillage paysage |
| `lib/face-labels.js` | `lib/face-labels.test.js` (21 tests) | l'élection de la face dont le label se décode : seuil d'exposition, hystérésis, et le fait que **les six** labels passent par une phase codée |
| `lib/leak-filter.js` | `lib/leak-filter.test.js` (30 tests) | le filtrage des fuites de modération sur un flux fragmenté |
| `lib/device.js` | `lib/device.test.js` (11 tests) | la détection de capacité et de préférence |
| `lib/reduced-motion.js` | `lib/reduced-motion.test.js` (6 tests) | la lecture de la préférence, y compris quand elle est absente |
| `lib/scramble.js` | `lib/scramble-reduced-motion.test.js` (4 tests, jsdom) + `lib/scramble-padding.test.js` (12 tests, jsdom) | branche `cipher` + `prefers-reduced-motion` : image fixe sans boucle, `stopScramble(null)` no-op, décodage borné intact ; départ brouillé commun (max calculé des six, jamais en dur) et extinction symétrique du surplus par paires, du bord vers le mot |
| `lib/use-dialog-focus.js` | `lib/use-dialog-focus.test.jsx` (26 tests, jsdom) | piège de focus, Échap, restauration du focus |
| `lib/chat-request.js` | `lib/chat-request.test.jsx` (12 tests) | le cycle de vie d'une requête du chat : course sur le contrôleur d'annulation, délai, distinction fermeture / expiration |
| `lib/contact-form.js` | `lib/contact-form.test.js` (18 tests) | les décisions d'envoi du formulaire : pot de miel, délai de remplissage, bornes de longueur |
| `lib/contact-overlay.jsx` | `lib/contact-overlay.test.jsx` (9 tests, jsdom) | le câblage de ces décisions dans le composant : le piège est soumis, les bornes atteignent le HTML, un envoi automatique ne part pas |
| `lib/chat-digest.js` | `lib/chat-digest.test.js` (29 tests) | la construction du digest du chatbot : troncature annoncée et coupée sur une fin de ligne, ordre des sections, exclusions volontaires |
| `lib/cube-nav.jsx` | `lib/cube-nav-focus.test.jsx` (3 tests, jsdom) | le focus rendu par SKIP/RETOUR avant leur masquage, et le gabarit mobile de CONTACT aligné sur les onglets |
| `lib/language-switcher.jsx` | `lib/language-switcher.test.jsx` (12 tests, jsdom) | la langue affichée, la destination conservée au changement, le nom accessible « Label in Name » |
| `lib/site-routes.js` | `lib/site-routes.test.js` (22 tests) | le routage par langue : préfixe, conservation de la page, `localeHref` sans double préfixe |
| `lib/voice.js` | `lib/voice.test.js` (14 tests) | la locale de synthèse et le choix de la voix par langue, y compris le repli |
| `lib/content/ui.js` | `lib/content/ui.test.js` (12 tests) | la parité fr/en des libellés d'interface : mêmes clés dans le même ordre, pas de chaîne vide, pas de français résiduel |
| `lib/content/` (éditorial) | `lib/content/parity.test.js` (8 tests) + `lib/content/content.test.js` (6 tests) | la parité fr/en du contenu et le chargement par langue |
| `lib/drag-inertia.js` | `lib/drag-inertia.test.js` (19 tests) | la glisse du drag : vitesse au relâchement, plafond, décroissance, durée proportionnelle |
| `lib/cube-tail.js` | `lib/cube-tail.test.js` (32 tests) | la géométrie de la piste, les paliers, le dénouement programmé, le lissage du scroll |
| `components/hero-cube.jsx` + `lib/content/ui.js` | `lib/skip-link.test.js` (4 tests) | le lien d'évitement `#contenu` avant la section, la cible `id="contenu"`, le libellé traduit dans les deux langues |
| `components/site-shell.jsx` + `components/projects-page.jsx` | `lib/chat-widget-placement.test.jsx` (5 tests, jsdom) | la présence du chatbot sur les quatre routes, une seule fois, au-dessus des overlays, avec voile mobile |
| `worker/src/langue.js` | `worker/src/langue.test.js` (31 tests) | la détection de langue du Worker |
| `worker/src/index.js` | `worker/src/index.test.js` (32 tests) | l'**ordre** des refus du Worker, la borne du flux, la reconstruction du prompt, et le traitement d'un refus amont |

### Ce que valent ces tests

Un test qui n'a jamais échoué ne prouve rien. Les fichiers ci-dessus ont été
soumis à **mutation** : on réintroduit le défaut, on vérifie que la suite le voit,
on restaure. Les cas vérifiés :

| Défaut réintroduit | Tests qui échouent |
|---|---|
| le Worker laisse passer quand `CHAT_LIMIT` manque | 3 |
| la coupure des tours `assistant` fabriqués est retirée | 1 |
| le refus sans `CF-Connecting-IP` devient une clé partagée | 1 |
| la borne de flux (`capStream`) est neutralisée | 1 |
| le pot de miel du formulaire est supprimé | 2 |
| le délai de remplissage est ignoré | 2 |
| le champ-piège est renvoyé dans le corps de la requête | 2 |
| le piège du formulaire revient à un `onChange` générique | 1 |
| le filtre automatique du formulaire est retiré | 2 |
| la validation de saisie ne s'exécute plus | 2 |
| `chat-request` retombe sur un `finally` inconditionnel | 3 |
| le digest se coupe au plafond sans chercher la fin de ligne | 1 |
| le marqueur de troncature du digest est retiré | 3 |
| un plafond nul est traité comme un plafond vide | 1 |
| le parcours est replacé en fin de digest | 2 |

Deux défauts sont apparus **dans du code écrit dans cette même vague**, trouvés
par ces tests : `lib/chat-request.js` écrasait le minuteur précédent sans
l'annuler, et le champ-piège du formulaire était présent, soumis, et jamais lu
(l'état et le DOM portaient deux noms différents). Les deux sont des défauts
qu'aucune relecture ne voit.

Une troisième vague a produit deux faux signaux, dans les deux cas parce que la
mutation n'avait pas été appliquée et que la commande renvoyait 0 faute d'avoir
cassé quoi que ce soit. C'est le piège du procédé : un test « mutant » qui ne
mutait rien valide la suite sans rien prouver. Il faut toujours confirmer que la
modification a pris avant de croire au résultat.

Le fichier du Worker ne teste pas les réponses — ce sont des réponses de modèle,
sans intérêt ici — mais **ce que le Worker refuse de faire avant de décider**. Un
test qui n'observerait que le statut HTTP passerait même avec une requête traitée
jusqu'à l'appel d'inférence avant d'être refusée ; ces tests comptent donc les
effets de bord (`limit()`, `fetch()`) et pas seulement la réponse. Ils ont échoué
le jour où le garde-fou d'origine a été neutralisé : c'est ce qui fait qu'ils
documentent la propriété de sécurité, et pas seulement le code.

Non testés : `lib/cube-media.js` (simple table + `faceSrcSet()`),
`lib/portfolio-content.js` (données pures, sans logique), ainsi que
`app/` et l'essentiel de `components/` — `vitest.config.js` nomme explicitement
`lib/` et `worker/src/` dans son `include`. Les composants montés par des tests
sont ceux dont la logique a été extraite en un module testable
(`contact-overlay.jsx` pour le formulaire, `cube-nav.jsx` pour le focus,
`language-switcher.jsx` pour la langue), plus `SiteShell` + `ProjectsPage` pour
la présence du chatbot ; les contrats trop couplés au DOM animé (`hero-cube.jsx`,
lien d'évitement, ordre d'empilement) sont vérifiés par lecture de source, pas
par montage — voir `chat-widget-placement.test.jsx` et `skip-link.test.jsx`.

`scripts/build-chat-content.mjs` n'est plus dans cette liste : sa partie
décisionnelle est dans `lib/chat-digest.js`, testée. Le script restant se limite
à écrire le fichier, et c'est bien cette partie qui ne l'est pas — un chemin
d'écriture faux produirait un digest absent, ce que la CI vérifie par
`test -f dist/content.json`.

Le premier est le seul module testé sans DOM ; c'est aussi
le seul où une régression passerait inaperçue, car une interpolation de pose
erronée ne produit aucune erreur, seulement un cube qui tourne mal. Les chiffres
cités dans ses commentaires — pointe de vitesse, inégalité des paliers — sont
vérifiés par ces tests.

Les fichiers sur DOM portent le pragma `// @vitest-environment jsdom` en tête
(`vitest.config.js` reste en environnement `node` par défaut : le pragma n'est
payé que par les fichiers qui en ont besoin). La plupart ont en plus
exigé `@testing-library/react` et le réglage JSX automatique du config ;
deux (`chat-widget-placement`, `skip-link`) lisent la source au lieu de monter,
parce que le composant visé ne se monte pas sous jsdom.

## Déploiement

Le projet est configuré pour un déploiement automatique sur GitHub Pages via GitHub Actions (`.github/workflows/pages.yml`).

### Configuration

1. Forkez ce dépôt
2. Dans **Settings > Pages**, sélectionnez **GitHub Actions** comme source
3. Poussez sur la branche `main` — le déploiement se fait automatiquement

### Variables d'environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_BASE_PATH` | Préfixe de déploiement GitHub Pages (géré par le CI, ne pas modifier) | `""` (vide en local) |
| `NEXT_PUBLIC_SITE_URL` | Racine du domaine public (canonical, Open Graph, JSON-LD) | `https://phib64.github.io` |
| `NEXT_PUBLIC_FORMSPREE_ENDPOINT` | Endpoint du formulaire de contact | valeur codée en dur dans `components/contact-overlay.jsx` |
| `NEXT_PUBLIC_CHAT_ENDPOINT` | URL du Worker proxy du chatbot (voir `worker/README.md`) | absent : le bouton de chat n'est pas rendu |

Les gabarits à copier sont `.env.example` (racine) et `worker/.dev.vars.example`
(Worker local). `.env.local` est ignoré par git (voir `.gitignore`).

## Assistant de chat

Optionnel et découplé : sans `NEXT_PUBLIC_CHAT_ENDPOINT`, le site fonctionne
normalement, simplement sans bouton de chat.

- **Contenu.** `lib/chat-digest.js` lit la source unique
  `lib/portfolio-content.js` (`PROJECT_CONTENT`, `CAREER_CONTENT`,
  `STACK_CONTENT`, `USAGE_CONTENT`) et produit le digest ;
  `scripts/build-chat-content.mjs` (lancé en `postbuild`) ne fait plus que
  l'écrire dans `dist/content.json`. Le digest est un objet
  `{ "digest": "…" }` plafonné à `MAX_CHARS = 16000` caractères (troncature sur
  fin de ligne, signalée dans le texte ; digest actuel : ~15 700 caractères,
  soit 270 de marge — ajouter une seule ligne à une rubrique peut le faire
  mordre).
- **Relais.** `worker/` (Cloudflare Worker `portfolio-chat`, voir
  `worker/README.md` et `worker/wrangler.jsonc`) lit ce digest (cache 10 min)
  plus les dépôts GitHub publics (`GITHUB_USER`, cache 1 h, forks écartés) et
  relaie OpenRouter (`openrouter/free`, `max_tokens: 500`). Garde-fous du
  relais : 10 requêtes/min par IP via le binding `CHAT_LIMIT`, CORS restreint à
  `ALLOWED_ORIGINS`, system prompt reconstruit côté Worker, corps de requête lu
  en bornant la mémoire, flux de réponse plafonné à 256 KiB.
- **Fail-closed.** L'absence de `CHAT_LIMIT` renvoie un **503**, pas un refus
  de quota : le binding manquant est une erreur de déploiement, or c'est
  précisément le cas qui exposerait le relais le plus. Une requête sans
  `CF-Connecting-IP` est refusée (400) plutôt que regroupée sous une clé de
  jauge partagée — sinon un attaquant sans en-tête vide le seau de tous les
  visiteurs légitimes.
- **Interface.** `components/chat-widget.jsx` : historique limité aux 16
  derniers messages, 2 relances (`MAX_RETRIES = 2`), refus de modération non
  relancés (`retryable: false`), `stripMarkdown()` à l'affichage (le front rend
  le texte brut avec `whitespace-pre-wrap`). Panneau non modal : Échap pour
  fermer, page tabulable derrière.
- **Cycle de vie.** `lib/chat-request.js` porte le contrôleur d'annulation, son
  délai (`REQUEST_TIMEOUT_MS = 40 s`, couvrant le `send` entier et non chaque
  tentative) et la distinction entre fermeture du panneau et expiration — les
  deux produisent la même `AbortError`, et sans cette distinction une panne du
  service s'affichait comme un geste du visiteur, donc en silence.

## Version textuelle (`/projects`)

Le contenu des six rubriques ne vit que dans des boîtes de dialogue rendues par
un composant client. Le HTML servi ne contenait donc aucun mot de contenu
éditorial : un moteur de recherche n'indexait qu'un titre, un nom et six
mots-clés.

`app/(en)/projects/page.jsx` est la version en texte, pré-rendue au build. Deux
contraintes ont guidé sa conception.

**Elle n'a pas de source de contenu propre.** Elle appelle
`renderProjectContent` (`components/cube/project-content.jsx`), la fonction qui
produit les overlays, avec un décalage de titres. Le texte vient donc de la même
source — `lib/portfolio-content.js` — et il est produit par le même code : une
compétence qui change change sur les deux emplacements. Le décalage (`0` par
défaut) sert à la page, où un seul `h1` doit nommer le document ; à `0`, le
rendu de l'overlay est bit pour bit celui d'avant.

**Elle ne rend aucun balisage d'overlay.** Ni `role="dialog"`, ni `aria-labelledby`,
ni bouton d'appel à l'action sans gestionnaire. `onContact` n'est pas fourni, donc
l'appel à l'action n'est simplement pas rendu.

Deux détails qui ne sont pas visibles à la lecture du code :

- La page a **son propre** conteneur de défilement (`fixed inset-0 overflow-y-auto`)
  parce que `globals.css` verrouille `html, body` pour que la section du cube soit
  le seul scroller. Réutiliser le verrou existant plutôt que le desserrer.
- Le lien vers `/projects` est dans un `<noscript>` sur la page d'accueil, parce
  que c'est le seul endroit du HTML servi où il peut figurer sans trouer la mise
  en page du cube. Il y fait une vraie alternative, pas un lien caché : le cube
  exige JavaScript, donc sans lui la page d'accueil est vide.
- Il n'y a **pas** de lien vers `/projects` dans `contact-overlay.jsx`, et il ne
  faut pas en ajouter un. Son HTML n'est pas servi au moment du crawl (il ne se
  construit qu'à l'ouverture du panneau), et le `<noscript>` couvre déjà le
  cas sans JavaScript — un second lien n'apporterait rien au visiteur. Le garder
  visible était possible, le supprimer est plus simple.

## Structure du Projet

```
portfolio/
├── app/                      # Pages et layout Next.js
│   ├── (en)/                 # Anglais : la langue par défaut, donc à la racine
│   │   ├── layout.js         # Layout racine EN (<html lang="en">)
│   │   ├── page.js           # /            Page d'accueil (HeroCube + ChatWidget)
│   │   └── projects/         # /projects
│   ├── (fr)/                 # Français : préfixé, donc sous /fr
│   │   ├── layout.js         # Layout racine FR (<html lang="fr">)
│   │   └── fr/
│   │       ├── page.js       # /
│   │       └── projects/     # /fr/projects
│   ├── globals.css           # Styles globaux et thème
│   ├── sitemap.js            # sitemap.xml, entry point
│   └── manifest.js           # Manifeste PWA
├── components/               # Composants React
│   ├── hero-cube.jsx         # Cube 3D interactif principal (3192 lignes)
│   ├── chat-widget.jsx       # Panneau de l'assistant (non modal)
│   ├── contact-overlay.jsx   # Overlay de contact (Formspree + mailto)
│   └── cube/
│       ├── cube-face.jsx        # Les 6 faces : média, label, orientation
│       ├── cube-nav.jsx          # Flèches de navigation entre faces
│       ├── click-pointer.jsx     # Pointeur de survol
│       ├── intro-marker.jsx      # Marqueur d'introduction
│       ├── orientation-lock.jsx  # Verrouillage paysage
│       ├── project-content.jsx   # Rendu des 6 rubriques depuis PROJECT_CONTENT
│       └── project-tabs.jsx      # Onglets + bouton retour
├── lib/                      # Logique pure et données (testée par vitest)
│   ├── cube-math.js          # Calculs géométriques du cube (+ .test.js, 58 tests)
│   ├── cube-media.js         # Source unique des médias des 6 faces
│   ├── cube-finale.js        # Contrat de temps de la fin (+ .test.js, 18 tests)
│   ├── cube-timeline.js      # Chronologie des apparitions (+ .test.js, 13)
│   ├── cube-tour.js          # Tournée tirée au sort (+ .test.js, 15)
│   ├── cube-sonar.js         # Survol et distance (+ .test.js, 10)
│   ├── cube-viewport.js      # Contrat de fenêtre (+ .test.js, 14)
│   ├── face-labels.js        # Élection de la face qui décode (+ .test.js, 21 tests)
│   ├── leak-filter.js        # Filtrage des fuites de modération (+ .test.js, 30)
│   ├── chat-request.js       # Cycle de vie d'une requête du chat (+ .test.jsx, 12)
│   ├── chat-digest.js        # Digest du chatbot pour le system prompt (+ .test.js, 29)
│   ├── contact-form.js       # Décisions d'envoi du formulaire (+ .test.js, 18)
│   ├── device.js             # Détection de capacité (+ .test.js, 11)
│   ├── portfolio-content.js  # Données éditoriales (cube + digest chat)
│   ├── reduced-motion.js     # Lecture prefers-reduced-motion (+ .test.js)
│   ├── scramble.js           # Animation de brouillage de texte (+ .test.js partiel)
│   ├── site-url.js           # Racine publique du site (canonical, OG, JSON-LD)
│   └── use-dialog-focus.js   # Piège de focus + Échap (+ .test.jsx)
├── scripts/
│   └── build-chat-content.mjs # Écrit dist/content.json (postbuild, logique dans lib/)
├── worker/                   # Proxy OpenRouter (Cloudflare, voir son README)
│   ├── src/index.js          # Relais + system prompt + garde-fous (1102 lignes)
│   ├── wrangler.jsonc        # Config (origines, digest, GitHub, rate limit)
│   └── README.md             # Mise en place, sources, streaming, rate limiting
├── public/                   # Assets statiques (recopiés tels quels dans dist/)
│   ├── web.webm              # Vidéo face Web
│   ├── react.webp (+ 480/768/1152) # Image face React + variantes srcset
│   ├── backend.webm          # Vidéo face Backend
│   ├── database.webp (+ 480/768/1152) # Image face Database + variantes
│   ├── mobile.webm           # Vidéo face Mobile
│   ├── projets.webp (+ 480/768/1152) # Image face Projets + variantes
│   ├── cv.pdf                # CV téléchargeable
│   └── icon.webp / favicon.webp # Icônes PWA
├── eslint.config.js          # Lint (ignore dist, .next, node_modules, .wrangler)
├── vitest.config.js          # Tests (env node, include lib/ et worker/src/, pragma jsdom ciblé)
└── .github/workflows/        # CI/CD GitHub Actions (lint + tests bloquants, build dist/)
```

## Personnalisation

### Modifier les images du cube

Les médias des six faces sont définis dans **`lib/cube-media.js`** (constante
`FACE_MEDIA`), dans l'ordre de `FACE_LABELS`. Cette liste est la source unique :
`app/(en)/page.js` la passe au cube, et `components/hero-cube.jsx` s'en sert de
repli si la prop `images` est vide.

L'appariement se fait sur le nom de fichier : correspondance exacte du nom sans
extension d'abord (`web` → `web.webm`), puis correspondance partielle. Le nom du
fichier doit donc rester lisible — `web.webm` et non `web-dev-2.webm`.

### Modifier les labels

Les labels des faces sont définis dans `lib/cube-math.js` via `FACE_LABELS`.

Une face ne se décode que si son label est révélé **et** qu'elle est réellement
présentée à l'écran : au-delà de `FACE_LABEL_DECODE_MIN_EXPOSURE` (0,5), dans
`lib/face-labels.js`. Ce seuil n'est pas cosmétique — sans lui, la première face
révélée était élue d'office, encore bieu, et son label s'affichait déjà décodé
sans jamais avoir été brouillé. La raison est détaillée dans le module, et le
comportement est verrouillé par `lib/face-labels.test.js`.

Tous les labels démarrent sur la même largeur brouillée : le max calculé des
six (`scrambleBaseLength` dans `lib/scramble.js`), jamais écrit en dur — un
libellé change, le max suit. Le surplus entoure le mot (moitié à gauche,
moitié à droite) et s'éteint symétriquement par paires, du bord vers le mot,
une fois les lettres résolues : le bloc se resserre sur son centre au lieu de
sauter d'un côté. Un surplus impair est arrondi d'un cran (+1) pour garder des
paires entières — les faces démarrent donc sur deux largeurs à un caractère
près (8 et 9 aujourd'hui), parité oblige. Verrouillé par
`lib/scramble-padding.test.js`.

### Modifier les couleurs

Le thème est défini dans `app/globals.css` via les variables CSS (`--primary`, `--secondary`, etc.).

## Accessibilité

- Le cube est pilotable au clavier : la section de défilement est le conteneur
  de scroll, donc **les flèches font défiler la piste** (qui pilote la rotation)
  et **Entrée ouvre la face tournée vers l'observateur**. Les flèches n'ont pas
  été captées au profit d'une rotation directe, pour ne pas supprimer le
  défilement au clavier.
- Les onglets projets, masqués (`opacity: 0`) avant leur révélation, **se
  révèlent au focus** : sans cela la tabulation menait à des boutons invisibles.
- **`prefers-reduced-motion` est lu en JavaScript**, via `lib/reduced-motion.js`.
  La fonction était un `return false` en dur : le réglage système n'était lu
  nulle part, et seul `.wheel-anim` y obéissait, en CSS. Un visiteur qui a coupé
  les animations subissait donc l'autoplay de fin, les ondes sonar, le brouillage
  des labels, l'icône de pointer et les `scrollTo` lisses. Ce qui est neutralisé,
  et ce qui ne l'est pas :

  | Élément | Traitement | Pourquoi |
  |---|---|---|
  | Finale d'autoplay (SHOW+SPIN+TAIL) | durées normales, comme sans la préférence | raccourcir accélérait la rotation (même angle en moins de temps) ; la piste doit atteindre le bout pour dévoiler les liens |
  | Galerie du skip (tour des 6 faces) | durées normales, rotation conservée ; pas de décodage (texte posé directement) sur mobile ou sous la préférence | réduire la durée sans réduire l'arc l'accélérait ; figer les rotations stationnait sur chaque pose sans tour entre les labels |
  | Ondes sonar (faces) | quasi instantanées (700/480 ms → 60 ms) | le voile doit être plein avant le basculement du visuel, sinon pop ; seul l'anneau disparaît |
  | Onde de fond | quasi instantanée (700/420 ms → 60 ms) | même raison ; pas de durée explicite sous `reduce`, pour laisser le `??` appliquer la durée réduite |
  | Brouillage des labels de face | état « codé » en image fixe, décodage borné inchangé | le contenu est identique ; seule la boucle infinie de re-brouillage (la seule hors CSS) disparaît |
  | Icône de pointer | supprimée (tir marqué, geste non joué) | ~2,3 s de geste imposé, redondant avec le texte « cliquez sur une face » |
  | Vidéos (fond + faces) | figées sur la première image | le projet montré est identique, seul le mouvement disparaît ; la lecture suivait déjà le clic |
  | Bouton « retour en haut », rattrapage de verrou | `scrollTo` instantané | repositionnement imposé par le code, pas un geste de l'utilisateur |
  | Boucles `.wheel-anim`, `.animate-spin` | `animation: none` | boucles infinies, donc toujours autonomes |
  | **Scrub de scroll du cube** | **non concerné** | contrôle direct de l'utilisateur, pas une animation automatique ; le neutraliser figerait la page sur la carte d'intro |

  La préférence est relue à chaque appel, pas au montage : un visiteur qui la
  change en cours de page voit la séquence suivante en tenir compte. Le mode
  mobile suit la même règle : le skip y pose les labels directement, sans
  décodage. Seule
  exception, les durées du skip (`SKIP_MORPH_MS`, `SKIP_TURN_MS`, `SKIP_LEAD_MS`,
  `SKIP_GAP_MS`) sont figées à l'armement de l'effet — changer le réglage ou
  basculer desktop/mobile en
  cours de sweep ne change que le brouillage du label courant (posé
  directement), pas le minutage.
- **Les deux overlays plein écran sont des `dialog` modaux.** `role="dialog"`,
  `aria-modal="true"`, `aria-labelledby` sur le titre de la page, piège de focus
  (Tab reboucle sur le dernier et le premier contrôle), **touche Échap** pour
  fermer, focus posé sur le premier contrôle à l'ouverture et **rendu au bouton
  déclencheur à la fermeture**. La mécanique est dans
  `lib/use-dialog-focus.js`, testée sur DOM (`lib/use-dialog-focus.test.jsx`).
- La section du cube est **`inert`** tant qu'un overlay est ouvert ou que le
  verrou d'orientation est actif. `aria-hidden` seul ne suffisait pas : il sort
  l'arbre d'accessibilité mais laisse les boutons focusables sous une couche
  opaque. Les deux overlays sont pour cette raison frères de la `<section>` et non
  enfants — un `inert` ne peut pas neutraliser un sous-arbre qui contient le
  dialogue. Ce déplacement a au passage corrigé un bug d'empilement : la section
  portant `z-10` + `relative`, c'était un contexte d'empilement, et la bulle de
  l'assistant (`z-40`, hors section) passait **au-dessus** de l'overlay projet.
- Les boutons **CONTACT** et **SKIP** du cube, et les **six onglets** avant leur
  révélation, sont masqués en `opacity: 0`. `opacity` ne les sortait pas de la
  tabulation : ils étaient focusables et annoncés avant d'être visibles. Corrigé
  par `tabIndex={-1}` + `aria-hidden` — pas par `visibility`, qui aurait tué le
  fondu du bouton CONTACT. Le `onFocus` qui révélait les onglets reste en filet
  (navigateur ignorant `tabIndex`, restauration de session).
- **Contenus réécrits en boucle masqués aux lecteurs.** Les labels des faces et
  de la galerie sont réécrits à chaque frame pendant le brouillage (`scramble.js`)
  : sans `aria-hidden`, le lecteur épelle des suites comme « X Q 7 % ». Le label
  n'est pas interactif — la zone de clic porte le nom de la face, l'onglet le nom
  stable. Même traitement pour les textes anglais redondants dans une page
  `lang="fr"` (« CLICK TO EXPLORE », « SCROLL DOWN »), couverts par l'`aria-label`
  français de la zone de clic, et pour les SVG décoratifs (souris d'intro, fil de
  fer du cube, icônes GitHub/LinkedIn), doublés par un texte adjacent.
- **Contrastes.** Trois familles de texte échouaient au seuil AA (4,5:1) :
  `#64748b` sur fond sombre (4,02) est passé à `#7c8ca1` (5,58) ; le blanc sur le
  cyan des boutons primaires (3,00) est passé au texte sombre `#0a0f1c` (6,38,
  aujourd'hui porté par `--primary-foreground`) ; le placeholder du formulaire
  `#334155` (1,72) est passé à `#728296` (4,55). Restent blancs sur fond sombre
  les textes déjà au-dessus du seuil (19,13 pour le blanc pur) et la pastille
  vocale du chat (blanc sur `#d900a8`, 4,65).
- **Lien d'évitement.** Premier dans l'ordre de tabulation sur l'accueil, il mène
  à `#contenu` (la section du cube) et n'apparaît qu'au focus clavier — sans
  lui, un visiteur au clavier tabule SKIP, les six onglets et le cube avant tout
  contenu. Le libellé est traduit (`nav.skipToContent`), comme la consigne de la
  zone de clic du cube (`cube.cubeInstructions`), qui était restée en français
  sur la page anglaise.
- Le titre de la page d'accueil est un `<text>` SVG, non exposé aux lecteurs
  d'écran : un `<h1 class="sr-only">` est posé dans `app/(en)/page.js`.
- **Ce qui reste à faire.** Le verrou d'orientation est un `alertdialog` sans
  contrôle focusable : il est annoncé au focus, mais rien ne permet de le fermer
  au clavier, ce qui est correct — il n'a pas de fermeture, seulement une
  consigne. Le panneau de l'assistant a Échap et `aria-controls`, mais reste
  non modal par choix : la page reste tabulable derrière.

## Licence

Projet personnel — Tous droits réservés.

## Contact

- **Email** : philippebarbosa64@gmail.com
- **GitHub** : [PhiB64](https://github.com/PhiB64)
- **LinkedIn** : [Philippe Barbosa](https://www.linkedin.com/in/philippe-barbosa/)
