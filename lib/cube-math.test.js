/**
 * Tests de `lib/cube-math.js`.
 *
 * Pourquoi ce fichier existe : le module ne contient que de la géométrie pure,
 * sans DOM ni React — il est donc testable sans banc de montage. Or ses
 * commentaires affirment des propriétés *mesurées* (« pointe à 4,99x la
 * moyenne », « facteur 2,24 », « 1,8x la moyenne ») qui n'étaient vérifiées par
 * rien. Ces tests sont le moyen le moins cher de les rendre vraies ou de les
 * corriger.
 *
 * Les assertions portent sur des propriétés vérifiables (monotonie, bornes,
 * continuité, conservation de la longueur) plutôt que sur des valeurs figées :
 * une valeur figée casserait au moindre réglage de chorégraphie, ce qui est
 * précisément le genre de réglage que ce projet fait forty fois par semaine.
 *
 * Exécution : `npm test`.
 */

import { describe, it, expect } from "vitest";

import {
  FACES,
  FACE_ROTATIONS,
  FACE_NORMALS,
  FACE_VERTS,
  WIRE_EDGES,
  EDGE_FACES,
  FACE_LABELS,
  LIGHT_DIR,
  isFaceVisible,
  faceFrontAmount,
  projectVertex,
  computeWireframe,
  cubicEaseInOut,
  CUBE_STEPS,
  CUBE_STEP_BOUNDS,
  nextCubeStepBound,
  lerpRot,
  getCubeRotation,
  faceTransform,
  pointInQuad,
  rotateVecByXY,
  findClickedFace,
  isVideoUrl,
} from "./cube-math.js";

/** Demi-côté du cube, la valeur que `computeWireframe` et `findClickedFace` figent. */
const H = 150;

/** Les huit sommets du cube, dans l'ordre utilisé par `computeWireframe`. */
const V = [
  [-H, -H, H], [H, -H, H], [H, H, H], [-H, H, H],
  [-H, -H, -H], [H, -H, -H], [H, H, -H], [-H, H, -H],
];



/**
 * Distance angulaire entre deux poses, en degrés — la même réduction que
 * `rotationArc` dans le module. On la recalcule ici plutôt que de l'importer
 * parce qu'elle n'est pas exportée : c'est aussi le moyen de vérifier que le
 * dénowrap de ±180 est bien respecté.
 */
