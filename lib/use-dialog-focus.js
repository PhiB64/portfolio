"use client";

import { useEffect, useRef } from "react";

// Piège de focus pour les deux overlays plein écran (rubrique projet, page
// contact). Avant ce module, ces deux surfaces n'avaient ni `role="dialog"`,
// ni `aria-modal`, ni Échap, ni retour du focus : un visiteur au clavier qui
// ouvrait une rubrique pouvait la refermer seulement en rebouclant jusqu'au
// bouton placé dessous, et la tabulation continuait de traverser le contenu
// masqué derrière l'overlay.
//
// Le `role` et `aria-modal` restent posés dans le JSX de chaque overlay : ce
// hook ne s'occupe que de la mécanique du focus, qui est identique partout.

// Sélecteur volontairement large : la décision de savoir ce qui est
// réellement focusable est prise dans le filtre, pas dans la requête. Écrire
// `button:not([disabled])` dans le sélecteur paraît plus simple, mais laisse
// passer un `button[tabindex="-1"]` — donc un bouton masqué par `tabIndex`, ce
// que le cube fait sur CONTACT et SKIP.
const FOCUSABLE_SELECTOR = "a[href], button, input, select, textarea, [tabindex]";

// Un contrôle désactivé ou en `tabindex="-1"` n'est plus dans l'ordre de
// tabulation : `tabIndex` vaut alors -1, et c'est cette propriété qu'on
// interroge plutôt que la présence d'attributs. `input[type=hidden]` passe par là
// tout seul, mais le test explicite garde le comportement garanti même sur un DOM
// qui ne refléterait pas `tabIndex` (JSDOM notamment).
const isFocusable = (el) =>
  el.tabIndex >= 0 && !el.disabled && el.type !== "hidden";

// `offsetParent` est null sur un élément `position: fixed` — c'est le cas de
// plusieurs contrôles de ces overlays (barre du haut en `fixed`, bouton retour
// en haut) — et il est null sur tout élément sous un `display: none`. On passe
// donc par le style calculé.
//
// `getClientRects()` serait plus fidèle, mais c'est une mesure de layout : JSDOM
// n'en calcule aucune, donc tous les éléments y seraient invisibles et le
// piège ne retiendrait rien. Le style calculé suffit ici : ce qu'on cherche à
// écarter, ce sont les `hidden` de Tailwind (`display: none`) et les éléments
// en `visibility: hidden`.
//
// `opacity: 0` n'est volontairement pas traité : un élément en cours de fondu
// reste focusable, et l'exclure ferait scintiller la tabulation pendant les
// transitions. Les boutons du cube qui doivent vraiment disparaître (CONTACT,
// SKIP, onglets non révélés) sont sortis par `tabIndex={-1}`, que `isFocusable`
// filtre déjà — pas par l'opacité.
const isVisible = (el) => {
  if (!el || el.hidden) return false;
  const view = el.ownerDocument.defaultView;
  if (!view?.getComputedStyle) return true;
  const style = view.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
};

// Liste les éléments focusables du dialogue, dans l'ordre du DOM.
export const focusableWithin = (root) => {
  if (!root?.querySelectorAll) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => isFocusable(el) && isVisible(el),
  );
};

/**
 * Contrôles qui restent tabulables alors qu'un overlay modal est ouvert.
 *
 * Pourquoi cette exception existe. Le panneau de l'assistant passe au-dessus
 * des deux overlays : il est donc visible pendant qu'ils sont ouverts. Or le
 * piège de focus ne fait boucler que l'intérieur du dialogue — c'est tout son
 * principe — donc le lanceur du chat serait atteignable à la souris et jamais à
 * la Tab. Un bouton visible que le clavier ne peut pas atteindre est un échec de
 * 2.1.1, et il n'apparaît sur aucune capture : seul un test au clavier le voit.
 *
 * Le mécanisme est un registre, pas une prop. `ChatWidget` vit dans le layout,
 * `HeroCube` dans la page : aucun des deux ne connaît l'autre, et les relier
 * par une prop ferait remonter une ref à travers les deux overlays. Un registre
 * partagé est le seul canal qui ne crée pas de dépendance.
 *
 * `Set` et non tableau : plusieurs widgets peuvent s'exempter en même temps, et
 * le démontage de l'un ne doit pas invalider l'autre.
 */
const exemptNodes = new Set();

/** Focusables d'un nœud, la racine comprise si elle est elle-même focusable. */
const focusableFrom = (root) => [
  ...(isFocusable(root) && isVisible(root) ? [root] : []),
  ...focusableWithin(root),
];

/** Les focusables de tous les nœuds exemptés, dans l'ordre d'inscription. */
export const exemptFocusables = () =>
  Array.from(exemptNodes).flatMap((node) =>
    // Un nœud démonté reste référencé jusqu'au nettoyage de l'effet ; le filtrer
    // ici évite de faire parcourir un `disconnected`.
    node.isConnected ? focusableFrom(node) : [],
  );

/**
 * Déclare un ou des nœuds focusables comme restant tabulables sous un overlay.
 *
 * L'effet n'a pas de tableau de dépendances : la ref est lue au montage et suivie
 * jusqu'au démontage. Rejouer l'effet à chaque rendu poserait et retirerait
 * l'inscription en boucle — le `Set` s'en remettrait, mais le cycle de Tab serait
 * recalculé pour rien à chaque frappe du chatbot.
 *
 * @param {object|object[]} ref(s) ref(s) React vers le ou les nœuds à exempter
 */
