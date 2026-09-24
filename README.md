# Portfolio

Portfolio personnel de Philippe Barbosa — Concepteur Développeur Full Stack.
Site statique construit avec Next.js (App Router) et exporté sur GitHub Pages.

## Stack

- **Next.js 16** (export statique)
- **React 19**
- **Tailwind CSS v4**
- **animejs** (timeline scroll-driven du cube 3D)

## Démarrage

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Le build est exporté dans `dist/`. Pour un déploiement sous `/portfolio/`
(GitHub Pages de repo), le CI passe par `GITHUB_PAGES=true`, sinon le
`basePath` reste vide pour le dev local.

## Lint

```bash
npm run lint
```

## Déploiement

Workflow GitHub Actions (`.github/workflows/pages.yml`) : build puis déploiement
automatique sur GitHub Pages à chaque `push` sur `main`.