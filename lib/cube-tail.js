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
// déjà dedans — c'est-à-dire par le bouton RETOUR, ou par le scroll inverse passé
// le seuil de recul.
//
// Deux temps distincts se partagent le retour, et ils ne se pilotent pas de la même
// façon. Tant que le visiteur remonte DANS la queue, elle est scrubbée : la position
// décide, et le lissage suit le pouce — c'est `TAIL_SCROLL_SMOOTHING_MS` plus bas.
// Une fois le seuil de recul franchi (`REVERSE_TRIGGER_PX`, 120 px sur le parcours
// écrit), le scroll est gelé et la queue se joue plus du tout : elle est décomptée
// d'un bloc. C'est ce décompte qui est ici.
//
// Why 1 800, et pas 1 100. C'est la durée de l'aller. La queue entre en `TAIL_MS`
// (1 800 ms sur desktop, dans `cube-finale.js`) et le dénouement la refait à
// l'envers : c'est le même geste, donc il doit durer ce qu'il a duré. Passé ce
// seuil, ce n'est plus un rembobinage mais une relecture plus lente que son
// propre original — et ça se sent, parce que le dénouement est décompté d'un bloc
// pendant que tout le reste de la page attend.
//
// Why c'est LA moitié qu'il faut ralentir, et pas le balayage. Le décompte est
// ce qui fait revenir le nom : pendant qu'il court, `applyTail` remonte `out` vers
// 0 et l'opacité des noms suit `1 - out` (hero-cube.jsx, ligne 1681). Le nom
// « PHILIPPE BARBOSA » est donc à l'écran à la fin du décompte, pas à la fin du
// balayage — et le balayage le fait repartir, ensuite. Ralentir `RESET_MS` n'a
// jamais ralenti l'apparition du nom : cela étirait la disparition, après elle.
// Les deux complaintes se respondent donc l'un l'autre, et c'est ici qu'on
// touche.
//
// Why 3 150.
//
// La durée ne sert plus à rien ici, et c'est important de le savoir : la fenêtre du
// nom est FIXE en millisecondes (`TAIL_TEXT_REVEAL_MS`), donc allonger ce nombre
// n'allonge pas le nom — il le laisse davantage de temps au calme avant de
// commencer. Seul `TAIL_TEXT_REVEAL_MS` ralentit la réapparition.
//
// Il faut donc PAYER la fenêtre du nom en durée, parce qu'elle mord sur la ligne :
// celle-ci va de `textP` à `TAIL_POINT_P` (0,4), donc elle tient
// `0,4 * 3 150 - 900 = 360 ms`. À 2 420 ms elle n'en aurait plus que 68 ms —
// une réduction qu'on suit du regard ne peut pas tenir 68 ms. On n'y prend pas sur
// le visage, qui garde ses 60 % (1 890 ms, soit 7,9 ms par trait sur les 240) :
// c'est le segment qu'on regarde le plus longtemps, et le ralentir ne répond pas à
// la plainte.
//
// Why la fenêtre est FIXE et les autres non. Un retour se déclenche n'importe où
// dans la queue, et le décompte est linéaire : la portion de piste vaut
// `part / from * unwindMs`. Une portion constante donnerait donc un nom d'autant
// plus court qu'on le déclenche plus tôt — 900 ms depuis la fin, 450 depuis le
// milieu — et le même geste se lirait différemment selon le moment. Seul le nom est
// recentré en ms : c'est le titre du site, son retour doit durer le même temps
// qu'on l'ait déclenché. Ligne et visage gardent leurs parts, et prennent d'autant
// plus de temps que le trajet restant est long — ce qui est juste : il y a alors
// plus à regarder.
export const TAIL_UNWIND_MS = 3150;

// La fenêtre du nom, au retour — la durée que `TAIL_TEXT_P` ne donnait pas.
//
// Why une constante d'exécution, et pas une portion de `TAIL_UNWIND_MS`. La
// portion de 15 % est une FRONTIÈRE de piste, testée à l'aller dans les deux sens
// (voir `TAIL_TEXT_P`), et la déplacer au retour reviendrait à casser l'aller pour
// réparer le retour. Ici on garde la frontière pour la ligne et le visage — ce qui
// les regarde — et on donne au nom un décompte à lui, en millisecondes, mesuré
// depuis le DÉBUT du dénouement et non en portion de parcours.
//
// Why 900, et pas 270.
//
// C'est la fenêtre du nom, et c'est tout ce que la plainte demandait : trop court,
// c'est le texte qui s'éteint ou qui rentre — ça se lit d'un coup d'œil, personne ne
// le regarde arriver. 270 ms, c'était 15 % du décompte d'origine ; à 620 le nom
// s'allumait encore. 900 ms est la durée d'une expiration complète : le titre monte
// de ses 70 px, se pose, et il est là avant que le regard ait à le chercher.
//
// Why 900 est un maximum, et pas une valeur de confort. La fenêtre mange la part de
// la ligne — voir `TAIL_UNWIND_MS`, qui est dimensionné pour la payer. Au-delà, il
// faudrait allonger le dénouement pour que la ligne tienne toujours 350 ms, et le
// geste entier ferait plus de cinq secondes pour un bouton RETOUR.
export const TAIL_TEXT_REVEAL_MS = 900;

