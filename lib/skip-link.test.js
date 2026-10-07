/**
 * Tests du lien d'évitement et du repaire principal.
 *
 * Why lire la source plutôt que monter `HeroCube`. Le composant entier ne se
 * monte pas sous jsdom : chorégraphie GSAP, boucle de scroll, médias, pile
 * d'effets — un montage y meurt bien avant de rendre un lien. Le lien
 * d'évitement est pourtant une exigence WCAG 2.4.1 (niveau A) : sans lui, un
 * visiteur au clavier tabule SKIP, les six onglets et le cube avant tout
 * contenu, et le cube est un `role="button"` piloté au scroll, pas une
 * navigation.
 *
 * Le précédent existe déjà dans cette base : `chat-widget-placement.test.jsx`
 * lit `hero-cube.jsx` au lieu de recopier ses `z-index`. Même procédé ici :
 * le test lit le JSX et exige le contrat — un lien `#contenu` avant la
 * section, une section qui porte cet `id`, un libellé traduit dans
 * `lib/content/ui.js` — plutôt que des chaînes recopiées qui passeraient
 * encore si le lien disparaissait.
 *
 * Exécution : `npm test`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { UI } from "./content/ui.js";
import { SUPPORTED_LOCALES } from "./content/locales.js";

const HERO = readFileSync(
  new URL("../components/hero-cube.jsx", import.meta.url),
  "utf8",
);

describe("lien d'évitement", () => {
  it("un lien vers #contenu précède la section", () => {
    const lien = HERO.indexOf('href="#contenu"');
    expect(lien, "aucun lien href=#contenu dans hero-cube.jsx").not.toBe(-1);
    const section = HERO.indexOf("<section");
    expect(section, "aucune <section> dans hero-cube.jsx").not.toBe(-1);
    // Le lien doit venir AVANT la section dans le DOM : c'est ce qui en fait
    // le premier arrêt de tabulation, pas un rappel en fin de page.
    expect(
      lien,
      "le lien d'évitement doit précéder la <section>",
    ).toBeLessThan(section);
  });

  it("la cible existe : la section porte id=contenu", () => {
    expect(HERO).toMatch(/<section[^>]*\bid="contenu"/);
  });

  it("le libellé vient du dictionnaire, dans les deux langues", () => {
    for (const lang of SUPPORTED_LOCALES) {
      const label = UI[lang]?.nav?.skipToContent;
      expect(
        typeof label,
        `${lang}.nav.skipToContent : clé absente du dictionnaire`,
      ).toBe("string");
      expect(label.trim(), `${lang}.nav.skipToContent : libellé vide`).not.toBe(
        "",
      );
    }
    // Pas le même texte des deux côtés : un libellé identique trahirait une
    // clé recopiée sans traduction — le défaut même que ce point corrigeait
    // pour l'aria-label du cube.
    expect(UI.fr.nav.skipToContent).not.toBe(UI.en.nav.skipToContent);
  });

  it("le lien se lit bien par une clé du dictionnaire, pas en dur", () => {
    expect(HERO).toMatch(/uiFor\(lang\)\.nav\.skipToContent/);
  });
});
