import { describe, expect, it } from "vitest";

import { CUBE_END, INTRO_END, SPIN_END, SPIN_START } from "./cube-timeline.js";
import {
  AUTOPLAY_CATCHUP_MS,
  SKIP_UNFOLD_MS,
  autoplayHeadP,
  finaleBudgets,
  runFinale,
  skipDurationMs,
  skipUnfoldP,
} from "./cube-finale";

/**
 * Ces tests sont un contrat, pas une couverture.
 *
 * Pendant la fin de séquence, plus personne ne pilote : le cube avance tout seul
 * jusqu'aux noms. Toute la question est alors « à quelle position de timeline
 * correspond une durée écoulée », et c'est ce que décide ce module. Une valeur
 * déplacée d'un millimètre étire un segment entier — le spin s'étire, ou, pire,
 * la showcase mange la révolution.
 *
 * Les nombres sont épinglés tels qu'ils sortaient du composant, avant extraction,
 * pour que le déplacement soit prouvé sans débat. Les relations sont testées en
 * plus des valeurs, parce qu'un jeu de nombres peut être recalculé sans être
 * faux : c'est le raccordement des segments qu'il faut protéger.
 */

const DESKTOP = finaleBudgets(false);
const MOBILE = finaleBudgets(true);

describe("budgets de la fin", () => {
  it("conserve les trois durées par appareil", () => {
    expect(DESKTOP).toEqual({
      SHOW_MS: 2600,
      SPIN_MS: 4000,
      TAIL_MS: 1800,
      FINALE_MS: 8400,
      SKIP_FINALE_MS: 5800,
    });
    expect(MOBILE).toEqual({
      SHOW_MS: 3000,
      SPIN_MS: 4400,
      TAIL_MS: 2000,
      FINALE_MS: 9400,
      SKIP_FINALE_MS: 6400,
    });
  });

  it("donne au mobile un segment plus long sur chacun des trois", () => {
    // Le mobile lit le même arc sur un écran plus petit : plus lent, mais dans
    // le même ordre de grandeur (~1,12x). Un segment raccourci là-bas se
    // verrait comme un cube qui saute.
    expect(MOBILE.SHOW_MS).toBeGreaterThan(DESKTOP.SHOW_MS);
    expect(MOBILE.SPIN_MS).toBeGreaterThan(DESKTOP.SPIN_MS);
    expect(MOBILE.TAIL_MS).toBeGreaterThan(DESKTOP.TAIL_MS);
  });

  it("déduit les totaux des trois segments", () => {
    for (const b of [DESKTOP, MOBILE]) {
      expect(b.FINALE_MS).toBe(b.SHOW_MS + b.SPIN_MS + b.TAIL_MS);
      // Le skip n'a pas de showcase à jouer : sa finale part au début du spin.
      expect(b.SKIP_FINALE_MS).toBe(b.SPIN_MS + b.TAIL_MS);
    }
  });

  it("fixe les deux durées qui ne dépendent pas de l'appareil", () => {
    expect(AUTOPLAY_CATCHUP_MS).toBe(250);
    expect(SKIP_UNFOLD_MS).toBe(1200);
  });
});

describe("runFinale — la marche segmentée", () => {
  it("atterrit exactement sur les frontières de phase", () => {
    for (const b of [DESKTOP, MOBILE]) {
      expect(runFinale(0, 0, b)).toBe(0);
      // Fin de la showcase : exactement SPIN_START, au pixel près.
      expect(runFinale(0, b.SHOW_MS, b)).toBe(SPIN_START);
      // Fin du spin : exactement SPIN_END.
      expect(runFinale(0, b.SHOW_MS + b.SPIN_MS, b)).toBe(SPIN_END);
      // Fin de la queue : exactement 1, la fin de la piste.
      expect(runFinale(0, b.FINALE_MS, b)).toBe(1);
    }
  });

  it("ne bouge pas une fois la fin atteinte", () => {
    // Le clamp de la queue : au-delà de `FINALE_MS` la tête reste à 1. Sans lui,
    // l'autoplay écrirait un `scrollTop` au-delà du bas de la piste.
    for (const b of [DESKTOP, MOBILE]) {
      expect(runFinale(0, b.FINALE_MS + 5000, b)).toBe(1);
      expect(runFinale(0, 1e9, b)).toBe(1);
    }
  });

  it("ne fait aucun saut aux raccords de segments", () => {
    // C'est l'invariant central. Un raccord qui saute se voit à l'écran comme
    // une secousse : la position ne peut pas bouger entre « juste avant » et
    // « à l'instant ».
    for (const b of [DESKTOP, MOBILE]) {
      const joins = [b.SHOW_MS, b.SHOW_MS + b.SPIN_MS, b.FINALE_MS];
      for (const j of joins) {
        const before = runFinale(0, j - 1e-6, b);
        const after = runFinale(0, j, b);
        expect(after - before).toBeLessThan(1e-3);
      }
    }
  });

  it("avance sans jamais reculer", () => {
    for (const b of [DESKTOP, MOBILE]) {
      let prev = -Infinity;
      for (let t = 0; t <= b.FINALE_MS + 2000; t += 13) {
        const p = runFinale(0, t, b);
        expect(p).toBeGreaterThanOrEqual(prev);
        prev = p;
      }
    }
  });

  it("saute la showcase quand le départ est déjà dans le spin", () => {
    // 6e clic tardif, ou skip pressé pendant la révolution : le départ est passé
    // SPIN_START, donc la showcase ne doit pas être rejouée et le spin ne doit
    // pas être comprimé par elle.
    for (const b of [DESKTOP, MOBILE]) {
      expect(runFinale(SPIN_START, 0, b)).toBe(SPIN_START);
      expect(runFinale(SPIN_START, b.SPIN_MS, b)).toBe(SPIN_END);
      expect(runFinale(SPIN_START, b.SPIN_MS + b.TAIL_MS, b)).toBe(1);
      // Aucune durée de showcase ne s'écoule : le segment spin tient seul.
      expect(runFinale(SPIN_START, b.SHOW_MS, b)).toBe(
        SPIN_START + (SPIN_END - SPIN_START) * (b.SHOW_MS / b.SPIN_MS),
      );
    }
  });

  it("part du `fromP` qu'on lui donne, et de rien d'autre", () => {
    // Un skip pressé à mi-parcours doit reprendre la trajectoire depuis sa
    // propre position, jamais depuis SPIN_START : ce serait une téléportation.
    for (const b of [DESKTOP, MOBILE]) {
      const from = CUBE_END;
      expect(runFinale(from, 0, b)).toBe(from);
    }
  });
});

