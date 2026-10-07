import { FACE_NORMALS, faceFrontAmount, isFaceVisible, faceUpY } from "./cube-math.js";

/**
 * Élection de la face dont le label se décode.
 *
 * Ce code était dans `components/hero-cube.jsx`, au milieu de la boucle de
 * labels. C'est de la logique — pas de la 3D, et surtout pas du DOM : elle
 * mérite ses tests, et les écrire demandait de monter le composant entier.
 * Elle vit donc ici, pure, avec les deux constantes dont elle dépend.
 *
 * La règle tient en une phrase : **une face ne se décode que lorsqu'elle est à
 * la fois révélée et présentée.** Ni l'une sans l'autre ne suffit — voir
 * `FACE_LABEL_DECODE_MIN_EXPOSURE`.
 */

// Marge de rétention de la face décodée, en « exposition » (composante z de la
// normale après rotation, cf. `faceFrontAmount`). Près d'une vue de coin, les
// expositions de deux faces se croisent à ~0,025 par degré de rotation : sans
// marge, l'argmax changerait de camp au moindre jitter de scroll ou de drag et
// les deux labels se re-coderaient sans arrêt, sur des faces qu'aucun ne
// distingue. La détentrice ne cède donc qu'à un rival qui la dépasse franchement.
// 0,02 absorbe ~0,8° de rotation, soit ~3 px de scroll — large devant le bruit
// d'un trackpad. Et le handover réel n'en sufferte pas : une face doit dépasser
// de 0,02 pour prendre le relais, donc ~0,8° de rotation de plus, sur une piste
// qui en parcourt 1080°. Au repos la marge n'est même pas engagée, le cube étant
// épinglé sur une pose nette (exposition 1,000 contre 0,000).
export const FRONT_FACE_HYSTERESIS = 0.02;

// Exposition minimale pour qu'une face soit eligible au décodage.
//
// C'est le seuil qui manquait, et il manquait au pire endroit. L'argmax portait
// `bestAmount = -Infinity` : la première face dont le label est révélé était
// donc élue d'office, même à 0,7 % d'exposition — c'est-à-dire bieuuse. Et
// comme elle était la SEULE candidate (les faces voisines ont leur compte
// d'expositions à 1, elles ne concourent pas encore), personne ne la
// concurrençait.
//
// Sa branche de décodage saute l'état « encoded », pour de bonnes raisons : le
// brouillage n'y serait qu'un aller-retour dans la même frame. Conséquence : le
// tout premier label de l'introduction n'avait AUCUNE phase codée. Il
// démarrait son décodage sur une tranche bieuuse, donc hors de champ, et la
// tween — cadencée par l'horloge, alors que la rotation est pilotée par le
// scroll — était terminée bien avant que la face ne se tourne vers le
// visiteur. Le premier label s'affichait donc déjà décodé, sans qu'aucun
// brouillage n'ait jamais été vu.
//
// Les cinq autres faces n'y échappaient que par chance : quand leur compte
// atteignait le seuil, la face précédemment décodée les devançait (exposition
// ~0,7 contre ~0,0) et les renvoyait dans `encodeFaceLabel`. Elles avaient donc
// leur phase codée, et l'effet se lisait comme prévu.
//
// 0,5 : la face occupe plus de la moitié de sa surface apparente, et le seuil
// est franchi de façon monotone sur chaque palier — donc le décodage démarre
// exactement une fois par palier, jamais deux, jamais zéro. Les poses de repos
// (1,000) et les paliers entiers le franchissent toujours, donc aucune face ne
// peut rester muette.
export const FACE_LABEL_DECODE_MIN_EXPOSURE = 0.5;

// Seuil d'alignement vertical pour autoriser le décodage.
// faceUpY < 0 signifie que le texte pointe vers le haut de l'écran.
// -0.5 ≈ 60° depuis la verticale : au-delà, le texte est trop incliné pour être lu.
export const FACE_LABEL_UPRIGHT_THRESHOLD = -0.5;

// Nombre de faces du cube. Les tableaux de sortie sont indexés par face, donc
// la taille est celle de `FACE_NORMALS` — on ne la redéclare pas ici.
const FACE_COUNT = FACE_NORMALS.length;

