/**
 * Tests de `lib/use-dialog-focus.js`.
 *
 * Le module est né d'un constat : `grep -i escape` ne trouvait aucune occurrence
 * dans tout le dépôt, et les deux overlays plein écran n'avaient ni `role`, ni
 * `aria-modal`, ni gestion du focus. Un visiteur au clavier ouvrait une rubrique
 * et ne pouvait la refermer qu'en rebouclant jusqu'au bouton placé dessous.
 *
 * Ce sont des comportements qu'aucun rendu d'écran ne révèle — ils ne cassent
 * aucune pixels, seulement l'usage au clavier — donc ils se testent sur un DOM,
 * pas sur une capture.
 *
 * Exécution : `npm test`.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, cleanup, screen } from "@testing-library/react";
import { useRef } from "react";

import {
  useDialogFocus,
  useEscapeKey,
  useFocusExempt,
  exemptFocusables,
  focusableWithin,
} from "./use-dialog-focus.js";

/** Laisse passer la frame qui porte le focus initial. */
const flushFrame = () =>
  act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  });

/**
 * Dialogue minimal : trois contrôles, plus un bouton déclencheur hors dialogue —
 * c'est lui qui a le focus à l'ouverture et qui doit le récupérer à la fermeture.
 */
function Dialog({ open, onClose, options }) {
  const ref = useRef(null);
  useDialogFocus(open, ref, onClose, options);
  return (
    <>
      <button type="button" data-testid="opener">
        ouvrir
      </button>
      {open && (
        <div role="dialog" aria-modal="true" ref={ref}>
          <button type="button" data-testid="first">
            premier
          </button>
          <input data-testid="field" />
          <button type="button" data-testid="last">
            dernier
          </button>
        </div>
      )}
    </>
  );
}

const focused = () => document.activeElement?.getAttribute("data-testid");

