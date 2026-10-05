import { describe, expect, it } from "vitest";

import {
  SQUARE_POINTS,
  MOUSE_POINTS,
  W,
  TOTAL,
  INTRO_END,
  CUBE_END,
  SHOW_START,
  SHOW_END,
  SPIN_START,
  SPIN_END,
  LINE_POS,
  NAMES_START,
  NAMES_END,
  CUBE_RANGE,
  ROT_END,
  interpolatePoints,
} from "./cube-timeline";

/**
 * Ces tests sont un contrat, pas une couverture.
 *
 * La timeline du cube est une timeline `anime.js` en `autoplay: false`, pilotée
 * par une seule ligne : `tl.seek(tlP * TOTAL)`. Chaque valeur ci-dessous est
 * donc un instants sur l'écran du visiteur — décaler `SPIN_START` d'un point
 * suffit à étirer la fenêtre de fondu des visuels et à rogner le spin.
 *
 * Les nombres sont épinglés tels qu'ils.sortaient du composant, avant extraction,
 * pour que le déplacement soit prouvé sans débat. Les relations entre eux
 * sont testées en plus des valeurs, parce qu'un jeu de nombres peut être
 * recalculé sans être faux : c'est l'ordre des phases qu'il faut protéger.
 */

describe("poids de la timeline", () => {
  it("conserve chaque durée de phase", () => {
    expect(W).toEqual({
      wheelFade: 200,
      morph: 1600,
      fadeIn: 120,
      idle: 5000,
      showcase: 3200,
      facesOut: 900,
      cubeFade: 600,
      spin: 3000,
      squareIn: 250,
      cubeOut: 500,
      lineMorph: 900,
      namesRise: 1500,
    });
  });

  it("donne une durée totale inchangée", () => {
    expect(TOTAL).toBe(17770);
  });

  it("place les frontières aux mêmes positions qu'avant extraction", () => {
    // Valeurs relevées dans `hero-cube.jsx` avant le découpage.
    expect(INTRO_END).toBeCloseTo(0.1080472706809229, 12);
    expect(CUBE_END).toBeCloseTo(0.38942037141249297, 12);
    expect(SHOW_START).toBeCloseTo(0.38942037141249297, 12);
    expect(SHOW_END).toBeCloseTo(0.5694991558806978, 12);
    expect(SPIN_START).toBeCloseTo(0.6539110861001688, 12);
    expect(SPIN_END).toBeCloseTo(0.8227349465391108, 12);
    expect(LINE_POS).toBe(15370);
    expect(NAMES_START).toBeCloseTo(0.915588069780529, 12);
    expect(NAMES_END).toBe(1);
    expect(CUBE_RANGE).toBeCloseTo(0.8919527293190771, 12);
    expect(ROT_END).toBeCloseTo(0.8012618296529969, 12);
  });

  it("garde les phases dans l'ordre et sans trou", () => {
    expect(INTRO_END).toBeGreaterThan(0);
    expect(INTRO_END).toBeLessThan(CUBE_END);
    expect(CUBE_END).toBe(SHOW_START);
    expect(SHOW_START).toBeLessThan(SHOW_END);
    expect(SHOW_END).toBeLessThan(SPIN_START);
    expect(SPIN_START).toBeLessThan(SPIN_END);
    expect(SPIN_END).toBeLessThan(NAMES_START);
    expect(NAMES_START).toBeLessThan(NAMES_END);
    expect(NAMES_END).toBe(1);
  });

  it("ouvre la rotation après l'intro, jamais avant", () => {
    // `CUBE_RANGE` est ce qui reste du scroll une fois l'intro retiré : s'il
    // change, la rotation du cube est recalée sur toute la page.
    expect(INTRO_END + CUBE_RANGE).toBeCloseTo(1, 12);
    // `ROT_END` est la borne haute de la pose de base pendant la galerie du
    // skip : elle doit rester sous 1, faute de quoi une pose dépasserait la fin
    // du spin.
    expect(ROT_END).toBeGreaterThan(0);
    expect(ROT_END).toBeLessThan(1);
  });

  it("fait sommer les poids exactement comme la somme totale", () => {
    // Un piège réel du fichier d'origine : toute phase ajoutée à `W` sans être
    // ajoutée à `TOTAL` étire la timeline sans que rien ne le signale.
    const somme = Object.values(W).reduce((t, d) => t + d, 0);
    expect(somme).toBe(TOTAL);
  });

  it("donne une durée positive à chaque phase", () => {
    for (const [nom, duree] of Object.entries(W)) {
      expect(duree, nom).toBeGreaterThan(0);
    }
  });

  it("exprime LINE_POS en millisecondes, contrairement aux autres bornes", () => {
    // Cas particulier, et vrai : `LINE_POS` alimente un `seek` en ms, les autres
    // bornes sont des ratios de progression. Le test verrouille l'écart de unité
    // pour qu'un futur « harmonisation » ne passe pas inaperçu.
    expect(LINE_POS).toBe(TOTAL - (W.lineMorph + W.namesRise));
    expect(LINE_POS).toBeGreaterThan(1);
  });
});

describe("polygones de fin d'animation", () => {
  it("garde 24 sommets sur chacun des deux polygones", () => {
    // `interpolatePoints` indexe le tableau de destination sans vérifier sa
    // longueur : deux polygones de tailles différentes planteraient à l'exécution.
    expect(SQUARE_POINTS.split(" ")).toHaveLength(24);
    expect(MOUSE_POINTS.split(" ")).toHaveLength(24);
  });
});

describe("interpolatePoints", () => {
  const points = (s) => s.split(" ").map((p) => p.split(",").map(Number));

  it("renvoie le carré exact au début", () => {
    // Pas d'identité de chaîne : `toFixed(1)` normalise toujours, donc `t = 0`
    // redonne « 0.0,0.0 » et non « 0,0 ». Ce qui doit être exact, ce sont les
    // coordonnées — c'est ce que lit ensuite le chemin SVG.
    expect(points(interpolatePoints(SQUARE_POINTS, MOUSE_POINTS, 0))).toEqual(
      points(SQUARE_POINTS),
    );
  });

  it("arrive sur les coordonnées de la souris à la fin", () => {
    const t = interpolatePoints(SQUARE_POINTS, MOUSE_POINTS, 1);
    expect(points(t)).toEqual(points(MOUSE_POINTS));
    expect(t.split(" ")).toHaveLength(24);
  });

  it("garde 24 sommets à toute valeur intermédiaire", () => {
    for (const t of [0.13, 0.5, 0.42, 0.99]) {
      expect(interpolatePoints(SQUARE_POINTS, MOUSE_POINTS, t).split(" ")).toHaveLength(24);
    }
  });

  it("avance sans jamais dépasser la cible", () => {
    // Le carré glisse vers la silhouette : aucune coordonnée ne peut franchir sa
    // destination, sinon la ligne de fin sortirait de la forme attendue.
    const from = points(SQUARE_POINTS);
    const to = points(MOUSE_POINTS);
    for (const t of [0.25, 0.5, 0.75]) {
      const mid = points(interpolatePoints(SQUARE_POINTS, MOUSE_POINTS, t));
      mid.forEach(([mx, my], i) => {
        for (const [axis, m, f, toV] of [["x", mx, from[i][0], to[i][0]], ["y", my, from[i][1], to[i][1]]]) {
          const bas = Math.min(f, toV) - 0.05;
          const haut = Math.max(f, toV) + 0.05;
          expect(m, `${axis} @${t}`).toBeGreaterThanOrEqual(bas);
          expect(m, `${axis} @${t}`).toBeLessThanOrEqual(haut);
        }
      });
    }
  });
});