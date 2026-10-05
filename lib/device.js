// Détection d'appareil, sortie de `hero-cube.jsx`.
//
// Ces deux fonctions ne lisent que `window` et jamais le composant : les sortir
// les rend testables, et surtout permet de figer par un test la différence entre
// le contrôle large et le contrôle strict. Cette différence est une contrainte
// d'orientation, pas une préférence : c'est elle qui évite de demander de
// tourner l'appareil à un Portable ou à une fenêtre de bureau étroite.

export const MOBILE_USER_AGENT = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent || "";
  const mobileUserAgent = MOBILE_USER_AGENT.test(userAgent) || window.navigator.userAgentData?.mobile === true;
  const touchDevice = window.navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches === true;
  const compactViewport = Math.max(window.innerWidth, window.innerHeight) <= 1100;
  return mobileUserAgent || ((touchDevice || coarsePointer) && compactViewport);
};

// Strict mobile check, reserved for the orientation lock: real mobile UA
// only. The looser `isMobileDevice()` (touch + compact viewport) also
// matches touch laptops and narrow desktop windows, which produced
// false-positive "rotate your device" locks on non-mobile screens.
export const isRealMobileDevice = () => {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent || "";
  return MOBILE_USER_AGENT.test(userAgent) || window.navigator.userAgentData?.mobile === true;
};