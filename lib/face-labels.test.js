/**
 * Tests de `lib/face-labels.js` — l'élection de la face dont le label se décode.
 *
 * Cette logique était dans la boucle de labels de `components/hero-cube.jsx`,
 * où l'écrire demandait de monter le composant entier et de piloter le scroll.
 * Elle est ici parce qu'elle porte une règle non triviale : **une face ne se
 * décode que si son label est révélé ET qu'elle est réellement présentée à
 * l'écran.**
 *
 * Le cas que ces tests verrouillent est une régression. L'argmax initialisait
 * son seuil à `-Infinity`, donc la première face révélée était élue d'office,
 * même à 0,7 % d'exposition — bieu. Or sa branche de décodage saute l'état
 * « encoded » : le premier label n'avait donc aucune phase codée. La tween est
 * cadencée par l'horloge alors que la rotation est pilotée par le scroll, donc
 * elle était terminée avant que la face ne se tourne vers le visiteur — le
 * premier label s'affichait déjà décodé, sans qu'aucun brouillage n'ait jamais
 * été vu. Les cinq autres faces n'y échappaient que par chance : la face
 * précédemment décodée les devançait et les renvoyait dans `encodeFaceLabel`.
 *
 * Les poses chiffrées ci-dessous ont été relevées sur `readFaceExposure`, pas
 * estimées : chacune est commentée avec ses six expositions.
 *
 * Exécution : `npm test`.
 */

import { describe, it, expect } from "vitest";

import {
  FACE_LABEL_DECODE_MIN_EXPOSURE as FLOOR,
  FRONT_FACE_HYSTERESIS,
  electDecodingFace,
  readFaceExposure,
} from "./face-labels.js";
import { FACE_LABELS, FACE_ROTATIONS, getCubeRotation } from "./cube-math.js";

const all = () => true;
const none = () => false;
const only = (...idx) => (i) => idx.includes(i);

const round = (n) => Math.round(n * 10000) / 10000;

/** Exposition des six faces, arrondie, pour les assertions et les commentaires. */
const amountsAt = (rot) => readFaceExposure(rot).amount.map((a) => round(a));

// (45, 45)      → f0 0.5000  f2 0.5000  f4 0.7071   (les trois faces d'un coin)
const CORNER = { rx: 45, ry: 45 };
// (45.3, 89.4)  → f0 0.0074  f2 0.7034  f4 0.7108   (la face 0 vient d'apparaître : bieu)
const EDGE_ON = { rx: 45.3, ry: 89.4 };
// (-60, 0)      → f0 0.5000  f1 0.8660               (f0 pile sur le seuil)
const THRESHOLD = { rx: -60, ry: 0 };
// (-59, -13)    → f0 0.5020  f1 0.8570               (f0 franchit le seuil)
const JUST_OVER = { rx: -59, ry: -13 };
// (-60, 90)      → f0 0.0000  f1 0.8660  f2 0.5000   (deux faces à 0,5 et au-delà)
const MULTI = { rx: -60, ry: 90 };

describe("readFaceExposure", () => {
  it("ne compte que les faces réellement visibles", () => {
    // Pose nette de la face avant : elle seule est visible, à 1,000.
    const { visible, amount } = readFaceExposure(FACE_ROTATIONS[0]);
    expect(visible).toEqual([true, false, false, false, false, false]);
    expect(amount[0]).toBeCloseTo(1, 10);
  });

  it("donne -Infinity aux faces invisibles, jamais 0", () => {
    // Une face invisible vaut -Infinity et non 0 : elle ne peut donc pas gagner
    // un argmax, même si le seuil d'exposition venait à être abaissé à 0.
    expect(readFaceExposure(FACE_ROTATIONS[0]).amount).toEqual([
      1, -Infinity, -Infinity, -Infinity, -Infinity, -Infinity,
    ]);
  });

  it("voit les trois faces d'un coin, et les mesure juste", () => {
    expect(readFaceExposure(CORNER).visible).toEqual([true, false, true, false, true, false]);
    expect(amountsAt(CORNER)).toEqual([0.5, -Infinity, 0.5, -Infinity, round(Math.SQRT1_2), -Infinity]);
  });
});

