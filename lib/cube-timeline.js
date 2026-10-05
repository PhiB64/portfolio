// Le contrat de temps de l'animation principale.
//
// Toute la chorégraphie du cube tient dans UNE timeline `anime.js` criada en
// `autoplay: false` et pilotée par le scroll : une seule ligne, `tl.seek(tlP *
// TOTAL)`. Les poids ci-dessous définissent les frontières de phase, et ces
// frontières définissent ce que le visiteur voit à chaque position de scroll.
//
// C'est donc le module le plus sensible du projet sur le plan du rendu : une
// valeur déplacée d'un millimètre étire ou comprime une phase entière. Il est
// isolé ici, sans refactorisation, et ses valeurs sont épinglées par des tests
// — voir `lib/cube-timeline.test.js`.

// Polygone du carré de fin d'animation.
const SQUARE_POINTS =
  "0,0 50,0 100,0 150,0 200,0 250,0 300,0 300,50 300,100 300,150 300,200 300,250 300,300 250,300 200,300 150,300 100,300 50,300 0,300 0,250 0,200 0,150 0,100 0,50";
// Pose initiale de la « souris » (silhouette arrondie + molette) portée par le
// même polygone. Pendant le retour, la ligne de fin d'animation repart en
// carré puis glisse vers cette silhouette au lieu d'un simple fondu.
const MOUSE_POINTS =
  "135,150 136,144 139,139 144,136 150,135 156,136 161,139 164,144 165,150 165,155 165,160 165,165 165,170 164,176 161,181 156,184 150,185 144,184 139,181 136,176 135,170 135,165 135,160 135,155";

export const W = {
  wheelFade: 200,
  morph: 1600,
  fadeIn: 120,
  idle: 5000,
  showcase: 3200,
  facesOut: 900,
  cubeFade: 600,
  spin: 3000,
  squareIn: 250,
  cubeOut: 500,
  lineMorph: 900,
  namesRise: 1500,
};
export const TOTAL =
  W.wheelFade +
  W.morph +
  W.fadeIn +
  W.idle +
  W.showcase +
  W.facesOut +
  W.cubeFade +
  W.spin +
  W.squareIn +
  W.cubeOut +
  W.lineMorph +
  W.namesRise;
export const INTRO_END = (W.wheelFade + W.morph + W.fadeIn) / TOTAL;
export const CUBE_END = (W.wheelFade + W.morph + W.fadeIn + W.idle) / TOTAL;
// Phase showcase : le cube fait un tour complet EN MONTRANT les six visuels,
// avant leur fondu. Elle est pilotée par la tête de timeline, comme le spin
// qui suit.
export const SHOW_START = CUBE_END;
export const SHOW_END = CUBE_END + W.showcase / TOTAL;
// La fenêtre de fondu des visuels est désormais celle qui suit la
// showcase, et non plus celle qui précède le spin.
export const SPIN_START = SHOW_END + (W.facesOut + W.cubeFade) / TOTAL;
export const SPIN_END = SPIN_START + W.spin / TOTAL;
// ATTENTION : `LINE_POS` est en MILLISECONDES, pas normalisé sur 0..1 comme les
// autres. C'est le seek qui attend des ms, donc la valeur est juste, mais elle
// ne se compare à aucune des autres. Ne pas « harmoniser » sans relire l'effet.
export const LINE_POS = TOTAL - (W.lineMorph + W.namesRise);
export const NAMES_START = (LINE_POS + W.lineMorph) / TOTAL;
export const NAMES_END = NAMES_START + W.namesRise / TOTAL;
// The cube only rotates on the part of the scroll that comes after the intro.
export const CUBE_RANGE = 1 - INTRO_END;
// Dernière pose de rotation du cube : le spin l'emporte au-delà. Sert de
// borne haute à la pose de base pendant la galerie du skip, pour qu'aucune de
// ses six poses ne dépasse la fin du spin.
export const ROT_END = (SPIN_END - INTRO_END) / CUBE_RANGE;

export { SQUARE_POINTS, MOUSE_POINTS };

// Interpolation coordonnée par coordonnée entre deux chaînes de points SVG de
// même longeur (24 sommets), utilisée pour faire glisser le carré de fin sur la
// silhouette de la « souris » pendant le retour.
export const interpolatePoints = (from, to, t) => {
  const a = from.split(" ").map((p) => p.split(",").map(Number));
  const b = to.split(" ").map((p) => p.split(",").map(Number));
  return a
    .map((pt, i) => [
      (pt[0] + (b[i][0] - pt[0]) * t).toFixed(1),
      (pt[1] + (b[i][1] - pt[1]) * t).toFixed(1),
    ].join(","))
    .join(" ");
};