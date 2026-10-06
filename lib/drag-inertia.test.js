/**
 * Tests de `lib/drag-inertia.js`.
 *
 * Pourquoi ce fichier existe : l'inertie décide de QUOI glisse après le
 * relâchement — vitesse mesurée, plafond, décroissance — et ces trois choix en
 * fixent deux propriétés mesurables : la distance totale (vitesse × TAU, jamais
 * plus) et l'indépendance au framerate (deux demi-pas valent un pas). Ces tests
 * épinglent ce contrat, pas des valeurs d'écran.
 *
 * Exécution : `npm test`.
 */

import { describe, it, expect } from "vitest";

import {
  DRAG_INERTIA_MAX_MS,
  DRAG_INERTIA_MAX_SPEED,
  DRAG_INERTIA_SAMPLE_MS,
  DRAG_INERTIA_START_SPEED,
  DRAG_INERTIA_STOP_SPEED,
  DRAG_INERTIA_TAU_MS,
  capDragSpeed,
  dragReleaseVelocity,
  dragSpeed,
  inertiaStep,
} from "./drag-inertia.js";

describe("constantes de la glisse", () => {
  it("classe les seuils dans l'ordre qui fait glisser le jet et pas la pose", () => {
    // Une pose (~0) ne part pas, un jet franc (~0,5) part, un jet plafonné (1,2)
    // ne dépasse jamais le plafond, et l'extinction (~0,02) est sous le seuil
    // de déclenchement : la glisse s'éteint toujours APRES être partie.
    expect(DRAG_INERTIA_STOP_SPEED).toBeLessThan(DRAG_INERTIA_START_SPEED);
    expect(DRAG_INERTIA_START_SPEED).toBeLessThan(DRAG_INERTIA_MAX_SPEED);
    expect(DRAG_INERTIA_MAX_SPEED).toBe(1.2);
    expect(DRAG_INERTIA_START_SPEED).toBe(0.08);
    expect(DRAG_INERTIA_STOP_SPEED).toBe(0.02);
  });

  it("borne la glisse dans le temps comme en distance", () => {
    // Distance : vitesse max × TAU ≈ 216°, moins d'un tour.
    expect(DRAG_INERTIA_MAX_SPEED * DRAG_INERTIA_TAU_MS).toBeLessThan(360);
    // Temps : même le plafond s'éteint avant le garde-fou (ln(1,2/0,02) ≈ 4,1
    // constantes de temps, soit ~740 ms < 1200 ms).
    expect(DRAG_INERTIA_TAU_MS * Math.log(DRAG_INERTIA_MAX_SPEED / DRAG_INERTIA_STOP_SPEED))
      .toBeLessThan(DRAG_INERTIA_MAX_MS);
    // Fenêtre d'estimation plus courte que la glisse : le geste ne contamine
    // pas sa propre mesure.
    expect(DRAG_INERTIA_SAMPLE_MS).toBeLessThan(DRAG_INERTIA_TAU_MS);
  });
});

describe("dragReleaseVelocity — vitesse au relâchement", () => {
  it("mesure la pente sur la fenêtre, pas sur tout le geste", () => {
    const samples = [
      { t: 0, rx: 0, ry: 0 },
      { t: 499, rx: 10, ry: 0 },
      { t: 560, rx: 12, ry: 0 },
      { t: 620, rx: 42, ry: 0 },
    ];
    // Fenêtre 120 ms : ne retient que [560, 620], donc (42 − 12) / 60.
    const v = dragReleaseVelocity(samples);
    expect(v.rx).toBeCloseTo(0.5, 6);
    expect(v.ry).toBe(0);
  });

  it("rend une vitesse nulle sur un geste qui s'est arrêté avant de lâcher", () => {
    const samples = [
      { t: 0, rx: 0, ry: 0 },
      { t: 100, rx: 50, ry: 20 },
      { t: 200, rx: 50, ry: 20 },
      { t: 300, rx: 50, ry: 20 },
    ];
    // Tout tient dans la fenêtre, premier = dernier : pas de déplacement.
    expect(dragReleaseVelocity(samples)).toEqual({ rx: 0, ry: 0 });
  });

  it("exige deux échantillons espacés dans le temps", () => {
    expect(dragReleaseVelocity([])).toEqual({ rx: 0, ry: 0 });
    expect(dragReleaseVelocity([{ t: 10, rx: 5, ry: 3 }])).toEqual({ rx: 0, ry: 0 });
    expect(
      dragReleaseVelocity([
        { t: 10, rx: 5, ry: 3 },
        { t: 10, rx: 9, ry: 4 },
      ]),
    ).toEqual({ rx: 0, ry: 0 });
  });
});

describe("capDragSpeed — plafond de la glisse", () => {
  it("laisse passer les jets ordinaires intacts", () => {
    expect(capDragSpeed({ rx: 0.5, ry: 0.2 })).toEqual({ rx: 0.5, ry: 0.2 });
  });

  it("plafonne la norme en gardant la direction", () => {
    const capped = capDragSpeed({ rx: 3, ry: 4 });
    expect(dragSpeed(capped)).toBeCloseTo(DRAG_INERTIA_MAX_SPEED, 9);
    // (3, 4) → norme 5, facteur 1,2/5 : direction conservée.
    expect(capped.rx).toBeCloseTo(0.72, 9);
    expect(capped.ry).toBeCloseTo(0.96, 9);
  });
});

describe("inertiaStep — décroissance exponentielle exacte", () => {
  it("parcourt vitesse × TAU au total, sans dépasser", () => {
    // Somme de 10 000 micro-pas : l'intégrale discrète rejoint l'analytique.
    let v = { rx: 0.5, ry: -0.25 };
    let total = { rx: 0, ry: 0 };
    for (let i = 0; i < 10000; i++) {
      const { step, vel } = inertiaStep(v, 1);
      total = { rx: total.rx + step.rx, ry: total.ry + step.ry };
      v = vel;
    }
    expect(total.rx).toBeCloseTo(0.5 * DRAG_INERTIA_TAU_MS, 3);
    expect(total.ry).toBeCloseTo(-0.25 * DRAG_INERTIA_TAU_MS, 3);
    expect(dragSpeed(v)).toBeLessThan(DRAG_INERTIA_STOP_SPEED);
  });

  it("est indépendant du framerate : deux demi-pas valent un pas entier", () => {
    const v = { rx: 0.9, ry: 0.4 };
    const whole = inertiaStep(v, 16.67);
    const half1 = inertiaStep(v, 16.67 / 2);
    const half2 = inertiaStep(half1.vel, 16.67 / 2);
    expect(half1.step.rx + half2.step.rx).toBeCloseTo(whole.step.rx, 9);
    expect(half1.step.ry + half2.step.ry).toBeCloseTo(whole.step.ry, 9);
    expect(half2.vel.rx).toBeCloseTo(whole.vel.rx, 9);
    expect(half2.vel.ry).toBeCloseTo(whole.vel.ry, 9);
  });

  it("ne recule jamais, même sur un dt nul ou négatif", () => {
    expect(inertiaStep({ rx: 1, ry: 1 }, 0).step).toEqual({ rx: 0, ry: 0 });
    expect(inertiaStep({ rx: 1, ry: 1 }, -5).step).toEqual({ rx: 0, ry: 0 });
    // dt = 0 : la vitesse est rendue intacte, le pas est nul.
    expect(inertiaStep({ rx: 1, ry: 1 }, 0).vel).toEqual({ rx: 1, ry: 1 });
  });
});
