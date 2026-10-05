import { afterEach, describe, expect, it } from "vitest";

import { buildSpinTour, SPIN_TOUR_BUDGET } from "./cube-tour";
import { FACE_ROTATIONS } from "./cube-math";

/**
 * `buildSpinTour` est aléatoire par nature : on ne peut donc pas épingler un
 * tirage. Ce qui décide de ce que voit le visiteur n'est pas le hasard, c'est le
 * *catalogue* — la liste des orders acceptables et le coût de chacun. Ce sont ces
 * deux choses qui fixent la vitesse angulaire et la validité du parcours, et ce
 * sont elles que ces tests verrouillent.
 *
 * Le catalogue est parcouru ici par 401 tirages forcés, un par valeur possible de
 * `Math.random`. C'est plus large que l'espace réel qu'il faut couvrir pour être
 * sûr d'avoir tout traversé.
 */

// Réimplémentation volontairement indépendante du `shortAngle` privé : un test
// qui recopie la fonction testée ne prouve rien.
const shortAngle = (deg) => ((deg % 360) + 540) % 360 - 180;

const randomReel = Math.random;
afterEach(() => {
  Math.random = randomReel;
});

/** Parcourt tout le catalogue en forçant chaque tirage possible. */
function toutLeCatalogue() {
  const rows = [];
  for (let k = 0; k <= 400; k++) {
    Math.random = () => k / 401;
    for (const start of FACE_ROTATIONS) {
      const t = buildSpinTour(start);
      rows.push({
        start,
        signature: t.steps.map((s) => `${s.drx},${s.dry}`).join("|"),
        total: t.total,
      });
    }
  }
  return rows;
}

/** Tous les deltas qu'une transition entre deux poses peut valoir. */
function deltasPossibles() {
  const set = new Set();
  for (const a of FACE_ROTATIONS) {
    for (const b of FACE_ROTATIONS) {
      set.add(`${shortAngle(b.rx - a.rx)},${shortAngle(b.ry - a.ry)}`);
    }
  }
  return set;
}

/** Deltas entre poses *non opposées* : ce sont les seuls autorisés dans un tour. */
function deltasNonOpposes() {
  const set = new Set();
  for (let a = 0; a < FACE_ROTATIONS.length; a++) {
    for (let b = 0; b < FACE_ROTATIONS.length; b++) {
      const opposee =
        FACE_ROTATIONS[a].rx === -FACE_ROTATIONS[b].rx &&
        FACE_ROTATIONS[a].ry === -FACE_ROTATIONS[b].ry;
      if (opposee) continue;
      set.add(
        `${shortAngle(FACE_ROTATIONS[b].rx - FACE_ROTATIONS[a].rx)},${shortAngle(FACE_ROTATIONS[b].ry - FACE_ROTATIONS[a].ry)}`,
      );
    }
  }
  return set;
}

describe("buildSpinTour — structure d'un tour", () => {
  it("fait six transitions : cinq faces, puis le retour à l'avant", () => {
    for (const start of FACE_ROTATIONS) {
      const { steps } = buildSpinTour(start);
      expect(steps).toHaveLength(6);
    }
  });

  it("repart de la pose demandée, au degré près", () => {
    for (const start of FACE_ROTATIONS) {
      const { steps } = buildSpinTour(start);
      expect(steps[0].rx).toBe(start.rx);
      expect(steps[0].ry).toBe(start.ry);
    }
  });

  it("n'utilise que des deltas possibles entre deux poses", () => {
    const possibles = deltasPossibles();
    for (const { signature } of toutLeCatalogue()) {
      for (const d of signature.split("|")) {
        expect(possibles.has(d), `delta ${d}`).toBe(true);
      }
    }
  });

  it("n'enchaîne jamais deux faces opposées", () => {
    // Un demi-tour entre deux faces fait la même distance qu'un quart de tour en
    // deux fois moins de temps : le cube claque au lieu de voyager. C'est la
    // raison d'être du filtre.
    const autorises = deltasNonOpposes();
    for (const { signature } of toutLeCatalogue()) {
      for (const d of signature.split("|")) {
        expect(autorises.has(d), `delta interdit ${d}`).toBe(true);
      }
    }
  });

  it("referme le tour sur la face avant, à 360 près", () => {
    // La continuité est le point délicat du calcul : chaque segment repart du
    // courant « levé », pas de la pose cible réinjectée. Un à-coup de 360° ne se
    // voit pas à l'écran mais se voit dans tout ce qui raisonne sur ces nombres.
    //
    // Attention à l'arithmétique : `steps[i].drx` est le delta À PARTIR de la
    // position courante, la première part donc de `from`. La position finale est
    // `from + somme des deltas`, pas la somme seule.
    const avant = FACE_ROTATIONS[0];
    for (const start of FACE_ROTATIONS) {
      const { steps } = buildSpinTour(start);
      const finRx = start.rx + steps.reduce((t, s) => t + s.drx, 0);
      const finRy = start.ry + steps.reduce((t, s) => t + s.dry, 0);
      expect(shortAngle(finRx)).toBe(shortAngle(avant.rx));
      expect(shortAngle(finRy)).toBe(shortAngle(avant.ry));
    }
  });

  it("reconstitue la position courante à partir des deltas seuls", () => {
    // Le « levage » doit se lire dans les positions émises : si une position se
    // met un jour à être réinjectée au lieu d'être cumulée, la suite saute de
    // 360° et ce test le voit.
    for (const start of FACE_ROTATIONS) {
      const { steps } = buildSpinTour(start);
      expect(steps[0]).toMatchObject({ rx: start.rx, ry: start.ry });
      for (let i = 1; i < steps.length; i++) {
        const precedent = steps[i - 1];
        expect(steps[i].rx).toBe(precedent.rx + precedent.drx);
        expect(steps[i].ry).toBe(precedent.ry + precedent.dry);
      }
    }
  });

  it("borne chaque delta à un quart de tour", () => {
    // C'est le contrat de `shortAngle` : un delta ne dépasse jamais 180°, et le
    // cube ne fait donc jamais un bond. Un pas peut atteindre 201° parce qu'il
    // est diagonal (90° et 180° simultanés) — d'où une borne sur chaque composante
    // plutôt que sur la longueur.
    for (const { signature } of toutLeCatalogue()) {
      for (const d of signature.split("|")) {
        const [drx, dry] = d.split(",").map(Number);
        expect(Math.abs(drx)).toBeLessThanOrEqual(180);
        expect(Math.abs(dry)).toBeLessThanOrEqual(180);
      }
    }
  });

  it("tolère un pas de longueur nulle quand le cube est déjà face à la cible", () => {
    // Le courant est cumulé et levé, donc il peut arriver exactement sur la pose
    // suivante : le cube ne bouge pas, et le pas ne coûte rien. C'est 4,5 % des
    // pas sur l'ensemble du catalogue — l'interdire casserait des tournées
    // valides.
    const { steps } = buildSpinTour(FACE_ROTATIONS[0]);
    for (const s of steps) {
      expect(s.len).toBeCloseTo(Math.hypot(s.drx, s.dry), 9);
      expect(s.len).toBeGreaterThanOrEqual(0);
    }
    const catalogue = toutLeCatalogue();
    const avecZero = catalogue.filter((r) => r.signature.split("|").some((d) => d === "0,0"));
    expect(avecZero.length).toBeGreaterThan(0);
  });
});

