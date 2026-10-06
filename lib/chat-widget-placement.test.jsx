// @vitest-environment jsdom

/**
 * Tests de la présence du chatbot sur toutes les pages.
 *
 * Why monter le layout. Le widget était rendu par `HomePage`, donc par les deux
 * pages d'accueil seulement. `/projects` et `/fr/projects` s'en trouvaient
 * dépourvues — les deux routes où le visiteur reste le plus longtemps à lire, et
 * les seules où le contenu textuel est servi en HTML. Aucune capture d'écran ne
 * révèle l'absence d'un composant : il n'y a rien à comparer. Le test porte donc
 * sur ce que chaque layout rend, pas sur une apparence.
 *
 * WhyENDPOINT est posé ici. `ChatWidget` lit `NEXT_PUBLIC_CHAT_ENDPOINT` au
 * chargement du module et rend `null` sans elle. Sans cette variable, tous les
 * tests ci-dessous passeraient sans jamais avoir monté le widget — ils
 * vérifieraient `null === null`, ce qui est toujours vrai. Le Worker n'est pas
 * déployé en développement, et c'est précisément ce qui rend cette condition
 * nécessaire.
 *
 * Exécution : `npm test`.
 *
 * Note : Testing Library monte le rendu dans un `<div>`, et `SiteShell` rend un
 * `<html>`. D'où l'avertissement « `<html>` cannot be a child of `<div>` » sur
 * stderr. Il vient du harnais de test, pas du site : dans Next, `SiteShell` est
 * bien le layout racine, et le document est valide.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";

process.env.NEXT_PUBLIC_CHAT_ENDPOINT = "https://chat.example.org";

// `next/font` tente un téléchargement à l'import : hors application il n'a pas de
// cache, et le test died sur la résolution de la police.
vi.mock("next/font/google", () => ({
  Share_Tech_Mono: () => ({ variable: "--font-share-tech-mono" }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { SiteShell } = await import("../components/site-shell.jsx");
const { ProjectsPage } = await import("../components/projects-page.jsx");

afterEach(cleanup);

/**
 * Le lanceur du chatbot est-il là ?
 *
 * On le cherche par son rôle plutôt que par son libellé : le libellé est traduit
 * et change avec la langue, et un test qui rate sur la langue échouerait pour la
 * mauvaise raison. `aria-controls` désigne le panneau : c'est le couple qui
 * définit le widget, et il doit tenir sur les quatre pages.
 */
const hasLauncher = () => {
  const launcher = document.querySelector('button[aria-controls="chat-panel"]');
  expect(launcher).not.toBeNull();
  return launcher;
};