describe("electDecodingFace — le silence avant le seuil", () => {
  it("ne désigne personne quand aucun label n'est révélé", () => {
    // L'introduction : aucun compte n'a atteint le seuil d'expositions. Un
    // argmax global désignerait une face muette, et le premier label
    // n'existerait que par accident, à la rotation près du seuil.
    const { index, amount } = electDecodingFace(readFaceExposure(FACE_ROTATIONS[0]), none, -1);
    expect(index).toBe(-1);
    expect(amount).toBe(-Infinity);
  });

  it("désigne la face de face quand son label est révélé", () => {
    const { index, amount } = electDecodingFace(readFaceExposure(FACE_ROTATIONS[0]), all, -1);
    expect(index).toBe(0);
    expect(amount).toBeCloseTo(1, 10);
  });
});

describe("electDecodingFace — le seuil d'exposition (la régression)", () => {
  it("ne désigne pas une face bieuuse, même seule candidate", () => {
    // Le défaut corrigé, à la pose exacte où il se produisait. La face 0 vient
    // d'atteindre son seuil d'expositions : elle est visible mais encore bieu
    // (0,0074). Deux voisines sont franchement exposées (0,70 et 0,71) — mais
    // elles ne sont pas candidates : leur compte d'expositions est resté à 1.
    // Avant le correctif, `bestAmount = -Infinity` élisait donc la face 0.
    const exposure = readFaceExposure(EDGE_ON);
    expect(exposure.visible[0]).toBe(true);
    expect(exposure.amount[0]).toBeLessThan(FLOOR);
    expect(exposure.amount[2]).toBeGreaterThan(FLOOR);
    expect(electDecodingFace(exposure, only(0), -1).index).toBe(-1);
  });

  it("ne désigne pas une face invisible, même si elle est la seule candidate", () => {
    // Cas voisin, plus grossier : à la pose de repos, seule la face 0 est
    // visible. Si c'est la face 3 qui a le label révélé, personne ne décode.
    const exposure = readFaceExposure(FACE_ROTATIONS[0]);
    expect(electDecodingFace(exposure, only(3), -1).index).toBe(-1);
    expect(electDecodingFace(exposure, only(0), -1).index).toBe(0);
  });

  it("la désigne dès qu'elle franchit le seuil", () => {
    expect(readFaceExposure(JUST_OVER).amount[0]).toBeGreaterThan(FLOOR);
    expect(electDecodingFace(readFaceExposure(JUST_OVER), only(0), -1).index).toBe(0);
  });

  it("accepte une face exactement sur le seuil", () => {
    // Le seuil est un plateau, pas un point : à (-60, 0) la face 0 vaut
    // exactement 0,5000. La comparaison doit être `>=`, sinon une pose
    // d'égalité resterait muette.
    const exposure = readFaceExposure(THRESHOLD);
    expect(exposure.amount[0]).toBeCloseTo(FLOOR, 10);
    expect(electDecodingFace(exposure, only(0), -1).index).toBe(0);
  });

  it("n'élit jamais une face muette même très exposée", () => {
    // À (-60, 90) : face 1 à 0,866, face 2 à 0,500, face 0 à 0,0000 (visible
    // mais de travers). Seule la face 2 a le label révélé : c'est elle qui doit
    // décoder, même si la face 1 est bien plus exposée — l'argmax porte sur les
    // candidates, pas sur les six faces.
    const exposure = readFaceExposure(MULTI);
    expect(exposure.amount[1]).toBeGreaterThan(exposure.amount[2]);
    expect(exposure.amount[2]).toBeGreaterThanOrEqual(FLOOR);
    expect(electDecodingFace(exposure, only(2), -1).index).toBe(2);
    // Ré revelation croisée : avec les deux labels révélés, la plus exposée
    // l'emporte — c'est bien l'argmax qui tranche, pas l'ordre des faces.
    expect(electDecodingFace(exposure, all, -1).index).toBe(1);
    expect(electDecodingFace(exposure, only(1), -1).index).toBe(1);
  });
});

