// La queue du parcours : ce qui se joue APRÈS les noms levés.
//
// Pourquoi ce module existe. La piste de scroll s'arrêtait exactement au bout de
// la chorégraphie : `p = 1` signifiait à la fois « les noms sont levés » et « fin
// du parcours », et le scroll inverse au-delà déclenchait le reset. Il n'y avait
// donc aucune place pour une phase après les textes — la fin écrite était aussi
// la dernière position atteignable.
//
// On ajoute cette place SANS toucher à la chorégraphie. La piste s'allonge d'une
// queue, et le scroll se lit désormais sur deux coordonnées :
//
//   - `coreP` — le parcours écrit, borné à 1 exactement comme avant. Aucun code
//     existant n'est décalé, rien n'est réétalonné, les seuils du reset ne bougent
//     pas d'un pixel.
//   - `tailP` — la queue seule, qui ne vaut que sur la place ajoutée.
//
// Le point important est la frontière : à `tailP = 0` on retrouve l'état de
// fin bit pour bit (noms levés, ligne à plat, trait cyan). C'est ce qui permet au
// reset de s'enchaîner sans couture sur le balayage existant, et c'est aussi ce
// qui permet au scroll inverse de défaire la queue avant de valider son retour.
//
// Isolé comme `cube-timeline.js` et `cube-finale.js`, et épinglé par des tests —
// voir `lib/cube-tail.test.js`.

import { FACE_BOX, FACE_START, FACE_VIEWBOX } from "./face-paths.js";

// La piste d'origine, en écrans. Dix écrans de piste pour neuf de course : le
// conteneur fait `100svh`, donc la course vaut `HAUTEUR - 1` écran. Cette valeur
// existait en dur dans le style du track ; elle est named ici pour que la queue
// puisse s'ajouter à côté sans que les deux nombres se contredisent.
export const CORE_SCREENS = 10;

// La queue, en écrans.
//
// Why quatre écrans, et pas deux ou trois. La durée des deux derniers segments
// est une distance de scroll, pas une constante : la réduction de la ligne et le
// tracé du visage sont scrubés, ils avancent exactement comme le pouce. Les
// allonger, c'est donc allonger la piste sur laquelle ils courent — il n'y a
// aucun curseur temporel à régler.
//
// Et cette longueur se paie sur le PREMIER segment, qui est le seul des trois
// qu'on n'a pas besoin de regarder longtemps : les textes s'éteignent, c'est un
// geste qu'on accompagne. Sur quatre écrans, 15 % pour le texte, 25 % pour la
// réduction et 60 % pour le dessin : soit 0,6 / 1,0 / 2,4 écrans de course,
// contre 0,9 / 0,3 / 1,8 quand la queue faisait trois écrans. Les deux segments
// qu'on regarde ont pris plus du double de distance ; le texte, qu'on accompagne,
// a un peu moins perdu.
export const TAIL_SCREENS = 4;

// Hauteur totale de la piste, en écrans. Seul le rendu s'en sert, pour la hauteur
// du track ; la géométrie elle-même se déduit de l'étendue mesurée, jamais de ce
// nombre (voir `splitExtent`).
export const trackScreens = () => CORE_SCREENS + TAIL_SCREENS;

// Les deux frontières de la queue.
//
// La queue se joue en TROIS temps, et non deux. La raison est une exigence de
// lecture : la ligne doit commencer à se réduire qu'APRÈS la disparition du
// texte — sinon les deux mouvements se mélangent et on ne lit plus ni la fin du
// texte ni le départ du trait.
//
//   - jusqu'à `TAIL_TEXT_P`  : les deux textes s'en vont. La ligne ne se réduit
//                               pas, et elle est DÉJÀ blanche : le changement de
//                               couleur se joue au DÉBUT de la disparition, pas
//                               à sa fin. Le blanc annonce ce qui va suivre, il
//                               n'attend pas que le texte soit parti pour le
//                               dire — sinon il n'y aurait plus rien à annoncer
//                               pendant tout le premier temps.
//   - jusqu'à `TAIL_POINT_P` : la ligne se réduit. Blanche, horizontale, de
//                               l'épaisseur de son trait, elle glisse jusqu'au
//                               point de départ du dessin (voir `TAIL_DX`).
//   - au bout                 : le point est atteint et le visage se trace.
//                               Plus rien ne bouge, le point s'y tient.
//
// Les deux derniers segments sont les deux qu'on REGARDE, et ils sont les deux
// qui prennent le plus de temps : la réduction de la ligne est un trait qu'on
// suit du regard jusqu'à ce qu'il pose la plume, et le dessin 240 traits qu'on
// regarde se former. Le premier segment est le seul qu'on accompagne — un texte
// qui s'éteint se lit d'un coup d'œil — et c'est donc le seul dont la course
// peut rester courte sans que rien ne se perde.
export const TAIL_TEXT_P = 0.15;
export const TAIL_POINT_P = 0.4;