describe("présence du chatbot", () => {
  it("sur la page /projects", () => {
    // La page qu'il ne partage pas avec l'accueil : même layout, mais un
    // composant différent pour le contenu.
    render(
      <SiteShell lang="fr">
        <ProjectsPage lang="fr" />
      </SiteShell>,
    );
    hasLauncher();
  });

  it("sur la page /fr/projects", () => {
    render(
      <SiteShell lang="en">
        <ProjectsPage lang="en" />
      </SiteShell>,
    );
    hasLauncher();
  });

  it("une seule fois par page, et refermable", async () => {
    // Deux widgets sur la même page donneraient deux lanceurs, deux panneaux et
    // deux historiques : le visiteur verrait deux bulles superposées au même
    // coin. Le déplacement vers le layout rendait l'accident possible, d'où ce
    // test.
    const { unmount } = render(
      <SiteShell lang="fr">
        <ProjectsPage lang="fr" />
      </SiteShell>,
    );

    expect(document.querySelectorAll('button[aria-controls="chat-panel"]')).toHaveLength(1);
    expect(screen.queryByRole("region")).toBeNull();

    // Refermé au départ : le panneau n'est monté qu'au clic, et il n'existe donc
    // pas dans le HTML pour le moment. Un moteur de recherche et un lecteur
    // d'écran ne le rencontrent pas.
    unmount();
  });

  it("au-dessus des overlays, pas dessous", async () => {
    // L'ordre d'empilement est le cœur de la demande : un widget visible mais
    // passé sous l'overlay est un widget absent. Or les deux ne sont pas dans le
    // même composant — le widget est dans le layout, les overlays dans la page.
    //
    // Why lire les sources plutôt que recopier les valeurs. Des constantes
    // recopiées ici passeraient encore si quelqu'un montait un overlay au-dessus
    // du widget : le test serait vert et la régression en place. La seule lecture
    // qui tient est celle de la vérité — d'où `readFileSync` sur les fichiers
    // concernés. Ce test croise alors deux fichiers qui n'importent rien l'un de
    // l'autre, et c'est exactement l'invariant à protéger.
    render(
      <SiteShell lang="fr">
        <ProjectsPage lang="fr" />
      </SiteShell>,
    );

    const launcher = hasLauncher();
    const match = launcher.className.match(/z-\[(\d+)\]/);
    // Un `z-50` simple n'a pas de crochets : le widget en a besoin pour passer
    // au-dessus d'un `z-50`, et c'est cette syntaxe-là qu'on attend.
    expect(match, "le lanceur doit porter un z-index entre crochets").not.toBeNull();
    const chatZ = Number(match[1]);

    // Valeurs relevées dans le JSX, converties en entiers : comparer `z-[70]` à
    // `z-50` comparerait des chaînes, et l'ordre alphabétique (`"7"` > `"5"`)
    // donnerait un hasard favorable au lieu d'une preuve.
    //
    // On prend le `z-index` le plus PROCHE du `aria-labelledby`, et non le
    // premier trouvé. Deux raisons ont fait échouer les écritures plus simples :
    // l'ordre des attributs varie — le `className` précède le `aria-labelledby`
    // dans `orientation-lock.jsx` et le suit dans `hero-cube.jsx` — et la
    // recherche par balise entière échoue sur la flèche `=>` du `ref` de
    // l'overlay projet, qui contient un `>`.
    const readZ = (file, marker) => {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      const at = source.indexOf(marker);
      expect(at, `${file} : ${marker} introuvable`).not.toBe(-1);

      const BEFORE = 300;
      const AFTER = 200;
      const zone = source.slice(Math.max(0, at - BEFORE), at + AFTER);
      const origin = Math.min(at, BEFORE);

      const near = [...zone.matchAll(/z-\[?(\d+)\]?/g)]
        .map((m) => ({ z: Number(m[1]), dist: Math.abs(origin + m.index - at) }))
        .sort((a, b) => a.dist - b.dist)[0];

      expect(near, `${file} : aucun z-index près de ${marker}`).toBeDefined();
      return near.z;
    };

    const contactZ = readZ(
      "../components/hero-cube.jsx",
      'aria-labelledby="contact-overlay-title"',
    );
    const projectZ = readZ(
      "../components/hero-cube.jsx",
      'aria-labelledby="project-overlay-title"',
    );
    const orientationZ = readZ(
      "../components/cube/orientation-lock.jsx",
      'aria-labelledby="orientation-lock-title"',
    );

    expect(chatZ).toBeGreaterThan(contactZ);
    expect(chatZ).toBeGreaterThan(projectZ);
    // Et sous le verrou d'orientation : un mur, pas un overlay. En paysage le
    // portfolio n'a rien à montrer, un bouton de discussion n'y servirait à rien.
    expect(chatZ).toBeLessThan(orientationZ);
  });

  it("voile la page sur mobile quand le panneau s'ouvre", async () => {
    // Sur mobile le panneau fait presque plein écran : sans voile, le visiteur
    // lit deux couches à la fois. Sur desktop ce n'est qu'une bulle en coin,
    // un voile plein écran y serait intrusif. Le test porte donc sur trois
    // choses : le voile n'existe pas au départ, il couvre la page à l'ouverture
    // mais s'efface en `sm:`, et il disparaît à la fermeture.
    const { fireEvent } = await import("@testing-library/react");
    render(
      <SiteShell lang="fr">
        <ProjectsPage lang="fr" />
      </SiteShell>,
    );

    expect(document.querySelector("[data-chat-backdrop]")).toBeNull();

    fireEvent.click(hasLauncher());
    const backdrop = document.querySelector("[data-chat-backdrop]");
    expect(backdrop).not.toBeNull();
    // Plein écran, sombre semi-transparent, masqué dès `sm:`.
    expect(backdrop.className).toMatch(/fixed inset-0/);
    expect(backdrop.className).toMatch(/bg-\[#0a0f1c\]\/70/);
    expect(backdrop.className).toMatch(/sm:hidden/);
    // Juste sous le panneau et le lanceur, mais au-dessus des overlays : le
    // voile est lu dans le JSX du widget, les overlays dans `hero-cube.jsx`
    // (voir le test d'empilement ci-dessus pour ces valeurs).
    const z = Number(backdrop.className.match(/z-\[(\d+)\]/)?.[1]);
    expect(z).toBeLessThan(70);
    expect(z).toBeGreaterThan(60);
    // Caché aux lecteurs d'écran : le widget reste non modal au clavier.
    expect(backdrop.getAttribute("aria-hidden")).toBe("true");

    // Le voile est aussi une sortie : un clic dessus referme le panneau.
    fireEvent.click(backdrop);
    expect(document.querySelector("[data-chat-backdrop]")).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });
});