// Le lissage du scroll de la queue, celui qui suit le pouce.
//
// Why la queue était le seul segment non lissé. Tout le parcours écrit se lit dans
// `currentP`, qui rejoint sa cible par un lissage exponentiel : la molette donne des
// sauts de cent pixels, la cible part loin, et le cube ne voit qu'une vitesse lissée.
// La queue lisait `el.scrollTop` en direct, et le même geste y produisait des sauts
// francs — d'autant plus visibles que la queue est lente : à 1 % près, la ligne se
// réduisait d'un coup, et le visage perdait trois ou quatre traits d'un geste.
//
// Why plus long que celui du parcours, et pas identique. Le parcours écrit court sur
// neuf écrans : ses 80 ms sont un retard qu'on ne voit pas, un gros volume absorbant
// le décalage. La queue court sur quatre écrans et son contenu est fin — 240 traits
// sur 2,4 écrans — donc le même retard y vaut dix fois plus de traits, et se voit.
//
// Why 110, et pas plus. Un cran de molette fait une centaine de pixels, soit 3 % de la
// queue, donc sept traits d'un geste : c'est ce saut qu'il faut avaler, et 110 ms
// l'avale en une quinzaine de frames au lieu d'une. Au-delà, la queue glisse derrière
// le pouce au lieu de le suivre : la réduction de la ligne dure un écran de course,
// environ 330 ms à vitesse de lecture, et un lissage trop long se verrait comme la
// ligne qui finit après que le geste s'est arrêté. Le bon régime est celui où le
// retard se sent comme une inertie et pas comme un retard.
//
// Why exponentiel, et pas une inertie à vitesse constante. L'interpolation linéaire
// rattrape sa cible à vitesse constante puis s'arrête sec — un nouveau cran de
// molette se lirait comme une reprise. L'exponentielle n'a qu'une seule vitesse : le
// décalage se résorbe au même rythme après un cran qu'après un glissement de deux
// secondes. C'est la raison inverse de celle qui fait refuser le `smoothstep` au
// décompte ci-dessus.
export const TAIL_SCROLL_SMOOTHING_MS = 110;

// Le même lissage, en REMBOBINAGE.
//
// Why il faut une seconde valeur, et pas une seule. Le parcours écrit en a déjà deux,
// et pour la même raison : `WEB_SCROLL_SMOOTHING_MS` (80) à l'aller,
// `WEB_REVERSE_SCROLL_SMOOTHING_MS` (120) au retour, comme
// `MOBILE_SCROLL_SMOOTHING_MS` (60) et `MOBILE_REVERSE_SCROLL_SMOOTHING_MS` (100).
// Un cran de molette remonte aussi vite qu'il descend, et le contenu fin ne pardonne
// pas le retard comme le contenu gros.
//
// Why la queue doit suivre ce découpage, et c'est ce qu'elle ne faisait pas. Sans
// valeur de retour, elle remontait à 110 ms pendant que le cube rembobinait à 120 :
// le trait fin — celui qu'on regarde trait par trait — réagissait plus vite que le gros
// volume qui l'entoure. L'ordre est inversé, et il s'entend sur la réduction de la
// ligne autant que sur le visage : le trait se rembobine pendant que le cube est déjà à
// moitié revenu.
//
// Why 165, et pas 220. Le même rapport que le parcours écrit en retient, 1,5 fois —
// 110 × 1,5 = 165, comme 80 × 1,5 = 120. Au-delà, on retomberait dans ce que le
// 110 refuse déjà à l'aller, et en pire : le dénouement est plus long que la course
// qu'il adoucit, donc la ligne poserait la plume après que le geste s'est arrêté, et
// le visage se viderait de traits après que le cube a déjà repris sa course.
export const TAIL_REVERSE_SCROLL_SMOOTHING_MS = 165;

