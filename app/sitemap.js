/**
 * `sitemap.xml` pour l'export statique GitHub Pages.
 *
 * Deux URL. La racine, et `/projects`, qui porte le texte éditorial en HTML
 * servi — sur la racine, ce texte n'existe que dans des boîtes de dialogue
 * rendues côté client, donc dans aucun document. Les variantes `?project=N` de
 * la racine ne sont pas listées : ce sont des états d'overlay, pas des pages, et
 * les lister ferait annoncer six URL dont le contenu ne se distingue pas.
 * `force-static` pour rester compatible avec `output: "export"`.
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
    {
      url: `${SITE_ROOT}/projects`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      // La racine reste prioritaire : c'est l'expérience principale, et la page
      // `/projects` n'est que sa transcription textuelle pour les moteurs.
      priority: 0.8,
    },
  ];
}
