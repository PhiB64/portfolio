/**
 * Lignes de fuite émises par les modèles raisonneurs avant leur réponse.
 *
 * Certains modèles du routeur `:free` éventuent une ou plusieurs lignes de
 * métadonnée interne dans `delta.content`, avant leur vraie réponse. Le front
 * les afficherait telles quelles en tête de bulle. C'est un défaut d'affichage,
 * pas une fuite de sécurité : le contenu est filtré, jamais transmis au visiteur.
 *
 * Les formats relevés, tous observés en production :
 *
 *     User Safety: safe
 *     Response Safety: safe
 *     Safety Categories: PII/Privacy, Needs Caution
 *
 * Les deux suivants sont apparus après `User Safety`, sur un autre modèle du
 * pool : `openrouter/free` est un routeur, son catalogue change sans que le code
 * change. Une liste de préfixes ne survit pas à ça — d'où la règle ci-dessous,
 * qui ne dépend d'aucun format particulier.
 *
 * On filtre la ligne entière plutôt que la sous-chaîne, pour ne pas rogner une
 * réponse qui citerait ces mots par hasard.
 */

/**
 * Vocabulaire des labels de modération.
 *
 * Une fuite a toujours la forme « label: valeur », et c'est le **label** qui la
 * trahit, jamais la valeur : la valeur change d'un modèle à l'autre — `safe`,
 * `blocked`, `PII/Privacy`, `Needs Caution` — beaucoup moins que le label.
 *
 * Le motif ne retient donc que le mot isolé `safety` ou `moderation`, avec ses
 * frontières explicites : `^` ou espace / tiret / tiret bas. C'est ce qui
 * distingue « Safety Categories: … », qui est une fuite, de « Categories: … »,
 * qui est une réponse et doit passer.
 */
const LEAK_LABEL_RE = /(?:^|[ _-])(?:safety|moderation)(?:$|[ _-])/i;

/**
 * Au-delà de cette longueur, le label en cours est abandonné : une fuite est une
 * paire, donc un label qui s'étire sans deux-points n'en est pas une.
 *
 * Sans cette borne, une réponse dont la première ligne n'a aucun deux-points —
 * une phrase, un paragraphe — resterait retenue jusqu'à la fin du flux : le
 * visiteur verrait une bulle vide puis le texte d'un coup.
 */
const LEAK_MAX_HOLD = 40;

/**
 * La ligne est-elle une fuite de modération ?
 *
 * Le deux-points est obligatoire, et c'est lui qui borne la retenue. Cette
 * exigence protège de la faute qui ferait le plus de dégâts, supprimer une
 * réponse légitime : « This is a safety feature. » ne contient aucun
 * deux-points, son label ne peut donc pas être celui d'une fuite, et la ligne
 * part au visiteur intacte.
 *
 * @param {string} line
 * @returns {boolean}
 */
function isLeakLine(line) {
  const colon = line.indexOf(":");
  if (colon < 0) return false;
  return LEAK_LABEL_RE.test(line.slice(0, colon));
}

/**
 * Filtre les lignes de fuite d'un texte reçu fragment par fragment.
 *
 * Le flux est rendu au fil de l'eau, mais un delta peut couper une ligne en
 * deux : « Response » puis « Safety: safe ». On retient donc le début de chaque
 * ligne jusqu'au moment où la ligne peut être jugée, et ce moment est le
 * **deux-points** : c'est lui qui rend le label complet. Avant lui, on ne peut
 * rien conclure ; après lui, la ligne est soit une fuite, soit une ligne
 * ordinaire, et plus jamais les deux à la fois.
 *
 * Trois états, un par position de la ligne courante :
 *
 * - `pending` : on accumule, on n'a pas encore tranché ;
 * - `pass` : ligne rendue, le reste passe en direct jusqu'au retour à la ligne ;
 * - `drop` : ligne rejetée, on l'avale en silence jusqu'au retour à la ligne.
 *
 * `drop` est distinct de `pending` pour une raison précise : une fuite dont la
 * valeur dépasse `LEAK_MAX_HOLD` doit continuer d'être avalée. Un seul booléen
 * « cette ligne ressemble à une fuite » la ferait réapparaître au plafond.
 *
 * Le résidu est vidé par `flush()` en fin de flux : sans cela, une réponse sans
 * retour à la ligne à la fin disparaîtrait.
 *
 * @returns {{ push: (delta: string) => string, flush: () => string }}
 */
export function createLeakFilter() {
  // Début de la ligne courante, non encore rendue, et verdict courant.
  let hold = "";
  let state = "pending";

  return {
    /** @param {string} delta */
    push(delta) {
      let out = "";

      for (const char of delta) {
        if (state === "pass") {
          out += char;
          // Cette ligne-ci est déjà validée, mais la suivante doit être jugée pour
          // elle-même. Le saut de ligne est le seul endroit où on l'apprend.
          if (char === "\n") state = "pending";
          continue;
        }

        if (state === "drop") {
          if (char === "\n") state = "pending";
          continue;
        }

        hold += char;

        // Fin de ligne : le label est complet et n'a pas été jugé, on le juge donc
        // sur l'ensemble. Sans deux-points, `isLeakLine` rend faux par construction,
        // mais on garde la décision au même endroit dans tous les cas, au cas où
        // l'ordre des tests changerait un jour.
        if (char === "\n") {
          if (!isLeakLine(hold)) out += hold;
          hold = "";
          state = "pending";
          continue;
        }

        // Le deux-points arrive : le label est complet, c'est le seul moment où la
        // ligne peut être jugée. Lui-même est rendu si la ligne est ordinaire.
        if (char === ":") {
          const held = hold;
          hold = "";
          if (isLeakLine(held)) {
            state = "drop";
          } else {
            state = "pass";
            out += held;
          }
          continue;
        }

        // Un label qui s'étire sans deux-points n'est pas une paire, donc pas une
        // fuite. Sans cette borne, une réponse dont la première ligne n'a aucun
        // deux-points resterait retenue jusqu'à la fin du flux.
        if (hold.length >= LEAK_MAX_HOLD) {
          out += hold;
          hold = "";
          state = "pass";
        }
      }

      return out;
    },

    /** Rend la ligne en attente, au cas où le flux s'arrête sans retour à la ligne. */
    flush() {
      // La ligne s'arrête ici sans retour à la ligne : elle est complète, le même
      // test que pour une ligne close s'applique donc. Une fuite en fin de flux
      // n'a pas eu son retour à la ligne, sans ce test elle passerait en entier.
      const out = state === "drop" ? "" : hold;
      hold = "";
      state = "pass";
      return out;
    },
  };
}