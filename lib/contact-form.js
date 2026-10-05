/**
 * Décisions du formulaire de contact, hors React.
 *
 * Le formulaire poste en direct vers Formspree, depuis le navigateur : il n'y a
 * donc aucun serveur entre le visiteur et le service. L'identifiant du formulaire
 * est par construction dans le bundle public — le retirer ne le cacherait à
 * personne, il faut juste assumer que le point d'entrée est public.
 *
 * Ce qui reste à protéger n'est pas l'adresse du formulaire, c'est la boîte
 * mail qu'elle alimente : sans filtre, une boucle de `fetch` la remplit de
 * messages 🥫, et Formspree suspend le formulaire au premier abusive.
 *
 * Les deux filtres ci-dessous sont ceux qui tiennent sans dépendance et sans
 * appel réseau — ils n'arrêtent pas un attaquant déterminé, ils lèvent la
 * barrière d'un script qui boucle. Le premier est le pot de miel : un champ que
 * le navigateur rend invisible et que le visiteur ne peut pas remplir, mais que
 * un script qui complète tous les champs remplira.
 */

/**
 * Durée minimale de remplissage, en millisecondes.
 *
 * Un humain met au moins ce temps à ouvrir l'onglet de contact, lire les
 * champs et écrire un message. Un script qui construit la requête
 * programmatiquement part en quelques millisecondes.
 *
 * 3 s est volontairement bas : une personne qui sait quoi écrire peut
 * commencer à taper immédiatement, et une valeur plus haute finirait par écarter
 * des messages légitimes. Ce seuil distingue le premier, ce n'est pas une
 * garantie.
 */
export const MIN_FILL_MS = 3_000;

/**
 * Bornes de longueur des champs, en caractères.
 *
 * Elles servent deux fois : le `maxLength` du HTML limite la saisie, et la même
 * valeur est passée à la vérification pour que le JS ne dépende pas du seul HTML
 * — un formulaire envoyé par `fetch` contourne `maxLength` sans effort.
 */
export const LIMITS = {
  name: 120,
  email: 200,
  message: 4_000,
};

/**
 * Motif d'une adresse e-mail, volontairement sommaire.
 *
 * Ce n'est pas une validation de délivrabilité — aucun motif ne l'est — mais
 * assez pour écarter une saisie manifestement fausse avant d'envoyer. Le champ
 * reste `type="email"`, donc le navigateur applique de son côté sa propre
 * validation, plus stricte que celle-ci.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Ce que le formulaire retient de sa propre saisie.
 *
 * @typedef {object} ContactDraft
 * @property {string} name
 * @property {string} email
 * @property {string} message
 * @property {string} [honeypot] - valeur du champ-piège
 * @property {number} [elapsedMs] - millisecondes écoulées depuis l'ouverture
 */

/**
 * Champ de formulaire non rempli par un humain : `maxlength`, `novalidate`,
 * `tabindex="-1"` et `autocomplete="off"`, comme le trap de Formspree.
 */
export const HONEYPOT_FIELD = "_gotcha";

/**
 * Le remplissage a-t-il l'allure d'un envoi automatique ?
 *
 * Les deux signaux sont indépendants et cumulables : un script peut respecter
 * le délai tout en remplissant le piège, et l'inverse.
 *
 * Un formulaire rempli en moins de `MIN_FILL_MS` n'est pas nécessairement un
 * robot — la restauration d'un formulaire par le navigateur, ou un mot de passe
 * qui remplit les champs, font ça. C'est pourquoi le résultat n'est pas un refus
 * : `contact-overlay.jsx` répond « envoyé » sans rien envoyer. Un robot qui
 * reçoit une confirmation ne réessaie pas, et un humain qui reçoit un faux
 * échec n'a qu'à renvoyer un message.
 *
 * @param {ContactDraft} draft
 * @returns {boolean}
 */
export function looksAutomated(draft) {
  const honeypot = typeof draft?.honeypot === "string" ? draft.honeypot.trim() : "";
  if (honeypot !== "") return true;

  // Un délai absent est traité comme trop court, pas comme « je ne sais rien,
  // donc je laisse passer ». L'absence de mesure ne prouve rien dans un sens
  // ni dans l'autre, donc l'arbitrage est une question de par défaut : quel est
  // le coût d'une erreur dans chaque sens. Se tromper ici n'a pas de conséquence
  // — le message n'est pas envoyé et le visiteur le renvoie — alors que laisser
  // passer un robot remplit la boîte mail et expose le formulaire à une
  // suspension du service.
  const elapsed = draft?.elapsedMs;
  if (typeof elapsed !== "number" || !Number.isFinite(elapsed)) return true;

  return elapsed < MIN_FILL_MS;
}

/**
 * Un formulaire est-il rempli de façon exploitable ?
 *
 * Séparé de `looksAutomated` parce que les deux se traduisent différemment : une
 * saisie incomplète doit être rendue au visiteur, puisqu'il peut la corriger ;
 * un piège doit être traité en silence, sinon il apprend à son auteur comment le
 * contourner.
 *
 * @param {ContactDraft} draft
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validateDraft(draft) {
  const name = (draft?.name ?? "").trim();
  const email = (draft?.email ?? "").trim();
  const message = (draft?.message ?? "").trim();

  if (!name) return { ok: false, error: "Indiquez votre nom." };
  if (name.length > LIMITS.name) {
    return { ok: false, error: `Votre nom est trop long (${LIMITS.name} caractères maximum).` };
  }

  if (!email) return { ok: false, error: "Indiquez votre adresse e-mail." };
  if (email.length > LIMITS.email) {
    return {
      ok: false,
      error: `Votre adresse e-mail est trop longue (${LIMITS.email} caractères maximum).`,
    };
  }
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Cette adresse e-mail semble incorrecte." };

  if (!message) return { ok: false, error: "Écrivez un message." };
  if (message.length > LIMITS.message) {
    return {
      ok: false,
      error: `Votre message est trop long (${LIMITS.message} caractères maximum).`,
    };
  }

  return { ok: true };
}

/**
 * Corps de la requête, sans le champ-piège.
 *
 * Le piège est retiré ici plutôt qu'à l'appel : l'envoyer à Formspree le ferait
 * remonter dans les notifications et dans les logs du service, et Formspree le
 * lit comme un signal d'abus — c'est le but, mais il ne faut pas payer le
 * postage du mensonge. Il n'est donc ni transmis ni journalisé.
 *
 * @param {ContactDraft} draft
 * @returns {{name: string, email: string, message: string}}
 */
export function buildPayload(draft) {
  return {
    name: (draft?.name ?? "").trim(),
    email: (draft?.email ?? "").trim(),
    message: (draft?.message ?? "").trim(),
  };
}