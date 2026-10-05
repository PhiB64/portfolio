import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isMobileDevice, isRealMobileDevice, MOBILE_USER_AGENT } from "./device";

/**
 * La différence entre les deux prédicats n'est pas un détail de style : c'est une
 * contrainte d'orientation.
 *
 * `isMobileDevice` est volontairement large — tactile + fenêtre compacte — parce
 * qu'elle sert à choisir des densités et des durées. `isRealMobileDevice` est
 * strict — User-Agent seulement — parce qu'elle déclenche le verrou
 * d'orientation. Appliquer le contrôle large à ce verrou affichait « tournez
 * votre appareil » sur un Portable tactile et sur une fenêtre de bureau étroite,
 * alors que ni l'un ni l'autre ne se tourne.
 *
 * Ces tests verrouillent cette frontière.
 */

const windowReel = globalThis.window;

beforeEach(() => {
  delete globalThis.window;
});

afterEach(() => {
  globalThis.window = windowReel;
});

/** Installe un `window` minimal. */
function fenetre({ userAgent = "", touch = false, coarse = false, w = 1440, h = 900, uaData = null } = {}) {
  globalThis.window = {
    navigator: { userAgent, maxTouchPoints: touch ? 5 : 0, userAgentData: uaData },
    innerWidth: w,
    innerHeight: h,
    matchMedia: (q) => ({ matches: coarse && q.includes("pointer: coarse") }),
  };
  if (touch) globalThis.window.ontouchstart = null;
}

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

describe("détection d'appareil", () => {
  it("reconnaît l'User-Agent mobile, et lui seul", () => {
    expect(MOBILE_USER_AGENT.test(IPHONE)).toBe(true);
    expect(MOBILE_USER_AGENT.test(DESKTOP)).toBe(false);
  });

  it("reste muet sans window, pour ne pas casser le rendu serveur", () => {
    expect(isMobileDevice()).toBe(false);
    expect(isRealMobileDevice()).toBe(false);
  });

  it("ne confond pas un bureau sans tactile avec un mobile", () => {
    fenetre({ userAgent: DESKTOP });
    expect(isMobileDevice()).toBe(false);
    expect(isRealMobileDevice()).toBe(false);
  });

  it("accepte un User-Agent mobile même sans tactile déclaré", () => {
    // Un iPad récent se déclare desktop et n'expose pas maxTouchPoints : sans
    // cette branche il serait traité comme un ordinateur.
    fenetre({ userAgent: IPHONE, touch: false, w: 1024, h: 1366 });
    expect(isMobileDevice()).toBe(true);
    expect(isRealMobileDevice()).toBe(true);
  });

  it("accepte `userAgentData.mobile` quand l'User-Agent ne dit rien", () => {
    fenetre({ userAgent: DESKTOP, uaData: { mobile: true } });
    expect(isMobileDevice()).toBe(true);
    expect(isRealMobileDevice()).toBe(true);
  });

  it("traite le tactile comme mobile seulement en fenêtre compacte", () => {
    fenetre({ userAgent: DESKTOP, touch: true, w: 800, h: 600 });
    expect(isMobileDevice()).toBe(true);
    // …et c'est ici que les deux prédicats divergent, pour de bonnes raisons.
    expect(isRealMobileDevice()).toBe(false);
  });

  it("ne retient pas un tactile dans une grande fenêtre", () => {
    // Un Portable tactile, ou une fenêtre de bureau étirée en largeur.
    fenetre({ userAgent: DESKTOP, touch: true, w: 1680, h: 1050 });
    expect(isMobileDevice()).toBe(false);
  });

  it("exige les deux côtés compacts, pas la seule largeur", () => {
    // `Math.max(innerWidth, innerHeight) <= 1100` équivaut à « les deux côtés
    // tiennent dans le seuil ». Le cas(height) est celui qui compte : une
    // fenêtre large et basse ne doit pas être prise pour un mobile.
    fenetre({ userAgent: DESKTOP, coarse: true, w: 834, h: 1000 });
    expect(isMobileDevice()).toBe(true);
    fenetre({ userAgent: DESKTOP, coarse: true, w: 500, h: 1101 });
    expect(isMobileDevice()).toBe(false);
  });

  it("mesure la compacité aux deux côtés", () => {
    fenetre({ userAgent: DESKTOP, coarse: true, w: 1100, h: 1100 });
    expect(isMobileDevice()).toBe(true);
    fenetre({ userAgent: DESKTOP, coarse: true, w: 1101, h: 1101 });
    expect(isMobileDevice()).toBe(false);
  });

  it("survit à un navigateur sans matchMedia", () => {
    globalThis.window = {
      navigator: { userAgent: DESKTOP, maxTouchPoints: 5 },
      innerWidth: 500,
      innerHeight: 500,
    };
    // `ontouchstart` est présent ici, et la fenêtre est compacte : le tactile
    // suffit, sans besoin du media query.
    expect(isMobileDevice()).toBe(true);
  });

  it("traite un User-Agent vide comme un bureau", () => {
    fenetre({ userAgent: "" });
    expect(isMobileDevice()).toBe(false);
    expect(isRealMobileDevice()).toBe(false);
  });
});