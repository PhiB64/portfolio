/**
 * Point d'entrée du contenu, par langue.
 *
 * Why cette indirection existe. Le contenu est passé de deux fichiers
 * (`fr.js`, `en.js`) à un seul appel : `getContent(lang)`. Aucun composant ne
 * connaît le nom d'un fichier de langue, donc ajouter une troisième langue
 * consiste à écrire `de.js` et à l'ajouter à `CONTENT` — sans toucher à une
 * seule ligne de rendu.
 *
 * La contrepartie est qu'il faut savoir ce que renvoie `getContent`, et c'est
 * ce que documente ce fichier. Le contrat tient en deux règles.
 *
 * **Les coordonnées sont hors langue.** `CONTACT` et `CONTACT_LOCATION` viennent
 * de `contact.js` et sont identiques dans les deux cas. Un composant doit donc
 * les lire sur le résultat de `getContent` comme les autres, sans se poser la
 * question de la langue : il n'y a rien à trancher.
 *
 * **`SUPPORTED_LOCALES` est l'unique source de vérité** sur les langues
 * existantes. Le `generateStaticParams` du layout, le sitemap et la redirection
 * de la racine s'en servent tous les trois, plutôt que d'écrire `"fr", "en"`
 * quelque part — sinon la liste dérive et une langue finit par manquer à un
 * endroit sans qu'aucune erreur ne le signale.
 *
 * L'indexation reste explicite plutôt que dynamique (`import.meta.glob` ou un
 * `require` calculé). Un bundler statique doit pouvoir voir les deux fichiers au
 * moment de la construction pour les inclure dans le `content.json` publié par
 * `scripts/build-chat-content.mjs` ; une résolution dynamique les ferait
 * disparaître au déploiement du Worker. La liste écrite à la main est ici le
 * prix de cette garantie, et il est le moins cher : deux entrées.
 */

import { CONTACT, CONTACT_LOCATION } from "./contact.js";
import { uiFor } from "./ui.js";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, resolveLocale } from "./locales.js";
import * as fr from "./fr.js";
import * as en from "./en.js";

/**
 * Langues livrées et langue par défaut.
 *
 * La définition est dans `locales.js`, qui n'importe aucun contenu : un
 * composant client a besoin de la liste pour router un lien et du repli pour
 * afficher un libellé, sans avoir à charger `fr.js` et `en.js` pour cela. Ces
 * deux noms restent exportés d'ici parce que c'est l'entry point du contenu,
 * là où les appelants les cherchent.
 */
export { SUPPORTED_LOCALES, DEFAULT_LOCALE };

/**
 * Contenu éditorial par langue.
 *
 * Chaque entrée contient exactement les mêmes exports que `fr.js`. C'est ce que
 * vérifie `parity.test.js`, qui compare les deux langues structurellement : sans
 * cette garantie, `getContent("en")` renverrait des `undefined` sur les rubriques
 * ajoutées côté français après coup, et la page anglaise afficherait des trous
 * sans lever la moindre erreur.
 */
const CONTENT = { fr, en };

/**
 * Contenu complet d'une langue : éditorial **et** coordonnées.
 *
 * L'ordre de fusion compte. Le contenu éditorial est appliqué en premier, les
 * coordonnées par-dessus : si un fichier de langue exportait par erreur un
 * `CONTACT`, il n'écraserait pas la source unique, et le site afficherait la même
 * adresse partout — le défaut qu'un déplacement de `CONTACT` hors de `fr.js`
 * cherchait précisément d'empêcher.
 */
export function getContent(lang) {
  const editorial = CONTENT[resolveLocale(lang)];
  return { ...editorial, CONTACT, CONTACT_LOCATION };
}

/**
 * Libellés d'interface de la langue demandée.
 *
 * Séparé de `getContent` volontairement. Le contenu éditorial est volumineux et
 * n'est lu que par les pages qui en ont besoin ; les libellés d'interface sont
 * petits et partagés par tous les composants. Les mélanger obligerait chaque
 * composant qui veut dire « Téléphone » à charger les six sections de projets
 * pour cela.
 *
 * `resolveLocale` est réutilisé tel quel : une langue inconnue doit produire le
 * même repli partout, sinon `/de` afficherait du français pour le contenu et de
 * l'anglais pour les boutons.
 *
 * @param {string} lang
 * @returns {typeof import("./ui.js").UI["fr"]}
 */
export function getUI(lang) {
  return uiFor(lang);
}

export { UI, uiFor } from "./ui.js";
export { CONTACT, CONTACT_LOCATION } from "./contact.js";