// JSDOM refuse le dispatch d'un objet littéral : il faut un vrai
// `KeyboardEvent`, et `cancelable` pour que `preventDefault` ait un sens.
// `preventDefault` est espionné plutôt que simulé — c'est bien cet appel que le
// piège fait, et l'assertion doit porter sur lui.
const press = (k, shift = false) => {
  const event = new KeyboardEvent("keydown", {
    key: k,
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  vi.spyOn(event, "preventDefault");
  return event;
};

afterEach(cleanup);

describe("focusableWithin", () => {
  it("liste les contrôles focusables dans l'ordre du DOM", () => {
    document.body.innerHTML = `
      <div id="root">
        <button id="a">a</button>
        <a id="b" href="#">b</a>
        <input id="c" />
        <button id="d" disabled>d</button>
        <input id="e" type="hidden" />
        <div id="f" tabindex="-1">f</div>
        <div id="g" tabindex="0">g</div>
        <span id="h">h</span>
      </div>`;

    const ids = focusableWithin(document.getElementById("root")).map((el) => el.id);

    // Désactivés, `type="hidden"`, `tabindex="-1"` et non-focusables sont
    // exclus. `tabindex="0"` est le cas à ne pas perdre : seul moyen de
    // rendre focusable un `<div>`.
    expect(ids).toEqual(["a", "b", "c", "g"]);
  });

  it("exclut un élément en display none", () => {
    document.body.innerHTML = `
      <div id="root">
        <button id="a">a</button>
        <button id="b" style="display: none">b</button>
      </div>`;

    expect(focusableWithin(document.getElementById("root")).map((el) => el.id)).toEqual(["a"]);
  });

  it("exclut un bouton sorti de la tabulation par tabindex -1", () => {
    // C'est le mécanisme retenu sur CONTACT et SKIP du cube : masqués en
    // opacité, ils sortent de la tabulation par `tabIndex`, pas par
    // `visibility` — cette dernière aurait tué leur fondu.
    document.body.innerHTML = `
      <div id="root">
        <button id="a">a</button>
        <button id="b" tabindex="-1">b</button>
        <a id="c" href="#" tabindex="-1">c</a>
      </div>`;

    expect(focusableWithin(document.getElementById("root")).map((el) => el.id)).toEqual(["a"]);
  });

  it("exclut un élément en visibility hidden", () => {
    document.body.innerHTML = `
      <div id="root">
        <button id="a">a</button>
        <button id="b" style="visibility: hidden">b</button>
      </div>`;

    expect(focusableWithin(document.getElementById("root")).map((el) => el.id)).toEqual(["a"]);
  });

  it("garde un élément en opacity 0", () => {
    // Un fondu en cours ne doit pas faire scintiller la tabulation. Les boutons
    // réellement masqués du cube sont pilotés en `visibility`.
    document.body.innerHTML = `
      <div id="root">
        <button id="a">a</button>
        <button id="b" style="opacity: 0">b</button>
      </div>`;

    expect(focusableWithin(document.getElementById("root")).map((el) => el.id)).toEqual(["a", "b"]);
  });

  it("exclut un élément porteur de l'attribut hidden", () => {
    document.body.innerHTML = `
      <div id="root">
        <button id="a">a</button>
        <button id="b" hidden>b</button>
      </div>`;

    expect(focusableWithin(document.getElementById("root")).map((el) => el.id)).toEqual(["a"]);
  });

  it("ne lève pas sur un nœud absent", () => {
    expect(focusableWithin(null)).toEqual([]);
    expect(focusableWithin(undefined)).toEqual([]);
  });
});

describe("useDialogFocus — focus", () => {
  it("pose le focus sur le premier contrôle du dialogue", async () => {
    render(<Dialog open onClose={vi.fn()} />);
    await flushFrame();

    expect(focused()).toBe("first");
  });

  it("ne touche à rien tant que le dialogue est fermé", async () => {
    render(<Dialog open={false} onClose={vi.fn()} />);
    await flushFrame();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(focused()).not.toBe("first");
  });

  it("rend le focus au bouton déclencheur au démontage", async () => {
    const opener = document.createElement("button");
    opener.dataset.testid = "outside";
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<Dialog open onClose={vi.fn()} />);
    await flushFrame();
    expect(focused()).toBe("first");

    unmount();

    // Sans restauration, le focus tombe sur `body` et la tabulation repart du
    // haut du document : le visiteur perd sa place à chaque ouverture.
    expect(document.activeElement).toBe(opener);
  });
});

describe("useDialogFocus — Échap", () => {
  it("ferme sur Échap", async () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} />);
    await flushFrame();

    act(() => {
      document.dispatchEvent(press("Escape"));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignore les autres touches", async () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} />);
    await flushFrame();

    act(() => {
      document.dispatchEvent(press("a"));
      document.dispatchEvent(press("Enter"));
      document.dispatchEvent(press("ArrowDown"));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("n'écoute pas quand le dialogue est fermé", async () => {
    const onClose = vi.fn();
    render(<Dialog open={false} onClose={onClose} />);
    await flushFrame();

    act(() => {
      document.dispatchEvent(press("Escape"));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("n'écoute rien quand enabled vaut false", async () => {
    // Mode prévu pour une surface qui gère déjà sa fermeture : le focus initial
    // est posé, mais ni Échap ni piège.
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} options={{ enabled: false }} />);
    await flushFrame();

    act(() => {
      document.dispatchEvent(press("Escape"));
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(focused()).toBe("first");
  });
});

describe("useDialogFocus — piège de tabulation", () => {
  it("reboucle du dernier contrôle au premier", async () => {
    render(<Dialog open onClose={vi.fn()} />);
    await flushFrame();

    screen.getByTestId("last").focus();
    const event = press("Tab");

    act(() => {
      document.dispatchEvent(event);
    });

    // Sans ce cas, Tab depuis le dernier contrôle sort du dialogue par le bas.
    expect(event.preventDefault).toHaveBeenCalled();
    expect(focused()).toBe("first");
  });

  it("reboucle du premier au dernier avec Maj+Tab", async () => {
    render(<Dialog open onClose={vi.fn()} />);
    await flushFrame();

    screen.getByTestId("first").focus();
    const event = press("Tab", true);

    act(() => {
      document.dispatchEvent(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(focused()).toBe("last");
  });

  it("laisse Tab circuler entre deux contrôles internes", async () => {
    render(<Dialog open onClose={vi.fn()} />);
    await flushFrame();

    screen.getByTestId("field").focus();
    const event = press("Tab");

    act(() => {
      document.dispatchEvent(event);
    });

    // Le piège ne doit pas confisquer chaque Tab : tant qu'on reste dans la
    // fenêtre du dialogue, le navigateur fait son travail.
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("retient le focus quand le dialogue n'a aucun contrôle", async () => {
    // Un dialogue sans contrôle focusable ne doit pas laisser la tabulation
    // filer sur la page derrière.
    function Bare() {
      const ref = useRef(null);
      useDialogFocus(true, ref, vi.fn());
      return <div role="dialog" aria-modal="true" tabIndex={-1} ref={ref} data-testid="bare" />;
    }

    render(<Bare />);
    await flushFrame();

    const event = press("Tab");
    act(() => {
      document.dispatchEvent(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(focused()).toBe("bare");
  });

  it("saute un contrôle masqué en début de dialogue", async () => {
    // Cas réel : la barre d'onglets est en `hidden sm:block`, donc absente de la
    // liste sur mobile. Le premier focusable réel doit quand même recevoir le
    // focus.
    function PartiallyHidden() {
      const ref = useRef(null);
      useDialogFocus(true, ref, vi.fn());
      return (
        <div role="dialog" ref={ref}>
          <button type="button" style={{ display: "none" }} data-testid="masque">
            masqué
          </button>
          <button type="button" data-testid="visible">
            visible
          </button>
        </div>
      );
    }

    render(<PartiallyHidden />);
    await flushFrame();

    expect(focused()).toBe("visible");
  });
});

describe("useEscapeKey", () => {
  it("ferme quand le panneau est ouvert, pas quand il est fermé", () => {
    const onClose = vi.fn();
    function Panel({ open }) {
      useEscapeKey(open, onClose);
      return null;
    }

    const { rerender } = render(<Panel open={false} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).not.toHaveBeenCalled();

    rerender(<Panel open />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cesse d'écouter au démontage", () => {
    const onClose = vi.fn();
    function Panel() {
      useEscapeKey(true, onClose);
      return null;
    }

    const { unmount } = render(<Panel />);
    unmount();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("survit à un onClose recréé à chaque rendu", () => {
    // Le panneau re-rend à chaque fragment de réponse ; si l'abonnement
    // dépendait de l'identité de la fonction, il serait posé et reposé en
    // boucle. Ici on vérifie qu'un Échap atteint le dernier `onClose`.
    const seen = [];
    function Panel({ tick }) {
      useEscapeKey(true, () => seen.push(tick));
      return null;
    }

    const { rerender } = render(<Panel tick={1} />);
    rerender(<Panel tick={2} />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(seen).toEqual([2]);
  });

  it("ferme le panneau avant le dialogue qu'il recouvre", async () => {
    // Le panneau de l'assistant est passé au-dessus des overlays. Les deux
    // couches peuvent donc être ouvertes ensemble, et Échap doit refermer la
    // plus haute — celle qu'on voit. `useDialogFocus` écoute sur `document` en
    // capture, `useEscapeKey` sur `window` en capture : la capture sur `window`
    // arrive en premier, c'est ce qui rend cet ordre possible.
    const closePanel = vi.fn();
    const closeDialog = vi.fn();

    function Both() {
      const ref = useRef(null);
      useDialogFocus(true, ref, closeDialog);
      useEscapeKey(true, closePanel);
      return (
        <div role="dialog" aria-modal="true" ref={ref}>
          <button type="button" data-testid="only">
            dans le dialogue
          </button>
        </div>
      );
    }

    render(<Both />);
    await flushFrame();

    act(() => {
      window.dispatchEvent(press("Escape"));
    });

    expect(closePanel).toHaveBeenCalledTimes(1);
    // Le dialogue reste ouvert : un seul Échap, une seule couche refermée.
    expect(closeDialog).not.toHaveBeenCalled();
  });
});

describe("useFocusExempt", () => {
  /** Lanceur du chat : un bouton hors du dialogue, au-dessus de lui. */
  function Escort() {
    const escortRef = useRef(null);
    useFocusExempt(escortRef);
    return (
      <button type="button" data-testid="escort" ref={escortRef}>
        chat
      </button>
    );
  }

  it("rend le nœud tabulable depuis le dernier contrôle du dialogue", async () => {
    // Sans cette exception, le piège boucle sur les trois contrôles du
    // dialogue et le lanceur du chat — visible au-dessus de l'overlay — reste
    // hors d'atteinte de la Tab. C'est un échec de 2.1.1 qu'aucune capture ne
    // montre.
    const onClose = vi.fn();
    render(
      <>
        <Escort />
        <Dialog open onClose={onClose} />
      </>,
    );
    await flushFrame();
    expect(focused()).toBe("first");

    // Le parcours réel : on tabule jusqu'au dernier contrôle du dialogue, puis on
    // continue. C'est là que le piège referait la boucle sur le premier.
    act(() => {
      screen.getByTestId("last").focus();
    });
    expect(focused()).toBe("last");

    act(() => {
      document.dispatchEvent(press("Tab"));
    });

    // Le dernier contrôle du dialogue ne reboucle plus sur le premier : il passe
    // au lanceur, qui est la couche supérieure.
    expect(focused()).toBe("escort");
  });

  it("n'inscrit rien après le démontage", async () => {
    // Le registre est un `Set` de module : un nœud resté inscrit ferait
    // `focusableWithin` parcourir un nœud détaché, et ferait surtout croire
    // qu'un widget démonté est encore tabulable.
    const { unmount } = render(
      <>
        <Escort />
        <Dialog open onClose={vi.fn()} />
      </>,
    );
    await flushFrame();
    expect(exemptFocusables()).toHaveLength(1);

    unmount();
    expect(exemptFocusables()).toHaveLength(0);
  });

  it("laisse le dialogue seul quand rien ne s'exempte", async () => {
    // Cas ordinaire : sans widget au-dessus, le cycle ne doit pas changer. Le
    // dialogue reste refermable du dernier au premier contrôle.
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} />);
    await flushFrame();

    act(() => {
      document.dispatchEvent(press("Tab"));
    });

    expect(focused()).toBe("first");
  });
});