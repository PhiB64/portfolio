import { describe, expect, it } from "vitest";

import { createLeakFilter } from "./leak-filter";

/**
 * Rejoue des deltas dans le filtre et renvoie ce qui atteint l'écran.
 *
 * Le filtre est volontairement illisible en lecture isolée : il ne rend du texte
 * qu'une fois la ligne jugée. Ce helper est donc le seul moyen de l'observer, et
 * il ressemble exactement à ce que fait `readStream`.
 *
 * @param {string[]} chunks
 * @returns {string}
 */
function filter(chunks) {
  const f = createLeakFilter();
  return chunks.map((chunk) => f.push(chunk)).join("") + f.flush();
}

/** Variante caractère par caractère : le pire découpage possible d'un delta. */
function filterByChar(text) {
  return filter([...text]);
}

describe("createLeakFilter", () => {
  describe("lignes de fuite", () => {
    // Ces trois formats sont allés en production : le second et le troisième
    // avaient passé à travers une liste de préfixes figée sur `User Safety`.
    // `Response Safety` et `Safety Categories` sont les deux régressions réelles.
    const observed = [
      "User Safety: safe",
      "Response Safety: safe",
      "Safety Categories: PII/Privacy, Needs Caution",
    ];

    it.each(observed)("élimine « %s »", (line) => {
      expect(filter([line])).toBe("");
      expect(filterByChar(line)).toBe("");
    });

    it.each(observed)("élimine « %s » suivi de la vraie réponse", (line) => {
      expect(filter([`${line}\nBonjour, que puis-je faire ?`])).toBe("Bonjour, que puis-je faire ?");
    });

    // La valeur est la partie qui change d'un modèle à l'autre : la règle doit
    // juger sur le label, donc peu importe ce qu'elle contient.
    it.each([
      "Response Safety: blocked",
      "Response Safety: PII/Privacy",
      "Response Safety: Needs Caution, Harassment",
      "Response Safety:",
      "response SAFETY : unsafe",
      "Model_Safety: safe",
    ])("élimine « %s », quelle que soit la valeur", (line) => {
      expect(filter([line])).toBe("");
    });

    it("élimine plusieurs lignes de fuite consécutives", () => {
      expect(filter(["User Safety: safe\nResponse Safety: safe\nSafety Categories: PII\n"])).toBe("");
    });

    // Le delta coupe la ligne en plein milieu du mot : c'est le cas que le flux
    // réel produit presque toujours, et celui que `hold` existe pour traiter.
    it("élimine une fuite coupée en plein milieu du mot-clé", () => {
      expect(filter(["Response", " Safety", ": sa", "fe\n"])).toBe("");
    });

    it("élimine une fuite découpée caractère par caractère", () => {
      expect(filterByChar("Response Safety: safe\n")).toBe("");
    });

    // Une valeur plus longue que le plafond de retenue doit rester avalée : c'est
    // ce qui distingue l'état `drop` d'un simple booléen « ça ressemble à une
    // fuite », qui la laisserait réapparaître au plafond.
    it("élimine une fuite dont la valeur dépasse le plafond de retenue", () => {
      const long = `Response Safety: ${"a".repeat(200)}\n`;
      expect(filter([long])).toBe("");
      expect(filterByChar(long)).toBe("");
    });

    // Le flux peut finir sans retour à la ligne : sans `flush`, la fuite entière
    // passerait à l'écran.
    it("élimine une fuite en fin de flux sans retour à la ligne", () => {
      expect(filter(["Response Safety: safe"])).toBe("");
    });
  });

  describe("réponses légitimes", () => {
    it("laisse passer une réponse qui contient le mot « safety »", () => {
      expect(filter(["This is a safety feature."])).toBe("This is a safety feature.");
    });

    // Faux positif que la règle doit éviter : `Categories` seul n'est pas un
    // label de modération, seul `Safety Categories` en est un.
    it("laisse passer une ligne dont le label est « Categories »", () => {
      expect(filter(["Categories: React, Three.js, GSAP"])).toBe("Categories: React, Three.js, GSAP");
    });

    it("laisse passer les titres Markdown", () => {
      const md = "## Categories\n\n- React\n- Three.js\n";
      expect(filter([md])).toBe(md);
    });

    it("laisse passer une réponse dont la première ligne contient un deux-points", () => {
      const text = "Voici ma réponse :\n\nLe projet utilise Next.js.\n";
      expect(filter([text])).toBe(text);
    });

    // Sans deux-points, la première ligne est retenue jusqu'à `LEAK_MAX_HOLD` :
    // la borne existe pour que le visiteur ne la voie pas apparaître d'un bloc.
    it("laisse passer une longue ligne sans aucun deux-points", () => {
      const line = `${"a".repeat(120)}\n`;
      expect(filter([line])).toBe(line);
    });

    it("préserve le texte et ses blancs à l'identique", () => {
      const text = "  Réponse indented\n\n\nFin.  \n";
      expect(filter([text])).toBe(text);
    });

    it("ne rend rien pour une entrée vide", () => {
      expect(filter([""])).toBe("");
    });
  });

  describe("invariant de découpage", () => {
    // La propriété qui compte pour un flux : le texte rendu ne doit dépendre que
    // du texte reçu, jamais de la façon dont il a été découpé en deltas. Les
    // entrées et sorties sont écrites à la main — une sortie dérivée de l'entrée
    // par une regex testerait la regex autant que le filtre.
    const cases = [
      ["User Safety: safe\nBonjour.", "Bonjour."],
      ["Response Safety: safe\nVoici ma réponse :\n\nD'accord.", "Voici ma réponse :\n\nD'accord."],
      [
        "Safety Categories: PII/Privacy\nUne réponse tout à fait normale.",
        "Une réponse tout à fait normale.",
      ],
      // Aucune fuite ici : « Categories: » n'est pas un label de modération.
      ["Categories: React\n## Detail\n- un\n- deux", "Categories: React\n## Detail\n- un\n- deux"],
      [
        "This is a safety feature. No colon at all.",
        "This is a safety feature. No colon at all.",
      ],
      [
        "Sans deux-point, une phrase un peu longue pour dépasser le plafond de retenue.",
        "Sans deux-point, une phrase un peu longue pour dépasser le plafond de retenue.",
      ],
    ];

    it.each(cases)("rend la même sortie quel que soit le découpage : %j", (input, expected) => {
      expect(filter([input])).toBe(expected);
      expect(filterByChar(input)).toBe(expected);
      // Découpage par tranches de trois caractères : autre découpage, même sortie.
      expect(filter(input.match(/[\s\S]{1,3}/g) ?? [input])).toBe(expected);
    });
  });
});