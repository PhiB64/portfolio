/**
 * Tests des aides vocales (`voice.js`).
 *
 * Why ces tests. La détection du support se joue sur `window`, qui n'existe
 * pas en SSR et varie d'un navigateur à l'autre : une régression ici affiche
 * un micro muet (Firefox) ou masque un micro qui marchait (Chrome). Le choix
 * de la voix décide de l'accent de lecture : sans test, une voix anglaise
 * lirait la page française sans que rien ne casse à la compilation.
 *
 * Exécution : `npm test`.
 */

import { describe, it, expect, afterEach } from "vitest";

import {
  getRecognitionCtor,
  isRecognitionSupported,
  isSynthesisSupported,
  pickVoice,
  speechLocale,
} from "./voice.js";

afterEach(() => {
  delete globalThis.window;
});

describe("speechLocale", () => {
  it("parle français sur la page française", () => {
    expect(speechLocale("fr")).toBe("fr-FR");
  });

  it("parle anglais sur la page anglaise", () => {
    expect(speechLocale("en")).toBe("en-US");
  });

  it("replie sur l'anglais pour une langue inconnue", () => {
    // Comme `resolveLocale` : l'anglais est la langue par défaut, une langue
    // inconnue parle donc anglais plutôt que de se taire.
    expect(speechLocale("de")).toBe("en-US");
  });
});

describe("pickVoice", () => {
  it("préfère la voix exacte à la voix de repli", () => {
    const exact = { lang: "fr-FR", name: "Thomas" };
    const fallback = { lang: "fr-CA", name: "Amélie" };
    expect(pickVoice([fallback, exact], "fr")).toBe(exact);
  });

  it("prend la première voix de la langue sans exacte", () => {
    const canadian = { lang: "fr-CA", name: "Amélie" };
    expect(pickVoice([canadian], "fr")).toBe(canadian);
  });

  it("choisit l'anglais américain en premier sur la page anglaise", () => {
    const british = { lang: "en-GB", name: "George" };
    const american = { lang: "en-US", name: "Samantha" };
    expect(pickVoice([british, american], "en")).toBe(american);
  });

  it("rend null sans voix, sans correspondance ou sans langue", () => {
    expect(pickVoice([], "fr")).toBeNull();
    expect(pickVoice([{ lang: "de-DE" }], "fr")).toBeNull();
    // Une voix sans `lang` ne dit pas ce qu'elle parle : on l'ignore plutôt
    // que de la faire lire une langue qu'elle n'a pas.
    expect(pickVoice([{ name: "Mystère" }], "fr")).toBeNull();
  });
});

describe("détection du support", () => {
  it("ne propose rien sans `window` (SSR)", () => {
    expect(isRecognitionSupported()).toBe(false);
    expect(isSynthesisSupported()).toBe(false);
    expect(getRecognitionCtor()).toBeNull();
  });

  it("propose la dictée avec le constructeur standard", () => {
    const SpeechRecognition = class {};
    globalThis.window = { SpeechRecognition };
    expect(getRecognitionCtor()).toBe(SpeechRecognition);
    expect(isRecognitionSupported()).toBe(true);
  });

  it("propose la dictée avec le préfixe Safari", () => {
    // Safari expose `webkitSpeechRecognition` : sans cette branche, le micro
    // resterait masqué sur iPhone, là où la dictée sert le plus.
    const webkitSpeechRecognition = class {};
    globalThis.window = { webkitSpeechRecognition };
    expect(getRecognitionCtor()).toBe(webkitSpeechRecognition);
    expect(isRecognitionSupported()).toBe(true);
  });

  it("exige les deux moitiés de la synthèse vocale", () => {
    globalThis.window = {};
    expect(isSynthesisSupported()).toBe(false);

    globalThis.window = { speechSynthesis: {} };
    expect(isSynthesisSupported()).toBe(false);

    globalThis.window = {
      speechSynthesis: {},
      SpeechSynthesisUtterance: class {},
    };
    expect(isSynthesisSupported()).toBe(true);
  });
});
