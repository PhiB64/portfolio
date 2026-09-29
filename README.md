# Portfolio — Philippe Barbosa

Portfolio interactif de **Philippe Barbosa**, Concepteur Développeur Full Stack.

![Portfolio Preview](public/projets.webp)

## Aperçu

Site one-page immersif avec un **cube 3D interactif** qui présente les compétences et projets. Chaque face du cube représente un domaine d'expertise (Web, React, Backend, Database, Mobile, Projets). L'animation est pilotée par le scroll avec des effets visuels avancés (sonar, scramble, morphing).

## Stack Technique

- **Next.js 16** — App Router, export statique
- **React 19** — Composants client, hooks avancés
- **Tailwind CSS v4** — Styling utilitaire
- **animejs** — Animations et timelines
- **GSAP** — Animations complexes
- **Lucide React** — Icônes

## Fonctionnalités

- Cube 3D interactif avec 6 faces thématiques
- Animation scroll-driven avec timeline animejs
- Effets visuels : sonar, scramble de texte, morphing
- Responsive design (mobile, tablette, desktop)
- Gestion des événements tactiles et pointer
- SEO optimisé (metadata, Open Graph, JSON-LD)
- Déploiement automatique sur GitHub Pages

## Démarrage

### Prérequis

- Node.js 18+
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

Le build est exporté dans `dist/`.

### Lint

```bash
npm run lint
```

## Déploiement

Le projet est configuré pour un déploiement automatique sur GitHub Pages via GitHub Actions (`.github/workflows/pages.yml`).

### Configuration

1. Forkez ce dépôt
2. Dans **Settings > Pages**, sélectionnez **GitHub Actions** comme source
3. Poussez sur la branche `main` — le déploiement se fait automatiquement

### Variables d'environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_BASE_PATH` | Chemin de base pour GitHub Pages | `""` (vide en local) |
| `NEXT_PUBLIC_SITE_URL` | URL publique du site | `https://phib64.github.io` |

## Structure du Projet

```
portfolio/
├── app/                    # Pages et layout Next.js
│   ├── layout.js           # Layout principal avec metadata SEO
│   ├── page.js             # Page d'accueil
│   └── globals.css         # Styles globaux et thème
├── components/             # Composants React
│   ├── hero-cube.jsx       # Cube 3D interactif principal
│   ├── contact-overlay.jsx # Overlay de contact
│   └── cube/
│       └── project-content.jsx
├── lib/                    # Utilitaires
│   ├── cube-math.js        # Calculs géométriques du cube
│   └── scramble.js         # Animation de brouillage de texte
├── public/                 # Assets statiques
│   ├── web.webm            # Vidéo face Web
│   ├── react.webp          # Image face React
│   ├── backend.webm        # Vidéo face Backend
│   ├── database.webp       # Image face Database
│   ├── mobile.webm         # Vidéo face Mobile
│   ├── projets.webp        # Image face Projets
│   ├── cv.pdf              # CV téléchargeable
│   └── icon.webp           # Icône du site
└── .github/workflows/      # CI/CD GitHub Actions
```

## Personnalisation

### Modifier les images du cube

Les images sont définies dans `app/page.js` via la constante `HERO_IMAGES`. Remplacez les chemins par vos propres visuels.

### Modifier les labels

Les labels des faces sont définis dans `lib/cube-math.js` via `FACE_LABELS`.

### Modifier les couleurs

Le thème est défini dans `app/globals.css` via les variables CSS (`--primary`, `--secondary`, etc.).

## Licence

Projet personnel — Tous droits réservés.

## Contact

- **Email** : philippebarbosa64@gmail.com
- **GitHub** : [PhiB64](https://github.com/PhiB64)
- **LinkedIn** : [Philippe Barbosa](https://www.linkedin.com/in/philippe-barbosa/)