// Le cadrage de la ligne, et la position où sa réduction s'achève.
//
// Why ce calcul est ici, et pas dans le composant. La ligne et le dessin du
// visage ne partagent pas le même repère, et les deux sont dans des vues
// différentes : la ligne est un carré de vue 300 rendu plein cadre, le visage un
// carré de vue 280 rendu à 78 % de cette boîte et centré dessus par le flex de
// son conteneur. Connaître l'un ne dit rien de l'autre — il faut convertir.
//
// La conversion tient en trois temps, et il n'y en a pas de quatrième possible :
// recentrer le point du visage sur sa propre boîte, le ramener à la fraction de
// la boîte qu'il occupe, le reprojeter sur 300. Les deux nombres du milieu
// (`FACE_VIEWBOX`, `FACE_BOX`) viennent de `face-paths.js`, qui est aussi la
// source du cadrage et de la taille réels.
//
// C'est calculé, et non recopié, précisément parce que c'est le seul endroit du
// code où les deux échelles se rencontrent. Régler la taille du visage plus tard
// déplacerait le point, et il faut que la ligne le suive — pas qu'elle reste
// fidèlement sur une coordonnée qui n'a plus cours.
export const LINE_VIEWBOX = 300;

// The centre of the line's own square, which is where the flat line already sits.
//
// Why it matters: it is the level the line never leaves. A line that shrinks
// while also rising reads as a diagonal, and a diagonal has no height to be
// aligned to. So this constant is what `FACE_DROP` is measured against.
export const LINE_ORIGIN = LINE_VIEWBOX / 2;

// La colonne de la plume, ramenée dans le repère de la ligne.
//
// Une seule coordonnée, et c'est tout l'objet du calcul. La ligne est à plat et
// ne bouge pas en hauteur, donc elle n'a qu'une course à faire : se poser sur la
// colonne du premier trait. Une fois réduite, elle y est par construction.
const toLineX = (v) => LINE_VIEWBOX * (0.5 + (v / FACE_VIEWBOX - 0.5) * FACE_BOX);

// La distance que la ligne parcourt : du centre de son carré, où la ligne à plat
// se tient, jusqu'à cette colonne. Une constante — ce n'est pas un paramètre de
// l'animation, c'est le seul trajet qu'elle ait à faire.
export const TAIL_DX = toLineX(FACE_START.x) - LINE_ORIGIN;

// De combien le visage descend pour que la plume démarre SUR la ligne.
//
// La ligne est à plat, donc elle n'a pas bougé de haut pendant qu'elle se
// réduisait : son niveau est resté celui du centre de son carré. Pour que la
// plume s'y pose, c'est donc le visage qui vient.
//
// Exprimé en pourcentage de la boîte commune — celle du marqueur et celle qui
// porte le visage, superposées. Cette boîte est l'unité qui convient parce que le
// centrage s'y fait : une correction comptée dans cette unité se mesure
// directement contre le niveau de la ligne, sans conversion.
//
// Le facteur `FACE_BOX` est là parce que le dessin n'occupe qu'une fraction de la
// boîte : sa plume est d'autant plus haute, en proportion, que le dessin est
// petit. Sans lui, un dessin réduit verrait son premier trait s'éloigner de la
// ligne.
//
// Indépendant de la taille rendue, donc : le même nombre vaut sur un téléphone et
// sur un écran large, sans rien mesurer à l'exécution.
//
// Why pas de correction en X. Il n'en faut pas : la ligne s'est déplacée
// horizontalement jusqu'à la colonne de la plume, elle est donc déjà exactement
// au-dessus du premier trait. Seule la hauteur restait à accorder.
export const FACE_DROP = (0.5 - FACE_START.y / FACE_VIEWBOX) * FACE_BOX * 100;

// La couleur du trait une fois la ligne blanche. Le cyan du carré écrit n'a
// plus cours à ce stade : c'est le trait de plume du visage qu'on annonce, et
// le dessin est blanc — un trait cyan poserait une seconde couleur sur un
// dessin qui n'en a qu'une.
export const TAIL_LINE_STROKE = "#ffffff";

// Durée du DÉNOUEMENT de la queue quand le reset est déclenché alors qu'on est
// déjà dedans — c'est-à-dire par le bouton RETOUR. Le scroll inverse, lui,
// dénoue la queue en direct : il n'y a rien à programmer, la queue est déjà
// pilotée par la position.
//
// Calibré sur la durée du premier segment du reset (`RESET_NAMES_MS`, 350 ms pour
// effacer les noms) : deux fois plus long, parce qu'il faut en plus ramener le
// trait cyan et réapparaître les deux textes, et parce que ce passage se joue sous
// le geste de l'utilisateur plutôt qu'à sa place.
export const TAIL_UNWIND_MS = 700;

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Le `smoothstep` déjà utilisé partout ailleurs dans la chorégraphie. Il est
// défini ici pour que la queue s'adoucisse comme le reste, au lieu d'introduire
// une deuxième courbe dans un fichier qui aurait pu s'en passer.
export const smoothstep = (k) => {
  const c = clamp01(k);
  return c * c * (3 - 2 * c);
};

