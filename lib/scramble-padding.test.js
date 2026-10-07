/**
 * Tests de `lib/scramble.js` : le départ brouillé commun et son extinction
 * symétrique.
 *
 * Tous les labels démarrent sur la même largeur brouillée — le max calculé des
 * six (`scrambleBaseLength`), bourrage réparti moitié-moitié autour du mot —
 * puis le surplus s'éteint par paires (une à gauche pour une à droite), du
 * bord vers le mot, une fois les lettres résolues. Le bloc se resserre donc
 * sur son centre (le conteneur est en flex centré) au lieu de sauter d'un
 * côté.
 *
 * Exécution : `npm test`.
 */

// @vitest-environment jsdom

import { describe, it, expect, afterEach } from "vitest";

import {
  paddedScrambleLength,
  scrambleBaseLength,
  scrambleLabel,
} from "./scramble.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("scrambleBaseLength", () => {
  it("rend le max des libellés, sans rien écrire en dur", () => {
    // FR et EN : le max est 8 dans les deux langues aujourd'hui — mais c'est
    // le calcul qui est verrouillé, pas le 8.
    expect(scrambleBaseLength(["WEB", "REACT", "BACKEND", "DATABASE", "MOBILE", "PROJETS"])).toBe(8);
    expect(scrambleBaseLength(["WEB", "REACT", "BACKEND", "DATABASE", "MOBILE", "PROJECTS"])).toBe(8);
  });

  it("suit un libellé qui change", () => {
    expect(scrambleBaseLength(["WEB", "SUPERCALIFRAGILISTIC"])).toBe(20);
  });

  it("ne compte pas les sauts de ligne", () => {
    expect(scrambleBaseLength(["A\nB"])).toBe(2);
  });

  it("rend 0 sans libellés", () => {
    expect(scrambleBaseLength([])).toBe(0);
    expect(scrambleBaseLength(null)).toBe(0);
  });
});

describe("paddedScrambleLength", () => {
  it("répartit le surplus moitié-moitié", () => {
    // WEB (3) sur base 8 : surplus 5, impair → +1 → 6, soit 3 de chaque côté.
    expect(paddedScrambleLength(3, 8)).toEqual({ total: 9, left: 3, right: 3 });
    // REACT (5) sur base 8 : surplus 3 → +1 → 4, soit 2 de chaque côté.
    expect(paddedScrambleLength(5, 8)).toEqual({ total: 9, left: 2, right: 2 });
  });

  it("ne bourre pas le mot le plus long", () => {
    expect(paddedScrambleLength(8, 8)).toEqual({ total: 8, left: 0, right: 0 });
  });

  it("ne descend jamais sous le texte", () => {
    expect(paddedScrambleLength(8, 5)).toEqual({ total: 8, left: 0, right: 0 });
  });
});

describe("scrambleLabel avec départ commun", () => {
  it("démarre WEB sur 9 spans (3 + 3 + 3) en cipher", () => {
    const el = document.createElement("div");

    const tl = scrambleLabel(el, "WEB", { cipher: true, scrambleLength: 8 });

    expect(el.querySelectorAll("span")).toHaveLength(9);
    // Tout brouille : le mot n'est pas lisible dans la phase codée.
    expect(el.textContent).not.toContain("WEB");
    tl.kill();
  });

  it("laisse DATABASE à 8 spans, sans bourrage", () => {
    const el = document.createElement("div");

    const tl = scrambleLabel(el, "DATABASE", { cipher: true, scrambleLength: 8 });

    expect(el.querySelectorAll("span")).toHaveLength(8);
    tl.kill();
  });

  it("finit sur le mot seul, bourrage replié", () => {
    const el = document.createElement("div");

    const tl = scrambleLabel(el, "WEB", { duration: 0.01, scrambleLength: 8 });
    tl.progress(1);

    expect(el.textContent).toBe("WEB");
    const spans = [...el.querySelectorAll("span")];
    const folded = spans.filter((s) => s.style.width === "0px" && s.style.opacity === "0");
    expect(folded).toHaveLength(6);
    tl.kill();
  });

  it("éteint les paires ensemble, du bord vers le mot", () => {
    // La symétrie se lit dans le DOM : en avançant la tween, les bourrages
    // meurent par paires extérieures → intérieures — jamais un côté seul.
    // `width: 0px` = span replié (le DOM normalise le "0" posé par `render`).
    const el = document.createElement("div");
    const tl = scrambleLabel(el, "WEB", { duration: 10, scrambleLength: 8 });
    const folded = () =>
      [...el.querySelectorAll("span")].map((s) => s.style.width === "0px");
    // folded[0..2] = pads gauches (bord → mot), [3..5] = lettres,
    // [6..8] = pads droits (mot → bord). L'easing `power2.inOut` tasse la
    // marge en fin de course : les paires meurent à ~0.55 / ~0.60 / ~0.65.
    tl.progress(0.55);
    expect(folded()).toEqual([true, false, false, false, false, false, false, false, true]);
    tl.progress(0.60);
    expect(folded()).toEqual([true, true, false, false, false, false, false, true, true]);
    tl.progress(1);
    expect(folded()).toEqual([true, true, true, false, false, false, true, true, true]);
    expect(el.textContent).toBe("WEB");
    tl.kill();
  });

  it("reste à longueur réelle sans scrambleLength", () => {
    const el = document.createElement("div");

    const tl = scrambleLabel(el, "WEB", { cipher: true });

    expect(el.querySelectorAll("span")).toHaveLength(3);
    tl.kill();
  });
});
