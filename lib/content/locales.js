/**
 * Les langues du site, et le repli entre elles.
 *
 * Why ce fichier est isolé. `lib/content/index.js` importe `fr.js` et `en.js` en
 * entier. Un composant client qui n'a besoin que du libellé « Téléphone » ne
 * doit pas traîner les six sections de projets derrière lui : il lèverait le
 * poids du contenu éditorial dans le bundle navigateur pour deux chaînes. Les
 * deux seuls éléments dont un composant client a besoin — la liste des langues et
 * la fonction de repli — vivent donc ici, sans aucun import de contenu.
 *
 * `index.js` réexporte les deux constantes pour que les appelants continuent de
 * les prendre à l'entry point du contenu ; ce module est l'unique définition.
 *
 * Le repli est silencieux par choix : une langue inconnue sert la langue par
 * défaut et la page reste lisible. Lever une erreur ferait tomber `/de` en 404
 * alors que le contenu anglais est parfaitement affichable.
 */

/**
 * Langues livrées, dans l'ordre où le site les propose.
 *
 * L'anglais d'abord parce qu'il est la langue par défaut : cette liste est
 * aussi ce qui décide de l'ordre du sélecteur de langue et des entrées du
 * sitemap, et faire apparaître la langue par défaut en premier évite qu'un
 * lecteur bent les yeux ailleurs que là où le site s'ouvre.
 */
export const SUPPORTED_LOCALES = ["en", "fr"];

/**
 * La langue par défaut, celle servie à la racine et déclarée aux moteurs.
 *
 * C'est l'anglais : le portfolio s'ouvre en anglais. Cette constante est le seul
 * endroit qui le décide — `localePrefix` en déduit le préfixe d'URL, le
 * `x-default` des métadonnées, la priorité du sitemap et le digest de repli du
 * chat. Changer de langue par défaut se fait donc ici, et nulle part ailleurs.
 */
export const DEFAULT_LOCALE = "en";

/**
 * La langue demandée si elle existe, sinon celle par défaut.
 *
 * @param {string} lang
 * @returns {string}
 */
export function resolveLocale(lang) {
  return SUPPORTED_LOCALES.includes(lang) ? lang : DEFAULT_LOCALE;
}