describe("electDecodingFace — hystérésis", () => {
  it("reconduit la détentrice quand aucun rival ne la dépasse", () => {
    // Face 1 détient à 0,866, personne ne peut la dépasser à cette pose.
    const exposure = readFaceExposure(THRESHOLD);
    expect(exposure.amount[1]).toBeGreaterThan(exposure.amount[0]);
    expect(electDecodingFace(exposure, all, 1).index).toBe(1);
  });

  it("lui cède dès qu'un rival la dépasse de plus que la marge", () => {
    // La face 0 détient (0,500) ; la face 1 la dépasse de 0,366, très au-delà
    // des 0,02 de marge. Le relais doit se faire.
    const exposure = readFaceExposure(THRESHOLD);
    expect(exposure.amount[1] - exposure.amount[0]).toBeGreaterThan(FRONT_FACE_HYSTERESIS);
    const { index, amount } = electDecodingFace(exposure, all, 0);
    expect(index).toBe(1);
    expect(amount).toBeCloseTo(exposure.amount[1], 10);
  });

  it("absorbe un jitter plus petit que la marge", () => {
    // Deux faces à égalité (0,5 chacune, à 10^-16 près) : la détentrice est
    // reconduite. C'est le cas qui justifie l'hystérésis — sans elle, l'argmax
    // changerait de camp au moindre jitter de scroll ou de drag.
    const exposure = readFaceExposure(CORNER);
    expect(exposure.amount[0]).toBeCloseTo(exposure.amount[2], 12);
    expect(electDecodingFace(exposure, only(0, 2), 2).index).toBe(2);
    expect(electDecodingFace(exposure, only(0, 2), 0).index).toBe(0);
  });

  it("ne reconduit pas une détentrice repassée sous le seuil", () => {
    // C'est ce qui empêche un décodage de démarrer sur une tranche invisible :
    // la détentrice redevient bieuuse, elle perd donc sa qualité de candidate.
    const exposure = readFaceExposure(EDGE_ON);
    expect(exposure.amount[0]).toBeLessThan(FLOOR);
    expect(electDecodingFace(exposure, only(0), 0).index).toBe(-1);
  });

  it("ignore une détentrice hors tableau", () => {
    const exposure = readFaceExposure(FACE_ROTATIONS[0]);
    expect(electDecodingFace(exposure, all, -1).index).toBe(0);
    expect(electDecodingFace(exposure, all, 6).index).toBe(0);
    expect(electDecodingFace(exposure, all, 99).index).toBe(0);
  });
});

/**
 * Rejoue la boucle de labels sur une révolution complète du cube, comme le tick
 * le fait : on avance la tête de lecture de 0 à 1 par petits pas, on compte les
 * expositions, et on note ce que chaque face fait à son PREMIER passage.
 */
function runTour() {
  const counts = new Array(6).fill(0);
  const wasVisible = new Array(6).fill(false);
  const state = new Array(6).fill("none");
  const first = new Array(6).fill(null);
  let held = -1;
  let lastRot = { rx: Infinity, ry: Infinity };

  const isRevealed = (i) => counts[i] >= 2;
  const note = (i, patch) => {
    first[i] = { ...(first[i] || { encodedFirst: null, encodeExpo: null }), ...patch };
  };

  for (let f = 0; f <= 4000; f++) {
    const rot = Number.isFinite(lastRot.rx) ? lastRot : { rx: 0, ry: 0 };
    const exposure = readFaceExposure(rot);

    for (let i = 0; i < 6; i++) {
      if (exposure.visible[i] && !wasVisible[i]) counts[i]++;
    }

    const { index } = electDecodingFace(exposure, isRevealed, held);
    held = index;

    for (let i = 0; i < 6; i++) {
      if (!isRevealed(i)) {
        state[i] = "none";
      } else if (exposure.visible[i]) {
        if (i === index) {
          if (state[i] !== "decoding" && state[i] !== "decoded") {
            state[i] = "decoding";
            note(i, { decodeExpo: exposure.amount[i] });
          }
        } else if (state[i] !== "encoded") {
          state[i] = "encoded";
          if (state[i] !== "encoded" || first[i] === null) note(i, { encodedFirst: true, encodeExpo: exposure.amount[i] });
        }
      } else if (state[i] === "decoding" || state[i] === "decoded") {
        state[i] = "encoded";
      }
      wasVisible[i] = exposure.visible[i];
    }
    lastRot = getCubeRotation(f / 4000);
  }

  return FACE_LABELS.map((label, i) => ({ label, ...first[i] }));
}

