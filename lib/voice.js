/**
 * Voix du panneau de discussion : dictée et lecture, sans service externe.
 *
 * Les deux passent par la Web Speech API du navigateur (`SpeechRecognition`
 * pour la dictée, `speechSynthesis` pour la lecture) : aucun appel réseau,
 * aucune clé, aucun coût. Le texte transcrit remplit le brouillon existant et
 * suit le circuit d'envoi normal — le Worker ne voit qu'un message texte
 * comme un autre, il n'y a donc rien à changer côté backend.
 *
 * Ces aides vivent ici, hors du composant, pour deux raisons :
 *
 * - elles ne lisent que `window`, jamais React : elles sont testables en
 *   isolation (`voice.test.js`), alors que le widget ne l'est pas ;
 * - la détection se fait à l'exécution, jamais par user-agent : Firefox
 *   desktop n'expose pas `SpeechRecognition`, et un test de chaîne afficherait
 *   un micro qui ne transcrit rien. Sans constructeur, le bouton reste masqué.
 *
 * Limites assumées : HTTPS requis (OK en local et sur Vercelle), support
 * inégal (Chrome, Edge, Safari avec préfixe `webkit`), et transcription
 * confiée au moteur du navigateur — d'où le choix de remplir le brouillon
 * plutôt que d'envoyer directement, pour laisser le visiteur relire.
 */

/**
 * Locale BCP 47 parlée et transcrite pour une langue du site.
 *
 * `fr` → `fr-FR`, tout le reste → `en-US` : l'anglais est la langue par
 * défaut (`lib/content/locales.js`), une langue inconnue parle donc anglais
 * plutôt que de se taire.
 *
 * @param {string} lang
 * @returns {string}
 */
export function speechLocale(lang) {
  return lang === "fr" ? "fr-FR" : "en-US";
}

/**
 * Constructeur de reconnaissance vocale, préfixe Safari compris.
 *
 * `null` quand l'API manque (Firefox desktop, SSR) : c'est ce `null` qui
 * masque le bouton micro, jamais une erreur affichée au visiteur.
 *
 * @returns {object|null}
 */
export function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/**
 * La dictée est-elle proposable ?
 *
 * @returns {boolean}
 */
export function isRecognitionSupported() {
  return getRecognitionCtor() !== null;
}

/**
 * La lecture vocale est-elle proposable ?
 *
 * Les deux moitiés sont exigées : un `speechSynthesis` sans constructeur
 * d'énoncé ne peut rien lire, et inversement.
 *
 * @returns {boolean}
 */
export function isSynthesisSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
}

/**
 * Voix de synthèse la plus proche de la langue du visiteur.
 *
 * D'abord l'exacte (`fr-FR`, `en-US`), sinon la première de la langue
 * (`fr-CA`, `en-GB`), sinon `null` pour laisser le navigateur choisir avec
 * la `lang` posée sur l'énoncé. Les voix sans `lang` sont ignorées : sans
 * langue on ne peut pas savoir ce qu'elles parlent.
 *
 * @param {Array<{lang?: string}>} voices
 * @param {string} lang
 * @returns {{lang?: string}|null}
 */
export function pickVoice(voices, lang) {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const want = lang === "fr" ? "fr" : "en";
  const exact = `${want}-${want === "fr" ? "FR" : "US"}`.toLowerCase();
  const tagged = voices.filter((voice) => typeof voice?.lang === "string");
  const exactMatch = tagged.find((voice) => voice.lang.toLowerCase() === exact);
  if (exactMatch) return exactMatch;
  return tagged.find((voice) => voice.lang.toLowerCase().startsWith(want)) ?? null;
}