// Découpe l'étendue de scroll mesurée en « parcours écrit » et « queue ».
//
// `extent` vient de `scrollHeight - offsetHeight`, donc c'est la course totale en
// pixels, queue comprise. La queue se déduit en hauteur d'écran et le parcours
// écrit est le reste.
//
// On ne recalcule pas la hauteur d'écran : `extent` est déjà la vérité mesurée,
// et la déduire par division retrouverait la même valeur en arrondissant deux
// fois. `Math.round` au passage parce qu'un extent non entier ferait un
// `coreExtent` fractionnaire, et donc un `coreP = 1` inatteignable exactement.
export const splitExtent = (extent, svh) => {
  const tailPx = Math.round(TAIL_SCREENS * svh);
  return { tailPx, coreExtent: Math.max(1, extent - tailPx) };
};

// Position sur le parcours écrit. Bornée à 1 : passé le bout de la chorégraphie,
// on reste à 1 et c'est `tailP` qui porte la suite. C'est exactement le contrat
// d'avant, où `real` était déjà borné par `Math.min(1, ...)`.
export const coreP = (pos, coreExtent) =>
  coreExtent > 0 ? clamp01(pos / coreExtent) : 0;

// Position dans la queue seule. Zéro avant le bout de la chorégraphie.
export const tailP = (pos, coreExtent, tailPx) =>
  tailPx > 0 ? clamp01((pos - coreExtent) / tailPx) : 0;

// La queue décomposée en ses trois segments.
//
// `out`     : disparition des deux textes. Reproduit le chemin inverse de
//             `namesRise`, donc les textes refont exactement le trajet qu'ils
//             viennent de faire. La ligne n'y touche pas.
// `close`   : réduction de la ligne, jusqu'au point de départ du dessin. Zéro
//             tant que le texte n'est pas parti : la ligne attend, à plat.
// `face`    : le reste de la course, qui porte le tracé du visage.
// `whited`  : la ligne est-elle blanche. Un booléen, pas une progression : le
//             changement de couleur est un SAUT. Il se joue dès l'ENTRÉE dans
//             la queue, avant que le texte ait fini de partir — c'est lui qui
//             annonce le dessin, et une annonce qui attend la fin du texte
//             n'annonce plus rien pendant tout le temps qu'elle dure.
//
// Les trois progressions sont des `smoothstep` : elles s'enclenchent sans
// cassure de vitesse aux deux frontières.
//
// `face` vaut 0 jusqu'au point blanc, puis MONTE de 0 à 1 sur le reste de la
// queue : c'est une progression, pas un booléen. Le tracé du visage est
// scrubsé par le scroll comme tout le reste de la queue — il se forme à
// mesure que le visiteur descend, s'arrête quand le geste cesse, et se
// défait trait par trait quand le visiteur remonte.
//
// Un booléen d'armement aurait donné un visage joué en temps réel dès l'armed :
// le visiteur qui s'arrêtait au milieu du parcours verrait le dessin se faire
// seul devant lui, en avance sur son geste. C'est le défaut classique d'une
// animation non scrubbée dans une piste scrubbée — et il est d'autant plus
// visible ici que tout ce qui précède réagit au scroll.
export const tailStages = (tp) => {
  const out = smoothstep(tp / TAIL_TEXT_P);
  // `close` reste nul jusqu'à la frontière du texte : c'est ce qui garantit
  // qu'aucune réduction n'a commencé avant que le texte ait fini de partir.
  const close =
    tp <= TAIL_TEXT_P
      ? 0
      : smoothstep((tp - TAIL_TEXT_P) / (TAIL_POINT_P - TAIL_TEXT_P));
  const face =
    tp <= TAIL_POINT_P ? 0 : smoothstep((tp - TAIL_POINT_P) / (1 - TAIL_POINT_P));
  // Le blanc est acquis dès l'entrée dans la queue : le saut est en TETE, pas à
  // la frontière du texte. C'est la ligne qui annonce le dessin, et elle doit
  // l'annoncer pendant que le texte s'en va — sinon le premier temps se joue
  // encore en cyan, alors qu'il ne se passe plus rien d'autre que l'effacement.
  return { out, close, face, whited: tp > 0 };
};

// Position de la queue pendant le dénouement programmé du reset.
//
// Vitesse CONSTANTE, sans `smoothstep`, comme le repli du skip dans
// `cube-finale.js` : la dérivée d'un smoothstep est nulle à l'arrivée, ce qui
// ferait que le trait resterait collé au point blanc en fin de course au lieu de
// repartir franchement vers la ligne. Il n'y a pas de pose de scroll à adoucir
// ici, donc ce défaut ne serait rien qu'un défaut.
export const tailUnwindP = (elapsed, unwindMs, from) => {
  const k = clamp01(elapsed / unwindMs);
  return from * (1 - k);
};