describe("parcours complet — chaque label a sa phase codée", () => {
  it("les six labels passent par un état codé avant de décoder", () => {
    // Le test de régression de bout en bout. Avant le correctif, le premier
    // label (WEB) allait droit de "none" à "decoding" : `encodedFirst` valait
    // alors false, et c'est exactement ce que le visiteur voyait.
    for (const face of runTour()) {
      expect(face.encodedFirst, `${face.label} décode sans passer par le codage`).toBe(true);
    }
  });

  it("le premier label apparaît bien encodé, à une exposition de bieu", () => {
    const web = runTour()[0];
    expect(web.label).toBe("WEB");
    // Il s'affiche codé alors qu'il est encore de travers — donc le
    // brouillage est sur une tranche visible, ce qui est tout l'intérêt.
    expect(web.encodeExpo).toBeLessThan(FLOOR);
    expect(web.encodeExpo).toBeGreaterThan(0);
  });

  it("aucun label ne démarre son décodage sous le seuil d'exposition", () => {
    for (const face of runTour()) {
      // `0.5` en dur, et non `FLOOR` : la comparaison serait creuse si FLOOR
      // retombait à 0, qui est précisément le défaut qu'on corrige. Cette
      // assertion doit rester capable d'échouer.
      expect(face.decodeExpo).toBeGreaterThanOrEqual(0.5);
      // Et pas non plus sur une face franchement de face : le seuil est franchi
      // de près du seuil, à un moment déterministe de chaque palier.
      expect(face.decodeExpo).toBeLessThan(1);
    }
  });

  it("chaque label ne démarre son décodage qu'une fois par palier", () => {
    // Une propriété de la machine à états plus que du correctif : passer le
    // plancher ne doit pas créer un second décodage sur la même face, ni
    // provoquer un codage puis un décodage à chaque frame. On recompte les
    // entrées continues dans l'état « decoding ».
    const counts = new Array(6).fill(0);
    const wasVisible = new Array(6).fill(false);
    const decoding = new Array(6).fill(false);
    const entries = new Array(6).fill(0);
    let held = -1;
    let lastRot = { rx: Infinity, ry: Infinity };
    const isRevealed = (i) => counts[i] >= 2;

    for (let f = 0; f <= 4000; f++) {
      const rot = Number.isFinite(lastRot.rx) ? lastRot : { rx: 0, ry: 0 };
      const exposure = readFaceExposure(rot);
      for (let i = 0; i < 6; i++) if (exposure.visible[i] && !wasVisible[i]) counts[i]++;
      const { index } = electDecodingFace(exposure, isRevealed, held);
      held = index;

      const now = new Array(6).fill(false);
      for (let i = 0; i < 6; i++) {
        if (isRevealed(i) && exposure.visible[i] && i === index) now[i] = true;
        if (now[i] && !decoding[i]) entries[i]++;
        decoding[i] = now[i];
        wasVisible[i] = exposure.visible[i];
      }
      lastRot = getCubeRotation(f / 4000);
    }

    // Une révolution fait passer chaque face deux fois devant la caméra, donc
    // deux décodages au plus — et jamais une rafale de réentrées.
    expect(entries.some((n) => n > 0)).toBe(true);
    for (const n of entries) expect(n).toBeLessThanOrEqual(2);
  });
});

describe("bornes des seuils", () => {
  it("la marge d'hystérésis reste très sous le seuil d'exposition", () => {
    // FRONT_FACE_HYSTERESIS vaut ~0,8° de rotation (les expositions se croisent
    // à ~0,025 par degré). Il doit rester très inférieur au plancher, sans quoi
    // l'hystérésis retiendrait une face à des dizaines de degrés d'écart.
    expect(FRONT_FACE_HYSTERESIS).toBeGreaterThan(0);
    expect(FRONT_FACE_HYSTERESIS).toBeLessThan(FLOOR / 10);
  });

  it("le seuil d'exposition reste dans l'intervalle utile", () => {
    // Ni 0 (le défaut d'origine) ni 1 (aucun label ne décoderait jamais).
    expect(FLOOR).toBeGreaterThan(0);
    expect(FLOOR).toBeLessThanOrEqual(1);
  });
});
