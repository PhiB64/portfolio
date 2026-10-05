/**
 * Point d'entrée historique du contenu — **ne pas importer depuis ici**.
 *
 * Ce fichier a été déplacé dans `lib/content/` pour héberger plusieurs langues.
 * Il n'existe plus que comme ré-export du français, le temps que les appelants
 * passent par `lib/content/index.js` (`getContent(lang)`).
 *
 * Pourquoi ne pas tout migrer d'un coup. `lib/chat-digest.test.js` et
 * `worker/src/index.js` importent ce chemin, et le premier contient des
 * assertions sur des chaînes françaises exactes. Supprimer le chemin d'un coup
 * ferait échouer les tests sur une simple erreur de specifier d'import, ce qui
 * masque les vraies erreurs de traduction : on préfère voir le rougevenir du
 * contenu, pas du bruit de mécanique.
 *
 * Deux points à savoir avant de s'en servir :
 *
 * - ce ré-export ne couvre que le **français**. Un appelant qui a besoin de la
 *   langue de la page doit passer par `getContent(lang)` ;
 * - `CONTACT` et `CONTACT_LOCATION` viennent de `contact.js` et sont donc
 *   valables pour toutes les langues. Ils sont ré-exportés ici parce que
 *   `app/layout.js` (JSON-LD) et `worker/src/index.js` n'ont aucune raison de
 *   choisir une langue pour lire une adresse e-mail.
 */

export { CONTACT, CONTACT_LOCATION } from "./content/contact.js";

export {
  PROJECT_CONTENT,
  CAREER_CONTENT,
  STACK_CONTENT,
  USAGE_CONTENT,
} from "./content/fr.js";