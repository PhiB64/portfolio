# Portfolio — Philippe Barbosa

Portfolio interactif de **Philippe Barbosa**, Concepteur Développeur Full Stack.

![Portfolio Preview](public/projets.webp)

## Aperçu

Site one-page immersif avec un **cube 3D interactif** qui présente les compétences et projets. Chaque face du cube représente un domaine d'expertise (Web, React, Backend, Database, Mobile, Projets). L'animation est pilotée par le scroll avec des effets visuels avancés (sonar, scramble, morphing).

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
- Formulaire de contact via Formspree (`NEXT_PUBLIC_FORMSPREE_ENDPOINT`,
  repli `mailto` en cas d'échec — voir `components/contact-overlay.jsx`)
- Responsive design (mobile, tablette, desktop)
- Gestion des événements tactiles et pointer
- SEO optimisé (metadata, Open Graph, JSON-LD)
- Déploiement automatique sur GitHub Pages

## Démarrage

### Prérequis

- Node.js **20.9+** — exigence de Next.js 16, déclarée dans le champ `engines`
  de `package.json`. Node 18 est refusé dès l'installation. (Ce README
  annonçait 18+ jusqu'à récemment : l'échec ne se voyait qu'au build.)
- npm ou yarn

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

Les tests couvrent quatre modules de `lib/` :

| Module | Fichier de test | Ce qui est vérifié |
|---|---|---|
| `lib/cube-math.js` | `lib/cube-math.test.js` (58 tests) | la géométrie du cube (rotations, paliers de scroll, projection, hit-test) |
| `lib/reduced-motion.js` | `lib/reduced-motion.test.js` (6 tests) | la lecture de la préférence, y compris quand elle est absente |
| `lib/scramble.js` | `lib/scramble-reduced-motion.test.js` (4 tests, jsdom) | branche `cipher` + `prefers-reduced-motion` : image fixe sans boucle, `stopScramble(null)` no-op, décodage borné intact |
| `lib/use-dialog-focus.js` | `lib/use-dialog-focus.test.jsx` (22 tests, jsdom) | piège de focus, Échap, restauration du focus |

Non testés : `lib/cube-media.js` (simple table + `faceSrcSet()`),
`lib/portfolio-content.js` (données pures, sans logique),
`scripts/build-chat-content.mjs` (digest + troncature), ainsi que
`components/` et `app/` — voir `vitest.config.js` (`include` limité à `lib/`).

Le premier est le seul module testé sans DOM ; c'est aussi
le seul où une régression passerait inaperçue, car une interpolation de pose
erronée ne produit aucune erreur, seulement un cube qui tourne mal. Les chiffres
cités dans ses commentaires — pointe de vitesse, inégalité des paliers — sont
vérifiés par ces tests.

Les deux fichiers sur DOM portent le pragma `// @vitest-environment jsdom`
en tête (`vitest.config.js` reste en environnement `node` par défaut : le pragma
n'est payé que par les fichiers qui en ont besoin). Le dernier
(`use-dialog-focus`) a en plus exigé `@testing-library/react` et le réglage
JSX automatique du config.

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

- **Contenu.** `scripts/build-chat-content.mjs` (lancé en `postbuild`) lit la
  source unique `lib/portfolio-content.js` (`PROJECT_CONTENT`, `CAREER_CONTENT`,
  `STACK_CONTENT`, `USAGE_CONTENT`) et publie `dist/content.json` : un objet
  `{ "digest": "…" }` plafonné à `MAX_CHARS = 16000` caractères (troncature sur
  fin de ligne, signalée dans le texte ; digest actuel : ~15 700 caractères).
- **Relais.** `worker/` (Cloudflare Worker `portfolio-chat`, voir
  `worker/README.md` et `worker/wrangler.jsonc`) lit ce digest (cache 10 min)
  plus les dépôts GitHub publics (`GITHUB_USER`, cache 1 h, forks écartés) et
  relaie OpenRouter (`openrouter/free`, `max_tokens: 500`). Réponses limitées à
  10 requêtes/min par IP (binding `CHAT_LIMIT`), CORS restreint à
  `ALLOWED_ORIGINS`, system prompt injecté côté Worker.
- **Interface.** `components/chat-widget.jsx` : historique limité aux 16
  derniers messages, 2 relances (`MAX_RETRIES = 2`), refus de modération non
  relancés (`retryable: false`), `stripMarkdown()` à l'affichage (le front rend
  le texte brut avec `whitespace-pre-wrap`). Panneau non modal : Échap pour
  fermer, page tabulable derrière.

## Structure du Projet

```
portfolio/
├── app/                      # Pages et layout Next.js
│   ├── layout.js             # Layout principal avec metadata SEO
│   ├── page.js               # Page d'accueil (HeroCube + ChatWidget)
│   ├── globals.css           # Styles globaux et thème
│   └── manifest.js           # Manifeste PWA
├── components/               # Composants React
│   ├── hero-cube.jsx         # Cube 3D interactif principal (~3800 lignes)
│   ├── chat-widget.jsx       # Panneau de l'assistant (non modal)
│   ├── contact-overlay.jsx   # Overlay de contact (Formspree + mailto)
│   └── cube/
│       ├── project-content.jsx # Rendu des 6 rubriques depuis PROJECT_CONTENT
│       └── project-tabs.jsx    # Onglets + bouton retour
├── lib/                      # Logique pure et données (testée par vitest)
│   ├── cube-math.js          # Calculs géométriques du cube (+ .test.js, 58 tests)
│   ├── cube-media.js         # Source unique des médias des 6 faces
│   ├── portfolio-content.js  # Données éditoriales (cube + digest chat)
│   ├── reduced-motion.js     # Lecture prefers-reduced-motion (+ .test.js)
│   ├── scramble.js           # Animation de brouillage de texte (+ .test.js partiel)
│   └── use-dialog-focus.js   # Piège de focus + Échap (+ .test.jsx)
├── scripts/
│   └── build-chat-content.mjs # Digest dist/content.json (postbuild)
├── worker/                   # Proxy OpenRouter (Cloudflare, voir son README)
│   ├── src/index.js          # Relais + system prompt + garde-fous
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
├── vitest.config.js          # Tests (env node, include lib/, pragma jsdom ciblé)
└── .github/workflows/        # CI/CD GitHub Actions (lint + tests informatifs, build dist/)
```

## Personnalisation

### Modifier les images du cube

Les médias des six faces sont définis dans **`lib/cube-media.js`** (constante
`FACE_MEDIA`), dans l'ordre de `FACE_LABELS`. Cette liste est la source unique :
`app/page.js` la passe au cube, et `components/hero-cube.jsx` s'en sert de
repli si la prop `images` est vide.

L'appariement se fait sur le nom de fichier : correspondance exacte du nom sans
extension d'abord (`web` → `web.webm`), puis correspondance partielle. Le nom du
fichier doit donc rester lisible — `web.webm` et non `web-dev-2.webm`.

### Modifier les labels

Les labels des faces sont définis dans `lib/cube-math.js` via `FACE_LABELS`.

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
  cyan des boutons primaires (3,00) est passé au texte sombre `#0a0f1c` (6,38) ;
  le placeholder du formulaire `#334155` (1,72) est passé à `#728296` (4,55).
- Le titre de la page d'accueil est un `<text>` SVG, non exposé aux lecteurs
  d'écran : un `<h1 class="sr-only">` est posé dans `app/page.js`.
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