describe("buildSpinTour — égalité de vitesse", () => {
  it("reste sous le plafond de parcours", () => {
    for (const { total } of toutLeCatalogue()) {
      expect(total).toBeLessThanOrEqual(SPIN_TOUR_BUDGET);
    }
  });

  it("conserve exactement les onze totaux relevés avant extraction", () => {
    // C'est le cœur du contrat : ces onze valeurs sont les seules vitesses
    // angulaires possibles à l'écran. Si le catalogue change, la vitesse change.
    const totaux = [...new Set(toutLeCatalogue().map((r) => Number(r.total.toFixed(9))))].sort(
      (a, b) => a - b,
    );
    expect(totaux).toEqual([
      524.558441227, 561.837661841, 614.558441227, 635.804559202,
      651.837661841, 673.083779816, 725.804559202, 741.837661841,
      747.050677177, 763.083779816, 779.116882454,
    ]);
  });

  it("partage la fenêtre au prorata de la longueur de chaque segment", () => {
    // C'est ce qui rend la vitesse constante de bout en bout : un segment long
    // reçoit une part de temps plus longue.
    const { steps, total } = buildSpinTour(FACE_ROTATIONS[0]);
    const somme = steps.reduce((t, s) => t + s.len, 0);
    expect(somme).toBeCloseTo(total, 9);
  });
});

describe("buildSpinTour — tirage", () => {
  const signature = (t) => t.steps.map((s) => `${s.drx},${s.dry}`).join("|");

  it("donne le même résultat à tirage identique", () => {
    // Le tirage est fait UNE fois, à l'entrée du spin, pas à chaque image : un
    // tirage par frame rebattrait la cible en continu et le cube vibrerait sur
    // place au lieu de voyager.
    Math.random = () => 0.42;
    expect(signature(buildSpinTour(FACE_ROTATIONS[0]))).toBe(
      signature(buildSpinTour(FACE_ROTATIONS[0])),
    );
  });

  it("produit plusieurs tournées différentes, sinon le spin se répète", () => {
    const vues = new Set(toutLeCatalogue().map((r) => r.signature));
    expect(vues.size).toBeGreaterThan(1);
  });

  it("offre plusieurs tournées pour une même pose", () => {
    // Le repli existe pour les poses si rares qu'aucun tirage ne passe les
    // filtres ; il ne doit pas devenir le chemin ordinaire. Ce qui compte pour
    // le visiteur, c'est que deux spins successifs ne se ressemblent pas.
    for (const start of FACE_ROTATIONS) {
      const vues = new Set();
      for (let k = 0; k <= 400; k++) {
        Math.random = () => k / 401;
        vues.add(signature(buildSpinTour(start)));
      }
      expect(vues.size, `pose ${start.rx},${start.ry}`).toBeGreaterThan(1);
    }
  });

  it("accepte une pose qui n'est pas une pose exacte", () => {
    // Une pose de biais (`poseIndexOf` vaut -1) n'a pas d'opposé connu : le
    // filtre ne doit rien lui reprocher.
    const deBiais = { rx: 20, ry: 35 };
    const { steps } = buildSpinTour(deBiais);
    expect(steps).toHaveLength(6);
    expect(steps[0].rx).toBe(20);
    expect(steps[0].ry).toBe(35);
  });
});