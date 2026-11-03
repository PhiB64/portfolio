/**
 * `sitemap.xml` pour l'export statique GitHub Pages.
 *
 * Les pages sont énumérées depuis `PAGE_PATHS` et `SUPPORTED_LOCALES` plutôt
 * qu'écrites à la main. La liste était littéralement écrite avant : deux URL.
 * Avec deux langues et deux pages, l'écrire à la main aurait produit quatre
 * lignes correctes, puis cinq quand on aurait ajouté une langue, puis six…
 * et le oubli serait invisible, puisque le sitemap resterait un XML valide.
 * La boucle, elle, ne peut pas oublier une langue.
 *
 * Chaque entrée porte `alternates.languages`, ce qui fait le lien explicite
 * entre les variantes d'une même page. Indispensable ici : la racine et `/fr`
 * sont deux URL distinctes au contenu très proche, et sans ce lien un moteur de
 * recherche est libre de les traiter comme deux pages concurrentes du même
 * site — donc de n'indexer que la plus ancienne, la française.
 *
 * Les variantes `?project=N` ne sont pas listées : ce sont des états d'overlay,
 * pas des pages, et les lister ferait annoncer six URL par langue dont le
 * contenu ne se distingue pas.
 *
 * La priorité suit la structure : la racine d'une langue vaut plus que sa page
 * `/projects`, et la langue par défaut — l'anglais — reste au-dessus du français.
 * `force-static` pour rester compatible avec `output: "export"`.
 *
 * La racine du site vient de `lib/site-url.js`, partagée avec la canonique et
 * `robots.txt` : une URL du sitemap différente de la canonique donnerait au
 * même crawler deux signaux contradictoires.
 */

import { SITE_ROOT } from "../lib/site-url";
import { PAGE_PATHS, localePath, localeAlternates } from "../lib/site-routes";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "../lib/content/index.js";

export const dynamic = "force-static";

// Le contenu de chaque page est identique d'une langue à l'autre : mêmes
// rubriques, mêmes projets. Seule la racine se distingue vraiment, le cube
// restant l'expérience principale — `/projects` n'en est que la transcription
// textuelle pour les moteurs.
const PRIORITY = { "/": 1, "/projects": 0.8 };

export default function sitemap() {
  const lastModified = new Date();
  const out = [];

  for (const pathname of PAGE_PATHS) {
    for (const lang of SUPPORTED_LOCALES) {
      const languages = {};
      for (const [code, path] of Object.entries(localeAlternates(pathname))) {
        languages[code] = `${SITE_ROOT}${path}`;
      }

      out.push({
        url: `${SITE_ROOT}${localePath(lang, pathname)}`,
        lastModified,
        changeFrequency: "monthly",
        // Le français passe sous l'anglais : la langue par défaut fait foi, et
        // sur une seule paire de pages l'écart n'a pas besoin d'être grand.
        priority: PRIORITY[pathname] * (lang === DEFAULT_LOCALE ? 1 : 0.9),
        alternates: { languages },
      });
    }
  }

  return out;
}