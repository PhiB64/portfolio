/**
 * Tests de la branche `prefers-reduced-motion` de `lib/scramble.js`.
 *
 * Le cas couvert est celui qui ferait échouer une implémentation naïve : avec
 * l'option `cipher`, `scrambleLabel` renvoie normalement une timeline GSAP en
 * boucle infinie (`repeat: -1`) qui re-brouille le label en continu. Sous
 * `prefers-reduced-motion`, il doit rendre une image fixe (les spans sont
 * posés par le `render()` initial) et renvoyer `null` au lieu d'armer la
 * boucle — c'est la seule boucle infinie du projet hors CSS, et c'est
 * exactement ce que la préférence neutralise.
 *
 * Le contrat d'usage est vérifié avec : `stopScramble(null)` est un no-op
 * (c'est ce que les appelants `encodeFaceLabel` / `stopFaceScramble` stockent
 * et tuent), et le décodage borné (`duration`) n'est pas concerné — il finit
 * sur du texte stable et reste piloté par l'exposition.
 *
 * Exécution : `npm test`.
 */

// @vitest-environment jsdom

import { describe, it, expect, afterEach } from "vitest";

import { scrambleLabel, stopScramble } from "./scramble.js";

// `lib/scramble.js` lit la préférence via `lib/reduced-motion.js`, qui lit
// `window` au moment de l'appel : la doublure se change entre deux assertions.
// Environnement jsdom oblige, `window` existe nativement : on ne le remplace
// pas, on ne fait que poser `matchMedia` dessus — et on restaure l'original
// après chaque test plutôt que de supprimer `window` (ce qui casserait le
// test suivant avec « Cannot set properties of undefined »).
const originalMatchMedia = globalThis.window?.matchMedia;
const stubMatchMedia = (matches) => {
  globalThis.window.matchMedia = () => ({ matches, media: "(prefers-reduced-motion: reduce)" });
};

afterEach(() => {
  if (originalMatchMedia === undefined) delete globalThis.window.matchMedia;
  else globalThis.window.matchMedia = originalMatchMedia;
  document.body.innerHTML = "";
});

describe("scrambleLabel sous prefers-reduced-motion", () => {
  it("rend une image fixe sans boucle en mode cipher", () => {
    stubMatchMedia(true);
    const el = document.createElement("div");

    const tl = scrambleLabel(el, "WEB", { cipher: true });

    expect(tl).toBeNull();
    // Le `render()` initial a posé les spans : le label existe, figé.
    expect(el.querySelectorAll("span")).toHaveLength(3);
  });

  it("arme la boucle de re-brouillage sans la préférence", () => {
    stubMatchMedia(false);
    const el = document.createElement("div");

    const tl = scrambleLabel(el, "WEB", { cipher: true });

    expect(tl).not.toBeNull();
    expect(el.querySelectorAll("span")).toHaveLength(3);
    tl.kill();
  });

  it("stopScramble accepte le null stocké par les appelants", () => {
    // C'est le chemin réel : `encodeFaceLabel` stocke le retour de
    // `scrambleLabel`, `stopFaceScramble` le tue avant chaque ré-encodage.
    expect(() => stopScramble(null)).not.toThrow();
    expect(() => stopScramble(undefined)).not.toThrow();
  });

  it("laisse le décodage borné intact sous la préférence", () => {
    // Le décodage n'est pas une boucle : il est piloté par l'exposition et
    // finit sur du texte stable. Le neutraliser figerait le label sur du
    // brouillage — c'est le tick de `hero-cube.jsx` qui court-circuite en
    // amont (texte posé directement), pas cette fonction.
    stubMatchMedia(true);
    const el = document.createElement("div");

    const tl = scrambleLabel(el, "WEB", { duration: 0.01 });

    expect(tl).not.toBeNull();
    tl.kill();
  });
});