// Le lissage à employer entre la position lissée et sa cible.
//
// Why une fonction, et pas un ternaire dans le composant. Le ternaire existe déjà,
// quatre fois, pour les quatre constantes du parcours écrit. Il fait choisir la durée
// par le signe de l'écart — `diff < 0` valant « on rembobine » — et il le refait ici
// pour la queue, où l'écart se lit entre `tailSmoothP` et `targetP`. Écrit deux fois
// dans le même fichier, il commencerait à réclamer un test, et il n'y en a pas : rien
// ne verrait alors qu'une des deux branches s'inverse.
export const tailSmoothingMs = (target, smooth) =>
  target < smooth ? TAIL_REVERSE_SCROLL_SMOOTHING_MS : TAIL_SCROLL_SMOOTHING_MS;

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
export const tailStages = (tp, textP = TAIL_TEXT_P) => {
  const out = smoothstep(tp / textP);
  // `close` reste nul jusqu'à la frontière du texte : c'est ce qui garantit
  // qu'aucune réduction n'a commencé avant que le texte ait fini de partir.
  // La frontière est celle du TEXTE, donc elle se déplace avec `textP` — la ligne
  // ne commence pas à se réduire avant que le texte soit parti, quelle que soit
  // la fenêtre qu'on lui a donnée.
  const close =
    tp <= textP
      ? 0
      : smoothstep((tp - textP) / (TAIL_POINT_P - textP));
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

// Les mêmes segments, rejoués par le dénouement — et le texte sur une autre durée.
//
// Why il faut une fonction, et pas `tailStages` tel quel. `tailStages` lit des
// FRONTIÈRES de piste : 0,15 jusqu'à ce que le texte soit parti, 0,4 jusqu'à ce
// que la ligne soit réduite, 1 jusqu'à la fin du visage. À l'aller c'est
// exactement ce qu'il faut, parce que la queue est scrubbée et que ces frontières
// sont des lieux. Au retour le décompte est programmé : les mêmes lieux deviennent
// des DURÉES, proportionnelles au trajet restant — et le trajet restant dépend
// d'où l'on a déclenché le retour. Un même `TAIL_UNWIND_MS` donne donc un nom
// qui rentre en 270 ms depuis la fin de la queue, et en 90 ms depuis son milieu.
//
// Why le texte est le seul à changer de durée. La ligne et le visage gardent
// leurs frontières, donc leurs parts : ce sont les deux qu'on regarde se poser et
// se retirer, et 25 % / 60 % leur donne déjà 450 et 1 080 ms. Le texte, lui, se
// voyait recevoir 15 % du trajet — une portion qui fond dès qu'on le déclenche
// plus tôt, alors que c'est le seul segment dont la durée doit être fixe. D'où
// `textRevealMs` : le nom est recalé sur une fenêtre en millisecondes, mesurée
// depuis le début du décompte, donc identique quel que soit le point de départ.
//
// Why `textP` quand même, et pas `elapsed / textRevealMs` directement. La
// progression du texte doit suivre la position du cube, pas son horloge : si le
// nom rentrait selon une minuterie pendant que le cube est à mi-chemin, il
// serait à l'écran avant d'être arrivé en haut. On convertit donc la fenêtre en
// une frontière de piste équivalente — et c'est `textP` qu'on passe à
// `tailStages`. Le texte garde ainsi sa place dans le trajet : il finit de
// rentrer quand le cube atteint le haut, pas en avance sur lui.
//
// Why la fenêtre s'arrête à `TAIL_POINT_P`. `TAIL_POINT_P` (0,4) est la frontière
// de la LIGNE, et elle ne bouge pas. Si la fenêtre du nom la dépassait, le texte
// n'aurait pas fini de rentrer que la ligne serait déjà en train de se poser — les
// deux événements se marcheraient dessus, et on ne pourrait plus dire lequel on
// regarde. `TAIL_POINT_P` borne donc le nom.
export const tailUnwindStages = (tp, from, unwindMs, textRevealMs) => {
  // La portion de piste que vaut la fenêtre du nom, en PART DU TRAJET RESTANT.
  //
  // Why `from` au dénominateur, et pas seulement au numérateur. Le décompte est
  // linéaire : `tp` descend de `from` à 0 en `unwindMs`, donc une portion de
  // piste ne vaut pas une durée fixe — elle vaut `part / from * unwindMs`. C'est
  // pour ça que la fenêtre doit être exprimée en ms puis divisée par `from` : sans
  // lui, un retour déclenché au milieu de la queue donnerait au nom une fenêtre
  // deux fois plus courte, et il se lirait comme un clignement.
  //
  // Why la fenêtre se termine au sommet. `tailStages` fait passer `out` de 1 à 0
  // quand `tp` descend de `textP` à 0 — donc le texte finit de rentrer au moment
  // précis où le cube arrive en haut. C'est la seule fin qui ait du sens : le nom
  // ne peut pas être à l'écran avant que le cube soit arrivé.
  const textP =
    from > 0
      ? Math.min((textRevealMs / unwindMs) * from, TAIL_POINT_P * from, from)
      : TAIL_TEXT_P;
  return tailStages(tp, textP);
};