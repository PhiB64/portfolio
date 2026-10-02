export const FACES = ["front", "top", "left", "back", "bottom", "right"];

export const FACE_ROTATIONS = [
  { rx: 0, ry: 0 },
  { rx: -90, ry: 0 },
  { rx: 0, ry: 90 },
  { rx: 0, ry: 180 },
  { rx: 90, ry: 0 },
  { rx: 0, ry: -90 },
];

export const FACE_NORMALS = [
  [0,0,1],
  [0,-1,0],
  [-1,0,0],
  [0,0,-1],
  [0,1,0],
  [1,0,0],
];

// Directional light coming from the top-left-front (normalized)
export const LIGHT_DIR = (() => {
  const v = [-0.6, -0.8, 0.4];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

export const FACE_VERTS = [
  [0,1,2,3],
  [0,1,5,4],
  [0,4,7,3],
  [5,4,7,6],
  [3,7,6,2],
  [1,2,6,5],
];

export const WIRE_EDGES = [
  [0,1],[1,2],[2,3],[3,0],
  [4,5],[5,6],[6,7],[7,4],
  [0,4],[1,5],[2,6],[3,7],
];

export const EDGE_FACES = [
  [0,1],[0,5],[0,4],[0,2],
  [1,3],[3,5],[3,4],[3,2],
  [1,2],[1,5],[4,5],[2,4],
];

export const FACE_LABELS = ["WEB", "REACT", "BACKEND", "DATABASE", "MOBILE", "PROJETS"];

export function isFaceVisible(nx, ny, nz, rx, ry) {
  const rxr = rx * Math.PI / 180;
  const ryr = ry * Math.PI / 180;
  const cx = Math.cos(rxr), sx = Math.sin(rxr);
  const cy = Math.cos(ryr), sy = Math.sin(ryr);
  return ny * sx + (-nx * sy + nz * cy) * cx > 0;
}

// Composante caméra (z) de la normale de la face après rotation : 1 quand la
// face est frontalement exposée à l'utilisateur, décroît vers 0 au bord.
export function faceFrontAmount(nx, ny, nz, rx, ry) {
  const rxr = rx * Math.PI / 180;
  const ryr = ry * Math.PI / 180;
  const cx = Math.cos(rxr), sx = Math.sin(rxr);
  const cy = Math.cos(ryr), sy = Math.sin(ryr);
  return ny * sx + (-nx * sy + nz * cy) * cx;
}

export function projectVertex(x, y, z, rx, ry, centerX, centerY, scale = 1) {
  const P = 1200 * scale;
  const rxr = rx * Math.PI / 180;
  const ryr = ry * Math.PI / 180;
  const cx = Math.cos(rxr), sx = Math.sin(rxr);
  const cy = Math.cos(ryr), sy = Math.sin(ryr);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const y1 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const f = P / (P - z2);
  return [centerX + x1 * f, centerY + y1 * f, z2];
}

export function computeWireframe(rx, ry, zoomedFace, scale = 1) {
  const H = 150 * scale;
  const vertices = [
    [-H,-H,H],[H,-H,H],[H,H,H],[-H,H,H],
    [-H,-H,-H],[H,-H,-H],[H,H,-H],[-H,H,-H],
  ];
  const cx = 150, cy = 150;
  const visible = FACE_NORMALS.map((n) => isFaceVisible(n[0], n[1], n[2], rx, ry));

  const proj = vertices.map((v) => projectVertex(v[0], v[1], v[2], rx, ry, cx, cy, scale));

  const facePolys = [];
  for (let f = 0; f < 6; f++) {
    if (!visible[f]) continue;
    const fv = FACE_VERTS[f];
    const poly = fv.map((vi) => [proj[vi][0], proj[vi][1]]);
    const avgZ = fv.reduce((s, vi) => s + proj[vi][2], 0) / 4;
    facePolys.push({ f, poly, avgZ });
  }
  facePolys.sort((a, b) => b.avgZ - a.avgZ);

  const segments = [];

  WIRE_EDGES.forEach(([a, b], i) => {
    const [fa, fb] = EDGE_FACES[i];
    if (!visible[fa] && !visible[fb]) return;

    const midX = (proj[a][0] + proj[b][0]) / 2;
    const midY = (proj[a][1] + proj[b][1]) / 2;
    const midZ = (proj[a][2] + proj[b][2]) / 2;

    for (const { f, poly, avgZ } of facePolys) {
      if (f === fa || f === fb) continue;
      if (avgZ <= midZ) break;
      if (pointInQuad(midX, midY, poly)) return;
    }

    segments.push(`M${proj[a][0].toFixed(1)},${proj[a][1].toFixed(1)}L${proj[b][0].toFixed(1)},${proj[b][1].toFixed(1)}`);
  });

  let overlayBounds = null;
  if (zoomedFace != null && zoomedFace >= 0) {
    const fv = FACE_VERTS[zoomedFace];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const vi of fv) {
      const px = proj[vi][0], py = proj[vi][1];
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    overlayBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  return { path: segments.join(" "), overlayBounds };
}

export function cubicEaseInOut(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

// Un palier de scroll ne se pose pas franchement sur une face : il ralentit en
// arrivant dessus puis repart, en métamorphosant au passage entre deux poses.
// C'était le rôle du `cubicEaseInOut` pur appliqué à chaque palier — mais sa
// dérivée vaut zéro aux deux extrémités, donc chaque frontière de palier
// tombait à vitesse nulle : le cube s'arrêtait puis relançait douze fois de
// suite sur la seule plage de scroll, ce qui se lisait comme une suite de
// saccades. Mesuré sur la vitesse angulaire réelle du cube (quaternions), le
// cubic pur donne une pointe à 4,99x la moyenne et 23 % du scroll à l'arrêt.
//
// On garde donc une part de l'easing — le cube doit toujours ralentir en
// arrivant sur une face, sans quoi les six visuels défilent sans qu'aucun ne
// soit jamais lisible — mais on la mélange à une interpolation linéaire, dont
// la dérivée est constante. Au-delà de ~0,5 la pointe angulaire repasse au
// niveau du cubic pur ; 0,4 la tient à 1,8x la moyenne et supprime tout
// arrêt. La sensation de vitesse ne vient alors plus du profil mais de la durée
// du scroll, ce qui est le comportement attendu d'un scrub.
const STEP_EASE_MIX = 0.4;

// Arc de rotation, en degrés, entre deux poses consécutives. Les six arcs sont
// très inégaux (90, 127, 90, 201, 127, 90) parce que les poses sont des
// couples (rx, ry) interpolés coordonnée par coordonnée : passer de « back »
// (0, 180) à « bottom » (90, 0) fait décrire 180 degrés en ry là où 90
// suffiraient.
//
// On ne peut pas corriger les poses elles-mêmes : (90, 180) rend bien la face
// du dessous en façade, mais projette son quad à l'envers et affiche trois
// faces au lieu d'une — vérifié, pas une imperfection invisible. On corrige
// donc l'autre moitié du problème, en exigeant d'autant de scroll pour tourner
// deux fois moins.
function rotationArc(a, b) {
  let dy = b.ry - a.ry;
  if (dy > 180) dy -= 360;
  if (dy < -180) dy += 360;
  return Math.hypot(b.rx - a.rx, dy);
}

// Un tour complet fait 6 poses, et le scroll en fait deux : 12 paliers, pour que
// chaque face passe deux fois en façade et reste donc cliquable.
export const CUBE_STEPS = 12;

// Frontières cumulées des 12 paliers, normalisées sur [0, 1] et proportionnelles
// à l'arc de chaque palier. Toutes à égalité, le cube parcourait 201 degrés là
// où il en parcourait 90 au palier suivant : sa vitesse angulaire montait et
// descendait d'un facteur 2,24 sans que rien à l'écran n'explique pourquoi.
// Proportionnelles, la vitesse angulaire ne dépend plus que du scroll.
export const CUBE_STEP_BOUNDS = (() => {
  const total = FACE_ROTATIONS.length;
  const arcs = [];
  for (let i = 0; i < CUBE_STEPS; i++) {
    arcs.push(rotationArc(FACE_ROTATIONS[i % total], FACE_ROTATIONS[(i + 1) % total]));
  }
  const sum = arcs.reduce((x, y) => x + y, 0);
  const bounds = [0];
  let acc = 0;
  for (const arc of arcs) {
    acc += arc;
    bounds.push(acc / sum);
  }
  return bounds;
})();

// Index du palier contenant p, et bornes de ce palier.
function stepAt(p) {
  let idx = 0;
  while (idx < CUBE_STEPS - 1 && p >= CUBE_STEP_BOUNDS[idx + 1]) idx++;
  const start = CUBE_STEP_BOUNDS[idx];
  const progress = (p - start) / (CUBE_STEP_BOUNDS[idx + 1] - start);
  return { idx, progress };
}

// Première frontière de palier strictement après p, ou 1 si p est déjà dans le
// dernier. Sert à poser le cube exactement sur une face nette plutôt qu'au
// milieu d'un palier, où il serait à l'angle.
export function nextCubeStepBound(p) {
  for (let i = 1; i <= CUBE_STEPS; i++) {
    if (CUBE_STEP_BOUNDS[i] > p + 1e-9) return CUBE_STEP_BOUNDS[i];
  }
  return 1;
}

export function lerpRot(a, b, progress) {
  const e = progress * (1 - STEP_EASE_MIX) + cubicEaseInOut(progress) * STEP_EASE_MIX;
  let dy = b.ry - a.ry;
  if (dy > 180) dy -= 360;
  if (dy < -180) dy += 360;
  return { rx: a.rx + (b.rx - a.rx) * e, ry: a.ry + dy * e };
}

export function getCubeRotation(p) {
  const total = FACE_ROTATIONS.length;
  if (!Number.isFinite(p)) return FACE_ROTATIONS[0];
  if (p <= 0) return FACE_ROTATIONS[0];
  if (p >= 1) return FACE_ROTATIONS[0];
  const { idx, progress } = stepAt(p);
  const a = FACE_ROTATIONS[idx % total];
  const b = FACE_ROTATIONS[(idx + 1) % total];
  if (!a || !b) return FACE_ROTATIONS[0];
  return lerpRot(a, b, progress);
}

export function faceTransform(face) {
  const d = 150;
  const map = {
    front: `translateZ(${d}px)`,
    back: `rotateY(180deg) translateZ(${d}px)`,
    right: `rotateY(90deg) translateZ(${d}px)`,
    left: `rotateY(-90deg) translateZ(${d}px)`,
    top: `rotateX(90deg) translateZ(${d}px)`,
    bottom: `rotateX(-90deg) translateZ(${d}px)`,
  };
  return map[face];
}

export function pointInQuad(px, py, q) {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = q[i];
    const [x2, y2] = q[(i + 1) % 4];
    const c = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
    if (c !== 0) {
      const cs = c > 0 ? 1 : -1;
      if (s === 0) s = cs;
      else if (cs !== s) return false;
    }
  }
  return s !== 0;
}

export function rotateVecByXY(x, y, z, rxDeg, ryDeg) {
  const rx = rxDeg * Math.PI / 180;
  const ry = ryDeg * Math.PI / 180;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const y1 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  return [x1, y1, z2];
}

export function findClickedFace(px, py, centerX, centerY, rxDeg, ryDeg, scale = 1) {
  const P = 1200 * scale, H = 150 * scale;
  const rx = rxDeg * Math.PI / 180;
  const ry = ryDeg * Math.PI / 180;
  const cX = Math.cos(rx), sX = Math.sin(rx);
  const cY = Math.cos(ry), sY = Math.sin(ry);

  function proj(x, y, z) {
    const x1 = x * cY + z * sY;
    const z1 = -x * sY + z * cY;
    const y1 = y * cX - z1 * sX;
    const z2 = y * sX + z1 * cX;
    const f = P / (P - z2);
    return [centerX + x1 * f, centerY + y1 * f, z2];
  }

  const faces = [
    [[-H,-H,H],[H,-H,H],[H,H,H],[-H,H,H],[0,0,H]],
    [[-H,-H,-H],[H,-H,-H],[H,-H,H],[-H,-H,H],[0,-H,0]],
    [[-H,-H,-H],[-H,-H,H],[-H,H,H],[-H,H,-H],[-H,0,0]],
    [[H,-H,-H],[-H,-H,-H],[-H,H,-H],[H,H,-H],[0,0,-H]],
    [[-H,H,-H],[H,H,-H],[H,H,H],[-H,H,H],[0,H,0]],
    [[H,-H,H],[H,-H,-H],[H,H,-H],[H,H,H],[H,0,0]],
  ];

  let best = -1, bestZ = -Infinity;

  for (let f = 0; f < 6; f++) {
    const pts = faces[f].map(c => proj(c[0], c[1], c[2]));
    const quad = pts.slice(0, 4);
    if (!pointInQuad(px, py, quad)) continue;
    const z = pts[4][2];
    if (z > bestZ) { bestZ = z; best = f; }
  }

  return best;
}

export const BORDER_COLORS = ["#00a5b0", "#008a93", "#006e75", "#005258", "#00373b", "#001b1d", "#000000"];

export const isVideoUrl = (url) => /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url || "");
