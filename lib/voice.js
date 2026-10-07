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
 * Texte préparé pour la synthèse vocale, affichage inchangé.
 *
 * Deux corrections, sinon la lecture surprend :
 *
 * - `CV` en français se prononce « chevaux » (chevaux-vapeur) : on l'espace
 *   en `C V` pour forcer l'épellation « cé vé ». Réservé au français, l'anglais
 *   épelle déjà correctement.
 * - `@` se prononce « at » ou se tait selon la voix : on l'écrit `arobase`
 *   en français, `at` en anglais, pour que les adresses e-mail se comprennent.
 *
 * Le remplacement de `@` ajoute des espaces, repliées ensuite : sans ça,
 * `a@gmail.com` deviendrait `a arobase gmail.com` avec des doubles espaces.
 *
 * @param {unknown} text texte déjà nettoyé du Markdown.
 * @param {string} lang
 * @returns {string}
 */
export function speakableText(text, lang) {
  if (typeof text !== "string" || text.length === 0) return "";
  let out = text;
  // Les adresses ne se parlent pas : « https deux-points slash slash » est
  // inaudible et inutile sans lien cliquable. On les retire avant lecture —
  // l'affichage garde le texte d'origine, seule la voix est nettoyée.
  // L'e-mail est préservé : aucun motif ci-dessous ne touche `gmail.com`
  // isolé, seul le `@` est réécrit plus bas en `arobase` / `at`.
  out = out
    .replace(/https?:\/\/[^\s)"'«»\]]+/gi, " ")
    .replace(/\bwww\.[^\s)"'«»\]]+/gi, " ")
    .replace(
      /\b(?:github\.com|linkedin\.com|documenter\.getpostman\.com|vercel\.app|netlify\.app|sup-saintdominique\.fr)[^\s)"'«»\]]*/gi,
      " ",
    )
    .replace(/[^\s)"'«»\]]*\?project=\d+[^\s)"'«»\]]*/gi, " ")
    .replace(/[^\s)"'«»\]]*\/cv\.pdf[^\s)"'«»\]]*/gi, " ")
    .replace(/\(\s*\)/g, " ");
  if (lang === "fr") {
    // `\b` : `CV` isolé seulement, `cave` reste intact.
    out = out.replace(/\bCV\b/gi, "C V");
    out = out.replace(/@/g, " arobase ");
  } else {
    out = out.replace(/@/g, " at ");
  }
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/**
 * Normalise une transcription pour comparaison à une commande vocale.
 *
 * Minuscules, accents retirés, ponctuation aplatie : « Arrête ! » et
 * « arrete » donnent le même `arrete`. Sans ça, chaque variante
 * exigerait son entrée dans la liste.
 *
 * @param {unknown} text
 * @returns {string}
 */
function normalizeCommand(text) {
  if (typeof text !== "string") return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[…?!.,;:()«»"'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Commandes d'arrêt de la boucle mains libres, par langue, déjà normalisées
 * (voir `normalizeCommand` : minuscules, sans accents).
 *
 * Liste volontairement fermée et exacte : un test en `includes("stop")`
 * arrêterait la boucle sur « peux-tu me parler du stop du cube ? », qui
 * contient le mot sans être un ordre. Dire `stop` seul coupe, le reste part
 * au modèle.
 *
 * Les deux listes sont vérifiées quelle que soit la langue de la page : un
 * visiteur sur la page française peut dire `quit`, un visiteur sur la page
 * anglaise peut dire `quitter` — la reconnaissance vocale transcrit ce
 * qu'elle entend, pas la langue de l'interface.
 */
const STOP_COMMANDS = {
  fr: new Set([
    "stop",
    "arrete",
    "arreter",
    "termine",
    "terminer",
    "quitter",
    "au revoir",
    "stop la conversation",
    "arrete la conversation",
    "arreter la conversation",
    "termine la conversation",
    "terminer la conversation",
    "quitter la conversation",
  ]),
  en: new Set([
    "stop",
    "quit",
    "exit",
    "bye",
    "goodbye",
    "stop conversation",
    "end conversation",
    "quit conversation",
    "exit conversation",
  ]),
};

/**
 * La transcription est-elle un ordre d'arrêt de la boucle mains libres ?
 *
 * Bilingue : les listes française et anglaise sont toutes deux vérifiées,
 * quelle que soit la langue de la page. Une politesse en bordure
 * (« s'il te plaît stop », « stop please ») ne change pas l'ordre : elle est
 * retirée avant comparaison, dans les deux langues. En revanche un ordre noyé
 * dans une phrase (« peux-tu stopper ? ») n'en est pas un et part au modèle —
 * c'est ce qui évite les faux positifs.
 *
 * @param {unknown} text transcription finale du moteur.
 * @param {unknown} [_lang] langue de la page, ignorée : gardée pour
 * compatibilité avec les appelants existants.
 * @returns {boolean}
 */
export function isStopCommand(text, _lang) {
  void _lang;
  const norm = normalizeCommand(text);
  if (!norm) return false;
  if (STOP_COMMANDS.fr.has(norm) || STOP_COMMANDS.en.has(norm)) return true;
  const polite = norm
    .replace(/^(s il te plait|s il vous plait|stp|please)\s+/g, "")
    .replace(/\s+(s il te plait|s il vous plait|stp|please)$/g, "")
    .trim();
  return (
    polite !== norm &&
    (STOP_COMMANDS.fr.has(polite) || STOP_COMMANDS.en.has(polite))
  );
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
 * Voix de synthèse la plus proche de la langue du visiteur, timbre masculin
 * quand le navigateur en propose un.
 *
 * Ordre de choix, à langue (`fr`, `en`) égale : masculine exacte (`fr-FR`,
 * `en-US`), puis masculine de la langue (`fr-CA`, `en-GB`), puis exacte,
 * puis première de la langue, sinon `null` pour laisser le navigateur choisir
 * avec la `lang` posée sur l'énoncé. Le genre prime sur l'accent régional :
 * une page anglaise préfère un `en-GB` masculin à un `en-US` féminin.
 * Les voix sans `lang` sont ignorées : sans langue on ne peut pas savoir ce
 * qu'elles parlent.
 *
 * Le genre se devine par le `name` (l'API n'expose rien d'autre) : `Male`,
 * `homme`, ou un prénom masculin courant (`Thomas`, `Daniel`, `George`…).
 * Sans indice masculin, on garde le comportement précédent — jamais de
 * silence, toujours une voix parlante.
 *
 * @param {Array<{lang?: string, name?: string}>} voices
 * @param {string} lang
 * @returns {{lang?: string, name?: string}|null}
 */
const MALE_VOICE_TOKENS = new Set([
  "male",
  "man",
  "homme",
  "masculin",
  "thomas",
  "paul",
  "daniel",
  "david",
  "alex",
  "fred",
  "george",
  "james",
  "guy",
  "michel",
  "nicolas",
  "julien",
  "pierre",
  "jean",
  "jacques",
  "marc",
  "mark",
  "henri",
  "antoine",
  "hugo",
  "louis",
  "gabriel",
  "adam",
  "arthur",
  "victor",
  "maxime",
  "alexis",
  "alain",
  "bernard",
  "claude",
  "francois",
  "françois",
  "gerard",
  "gérard",
  "marcel",
  "olivier",
  "oliver",
  "philippe",
  "rene",
  "rené",
  "thierry",
  "vincent",
  "yves",
  "christophe",
  "christopher",
  "henry",
  "samuel",
  "leo",
  "léo",
  "anthony",
  "andrew",
  "brian",
  "charlie",
  "edward",
  "frank",
  "harry",
  "jack",
  "john",
  "michael",
  "peter",
  "robert",
  "ryan",
  "scott",
  "sean",
  "steven",
  "stephen",
  "tom",
  "william",
  "aaron",
  "davis",
  "nathan",
  "kevin",
  "jason",
  "matthew",
  "donald",
  "richard",
  "kenneth",
  "jonathan",
  "nicholas",
  "patrick",
  "dennis",
]);

const FEMALE_VOICE_TOKENS = new Set([
  "female",
  "femme",
  "feminine",
  "féminine",
  "woman",
  "girl",
]);

/**
 * Le nom de la voix évoque-t-il un timbre masculin ?
 *
 * Découpe insensible à la casse sur tout ce qui n'est pas une lettre, puis
 * compare des jetons entiers : `Samantha` ne contient jamais le jeton `man`,
 * `Female` n'est jamais lue comme `male`. Un indice féminin explicite
 * l'emporte toujours sur un prénom ambigu.
 *
 * @param {unknown} name
 * @returns {boolean}
 */
function isMasculineVoice(name) {
  if (typeof name !== "string" || name.length === 0) return false;
  const tokens = name.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (tokens.some((token) => FEMALE_VOICE_TOKENS.has(token))) return false;
  return tokens.some((token) => MALE_VOICE_TOKENS.has(token));
}

export function pickVoice(voices, lang) {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const want = lang === "fr" ? "fr" : "en";
  const exact = `${want}-${want === "fr" ? "FR" : "US"}`.toLowerCase();
  const tagged = voices.filter((voice) => typeof voice?.lang === "string");
  const exactVoices = tagged.filter(
    (voice) => voice.lang.toLowerCase() === exact,
  );
  const masculineExact = exactVoices.find((voice) =>
    isMasculineVoice(voice?.name),
  );
  if (masculineExact) return masculineExact;
  const languageVoices = tagged.filter((voice) =>
    voice.lang.toLowerCase().startsWith(want),
  );
  const masculineLanguage = languageVoices.find((voice) =>
    isMasculineVoice(voice?.name),
  );
  if (masculineLanguage) return masculineLanguage;
  if (exactVoices[0]) return exactVoices[0];
  return languageVoices[0] ?? null;
}
