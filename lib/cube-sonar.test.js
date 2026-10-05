import { describe, expect, it } from "vitest";

import { sonarGeometry } from "./cube-sonar";

/**
 * La fonction ne prend que des rectangles, jamais des sélecteurs : elle est donc
 * testable sans DOM, en injectant des objets qui ne savent qu'une chose — rendre
 * leur rectangle.
 */

const rect = (left, top, width, height) => ({ left, top, width, height });
const el = (r) => ({ getBoundingClientRect: () => r });

describe("sonarGeometry — sans point source", () => {
  it("couvre le conteneur depuis son centre", () => {
    // 1000 x 500 : la demi-diagonale vaut hypot(500, 250) = 559.0…, ramenée en
    // pourcentage de la largeur.
    const { maxR, scaleMax } = sonarGeometry(el(rect(0, 0, 1000, 500)));
    expect(maxR).toBeCloseTo(55.90169943749474, 6);
    expect(scaleMax).toBeCloseTo(1.118033988749895, 6);
  });

  it("vaut la moitié de la diagonale en pourcentage de la largeur", () => {
    const { maxR } = sonarGeometry(el(rect(0, 0, 800, 600)));
    const attendu = (Math.hypot(400, 300) / 800) * 100;
    expect(maxR).toBeCloseTo(attendu, 9);
  });

  it("donne le même résultat pour un carré", () => {
    const { maxR, scaleMax } = sonarGeometry(el(rect(0, 0, 400, 400)));
    // Demi-diagonale d'un carré : sa diagonale vaut width * √2, donc 70.71 %.
    expect(maxR).toBeCloseTo(70.71067811865476, 6);
    expect(scaleMax).toBeCloseTo(1.4142135623730951, 6);
  });

  it("ignore la position du conteneur", () => {
    // Seul compte le format : le conteneur est déjà en place sur l'écran.
    const a = sonarGeometry(el(rect(0, 0, 1000, 500)));
    const b = sonarGeometry(el(rect(300, 900, 1000, 500)));
    expect(a).toEqual(b);
  });
});

describe("sonarGeometry — avec point source", () => {
  const racine = () => el(rect(0, 0, 1000, 500));

  it("situe le point à partir de son centre, en relatif au conteneur", () => {
    const { center } = sonarGeometry(racine(), el(rect(200, 100, 100, 100)));
    // Centre du point : 250, 150 — aucune conversion en pourcentage ici.
    expect(center).toEqual({ x: 250, y: 150, dmax: expect.any(Number) });
  });

  it("annule l'origine du conteneur", () => {
    const { center } = sonarGeometry(el(rect(500, 300, 1000, 500)), el(rect(700, 400, 100, 100)));
    expect(center.x).toBe(250);
    expect(center.y).toBe(150);
  });

  it("mesure la distance au coin le plus lointain", () => {
    const r = rect(0, 0, 1000, 500);
    const { center } = sonarGeometry(el(r), el(rect(0, 0, 20, 20)));
    // Coin le plus lointain d'un point quasi en haut à gauche : (1000, 500).
    const attendu = Math.max(
      Math.hypot(10, 10),
      Math.hypot(1000 - 10, 10),
      Math.hypot(10, 500 - 10),
      Math.hypot(1000 - 10, 500 - 10),
    );
    expect(center.dmax).toBe(Math.round(attendu));
  });

  it("trouve le même dmax depuis n'importe quel coin", () => {
    // Les quatre coins doivent donner la même valeur : c'est la garantie que la
    // vague couvre tout le conteneur, où qu'on la déclenche.
    const coins = [
      rect(0, 0, 10, 10),
      rect(990, 0, 10, 10),
      rect(0, 490, 10, 10),
      rect(990, 490, 10, 10),
    ];
    const valeurs = coins.map((c) => sonarGeometry(racine(), el(c)).center.dmax);
    expect(new Set(valeurs).size).toBe(1);
  });

  it("arrondit les coordonnées comme le fait l'original", () => {
    // L'arrondi évite les valeurs à 14 décimales dans un style inline.
    const { center } = sonarGeometry(racine(), el(rect(100, 100, 3, 7)));
    expect(Number.isInteger(center.x)).toBe(true);
    expect(Number.isInteger(center.y)).toBe(true);
    expect(Number.isInteger(center.dmax)).toBe(true);
  });

  it("donne un centre au centre du conteneur pour un point centré", () => {
    const { center } = sonarGeometry(racine(), el(rect(450, 200, 100, 100)));
    expect(center.x).toBe(500);
    expect(center.y).toBe(250);
    expect(center.dmax).toBe(Math.round(Math.hypot(500, 250)));
  });
});