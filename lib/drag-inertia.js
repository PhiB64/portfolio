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
// `vitesse × TAU` (intégrale de l'exponentielle). À 180 ms, un flick franc
// (~0,5 deg/ms) prolonge d'environ 90°, un jet plafonné (1,2) de 216°.
export const DRAG_INERTIA_TAU_MS = 180;
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
