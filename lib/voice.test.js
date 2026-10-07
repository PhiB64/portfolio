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
  isStopCommand,
  isSynthesisSupported,
  pickVoice,
  speakableText,
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

describe("speakableText", () => {
  it("épelle CV en français pour éviter « chevaux »", () => {
    // Sans espace, la synthèse française lit l'unité de puissance
    // (chevaux-vapeur) au lieu des initiales du curriculum vitæ.
    expect(speakableText("Voir mon CV", "fr")).toBe("Voir mon C V");
    expect(speakableText("voir mon cv", "fr")).toBe("voir mon C V");
    // Le chemin `/cv.pdf` est une adresse : il est retiré avant lecture
    // (voir « ne lit jamais une adresse »), seul `CV` est épelé.
    expect(speakableText("CV : /cv.pdf", "fr")).toBe("C V:");
  });

  it("laisse les mots contenant cv intacts", () => {
    expect(speakableText("la cave est ici", "fr")).toBe("la cave est ici");
  });

  it("dit arobase en français, at en anglais", () => {
    // `@` brut se prononce « at » ou se tait selon la voix : l'écrire en
    // toutes lettres rend les adresses e-mail compréhensibles à l'oreille.
    expect(speakableText("écris à a@gmail.com", "fr")).toBe(
      "écris à a arobase gmail.com",
    );
    expect(speakableText("write to a@gmail.com", "en")).toBe(
      "write to a at gmail.com",
    );
  });

  it("ne touche pas au CV anglais et rend une chaîne sûre", () => {
    // L'anglais épelle déjà correctement : on n'y touche pas.
    expect(speakableText("See my CV", "en")).toBe("See my CV");
    expect(speakableText("", "fr")).toBe("");
    expect(speakableText(null, "fr")).toBe("");
  });

  it("ne lit jamais une adresse en mains libres", () => {
    // Sans lien cliquable, une URL parlée est du bruit : la voix doit la
    // sauter. L'e-mail survit — seul son `@` est réécrit plus bas.
    expect(
      speakableText("Voir rubrique WEB https://phib64.github.io/portfolio/fr?project=1", "fr"),
    ).toBe("Voir rubrique WEB");
    expect(
      speakableText("CV https://phib64.github.io/portfolio/cv.pdf", "fr"),
    ).toBe("C V");
    // `?project=N` nu reçoit la même consigne : la réponse courte
    // (« REACT ?project=2 ») perd aussi sa queue.
    expect(speakableText("Voir REACT ?project=2 et BACKEND ?project=3", "fr")).toBe(
      "Voir REACT et BACKEND",
    );
    // Domaine nu cité sans schéma : sauté lui aussi.
    expect(speakableText("Sur github.com/PhiB64 tu verras", "fr")).toBe("Sur tu verras");
    // L'e-mail reste lisible, arobase compris.
    expect(speakableText("Écris à a@gmail.com s'il te plaît", "fr")).toBe(
      "Écris à a arobase gmail.com s'il te plaît",
    );
    expect(
      speakableText("See PROJECTS ?project=6 on the site", "en"),
    ).toBe("See PROJECTS on the site");
  });

  it("ne laisse pas de parenthèse vide après retrait d'une adresse", () => {
    // Cas `[texte](url)` devenu `texte ()` par le nettoyage Markdown :
    // les parenthèses vides ne se prononcent pas, on les retire.
    expect(speakableText("Voir le projet (https://example.com/x)", "fr")).toBe(
      "Voir le projet",
    );
  });
});

describe("isStopCommand", () => {
  it("reconnaît l'ordre d'arrêt seul, dans chaque langue", () => {
    expect(isStopCommand("stop", "fr")).toBe(true);
    expect(isStopCommand("stop", "en")).toBe(true);
    expect(isStopCommand("quitter", "fr")).toBe(true);
    expect(isStopCommand("quit", "en")).toBe(true);
    expect(isStopCommand("exit", "en")).toBe(true);
  });

  it("ignore casse, accents et ponctuation", () => {
    expect(isStopCommand("Stop.", "fr")).toBe(true);
    expect(isStopCommand("ARRÊTE !", "fr")).toBe(true);
    expect(isStopCommand("Au revoir", "fr")).toBe(true);
    expect(isStopCommand("Goodbye!", "en")).toBe(true);
  });

  it("accepte une politesse en bordure, pas un ordre noyé", () => {
    expect(isStopCommand("s'il te plaît stop", "fr")).toBe(true);
    expect(isStopCommand("stop please", "en")).toBe(true);
    // Le mot seul n'est pas l'ordre : ces phrases partent au modèle.
    expect(isStopCommand("parle-moi du stop du cube", "fr")).toBe(false);
    expect(isStopCommand("peux-tu stopper la musique", "fr")).toBe(false);
    expect(isStopCommand("tell me about the bus stop", "en")).toBe(false);
  });

  it("ne coupe jamais sur du vide", () => {
    expect(isStopCommand("", "fr")).toBe(false);
    expect(isStopCommand(null, "fr")).toBe(false);
  });

  it("comprend les deux langues quelle que soit la page", () => {
    // La reconnaissance transcrit ce qu'elle entend, pas la langue de
    // l'interface : un `quit` sur la page française et un `quitter` sur la
    // page anglaise doivent couper aussi.
    expect(isStopCommand("quit", "fr")).toBe(true);
    expect(isStopCommand("quitter", "en")).toBe(true);
    expect(isStopCommand("quit", "de")).toBe(true);
    expect(isStopCommand("quitter", "de")).toBe(true);
  });
});

describe("pickVoice", () => {
  it("préfère la voix masculine exacte quand elle existe", () => {
    const feminineExact = { lang: "fr-FR", name: "Hortense" };
    const masculineExact = { lang: "fr-FR", name: "Thomas" };
    expect(pickVoice([feminineExact, masculineExact], "fr")).toBe(
      masculineExact,
    );
  });

  it("préfère une masculine de la langue à une exacte féminine", () => {
    const american = { lang: "en-US", name: "Samantha" };
    const british = { lang: "en-GB", name: "George" };
    expect(pickVoice([american, british], "en")).toBe(british);
  });

  it("garde l'exacte féminine sans masculine disponible", () => {
    const fallback = { lang: "fr-CA", name: "Amélie" };
    const exact = { lang: "fr-FR", name: "Hortense" };
    expect(pickVoice([fallback, exact], "fr")).toBe(exact);
  });

  it("prend la première voix de la langue sans masculine ni exacte", () => {
    const canadian = { lang: "fr-CA", name: "Amélie" };
    expect(pickVoice([canadian], "fr")).toBe(canadian);
  });

  it("choisit l'anglais américain en premier sans indice masculin", () => {
    const british = { lang: "en-GB", name: "Jane" };
    const american = { lang: "en-US", name: "Samantha" };
    expect(pickVoice([british, american], "en")).toBe(american);
  });

  it("ne lit pas `Samantha` ou `Female` comme masculines", () => {
    const samantha = { lang: "en-US", name: "Samantha" };
    const female = { lang: "en-US", name: "Google US English Female" };
    const male = { lang: "en-US", name: "Google US English Male" };
    // `man` dans `Samantha`, `male` dans `Female` : la découpe en jetons
    // entiers évite ces faux positifs.
    expect(pickVoice([samantha, male], "en")).toBe(male);
    expect(pickVoice([female, male], "en")).toBe(male);
    expect(pickVoice([samantha], "en")).toBe(samantha);
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
