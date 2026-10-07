// Inertie du pilotage direct du cube (drag tactile et souris).
//
// Pourquoi ce module existe. Le drag écrit un offset de rotation par-dessus la
// pose du scroll, et le relâchement figeait cet offset net : le cube s'arrêtait
// pile, sans prolonger le geste. La glisse réclame trois décisions pures —
// quelle vitesse au relâchement, jusqu'où la plafonner, comment l'éteindre à
// framerate constant — qui ne touchent ni au DOM ni à React : elles vivent ici,
// testées, et le composant ne garde que la boucle qui les rejoue.
//
// Unités : des degrés de rotation par milliseconde. L'échantillonnage du drag
// enregistre la rotation DÉJÀ APPLIQUÉE (gains tactile/souris compris), donc la
// vitesse est homogène aux deux pointeurs sans branchement par appareil.

// Fenêtre d'estimation de la vitesse de relâchement : seuls les derniers
// échantillons comptent. Un geste qui s'arrête AVANT de lâcher (le cas du
// positionnement précis d'une face) y mesure une vitesse nulle et ne glisse
// pas ; un flick y mesure la vitesse du jet.
export const DRAG_INERTIA_SAMPLE_MS = 120;
// Constante de temps de la décroissance : la distance supplémentaire vaut
// `vitesse × TAU` (intégrale de l'exponentielle). À 280 ms, un flick franc
// (~0,5 deg/ms) prolonge d'environ 140°, un jet plafonné (1,2) de 336°.
export const DRAG_INERTIA_TAU_MS = 280;
// Plafond de la vitesse de relâchement, norme du vecteur (rx, ry) : au-delà,
// tous les jets glisseraient pareil. 1,2 deg/ms ≈ 1200°/s, déjà un tour en un
// tiers de seconde.
export const DRAG_INERTIA_MAX_SPEED = 1.2;
// Sous ce seuil, pas de glisse : c'est une pose, pas un lancer.
export const DRAG_INERTIA_START_SPEED = 0.08;
// La glisse s'éteint sous cette vitesse résiduelle (~20°/s, imperceptible).
export const DRAG_INERTIA_STOP_SPEED = 0.02;
// Garde-fou : même un plafond numérique ne glisse pas plus d'1,2 s.
export const DRAG_INERTIA_MAX_MS = 1200;

// Norme de la vitesse, en deg/ms.
export const dragSpeed = (v) => Math.hypot(v.rx, v.ry);

// Vitesse moyenne sur la fenêtre, par axe, en deg/ms. `samples` vaut des
// `{ t, rx, ry }` chronologiques (ms, degrés déjà appliqués). Les échantillons
// plus vieux que la fenêtre sont ignorés, pas moyennés : c'est ce qui distingue
// le jet final du trajet qui l'a amené.
export const dragReleaseVelocity = (samples, windowMs = DRAG_INERTIA_SAMPLE_MS) => {
  if (!samples || samples.length < 2) return { rx: 0, ry: 0 };
  const last = samples[samples.length - 1];
  let first = last;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (last.t - samples[i].t <= windowMs) first = samples[i];
    else break;
  }
  const dt = last.t - first.t;
  if (!(dt > 0)) return { rx: 0, ry: 0 };
  return { rx: (last.rx - first.rx) / dt, ry: (last.ry - first.ry) / dt };
};

// Plafonne la norme au maximum en gardant la direction : un jet en diagonale
// ne doit pas partir plus en biais qu'un jet franc, seulement moins loin.
export const capDragSpeed = (v, max = DRAG_INERTIA_MAX_SPEED) => {
  const s = Math.hypot(v.rx, v.ry);
  if (!(s > max)) return { rx: v.rx, ry: v.ry };
  const k = max / s;
  return { rx: v.rx * k, ry: v.ry * k };
};

