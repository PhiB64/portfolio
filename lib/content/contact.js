/**
 * Coordonnées et identité de Philippe — **invariant de langue**.
 *
 * Pourquoi ce fichier est séparé du contenu traduit. Tout ce qu'il contient est
 * soit une donnée factuelle (adresse e-mail, téléphone, liens), soit un nom propre
 * (« Lons », « Pyrénées-Atlantiques »). Aucun de ces éléments n'a de traduction
 * anglaise : les traduire reviendrait à inventer des coordonnées.
 *
 * Conséquence sur le plan de travail : une seule source pour toutes les langues,
 * donc aucune coordonnée ne peut diverger entre la page française et la page
 * anglaise. `worker/src/index.js` continue d'importer `CONTACT` d'ici, et son
 * repli `fallbackStream` reste juste dans les deux langues sans duplication.
 *
 * Il faut toutefois garder cette invariant en tête si une langue est ajoutée :
 * elle ne s'étend pas. Un contenu propre à une locale (une accroche, un libellé
 * d'onglet) appartient dans `fr.js` / `en.js`, jamais ici.
 */

/** (Le bloc de coordonnées est déplacé ici tel quel, sans modification.) */
/**
 * Coordonnées de Philippe — source unique.
 *
 * Elles étaient écrites en dur à cinq endroits : `components/contact-overlay.jsx`
 * (constante locale), `app/layout.js` (JSON-LD), `USAGE_CONTENT` ci-dessous,
 * le repli du Worker (`fallbackStream`) et le README. Changer d'adresse
 * n'en changeait qu'un, et rien ne le signalait — le visiteur pouvait écrire à
 * une adresse périmée pendant que le JSON-LD en annonçait une autre aux
 * moteurs.
 *
 * Le repli du Worker est le cas le plus sensible : il s'affiche quand le site
 * est injoignable, donc quand personne ne peut vérifier l'adresse. Il importe
 * ce bloc au lieu de le recopier — esbuild l'inline au déploiement, et le
 * Worker n'a toujours rien à charger au moment de la requête.
 *
 * Chaque champ est un littéral, jamais une valeur dérivée au moment de l'appel :
 * `phoneDisplay` est formaté pour l'œil, `phoneHref` pour `tel:`, et
 * `phoneInternational` pour le JSON-LD. Les trois sont différents à dessein.
 *
 * La localité est la seule exception : `CONTACT_LOCATION` en tire la ligne
 * affichée, parce que le JSON-LD a besoin de `city`, `region` et
 * `departmentCode` séparément.
 */
export const CONTACT = {
  email: "philippebarbosa64@gmail.com",
  phoneDisplay: "06 51 30 59 16",
  phoneHref: "tel:0651305916",
  phoneInternational: "+33651305916",
  githubUrl: "https://github.com/PhiB64",
  githubLabel: "github.com/PhiB64",
  linkedinUrl: "https://www.linkedin.com/in/philippe-barbosa/",
  linkedinLabel: "linkedin.com/in/philippe-barbosa",
  city: "Lons",
  region: "Pyrénées-Atlantiques",
  departmentCode: "64",
};

/** Localité, telle qu'affichée dans l'écran CONTACT. */
export const CONTACT_LOCATION = `${CONTACT.city} · ${CONTACT.region} (${CONTACT.departmentCode})`;