describe("autoplayHeadP — le raccord du rattrapage", () => {
  const TL_START = 0.78;

  it("bride le rattrapage, puis confie la fin à runFinale", () => {
    for (const b of [DESKTOP, MOBILE]) {
      const catchMs = AUTOPLAY_CATCHUP_MS;
      // Avant l'expiration du budget : simple interpolation vers CUBE_END.
      expect(autoplayHeadP(0, catchMs, TL_START, b)).toBe(TL_START);
      // À l'expiration exacte : CUBE_END, et rien d'autre.
      expect(autoplayHeadP(catchMs, catchMs, TL_START, b)).toBe(CUBE_END);
      // Au-delà : la fin écrite, décalée du rattrapage.
      expect(autoplayHeadP(catchMs + 500, catchMs, TL_START, b)).toBe(
        runFinale(CUBE_END, 500, b),
      );
    }
  });

  it("ne fait aucun saut au raccord du rattrapage", () => {
    for (const b of [DESKTOP, MOBILE]) {
      const catchMs = AUTOPLAY_CATCHUP_MS;
      const before = autoplayHeadP(catchMs - 1e-6, catchMs, TL_START, b);
      const after = autoplayHeadP(catchMs, catchMs, TL_START, b);
      expect(Math.abs(after - before)).toBeLessThan(1e-3);
    }
  });

  it("termine à 1, comme le scroll qu'il accompagne", () => {
    for (const b of [DESKTOP, MOBILE]) {
      const total = AUTOPLAY_CATCHUP_MS + b.FINALE_MS;
      expect(autoplayHeadP(total, AUTOPLAY_CATCHUP_MS, TL_START, b)).toBe(1);
      expect(autoplayHeadP(total + 5000, AUTOPLAY_CATCHUP_MS, TL_START, b)).toBe(1);
    }
  });

  it("sans rattrapage, la tête est exactement la fin écrite", () => {
    // Le cas desktop : le 6e clic arrive à ou après CUBE_END, donc le budget de
    // rattrapage vaut 0 et la tête doit être `runFinale` — pas sa version
    // arrondie. Un `elapsed` négatif est le seul moyen de ne pas diviser par 0.
    for (const b of [DESKTOP, MOBILE]) {
      for (const t of [0, 137, 2600, 9000]) {
        expect(autoplayHeadP(t, 0, TL_START, b)).toBe(runFinale(CUBE_END, t, b));
      }
    }
  });
});

describe("skipUnfoldP — le repli du skip", () => {
  it("va de `from` à INTRO_END en vitesse constante", () => {
    for (const from of [0, 0.13, INTRO_END]) {
      expect(skipUnfoldP(0, SKIP_UNFOLD_MS, from)).toBe(from);
      expect(skipUnfoldP(SKIP_UNFOLD_MS, SKIP_UNFOLD_MS, from)).toBe(INTRO_END);
      // Vitesse CONSTANTE : la moitié du temps, la moitié du chemin. C'est
      // exactement ce que distingue un `smoothstep`, dont la dérivée est nulle à
      // l'arrivée — le cube s'arrêtait net avant de tourner.
      expect(skipUnfoldP(SKIP_UNFOLD_MS / 2, SKIP_UNFOLD_MS, from)).toBeCloseTo(
        (from + INTRO_END) / 2,
        12,
      );
    }
  });

  it("reste à INTRO_END au-delà de la durée", () => {
    for (const from of [0, 0.13]) {
      expect(skipUnfoldP(SKIP_UNFOLD_MS + 4000, SKIP_UNFOLD_MS, from)).toBe(INTRO_END);
    }
  });
});

describe("skipDurationMs — les bornes du sweep", () => {
  it("ajoute le repli au finale, sauf quand le skip est tardif", () => {
    for (const b of [DESKTOP, MOBILE]) {
      expect(skipDurationMs(false, SKIP_UNFOLD_MS, b)).toBe(SKIP_UNFOLD_MS + b.SKIP_FINALE_MS);
      // Un skip pressé pendant le spin n'a plus de repli à jouer.
      expect(skipDurationMs(true, SKIP_UNFOLD_MS, b)).toBe(b.SKIP_FINALE_MS);
      // Et la durée du repli n'a aucun effet sur lui.
      expect(skipDurationMs(true, 0, b)).toBe(b.SKIP_FINALE_MS);
    }
  });

  it("donne au sweep complet plus de temps que le finale seul", () => {
    for (const b of [DESKTOP, MOBILE]) {
      expect(skipDurationMs(false, SKIP_UNFOLD_MS, b)).toBeGreaterThan(
        skipDurationMs(true, SKIP_UNFOLD_MS, b),
      );
    }
  });
});
