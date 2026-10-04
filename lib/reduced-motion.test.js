/**
 * Tests de `lib/reduced-motion.js`.
 *
 * Le module tient en cinq lignes, mais il remplace un `return false` en dur
 * qui rendait toute la préférence système inopérante : l'autoplay de fin, les
 * ondes sonar et les deux `scrollTo` lisses ignoraient `prefers-reduced-motion`.
 * Aucun test, c'est exactement le genre de régression qui repasse inaperçue —
 * elle ne casse rien, elle anime quelqu'un qui a demandé l'inverse.
 *
 * Les cas couverts sont ceux qui font échouer une implémentation naïve :
 * l'absence de `window` (SSR), l'absence de `matchMedia` (navigateur ancien,
 * JSDOM), et le `matches` à `undefined` au lieu de `false`.
 */

import { describe, it, expect, afterEach } from "vitest";

import { reduceMotion, REDUCE_MOTION_QUERY } from "./reduced-motion.js";

// `lib/reduced-motion.js` lit `window` au moment de l'appel, jamais au montage :
// la préférence est donc lue au bon moment, et un test peut la changer entre
// deux assertions. On installe une doublure plutôt qu'un global figé.
const stubMatchMedia = (matches) => {
  const calls = [];
  globalThis.window = {
    matchMedia: (query) => {
      calls.push(query);
      return { matches, media: query };
    },
  };
  return calls;
};

afterEach(() => {
  delete globalThis.window;
});

describe("reduceMotion", () => {
  it("lit la media query de préférence", () => {
    const calls = stubMatchMedia(true);

    reduceMotion();

    expect(calls).toContain(REDUCE_MOTION_QUERY);
    expect(REDUCE_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
  });

  it("reflète l'état de la préférence", () => {
    stubMatchMedia(true);
    expect(reduceMotion()).toBe(true);

    stubMatchMedia(false);
    expect(reduceMotion()).toBe(false);
  });

  it("relit la préférence à chaque appel, pas au montage", () => {
    // C'est le contrat qui autorise un visiteur à changer le réglage système en
    // cours de page : la séquence armée ensuite doit en tenir compte, sans
    // rechargement. Une version qui mettait en cache le premier résultat
    // échouerait ici.
    stubMatchMedia(false);
    expect(reduceMotion()).toBe(false);

    stubMatchMedia(true);
    expect(reduceMotion()).toBe(true);
  });

  it("reste faux sans window (rendu serveur)", () => {
    delete globalThis.window;
    expect(reduceMotion()).toBe(false);
  });

  it("reste faux sans matchMedia", () => {
    globalThis.window = {};
    expect(reduceMotion()).toBe(false);
  });

  it("ne fige pas la page sur une doublure partielle", () => {
    // `matches` undefined : ni `true` ni `false`. Un `return query.matches`
    // laisserait passer `undefined`, qui est falsy — donc équivalent ici — mais
    // un `=== true` explicite tient la promesse du type booléen.
    stubMatchMedia(undefined);
    expect(reduceMotion()).toBe(false);
  });
});