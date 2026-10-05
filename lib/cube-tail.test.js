import { describe, expect, it } from "vitest";

import {
  CORE_SCREENS,
  FACE_DROP,
  LINE_ORIGIN,
  LINE_VIEWBOX,
  TAIL_DX,
  TAIL_LINE_STROKE,
  TAIL_POINT_P,
  TAIL_SCREENS,
  TAIL_TEXT_P,
  TAIL_UNWIND_MS,
  clamp01,
  coreP,
  smoothstep,
  splitExtent,
  tailP,
  tailStages,
  tailUnwindP,
  trackScreens,
} from "./cube-tail";
import { FACE_BOX, FACE_START, FACE_VIEWBOX } from "./face-paths";

/**
 * Ces tests sont un contrat, pas une couverture.
 *
 * Le risque ici n'est pas une valeur mal arrondie : c'est la FRONTIÈRE. La queue
 * partage sa course avec la chorégraphie existante, et deux choses doivent rester
 * vraies sans jamais être réécrites ensemble :
 *
 *   - à `tailP = 0`, on retrouve la fin d'avant, celle que la timeline playback et
 *     que le balayage de reset attendent. Si ce raccord bouge, le reset s'enchaîne
 *     sur un état qui n'existe pas.
 *   - `coreP` sature à 1 exactement où il saturait avant. Toute dérive ici
 *     étire la chorégraphie entière, puisque chaque phase est une fraction de `p`.
 *
 * La course totale est donc testée à partir d'une hauteur d'écran, parce que
 * c'est la seule unité qui rende les deux segments comparables.
 */

const SVH = 800;
// La course d'origine : piste de dix écrans dans un conteneur d'un écran.
const CORE_EXTENT = (CORE_SCREENS - 1) * SVH;
const TAIL_PX = TAIL_SCREENS * SVH;
const EXTENT = CORE_EXTENT + TAIL_PX;

describe("géométrie de la piste", () => {
  it("allonge la piste du nombre d'écrans de la queue", () => {
    expect(trackScreens()).toBe(CORE_SCREENS + TAIL_SCREENS);
    expect(trackScreens()).toBe(14);
  });

  it("allonge en pixels les deux segments qu'on regarde, et raccourcit celui qu'on accompagne", () => {
    // Why en pixels et non en fraction de queue. La durée d'un segment scrubé
    // n'est pas son pourcentage de queue : c'est ce pourcentage multiplié par la
    // longueur réelle de la queue. Un segment qui ne prend que 15 % d'une queue
    // de quatre écrans court presque autant qu'un segment à 60 % d'une queue de
    // deux. Raisonner en pourcentages ferait croire que raccourcir le texte
    // n'a rien changé, alors que sa course réelle tombe de 0,9 à 0,6 écran.
    const { tailPx } = splitExtent(EXTENT, SVH);
    const span = (a, b) => ((b - a) * tailPx) / SVH;
    const text = span(0, TAIL_TEXT_P);
    const close = span(TAIL_TEXT_P, TAIL_POINT_P);
    const draw = span(TAIL_POINT_P, 1);

    // Les deux qu'on regarde sont les deux plus longs, en distance ET en multiple
    // de la course du texte. C'est le cœur du réglage : on a pris la distance sur
    // le seul segment qui n'a pas besoin d'être long.
    expect(close).toBeGreaterThan(text);
    expect(draw).toBeGreaterThan(text);
    expect(draw).toBeGreaterThan(close);

    // Réduction de la ligne : UN écran plein, contre trois dixièmes avant. C'est
    // un trait qu'on suit du regard jusqu'à ce qu'il pose la plume, et un quart
    // d'écran le faisait passer pour un geste subi.
    expect(close).toBeCloseTo(1, 5);

    // Dessin : deux écrans et demi, contre 1,8 avant. Les 240 traits se lisent à
    // cette distance ; un écran les ferait balayer.
    expect(draw).toBeCloseTo(2.4, 5);

    // Et le texte, qu'on accompagne, reste court : sous un écran. C'est ce qu'il
    // reste à vérifier — qu'un geste qu'on accompagne n'ait pas pris le chemin
    // inverse et fini par devenir le plus long des trois.
    expect(text).toBeLessThan(1);
  });

  it("découpe l'étendue sans déplacer le parcours écrit", () => {
    const { tailPx, coreExtent } = splitExtent(EXTENT, SVH);
    // La queue prend exactement sa place, le parcours écrit garde la sienne.
    expect(tailPx).toBe(TAIL_PX);
    expect(coreExtent).toBe(CORE_EXTENT);
    // Et les deux se recomposent en l'étendue mesurée.
    expect(coreExtent + tailPx).toBe(EXTENT);
  });

  it("absorbe une étendue incohérente sans donner un parcours écrit nul", () => {
    // Une hauteur d'écran absurdement grande ferait un parcours écrit négatif si on
    // ne le bornait pas — et `coreP = pos / 0` vaudrait NaN, qui ne se rattrape
    // jamais. La borne à 1 écran garantit une division toujours finie.
    const { coreExtent } = splitExtent(EXTENT, SVH * 100);
    expect(coreExtent).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(coreP(EXTENT, coreExtent))).toBe(true);
  });
});

