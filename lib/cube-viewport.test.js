// Contrat de fenêtre du cube. Ces tests verrouillent les invariants dont
// dépendent le dimensionnement et l'overlay de rotation — pas la stabilité d'une
// implémentation, mais les propriétés qui doivent rester vraies pour que la
// page reste affichable sur n'importe quel écran.
import { describe, it, expect } from "vitest";
import {
  computeCubeMetrics,
  needsOrientationLock,
  isLandscapeViewport,
  MOBILE_CUBE_MAX_SCALE,
} from "./cube-viewport";

describe("isLandscapeViewport", () => {
  it("classe un paysage large, un portrait haut et un carré", () => {
    expect(isLandscapeViewport(1920, 1080)).toBe(true);
    expect(isLandscapeViewport(390, 844)).toBe(false);
    expect(isLandscapeViewport(1000, 1000)).toBe(false);
  });

  // Le carré parfait est le seul point où `>` et `>=` divergent. Il doit compter
  // comme portrait : c'est le sens qui déclenche le moins d'overlay, et 1 px
  // d'écart decides de l'apparition d'un écran plein.
  it("traite le carré parfait comme portrait", () => {
    expect(isLandscapeViewport(600, 600)).toBe(false);
    expect(isLandscapeViewport(601, 600)).toBe(true);
    expect(isLandscapeViewport(600, 601)).toBe(false);
  });
});

describe("needsOrientationLock", () => {
  it("ne se lève que sur un vrai mobile en paysage", () => {
    expect(needsOrientationLock(844, 390, true)).toBe(true);
    expect(needsOrientationLock(844, 390, false)).toBe(false);
    expect(needsOrientationLock(390, 844, true)).toBe(false);
  });

  // Un portable tactile ou une fenêtre de bureau étroite est capté par
  // `isMobileDevice()` mais pas par `isRealMobileDevice()`. Si le second
  // contrôlait l'overlay, tourner un portable tactile en paysage afficherait
  // « tournez l'appareil » alors qu'il est portable : le message n'a pas de
  // sens. Le premier argument est donc le contrôle STRICT.
  it("exige le contrôle strict, pas le contrôle large", () => {
    // isMobileDevice() serait vrai ici (tactile + fenêtre compacte)…
    const touchLaptopLandscape = [1280, 720];
    expect(isLandscapeViewport(...touchLaptopLandscape)).toBe(true);
    // …mais l'overlay ne doit pas se lever.
    expect(needsOrientationLock(...touchLaptopLandscape, false)).toBe(false);
  });

  it("ne se lève pas sur un mobile en portrait, même au carré", () => {
    expect(needsOrientationLock(390, 844, true)).toBe(false);
    expect(needsOrientationLock(600, 600, true)).toBe(false);
  });
});

