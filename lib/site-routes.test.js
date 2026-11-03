/**
 * Contrats du routage par langue.
 *
 * Why ces tests. Le routage est de la logique pure, mais elle est invisible à la
 * compilation : `localePath("fr", "/projets")` renvoie `/fr/projets`, une page
 * qui n'existe pas, et rien ne signale l'erreur. Elle se découvre en production,
 * quand un lien du sélecteur de langue mène à un 404 — le seul endroit où
 * l.finish d'un visiteur anglophone est perdu.
 *
 * Le cas le plus probable d'une telle faute est le double préfixe
 * `/portfolio/portfolio/fr`, produit quand on ajoute `basePath` à la main à un
 * chemin que `next/link` préfixe déjà. D'où les tests sur `localeHref`, qui est
 * le seul endroit où le préfixe doit être ajouté.
 *
 * Ce qui est vérifié :
 * - la langue par défaut à la racine, les autres sous leur code ;
 * - le retrait du préfixe courant, y compris sur `/fr` seul ;
 * - la conservation de la page lors d'un changement de langue ;
 * - `localeHref` qui ajoute le préfixe de sous-dossier une fois et une seule ;
 * - l'ancienne langue secondaire préfixée (`/en`) que `pathWithoutLocale`
 *   retire toujours proprement, même si aucune route ne la produit plus.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  localePrefix,
  localePath,
  localeHref,
  localeAlternates,
  pathWithoutLocale,
  otherLocale,
  switchLocalePath,
  PAGE_PATHS,
} from "./site-routes.js";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "./content/locales.js";

describe("localePrefix", () => {
  it("laisse la langue par défaut à la racine", () => {
    expect(localePrefix(DEFAULT_LOCALE)).toBe("");
  });

  it("préfixe les autres langues par leur code", () => {
    for (const lang of SUPPORTED_LOCALES) {
      if (lang === DEFAULT_LOCALE) continue;
      expect(localePrefix(lang)).toBe(`/${lang}`);
    }
  });
});

describe("localePath", () => {
  it("sert la langue par défaut à la racine", () => {
    expect(localePath("fr")).toBe("/");
    expect(localePath("fr", "/")).toBe("/");
    expect(localePath("fr", "/page")).toBe("/page");
  });

  it("préfixe une langue secondaire", () => {
    expect(localePath("en")).toBe("/en");
    expect(localePath("en", "/page")).toBe("/en/page");
  });

  it("ne double pas un préfixe déjà présent", () => {
    // Le sélecteur passe le chemin courant, qui porte déjà `/en`.
    expect(localePath("en", "/en")).toBe("/en");
    expect(localePath("en", "/en/page")).toBe("/en/page");
  });

  it("va de la racine d'une langue à l'autre sans page intermédiaire", () => {
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("fr", "/en")).toBe("/");
  });

  it("produit un chemin qui commence par un segment connu", () => {
    // Garde-fou : un chemin comme `/page` donné à une langue secondaire doit
    // produire `/en/page`, jamais `/pageen` ni `/en/en/page`.
    for (const lang of SUPPORTED_LOCALES) {
      for (const p of PAGE_PATHS) {
        const out = localePath(lang, p);
        expect(out.startsWith("/"), `${lang} ${p} : chemin relatif`).toBe(true);
        for (const code of SUPPORTED_LOCALES) {
          expect(out, `${lang} ${p} : préfixe répété`).not.toContain(`/${code}/${code}`);
        }
        expect(out.replace(/\/+/g, "/")).toBe(out);
      }
    }
  });
});

describe("pathWithoutLocale", () => {
  it("retire le préfixe d'une langue secondaire", () => {
    // `/en` y figure aussi : l'ancienne langue secondaire préfixée reste un
    // préfixe retiré proprement, même si aucune route ne le produit plus.
    expect(pathWithoutLocale("/en")).toBe("/");
    expect(pathWithoutLocale("/en/page")).toBe("/page");
    expect(pathWithoutLocale("/fr")).toBe("/");
    expect(pathWithoutLocale("/fr/page")).toBe("/page");
  });

  it("laisse un chemin sans préfixe", () => {
    expect(pathWithoutLocale("/")).toBe("/");
    expect(pathWithoutLocale("/page")).toBe("/page");
  });

  it("ne touche pas à un segment qui ressemble à une langue sans en être une", () => {
    // `/engineering` commence par « en » : un test naïf le prendrait pour un
    // préfixe et mutilerait le chemin.
    expect(pathWithoutLocale("/engineering")).toBe("/engineering");
  });

  it("tolère un chemin vide", () => {
    expect(pathWithoutLocale("")).toBe("/");
    expect(pathWithoutLocale(undefined)).toBe("/");
  });
});

describe("localeHref", () => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = original;
  });

  it("ajoute le préfixe de sous-dossier une fois", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/portfolio";
    expect(localeHref("fr", "/page")).toBe("/portfolio/page");
    expect(localeHref("en", "/page")).toBe("/portfolio/en/page");
  });

  it("ne double pas le préfixe si le chemin en porte déjà un", () => {
    // Le défaut exact que ce fichier existe pour éviter :
    // `/portfolio/portfolio/en`.
    process.env.NEXT_PUBLIC_BASE_PATH = "/portfolio";
    expect(localeHref("en", "/portfolio/en")).toBe("/portfolio/en");
  });

  it("reste correct sans préfixe de sous-dossier", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(localeHref("en", "/page")).toBe("/en/page");
  });
});

describe("localeAlternates", () => {
  it("déclare une entrée par langue", () => {
    const a = localeAlternates("/page");
    expect(Object.keys(a).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    expect(a[DEFAULT_LOCALE]).toBe("/page");
  });

  it("donne à chaque langue le chemin de la même page", () => {
    const a = localeAlternates("/page");
    for (const lang of SUPPORTED_LOCALES) {
      expect(a[lang]).toBe(localePath(lang, "/page"));
    }
  });
});

describe("otherLocale", () => {
  it("renvoie la langue qui n'est pas la courante", () => {
    for (const lang of SUPPORTED_LOCALES) {
      expect(otherLocale(lang)).not.toBe(lang);
      expect(SUPPORTED_LOCALES).toContain(otherLocale(lang));
    }
  });

  it("renvoie la seule autre langue quand il y en a deux", () => {
    // Le sélecteur ne rend rien s'il n'y a pas de destination : afficher un
    // lien vers la langue courante serait un bouton sans effet.
    expect(SUPPORTED_LOCALES).toEqual(["fr", "en"]);
    expect(otherLocale("fr")).toBe("en");
    expect(otherLocale("en")).toBe("fr");
  });
});

describe("switchLocalePath", () => {
  beforeEach(() => {
    expect(SUPPORTED_LOCALES).toEqual(["fr", "en"]);
  });

  it("conserve la page courante en changeant de langue", () => {
    expect(switchLocalePath("/page", "fr")).toBe("/en/page");
    expect(switchLocalePath("/en/page", "en")).toBe("/page");
  });

  it("échange les racines", () => {
    expect(switchLocalePath("/", "fr")).toBe("/en");
    expect(switchLocalePath("/en", "en")).toBe("/");
  });

  it("va-et-revient sur chaque page", () => {
    // Un aller-retour doit rendre le chemin de départ : c'est ce qui garantit
    // qu'on ne dérive pas vers une page voisine en changeant de langue. Les
    // chemins sont canonisés avant comparaison, parce que `/en/` et `/en` sont
    // la même page et que le site ne produit que la seconde forme.
    const paths = [...PAGE_PATHS, ...PAGE_PATHS.map((x) => `/en${x}`)].map(
      (p) => localePath(p.startsWith("/en") ? "en" : DEFAULT_LOCALE, p),
    );

    for (const p of paths) {
      const lang = p.startsWith("/en") ? "en" : DEFAULT_LOCALE;
      const there = switchLocalePath(p, lang);
      const back = switchLocalePath(there, otherLocale(lang));
      expect(back, `${p} → ${there} → ${back}`).toBe(p);
    }
  });

  it("canonise une barre oblique finale", () => {
    // `/en/` et `/en` sont la même page. Sans canonisation, un aller-retour
    // depuis `/en/` aboutirait à `/` : le visiteur changerait de langue et
    // changerait de page au même moment.
    expect(switchLocalePath("/en/", "en")).toBe("/");
    expect(switchLocalePath("/en/", "fr")).toBe("/en");
    expect(localePath("en", "/en/")).toBe("/en");
    expect(localePath("en", "/page/")).toBe("/en/page");
  });
});