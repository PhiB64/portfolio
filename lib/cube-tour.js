// Tirage de la tournée du spin. Sorti de `hero-cube.jsx` : cette logique ne
// dépend que des six poses de `FACE_ROTATIONS`, jamais du composant ni du DOM,
// donc elle peut être testée pour elle-même.
//
// Ce qui est figé par les tests n'est pas un tirage — il est aléatoire par
// nature — mais le *catalogue* des orders acceptables et le coût de chacun. C'est
// cela qui décide de la vitesse angulaire à l'écran.

import { FACE_ROTATIONS } from "./cube-math.js";

// Plus court chemin signé de `a` vers `b`, sur (-180, 180]. Un tour entier ne
// change rien à l'orientation : c'est ce qui permet de ramener n'importe quelle
// pose sur un multiple de 360 sans que le cube bouge d'un pixel.
const shortAngle = (deg) => ((deg % 360) + 540) % 360 - 180;

// Index de la pose frontale que `rot` décrit exactement, ou -1. Une face n'est
// carrée devant la caméra que sur l'une des six poses de `FACE_ROTATIONS` :
// entre deux poses le cube est de biais, sur une arête. C'est la contrainte qui
// gouverne le spin plus bas : montrer les six faces oblige à traverser les coins.
const poseIndexOf = (rot) =>
  FACE_ROTATIONS.findIndex((p) => p.rx === rot.rx && p.ry === rot.ry);

// Plafond de parcours du spin, en degrés cumulés (longueur des lignes tracées en
// (rx, ry)). Il ne sert pas à raccourcir le spin mais à l'égaliser : sans lui un
// ordre qui relie deux faces par un quart de tour simple fait traverser l'angle en
// un clin d'œil, et un ordre qui passe par les coins le fait payer en six temps.
// La vitesse doit être la même d'un tirage à l'autre.
export const SPIN_TOUR_BUDGET = 780;

const spinTourIsOpposite = (a, b) =>
  FACE_ROTATIONS[a].rx === -FACE_ROTATIONS[b].rx &&
  FACE_ROTATIONS[a].ry === -FACE_ROTATIONS[b].ry;

// Tirage de la tournée du spin, une fois, à son entrée.
//
// Le cube quitte `from`, montre les cinq faces qu'il ne montre pas, dans un ordre
// tiré au sort, puis revient sur la face avant : tout ce qui suit — le carré, la
// ligne, les noms — est écrit pour un cube aligné, donc le retour n'est pas un
// choix de mise en scène mais une contrainte.
//
// L'ordre est tiré parmi les seules permutations qui n'enchaînent jamais deux
// faces opposées (un tour de 180° au lieu de ~127°), qui n'ouvrent pas la
// tournée sur l'opposé de `from`, et dont le parcours total reste sous le plafond.
// Il en reste assez pour que deux spins successifs ne se ressemblent pas, sans
// qu'aucun ne sorte plus vite que les autres.
//
// Le tirage se fait ICI et non à chaque frame : un tirage par frame rebattrait la
// cible à chaque image et le cube vibrerait sur place au lieu de voyager.
export const buildSpinTour = (from) => {
  // Chaîne les poses du tirage en gardant un courant « levé ».
  //
  // Le levage est ce qui rend la suite CONTINUE. `shortAngle(180)` rend -180, et
  // une face à ry = -180 est la même image qu'une face à ry = +180 — mais si le
  // segment suivant repartait de la pose cible réinjectée (+180), les nombres
  // sauteraient de 360° d'un palier à l'autre. À l'écran on ne verrait rien ; en
  // revanche tout ce qui raisonne sur ces valeurs (vitesse, contrôle de
  // continuité, détection de pose) verrait un à-coup de 360°. On additionne donc
  // le delta au courant : la pose d'arrivée est exactement `courant + delta`, et
  // le segment suivant en repart.
  const chain = (order) => {
    const steps = [];
    let cur = { rx: from.rx, ry: from.ry };
    for (const faceIndex of [...order, 0]) {
      const target = FACE_ROTATIONS[faceIndex];
      const drx = shortAngle(target.rx - cur.rx);
      const dry = shortAngle(target.ry - cur.ry);
      const len = Math.hypot(drx, dry);
      steps.push({ rx: cur.rx, ry: cur.ry, drx, dry, len });
      cur = { rx: cur.rx + drx, ry: cur.ry + dry };
    }
    return steps;
  };
  // Coût d'un ordre : la somme des distances angulaires de ses six transitions.
  const costOf = (order) =>
    chain(order).reduce((total, step) => total + step.len, 0);
  const orders = [];
  const walk = (rest, acc) => {
    if (!rest.length) {
      orders.push(acc);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      const next = rest[i];
      if (acc.length && spinTourIsOpposite(acc[acc.length - 1], next)) continue;
      walk(
        rest.filter((x) => x !== next),
        [...acc, next],
      );
    }
  };
  walk([1, 2, 3, 4, 5], []);
  const startFace = poseIndexOf(from);
  const usable = orders.filter(
    (o) =>
      costOf(o) <= SPIN_TOUR_BUDGET &&
      // Ouvrir sur l'opposé de `from` coûterait un demi-tour d'entrée. `-1` veut
      // dire que `from` n'est pas une pose exacte : dans ce cas on n'a rien à
      // reprocher au premier tirage.
      (startFace < 0 || !spinTourIsOpposite(startFace, o[0])),
  );
  // Repli : droite, fond, dessus, gauche, dessous — un ordre vérifié, sans
  // opposées ni dépassement. Il ne sert que si `from` est une pose si rare
  // qu'aucun tirage ne satisfait les filtres.
  const order =
    usable.length > 0
      ? usable[Math.floor(Math.random() * usable.length)]
      : [5, 3, 1, 2, 4];
  // Chaque transition reçoit une part de fenêtre proportionnelle à sa longueur :
  // la vitesse angulaire est donc constante de bout en bout. Le cube ne s'arrête
  // sur aucune face et ne rattrape pas le dernier quart de tour.
  const steps = chain(order);
  return { steps, total: costOf(order) };
};