/**
 * Mesure les six faces à une pose donnée.
 *
 * `visible[i]` : la face fait-elle face à la caméra (`isFaceVisible`, seuil `> 0`
 * — donc une face bieuuse est déjà invisible).
 *
 * `amount[i]` : composante z de sa normale après rotation, 1 pour une face
 * pleinement de face, vers 0 au biseau. Les faces invisibles valent `-Infinity` :
 * elles ne peuvent donc jamais gagner un argmax, même si le seuil d'exposition
 * venait à être abaissé à 0.
 *
 * La lecture et l'écriture de la boucle de labels sont séparées (le cube en
 * expose trois d'un coup : dire laquelle est la plus exposée demande de les
 * avoir toutes mesurées) ; ces deux tableaux sont cette lecture, et la boucle
 * les réutilise pour la phase d'écriture plutôt que de les recalculer.
 *
 * @returns {{visible: boolean[], amount: number[]}}
 */
export function readFaceExposure(rot) {
  const visible = new Array(FACE_COUNT).fill(false);
  const amount = new Array(FACE_COUNT).fill(-Infinity);
  const upY = new Array(FACE_COUNT).fill(Infinity);
  for (let i = 0; i < FACE_COUNT; i++) {
    const [nx, ny, nz] = FACE_NORMALS[i];
    if (!isFaceVisible(nx, ny, nz, rot.rx, rot.ry)) continue;
    visible[i] = true;
    amount[i] = faceFrontAmount(nx, ny, nz, rot.rx, rot.ry);
    upY[i] = faceUpY(i, rot.rx, rot.ry);
  }
  return { visible, amount, upY };
}

/**
 * Désigne la face qui détient le décodage.
 *
 * Une face concourt si son label est révélé, si elle est visible, si elle
 * dépasse `FACE_LABEL_DECODE_MIN_EXPOSURE`, ET si son texte est dans le sens
 * de lecture (`upY < FACE_LABEL_UPRIGHT_THRESHOLD`). La plus exposée des
 * candidates l'emporte ; la détentrice précédente (`heldFace`) est reconduite
 * tant qu'aucun rival ne la dépasse franchement (`FRONT_FACE_HYSTERESIS`).
 *
 * `index` vaut `-1` quand personne ne concourt — cas normal et non dégradé :
 * pendant l'introduction, avant le seuil d'expositions, aucune face n'est
 * révélée, et aucun label ne doit se décoder.
 *
 * @param {{visible: boolean[], amount: number[], upY: number[]}} exposure  sortie de `readFaceExposure`
 * @param {(i: number) => boolean} isRevealed  le label de la face a-t-il le droit de s'afficher ?
 * @param {number} heldFace  `frontFaceRef.current` : la détentrice de la frame précédente
 * @returns {{index: number, amount: number}}  `amount` vaut -Infinity quand `index` vaut -1
 */
export function electDecodingFace(exposure, isRevealed, heldFace) {
  const { visible, amount, upY } = exposure;
  let index = -1;
  let best = -Infinity;
  for (let i = 0; i < FACE_COUNT; i++) {
    if (!visible[i] || !isRevealed(i)) continue;
    if (amount[i] < FACE_LABEL_DECODE_MIN_EXPOSURE) continue;
    if (upY[i] > FACE_LABEL_UPRIGHT_THRESHOLD) continue; // texte pas dans le sens de lecture
    if (amount[i] > best) {
      best = amount[i];
      index = i;
    }
  }
  if (
    heldFace >= 0 &&
    heldFace < FACE_COUNT &&
    visible[heldFace] &&
    isRevealed(heldFace) &&
    amount[heldFace] >= FACE_LABEL_DECODE_MIN_EXPOSURE &&
    upY[heldFace] <= FACE_LABEL_UPRIGHT_THRESHOLD &&
    amount[heldFace] >= best - FRONT_FACE_HYSTERESIS
  ) {
    return { index: heldFace, amount: amount[heldFace] };
  }
  return { index, amount: index >= 0 ? best : -Infinity };
}
