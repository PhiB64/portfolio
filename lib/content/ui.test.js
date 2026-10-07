/**
 * Contrats des libellés d'interface.
 *
 * Why ces tests. Le dictionnaire `ui.js` est le seul endroit où vit le texte que
 * l'interface écrit — « Téléphone », « Envoyer », « Rubriques du portfolio ». Le
 * contenu éditorial avait déjà `parity.test.js` pour garantir que les deux
 * langues ne divergeaient pas ; l'interface, elle, n'avait rien. Une clé ajoutée
 * côté français et oubliée côté anglais ne produit aucune erreur : `uiFor("en")`
 * renvoie `undefined`, et React affiche une chaîne vide. Le composant ne casse
 * pas, la page est simplement amputée d'un bouton.
 *
 * Ce genre de défaut se voit en production, sur la page anglaise, une fois le
 * déploiement fait — d'où ces tests, écrits pour le rendre vérifiable maintenant.
 *
 * Trois ce qu'ils vérifient :
 * - les mêmes clés, dans le même ordre, à toute profondeur (comme `parity.test.js`) ;
 * - la même *nature* de valeur : une fonction d'un côté et une chaîne de l'autre
 *   donnerait un rendu qui plante à l'appel ;
 * - des propriétés qu'on lit mal : pas de chaîne vide, pas de français résiduel
 *   dans un libellé censé être anglais.
 *
 * Ce qu'ils ne vérifient pas : la qualité de la traduction. Une reformulation
 * se juge à la lecture, pas par égalité de chaîne, et toute assertion sur un
 * libellé anglais figerait la copie au lieu de la laisser évoluer.
 */

import { describe, it, expect } from "vitest";

