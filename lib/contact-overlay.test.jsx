/**
 * Tests du câblage du formulaire de contact.
 *
 * `lib/contact-form.test.js` prouve les décisions prises *avant* l'envoi. Ces
 * tests prouvent que le composant les prend réellement — que le délai est mesuré
 * depuis le montage, que le piège est soumis, que la borne announcement
 * `maxLength` atteint le HTML. Une règle peut être parfaitement écrite et
 * rester inerte : c'est ce que couvre ce fichier.
 *
 * Exécution : `npm test`.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, cleanup, screen, fireEvent } from "@testing-library/react";

import { ContactOverlay } from "../components/contact-overlay.jsx";
import { MIN_FILL_MS } from "./contact-form.js";

/** Une saisie complète, prête à partir. */
const SAISIE = {
  name: "Camille Dupont",
  email: "camille@example.org",
  message: "Bonjour, je vous écris au sujet de votre portfolio.",
};

let fetchSpy;

beforeEach(() => {
  fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchSpy);
  // L'horloge est advanced explicitement : le filtre de délai se compare au
  // montage, donc un test qui n'avance pas le temps verrait toujours « trop
  // rapide » et ne prouverait que ce cas-là.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Champ de saisie et libellé affiché.
 *
 * La correspondance est explicite plutôt que dérivée du nom du champ : les
 * libellés sont en français et ne suivent pas le nom (`name` → « Nom »), donc
 * une recherche par expression régulière trouverait « Email » pour `email` par
 * hasard et échouerait pour `name` — un test qui passe pour la mauvaise raison.
 */
const CHAMPS = [
  ["name", /nom/i],
  ["email", /email/i],
  ["message", /message/i],
];

/** Monte le formulaire et remplit les champs, `SAISIE` par défaut. */
function remplir(saisie = {}) {
  // `lang` est passé explicitement, même si les libellés de `CHAMPS` sont déjà en
  // français. L'overlay retombe sur la langue par défaut quand elle est absente,
  // et laisser le test en hériter le ferait échouer le jour où cette langue
  // change — pour une raison sans rapport avec ce qu'il vérifie.
  render(<ContactOverlay lang="fr" onClose={() => {}} />);
  for (const [nom, libelle] of CHAMPS) {
    const valeur = nom in saisie ? saisie[nom] : SAISIE[nom];
    if (valeur === undefined) continue;
    fireEvent.change(champ(libelle), { target: { value: valeur } });
  }
}

/** Le champ de saisie associé à un libellé. */
function champ(libelle) {
  return screen.getByLabelText(libelle);
}

/**
 * Remplit le champ-piège.
 *
 * Il n'a pas de libellé seekable : il est `aria-hidden`, donc
 * `getByLabelText` ne le voit pas. C'est le comportement attendu — on l'atteint
 * ici par son nom, comme un script le ferait, ce qui est précisément la
 * situation que le piège cherche à reproduire.
 */
function remplirLePiege(valeur) {
  const piege = document.querySelector('input[name="_gotcha"]');
  fireEvent.change(piege, { target: { value: valeur } });
}

/** Fait passer le délai minimal, puis soumet. */
function soumettreApresDelai() {
  act(() => {
    vi.advanceTimersByTime(MIN_FILL_MS);
  });
  fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));
}

describe("champ-piège", () => {
  it("est présent dans le formulaire soumis", () => {
    // Un piège absent du DOM ne peut rien attraper : c'est le piège lui-même
    // qui est soumis, pas une variable locale.
    remplir();
    const piege = document.querySelector('input[name="_gotcha"]');

    expect(piege).toBeTruthy();
  });

  it("est rendu mais invisible, et hors navigation au clavier", () => {
    // `type="hidden"` serait le choix naturel et serait inutile : un champ
    // `hidden` n'est pas focusable et n'est pas soumis par le navigateur.
    remplir();
    const piege = document.querySelector('input[name="_gotcha"]');

    expect(piege).not.toBeNull();
    expect(piege.type).not.toBe("hidden");
    expect(piege.tabIndex).toBe(-1);
  });

  it("n'est pas annoncé à un lecteur d'écran", () => {
    // Le champ porte un libellé, donc sans `aria-hidden` un lecteur d'écran
    // annoncerait « Ne pas remplir ce champ » au milieu du formulaire. La
    // recherche se fait par *rôle* : c'est la seule requête qui respecte
    // `aria-hidden`. Une recherche par texte le trouverait encore, et le test
    // passerait pour la mauvaise raison.
    remplir();

    expect(screen.queryByRole("textbox", { name: /ne pas remplir/i })).toBeNull();
  });
});

describe("bornes de longueur", () => {
  it("sont posées sur les trois champs", () => {
    // Le `maxLength` borne la saisie ; `lib/contact-form.js` repose la même
    // borne côté JS, pour un envoi construit sans navigateur. Les deux doivent
    // exister, et les deux doivent dire la même chose.
    remplir();

    expect(champ(/nom/i).getAttribute("maxlength")).toBe("120");
    expect(champ(/email/i).getAttribute("maxlength")).toBe("200");
    expect(champ(/message/i).getAttribute("maxlength")).toBe("4000");
  });
});

describe("envoi", () => {
  it("part vers Formspree après le délai, avec la saisie seule", () => {
    remplir();
    soumettreApresDelai();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const corps = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(corps).toEqual(SAISIE);
    // Le champ-piège ne part pas : Formspree le lirait comme un signal d'abus
    // dans ses propres logs, sans que cela serve la décision déjà prise ici.
    expect(corps).not.toHaveProperty("_gotcha");
  });

  it("n'envoie rien si le délai est trop court, et le dit « envoyé »", () => {
    // Le mensonge est délibéré, et c'est sa qualité qui compte : un robot qui
    // reçoit une confirmation ne réessaie pas, et un humain qui reçoit un faux
    // échec n'a qu'à renvoyer. Ce qui ne doit surtout pas arriver, c'est un
    // message d'erreur — il apprendrait à son auteur comment contourner le filtre.
    remplir();
    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/bien été transmis/i)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("n'envoie rien si le piège est rempli, et le dit « envoyé »", () => {
    remplir();
    remplirLePiege("https://spam.example");
    soumettreApresDelai();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/bien été transmis/i)).toBeTruthy();
  });

  it("refuse une adresse que le navigateur accepte et le motif refuse", () => {
    // `a@b` est le recouvrement entre les deux validations, et la raison
    // d'être de la seconde : le navigateur n'exige pas de point dans le
    // domaine, le motif en exige un. Une adresse manifestement fausse
    // (`pas-une-adresse`) n'atteindrait jamais ce code — la validation native
    // bloque la soumission et affiche sa propre bulle, ce qui est le bon
    // comportement et que ce test n'a pas à reproduire.
    remplir({ email: "a@b" });
    soumettreApresDelai();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/e-mail/i);
  });

  it("efface l'erreur dès la frappe suivante", () => {
    // La laisser affichée ferait croire que la saisie en cours sera refusée comme
    // la précédente — alors que la cause est corrigée.
    remplir({ email: "a@b" });
    soumettreApresDelai();
    expect(screen.getByRole("alert")).toBeTruthy();

    fireEvent.change(champ(/email/i), { target: { value: "camille@example.org" } });

    expect(screen.queryByRole("alert")).toBeNull();
  });
});