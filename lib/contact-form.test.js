/**
 * Tests des décisions du formulaire de contact.
 *
 * Le formulaire poste en direct vers Formspree, sans serveur entre le visiteur et
 * le service : rien ne peut être validé plus tard. Les trois propriétés testées
 * ici sont donc toutes des décisions prises *avant* l'envoi, et aucune n'est
 * vérifiable après coup — un formulaire qui spamme ne se distingue d'un
 * formulaire qui marche que par la boîte mail qu'il remplit.
 *
 * La distinction qui traverse tout le fichier : ce qui se dit au visiteur et ce
 * qui secache. Un défaut de saisie doit être rendu, puisque le visiteur peut le
 * corriger ; un piège doit être traité en silence, sinon il apprend à son auteur
 * comment le contourner.
 *
 * Exécution : `npm test`.
 */

import { describe, it, expect } from "vitest";

import {
  HONEYPOT_FIELD,
  LIMITS,
  MIN_FILL_MS,
  buildPayload,
  looksAutomated,
  validateDraft,
} from "./contact-form.js";

/** Un remplissage plausible, que les tests ne font qu'altérer. */
function draft(overrides = {}) {
  return {
    name: "Camille Dupont",
    email: "camille@example.org",
    message: "Bonjour, je vous écris au sujet de votre portfolio.",
    elapsedMs: MIN_FILL_MS,
    ...overrides,
  };
}

describe("piège à robots", () => {
  it("reconnaît un envoi qui remplit le champ-piège", () => {
    // Le pot de miel est le seul filtre qui tient sans appel réseau : le
    // navigateur rend le champ invisible, un script qui complète tout le
    // formulaire le remplit.
    expect(looksAutomated(draft({ honeypot: "https://spam.example" }))).toBe(true);
  });

  it("laisse passer un humain qui ne voit pas le piège", () => {
    expect(looksAutomated(draft({ honeypot: "" }))).toBe(false);
  });

  it("tolère les espaces dans le piège", () => {
    // Un bot qui pose un caractère arbitrairement fait tout aussi bien l'affaire
    // qu'un mot entier ; sans `trim`, il faudrait un remplissage exact.
    expect(looksAutomated(draft({ honeypot: "   " }))).toBe(false);
    expect(looksAutomated(draft({ honeypot: " x " }))).toBe(true);
  });

  it("reconnaît aussi un remplissage trop rapide, sans piège", () => {
    // Les deux signaux sont cumulables : un script peut respecter le délai et
    // remplir le piège, et l'inverse.
    expect(looksAutomated(draft({ elapsedMs: MIN_FILL_MS - 1 }))).toBe(true);
  });

  it("laisse passer un remplissage juste assez lent", () => {
    // Le seuil est une frontière, pas un doute : à la milliseconde près, il faut
    // que la décision soit celle qu'on annonce dans la constante.
    expect(looksAutomated(draft({ elapsedMs: MIN_FILL_MS }))).toBe(false);
  });

  it("traite un délai absent comme trop rapide, par prudence", () => {
    // Sans `elapsedMs`, rien ne prouve que le formulaire a été ouvert par un
    // humain. L'infini serait l'autre choix : il vaudrait dire « je ne sais
    // rien, donc je laisse passer », ce qui est le fail-open du formulaire.
    expect(looksAutomated(draft({ elapsedMs: undefined }))).toBe(true);
  });

  it("ne confond pas un délai nul avec un délai absent", () => {
    // Les deux sont « trop rapide » ici, mais pour deux raisons : un zéro est
    // une mesure, un `undefined` est une absence. Le distinguer protège d'un
    // `NaN` qui passerait silencieusement une comparaison.
    expect(looksAutomated(draft({ elapsedMs: 0 }))).toBe(true);
  });
});

describe("validation de la saisie", () => {
  it("accepte un formulaire complet", () => {
    expect(validateDraft(draft())).toEqual({ ok: true });
  });

  it("exige un nom", () => {
    expect(validateDraft(draft({ name: "  " }))).toEqual({
      ok: false,
      error: "Indiquez votre nom.",
    });
  });

  it("exige une adresse e-mail", () => {
    expect(validateDraft(draft({ email: "" }))).toEqual({
      ok: false,
      error: "Indiquez votre adresse e-mail.",
    });
  });

  it("écarte une adresse manifestement fausse", () => {
    // Le champ reste `type="email"` : le navigateur est plus strict que ce motif.
    // Celui-ci n'agit donc que sur un envoi par `fetch`, qui contourne la
    // validation HTML sans effort.
    expect(validateDraft(draft({ email: "pas-une-adresse" }))).toEqual({
      ok: false,
      error: "Cette adresse e-mail semble incorrecte.",
    });
    expect(validateDraft(draft({ email: "a@b" })).ok).toBe(false);
    expect(validateDraft(draft({ email: "a@b.fr" })).ok).toBe(true);
  });

  it("exige un message", () => {
    expect(validateDraft(draft({ message: "   " }))).toEqual({
      ok: false,
      error: "Écrivez un message.",
    });
  });

  it("refuse un champ plus long que la borne annoncée", () => {
    // La même borne sert au `maxLength` du HTML et à cette vérification. Sans
    // la seconde, un formulaire envoyé par `fetch` passerait au-delà : le HTML
    // n'est pas une garantie dès que le client construit la requête lui-même.
    expect(validateDraft(draft({ message: "x".repeat(LIMITS.message + 1) })).ok).toBe(false);
    expect(validateDraft(draft({ message: "x".repeat(LIMITS.message) })).ok).toBe(true);
  });

  it("cite la borne dans le message d'erreur", () => {
    // Une erreur qui dit « trop long » sans dire combien fait renvoyer le
    // visiteur compter les caractères à la main.
    const rejet = validateDraft(draft({ message: "x".repeat(LIMITS.message + 1) }));

    expect(rejet.error).toContain(String(LIMITS.message));
  });

  it("ne plante pas sur un formulaire absent", () => {
    // Le composant peut rendre le champ-piège avant que l'état soit alimenté ;
    // une propriété qui lit `draft.honeypot` sans garde lèverait une
    // `TypeError` au lieu de répondre « automatique ».
    expect(looksAutomated(undefined)).toBe(true);
    expect(validateDraft(undefined).ok).toBe(false);
  });
});

describe("corps de la requête", () => {
  it("n'envoie pas le champ-piège", () => {
    // Le transmettre le ferait remonter dans les notifications et les logs de
    // Formspree, qui le lit comme un signal d'abus — le but, mais inutile.
    const payload = buildPayload(draft({ honeypot: "spam" }));

    expect(payload).not.toHaveProperty(HONEYPOT_FIELD);
    expect(Object.keys(payload).sort()).toEqual(["email", "message", "name"]);
  });

  it("rogne les espaces qui ne sont pas des fautes de frappe", () => {
    // Un saut de ligne en fin de saisie arrive par collage plus souvent qu'à la
    // main ; il ferait un message qui commence ou finit par un blanc.
    expect(buildPayload(draft({ name: "  Camille  " })).name).toBe("Camille");
  });

  it("n'envoie que ce que le service attend", () => {
    // Ni `elapsedMs`, ni aucune trace du délai : le formulaire ne doit rien
    // laisser deviner de la façon dont il a été rempli.
    const payload = buildPayload(draft({ elapsedMs: 12_345 }));

    expect(payload).not.toHaveProperty("elapsedMs");
  });
});