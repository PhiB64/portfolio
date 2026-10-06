/** @type {import('next').NextConfig} */
const BASE = process.env.GITHUB_PAGES === "true" ? "/portfolio" : "";

/*
 * Pas de `redirects` ici, volontairement. `output: "export"` ne les applique pas
 * : Next.js le signale à chaque build et ne génère rien. Les anciennes URL
 * anglaises sont donc redirigées par `public/en.html` et
 * `public/en/projects.html`, que ce build copie tels quels dans `dist/`.
 *
 * Le nommage suit exactement celui que Next produit pour une vraie route
 * (`fr.html`, `fr/projects.html`), parce que c'est ainsi que GitHub Pages sert
 * `/fr` et `/fr/projects`. Les deux mécanismes se superposent donc sans
 * divergence possible.
 */

const nextConfig = {
  output: "export",
  // basePath only applied during GitHub Pages build to avoid changing local dev URL.
  basePath: BASE,
  env: { NEXT_PUBLIC_BASE_PATH: BASE },
  // The production export goes to `dist/` (the CI uploads it). Dev mode keeps
  // Next's default `.next/dev` so `next build` never wipes a running dev server.
  distDir: process.env.NODE_ENV === "production" ? "dist" : ".next",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;