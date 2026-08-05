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

export function lerpRot(a, b, progress) {
  const e = cubicEaseInOut(progress);
  let dy = b.ry - a.ry;
  if (dy > 180) dy -= 360;
  if (dy < -180) dy += 360;
  return { rx: a.rx + (b.rx - a.rx) * e, ry: a.ry + dy * e };
}

export function getCubeRotation(p) {
  const STEPS = 12;
  const total = FACE_ROTATIONS.length;
  if (p <= 0) return FACE_ROTATIONS[0];
  if (p >= 1) return FACE_ROTATIONS[0];
  const idx = Math.floor(p * STEPS);
  const progress = p * STEPS - idx;
  return lerpRot(FACE_ROTATIONS[idx % total], FACE_ROTATIONS[(idx + 1) % total], progress);
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