import { UI, uiFor, LANGUAGE_NAMES, LANGUAGE_CODES } from "./ui.js";
import { resolveLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from "./locales.js";

/**
 * Compare la structure de deux dictionnaires.
 *
 * Le contrôle sur `typeof` distingue `string` de `function` : les clés qui
 * portent un nombre — un compte de caractères, un numéro de tentative — sont des
 * fonctions dans les deux langues. Si l'une devenait une chaîne, l'appel
 * `t.errNameLong(LIMITS.name)` renverrait `undefined` au lieu du message, et le
 * visiteur ne verrait aucune erreur pour un nom trop long.
 *
 * Les tableaux sont ignorés par la comparaison de structure : `cube.scrollDown`
 * en est un, pour tenir compte du nombre de lignes par langue. Ils sont en
 * revanche validés par le test « aucun libellé n'est vide », qui traite un
 * tableau comme une suite de lignes à contrôler une à une.
 */
function assertSameShape(fr, en, path = "") {
  const at = path || "(racette)";

  const keysFr = Object.keys(fr);
  const keysEn = Object.keys(en);
  expect(
    keysFr.join(","),
    `${at} : clés différentes (fr : ${keysFr.join(", ")} / en : ${keysEn.join(", ")})`,
  ).toBe(keysEn.join(","));

  for (const key of keysFr) {
    const a = fr[key];
    const b = en[key];
    const where = path ? `${path}.${key}` : key;
    expect(
      typeof a,
      `${where} : le français est ${typeof a}, l'anglais ${typeof b}`,
    ).toBe(typeof b);
    // `Array.isArray` plutôt que `typeof === "object"` : ces tableaux sont des
    // feuilles, pas des sous-dictionnaires. Descendre dedans comparerait leurs
    // indices comme des clés de groupe, alors que leur nombre de lignes est
    // libre de varier d'une langue à l'autre (« SCROLLEZ » contre
    // « SCROLL / DOWN »).
    if (a !== null && typeof a === "object" && !Array.isArray(a)) {
      assertSameShape(a, b, where);
    }
  }
}

describe("parité fr / en des libellés d'interface", () => {
  it("chaque langue a les mêmes clés, dans le même ordre", () => {
    for (const lang of SUPPORTED_LOCALES) {
      assertSameShape(UI[DEFAULT_LOCALE], UI[lang], lang);
    }
  });

  it("toute langue déclarée a son dictionnaire", () => {
    // `SUPPORTED_LOCALES` est la liste des langues du site. Une entrée sans
    // dictionnaire ferait qu'une page en cette langue afficherait des
    // `undefined` partout — et l'erreur serait visible seulement au déploiement.
    for (const lang of SUPPORTED_LOCALES) {
      expect(UI[lang], `pas de dictionnaire pour « ${lang} »`).toBeTruthy();
    }
  });

  it("aucun libellé n'est vide", () => {
    for (const lang of SUPPORTED_LOCALES) {
      for (const [group, entries] of Object.entries(UI[lang])) {
        for (const [key, value] of Object.entries(entries)) {
          const where = `${lang}.${group}.${key}`;
          if (typeof value === "function") continue;
          // Un tableau de lignes (`cube.scrollDown`) est validé ligne par ligne :
          // c'est la seule façon d'accepter un nombre de lignes différent d'une
          // langue à l'autre sans relâcher le contrôle sur les chaînes.
          if (Array.isArray(value)) {
            expect(
              value.length,
              `${where} : aucune ligne à afficher`,
            ).toBeGreaterThan(0);
            for (const [i, line] of value.entries()) {
              expect(
                typeof line,
                `${where}[${i}] : ce n'est pas une chaîne`,
              ).toBe("string");
              expect(line.trim(), `${where}[${i}] : ligne vide`).not.toBe("");
            }
            continue;
          }
          expect(typeof value, `${where} : ce n'est pas une chaîne`).toBe("string");
          expect(value.trim(), `${where} : libellé vide`).not.toBe("");
        }
      }
    }
  });

  it("une fonction de libellé rend un texte, pas undefined", () => {
    // Les clés calculées sont les seules qui prennent des arguments. Chacune
    // doit produire une chaîne non vide, sinon le visiteur perd l'information
    // qui la justifiait — le nombre de caractères maximum, par exemple.
    const f = uiFor("fr").form;
    expect(f.errNameLong(40)).toContain("40");
    expect(f.errEmailLong(120)).toContain("120");
    expect(f.errMessageLong(3000)).toContain("3000");

    const e = uiFor("en").form;
    expect(e.errNameLong(40)).toContain("40");
    expect(e.errEmailLong(120)).toContain("120");
    expect(e.errMessageLong(3000)).toContain("3000");

    const fr = uiFor("fr").chat;
    const en = uiFor("en").chat;
    expect(fr.writingRetry(2, 3)).toContain("2");
    expect(en.writingRetry(2, 3)).toContain("2");
  });
});

describe("uiFor", () => {
  it("renvoie le dictionnaire demandé", () => {
    expect(uiFor("en")).toBe(UI.en);
    expect(uiFor("fr")).toBe(UI.fr);
  });

  it("replie sur la langue par défaut pour une langue inconnue", () => {
    // Pas d'erreur : `/de` doit rester lisible, en anglais, plutôt que tomber.
    expect(uiFor("de")).toBe(UI[DEFAULT_LOCALE]);
    expect(uiFor(undefined)).toBe(UI[DEFAULT_LOCALE]);
    expect(uiFor("")).toBe(UI[DEFAULT_LOCALE]);
  });

  it("replie comme resolveLocale, pour que les deux ne divergent pas", () => {
    // Les deux fonctions doivent choisir la même langue, sinon `/de`
    // afficherait du contenu anglais avec des boutons français.
    for (const lang of [...SUPPORTED_LOCALES, "de", "", undefined, null]) {
      expect(uiFor(lang)).toBe(UI[resolveLocale(lang)]);
    }
  });
});

describe("noms de langues", () => {
  it("chaque langue a un nom, écrit dans cette langue", () => {
    for (const lang of SUPPORTED_LOCALES) {
      expect(LANGUAGE_NAMES[lang], `pas de nom pour « ${lang} »`).toBeTruthy();
    }
  });

  it("le nom de la langue par défaut n'est pas un mot anglais", () => {
    // « Français » se reconnaît en anglais, « French » non. Écrire le nom dans la
    // langue du visiteur ferait douter un anglophone de lire la cible.
    expect(LANGUAGE_NAMES[DEFAULT_LOCALE]).not.toBe("French");
  });
});

describe("codes de langues", () => {
  it("chaque langue a un code", () => {
    // Sans code, le sélecteur mobile afficherait `undefined` — le repli
    // `?? target` du composant donnerait « fr », en minuscules, à côté d'un
    // globe : un défaut que rien d'autre ne rattraperait.
    for (const lang of SUPPORTED_LOCALES) {
      expect(LANGUAGE_CODES[lang], `pas de code pour « ${lang} »`).toBeTruthy();
    }
  });

  it("chaque code tient en deux lettres, en majuscules", () => {
    // Le code remplace le nom complet sur la rangée du bas en mobile, où la
    // largeur est comptée : plus long, il chevauche le bouton CONTACT centré.
    for (const lang of SUPPORTED_LOCALES) {
      expect(LANGUAGE_CODES[lang]).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("le code se reconnaît dans le nom qu'il remplace", () => {
    // `EN` ne doit pas pouvoir désigner le français, ni l'inverse : le
    // sélecteur affiche le code de la langue courante, donc un code trompeur
    // afficherait « EN » sur une page française sans que rien d'autre ne le
    // trahisse à l'écran.
    for (const lang of SUPPORTED_LOCALES) {
      const code = LANGUAGE_CODES[lang];
      const name = LANGUAGE_NAMES[lang];
      expect(
        name.toUpperCase().startsWith(code[0]),
        `« ${code} » ne ressemble pas à « ${name} »`,
      ).toBe(true);
    }
  });
});
