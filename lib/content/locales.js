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
 * Le repli est silencieux par choix : une langue inconnue sert la langue
 * d'origine et la page reste lisible. Lever une erreur ferait tomber `/de` en
 * 404 alors que le contenu français est parfaitement affichable.
 */

/** Langues livrées, dans l'ordre où le site les propose. */
export const SUPPORTED_LOCALES = ["fr", "en"];

/** La langue par défaut, celle servie à la racine et déclarée aux moteurs. */
export const DEFAULT_LOCALE = "fr";

/**
 * La langue demandée si elle existe, sinon celle par défaut.
 *
 * @param {string} lang
 * @returns {string}
 */
export function resolveLocale(lang) {
  return SUPPORTED_LOCALES.includes(lang) ? lang : DEFAULT_LOCALE;
}