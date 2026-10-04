/**
 * `sitemap.xml` pour l'export statique GitHub Pages.
 *
 * Le site est une page unique : une seule URL, dont les variantes
 * `?project=N` sont des états d'overlay client (non indexables séparément
 * dans un export statique). `force-static` pour rester compatible avec
 * `output: "export"`.
 *
 * La racine du site vient de `lib/site-url.js`, partagée avec la canonique et
 * `robots.txt` : une URL du sitemap différente de la canonique donnerait au
 * même crawler deux signaux contradictoires.
 */

import { SITE_ROOT } from "../lib/site-url";

export const dynamic = "force-static";

export default function sitemap() {
  return [
    {
      url: `${SITE_ROOT}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
