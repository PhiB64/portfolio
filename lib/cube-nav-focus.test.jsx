// @vitest-environment jsdom

/**
 * Tests du focus du bouton SKIP/RETOUR.
 *
 * Why ce test. Un clic sur SKIP le masque aussitôt (`skipped` fait basculer
 * `aria-hidden`) alors qu'il a encore le focus : Chrome refuse `aria-hidden`
 * sur un élément focalisé et l'écrit en console (« Blocked aria-hidden... »),
 * et le focus reste sur un contrôle masqué. Le correctif — rendre le focus
 * avant de lancer le sweep — est invisible dans le JSX, et une régression
 * serait silencieuse hors console navigateur : seul un test monté la voit.
 *
 * Exécution : `npm test`.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";

import { CubeNav, projectLinks } from "../components/cube/cube-nav.jsx";

afterEach(cleanup);

/** Le parent minimal : SKIP visible, pas de RETOUR, `onSkip` espionné. */
function monterSkip(props = {}) {
  const onSkip = vi.fn();
  render(
    <CubeNav
      lang="fr"
      zoomedFaces={[false, false, false, false, false, false]}
      skipped={false}
      skipRevealedFaces={[false, false, false, false, false, false]}
      contactDone={false}
      onOpenProject={() => {}}
      onContactClick={() => {}}
      onSkip={onSkip}
      onRestart={() => {}}
      showReturn={false}
      contactBtnStyle={{}}
      {...props}
    />,
  );
  return onSkip;
}

describe("bouton SKIP — le focus est rendu avant le masquage", () => {
  it("blur avant onSkip, et le bouton cesse d'être focalisé", () => {
    const onSkip = monterSkip();
    const bouton = screen.getByRole("button", { name: /passer l'animation/i });
    bouton.focus();
    expect(document.activeElement).toBe(bouton);

    fireEvent.click(bouton);

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(bouton);
  });

  it("RETOUR rend le focus aussi : il se masque dès son clic", () => {
    const onRestart = vi.fn();
    monterSkip({ showReturn: true, onRestart });
    const bouton = screen.getByRole("button", { name: /revenir au début/i });
    bouton.focus();

    fireEvent.click(bouton);

    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(bouton);
  });
});

describe("bouton CONTACT mobile — même gabarit que les onglets", () => {
  // L'exemplaire mobile (centré en bas, `sm:hidden`) lisait comme un appel à
  // l'action — `px-6 py-2.5 text-sm` — au lieu d'un onglet parmi d'autres
  // (`px-2.5 py-2 text-[11px]`, largeur d'une cellule de la grille à 3
  // colonnes). Le test compare les classes qui portent la taille, pas les
  // chaînes entières : position et couleurs diffèrent légitimement, seules la
  // taille et la largeur doivent suivre les onglets.
  // Tailles portées par les onglets sur mobile (voir `CubeNav`) : CONTACT
  // mobile doit porter les mêmes, plus la largeur d'une cellule. Ni les
  // couleurs ni la position ne sont comparées : fond blanc centré en bas
  // contre fond sombre en haut, elles diffèrent légitimement.
  const TAILLES_ONGLET = ["px-2.5", "py-2", "text-[11px]"];

  // Largeur d'une cellule d'onglet mobile : la nav vaut `w-[88vw] px-2
  // grid-cols-3 gap-2`, donc (88vw − 2×`px-2` − 2×`gap-2`) / 3. Le test relit
  // ces trois classes dans la nav et exige que CONTACT porte leur combinaison
  // exacte — si la grille change, c'est ici que ça casse, pas à l'œil sur
  // téléphone.
  const largeurCelluleAttendues = () => {
    const nav = document.querySelector("nav");
    const cls = nav.className.split(/\s+/);
    expect(cls).toContain("w-[88vw]");
    expect(cls).toContain("grid-cols-3");
    expect(cls).toContain("gap-2");
    return ["w-[calc((88vw-2rem)/3)]"];
  };

  it("taille, police et largeur identiques à celles d'un onglet", () => {
    monterSkip({ contactDone: true, skipped: true });
    // Deux exemplaires portent le nom CONTACT (desktop caché + mobile) : le
    // `sm:hidden` désigne celui du téléphone.
    const contact = document.querySelector("button.sm\\:hidden");
    expect(contact?.textContent).toBe("CONTACT");
    const classes = contact.className.split(/\s+/);
    for (const c of TAILLES_ONGLET) expect(classes).toContain(c);
    for (const c of largeurCelluleAttendues()) expect(classes).toContain(c);
    // Et l'onglet lui-même porte bien ces tailles : si `CubeNav` les change un
    // jour, c'est `TAILLES_ONGLET` — pas le téléphone — qu'il faudra suivre.
    const onglet = screen.getByRole("button", {
      name: projectLinks("fr")[0].name,
    });
    for (const c of TAILLES_ONGLET) {
      expect(onglet.className.split(/\s+/)).toContain(c);
    }
  });
});
