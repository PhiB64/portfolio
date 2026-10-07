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
  DRAG_EASE_DEG_PER_MS,
  DRAG_EASE_MAX_MS,
  DRAG_EASE_MIN_MS,
  DRAG_INERTIA_MAX_MS,
  DRAG_INERTIA_MAX_SPEED,
  DRAG_INERTIA_SAMPLE_MS,
  DRAG_INERTIA_START_SPEED,
  DRAG_INERTIA_STOP_SPEED,
  DRAG_INERTIA_TAU_MS,
  capDragSpeed,
  dragEaseFactor,
  dragEaseMs,
  dragReleaseVelocity,
  dragSpeed,
  inertiaStep,
  wrapDragOffset,
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
    // Distance : vitesse max × TAU ≈ 336°, moins d'un tour.
    expect(DRAG_INERTIA_MAX_SPEED * DRAG_INERTIA_TAU_MS).toBeLessThan(360);
    // Temps : même le plafond s'éteint avant le garde-fou (ln(1,2/0,02) ≈ 4,1
    // constantes de temps, soit ~1146 ms < 1200 ms).
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

describe("wrapDragOffset — tours complets retirés avant le fondu", () => {
  it("ne change pas un petit offset", () => {
    expect(wrapDragOffset({ rx: 40, ry: -120 })).toEqual({ rx: 40, ry: -120 });
  });

  it("ramène chaque axe dans [−180, 180]", () => {
    const wrapped = wrapDragOffset({ rx: 720 + 30, ry: -360 - 45 });
    expect(wrapped.rx).toBeCloseTo(30, 9);
    expect(wrapped.ry).toBeCloseTo(-45, 9);
  });

  it("borne l'amplitude à effacer : √(180² + 180²) ≈ 254,6° au plus", () => {
    const amp = Math.hypot(
      wrapDragOffset({ rx: 3600, ry: -2880 }).rx,
      wrapDragOffset({ rx: 3600, ry: -2880 }).ry,
    );
    expect(amp).toBeLessThanOrEqual(Math.SQRT2 * 180 + 1e-9);
  });

  it("neutralise une entrée non finie au lieu de contaminer le fondu", () => {
    expect(wrapDragOffset({ rx: NaN, ry: Infinity })).toEqual({ rx: 0, ry: 0 });
  });
});

describe("dragEaseMs — durée proportionnelle à l'amplitude", () => {
  it("garde les 450 ms d'avant sous 90° d'amplitude", () => {
    expect(dragEaseMs({ rx: 0, ry: 0 })).toBe(DRAG_EASE_MIN_MS);
    expect(dragEaseMs({ rx: 90, ry: 0 })).toBe(DRAG_EASE_MIN_MS);
  });

  it("allonge au-delà : la vitesse instantanée ne dépasse jamais le plafond", () => {
    // Pire cas après wrap : 254,6° en ~1273 ms, soit 0,2°/ms en moyenne.
    const worst = Math.SQRT2 * 180;
    expect(dragEaseMs({ rx: 180, ry: 180 })).toBeCloseTo(
      worst / DRAG_EASE_DEG_PER_MS, 6,
    );
    // Le fondu est au moins assez long pour n'avoir jamais à aller plus vite
    // que la vitesse nominale — sur la plage wrappée (le composant wrappe
    // toujours avant d'effacer) ; le plafond garde-fou ne lie que les entrées
    // pathologiques non wrappées, couvertes par le test suivant.
    for (const amp of [90, 180, worst]) {
      expect(dragEaseMs({ rx: amp, ry: 0 })).toBeGreaterThanOrEqual(
        amp / DRAG_EASE_DEG_PER_MS - 1e-9,
      );
    }
  });

  it("est plafonné en garde-fou, même sans wrap préalable", () => {
    expect(dragEaseMs({ rx: 3600, ry: 0 })).toBe(DRAG_EASE_MAX_MS);
  });
});

describe("dragEaseFactor — forme du fondu", () => {
  it("vaut 1 au départ, 0 à l'arrivée, 0,5 à mi-course", () => {
    expect(dragEaseFactor(0)).toBe(1);
    expect(dragEaseFactor(1)).toBe(0);
    expect(dragEaseFactor(0.5)).toBeCloseTo(0.5, 9);
  });

  it("borne ses entrées au lieu de dépasser", () => {
    expect(dragEaseFactor(-2)).toBe(1);
    expect(dragEaseFactor(3)).toBe(0);
  });
});