function poseGap(a, b) {
  let dy = b.ry - a.ry;
  if (dy > 180) dy -= 360;
  if (dy < -180) dy += 360;
  return Math.hypot(b.rx - a.rx, dy);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (v) => Math.hypot(v[0], v[1], v[2]);

/* ------------------------------------------------------------------ */
/* Tables : cohérence interne                                         */
/* ------------------------------------------------------------------ */

describe("tables de faces", () => {
  it("expose six faces dans chaque table", () => {
    // Toute indexation croisée entre ces tables casserait silencieusement si
    // l'une d'elles perdait une entrée.
    expect(FACES).toHaveLength(6);
    expect(FACE_ROTATIONS).toHaveLength(6);
    expect(FACE_NORMALS).toHaveLength(6);
    expect(FACE_VERTS).toHaveLength(6);
    expect(FACE_LABELS).toHaveLength(6);
  });

  it("donne à chaque face quatre sommets distincts et valides", () => {
    for (const [f, verts] of FACE_VERTS.entries()) {
      expect(verts, `face ${f}`).toHaveLength(4);
      expect(new Set(verts).size, `face ${f} : sommets dupliqués`).toBe(4);
      for (const vi of verts) {
        expect(V[vi], `face ${f} : sommet ${vi} hors du cube`).toBeDefined();
      }
    }
  });

  it("donne à chaque face une normale unitaire et alignée sur ses sommets", () => {
    for (const [f, n] of FACE_NORMALS.entries()) {
      expect(norm(n), `face ${f} : normale non normalisée`).toBeCloseTo(1, 10);

      // La normale déclarée doit être *parallèle* à celle qu'on déduit de
      // l'enchaînement des quatre sommets. Le signe est volontairement ignoré :
      // voir le test suivant.
      const [i0, i1, i2] = FACE_VERTS[f];
      const implied = cross(sub(V[i1], V[i0]), sub(V[i2], V[i1]));
      const dot = implied[0] * n[0] + implied[1] * n[1] + implied[2] * n[2];
      expect(Math.abs(dot), `face ${f} : normale et sommets non parallèles`)
        .toBeCloseTo(norm(implied), 6);
    }
  });

  it("n'a un winding cohérent que sur les faces 0 et 3", () => {
    // Ce test ne vérifie pas un comportement : il *consigne* une incohérence
    // connue. Quatre faces sur six sont enroulées dans le sens opposé à leur
    // normale déclarée.
    //
    // Sans conséquence aujourd'hui : le cube est rendu par des transformations
    // CSS, qui n'ont pas de backface culling et n'utilisent pas FACE_VERTS pour
    // l'orientation. Le jour où quelqu'un porte cette géométrie vers WebGL ou
    // vers un tri de faces par profondeur, ce désaccord devient un bug
    // d'enroulement, et c'est le genre de surprise que personne ne devine à
    // débusquer à l'œil.
    //
    // Le corriger se borne à inverser l'ordre de FACE_VERTS[f] pour f ∈
    // {1, 2, 4, 5} — ce que ce test interdit tant que le code ne projette pas
    // lui-même les faces.
    const sameDirection = FACE_VERTS.map((verts, f) => {
      const [i0, i1, i2] = verts;
      const implied = cross(sub(V[i1], V[i0]), sub(V[i2], V[i1]));
      const n = FACE_NORMALS[f];
      return implied[0] * n[0] + implied[1] * n[1] + implied[2] * n[2] > 0;
    });

    expect(sameDirection).toEqual([true, false, false, true, false, false]);
  });

  it("associe à chaque arête les deux faces qui la partagent réellement", () => {
    // WIRE_EDGES[i] et EDGE_FACES[i] sont deux tables indexées en parallèle ;
    // `computeWireframe` s'appuie sur ce parallélisme pour masquer une arête
    // quand ses deux faces sont cachées. Une entrée décalée ne casserait rien
    // visiblement — elle supprimerait ou afficherait la mauvaise arête.
    expect(WIRE_EDGES).toHaveLength(EDGE_FACES.length);
    expect(WIRE_EDGES).toHaveLength(12);

    WIRE_EDGES.forEach(([a, b], i) => {
      const [fa, fb] = EDGE_FACES[i];
      expect(fa, `arête ${i} : face identique`).not.toBe(fb);
      for (const f of [fa, fb]) {
        expect(FACE_VERTS[f], `arête ${i} : face ${f} invalide`).toBeDefined();
        expect(FACE_VERTS[f], `arête ${i} : sommet ${a} absent de la face ${f}`)
          .toContain(a);
        expect(FACE_VERTS[f], `arête ${i} : sommet ${b} absent de la face ${f}`)
          .toContain(b);
      }
    });
  });

  it("couvre chaque sommet par exactement trois arêtes", () => {
    const degree = new Array(8).fill(0);
    for (const [a, b] of WIRE_EDGES) {
      degree[a]++;
      degree[b]++;
    }
    // Huit sommets × 3 arêtes / 2 extrémités = 12 arêtes.
    expect(degree).toEqual([3, 3, 3, 3, 3, 3, 3, 3]);
  });

  it("normalise la direction de la lumière", () => {
    expect(norm(LIGHT_DIR)).toBeCloseTo(1, 12);
  });
});

/* ------------------------------------------------------------------ */
/* Visibilité et frontalité                                            */
/* ------------------------------------------------------------------ */

describe("visibilité des faces", () => {
  it("expose la face attendue en façade à chacune des six poses", () => {
    // C'est la promesse centrale du module : `FACE_ROTATIONS[i]` amène la face
    // `i` face au visiteur. `findClickedFace` en dépend pour que les six onglets
    // restent cliquables.
    FACE_ROTATIONS.forEach(({ rx, ry }, f) => {
      const [nx, ny, nz] = FACE_NORMALS[f];
      expect(isFaceVisible(nx, ny, nz, rx, ry), `face ${f} non visible`).toBe(true);
      expect(faceFrontAmount(nx, ny, nz, rx, ry), `face ${f} pas frontale`)
        .toBeCloseTo(1, 10);
    });
  });

  it("ne montre qu'une seule face franche à chaque pose", () => {
    // Les cinq autres sont strictement derrière (négatif) ou exactement sur le
    // bord (zéro, donc rejetées par le `> 0`). Sans cette propriété, le cube
    // afficherait plusieurs visuels superposés.
    //
    // La tolérance de 1e-12 absorbe le résidu de `Math.cos`/`Math.sin` : à 90°
    // exacts, `cos(π/2)` vaut 6,1e-17 et non 0. Sans elle, `isFaceVisible`
    // déclare la face 0 visible à la pose 1 — un décalage de 1e-17 qui rend la
    // frontalité non booléenne en apparence, alors qu'elle est parfaitement
    // inoffensive en pratique.
    const EPS = 1e-12;
    FACE_ROTATIONS.forEach(({ rx, ry }, f) => {
      FACE_NORMALS.forEach((n, g) => {
        const front = faceFrontAmount(n[0], n[1], n[2], rx, ry);
        if (g === f) {
          expect(front, `pose ${f} : face ${f} frontalement à ${front}`)
            .toBeCloseTo(1, 10);
        } else {
          expect(front, `pose ${f} : face ${g} aussi visible (${front})`)
            .toBeLessThanOrEqual(EPS);
        }
      });
    });
  });

  it("décrit la même quantité pour `isFaceVisible` et `faceFrontAmount`", () => {
    // Les deux fonctions ont des corps identiques au caractère près. Ce test
    // verrouille l'équivalence, pour qu'on puisse supprimer l'une des deux sans
    // changer le comportement : c'est 7 lignes dupliquées de moins.
    for (const { rx, ry } of FACE_ROTATIONS) {
      FACE_NORMALS.forEach((n) => {
        expect(isFaceVisible(n[0], n[1], n[2], rx, ry)).toBe(
          faceFrontAmount(n[0], n[1], n[2], rx, ry) > 0,
        );
      });
    }
  });

  it("fait tourner la face frontale d'une pose à l'autre", () => {
    // Une pose à 90° d'écart doit basculer la frontalité d'une face à sa
    // voisine — sinon le cube « saute » au lieu de tourner.
    for (let i = 0; i < 6; i++) {
      const a = FACE_ROTATIONS[i];
      const b = FACE_ROTATIONS[(i + 1) % 6];
      const here = faceFrontAmount(...FACE_NORMALS[i], a.rx, a.ry);
      const there = faceFrontAmount(...FACE_NORMALS[i], b.rx, b.ry);
      expect(there, `face ${i} : toujours frontale après rotation`).toBeLessThan(here);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Projection                                                          */
/* ------------------------------------------------------------------ */

describe("projection des sommets", () => {
  it("conserve la longueur sous rotation", () => {
    for (const v of V) {
      for (const { rx, ry } of FACE_ROTATIONS) {
        const out = rotateVecByXY(v[0], v[1], v[2], rx, ry);
        expect(norm(out), `sommet ${v} @ (${rx},${ry})`).toBeCloseTo(norm(v), 10);
      }
    }
  });

  it("laisse le sommet inchangé à l'identité", () => {
    for (const v of V) {
      const out = rotateVecByXY(v[0], v[1], v[2], 0, 0);
      expect(out[0]).toBeCloseTo(v[0], 12);
      expect(out[1]).toBeCloseTo(v[1], 12);
      expect(out[2]).toBeCloseTo(v[2], 12);
    }
  });

  it("donne la même rotation que la projection elle-même", () => {
    // `projectVertex` et `rotateVecByXY` implémentent deux fois la même
    // rotation. Elles doivent rester d'accord, sinon la face affichée (SVG) et
    // la face cliquable (hit-test) divergent — c'est-à-dire un onglet qui
    // s'ouvre sur le mauvais contenu.
    const P = 1200;
    for (const v of V) {
      for (const { rx, ry } of FACE_ROTATIONS) {
        const [px, py, pz] = projectVertex(v[0], v[1], v[2], rx, ry, 0, 0, 1);
        const raw = rotateVecByXY(v[0], v[1], v[2], rx, ry);
        // La projection applique un facteur de perspective `f = P / (P - z)` :
        // il faut donc *retrouver* `x1` en divisant, pas en multipliant.
        const f = P / (P - pz);
        expect(px / f, `x de ${v} @ (${rx},${ry})`).toBeCloseTo(raw[0], 9);
        expect(py / f, `y de ${v} @ (${rx},${ry})`).toBeCloseTo(raw[1], 9);
      }
    }
  });

  it("écarte du centre les sommets proches de l'œil", () => {
    // Le point de fuite : un sommet devant l'œil (z proche de P) est agrandi par
    // le facteur `f = P / (P - z)`.
    //
    // L'écart au centre vaut `H * √2 * f`, pas `H * f` : on mesure ici un
    // sommet en *coin* du cube, à distance `H√2` du centre dans le plan, et la
    // perspective s'applique à ses deux coordonnées ensemble. Mesuré :
    // 188,6 (z=-150), 212,1 (z=0), 242,4 (z=+150).
    for (const z of [-H, 0, H]) {
      const p = projectVertex(H, H, z, 0, 0, 150, 150, 1);
      const f = 1200 / (1200 - z);
      expect(Math.hypot(p[0] - 150, p[1] - 150), `z=${z}`)
        .toBeCloseTo(H * Math.SQRT2 * f, 6);
    }
  });

  it("rapetisse les sommets éloignés et rapproche les proches de l'axe", () => {
    // Un sommet sur l'axe (0, 0, z) ne bouge pas : x1 = y1 = 0. C'est le point
    // de fuite au sens propre — c'est lui qui reste au centre pendant que le
    // cube s'ouvre autour.
    for (const z of [-H, 0, H]) {
      const p = projectVertex(0, 0, z, 0, 0, 150, 150, 1);
      expect(p[0], `x de l'axe à z=${z}`).toBeCloseTo(150, 9);
      expect(p[1], `y de l'axe à z=${z}`).toBeCloseTo(150, 9);
    }
  });

  it("élargit le cube projeté quand il se rapproche de l'œil", () => {
    // La face avant (z = +H) doit apparaître plus grande que la face arrière
    // (z = -H) : c'est tout l'effet de la perspective.
    const front = projectVertex(H, H, H, 0, 0, 150, 150, 1);
    const back = projectVertex(-H, -H, -H, 0, 0, 150, 150, 1);
    const width = (p) => Math.abs(p[0] - 150) + Math.abs(p[1] - 150);
    expect(width(front), "face avant").toBeGreaterThan(width(back));
  });

  it("agrandit l'ensemble quand l'échelle du cube double", () => {
    // `scale` multiplie la distance de projection P (1200 → 2400) ainsi que le
    // demi-côté que l'appelant fournit. Doubler les deux donne un cube deux fois
    // plus grand à l'écran.
    const small = projectVertex(H, H, 0, 0, 0, 150, 150, 1);
    const large = projectVertex(H * 2, H * 2, 0, 0, 0, 150, 150, 2);
    expect(Math.hypot(large[0] - 150, large[1] - 150))
      .toBeGreaterThan(Math.hypot(small[0] - 150, small[1] - 150));
  });

  it("rapproche la perspective quand P augmente", () => {
    // À P = 1200, le facteur vaut 1200/(1200-150) = 1,143 pour la face de
    // devant. À P = 2400 il vaut 2400/(2400-150) = 1,067 : moins de
    // perspective. C'est ce paramètre qui règle l'intensité du point de fuite.
    const near = projectVertex(H, H, H, 0, 0, 0, 0, 1);
    const wide = projectVertex(H, H, H, 0, 0, 0, 0, 2);
    expect(Math.hypot(near[0], near[1])).toBeGreaterThan(Math.hypot(wide[0], wide[1]));
  });
});

/* ------------------------------------------------------------------ */
/* Paliers de scroll                                                   */
/* ------------------------------------------------------------------ */

describe("CUBE_STEP_BOUNDS", () => {
  it("couvre exactement [0, 1] en 12 paliers croissants", () => {
    expect(CUBE_STEP_BOUNDS).toHaveLength(CUBE_STEPS + 1);
    expect(CUBE_STEP_BOUNDS[0]).toBe(0);
    expect(CUBE_STEP_BOUNDS[CUBE_STEPS]).toBeCloseTo(1, 12);

    for (let i = 1; i < CUBE_STEP_BOUNDS.length; i++) {
      expect(
        CUBE_STEP_BOUNDS[i],
        `palier ${i} n'avance pas (${CUBE_STEP_BOUNDS[i - 1]} → ${CUBE_STEP_BOUNDS[i]})`,
      ).toBeGreaterThan(CUBE_STEP_BOUNDS[i - 1]);
      expect(CUBE_STEP_BOUNDS[i]).toBeLessThanOrEqual(1);
    }
  });

  it("place la mi-parcours exactement à une pose complète", () => {
    // Six poses par tour, deux tours par scroll : la moitié du scroll doit
    // ramener le cube exactement sur la face de départ. Si ce n'est pas vrai,
    // les deux moitiés de la chorégraphie ne sont pas symétriques et la
    // seconde moitié dérive d'un palier.
    const mid = CUBE_STEPS / 2;
    expect(mid % 6).toBe(0);
    expect(CUBE_STEP_BOUNDS[mid]).toBeCloseTo(0.5, 12);
  });

  it("répartit les 12 paliers sur les six arcs de rotation, à raison de deux fois chacun", () => {
    // Chaque arc doit apparaître deux fois, dans le même ordre. C'est ce qui
    // fait que la sensation de vitesse est constante sur les deux tours.
    const widths = CUBE_STEP_BOUNDS.slice(1).map((b, i) => b - CUBE_STEP_BOUNDS[i]);
    const first = widths.slice(0, 6);
    expect(widths.slice(6).map((w) => w.toFixed(12)))
      .toEqual(first.map((w) => w.toFixed(12)));
  });

  it("reproduit les six arcs inégaux documentés (90, 127, 90, 201, 127, 90)", () => {
    // Le commentaire de `rotationArc` annonce ces six valeurs. Elles en découlent
    // de la géométrie des poses, pas d'un réglage : un changement de pose doit
    // faire échouer ce test, ce qui est le but.
    const arcs = FACE_ROTATIONS.map((a, i) => {
      const b = FACE_ROTATIONS[(i + 1) % 6];
      let dy = b.ry - a.ry;
      if (dy > 180) dy -= 360;
      if (dy < -180) dy += 360;
      return Math.hypot(b.rx - a.rx, dy);
    });

    const rounded = arcs.map((a) => Math.round(a));
    expect(rounded).toEqual([90, 127, 90, 201, 127, 90]);

    // Le facteur 2,24 cité dans le commentaire : le palier le plus long est
    // exactement 2,236 fois le plus court. C'est ce déséquilibre que la
    // répartition proportionnelle est censée corriger.
    const ratio = Math.max(...arcs) / Math.min(...arcs);
    expect(ratio).toBeCloseTo(2.24, 2);
  });
});

describe("nextCubeStepBound", () => {
  it("avance toujours vers la frontière suivante", () => {
    for (let i = 0; i < 400; i++) {
      const p = i / 400;
      const next = nextCubeStepBound(p);
      expect(next, `p=${p}`).toBeGreaterThan(p);
      expect(next, `p=${p}`).toBeLessThanOrEqual(1);
      // C'est bien une frontière du palier, pas un point arbitraire.
      const isBound = CUBE_STEP_BOUNDS.some((b) => Math.abs(b - next) < 1e-9);
      expect(isBound, `p=${p} renvoie ${next}, qui n'est pas une frontière`).toBe(true);
    }
  });

  it("renvoie la première borne strictement après p", () => {
    for (let i = 0; i < CUBE_STEPS; i++) {
      const bound = CUBE_STEP_BOUNDS[i];
      expect(nextCubeStepBound(bound), `à la frontière ${i}`)
        .toBeCloseTo(CUBE_STEP_BOUNDS[i + 1], 12);
    }
  });

  it("renvoie 1 une fois le scroll arrivé au bout", () => {
    expect(nextCubeStepBound(1)).toBe(1);
    expect(nextCubeStepBound(0.999999)).toBeCloseTo(1, 12);
  });
});

/* ------------------------------------------------------------------ */
/* Interpolation des poses                                             */
/* ------------------------------------------------------------------ */

describe("lerpRot", () => {
  it("donne la pose de départ à 0 et la pose d'arrivée à 1", () => {
    for (let i = 0; i < 6; i++) {
      const a = FACE_ROTATIONS[i];
      const b = FACE_ROTATIONS[(i + 1) % 6];

      const start = lerpRot(a, b, 0);
      expect(start.rx).toBeCloseTo(a.rx, 12);
      expect(start.ry).toBeCloseTo(a.ry, 12);

      const end = lerpRot(a, b, 1);
      expect(end.rx).toBeCloseTo(b.rx, 12);
      // `ry` passe par un dénowrap de ±180 : le résultat doit malgré tout
      // revenir à la valeur absolue de `b`, sans avoir sauté par 360.
      expect(end.ry, `fin du palier ${i} : ry vaut ${end.ry}, attendu ${b.ry}`)
        .toBeCloseTo(b.ry, 10);
    }
  });

  it("reste strictement entre les deux poses, sans jamais boucler", () => {
    for (let i = 0; i < 6; i++) {
      const a = FACE_ROTATIONS[i];
      const b = FACE_ROTATIONS[(i + 1) % 6];
      for (let k = 0; k <= 100; k++) {
        const rot = lerpRot(a, b, k / 100);
        const lo = Math.min(a.rx, b.rx), hi = Math.max(a.rx, b.rx);
        expect(rot.rx).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(rot.rx).toBeLessThanOrEqual(hi + 1e-9);
      }
    }
  });

  it("ne laisse la vitesse angulaire s'annuler nulle part", () => {
    // C'est la raison d'être du mélange linéaire/cubic de `STEP_EASE_MIX`. Un
    // easing pur a une dérivée nulle aux deux extrémités, donc chaque frontière
    // de palier s'arrêtait puis relançait : douze saccades sur la seule plage de
    // scroll.
    //
    // On mesure la vitesse *angulaire* (distance entre deux poses consécutives,
    // en degrés par unité de progression), pas la seule variation de `ry` : les
    // paliers 0, 2 et 4 tournent autour de `rx` avec `ry` constant, et une
    // mesure sur `ry` seul y lit zéro — donc un « arrêt » qui n'existe pas.
    const h = 1e-6;
    for (let i = 0; i < 6; i++) {
      const a = FACE_ROTATIONS[i];
      const b = FACE_ROTATIONS[(i + 1) % 6];
      for (let k = 0; k < 200; k++) {
        const p = k / 200;
        const speed = poseGap(lerpRot(a, b, p - h), lerpRot(a, b, p + h)) / (2 * h);
        expect(speed, `palier ${i} à p=${p} : vitesse nulle`).toBeGreaterThan(0);
      }
    }
  });

  it("tient la pointe de vitesse à 1,8 fois la moyenne", () => {
    // Chiffre annoncé dans le commentaire de `STEP_EASE_MIX` : « 0,4 la tient à
    // 1,8x la moyenne ». La moyenne vaut 1 par construction — l'angle total
    // parcouru est exactement l'arc du palier, sur une unité de progression —
    // donc la mesure revient à comparer la pointe à cet arc.
    //
    // C'est la mesure la plus fragile du fichier : elle ne dépend que du
    // mélange linéaire/cubic. Si quelqu'un change `STEP_EASE_MIX`, ce test
    // tombe — et il *doit* tomber, c'est exactement le signal qu'il donne.
    for (let i = 0; i < 6; i++) {
      const a = FACE_ROTATIONS[i];
      const b = FACE_ROTATIONS[(i + 1) % 6];
      const mean = poseGap(a, b);
      const h = 1e-5;
      let peak = 0;
      for (let k = 0; k < 20000; k++) {
        const p = k / 20000;
        const speed = poseGap(lerpRot(a, b, p), lerpRot(a, b, p + h)) / h;
        if (speed > peak) peak = speed;
      }
      expect(peak / mean, `palier ${i} : pointe de vitesse`).toBeCloseTo(1.8, 3);
    }
  });

  it("resserre la pointe de vitesse par rapport à un easing cubique pur", () => {
    // Le commentaire attribue au cubic pur une pointe mesurée à « 4,99x la
    // moyenne » sur la vitesse angulaire du cube (quaternions), contre 1,8x
    // pour le mélange. Les deux chiffres ne sont pas comparables entre eux :
    // 1,8 sort d'une dérivée scalaire, 4,99 d'une mesure quaternionique. On ne
    // peut donc pas en déduire un rapport, et le test ne le tente pas.
    //
    // Ce qui est vérifiable — et c'est l'essentiel — c'est que le mélange ramène
    // la pointe *de la formule elle-même* sous celle du cubic pur. On mesure
    // les deux avec la même méthode, donc la comparaison est honnête.
    const MIX = 0.4;
    const mix = (p) => p * (1 - MIX) + cubicEaseInOut(p) * MIX;
    const h = 1e-6;
    const peakOf = (f) => {
      let peak = 0;
      for (let k = 0; k < 20000; k++) {
        const p = k / 20000;
        const d = (f(p + h) - f(p)) / h;
        if (Math.abs(d) > peak) peak = Math.abs(d);
      }
      return peak;
    };
    // Mesuré : 3,0000 pour le cubic pur, 1,8000 pour le mélange à 0,4. Le
    // rapport est de 1,67 — exactement 3 / 1,8.
    const purePeak = peakOf((p) => cubicEaseInOut(p));
    const mixedPeak = peakOf(mix);

    expect(purePeak).toBeCloseTo(3.0, 3);
    expect(mixedPeak).toBeCloseTo(1.8, 3);
    // Le gain vient de la suppression des arrêts, pas d'un aplatissement.
    expect(purePeak / mixedPeak, "gain du mélange sur la pointe").toBeCloseTo(5 / 3, 3);
  });
});

describe("cubicEaseInOut", () => {
  it("va de 0 à 1 et est fixe en 0,5", () => {
    expect(cubicEaseInOut(0)).toBe(0);
    expect(cubicEaseInOut(1)).toBe(1);
    expect(cubicEaseInOut(0.5)).toBeCloseTo(0.5, 12);
  });

  it("croît sans discontinuité", () => {
    let previous = -1;
    for (let k = 0; k <= 1000; k++) {
      const value = cubicEaseInOut(k / 1000);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("s'annule aux deux extrémités — ce qui est précisément le défaut corrigé", () => {
    // Le cubic pur a une dérivée nulle en 0 et en 1. C'est ce que le mélange
    // avec une part linéaire vient combattre ; ce test en garde la mémoire.
    const h = 1e-6;
    const d0 = cubicEaseInOut(h) - cubicEaseInOut(0);
    const d1 = cubicEaseInOut(1) - cubicEaseInOut(1 - h);
    expect(d0 / h).toBeCloseTo(0, 5);
    expect(d1 / h).toBeCloseTo(0, 5);
  });
});

describe("getCubeRotation", () => {
  it("pose le cube sur la face attendue à chaque frontière de palier", () => {
    // La propriété qui fait que les six onglets restent cliquables : passer un
    // palier complet doit(/* landed) arriver sur une pose nette, pas à l'angle.
    for (let i = 0; i <= CUBE_STEPS; i++) {
      const rot = getCubeRotation(CUBE_STEP_BOUNDS[i]);
      const expected = FACE_ROTATIONS[i % 6];
      expect(rot.rx, `frontière ${i} : rx`).toBeCloseTo(expected.rx, 9);
      expect(rot.ry, `frontière ${i} : ry`).toBeCloseTo(expected.ry, 9);
    }
  });

  it("reste sur un arcade bornée entre deux frontières", () => {
    for (let i = 0; i < CUBE_STEPS; i++) {
      const a = FACE_ROTATIONS[i % 6];
      const b = FACE_ROTATIONS[(i + 1) % 6];
      const start = CUBE_STEP_BOUNDS[i];
      const end = CUBE_STEP_BOUNDS[i + 1];
      for (let k = 0; k <= 40; k++) {
        const p = start + ((end - start) * k) / 40;
        const rot = getCubeRotation(p);
        // Chaque composante reste dans l'intervalle des deux poses, aux
        // écarts de dénowrap près.
        for (const axis of ["rx", "ry"]) {
          const span = Math.max(a[axis], b[axis]) - Math.min(a[axis], b[axis]);
          const drift = Math.max(rot[axis], a[axis], b[axis]) -
            Math.min(rot[axis], a[axis], b[axis]);
          expect(drift, `palier ${i} à p=${p}, ${axis}`).toBeLessThanOrEqual(span + 1e-6);
        }
      }
    }
  });

  it("vaut la pose initiale en dehors de [0, 1] et sur une entrée invalide", () => {
    // `hero-cube.jsx` normalise la progression sur [0, 1], mais le scrub peut
    // 还是 producer une valeur hors bornes par arrondi flottant.
    for (const p of [0, 1, -0.001, 1.001, NaN, Infinity, -Infinity, undefined]) {
      const rot = getCubeRotation(p);
      expect(rot, `p=${p}`).toEqual(FACE_ROTATIONS[0]);
    }
  });

  it(" garde toujours une face franchement visible", () => {
    // Entre deux poses, le cube est à l'angle : la frontalité maximale n'atteint
    // plus 1, elle descend. Ce qui ne doit jamais arriver, c'est qu'aucune face
    // ne soit lisible — le visiteur verrait un cube vide entre deux visuels.
    //
    // Le minimum mesuré sur toute la plage est de 0,618 (au milieu d'un des deux
    // paliers de 201°). 0,5 est la borne géométrique : au-delà de 45° d'écart à
    // la pose la plus proche, plus rien ne serait de face.
    let worst = 1;
    for (let k = 0; k <= 2000; k++) {
      const p = k / 2000;
      const rot = getCubeRotation(p);
      const best = Math.max(
        ...FACE_NORMALS.map((n) => faceFrontAmount(n[0], n[1], n[2], rot.rx, rot.ry)),
      );
      if (best < worst) worst = best;
    }
    expect(worst, "le cube devient illisible quelque part sur le scroll")
      .toBeGreaterThan(0.5);
  });

  it("ne montre jamais deux faces franchement frontales à la fois", () => {
    // Symétrique du précédent : deux visuels superposés ne doivent jamais
    // cohabiter. Le seuil de 0,999 correspond à « parfaitement de face ».
    for (let k = 0; k <= 2000; k++) {
      const p = k / 2000;
      const rot = getCubeRotation(p);
      const frontal = FACE_NORMALS.filter(
        (n) => faceFrontAmount(n[0], n[1], n[2], rot.rx, rot.ry) > 0.999,
      );
      expect(frontal.length, `p=${p} : ${frontal.length} faces parfaitement frontales`)
        .toBeLessThanOrEqual(1);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Point dans un quad / clic                                            */
/* ------------------------------------------------------------------ */

describe("pointInQuad", () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];

  it("accepte un point intérieur et rejette un point extérieur", () => {
    expect(pointInQuad(5, 5, square)).toBe(true);
    expect(pointInQuad(-1, 5, square)).toBe(false);
    expect(pointInQuad(5, 11, square)).toBe(false);
    expect(pointInQuad(100, 100, square)).toBe(false);
  });

  it("accepte les points situés sur le bord", () => {
    // Les produits vectoriels nuls sont ignorés (`c !== 0`), donc le bord est
    // inclus. C'est le comportement voulu : un clic au ras de l'arête ne doit
    // pas tomber dans le vide.
    expect(pointInQuad(0, 5, square)).toBe(true);
    expect(pointInQuad(10, 5, square)).toBe(true);
    expect(pointInQuad(5, 0, square)).toBe(true);
    expect(pointInQuad(5, 10, square)).toBe(true);
  });

  it("rejette un quad dégénéré", () => {
    // Tous les produits vectoriels nuls → `s` reste 0 → `s !== 0` est faux.
    const collinear = [[0, 0], [5, 0], [10, 0], [15, 0]];
    expect(pointInQuad(7, 0, collinear)).toBe(false);
  });
});

describe("findClickedFace", () => {
  it("sélectionne la face de façade quand on clique au centre", () => {
    FACE_ROTATIONS.forEach(({ rx, ry }, expected) => {
      const face = findClickedFace(150, 150, 150, 150, rx, ry);
      expect(face, `pose ${expected} (rx=${rx}, ry=${ry}) : clique au centre`)
        .toBe(expected);
    });
  });

  it("ne sélectionne rien hors du cube", () => {
    // La face de devant couvre [-H, H] projeté, donc avec H = 150 et un centre
    // à 150, elle occupe [0, 300]². Un point à 10,10 est donc *dedans* : c'est
    // mesuré, pas supposé. Il faut sortir franchement, au-delà de [-20, 320].
    FACE_ROTATIONS.forEach(({ rx, ry }, i) => {
      expect(findClickedFace(-50, -50, 150, 150, rx, ry), `pose ${i}, hors en haut à gauche`)
        .toBe(-1);
      expect(findClickedFace(400, 400, 150, 150, rx, ry), `pose ${i}, hors en bas à droite`)
        .toBe(-1);
    });
  });

  it("sélectionne la face de la pose en début de chaque palier", () => {
    // Couplage entre le scrub et l'onglet actif : quand le cube est posé sur une
    // face, le clic au centre doit ouvrir cette face.
    //
    // Le *milieu* du palier ne convient pas : le cube y est à 45°, deux faces
    // se partagent la frontalité, et `findClickedFace` départage sur la
    // profondeur — donc les deux réponses sont légitimes et le test serait
    // instable. On vérifie le début du palier, là où la pose est nette.
    for (let i = 0; i < CUBE_STEPS; i++) {
      const start = CUBE_STEP_BOUNDS[i];
      const end = CUBE_STEP_BOUNDS[i + 1];
      const rot = getCubeRotation(start + (end - start) * 1e-6);
      const face = findClickedFace(150, 150, 150, 150, rot.rx, rot.ry);
      expect(face, `palier ${i} : la face cliquable ne correspond pas à la pose`)
        .toBe(i % 6);
    }
  });

  it("ne fait jamais disparaître la face courante en cours de palier", () => {
    // Le hit-test au centre doit toujours désigner *une* des six faces — jamais
    // -1. Un cube qui devient incliquable en cours de rotation serait un bug
    // fonctionnel, pas un détail.
    //
    // La face visée n'est pas forcément celle du palier : les six poses
    // s'enchaînent par couple (rx, ry) interpolé, et certains paliers traversent
    // des rotations qui ne passent par aucune pose intermédiaire. Sur le palier
    // 3 (« back » (0, 180) → « bottom » (90, 0)), le milieu est (45, 90), qui
    // regarde franchement la face 2 (left) : c'est géométriquement correct, et
    // c'est pourquoi on vérifie ici « une face » et non « la face attendue ».
    for (let i = 0; i < CUBE_STEPS; i++) {
      const start = CUBE_STEP_BOUNDS[i];
      const end = CUBE_STEP_BOUNDS[i + 1];
      for (let k = 0; k <= 20; k++) {
        const p = start + ((end - start) * k) / 20;
        const rot = getCubeRotation(p);
        const face = findClickedFace(150, 150, 150, 150, rot.rx, rot.ry);
        expect(face, `palier ${i} à ${(k / 20).toFixed(2)} : aucune face cliquable`)
          .toBeGreaterThanOrEqual(0);
        expect(face, `palier ${i} à ${(k / 20).toFixed(2)} : face ${face} hors tableau`)
          .toBeLessThan(6);
      }
    }
  });

  it("suit la face qu'on quitte puis celle qu'on rejoint", () => {
    // Sur un palier où l'arc passe par des rotations intermédiaires, le clic
    // au centre énumère les faces traversées. Sur le palier 3, mesuré :
    // 3 → 3 → 3 → 2 → 2 → 4 → 4 → 4, soit un aller-retour par la face 2, qui
    // regarde vers l'observateur au milieu du palier.
    const start = CUBE_STEP_BOUNDS[3];
    const end = CUBE_STEP_BOUNDS[4];
    const seen = [];
    for (let k = 0; k <= 10; k++) {
      const p = start + ((end - start) * k) / 10;
      const rot = getCubeRotation(p);
      seen.push(findClickedFace(150, 150, 150, 150, rot.rx, rot.ry));
    }
    expect(seen[0]).toBe(3);
    expect(seen[10]).toBe(4);
    expect(new Set(seen), "le palier devrait traverser la face 2").toEqual(new Set([2, 3, 4]));
  });
});

/* ------------------------------------------------------------------ */
/* Fil de fer                                                          */
/* ------------------------------------------------------------------ */

describe("computeWireframe", () => {
  it("produit un chemin non vide à toutes les poses", () => {
    for (const { rx, ry } of FACE_ROTATIONS) {
      const { path } = computeWireframe(rx, ry, null);
      expect(path, `pose (${rx},${ry})`).toBeTypeOf("string");
      expect(path.length, `pose (${rx},${ry})`).toBeGreaterThan(0);
      // Un chemin doit être une suite de segments « M…L… », séparés par des
      // espaces.
      expect(path).toMatch(/^M[-\d.]+,[-\d.]+L[-\d.]+,[-\d.]+/);
    }
  });

  it("reste stable sur l'ensemble des rotations possibles", () => {
    // Le scrub explore des angles arbitraires, pas seulement les six poses
    // nominales. Un `NaN` ici se propage jusqu'au `d` de l'attribut SVG et
    // fait disparaître tout le cube.
    for (let rx = -180; rx <= 180; rx += 17) {
      for (let ry = -180; ry <= 180; ry += 17) {
        const { path } = computeWireframe(rx, ry, null);
        expect(path, `rx=${rx} ry=${ry}`).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });

  it("ne rend pas overlayBounds quand aucune face n'est zoomée", () => {
    for (const noFace of [null, undefined, -1]) {
      const { overlayBounds } = computeWireframe(0, 0, noFace);
      expect(overlayBounds, `zoomedFace=${noFace}`).toBeNull();
    }
  });

  it("cadre la face zoomée dans ses bornes", () => {
    // `overlayBounds` n'est consommé nulle part dans le code actuel — c'est une
    // sortie morte depuis que la bulle de face est positionnée autrement. Le
    // test en garde la géométrie vérifiée au cas où l'usage revient.
    for (let f = 0; f < 6; f++) {
      const { overlayBounds } = computeWireframe(0, 0, f);
      expect(overlayBounds, `face ${f}`).not.toBeNull();
      expect(overlayBounds.w, `face ${f} : largeur négative`).toBeGreaterThan(0);
      expect(overlayBounds.h, `face ${f} : hauteur négative`).toBeGreaterThan(0);
    }
  });

  it("dessine les 4 arêtes de la face avant quand le cube est de face", () => {
    // De face, une seule face est visible : seules ses 4 arêtes survivent au
    // test d'occlusion. C'est l'inverse de ce qu'on attend intuitivement d'un
    // contour de cube, et c'est le comportement voulu — le reste du volume est
    // caché.
    expect(computeWireframe(0, 0, null).path.split(" ").length).toBe(4);
    expect(computeWireframe(90, 0, null).path.split(" ").length).toBe(4);
  });

  it("dessine davantage d'arêtes quand deux ou trois faces sont visibles", () => {
    // À 45° de chaque côté, trois faces se partagent l'écran et l'occlusion
    // laisse passer 9 arêtes sur 12.
    for (const [rx, ry] of [[45, 45], [55, 55], [135, 135], [63, 53]]) {
      const count = computeWireframe(rx, ry, null).path.split(" ").length;
      expect(count, `rx=${rx} ry=${ry} : ${count} arêtes`).toBeGreaterThan(4);
      expect(count, `rx=${rx} ry=${ry} : ${count} arêtes`).toBeLessThanOrEqual(12);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Divers                                                               */
/* ------------------------------------------------------------------ */

describe("faceTransform", () => {
  it("donne une transformation pour chaque face de `FACES`", () => {
    for (const face of FACES) {
      const t = faceTransform(face);
      expect(t, face).toBeTypeOf("string");
      // Toutes doivent pousser la face à la distance du demi-côté, sinon
      // certaines faces flottent devant ou derrière les autres.
      expect(t, face).toContain("translateZ(150px)");
    }
  });

  it("renvoie undefined pour une face inconnue", () => {
    // Non défensif, mais documenté : le module ne fabrique pas de valeur
    // bidon, ce qui laisse remonter l'erreur à l'appelant.
    expect(faceTransform("nope")).toBeUndefined();
  });
});

describe("isVideoUrl", () => {
  it("reconnaît les extensions vidéo avec et sans requête", () => {
    for (const url of ["a.webm", "a.mp4", "a.mov", "a.mkv", "a.avi",
      "/path/to/a.WEBM", "a.webm?v=2"]) {
      expect(isVideoUrl(url), url).toBe(true);
    }
  });

  it("refuse les images et les valeurs absentes", () => {
    for (const url of ["a.webp", "a.png", "a.jpg", "a.pdf", "", null, undefined]) {
      expect(isVideoUrl(url), String(url)).toBe(false);
    }
  });

  it("ne confond pas une extension prise dans le nom de fichier", () => {
    // Le point avant l'extension est obligatoire : `webmobile` n'est pas une vidéo.
    expect(isVideoUrl("web")).toBe(false);
    expect(isVideoUrl("a.webm.txt")).toBe(false);
  });
});