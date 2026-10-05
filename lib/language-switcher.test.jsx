// @vitest-environment jsdom

/**
 * Tests du sélecteur de langue monté.
 *
 * Why monter le composant. La règle du sélecteur est visuelle et ne s'exprime pas
 * dans une fonction qu'on pourrait tester seule : « cliquer Français porte le
 * site en français ». Rien ne la couvre tant qu'elle reste dans le JSX, et
 * l'erreur qu'elle protège est invisible : le composant rend un élément valide,
 * pointe vers une URL valide, et affiche la langue qu'on vient de quitter.
 *
 * Why `next/navigation` est simulé. Le composant a besoin du pathname courant,
 * qui n'existe que dans le contexte de routage de Next ; hors application il vaut
 * `null` et le composant retomberait sur la racine. `next/link` est réduit à un
 * `<a>` : ce que ces tests portent, c'est le texte affiché et l'attribut
 * `href`, pas la navigation cliente, dont le contrat est déjà celui de Next.
 *
 * Exécution : `npm test`.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";

import { uiFor, LANGUAGE_CODES, LANGUAGE_NAMES } from "./content/ui.js";
import { SUPPORTED_LOCALES } from "./content/locales.js";
import { otherLocale, switchLocalePath } from "./site-routes.js";

// Le pathname est piloté par chaque test. `vi.hoisted` le déclare avant que le
// simulacre de `next/navigation` ne soit construit.
const state = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { LanguageSwitcher } from "../components/language-switcher.jsx";

afterEach(cleanup);

// Rendu du montage en cours. Les tests montent le sélecteur plusieurs fois
// dans une boucle, et `screen` cherche dans tout le document : sans démontage
// entre deux montages, `getByRole("link")` trouverait autant de liens que de
// montages.
let racine = null;

/** Monte le sélecteur sur la page donnée et rend le lien. */
function monter(lang, pathname = "/") {
  if (racine) racine.unmount();
  state.pathname = pathname;
  racine = render(<LanguageSwitcher lang={lang} />);
  return screen.getByRole("link");
}

/**
 * Le texte visible du bouton.
 *
 * Les deux libellés — le code pour le mobile, le nom au-delà — sont lus dans le
 * DOM : en jsdom les classes `hidden` ne s'appliquent pas, et les deux sont donc
 * présents. C'est ce qu'on veut, ils sont affichés tour à tour selon la largeur.
 * L'icône de globe est un `<svg>`, elle ne se glisse donc pas dans le relevé.
 */
function texteVisible(lien) {
  return Array.from(lien.querySelectorAll("span"))
    .map((span) => span.textContent)
    .join(" ");
}

/** Cas de navigation : langue courante, page visitée, page attendue. */
const NAVIGATION = [
  ["fr", "/", "/en"],
  ["en", "/", "/"],
  ["fr", "/projects", "/en/projects"],
  ["en", "/en/projects", "/projects"],
];

describe("langue affichée", () => {
  it("nomme la langue de destination, sur chaque langue", () => {
    // La règle, énoncée une fois et appliquée à toutes : ce qui est écrit sur le
    // bouton est la langue vers laquelle le clic porte le site.
    for (const lang of SUPPORTED_LOCALES) {
      const cible = otherLocale(lang);
      const lien = monter(lang);
      expect(texteVisible(lien), `page ${lang}`).toContain(LANGUAGE_NAMES[cible]);
      expect(texteVisible(lien), `page ${lang}`).toContain(LANGUAGE_CODES[cible]);
    }
  });

  it("ne nomme jamais la langue courante", () => {
    // Le corollaire, et c'est lui qui attrape l'inversion : le nom affiché doit
    // être celui de la langue vers laquelle le lien pointe, jamais celui de la
    // page visitée.
    for (const lang of SUPPORTED_LOCALES) {
      const lien = monter(lang);
      expect(
        texteVisible(lien),
        `page ${lang} : le bouton affiche « ${LANGUAGE_NAMES[lang]} »`,
      ).not.toContain(LANGUAGE_NAMES[lang]);
    }
  });

  it("annonce la page française et la page anglaise", () => {
    // Les deux pages, nommées : c'est ce que voit le visiteur.
    expect(texteVisible(monter("fr"))).toContain("English");
    expect(texteVisible(monter("en"))).toContain("Français");
  });
});

describe("destination", () => {
  it.each(NAVIGATION)("mène %s vers %s", (lang, pathname, attendu) => {
    // Le libellé et la destination disent la même chose, mais par deux chemins
    // distincts : le nom affiché pourrait se tromper de langue pendant que le
    // `href` reste juste, et l'inverse aussi.
    expect(monter(lang, pathname).getAttribute("href")).toBe(attendu);
  });

  it("conserve la page visitée", () => {
    // Le composant s'accorde avec `switchLocalePath`, la fonction testée par
    // ailleurs : le montage ne doit rien lui retirer.
    for (const [lang, pathname] of NAVIGATION) {
      expect(monter(lang, pathname).getAttribute("href")).toBe(
        switchLocalePath(pathname, lang),
      );
    }
  });

  it("déclare la langue de la cible", () => {
    // `lang` et `hreflang` décrivent le document lié, donc la destination. Le
    // texte visible nomme cette destination lui aussi : les deux concordent, et
    // surtout `lang` n'annonce pas du français à qui arrive sur une page anglaise.
    for (const lang of SUPPORTED_LOCALES) {
      const lien = monter(lang);
      const autre = otherLocale(lang);
      expect(lien.getAttribute("hreflang"), `page ${lang}`).toBe(autre);
      expect(lien.getAttribute("lang"), `page ${lang}`).toBe(autre);
    }
  });
});

describe("nom accessible", () => {
  it("contient le texte visible", () => {
    // « Label in Name » (WCAG 2.5.3, niveau A) : un `aria-label` qui remplace un
    // texte visible sans le contenir casse la commande vocale — « cliquer
    // Français » ne trouve plus rien. Les deux libellés sont vérifiés, car le
    // texte visible change avec la largeur.
    for (const lang of SUPPORTED_LOCALES) {
      const nom = (monter(lang).getAttribute("aria-label") || "").toLowerCase();
      expect(nom, `page ${lang} : le nom accessible est vide`).not.toBe("");
      for (const visible of [
        LANGUAGE_NAMES[otherLocale(lang)],
        LANGUAGE_CODES[otherLocale(lang)],
      ]) {
        expect(nom.includes(visible.toLowerCase()), `« ${visible} » absent de « ${nom} »`).toBe(
          true,
        );
      }
    }
  });

  it("décrit le clic, dans la langue du visiteur", () => {
    // Le nom accessible dit où mène le lien, dans la langue de la page : c'est la
    // seule chose qui reste à dire, le texte visible nommant lui aussi la cible.
    // Le nom est vérifié en entier : une phrase qui mentionnerait la destination
    // sans être celle attendue ne prouverait rien.
    for (const lang of SUPPORTED_LOCALES) {
      const nom = monter(lang).getAttribute("aria-label");
      expect(nom, `page ${lang}`).toContain(LANGUAGE_NAMES[otherLocale(lang)]);
      expect(nom, `page ${lang}`).toContain(uiFor(lang).nav.switchLanguage);
    }
  });

  it("rejoint le libellé visible", () => {
    // `title` reprend la même chaîne : un survol annonçant autre chose que ce que
    // le lecteur d'écran lit fait dire au lien deux choses différentes.
    for (const lang of SUPPORTED_LOCALES) {
      const lien = monter(lang);
      expect(lien.getAttribute("title")).toBe(lien.getAttribute("aria-label"));
    }
  });
});