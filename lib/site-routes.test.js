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
    expect(localePath("en")).toBe("/");
    expect(localePath("en", "/")).toBe("/");
    expect(localePath("en", "/projects")).toBe("/projects");
  });

  it("préfixe une langue secondaire", () => {
    expect(localePath("fr")).toBe("/fr");
    expect(localePath("fr", "/projects")).toBe("/fr/projects");
  });

  it("ne double pas un préfixe déjà présent", () => {
    // Le sélecteur passe le chemin courant, qui porte déjà `/fr`.
    expect(localePath("fr", "/fr")).toBe("/fr");
    expect(localePath("fr", "/fr/projects")).toBe("/fr/projects");
  });

  it("va de la racine d'une langue à l'autre sans page intermédiaire", () => {
    expect(localePath("fr", "/")).toBe("/fr");
    expect(localePath("en", "/fr")).toBe("/");
  });

  it("produit un chemin qui commence par un segment connu", () => {
    // Garde-fou : un chemin comme `/projects` donné à une langue secondaire doit
    // produire `/fr/projects`, jamais `/projectsen` ni `/fr/fr/projects`.
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
    expect(pathWithoutLocale("/fr")).toBe("/");
    expect(pathWithoutLocale("/fr/projects")).toBe("/projects");
    expect(pathWithoutLocale("/en")).toBe("/");
    expect(pathWithoutLocale("/en/projects")).toBe("/projects");
  });

  it("laisse un chemin sans préfixe", () => {
    expect(pathWithoutLocale("/")).toBe("/");
    expect(pathWithoutLocale("/projects")).toBe("/projects");
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
    expect(localeHref("fr", "/projects")).toBe("/portfolio/fr/projects");
    expect(localeHref("en", "/projects")).toBe("/portfolio/projects");
  });

  it("ne double pas le préfixe si le chemin en porte déjà un", () => {
    // Le défaut exact que ce fichier existe pour éviter :
    // `/portfolio/portfolio/fr`.
    process.env.NEXT_PUBLIC_BASE_PATH = "/portfolio";
    expect(localeHref("fr", "/portfolio/fr")).toBe("/portfolio/fr");
  });

  it("reste correct sans préfixe de sous-dossier", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(localeHref("fr", "/projects")).toBe("/fr/projects");
  });
});

describe("localeAlternates", () => {
  it("déclare une entrée par langue", () => {
    const a = localeAlternates("/projects");
    expect(Object.keys(a).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    expect(a[DEFAULT_LOCALE]).toBe("/projects");
  });

  it("donne à chaque langue le chemin de la même page", () => {
    const a = localeAlternates("/projects");
    for (const lang of SUPPORTED_LOCALES) {
      expect(a[lang]).toBe(localePath(lang, "/projects"));
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
    expect(SUPPORTED_LOCALES).toEqual(["en", "fr"]);
    expect(otherLocale("fr")).toBe("en");
    expect(otherLocale("en")).toBe("fr");
  });
});

describe("switchLocalePath", () => {
  beforeEach(() => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "fr"]);
  });

  it("conserve la page courante en changeant de langue", () => {
    expect(switchLocalePath("/projects", "en")).toBe("/fr/projects");
    expect(switchLocalePath("/fr/projects", "fr")).toBe("/projects");
  });

  it("échange les racines", () => {
    expect(switchLocalePath("/", "en")).toBe("/fr");
    expect(switchLocalePath("/fr", "fr")).toBe("/");
  });

  it("va-et-revient sur chaque page", () => {
    // Un aller-retour doit rendre le chemin de départ : c'est ce qui garantit
    // qu'on ne dérive pas vers une page voisine en changeant de langue. Les
    // chemins sont canonisés avant comparaison, parce que `/fr/` et `/fr` sont
    // la même page et que le site ne produit que la seconde forme.
    const paths = [...PAGE_PATHS, ...PAGE_PATHS.map((x) => `/fr${x}`)].map(
      (p) => localePath(p.startsWith("/fr") ? "fr" : DEFAULT_LOCALE, p),
    );

    for (const p of paths) {
      const lang = p.startsWith("/fr") ? "fr" : DEFAULT_LOCALE;
      const there = switchLocalePath(p, lang);
      const back = switchLocalePath(there, otherLocale(lang));
      expect(back, `${p} → ${there} → ${back}`).toBe(p);
    }
  });

  it("canonise une barre oblique finale", () => {
    // `/fr/` et `/fr` sont la même page. Sans canonisation, un aller-retour
    // depuis `/fr/` aboutirait à `/` : le visiteur changerait de langue et
    // changerait de page au même moment.
    expect(switchLocalePath("/fr/", "fr")).toBe("/");
    expect(switchLocalePath("/fr/", "en")).toBe("/fr");
    expect(localePath("fr", "/fr/")).toBe("/fr");
    expect(localePath("fr", "/projects/")).toBe("/fr/projects");
  });
});