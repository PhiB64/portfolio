// `prefers-reduced-motion` en JavaScript. Le CSS du projet ne couvre que
// `.wheel-anim` : tout le reste de l'animation est piloté par anime.js et par
// des `scrollTo` programmatiques, que la media query CSS ne peut pas atteindre.
//
// La préférence est lue au moment où la séquence est armée, et non au montage :
// un visiteur qui modifie le réglage système en cours de page voit la prochaine
// séquence en tenir compte, sans rechargement.

export const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// `matchMedia` est absent sous JSDOM sans `pretendToBeVisual`, et sur les
// navigateurs anciens. On renvoie alors `false` — l'animation normale, soit le
// comportement historique. Jamais l'inverse : on ne fige pas la page sur la
// seule foi d'une incapacité à lire le réglage.
export const reduceMotion = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCE_MOTION_QUERY).matches === true;
};