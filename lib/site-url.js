/**
 * Racine publique du site, en un seul endroit.
 *
 * Trois fichiers en ont besoin : la canonique et les Open Graph
 * (`app/layout.js`), `robots.txt` (`app/robots.js`) et le sitemap
 * (`app/sitemap.js`). Tant que la formule était recopiée dans chacun, une
 * correction de la canonique pouvait n'atteindre que le HTML — et laisser
 * pointer le sitemap vers la page utilisateur GitHub au lieu du portfolio,
 * précisément le bug que ce fichier existe pour éviter.
 *
 * Deux variables, une distinction qui compte :
 *
 * - `NEXT_PUBLIC_SITE_URL` est le domaine, lu ici tel quel depuis
 *   l'environnement. L'hébergement peut le changer sans toucher au code.
 * - `NEXT_PUBLIC_BASE_PATH` est le préfixe de sous-dossier, et il n'est PAS
 *   pilotable par l'environnement : `next.config.mjs` l'écrase via `env` avec
 *   `/portfolio` quand `GITHUB_PAGES=true`, vide sinon. Le passer en variable
 *   d'environnement serait sans effet — d'où la note dans les trois appelants.
 *
 * `SITE_ROOT` est l'URL canonique complète. Sur GitHub Pages c'est
 * `https://phib64.github.io/portfolio`, pas le domaine nu : le domaine nu
 * désigne la page utilisateur de GitHub, hors site.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://phib64.github.io";
const SITE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const SITE_ROOT = `${SITE_URL}${SITE_PATH}`;

/** URL absolue d'un fichier de `public/`, préfixe de sous-dossier inclus. */
export function assetUrl(path) {
  return `${SITE_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
}
