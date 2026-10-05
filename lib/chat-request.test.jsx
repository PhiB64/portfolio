/**
 * Tests du cycle de vie d'une requête du panneau de discussion.
 *
 * Le composant lui-même n'est pas monté : ces tests portent sur la mécanique de
 * requête qu'il porte, extraite dans `lib/chat-request.js`. Trois propriétés y
 * vivent, et aucune n'est visible à l'écran :
 *
 * 1. **La course sur le contrôleur d'annulation.** Le `finally` d'un envoi
 *    effaçait `abortRef` sans vérifier qu'il était encore le sien. Un envoi
 *    plus récent pouvait donc devenir inannulable — sa requête partait au bout,
 *    consommait un jeton du quota du visiteur, et écrivait dans une conversation
 *    qui n'était plus la sienne.
 *
 * 2. **Le délai.** Sans plafond côté client, un amont ouvert et muet laissait le
 *    widget en attente indéfiniment, bulle vide et sans message : le visiteur
 *    n'avait aucun moyen de savoir que la réponse était perdue.
 *
 * 3. **La distinction des deux causes d'annulation.** Fermeture du panneau et
 *    expiration du délai produisent la même `AbortError`. Traitées identiquement,
 *    une panne du service s'affichait comme un geste du visiteur, donc en
 *    silence.
 *
 * Exécution : `npm test`.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createRequestSlot } from "./chat-request.js";

/** Flux SSE minimal : une trame de contenu, puis `[DONE]`. */
function sseStream(text) {
  const encoder = new TextEncoder();
  const frame = `data: ${JSON.stringify({
    choices: [{ index: 0, delta: { content: text } }],
  })}\n\n`;
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(frame));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

let fetchSpy;

beforeEach(() => {
  fetchSpy = vi.fn(async () => new Response(sseStream("Bonjour."), { status: 200 }));
  vi.stubGlobal("fetch", fetchSpy);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("course sur le contrôleur", () => {
  it("laisse un envoi plus récent annulable malgré le `finally` d'un envoi plus ancien", async () => {
    // Le scénario exact du bug : le premier `send` est résolu après que le
    // second a pris la main sur le contrôleur.
    const slot = createRequestSlot();

    const premier = slot.begin();
    const second = slot.begin();

    premier.finish();

    // Le `finally` du premier envoi ne doit pas avoir volé la référence.
    expect(slot.isCurrent(second)).toBe(true);

    second.finish();
    expect(slot.isCurrent(second)).toBe(false);
  });

  it("ne libère la référence que si elle est encore la sienne", () => {
    const slot = createRequestSlot();
    const a = slot.begin();
    const b = slot.begin();

    a.finish();

    expect(slot.isCurrent(a)).toBe(false);
    expect(slot.isCurrent(b)).toBe(true);
  });

  it("annule l'envoi en cours à la fermeture du panneau", () => {
    const slot = createRequestSlot();
    const courant = slot.begin();

    slot.cancelCurrent();

    expect(courant.signal.aborted).toBe(true);
  });

  it("n'annule pas un envoi déjà terminé", () => {
    // Fermeter le panneau après une réponse complète ne doit pas laisser un
    // signal annulé traîner : c'est inoffensif ici, mais le même code annule le
    // minuteur, et un minuteur annulé à tort coupe une relance en cours.
    const slot = createRequestSlot();
    const termine = slot.begin();
    termine.finish();

    expect(() => slot.cancelCurrent()).not.toThrow();
    expect(termine.signal.aborted).toBe(false);
  });

  it("ne laisse aucun minuteur en vie après la fin d'un envoi", () => {
    const slot = createRequestSlot();
    const courant = slot.begin();

    courant.finish();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("délai d'expiration", () => {
  it("annule la requête au bout du délai", () => {
    const slot = createRequestSlot({ timeoutMs: 1000 });
    const courant = slot.begin();

    expect(courant.signal.aborted).toBe(false);

    vi.advanceTimersByTime(1000);

    expect(courant.signal.aborted).toBe(true);
  });

  it("n'annule pas avant l'échéance", () => {
    const slot = createRequestSlot({ timeoutMs: 1000 });
    const courant = slot.begin();

    vi.advanceTimersByTime(999);

    expect(courant.signal.aborted).toBe(false);
  });

  it("distingue l'expiration d'une fermeture, pour le message affiché", () => {
    // C'est ce que la boucle de relance et la bannière consomment : sans cette
    // distinction, une panne du service s'affiche comme un geste du visiteur.
    const slot = createRequestSlot({ timeoutMs: 1000 });
    const courant = slot.begin();

    expect(courant.timedOut()).toBe(false);

    vi.advanceTimersByTime(1000);

    expect(courant.timedOut()).toBe(true);
  });

  it("ne déclare pas d'expiration après une fermeture volontaire", () => {
    const slot = createRequestSlot({ timeoutMs: 1000 });
    const courant = slot.begin();

    slot.cancelCurrent();

    expect(courant.signal.aborted).toBe(true);
    // `cancel` ne doit pas être confondu avec le délai : le visiteur a fermé,
    // ce n'est pas une panne, et rien ne doit être affiché.
    expect(courant.timedOut()).toBe(false);
  });

  it("couvre tout l'envoi, pas chaque tentative", () => {
    // Le minuteur est posé une fois par `begin()` : il borne le `send` entier.
    // S'il était reposé à chaque relance, le délai total pourrait être multiplié
    // par le nombre de tentatives — 40 s devenaient 120 s.
    const slot = createRequestSlot({ timeoutMs: 1000 });
    const courant = slot.begin();

    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(600);

    expect(courant.signal.aborted).toBe(true);
  });

  it("n'installe aucun minuteur quand le délai est nul ou négatif", () => {
    // Un délai nul posée par accident donnerait `timeoutMs: 0`, donc une
    // annulation immédiate : chaque requête mourrait avant d'envoyer quoi que
    // ce soit, avec une bannière de délai dépassé à chaque fois.
    const slot = createRequestSlot({ timeoutMs: 0 });
    const courant = slot.begin();

    expect(vi.getTimerCount()).toBe(0);
    expect(courant.signal.aborted).toBe(false);
  });

  it("n'annule pas le minuteur d'un envoi plus récent", () => {
    // Symétrique de la course sur le contrôleur : le `finally` d'un envoi
    // plus ancien ne doit pas annuler le délai du plus récent.
    const slot = createRequestSlot({ timeoutMs: 1000 });
    const ancien = slot.begin();
    const recent = slot.begin();

    ancien.finish();
    vi.advanceTimersByTime(1000);

    expect(ancien.signal.aborted).toBe(false);
    expect(recent.signal.aborted).toBe(true);
  });
});