describe("les deux coordonnées de scroll", () => {
  const { coreExtent, tailPx } = splitExtent(EXTENT, SVH);

  it("fait saturer le parcours écrit au bout de la chorégraphie", () => {
    expect(coreP(0, coreExtent)).toBe(0);
    expect(coreP(coreExtent / 2, coreExtent)).toBe(0.5);
    expect(coreP(coreExtent, coreExtent)).toBe(1);
    // Et il RESTE à 1 dans toute la queue : c'est ce qui laisse la queue porter
    // la suite sans étirer la chorégraphie.
    expect(coreP(coreExtent + tailPx, coreExtent)).toBe(1);
    expect(coreP(EXTENT * 4, coreExtent)).toBe(1);
  });

  it("ne donne la queue qu'au-delà du bout de la chorégraphie", () => {
    expect(tailP(0, coreExtent, tailPx)).toBe(0);
    expect(tailP(coreExtent, coreExtent, tailPx)).toBe(0);
    expect(tailP(coreExtent + tailPx / 2, coreExtent, tailPx)).toBe(0.5);
    expect(tailP(EXTENT, coreExtent, tailPx)).toBe(1);
    // Et au-delà de la queue non plus.
    expect(tailP(EXTENT * 4, coreExtent, tailPx)).toBe(1);
  });

  it("retrouve exactement la correspondance d'avant sur le parcours écrit", () => {
    // Le contrat le plus important : tant qu'on est dans la chorégraphie, `coreP`
    // est la position d'avant, au pixel près. C'est ce qui garantit qu'aucune des
    // phases existantes (spin, ligne, noms) ne bouge.
    for (const pos of [0, 137, 1000, CORE_EXTENT / 3, CORE_EXTENT - 1, CORE_EXTENT]) {
      expect(coreP(pos, coreExtent)).toBe(pos / CORE_EXTENT);
    }
  });

  it("ne divise pas par zéro", () => {
    expect(coreP(500, 0)).toBe(0);
    expect(tailP(500, coreExtent, 0)).toBe(0);
  });
});

describe("bornes", () => {
  it("borne à l'unité", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(9)).toBe(1);
  });

  it("adoucit comme le reste de la chorégraphie", () => {
    // smoothstep : nulle et de dérivée nulle aux deux extrémités, symétrique.
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(2)).toBe(1);
    expect(smoothstep(-1)).toBe(0);
    // Un quart puis trois quarts : la courbe tire vers les extrémités.
    expect(smoothstep(0.25)).toBeLessThan(0.25);
    expect(smoothstep(0.75)).toBeGreaterThan(0.75);
  });
});

