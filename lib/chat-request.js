/**
 * Cycle de vie d'une requête du panneau de discussion.
 *
 * Cette mécanique était dans `components/chat-widget.jsx`, où elle n'était pas
 * testable : les tests n'incluaient que `lib/` et `worker/src/` (le `include`
 * de `vitest.config.js`), donc aucun composant n'était monté, et les trois
 * propriétés ci-dessous n'étaient couvertes par rien. Ce module est leur
 * point de sortie — il ne connaît ni React, ni le DOM, ni le Worker.
 *
 * Ce qu'il faut couvrir, et pourquoi c'est invisible à l'écran :
 *
 * 1. **La course sur le contrôleur.** `abortRef.current = null` dans un
 *    `finally` inconditionnel : si un envoi plus récent avait pris la main, le
 *    `finally` de l'ancien effaçait sa référence. Ni la fermeture du panneau, ni
 *    le démontage ne pouvaient alors plus annuler la requête — elle allait au
 *    bout, consommait un jeton du quota du visiteur, et écrivait dans une
 *    conversation qui n'était plus la sienne.
 *
 * 2. **Le délai.** Le Worker borne ses appels sortants, mais sa borne s'arrête
 *    à l'arrivée des en-têtes : le flux qui suit n'est borné qu'en volume. Un
 *    amont ouvert et muet laissait donc l'interface en attente indéfiniment, avec
 *    une bulle vide et aucun message d'erreur.
 *
 * 3. **La distinction des deux causes d'annulation.** Fermeture du panneau et
 *    expiration du délai produisent la même `AbortError` : `fetch` ne les
 *    sépare pas. Traitées de la même façon, une panne du service s'affichait
 *    comme un geste du visiteur, donc en silence.
 */

/**
 * Délai maximal d'une requête, en millisecondes.
 *
 * Posé une fois par envoi, donc il couvre le `send` entier : le borner
 * tentative par tentative permettrait d'atteindre son multiple par le nombre de
 * relances.
 *
 * 40 s est très au-dessus du pire temps nominal du Worker (5 s pour le contenu
 * du site, 15 s pour les en-têtes d'inférence, plus la génération de 500
 * tokens), et assez bas pour que l'attente se lise comme un défaut plutôt que
 * comme un chargement.
 */
export const REQUEST_TIMEOUT_MS = 40_000;

/**
 * Crée le suivi d'une requête : contrôleur, délai, et réponse aux annulations.
 *
 * Un seul envoi est suivi à la fois, ce qui correspond à l'usage : le panneau
 * n'autorise qu'une requête à la fois (`busy`), et un envoi plus récent annule
 * le précédent. Conserver une pile n'aurait aucun utilisateur.
 *
 * @param {{timeoutMs?: number}} [options] - `timeoutMs` à 0 ou moins désactive
 *   le délai.
 * @returns {{
 *   begin: () => {signal: AbortSignal, timedOut: () => boolean, finish: () => void},
 *   isCurrent: (handle: object) => boolean,
 *   cancelCurrent: () => void
 * }}
 */
export function createRequestSlot(options = {}) {
  const { timeoutMs = REQUEST_TIMEOUT_MS } = options;

  /** @type {{signal: AbortSignal, timedOut: () => boolean, finish: () => void}|null} */
  let current = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /**
   * Démarre une requête, en prenant la place de la précédente.
   *
   * L'ancienne n'est pas annulée ici : c'est au composant de le faire s'il le
   * souhaite. `begin` enregistre seulement qui est le propriétaire, ce qui est
   * la moitié du contrat, et l'autre moitié est dans `finish`.
   */
  function begin() {
    // Le minuteur du serveur précédent est annulé ici, pas seulement dans
    // `finish`. Sans cela, un `begin` sans `finish` — c'est-à-dire un envoi
    // interrompu avant son `finally`, ce que fait le unmount ou une exception
    // synchrone au montage — laisserait son minuteur armé : il finirait par
    // annuler la requête *suivante*, ou pire, la laisser vivre sans rien
    // surveiller jusqu'au délai.
    clearTimer();

    const controller = new AbortController();
    let expired = false;

    // `timeoutMs <= 0` est traité comme « pas de délai » plutôt que comme un
    // délai nul : `setTimeout(fn, 0)` annulerait la requête au tick suivant,
    // donc chaque appel mourrait avant d'avoir envoyé quoi que ce soit.
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        expired = true;
        controller.abort();
      }, timeoutMs);
    }

    const handle = {
      signal: controller.signal,
      abort: () => controller.abort(),
      // `timedOut` distingue l'expiration d'une fermeture : les deux produisent
      // la même `AbortError`, mais seul le délai mérite un message au visiteur.
      timedOut: () => expired,
      /**
       * Fin normale ou par erreur. La comparaison à l'identité est la seule
       * chose qui distingue « je libère ma place » de « j'écrase la place de
       * quelqu'un d'autre » — donc de « j'annule par erreur une requête en vol ».
       */
      finish: () => {
        if (current !== handle) return;
        current = null;
        clearTimer();
      },
    };

    current = handle;
    return handle;
  }

  return {
    begin,
    isCurrent: (handle) => current === handle,
    /**
     * Annule la requête en vol et libère la place. Utilisé à la fermeture du
     * panneau, au reset, et au démontage.
     *
     * L'annulation part après la libération de la place, dans cet ordre : si le
     * `abort` déclenchait un gestionnaire qui appelle `finish` (cas d'un
     * composant qui se démonte en réaction), la place serait déjà libre et le
     * `finish` ne ferait rien — donc pas de double libération.
     */
    cancelCurrent: () => {
      const handle = current;
      if (!handle) return;
      current = null;
      clearTimer();
      handle.abort();
    },
  };
}