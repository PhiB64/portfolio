// Le contrat de temps de la FIN de séquence.
//
// Une fois les six faces cliquées — ou pendant le skip — plus personne ne pilote
// la chorégraphie : le cube avance tout seul jusqu'à la fin. Ce module est ce
// qu'il reste quand on retire le.scroll et le DOM : à quelle position de
// timeline correspond une durée écoulée.
//
// C'est la contrepartie de `lib/cube-timeline.js`. L'un fixe le TEMPS d'une
// phase (`W`, `SPIN_START`, `SPIN_END`…), l'autre fixe le DÉROULEMENT d'une
// position : ces trois budgets par appareil et la marche segmentée qui les
// traverse.
//
// Le minutage est réparti par segment, volontairement. Une rampe unique de
// `fromP` à 1 étirerait ou compressorait le spin selon l'endroit du 6e clic ;
// ici chaque segment garde son budget, donc la fin se rejoue toujours au rythme
// pour lequel elle a été écrite.
//
// Isolé sans réécriture, comme `cube-timeline.js`, et épinglé par des tests —
// voir `lib/cube-finale.test.js`.

import { SPIN_START, SPIN_END, CUBE_END, INTRO_END } from "./cube-timeline.js";

// Les trois budgets de la fin, par appareil. Le mobile est plus long sur les trois
// segments : même arc, mais lu sur un écran plus petit et plus lent à tenir.
export const finaleBudgets = (mobileScroll) => {
  const SHOW_MS = mobileScroll ? 3000 : 2600;
  const SPIN_MS = mobileScroll ? 4400 : 4000;
  const TAIL_MS = mobileScroll ? 2000 : 1800;
  // La fin complète, showcase comprise.
  const FINALE_MS = SHOW_MS + SPIN_MS + TAIL_MS;
  // Le skip n'a pas de showcase à jouer : sa finale part au début du spin. D'où
  // une durée qui ne dépend que des deux derniers segments.
  const SKIP_FINALE_MS = SPIN_MS + TAIL_MS;
  return { SHOW_MS, SPIN_MS, TAIL_MS, FINALE_MS, SKIP_FINALE_MS };
};

// Budget du rattrapage, en ms réelles, décidé à l'armement (0 si le 6e clic est
// déjà à CUBE_END). C'est du temps mort et il peut donc être minuscule : sous
// CUBE_END la timeline ne contient qu'un segment vide, la pose de base est gelée
// et rien ne bouge. On ne garde que de quoi faire voyager la tête sans à-coup.
export const AUTOPLAY_CATCHUP_MS = 250;

// Durée du repli carré → cube quand il reste tout l'intro à jouer. C'est le SEUL
// moment où le skip montre quoi que ce soit : cette durée décide donc quand la
// première rotation arrive.
//
// Elle remplace les 3000 ms d'avant, calibrés quand le morphing PORTAIT l'arc :
// il faisait tourner le cube à travers les poses pour rejoindre le spin, et
// cette course continue demandait du temps. Il n'y a plus d'arc — la pose est
// gelée et les visuels restent repliés pendant tout le skip — donc ces 3000 ms ne
// payaient plus que du temps mort : le cube finissait de se déplier vers 500 ms,
// puis attendait ~2,2 s avant de tourner.
//
// Les durées du sweep NE dépendent PAS de `prefers-reduced-motion` : réduire la
// durée sans réduire l'arc parcouru n'adoucit rien, ça accélère (même angle en
// moins de temps).
export const SKIP_UNFOLD_MS = 1200;

