/**
 * Métadonnées du site, par langue.
 *
 * Why une fabrique. `<html lang>` ne peut pas figer dans un layout racine unique
 * quand deux langues coexistent : `lang` doit être l'attribut du document, pas un
 * attribut posé plus bas. Deux layouts racines sont donc nécessaires — un par
 * groupe de routes — et chacun a les siens.
 *
 * Le risque de deux layouts est la dérive. Le bloc de métadonnées décrit le
 * titre, la description, les Open Graph, les favicons et le JSON-LD : le
 * dupliquer dans chaque layout aurait garanti qu'un jour l'anglais garde la
 * canonique française ou un `og:locale` de `fr_FR`. Cette fonction prend la
 * langue en paramètre et renvoie l'objet complet, donc les deux pages ont
 * exactement la même forme par construction.
 *
 * Ce qui varie réellement entre les deux : le titre, la description, l'URL
 * canonique, les variantes `hreflang` et le `locale` Open Graph. Tout le reste
 * est identique, et c'est ce qui doit le rester.
 */

import { SITE_ROOT, assetUrl } from "./site-url.js";
import { localePath, localeAlternates } from "./site-routes.js";
import { SUPPORTED_LOCALES } from "./content/index.js";

/**
 * Titres et descriptions par langue.
 *
 * Écrits ici plutôt que dans `fr.js` / `en.js` : ce sont les métadonnées de la
 * page entière, pas du contenu éditorial. Elles servent aussi au `<title>` du
 * CV, qui partage le même vocabulaire que l'en-tête du site.
 */
const META = {
  fr: {
    homeTitle: "Philippe Barbosa — Concepteur Développeur",
    homeDescription:
      "Portfolio de Philippe Barbosa, concepteur développeur full stack (React, Next.js, Node.js, TypeScript). Du web au mobile en passant par le back-end, les bases de données et le cloud : des projets réels, du code en production.",
    projectsTitle: "Compétences & projets — Philippe Barbosa",
    projectsDescription:
      "Développement web, front-end React et Next.js, back-end Node.js et Strapi, bases de données et cloud, développement mobile : le détail des compétences de Philippe Barbosa et de ses projets en production.",
    ogLocale: "fr_FR",
    jobTitle: "Concepteur Développeur",
  },
  en: {
    homeTitle: "Philippe Barbosa — Full Stack Developer",
    homeDescription:
      "Portfolio of Philippe Barbosa, full stack developer (React, Next.js, Node.js, TypeScript). From web to mobile, through back-end, databases and cloud: real projects, code running in production.",
    projectsTitle: "Skills & projects — Philippe Barbosa",
    projectsDescription:
      "Web development, React and Next.js front-end, Node.js and Strapi back-end, databases and cloud, mobile development: the detail of Philippe Barbosa's skills and production projects.",
    ogLocale: "en_US",
    jobTitle: "Full Stack Developer",
  },
};

export function metaText(lang) {
  const m = META[lang] ?? META.fr;
  return { ...m, appName: "Portfolio Philippe Barbosa" };
}

/**
 * Bloc `metadata` complet d'une page, prêt à être exporté par un layout.
 *
 * @param {string} lang
 * @param {string} pathname - chemin sans préfixe de langue, pour la canonique.
 * @returns {import("next").Metadata}
 */
export function siteMetadata(lang, pathname = "/") {
  const t = metaText(lang);
  const canonical = `${SITE_ROOT}${localePath(lang, pathname)}`;
  const title = pathname === "/projects" ? t.projectsTitle : t.homeTitle;
  const description =
    pathname === "/projects" ? t.projectsDescription : t.homeDescription;

  // `hreflang` : chaque langue se déclare elle-même et désigne l'ensemble des
  // variantes. Sans le `x-default`, un moteur de recherche qui ne parle aucune
  // des deux n'a aucune URL de repli et peut ignorer les deux.
  const languages = { ...localeAlternates(pathname) };
  languages["x-default"] = localePath("fr", pathname);

  return {
    metadataBase: new URL(SITE_ROOT),
    title,
    description,
    applicationName: t.appName,
    authors: [{ name: "Philippe Barbosa", url: SITE_ROOT }],
    creator: "Philippe Barbosa",
    alternates: {
      // `"/"` aurait produit `https://phib64.github.io/` via `metadataBase`,
      // soit la page utilisateur GitHub et pas le portfolio. La canonique doit
      // inclure le sous-dossier `/portfolio`.
      canonical,
      languages,
    },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: t.appName,
      locale: t.ogLocale,
      type: "website",
      // PNG 1200x630 explicite : les crawlers LinkedIn/X recadrent ou refusent
      // le WebP carré 512, qui reste déclaré en second pour les clients qui le
      // gèrent.
      images: [
        {
          url: assetUrl("/og-image.png"),
          width: 1200,
          height: 630,
          alt: "Philippe Barbosa — Concepteur Développeur Full Stack",
        },
        {
          url: `${SITE_ROOT}/icon.webp`,
          width: 512,
          height: 512,
          alt: "Logo de Philippe Barbosa",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [assetUrl("/og-image.png")],
    },
    icons: {
      // Ordre de préférence : `.ico` multi-tailles pour les navigateurs
      // anciens, WebP existant conservé, PNG pour la PWA et iOS.
      icon: [
        { url: assetUrl("/favicon.ico"), sizes: "16x16 32x32 48x48" },
        { url: assetUrl("/favicon.webp"), type: "image/webp" },
        { url: assetUrl("/icon-192.png"), sizes: "192x192", type: "image/png" },
        { url: assetUrl("/icon-512.png"), sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: assetUrl("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title,
    },
  };
}

/**
 * `viewport` du site, partagé par les deux langues.
 *
 * Séparé de `metadata` parce que Next.js expose deux exports distincts, et
 * qu'un `themeColor` par langue n'aurait aucun sens.
 */
export const siteViewport = { themeColor: "#0a0f1c" };

export { SUPPORTED_LOCALES };