describe("computeCubeMetrics", () => {
  it("cale le cube sur le viewport large et le laisse à sa taille nominale", () => {
    const { scale, squareSize } = computeCubeMetrics(1920, 1080, false);
    expect(scale).toBe(1);
    // 343 px = la face projetée à l'échelle 1, pas 300 : c'est le `<svg>` qui
    // doit déclarer cette largeur, sinon le cube est rogné de 13 %.
    expect(squareSize).toBe(343);
  });

  it("bride l'échelle sur mobile sans rétrécir la carte hors écran", () => {
    const { scale, squareSize } = computeCubeMetrics(390, 844, true);
    expect(scale).toBe(MOBILE_CUBE_MAX_SCALE);
    expect(scale).toBeLessThan(1);
    expect(squareSize).toBe(343 * MOBILE_CUBE_MAX_SCALE);
    expect(squareSize).toBeLessThanOrEqual(390);
  });

  it("réduit l'échelle quand la hauteur manque, pas seulement la largeur", () => {
    // 500 × 340 : la largeur laisserait (500-24)/300 = 1,587, la hauteur
    // (340-96)/300 = 0,813. C'est la hauteur qui doit gagner, sinon le cube
    // empiète sur le bandeau SKIP.
    const { scale } = computeCubeMetrics(500, 340, false);
    expect(scale).toBeCloseTo((340 - 96) / 300, 10);
  });

  // La hauteur réservée dépend de l'orientation : 168 px en portrait (bandeau +
  // carte d'intro), 96 px en paysage. À hauteur identique, le paysage est donc
  // plus généreux — sans quoi un téléphone à l'horizontale verrait son cube
  // rétréci alors que la place y est.
  it("réserve moins de hauteur en paysage qu'en portrait", () => {
    // Même hauteur de 260, une fois portrait une fois paysage : c'est la seule
    // dimension qui change, donc l'écart ne peut venir que de la réserve.
    const portrait = computeCubeMetrics(240, 260, false);
    const paysage = computeCubeMetrics(260, 240, false);
    // Portrait : 260-168 = 92 px, donc 0,307…
    expect(portrait.scale).toBeCloseTo(Math.max(120, 260 - 168) / 300, 10);
    expect(portrait.scale).toBeCloseTo(120 / 300, 10);
    // …plancher à 120 px. Paysage : 240-96 = 144 px, soit 0,48.
    expect(paysage.scale).toBeCloseTo((240 - 96) / 300, 10);
    expect(paysage.scale).toBeGreaterThan(portrait.scale);
  });

  // 260 px de haut, c'est plus court que la réserve portrait + le côté du cube.
  // Le plancher de 120 px prend le relais et l'échelle cesse de suivre la
  // hauteur : c'est ce garde-fou qui garantit un cube visible plutôt qu'un
  // cube de 0 px, et il ne mord qu'en dessous de ~460 px de haut.
  it("planchonne la hauteur disponible avant de laisser l'échelle s'effondrer", () => {
    // 200 px de haut : 200-168 = 32, sous le plancher de 120. C'est lui qui
    // décide, et le cube garde 0,4 au lieu de devenir un trait.
    const tresPlat = computeCubeMetrics(100, 200, false);
    expect(tresPlat.scale).toBeCloseTo(120 / 300, 10);
    // 460 px de haut : 460-168 = 292, le plancher ne mord plus.
    const limite = computeCubeMetrics(400, 460, false);
    expect(limite.scale).toBeCloseTo(292 / 300, 10);
    // 468 px : la place devient juste suffisante pour le cube entier.
    const suffisante = computeCubeMetrics(400, 468, false);
    expect(suffisante.scale).toBe(1);
  });

  // Un viewport plus étroit que la marge de 24 px donnerait un terme
  // disponible négatif, et donc une échelle négative : le cube disparaîtrait.
  // Le plancher de 120 px est ce qui empêche ça.
  it("ne descend jamais sous l'échelle plancher, même en fenêtre minuscule", () => {
    for (const [w, h] of [[1, 1], [10, 4000], [4000, 10], [0, 0], [200, 200]]) {
      for (const mobile of [false, true]) {
        const { scale } = computeCubeMetrics(w, h, mobile);
        expect(scale).toBeGreaterThan(0);
        expect(scale).toBeGreaterThanOrEqual(120 / 300 - 1e-12);
      }
    }
  });

  // Le cas où les deux effets se contredisent si l'orientation est lue de deux
  // façons : le carré parfait. `isLandscapeViewport` dit « portrait » (pas de
  // rotation), et le dimensionnement doit donc appliquer la réserve de portrait
  // — 168 px, pas 96. Ce test casse le sens du prédicat si quelqu'un inverse
  // la condition.
  it("garde la rotation et le dimensionnement d'accord sur un écran carré", () => {
    const carre = [700, 700];
    expect(needsOrientationLock(...carre, true)).toBe(false);
    // 700 est assez large pour que seule la réserve décide : 700-168 = 532
    // laisse 1,77, donc rien ne bride l'échelle. Pour que la réserve soit
    // observable il faut un carré plus petit que 300 + 168.
    expect(computeCubeMetrics(...carre, false).scale).toBe(1);
    const petitCarre = [350, 350];
    expect(needsOrientationLock(...petitCarre, true)).toBe(false);
    // 350-168 = 182, et c'est bien le palier de portrait qui s'applique.
    expect(computeCubeMetrics(...petitCarre, false).scale).toBeCloseTo(182 / 300, 10);
  });

  it("produit une largeur de carte strictement positive", () => {
    for (const [w, h] of [[1, 1000], [8, 8], [300, 900], [344, 344]]) {
      const { squareSize } = computeCubeMetrics(w, h, false);
      expect(squareSize).toBeGreaterThanOrEqual(1);
      expect(squareSize).toBeLessThanOrEqual(Math.max(1, w - 8));
    }
  });

  it("ne renvoie que scale et squareSize, tous deux finis", () => {
    for (const [w, h] of [[1920, 1080], [390, 844], [1, 1]]) {
      for (const mobile of [false, true]) {
        const r = computeCubeMetrics(w, h, mobile);
        expect(Object.keys(r).sort()).toEqual(["scale", "squareSize"]);
        expect(Number.isFinite(r.scale)).toBe(true);
        expect(Number.isFinite(r.squareSize)).toBe(true);
      }
    }
  });
});