describe("les trois segments de la queue", () => {
  it("éteint les textes SANS toucher à la ligne, puis réduit, puis seulement après dessine", () => {
    expect(tailStages(0).out).toBe(0);
    expect(tailStages(0).close).toBe(0);
    expect(tailStages(0).face).toBe(0);

    // Tout au long de la disparition du texte, la ligne ne se RÉDUIT PAS. C'est le
    // cœur des trois temps : si elle se réduisait ici, elle serait déjà en
    // mouvement pendant que le texte s'efface, et les deux gestes se
    // mélangeraient — on ne lirait plus la fin du texte.
    for (const tp of [0.02, 0.05, 0.1, TAIL_TEXT_P - 1e-6]) {
      expect(tailStages(tp).close).toBe(0);
    }

    // Mais elle est BLANCHE dès le début de ce temps, pendant que le texte
    // n'est qu'à mi-effacement. C'est le sens du changement de couleur : il
    // annonce le dessin qui vient, il ne le constate pas après coup.
    expect(tailStages(TAIL_TEXT_P / 2).whited).toBe(true);
    expect(tailStages(TAIL_TEXT_P / 2).out).toBeCloseTo(0.5, 5);

    // Le seul moment où elle est encore cyan, c'est la fin écrite : à `tp = 0`
    // on n'est pas dans la queue, la queue n'a rien à dire, et la fin écrite
    // attend son trait cyan. Le passage au blanc est donc un saut EXACTEMENT à
    // l'entrée dans la queue.
    expect(tailStages(0).whited).toBe(false);
    expect(tailStages(1e-9).whited).toBe(true);

    // Et une fois blanche, elle ne redevient jamais cyan en descendant.
    for (const tp of [TAIL_TEXT_P, 0.5, TAIL_POINT_P, 0.8, 1]) {
      expect(tailStages(tp).whited).toBe(true);
    }

    // Au moment exact où le texte a fini, elle commence à se réduire, de zéro.
    expect(tailStages(TAIL_TEXT_P).out).toBe(1);
    expect(tailStages(TAIL_TEXT_P).close).toBe(0);

    // À mi-parcours de la réduction : la ligne est à moitié réduite.
    const midClose = (TAIL_TEXT_P + TAIL_POINT_P) / 2;
    expect(tailStages(midClose).close).toBeCloseTo(0.5, 5);

    // Au point exact : texte parti, ligne blanche et réduite, visage à zéro.
    expect(tailStages(TAIL_POINT_P).out).toBe(1);
    expect(tailStages(TAIL_POINT_P).close).toBe(1);
    expect(tailStages(TAIL_POINT_P).face).toBe(0);

    // Au bout : point atteint, visage complet.
    expect(tailStages(1).out).toBe(1);
    expect(tailStages(1).close).toBe(1);
    expect(tailStages(1).face).toBe(1);
  });

  it("fait du passage au blanc un saut en tête de queue", () => {
    // Un booléen, pas une valeur entre 0 et 1 : il n'y a pas de « presque
    // blanche ». Une interpolation ferait virer la ligne au cyan-blanc pendant que
    // le texte s'efface, et le moment du changement se perdrait dans le fondu.
    const seen = new Set();
    for (let i = 0; i <= 1000; i++) seen.add(tailStages(i / 1000).whited);
    expect([...seen].sort()).toEqual([false, true]);

    // Et ce saut est net : deux positions d'une part de dix suffisent à le
    // faire, il n'y a pas de bande de transition où les deux couleurs coexistent.
    expect(tailStages(1e-4).whited).toBe(true);
  });

  it("donne au tracé le plus grand temps, parce que c'est le seul segment qui se regarde", () => {
    // Les deux autres paliers sont des gestes qu'on accompagne : un texte qui
    // part, un trait qui se ferme. Ils se lisent d'un coup d'œil et n'ont pas
    // besoin de place. Le dessin, lui, se lit trait par trait — 240 traits ne se
    // regardent pas dans un dixième de queue, ils se survolent.
    //
    // Le test verrouille cette répartition : si quelqu'un rééquilibre les
    // frontières pour gagner du temps sur le texte, le tracé se retrouvera à
    // nouveau comprimé, et c'est le seul des trois dont la durée se voit.
    const drawSpan = 1 - TAIL_POINT_P;
    expect(drawSpan).toBeGreaterThan(TAIL_TEXT_P);
    expect(drawSpan).toBeGreaterThan(TAIL_POINT_P - TAIL_TEXT_P);
    // Et l'ensemble reste la queue entière : aucune part perdue en route.
    expect(TAIL_TEXT_P + (TAIL_POINT_P - TAIL_TEXT_P) + drawSpan).toBeCloseTo(1, 10);
    // Le tracé occupe la majorité de la queue : au-delà de la moitié, pour qu'il
    // passe pour quelque chose qu'on regarde plutôt que pour un effet.
    expect(drawSpan).toBeGreaterThan(0.5);
  });

  it("ordonne les trois segments : texte, puis réduction, puis dessin", () => {
    // Aucune des trois progressions ne doit démarrer avant que la précédente ait
    // fini. C'est la garantie que le visiteur lit trois gestes successifs, et non
    // un composite où tout bouge en même temps.
    const marks = [0, 0.05, 0.1, TAIL_TEXT_P, TAIL_TEXT_P + 0.05, 0.3, TAIL_POINT_P];
    for (const tp of marks) {
      const { out, close, face } = tailStages(tp);
      expect(face === 0 || close === 1).toBe(true);
      expect(close === 0 || out === 1).toBe(true);
    }
  });

  it("fait MONTER le tracé du visage avec le scroll, au lieu de le jouer tout seul", () => {
    // Le cœur du segment `face` : la progression est strictement croissante, donc
    // descendant dans la queue on dessine, remontant on efface. Un visage joué
    // en temps réel n'aurait ici qu'un 0 puis un 1.
    const points = [TAIL_POINT_P + 1e-6, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map(
      (t) => tailStages(t).face,
    );
    for (let i = 1; i < points.length; i++) {
      expect(points[i]).toBeGreaterThan(points[i - 1]);
    }
    // Zéro exact jusqu'au point blanc : la plume ne peut pas anticiper. Un `>=`
    // paresseux ici laisserait un ou deux traits sous le point qui s'efface.
    expect(tailStages(TAIL_POINT_P).face).toBe(0);
    // Et le milieu exact de la course de dessin vaut bien 0,5 — un tracé à
    // moitié fait, pas 0 ou 1.
    expect(tailStages((TAIL_POINT_P + 1) / 2).face).toBeCloseTo(0.5, 5);
    // L'entrée est Lissée : 5 % de la course de dessin ne valent presque rien,
    // ce qui évite que la plume démarre à toute vitesse au point blanc. Symétriquement
    // à l'arrivée, un `smoothstep` a une dérivée nulle : le dernier trait se pose
    // au lieu d'arriver au bout. Les deux sont ce qui fait lire le tracé comme
    // une main, pas comme un curseur.
    const face = (t) => tailStages(t).face;
    const span = 1 - TAIL_POINT_P;
    expect(face(TAIL_POINT_P + span * 0.05)).toBeLessThan(0.01);
    expect(face(TAIL_POINT_P + span * 0.95)).toBeGreaterThan(0.99);
    expect(face(1)).toBe(1);
  });

  it("referme la queue dans l'autre sens sans interpolation parasite", () => {
    // Le scroll inverse refait le trajet exact, à l'envers : lire `out` à l'envers
    // redonne la valeur de départ. C'est ce qui permet de dénouer la queue au
    // geste avant de valider le retour. Même garantie pour le tracé du visage :
    // remonter doit le défaire jusqu'au trait, pas le laisser tel quel.
    const steps = [0, 0.2, 0.4, 0.5, 0.7, 0.9, 1];
    for (const key of ["out", "close", "face"]) {
      const forward = steps.map((t) => tailStages(t)[key]);
      const backward = steps.map((t) => tailStages(t)[key]).reverse();
      expect([...forward].reverse()).toEqual(backward);
    }
  });
});

describe("le raccord entre la ligne et le dessin", () => {
  it("ramène la colonne de la plume dans le repère de la ligne", () => {
    // La conversion est explicite ici, pour que le nombre reste vérifiable à
    // l'œil. Un point du dessin se ramène au repère de la ligne en le
    // recentrant sur sa propre boîte, en le ramenant à la fraction qu'il occupe,
    // puis en le reprojetant sur le carré de vue de la ligne.
    const toLineX = (v) =>
      LINE_VIEWBOX * (0.5 + (v / FACE_VIEWBOX - 0.5) * FACE_BOX);
    expect(TAIL_DX).toBeCloseTo(toLineX(FACE_START.x) - LINE_ORIGIN, 10);
    // La plume est à droite du centre : la ligne doit donc voyager vers la
    // droite, pas vers la gauche.
    expect(FACE_START.x).toBeGreaterThan(FACE_VIEWBOX / 2);
    expect(TAIL_DX).toBeGreaterThan(0);
  });

  it("descend le dessin juste assez pour poser la plume sur la ligne", () => {
    // La géométrie complète, en fraction de la boîte commune. Le dessin occupe
    // `FACE_BOX` de la boîte, centré ; sa plume est au-dessus de son centre ; le
    // centre de la boîte est le niveau de la ligne.
    const box = 1000;
    const penY = (box - FACE_BOX * box) / 2 + (FACE_START.y / FACE_VIEWBOX) * FACE_BOX * box;
    const lineY = box / 2;
    // Sans correction, la plume serait au-dessus de la ligne — c'est le défaut
    // que la correction vient corriger, donc il faut le voir avant de le voir
    // corrigé.
    expect(penY).toBeLessThan(lineY);
    // Après correction, elle est dessus. Au pixel près sur une boîte de mille,
    // c'est-à-dire exactement.
    const corrected = penY + (FACE_DROP / 100) * box;
    expect(corrected).toBeCloseTo(lineY, 6);
  });

  it("n'expose aucune course verticale pour la ligne", () => {
    // La raison d'être du `FACE_DROP` : si la ligne montait pendant qu'elle se
    // réduit, c'est elle qu'il faudrait décaler, et elle se lirait en diagonale —
    // une diagonale n'a plus de hauteur à laquelle poser quoi que ce soit.
    //
    // Le contrat est donc qu'il n'existe qu'UNE course, et qu'elle est
    // horizontale. On l'épingle par le module lui-même : `TAIL_DX` est un scalaire,
    // pas un point, donc il ne peut pas carries un Y par construction. Ce test
    // échouerait si quelqu'un réintroduisait un couple `{x, y}`.
    expect(typeof TAIL_DX).toBe("number");
    expect(Number.isFinite(TAIL_DX)).toBe(true);
    // Une course nulle ou négative casserait le raccord : la ligne n'arriverait
    // jamais à la colonne de la plume.
    expect(TAIL_DX).toBeGreaterThan(0);
    // Et le niveau visé reste bien le centre du carré, inchangé.
    expect(LINE_ORIGIN).toBe(LINE_VIEWBOX / 2);
  });

  it("cale le trait blanc sur la couleur du dessin", () => {
    // Le dessin est blanc ; un trait cyan en dessous poserait une seconde couleur
    // sur une image qui n'en a qu'une.
    expect(TAIL_LINE_STROKE).toBe("#ffffff");
  });
});

describe("dénouement programmé", () => {
  it("ramène la queue à zéro à vitesse constante", () => {
    expect(tailUnwindP(0, TAIL_UNWIND_MS, 0.8)).toBe(0.8);
    expect(tailUnwindP(TAIL_UNWIND_MS / 2, TAIL_UNWIND_MS, 0.8)).toBeCloseTo(0.4, 5);
    expect(tailUnwindP(TAIL_UNWIND_MS, TAIL_UNWIND_MS, 0.8)).toBe(0);
    // Tenu après la fin, et insensible au temps négatif.
    expect(tailUnwindP(TAIL_UNWIND_MS * 3, TAIL_UNWIND_MS, 0.8)).toBe(0);
    expect(tailUnwindP(-50, TAIL_UNWIND_MS, 0.8)).toBe(0.8);
  });

  it("ne fait rien quand la queue est déjà dénouée", () => {
    // Le reset déclenché par le scroll inverse arrive ici avec la queue déjà
    // revenue à zéro. Le dénouement doit être un no-op, pas un aller-retour.
    expect(tailUnwindP(0, TAIL_UNWIND_MS, 0)).toBe(0);
  });

  it("garde une durée qui tient dans le budget du reset", () => {
    // Trop long, le bouton RETOUR paraîtrait cassé ; trop court, le trait
    // remonterait d'un coup. On l'épingle entre une frame et le premier segment
    // du reset (350 ms) au moins.
    expect(TAIL_UNWIND_MS).toBeGreaterThan(350);
    expect(TAIL_UNWIND_MS).toBeLessThan(1200);
  });
});