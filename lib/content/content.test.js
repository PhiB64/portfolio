/**
 * Contrat de `getContent(lang)` — le point d'entrée que l'étape suivante
 * (route `[lang]`) utilisera.
 *
 * Why tester l_accessor plutôt que les fichiers. `fr.js` et `en.js` sont déjà
 * couverts par `parity.test.js`, qui garantit qu'ils ont la même forme. Ce qui
 * reste à prouver ici, c'est la promesse que fait `index.js` :
 *
 * - les coordonnées sont identiques quelle que soit la langue demandée ;
 * - une langue inconnue ne casse rien, elle retombe sur le français ;
 * - la liste `SUPPORTED_LOCALES` décrit exactement ce qui existe.
 *
 * Ces trois points sont ceux sur lesquels une page anglaise peut afficher une
 * adresse périmée, planter un rendu, ou prétendre qu'une langue existe alors que
 * son fichier manque. Aucun n'est visible à la simple lecture du code.
 */

import { describe, it, expect } from "vitest";

import {
  getContent,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  CONTACT,
  CONTACT_LOCATION,
} from "./index.js";

describe("getContent", () => {
  it("renvoie le contenu éditorial de la langue demandée", () => {
    const fr = getContent("fr");
    const en = getContent("en");

    // On compare un libellé, pas les objets : ce test vérifie le *choix* de
    // langue, pas la qualité de la traduction. La parité de forme est déjà
    // couverte ailleurs.
    expect(fr.PROJECT_CONTENT[0].label).toBe("Développement Web");
    expect(en.PROJECT_CONTENT[0].label).toBe("Web Development");
  });

  it("renvoie les mêmes coordonnées dans les deux langues", () => {
    // Le point le plus important de tout le fichier. `CONTACT` est hors langue
    // par conception : une page qui afficherait une autre adresse que le
    // JSON-LD, ou que le repli de l'assistant, enverrait des mails à une
    // destination périmée sans qu'aucun test ne le remarque ailleurs.
    expect(getContent("en").CONTACT).toBe(CONTACT);
    expect(getContent("fr").CONTACT).toBe(CONTACT);
    expect(getContent("en").CONTACT_LOCATION).toBe(getContent("fr").CONTACT_LOCATION);
  });

  it("retombe sur le français pour une langue inconnue", () => {
    // Un `/de` non livré, ou un `?lang=` erroné, doivent rendre une page lisible
    // plutôt qu'une erreur. Le repli est silencieux et total.
    expect(getContent("de")).toEqual(getContent(DEFAULT_LOCALE));
    expect(getContent("")).toEqual(getContent(DEFAULT_LOCALE));
    expect(getContent(undefined)).toEqual(getContent(DEFAULT_LOCALE));
    expect(getContent(null)).toEqual(getContent(DEFAULT_LOCALE));
  });

  it("donne les coordonnées même quand la langue est inconnue", () => {
    // Détail qui compte : le repli ne doit pas se CONTENT d'une chaîne vide, ce
    // qui ferait afficher `undefined` dans l'écran CONTACT au lieu d'une adresse.
    const c = getContent("de");
    expect(c.CONTACT.email).toBe(CONTACT.email);
    expect(c.CONTACT_LOCATION).toBe(CONTACT_LOCATION);
  });

  it("n'expose que les langues qui existent", () => {
    // `SUPPORTED_LOCALES` alimente le `generateStaticParams` et le sitemap. Une
    // langue listée sans fichier produirait une route qui tourne en boucle ou une
    // 404 au build — donc on vérifie que chaque entrée se charge vraiment.
    for (const locale of SUPPORTED_LOCALES) {
      const c = getContent(locale);
      expect(c.PROJECT_CONTENT.length).toBeGreaterThan(0);
      expect(c.CAREER_CONTENT).toBeDefined();
      expect(c.USAGE_CONTENT.length).toBeGreaterThan(0);
    }
  });

  it("inclut le français dans les langues livrées", () => {
    // Le JSON-LD de `app/layout.js` et la redirection de la racine iront chercher
    // DEFAULT_LOCALE. Si elle n'était pas livrée, la version française — celle
    // qui existe déjà — disparaîtrait derrière une page blanche.
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });
});