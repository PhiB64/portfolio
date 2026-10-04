/**
 * `robots.txt` pour l'export statique GitHub Pages.
 *
 * Next.js 16 génère `robots.txt` depuis ce fichier (`force-static` : le site
 * est un export sans runtime, donc pas de route dynamique). Les crawlers sont
 * autorisés partout et pointés vers le sitemap.
 *
 * La racine du site vient de `lib/site-url.js`, comme la canonique
 * (`layout.js`) et le sitemap : les trois doivent désigner la même URL, sinon
 * `robots.txt` peut annoncer un sitemap qui ne correspond pas à la page
 * canonique.
 */

import { SITE_ROOT } from "../lib/site-url";

export const dynamic = "force-static";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_ROOT}/sitemap.xml`,
  };
}