export function useFocusExempt(ref) {
  const refs = Array.isArray(ref) ? ref : [ref];
  useEffect(() => {
    const nodes = refs.map((r) => r?.current).filter(Boolean);
    if (nodes.length === 0) return;
    nodes.forEach((node) => exemptNodes.add(node));
    return () => nodes.forEach((node) => exemptNodes.delete(node));
  });
}

/**
 * Piège de focus + Échap pour un overlay modal.
 *
 * @param {boolean} open          l'overlay est-il monté ?
 * @param {object} containerRef   ref du nœud dialog (celui qui porte le `role`)
 * @param {() => void} onClose    fermeture demandée par Échap
 * @param {object} [options]
 * @param {boolean} [options.enabled=true] false pour ne brancher que le focus
 *        initial et sa restauration, sans piège ni Échap (déjà gérés ailleurs).
 */
export function useDialogFocus(open, containerRef, onClose, { enabled = true } = {}) {
  // Élément qui avait le focus à l'ouverture : le focus y revient à la
  // fermeture, sinon la tabulation repart du haut du document et le visiteur
  // perd sa place.
  const restoreRef = useRef(null);

  // `onClose` est recréé à chaque rendu (arrow function dans le JSX). Le garder
  // dans une ref évite de réarmer le piège — et donc de reprendre le focus — à
  // chaque frappe dans un champ du formulaire.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const node = containerRef.current;
    if (!node) return;

    restoreRef.current =
      node.ownerDocument.activeElement instanceof node.ownerDocument.defaultView.HTMLElement
        ? node.ownerDocument.activeElement
        : null;

    // Focus initial : le premier focusable du dialogue. `requestAnimationFrame`
    // car à ce moment le contenu vient d'être monté et l'overlay peut encore
    // être en `opacity: 0`.
    const view = node.ownerDocument.defaultView;
    const raf = view.requestAnimationFrame(() => {
      const first = focusableWithin(node)[0] ?? node;
      first.focus?.({ preventScroll: true });
    });

    if (!enabled) return () => view.cancelAnimationFrame?.(raf);

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      // Le cycle joint les focusables du dialogue et ceux des nœuds exemptés : le
      // panneau de l'assistant est au-dessus de l'overlay et doit rester
      // atteignable, sans quoi la Tab ne pourrait plus en sortir. Les exemptions
      // viennent APRÈS : l'ordre du DOM est respecté à l'intérieur de chaque
      // groupe, et l'overlay reste le point d'entrée du cycle.
      const inDialog = focusableWithin(node);
      const extras = exemptFocusables();
      const items = [...inDialog, ...extras];
      // Aucun contrôle focusable : on piège quand même le focus sur le dialogue
      // lui-même, pour qu'il ne reparte pas sur la page derrière.
      if (items.length === 0) {
        event.preventDefault();
        node.focus?.({ preventScroll: true });
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = node.ownerDocument.activeElement;

      // Tab depuis le dernier contrôle reboucle sur le premier, Shift+Tab depuis
      // le premier reboucle sur le dernier. Sans ce cas, le focus sort du
      // dialogue par le bas ou par le haut.
      if (event.shiftKey && (current === first || current === node)) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
        return;
      }

      // La jonction entre le dialogue et les widgets au-dessus est un SECOND
      // point de reboucle. Les deux branches ci-dessus ne la couvrent pas : le
      // dernier contrôle du dialogue n'est plus `last`, et le navigateur se
      // chargerait du Tab suivant — donc de l'ordre réel du document, que
      // personne ne contrôle. Le cycle doit donc être explicite à cette
      // frontière aussi, dans les deux sens.
      if (extras.length === 0 || inDialog.length === 0) return;
      const endOfDialog = inDialog[inDialog.length - 1];
      const startOfExtras = extras[0];
      if (!event.shiftKey && current === endOfDialog) {
        event.preventDefault();
        startOfExtras.focus();
      } else if (event.shiftKey && current === startOfExtras) {
        event.preventDefault();
        endOfDialog.focus();
      }
    };

    const doc = node.ownerDocument;
    doc.addEventListener("keydown", onKeyDown, true);
    return () => {
      view.cancelAnimationFrame?.(raf);
      doc.removeEventListener("keydown", onKeyDown, true);
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, enabled, containerRef]);
}

// Ferme le dialogue par la touche Échap. Exporté séparément pour le panneau de
// l'assistant, qui n'est pas modal (pas de `aria-modal`, pas de piège) mais doit
// rester refermable au clavier comme n'importe quel widget.
//
// Échap ferme la couche du dessus. Le panneau de l'assistant passe désormais
// AU-DESSUS des overlays plein écran, il est donc le plus haut des deux quand
// les deux sont ouverts, et c'est lui qui doit répondre. Or `useDialogFocus`
// écoute sur `document` en capture : sans rien changer de ce côté, le dialogue
// fermerait à travers le panneau resté ouvert.
//
// D'où l'écoute sur `window` EN CAPTURE — la capture sur `window` précède la
// capture sur `document` dans l'ordre de propagation — et le
// `stopImmediatePropagation` qui empêche ensuite le dialogue de refermer à son
// tour. Sans lui, un seul Échap fermerait les deux, et le visiteur qui voulait
// seulement refermer le panneau se retrouverait aussi devant l'overlay refermé.
export function useEscapeKey(open, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      // `stopImmediatePropagation` plutôt que `stopPropagation` : entre la
      // capture sur `window` et celle sur `document`, un autre écouteur
      // registered sur `window` en capture verrait sinon l'événement et
      // refermerait aussi sa couche.
      event.stopImmediatePropagation();
      onCloseRef.current?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);
}