// Un pas d'intégration exponentielle exacte : le déplacement du pas et la
// vitesse restante. Exact, donc indépendant du framerate : deux demi-pas
// valent un pas entier, et 120 Hz ne glisse pas moins loin que 60 Hz.
export const inertiaStep = (v, dtMs, tauMs = DRAG_INERTIA_TAU_MS) => {
  const dt = Math.max(0, dtMs);
  const decay = Math.exp(-dt / tauMs);
  const travelled = tauMs * (1 - decay);
  return {
    step: { rx: v.rx * travelled, ry: v.ry * travelled },
    vel: { rx: v.rx * decay, ry: v.ry * decay },
  };
};

// Retour à la piste quand le scroll reprend après un drag.
//
// Pourquoi cette section existe. Le drag écrit un offset par-dessus la pose du
// scroll, et la reprise du scroll doit effacer cet offset pour réaligner le
// cube sur la piste. L'effacement se faisait en 450 ms fixes, quelle que soit
// l'amplitude : après un vrai geste au doigt (plusieurs centaines de degrés,
// voire des tours complets — rien ne borne l'offset), le cube revenait à la
// piste à plus de 2000°/s. C'est le « rattrapage éclair » : spectaculaire,
// jamais esthétique.
//
// Le correctif tient en deux règles, appliquées quand le scroll arme le fondu :
// 1. `wrapDragOffset` retire les tours complets, axe par axe. Une rotation de
//    360° est une identité : l'orientation affichée ne change pas d'un pixel,
//    mais l'amplitude à effacer tombe à 180° par axe au plus.
// 2. `dragEaseMs` donne au fondu une durée proportionnelle à l'amplitude
//    restante, à vitesse bornée (`DRAG_EASE_DEG_PER_MS`) : un petit ajustement
//    (< 90°) s'efface en `DRAG_EASE_MIN_MS` comme avant, un gros en un peu
//    plus d'une seconde — jamais en éclair.
// `DRAG_EASE_MAX_MS` est un garde-fou pour un appel sans wrap préalable ;
// après wrap, la norme plafonne à √(180² + 180²) ≈ 254,6°, soit ~1273 ms,
// donc sous le plafond. `dragEaseFactor` est la forme du fondu (smoothstep
// inversé), partagée entre la boucle et l'interruption par un nouveau geste.

// Vitesse moyenne de l'effacement : 200°/s, du même ordre que les vitesses de
// scrub — le retour se lit comme une décélération, pas comme un spin.
export const DRAG_EASE_DEG_PER_MS = 0.2;
// Sous 90° d'amplitude, on garde les 450 ms d'avant : le cas courant ne change
// pas (90 / 0,2 = 450, le seuil tombe juste).
export const DRAG_EASE_MIN_MS = 450;
// Garde-fou : même sans wrap préalable, le fondu ne s'éternise pas.
export const DRAG_EASE_MAX_MS = 1500;

// Retire les tours complets d'un offset, axe par axe : [−180, 180]. Une
// rotation de 360° étant une identité, l'orientation affichée ne change pas
// d'un pixel — mais l'amplitude à effacer par le fondu passe de « plusieurs
// tours » à 180° par axe au plus.
export const wrapDragOffset = ({ rx, ry }) => {
  const wrap = (a) => {
    if (!Number.isFinite(a)) return 0;
    return ((a + 180) % 360 + 360) % 360 - 180;
  };
  return { rx: wrap(rx), ry: wrap(ry) };
};

// Durée du fondu pour une amplitude donnée : norme rapportée à la vitesse,
// plancher pour les petits ajustements, plafond en garde-fou.
export const dragEaseMs = (offset) => {
  const amp = Math.hypot(offset?.rx ?? 0, offset?.ry ?? 0);
  if (!(amp > 0)) return DRAG_EASE_MIN_MS;
  return Math.min(
    DRAG_EASE_MAX_MS,
    Math.max(DRAG_EASE_MIN_MS, amp / DRAG_EASE_DEG_PER_MS),
  );
};

// Forme du fondu, smoothstep inversé (marge douce en arrivée) : k = fraction
// écoulée en [0, 1], rend la part d'offset encore affichée.
export const dragEaseFactor = (k) => {
  const x = Math.min(1, Math.max(0, k));
  return 1 - x * x * (3 - 2 * x);
};