// Marche la fin écrite depuis `fromP`, en donnant à chaque segment son budget. Un
// `fromP` déjà passé SPIN_START (6e clic tardif, ou skip pressé pendant le spin)
// saute la showcase et part tout de suite sur SPIN_MS : la révolution n'est plus
// comprimée par ce qui la précède.
export const runFinale = (fromP, elapsed, { SHOW_MS, SPIN_MS, TAIL_MS }) => {
  if (fromP < SPIN_START) {
    if (elapsed < SHOW_MS) return fromP + (SPIN_START - fromP) * (elapsed / SHOW_MS);
    elapsed -= SHOW_MS;
  }
  if (elapsed < SPIN_MS) return SPIN_START + (SPIN_END - SPIN_START) * (elapsed / SPIN_MS);
  elapsed -= SPIN_MS;
  return SPIN_END + (1 - SPIN_END) * Math.min(1, elapsed / TAIL_MS);
};

// Tête de timeline pendant le scroll automatique de fin. Elle ne traverse pas
// `[tlStartP, 1]` à vitesse égale : sous CUBE_END il n'y a qu'un rattrapage,
// bridé à son budget, et la fin écrite garde ensuite ses budgets par segment.
// Sans ce partage, un clic prématuré (six tapes enchaînées sur mobile) étirait la
// rampe sur le même budget et compressait la fin écrite. Les deux branches se
// raccordent en CUBE_END et finissent en 1 : la tête reste continue, donc aucun
// saut.
export const autoplayHeadP = (elapsed, catchMs, tlStartP, budgets) =>
  elapsed < catchMs
    ? tlStartP + (CUBE_END - tlStartP) * (elapsed / catchMs)
    : runFinale(CUBE_END, elapsed - catchMs, budgets);

// Repli du skip : le carré devient le cube, et c'est tout ce que le skip montre.
// La tête va de `from` à INTRO_END en `unfoldMs`, puis la finale la prend à
// SPIN_START — le saut d'INTRO_END à SPIN_START traverse des segments vides, donc
// ne dessine rien.
//
// Vitesse CONSTANTE, sans `smoothstep`, dont la dérivée est nulle à l'arrivée :
// le cube décélérait sur ses dernières centaines de ms et s'arrêtait net avant de
// tourner. Il n'y a plus de pose de scroll à adoucir ici, donc il ne restait que
// ce défaut.
export const skipUnfoldP = (elapsed, unfoldMs, from) => {
  const unfoldK = Math.min(1, elapsed / unfoldMs);
  return from + (INTRO_END - from) * unfoldK;
};

// Balayage de retour (bouton RETOUR) : CUBE_END → 0 en `resetMs`, départ et
// arrivée adoucis par un `smoothstep`.
//
// Le sweep était linéaire — pleine vitesse dès la première frame, arrêt net à
// 0 — alors que tout le reste de la chorégraphie est en `smoothstep` ou en
// `easeInOutQuad` (timeline, finale, queue, morphing). C'était le seul mouvement
// à profil plat, et c'est lui qui se lisait comme « robotique » : le cube
// partait d'un coup après le battement de 500 ms, puis se garait sec.
//
// `smoothstep` et non `easeInOutQuad` : les deux ont une dérivée nulle aux
// extrémités, mais `smoothstep` est déjà l'adoucisseur de la chorégraphie
// (`cube-tail.js`, `hero-cube.jsx`) — une deuxième courbe aurait deux profils à
// comparer à l'œil.
//
// Tenu après la fin, insensible au temps négatif : le sweep écrit `scrollTop`
// à chaque frame jusqu'au garage, et une valeur hors bornes y ferait reculer
// la tête après son arrivée.
export const resetSweepP = (elapsed, resetMs, from = CUBE_END) => {
  const k = Math.min(1, Math.max(0, elapsed / resetMs));
  const e = k * k * (3 - 2 * k);
  return from * (1 - e);
};

// Bornes du sweep de skip. Un skip tardif (pressé pendant le spin) n'a plus de
// repli à jouer et part directement sur sa finale.
export const skipDurationMs = (skipLate, unfoldMs, { SKIP_FINALE_MS }) =>
  skipLate ? SKIP_FINALE_MS : unfoldMs + SKIP_FINALE_MS;
