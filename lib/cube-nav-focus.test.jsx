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

import { CubeNav } from "../components/cube/cube-nav.jsx";

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
