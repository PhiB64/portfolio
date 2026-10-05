// Contrat de fenêtre du cube : ce que valent l'échelle et la carte d'intro pour
// un viewport donné, et à quelle condition l'overlay « tournez l'appareil »
// doit se lever.
//
// Ces fonctions sont pures et ne lisent pas `window`. Les deux effets qui les
// appellent restent dans `components/hero-cube.jsx` : ce qu'il y a d'abstraction
// dans ces effets — `resize`, `orientationchange`, `pageshow`,
// `visibilitychange`, le repli `addListener` — est du bruit de plateforme, pas de
// la logique du cube, et n'a pas sa place ici.
//
// Deux invariants vivaient implicites, dupliqués et rédigés à l'opposé dans les
// deux effets (`h >= w` pour la portrait, `w > h` pour le paysage). Ils sont ici
// rédigés une seule fois et figés par `cube-viewport.test.js` : sans cela, un
// `<` transformé en `<=` dans l'un des deux ferait dimensionner le cube en
// portrait pendant que l'overlay croit la fenêtre en paysage.

/** Côté du viewBox — la face est dessinée dans 300 × 300. */
const BASE_SIZE = 300;

/**
 * Côté de la face *projetée* à l'échelle 1 : 300 × 8/7 ≈ 343, la hauteur d'un
 * carré de côté `a` valant `a·√2` vue en perspective.
 *
 * Ce n'est pas `BASE_SIZE` : la face est dessinée dans 300 mais occupe ~343 à
 * l'écran, et c'est 343 que la largeur du `<svg>` doit déclarer. Écrire 300 ici
 * donnerait un svg trop étroit de 13 %.
 */
const FACE_SIZE_AT_1 = 343;

// Plancher haut de chaque terme disponible, en px. Il mord deux fois : sur un
// viewport plus étroit que 144 px de haut (le stage devient plus petit que sa
// réserve, sinon le cube sortirait de l'écran), et sur un viewport de largeur
// Negative — sans lui, `w - 24` partirait en négatif et l'échelle avec.
const AVAIL_FLOOR = 120;

// Marge autour du stage pour la largeur (24) et pour la hauteur (8). La hauteur
// ne prend que 8 px parce que la réserve de 96/168 ci-dessus couvre déjà le
// bandeau du bas ; elle existe pour le seul terme `w - 8` de la carte, dont le
// plancher à 1 px est le remède au `width` négatif que React refuse.
const MARGIN_W = 24;
const CARD_MARGIN_W = 8;

// Hauteur réservée sous le cube : bandeau SKIP + carte d'intro en portrait,
// une seule ligne en paysage. Un paysage se passe de 72 px de hauteur.
const RESERVE_PORTRAIT = 168;
const RESERVE_LANDSCAPE = 96;

// Plancher d'échelle. INATTEIGNABLE aujourd'hui : les deux termes `avail*` sont
// déjà plancherés à 120, donc leur ratio est au moins 120/300 = 0,4, et
// `max(0,35, …)` ne peut pas mordre. On le garde malgré tout — c'est un garde
// qui coûte trois octets, et il protègerait le cube le jour où les planchers de
// 120 px disparaîtraient. `cube-viewport.test.js` fige le fait.
const MIN_SCALE = 0.35;

// L'échelle maximale sur mobile : 0,8 de l'échelle de bureau, pas 1. À 1 la face
// occupe 343 px sur un écran de 390, il n'y a plus de marge pour le geste de
// rotation.
export const MOBILE_CUBE_MAX_SCALE = 0.8;

/** `w > h`, et non `w >= h` : le carré parfait compte comme portrait. */
export const isLandscapeViewport = (w, h) => w > h;

/**
 * Faut-il lever l'overlay « tournez l'appareil » ?
 *
 * Vrai quand la fenêtre est en PAYSAGE sur un vrai mobile — l'overlay demande
 * de la remettre en portrait, puisque la chorégraphie est verticale. Le nom est
 * à lire dans ce sens : `false` signifie « la fenêtre est déjà portrait ».
 *
 * `realMobile` doit venir de `isRealMobileDevice()` et non de
 * `isMobileDevice()` : le contrôle large (tactile + fenêtre compacte) reconnaît
 * un portable tactile ou une fenêtre de bureau étroite, et déclenchait un lock
 * sur un écran qui n'a rien à faire être tourné.
 */
export const needsOrientationLock = (w, h, realMobile) => realMobile && isLandscapeViewport(w, h);

/**
 * Échelle du cube et largeur de la carte d'intro, en px, pour un viewport `w ×
 * h`. `mobile` vient de `isMobileDevice()` et doit être lu au même instant que
 * `w` et `h` : il dépend lui-même de `window.innerWidth/innerHeight`.
 *
 * L'échelle est bornée par deux contraintes — la largeur disponible sur 300, la
 * hauteur disponible sur 300 — puis par le plafond de l'appareil, puis par le
 * plancher `MIN_SCALE`.
 */
export function computeCubeMetrics(w, h, mobile) {
  const maxScale = mobile ? MOBILE_CUBE_MAX_SCALE : 1;
  const availW = Math.max(AVAIL_FLOOR, w - MARGIN_W);
  const availH = Math.max(AVAIL_FLOOR, h - (isLandscapeViewport(w, h) ? RESERVE_LANDSCAPE : RESERVE_PORTRAIT));
  const scale = Math.max(MIN_SCALE, Math.min(maxScale, availW / BASE_SIZE, availH / BASE_SIZE));

  // Plancher à 1 px, non à 0 : un `<svg>` de largeur nulle ou négative est
  // invalide, et React journalise « A negative value is not valid ». `w - 8` est
  // le seul terme qui puisse devenir négatif, sur un viewport extrêmement
  // étroit.
  const squareSize = Math.max(1, Math.min(FACE_SIZE_AT_1 * scale, w - CARD_MARGIN_W));

  return { scale, squareSize };
}