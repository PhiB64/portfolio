/**
 * Tests de `lib/scramble.js` sous `prefers-reduced-motion`.
 *
 * En mode `cipher`, `scrambleLabel` arme une timeline GSAP en boucle infinie
 * (`repeat: -1`) qui re-brouille le label en continu jusqu'à ce que l'appelant
 * la tue pour lancer le décodage.
 *
 * Ces tests verrouillent l'arbitrage explicite : cette boucle tourne aussi sous
 * `prefers-reduced-motion`. Un label encodé figé se lisait comme un texte mort
 * plutôt que comme du bruit en attente de résolution — l'effet « c'est codé, ça
 * va se décoder » a été jugé plus important que l'absence de scintillement.
 *
 * Le décodage borné (`duration`) n'est pas concerné : il n'a jamais été une
 * boucle, il est piloté par l'exposition et finit sur du texte stable.
 *
 * Exécution : `npm test`.
 */

// @vitest-environment jsdom

import { describe, it, expect, afterEach } from "vitest";

import { scrambleLabel, stopScramble } from "./scramble.js";

// `lib/reduced-motion.js` lit `window` au moment de l'appel : la doublure se
// change entre deux assertions. Environnement jsdom oblige, `window` existe
// nativement : on ne le remplace pas, on ne fait que poser `matchMedia` dessus —
// et on restaure l'original après chaque test plutôt que de supprimer `window`
// (ce qui casserait le test suivant avec « Cannot set properties of
// undefined »).
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
  it("arme la boucle de re-brouillage malgré la préférence", () => {
    stubMatchMedia(true);
    const el = document.createElement("div");

    const tl = scrambleLabel(el, "WEB", { cipher: true });

    // La préférence ne fige plus le mode cipher : une timeline est bien rendue
    // (et non `null`), le label s'anime jusqu'au décodage.
    expect(tl).not.toBeNull();
    expect(el.querySelectorAll("span")).toHaveLength(3);
    tl.kill();
  });

  it("arme la même boucle sans la préférence", () => {
    stubMatchMedia(false);
    const el = document.createElement("div");

    const tl = scrambleLabel(el, "WEB", { cipher: true });

    expect(tl).not.toBeNull();
    expect(el.querySelectorAll("span")).toHaveLength(3);
    tl.kill();
  });

  it("stopScramble accepte le null stocké par les appelants", () => {
    // C'est le chemin réel : `encodeFaceLabel` stocke le retour de
    // `scrambleLabel`, `stopFaceScramble` le tue avant chaque ré-encodage. Le
    // tolérant à `null` reste nécessaire : c'est `undefined`, pas `null`, qui
    // représente « aucune animation » dans ces refs.
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