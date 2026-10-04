import { defineConfig } from "vitest/config";

// Banc de test du projet. Un seul réglage est nécessaire, et il est structurant :
// l'environnement.
export default defineConfig({
  esbuild: {
    // Aucun fichier du projet n'importe React — tous comptent sur le runtime
    // automatique de Next. Vite ne le fait pas par défaut, si bien que les
    // composants de test échouaient sur « React is not defined ».
    jsx: "automatic",
  },
  test: {
    // `node` par défaut : `cube-math.js` et `reduced-motion.js` n'ont pas de
    // DOM. Les rares tests qui en ont besoin portent le pragma
    // `// @vitest-environment jsdom` en tête — plus ciblé qu'un environnement
    // global, et plus rapide sur la majorité des tests.
    environment: "node",
    // `lib/` pour la logique extraite, `worker/src/` pour le proxy : c'est la
    // surface d'attaque du déploiement, et elle n'était couverte par rien. Un
    // `include` qui ne la nomme pas la laisse en dehors par défaut, donc le
    // motif est explicite plutôt que dérivé.
    include: ["lib/**/*.test.{js,jsx}", "worker/src/**/*.test.js"],
  },
});