/**
 * Chemins d'URL par langue.
 *
 * Why ce fichier existe. Une langue se choisit par le chemin, pas par un
 * paramètre : `/en/projects` et non `/projects?lang=en`. Trois raisons, dans
 * l'ordre de ce qui casse en premier si on fait l'inverse.
 *
 * - Un moteur de recherche indexe deux URL distinctes, pas deux paramètres.
 *   `?lang=en` produit une page unique dont la moitié du contenu change : c'est
 *   ce que les moteurs traitent le moins bien, et la page anglaise n'apparaît
 *   jamais dans les résultats.
 * - Le préfixe de sous-dossier `/portfolio` vit dans `basePath`. Dès que le
 *   chemin change, `basePath` s'applique ; un paramètre doit être reporté à la
 *   main dans chaque lien, et l'oubli se voit comme un 404 silencieux.
 * - Un lien vers `/en/projects` se partage et se colle tel quel. Un
 *   `?lang=en` se colle sans sa query string dans beaucoup de clients de
 *   messagerie.
 *
 * Une seule langue est à la racine. Le français est la langue d'origine : le
 * garder à la racine préserve toutes les URL déjà partagées, indexées et
 * présentes dans le CV, et évite de publier deux fois la même page sous deux
 * chemins. Les autres langues sont préfixées par leur code.
 *
 * `SUPPORTED_LOCALES` reste la seule liste des langues : ajouter `de` ici
 * produirait `/de/...` sans qu'aucune autre partie du site sache que cette
 * langue existe.
 */

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./content/index.js";

/** Préfixe de chemin d'une langue : vide pour la langue par défaut. */
export function localePrefix(lang) {
  return lang === DEFAULT_LOCALE ? "" : `/${lang}`;
}

/**
 * Les pages qui existent dans chaque langue.
 *
 * `pagePath` est le chemin sans préfixe de langue. Le préfixe de sous-dossier
 * de `basePath` n'est jamais inclus ici : `next/link` l'ajoute, et un `<a>`
 * doit passer par `localeHref`.
 */
export const PAGE_PATHS = ["/", "/projects"];

/**
 * Retire le préfixe de langue d'un chemin, quelle que soit la langue.
 *
 * `/en` et `/en/projects` deviennent `/` et `/projects` ; `/projects` reste
 * `/projects`. Le pathname renvoyé par `usePathname` ne contient déjà pas
 * `basePath`, cette fonction ne s'en occupe donc pas.
 *
 * La barre oblique finale est retirée au passage. Elle n'est pas produite par ce
 * site — `next.config.mjs` ne fixe pas `trailingSlash`, donc `/en` et non `/en/`
 * — mais un chemin qui la porte doit rester réversible : sans cette
 * normalisation, `/en/` donnerait `/en` puis `/`, et un aller-retour entre les
 * deux langues déplacerait le visiteur au lieu de le ramener.
 *
 * @param {string} pathname
 * @returns {string}
 */
export function pathWithoutLocale(pathname) {
  const p = pathname || "/";
  const m = p.match(/^\/([a-z]{2})(?=\/|$)/);
  const withoutPrefix = m && SUPPORTED_LOCALES.includes(m[1]) ? p.slice(m[0].length) : p;
  if (withoutPrefix.length > 1 && withoutPrefix.endsWith("/")) {
    return withoutPrefix.replace(/\/+$/, "") || "/";
  }
  return withoutPrefix || "/";
}

/**
 * Chemin d'une page dans une langue donnée, préfixe de langue compris.
 *
 * @param {string} lang
 * @param {string} pathname - chemin sans préfixe de langue, `/projects` par défaut.
 * @returns {string}
 */
export function localePath(lang, pathname = "/") {
  const base = pathWithoutLocale(pathname);
  const prefix = localePrefix(lang);
  if (base === "/") return prefix || "/";
  return `${prefix}${base}`;
}

/**
 * Même chose que `localePath`, préfixe de sous-dossier compris.
 *
 * À utiliser pour un `<a href>` ou une redirection : `next/link` ajoute
 * `basePath` tout seul et recevrait ici un chemin déjà préfixé, ce qui
 * produirait `/portfolio/portfolio/en`.
 *
 * @param {string} lang
 * @param {string} pathname
 * @returns {string}
 */
export function localeHref(lang, pathname = "/") {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  // Un chemin qui porterait déjà le préfixe ne doit pas le recevoir deux fois :
  // `/portfolio/portfolio/en` est un 404, et c'est exactement ce qu'un appelant
  // qui aurait déjà ajouté `basePath` produirait.
  const p = base && (pathname === base || pathname.startsWith(`${base}/`))
    ? pathname.slice(base.length) || "/"
    : pathname;
  return `${base}${localePath(lang, p)}`;
}

/**
 * L'autre langue que celle demandée.
 *
 * Sert au sélecteur : il n'affiche que la destination, jamais la langue
 * courante, donc il n'y a qu'une valeur à calculer. À deux langues c'est
 * simple ; le jour où il y en a trois, la langue demandée est écartée de la
 * liste, ce qui évite d'afficher « Français » à un visiteur déjà en français.
 *
 * @param {string} lang
 * @returns {string|undefined}
 */
export function otherLocale(lang) {
  return SUPPORTED_LOCALES.find((l) => l !== lang);
}

/**
 * Chemin équivalent d'une page dans l'autre langue.
 *
 * C'est ce que permet au sélecteur de langue de conserver la position du
 * visiteur : passer de `/en/projects` à `/projects` et non vers la racine, et de
 * `/` vers `/en`.
 *
 * @param {string} pathname - chemin courant, préfixe de langue compris.
 * @param {string} lang - langue courante.
 * @returns {string}
 */
export function switchLocalePath(pathname, lang) {
  const target = otherLocale(lang);
  if (!target) return pathname;
  return localePath(target, pathname);
}

/**
 * Variantes `hreflang` d'un chemin, pour les métadonnées et le sitemap.
 *
 * La clé est la langue telle qu'on l'écrit dans une URL (`fr`, `en`) et non le
 * tag `fr-FR` des Open Graph : c'est le format attendu par
 * `alternates.languages`, qui se sert de la clé pour construire le lien.
 *
 * @param {string} pathname - chemin sans préfixe de langue.
 * @returns {Record<string, string>}
 */
export function localeAlternates(pathname = "/") {
  const out = {};
  for (const l of SUPPORTED_LOCALES) out[l] = localePath(l, pathname);
  return out;
}