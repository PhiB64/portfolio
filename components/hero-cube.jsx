"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import anime from "animejs";


const FACES = ["front", "top", "left", "back", "bottom", "right"];

const FACE_ROTATIONS = [
  { rx: 0, ry: 0 },
  { rx: -90, ry: 0 },
  { rx: 0, ry: 90 },
  { rx: 0, ry: 180 },
  { rx: 90, ry: 0 },
  { rx: 0, ry: -90 },
];

const FACE_NORMALS = [
  [0,0,1],
  [0,-1,0],
  [-1,0,0],
  [0,0,-1],
  [0,1,0],
  [1,0,0],
];

// Directional light coming from the top-left-front (normalized)
const LIGHT_DIR = (() => {
  const v = [-0.6, -0.8, 0.4];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

const FACE_VERTS = [
  [0,1,2,3],
  [0,1,5,4],
  [0,4,7,3],
  [5,4,7,6],
  [3,7,6,2],
  [1,2,6,5],
];

const WIRE_EDGES = [
  [0,1],[1,2],[2,3],[3,0],
  [4,5],[5,6],[6,7],[7,4],
  [0,4],[1,5],[2,6],[3,7],
];

const EDGE_FACES = [
  [0,1],[0,5],[0,4],[0,2],
  [1,3],[3,5],[3,4],[3,2],
  [1,2],[1,5],[4,5],[2,4],
];

const PROJECT_LINKS = [
  { name: "1.WEB", url: "/web" },
  { name: "2.REACT", url: "/react" },
  { name: "3.BACKEND", url: "/backend" },
  { name: "4.DATABASE", url: "/database" },
  { name: "5.MOBILE", url: "/mobile" },
  { name: "6.PROJETS", url: "/projets" },
];

const FACE_LABELS = ["WEB", "REACT", "BACKEND", "DATABASE", "MOBILE", "PROJETS"];

function isFaceVisible(nx, ny, nz, rx, ry) {
  const rxr = rx * Math.PI / 180;
  const ryr = ry * Math.PI / 180;
  const cx = Math.cos(rxr), sx = Math.sin(rxr);
  const cy = Math.cos(ryr), sy = Math.sin(ryr);
  return ny * sx + (-nx * sy + nz * cy) * cx > 0;
}

function projectVertex(x, y, z, rx, ry, centerX, centerY) {
  const P = 1200;
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

function computeWireframe(rx, ry, zoomedFace) {
  const H = 150;
  const vertices = [
    [-H,-H,H],[H,-H,H],[H,H,H],[-H,H,H],
    [-H,-H,-H],[H,-H,-H],[H,H,-H],[-H,H,-H],
  ];
  const cx = 150, cy = 150;
  const visible = FACE_NORMALS.map((n) => isFaceVisible(n[0], n[1], n[2], rx, ry));

  const proj = vertices.map((v) => projectVertex(v[0], v[1], v[2], rx, ry, cx, cy));

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

function lerpRot(a, b, progress) {
  const e = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  let dy = b.ry - a.ry;
  if (dy > 180) dy -= 360;
  if (dy < -180) dy += 360;
  return { rx: a.rx + (b.rx - a.rx) * e, ry: a.ry + dy * e };
}

function getCubeRotation(p) {
  const STEPS = 12;
  const total = FACE_ROTATIONS.length;
  if (p <= 0) return FACE_ROTATIONS[0];
  if (p >= 1) return FACE_ROTATIONS[0];
  const idx = Math.floor(p * STEPS);
  const progress = p * STEPS - idx;
  return lerpRot(FACE_ROTATIONS[idx % total], FACE_ROTATIONS[(idx + 1) % total], progress);
}

function faceTransform(face) {
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

function pointInQuad(px, py, q) {
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

function rotateVecByXY(x, y, z, rxDeg, ryDeg) {
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

function findClickedFace(px, py, centerX, centerY, rxDeg, ryDeg) {
  const P = 1200, H = 150;
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

const BORDER_COLORS = ["#00a5b0", "#008a93", "#006e75", "#005258", "#00373b", "#001b1d", "#000000"];

const isVideoUrl = (url) => /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url || "");

// Default media files from the public/ folder, mapped to FACE_LABELS order:
// [WEB, REACT, BACKEND, DATABASE, MOBILE, PROJETS]
const DEFAULT_FACE_MEDIA = [
  "/web.jpg",
  "/react.jpg",
  "/backend.mp4",
  "/database.mp4",
  "/mobile.mp4",
  "/projets.png",
];

export function HeroCube({ title, subtitle, images = [], scrollTo }) {
  const sectionRef = useRef(null);
  const cubeRef = useRef(null);
  const wireRef = useRef(null);
  const bgRef = useRef(null);
  const videoBgRef = useRef(null);
  const videoBgContainerRef = useRef(null);
  const [zoomedFace, setZoomedFace] = useState(-1);
  const [zoomedFaces, setZoomedFaces] = useState([false, false, false, false, false, false]);
  const [borderIdx, setBorderIdx] = useState(0);
  const [phase, setPhase] = useState("initial");
  const [selectedProject, setSelectedProject] = useState(null);
  const [facesUnlocked, setFacesUnlocked] = useState(false);
  const morphBodyRef = useRef(null);
  const morphWheelRef = useRef(null);
  const scrollIndicatorRef = useRef(null);
  const scrollHintRef = useRef(null);
  const zoomedFacesRef = useRef(zoomedFaces);
  const zoomedFaceRef = useRef(-1);
  const currentPRef = useRef(0);
  const overlayRef = useRef(null);
  const borderColorRef = useRef(BORDER_COLORS[0]);
  const strokeWidthRef = useRef(2);
  const cubeContainerRef = useRef(null);
  const contentRef = useRef(null);
  const isExpandedRef = useRef(false);
  const restorePRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const targetXRef = useRef(0);
  const targetYRef = useRef(0);
  const syncNextTickRef = useRef(false);
  const faceWasVisibleRef = useRef([false, false, false, false, false, false]);
  const faceVisibilityCountRef = useRef([0, 0, 0, 0, 0, 0]);
  const clickLabelRefs = useRef([]);
  const clickStackRef = useRef([]);
  const setPhaseRef = useRef(setPhase);
  setPhaseRef.current = setPhase;
  zoomedFacesRef.current = zoomedFaces;
  zoomedFaceRef.current = zoomedFace;
  borderColorRef.current = BORDER_COLORS[borderIdx];
  strokeWidthRef.current = 2 * (1 - borderIdx / (BORDER_COLORS.length - 1));

  const endSequenceStartedRef = useRef(false);
  const [showName, setShowName] = useState(false);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const subtitleRef = useRef(null);
  const nameUnderlineRef = useRef(null);


  const faceImages = useMemo(() => {
    const srcs = images && images.length ? images : DEFAULT_FACE_MEDIA;

    // Try to map provided srcs to FACE_LABELS by filename token matching
    const tokensByLabel = FACE_LABELS.map(l => l.toLowerCase());

    const normalize = (s) => {
      if (!s) return "";
      try {
        const p = s.split("/").pop().split("?")[0];
        return p.toLowerCase();
      } catch (e) {
        return s.toLowerCase();
      }
    };

    const srcNames = srcs.map(s => ({ src: s, name: normalize(s) }));

    const mapped = new Array(FACES.length).fill(null);

    // First pass: exact token match
    for (let i = 0; i < tokensByLabel.length; i++) {
      const token = tokensByLabel[i];
      for (let j = 0; j < srcNames.length; j++) {
        if (!srcNames[j]) continue;
        if (srcNames[j].name.includes(token)) {
          mapped[i] = srcNames[j].src;
          srcNames[j] = null; // consume
          break;
        }
      }
    }

    // Second pass: fallback by index for any remaining
    let k = 0;
    for (let i = 0; i < mapped.length; i++) {
      if (mapped[i]) continue;
      // find next non-null src
      while (k < srcNames.length && !srcNames[k]) k++;
      if (k < srcNames.length) {
        mapped[i] = srcNames[k].src;
        k++;
      } else {
        mapped[i] = null;
      }
    }

    return mapped;
  }, [images]);

  const changeBackground = useCallback((index) => {
    const bg = bgRef.current;
    const videoBg = videoBgRef.current;
    const videoContainer = videoBgContainerRef.current;
    if (!bg) return;
    const url = faceImages[index];
    if (!url) return;
    const isVideo = isVideoUrl(url);

    if (!isVideo) {
      if (videoContainer) videoContainer.style.opacity = "0";
      if (videoBg) videoBg.pause();
      bg.style.transition = "none";
      bg.style.opacity = "0";
      bg.style.backgroundImage = `url("${url}")`;
      void bg.offsetHeight;
      bg.style.transition = "opacity 0.35s ease";
      bg.style.opacity = "1";
    } else if (videoBg && videoContainer) {
      bg.style.opacity = "0";
      if (videoBg.src !== url) {
        videoBg.src = url;
        videoBg.load();
      }
      videoContainer.style.opacity = "1";
      videoBg.play().catch(() => {});
    }
  }, [faceImages]);

  // Keep overlay state in history so browser Back closes overlay without reloading.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = (e) => {
      const s = e.state;
      if (s && typeof s.ufoProject === 'number') {
        setSelectedProject(s.ufoProject);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const p = params.get('project');
      if (p) {
        const idx = Number(p) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < FACES.length) {
          setSelectedProject(idx);
          return;
        }
      }
      setSelectedProject(null);
    };
    window.addEventListener('popstate', onPop);

    // On initial load, open overlay if ?project=N is present and normalize history state
    const params = new URLSearchParams(window.location.search);
    const p = params.get('project');
    if (p) {
      const idx = Number(p) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < FACES.length) {
        setSelectedProject(idx);
        window.history.replaceState({ ufoProject: idx }, '', window.location.href);
      }
    }

    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleFaceClick = useCallback((i) => {
    setZoomedFace(i);
    setZoomedFaces(prev => { const n = [...prev]; n[i] = true; return n; });
    setBorderIdx(prev => Math.min(prev + 1, BORDER_COLORS.length - 1));
    changeBackground(i);
    clickStackRef.current = [...clickStackRef.current.filter(idx => idx !== i), i];
    if (clickLabelRefs.current[i]) {
      clickLabelRefs.current[i].style.opacity = "0";
    }
    const cube = cubeRef.current;
    if (!cube) return;
    const faceEl = cube.children[i];
    if (!faceEl) return;
    const video = faceEl.querySelector("video");
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [changeBackground]);

  const openProject = useCallback((i) => {
    setSelectedProject(i);
    if (typeof window !== 'undefined') {
      try {
        const state = { ufoProject: i };
        const url = new URL(window.location.href);
        url.searchParams.set('project', String(i + 1));
        window.history.pushState(state, '', url.pathname + url.search);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const path = wireRef.current?.querySelector("path");
    if (path) {
      path.setAttribute("stroke", BORDER_COLORS[borderIdx]);
      path.setAttribute("stroke-width", 2 * (1 - borderIdx / (BORDER_COLORS.length - 1)));
    }
  }, [borderIdx]);

  const handleCubeClick = useCallback((e) => {
    const rot = getCubeRotation(currentPRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = findClickedFace(e.clientX, e.clientY, rect.left + rect.width / 2, rect.top + rect.height / 2, rot.rx, rot.ry);
    if (idx >= 0 && faceVisibilityCountRef.current[idx] >= 2) handleFaceClick(idx);
  }, [handleFaceClick]);

  useEffect(() => {
    faceImages.forEach((url) => {
      if (!url) return;
      if (isVideoUrl(url)) {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = url;
      } else {
        const i = new Image();
        i.src = url;
      }
    });
  }, [faceImages]);

  // (SVG intro removed) keep only dezoom sequence trigger below

  const triggerEndSequence = useCallback(() => {
    const wrappers = Array.from(document.querySelectorAll('.face-media-wrapper'));
    const cubeEl = cubeRef.current;
    if (!wrappers.length) return;
    const tl = anime.timeline({ easing: 'easeInOutQuad' });
    tl.add({
      targets: wrappers,
      scale: [1, 0],
      opacity: [1, 0],
      duration: 700,
      delay: anime.stagger(80),
      easing: 'easeInOutSine',
    }).add({
      targets: cubeEl,
      opacity: [1, 0],
      duration: 400,
      easing: 'linear',
    }, '-=300').add({
      begin: () => setShowName(true),
      duration: 0,
    });
  }, []);

  useEffect(() => {
    if (!showName) return;
    const tl = anime.timeline({ easing: 'easeInOutSine' });
    tl.add({
      targets: firstNameRef.current,
      opacity: [0, 1],
      translateY: [40, 0],
      duration: 1000,
    }).add({
      targets: nameUnderlineRef.current,
      strokeDashoffset: [anime.setDashoffset, 0],
      duration: 800,
    }).add({
      targets: lastNameRef.current,
      opacity: [0, 1],
      translateY: [40, 0],
      duration: 1000,
    }).add({
      targets: subtitleRef.current,
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 600,
    });
  }, [showName]);

  useEffect(() => {
    if (window.innerWidth > 768) return;
    const bg = bgRef.current;
    const videoBg = videoBgRef.current;
    const videoContainer = videoBgContainerRef.current;
    if (!bg) return;
    const url = faceImages[0];
    if (!url) return;
    if (isVideoUrl(url)) {
      if (videoBg && videoContainer) {
        videoBg.src = url;
        videoBg.load();
        videoBg.play().catch(() => {});
        videoContainer.style.opacity = "1";
      }
      bg.style.opacity = "0";
    } else {
      bg.style.backgroundImage = `url("${url}")`;
      bg.style.opacity = "1";
      if (videoContainer) videoContainer.style.opacity = "0";
    }
  }, [faceImages]);

  useEffect(() => {
    if (window.innerWidth <= 768) return;

    if (history.scrollRestoration !== "manual") {
      history.scrollRestoration = "manual";
    }

    const restoreP = restorePRef.current;
    restorePRef.current = null;

    if (restoreP === null) {
      window.scrollTo(0, 0);
    }

    const el = sectionRef.current;
    const cube = cubeRef.current;
    if (!el || !cube) return;

    let targetP = restoreP !== null ? restoreP : 0;
    let currentP = restoreP !== null ? restoreP : 0;
    let rafId = null;
    let isFirstFrame = true;

    let isPinning = false;
    let prevP = 0;

    if (restoreP !== null) {
      const rot = getCubeRotation(restoreP);
      cube.style.transform = `translateZ(0) rotateX(${rot.rx}deg) rotateY(${rot.ry}deg)`;
      currentPRef.current = restoreP;
      const { path: pathData } = computeWireframe(rot.rx, rot.ry, zoomedFaceRef.current);
      let path = wireRef.current?.querySelector("path");
      if (path) {
        path.setAttribute("d", pathData);
      } else if (wireRef.current) {
        path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", borderColorRef.current);
        path.setAttribute("stroke-width", strokeWidthRef.current);
        path.setAttribute("vector-effect", "non-scaling-stroke");
        wireRef.current.appendChild(path);
        path.setAttribute("d", pathData);
      }
    }

    const sync = () => {
      const rect = el.getBoundingClientRect();
      const sb = el.offsetHeight - window.innerHeight;
      targetP = sb > 0 ? Math.min(1, Math.max(0, -rect.top / sb)) : 0;
      if (targetP >= 1 && !zoomedFacesRef.current.every(Boolean) && !isPinning) {
        isPinning = true;
        window.scrollTo(0, el.offsetHeight - window.innerHeight);
        requestAnimationFrame(() => { isPinning = false; });
      }
    };

    const tick = () => {
      if (isFirstFrame) {
        if (restoreP === null) {
          currentP = 0;
          targetP = 0;
        }
        isFirstFrame = false;
      }
      if (syncNextTickRef.current) {
        currentP = targetP;
        syncNextTickRef.current = false;
      }
      if (!isExpandedRef.current) {
        currentP = 0;
        targetP = 0;
      }
      const diff = targetP - currentP;
      if (Math.abs(diff) < 0.001) {
        currentP = targetP;
        rafId = null;
      } else {
        currentP += diff * 0.15;
        rafId = requestAnimationFrame(tick);
      }

      const rot = getCubeRotation(currentP);
      cube.style.transform = `translateZ(0) rotateX(${rot.rx}deg) rotateY(${rot.ry}deg)`;
      currentPRef.current = currentP;
      // Compute this once per tick so both the wireframe block and the
      // overlay block below can use `overlayBounds` — it was previously
      // declared with `const` inside the `wireRef.current` block only,
      // which made it inaccessible (ReferenceError) in the block below.
      const { path: pathData, overlayBounds } = computeWireframe(rot.rx, rot.ry, zoomedFaceRef.current);
      if (wireRef.current) {
        let path = wireRef.current.querySelector("path");
        if (!path) {
          path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", borderColorRef.current);
          path.setAttribute("stroke-width", strokeWidthRef.current);
          path.setAttribute("vector-effect", "non-scaling-stroke");
          wireRef.current.appendChild(path);
        }
        
        path.setAttribute("d", pathData);
      }
      for (let i = 0; i < 6; i++) {
        const nowVisible = isFaceVisible(FACE_NORMALS[i][0], FACE_NORMALS[i][1], FACE_NORMALS[i][2], rot.rx, rot.ry);
        if (nowVisible && !faceWasVisibleRef.current[i]) {
          faceVisibilityCountRef.current[i]++;
          if (faceVisibilityCountRef.current[i] === 2) {
            if (clickLabelRefs.current[i]) {
              clickLabelRefs.current[i].style.opacity = "1";
            }
          }
        }
        faceWasVisibleRef.current[i] = nowVisible;
      }
      // Per-face lighting: rotate face normal by current cube rotation
      if (cubeRef.current) {
        for (let i = 0; i < 6; i++) {
          const faceEl = cubeRef.current.children[i];
          if (!faceEl) continue;
          const media = faceEl.querySelector("img,video");
          const n = FACE_NORMALS[i];
          const [rxn, ryn, rzn] = rotateVecByXY(n[0], n[1], n[2], rot.rx, rot.ry);
          const dot = Math.max(0, rxn * LIGHT_DIR[0] + ryn * LIGHT_DIR[1] + rzn * LIGHT_DIR[2]);
          // Increased dynamic range: lower ambient, stronger directional gain
          const brightness = 0.35 + 1.3 * dot;
          // Apply brightness to container when not zoomed (pre-click)
          if (zoomedFacesRef.current && zoomedFacesRef.current[i]) {
            if (media) media.style.filter = `brightness(${brightness})`;
            if (faceEl.style.filter) faceEl.style.filter = "";
          } else {
            if (media) media.style.filter = "";
            faceEl.style.filter = `brightness(${brightness})`;
          }
        }
      }
      if (overlayRef.current) {
        const zf = zoomedFaceRef.current;
        if (overlayBounds && zf >= 0) {
          const pad = 6;
          const url = faceImages[zf];
          const isVideo = isVideoUrl(url);
          overlayRef.current.style.display = "block";
          overlayRef.current.style.left = (overlayBounds.x - pad) + "px";
          overlayRef.current.style.top = (overlayBounds.y - pad) + "px";
          overlayRef.current.style.width = (overlayBounds.w + pad * 2) + "px";
          overlayRef.current.style.height = (overlayBounds.h + pad * 2) + "px";
          overlayRef.current.style.backgroundImage = isVideo ? "none" : `url("${url}")`;
          overlayRef.current.style.backgroundSize = "cover";
          overlayRef.current.style.backgroundPosition = "center";
          let vid = overlayRef.current.querySelector("video");
          if (isVideo) {
            if (!vid) {
              vid = document.createElement("video");
              vid.className = "w-full h-full object-cover";
              vid.muted = true;
              vid.loop = true;
              vid.playsInline = true;
              vid.preload = "metadata";
              overlayRef.current.appendChild(vid);
            }
            vid.style.display = "block";
            if (vid.src !== url) {
              vid.src = url;
              vid.load();
              vid.play().catch(() => {});
            }
          } else if (vid) {
            vid.style.display = "none";
          }
        } else {
          overlayRef.current.style.display = "none";
        }
      }

      // If all faces were clicked, trigger the end sequence when scrolling far enough
      if (zoomedFacesRef.current && zoomedFacesRef.current.every(Boolean) && !endSequenceStartedRef.current && targetP > 0.95) {
        endSequenceStartedRef.current = true;
        triggerEndSequence();
      }
    };

    const onScroll = () => {
      sync();
      if (!rafId) rafId = requestAnimationFrame(tick);
      if (targetP > 0.001 && scrollHintRef.current) {
        scrollHintRef.current.style.opacity = '0';
      }
      if (isAnimatingRef.current) return;

      if (!isExpandedRef.current && targetP > 0.001) {
        // Forward morph
        isAnimatingRef.current = true;
        const svgEl = morphBodyRef.current?.closest("svg");
        let targetX = 0;
        let targetY = 0;
        if (cubeContainerRef.current && svgEl) {
          const cubeRect = cubeContainerRef.current.getBoundingClientRect();
          const svgRect = svgEl.getBoundingClientRect();
          targetX = (cubeRect.left + cubeRect.width / 2) - (svgRect.left + svgRect.width / 2);
          targetY = (cubeRect.top + cubeRect.height / 2) - (svgRect.top + svgRect.height / 2);
        }
        targetXRef.current = targetX;
        targetYRef.current = targetY;

        const tl = anime.timeline({
          easing: "easeInOutQuad",
          complete: () => {
            isExpandedRef.current = true;
            isAnimatingRef.current = false;
          },
        });
        tl.add({
          targets: morphWheelRef.current,
          opacity: 0,
          duration: 200,
        })
        .add({
          targets: morphBodyRef.current,
          points: { value: "0,0 50,0 100,0 150,0 200,0 250,0 300,0 300,50 300,100 300,150 300,200 300,250 300,300 250,300 200,300 150,300 100,300 50,300 0,300 0,250 0,200 0,150 0,100 0,50" },
          duration: 800,
        })
        .add({
          targets: svgEl,
          translateX: targetX,
          translateY: targetY,
          duration: 400,
        })
          .add({
          targets: morphBodyRef.current,
          opacity: 0,
          duration: 200,
          begin: () => {
            // Cross-fade: morphBody fades out, cube fades in simultaneously over 200ms.
            // Cube appears at rotation 0 (front face, matches the morph body square),
            // then the tick smoothly rotates it to the scroll position.
            if (cubeRef.current) {
              cubeRef.current.style.transform = "translateZ(0)";
            }
            if (wireRef.current) {
              const rot = getCubeRotation(0);
              const { path: pathData } = computeWireframe(rot.rx, rot.ry, zoomedFaceRef.current);
              let path = wireRef.current.querySelector("path");
              if (!path) {
                path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("fill", "none");
                path.setAttribute("stroke", borderColorRef.current);
                path.setAttribute("stroke-width", strokeWidthRef.current);
                path.setAttribute("vector-effect", "non-scaling-stroke");
                wireRef.current.appendChild(path);
              }
              path.setAttribute("d", pathData);
            }
            // Start cube fade-in (opacity 0 → 1 over 200ms)
            if (contentRef.current) {
              contentRef.current.style.transition = "opacity 0.2s ease";
              void contentRef.current.offsetHeight;
              contentRef.current.style.opacity = "1";
            }
          },
          complete: () => {
            isAnimatingRef.current = false;
            // Cross-fade complete
            if (contentRef.current) {
              contentRef.current.style.transition = "";
            }
            setPhaseRef.current("cube");
            syncNextTickRef.current = true;
          },
        });
      } else if (isExpandedRef.current && targetP <= 0.001) {
        // Reverse morph
        isAnimatingRef.current = true;
        setPhaseRef.current("initial");
        const bg = bgRef.current;
        const videoBg = videoBgRef.current;
        const videoContainer = videoBgContainerRef.current;
        if (bg) {
          bg.style.transition = "none";
          bg.style.backgroundImage = "none";
          bg.style.opacity = "1";
        }
        if (videoContainer) videoContainer.style.opacity = "0";
        if (videoBg) videoBg.pause();
        const svgEl = morphBodyRef.current?.closest("svg");

        anime.timeline({
          easing: "easeInOutQuad",
          complete: () => {
            isExpandedRef.current = false;
            isAnimatingRef.current = false;
            // Intentionally do not reload the page here —
            // keep state so browser Back does not force a full refresh.
          },
        })
        .add({
          targets: morphBodyRef.current,
          opacity: 1,
          duration: 200,
        })
        .add({
          targets: svgEl,
          translateX: [targetXRef.current, 0],
          translateY: [targetYRef.current, 0],
          duration: 400,
        })
        .add({
          targets: morphBodyRef.current,
          points: { value: "135,150 136,144 139,139 144,136 150,135 156,136 161,139 164,144 165,150 165,155 165,160 165,165 165,170 164,176 161,181 156,184 150,185 144,184 139,181 136,176 135,170 135,165 135,160 135,155" },
          duration: 800,
        })
        .add({
          targets: morphWheelRef.current,
          opacity: 1,
          duration: 200,
        })
        .add({
          targets: scrollHintRef.current,
          opacity: 1,
          duration: 200,
        });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    if (restoreP !== null) {
      syncNextTickRef.current = true;
      window.scrollTo(0, restoreP * (el.offsetHeight - window.innerHeight));
    } else {
      sync();
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [faceImages]);

  const firstIsVideo = isVideoUrl(faceImages[0]);
 

  return (
    <section
      ref={sectionRef}
      className="relative z-10 h-auto lg:h-[700vh]"
      style={{ clipPath: "inset(0)" }}
    >
      <div className="lg:sticky lg:top-0 min-h-screen flex items-center overflow-hidden">
        <div
          ref={bgRef}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundColor: "#0a0f1c",
            transition: "opacity 0.35s ease",
            opacity: 1,
          }}
        />
        <div
          ref={videoBgContainerRef}
          className="absolute inset-0 transition-opacity duration-350"
          style={{ opacity: 0 }}
        >
          <video
            ref={videoBgRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onCanPlay={() => {}}
          />
        </div>
        <div className="absolute inset-0 bg-[#0a0f1c]/60" />

        <div className="relative z-10 w-full">
            <div ref={scrollIndicatorRef} className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ display: phase === "cube" ? "none" : "flex" }}>
              <div className="relative">
                <svg width={343} height={343} viewBox="0 0 300 300" style={{ overflow: "visible" }}>
                  <polygon
                    ref={morphBodyRef}
                     points="135,150 136,144 139,139 144,136 150,135 156,136 161,139 164,144 165,150 165,155 165,160 165,165 165,170 164,176 161,181 156,184 150,185 144,184 139,181 136,176 135,170 135,165 135,160 135,155"
                     fill="#0a0f1c"
                    stroke="#00a5b0"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    ref={morphWheelRef}
                    x1="150" y1="146" x2="150" y2="152"
                    stroke="#00a5b0"
                    strokeWidth={4}
                    strokeLinecap="round"
                    className="wheel-anim"
                  />
                </svg>
                <div
                  ref={scrollHintRef}
                  className="absolute left-1/2 -translate-x-1/2 text-sm text-[#00a5b0] tracking-[0.2em] leading-tight text-center whitespace-nowrap uppercase"
                  style={{ top: 'calc(100% - 78px)', transition: 'opacity 0.5s ease' }}
                >
                  SCROLL<br />DOWN<br /><span style={{ fontSize: '3em', lineHeight: '1', display: 'block' }}>↓</span>
                </div>
              </div>
              <style>{`
                @keyframes wheelScroll {
                  0%, 100% { transform: translateY(0); opacity: 1; }
                  50% { transform: translateY(8px); opacity: 0.2; }
                }
                .wheel-anim {
                  animation: wheelScroll 1.5s ease-in-out infinite;
                }
              `}</style>
            </div>
          <div
            ref={contentRef}
            className="mx-auto max-w-7xl px-6 lg:px-8 w-full"
            style={{ opacity: phase === "cube" ? 1 : 0, pointerEvents: phase === "cube" ? "auto" : "none" }}
          >
              <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
                <div className="flex items-center">
                  <div className="w-full space-y-4 px-8">
                    {PROJECT_LINKS.map((link, i) => (
                      <button
                        key={link.name}
                        onClick={() => openProject(i)}
                        className="block text-left w-full bg-transparent border-0 text-[#00a5b0] tracking-[0.2em] uppercase transition-all duration-500"
                        style={{
                          fontSize: "3.5rem",
                          fontWeight: "bold",
                          fontStretch: "semi-condensed",
                          opacity: zoomedFaces[i] ? 1 : 0,
                          transform: zoomedFaces[i] ? "translateX(0)" : "translateX(-30px)",
                          transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`,
                        }}
                      >
                        {link.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div ref={cubeContainerRef} className="relative shrink-0" style={{ width: 300, height: 300 }}>
                  <div style={{ perspective: 1200, perspectiveOrigin: "50% 50%" }}>
                    <div
                      ref={cubeRef}
                      className="relative"
                      style={{
                        width: 300,
                        height: 300,
                        transformStyle: "preserve-3d",
                        willChange: "transform",
                      }}
                    >
                      {FACES.map((face, i) => (
                        <div
                          key={face}
                          className="absolute overflow-hidden box-border"
                          style={{
                            width: 300,
                            height: 300,
                            background: "#0a0f1c",
                            boxShadow: "0 0 15px rgba(0,0,0,0.3)",
                            backfaceVisibility: "hidden",
                            transform: faceTransform(face),
                            WebkitTransform: faceTransform(face),
                            isolation: "isolate",
                          }}
                          >
                            {faceImages[i] && (
                             <div
                               className="face-media-wrapper"
                               style={{
                                 transform: zoomedFaces[i] ? "scale(1)" : "scale(0)",
                                 transition: "transform 0.6s ease",
                                 width: "100%",
                                 height: "100%",
                                 pointerEvents: "none",
                               }}
                             >
                               {isVideoUrl(faceImages[i]) ? (
                                 <video
                                   src={faceImages[i]}
                                   className="w-full h-full object-cover"
                                   autoPlay
                                   muted
                                   loop
                                   playsInline
                                   preload="metadata"
                                 />
                               ) : (
                                 <img
                                   src={faceImages[i]}
                                   alt=""
                                   className="w-full h-full object-cover"
                                   draggable={false}
                                   loading={i === 0 ? "eager" : "lazy"}
                                   fetchPriority={i === 0 ? "high" : undefined}
                                 />
                               )}
                             </div>
                           )}
                           <div
                             ref={el => { clickLabelRefs.current[i] = el; }}
                             className="pointer-events-none select-none"
                             style={{
                               position: "absolute",
                               inset: 0,
                               display: "flex",
                               alignItems: "center",
                               justifyContent: "center",
                               color: "#33d1c8",
                                fontSize: "1rem",
                                letterSpacing: "0.3em",
                               opacity: 0,
                               transition: "opacity 0.5s ease",
                               zIndex: 5,
                             }}
                            >{FACE_LABELS[i]}</div>
                        </div>
                      ))}
                    </div>
                    </div>
                            <svg
                              ref={wireRef}
                              className="absolute inset-0 pointer-events-none"
                              width={300}
                              height={300}
                              viewBox="0 0 300 300"
                              style={{ zIndex: 5, overflow: "visible" }}
                            />
                            <div
                              ref={overlayRef}
                              style={{ position: "absolute", inset: 0, zIndex: 20, background: "#0a0f1c", pointerEvents: "none", opacity: 0, transition: "opacity 0.12s linear" }}
                            />
                            <div
                              onClick={handleCubeClick}
                              className="absolute cursor-pointer"
                              style={{ zIndex: 10, background: "transparent", top: -60, left: -60, right: -60, bottom: -60 }}
                            />
                </div>
              </div>
            </div>
            </div>
          </div>

        
      </div>

      {selectedProject !== null && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: '#0a0f1c' }}>
          <div className="mx-auto max-w-4xl px-6 py-24">
            {renderProjectContent(selectedProject)}
            <div className="text-center mt-20">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history && window.history.state && typeof window.history.state.ufoProject === 'number') {
                    window.history.back();
                  } else {
                    setSelectedProject(null);
                    if (typeof window !== 'undefined') {
                      try {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('project');
                        window.history.replaceState(null, '', url.pathname + url.search);
                      } catch (e) {}
                    }
                  }
                }}
                className="text-[#00a5b0] tracking-[0.2em] uppercase text-sm hover:opacity-70 transition-opacity bg-transparent border-0 cursor-pointer"
              >
                &larr; RETOUR
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const PROJECT_CONTENT = [
  {
    emoji: "🌐",
    label: "Développement Web",
    title: "Concevoir des expériences web modernes, performantes et accessibles.",
    presentation: [
      "Le développement web est bien plus que l'assemblage de technologies. Chaque projet est pensé pour offrir une navigation fluide, une identité visuelle cohérente et une expérience utilisateur agréable sur tous les supports.",
      "J'accorde une attention particulière à la qualité du code, aux performances de chargement, au référencement naturel et à l'accessibilité afin de créer des sites fiables et durables.",
    ],
    skills: [
      { title: "HTML5", desc: "Structure sémantique, accessibilité et référencement naturel." },
      { title: "CSS3", desc: "Création d'interfaces modernes grâce aux animations, Flexbox, Grid et effets visuels avancés." },
      { title: "JavaScript", desc: "Développement d'interfaces dynamiques et interactives utilisant les dernières fonctionnalités ECMAScript." },
      { title: "Responsive Design", desc: "Des applications parfaitement adaptées aux smartphones, tablettes et ordinateurs." },
    ],
    features: ["Sites vitrines", "Landing Pages", "Portfolios", "Tableaux de bord", "Interfaces administrateur", "Applications Web"],
    philosophy: "Un site internet doit être rapide, intuitif et agréable à utiliser. La technique n'a de valeur que lorsqu'elle améliore réellement l'expérience utilisateur.",
  },
  {
    emoji: "⚛️",
    label: "Frameworks Front-end",
    title: "Créer des interfaces réactives, évolutives et performantes.",
    presentation: [
      "Les frameworks modernes permettent de développer des applications riches tout en conservant un code structuré et facilement maintenable.",
      "J'utilise principalement React pour construire des interfaces modulaires capables d'évoluer facilement au fil des besoins.",
    ],
    skills: [
      { title: "React", desc: "Développement basé sur les composants réutilisables, gestion des états, Hooks, Context API, navigation." },
      { title: "Next.js", desc: "Optimisation du référencement, rendu hybride, performances, chargement optimisé." },
      { title: "Tailwind CSS", desc: "Création rapide d'interfaces élégantes tout en conservant une excellente maintenabilité." },
    ],
    features: [],
    approach: ["indépendant", "réutilisable", "facilement testable", "évolutif"],
  },
  {
    emoji: "⚙️",
    label: "Back-end",
    title: "Donner vie aux applications grâce à une architecture robuste et sécurisée.",
    presentation: [
      "Le serveur constitue le cœur d'une application. Il orchestre les échanges de données, sécurise les accès et assure la communication avec les bases de données.",
      "Je développe des API REST performantes en privilégiant une architecture claire et évolutive.",
    ],
    skills: [
      { title: "Node.js", desc: "Serveur JavaScript haute performance." },
      { title: "Express", desc: "Création d'API REST, routing, middlewares, gestion des erreurs." },
      { title: "Sécurité", desc: "Authentification JWT, hashage des mots de passe, validation des données, protection contre les attaques courantes." },
    ],
    features: ["Authentification", "Gestion des utilisateurs", "Upload de fichiers", "CRUD complet", "API REST", "Documentation"],
  },
  {
    emoji: "☁️",
    label: "Bases de données & Cloud",
    title: "Organiser, sécuriser et rendre les données accessibles partout.",
    presentation: [
      "Une application performante repose sur une gestion fiable des données.",
      "Je conçois des bases optimisées et adaptées aux besoins de chaque projet.",
    ],
    skills: [
      { title: "MariaDB / MySQL / PostgreSQL", desc: "Conception relationnelle, optimisation des requêtes." },
      { title: "MongoDB", desc: "Collections, documents, agrégation." },
    ],
    features: ["Cloudinary", "Render", "Netlify", "Vercel", "GitHub"],
    approach: ["rapides", "fiables", "sécurisées", "facilement déployables"],
  },
  {
    emoji: "📱",
    label: "Développement Mobile",
    title: "Créer des applications mobiles modernes pour Android et iOS.",
    presentation: [
      "Les usages mobiles imposent des interfaces simples, rapides et parfaitement adaptées aux contraintes des smartphones.",
      "Je développe des applications multiplateformes capables d'offrir une expérience utilisateur fluide sur Android comme sur iOS.",
    ],
    skills: [
      { title: "React Native", desc: "Applications natives performantes, navigation, notifications, accès aux fonctionnalités du téléphone." },
      { title: "Flutter", desc: "Interfaces riches, animations, widgets, excellentes performances." },
      { title: "Android", desc: "Création d'APK, compilation, publication, optimisation." },
    ],
    features: ["Connexion utilisateur", "Notifications", "Caméra", "Géolocalisation", "Stockage local", "Synchronisation"],
  },
  {
    emoji: "🚀",
    label: "Projets",
    title: "Chaque projet est une démonstration concrète de mes compétences.",
    presentation: [
      "Au-delà des technologies, ce sont les réalisations qui témoignent d'un savoir-faire.",
      "Chaque projet représente une problématique réelle, une réflexion technique et une solution conçue pour répondre aux besoins des utilisateurs.",
    ],
    projects: [
      { title: "CoolBooking", tags: "React • Node.js • MariaDB", desc: "Plateforme de réservation de locations saisonnières.", details: "Gestion des hébergements, calendrier de réservation, espace propriétaire, administration." },
      { title: "Art & Patrimoine", tags: "React • API REST • Cloudinary", desc: "Application dédiée à la découverte du patrimoine culturel.", details: "" },
      { title: "Application Mobile", tags: "Flutter • React Native", desc: "Développement multiplateforme.", details: "Notifications, synchronisation, authentification." },
    ],
    process: [
      "Analyse des besoins",
      "Conception de l'architecture",
      "Développement des fonctionnalités",
      "Tests et validation",
      "Déploiement",
      "Maintenance et évolutions",
    ],
  },
];

function renderProjectContent(i) {
  const p = PROJECT_CONTENT[i];
  const items = [];
  items.push(
    <div key="hero">
      <p className="text-[#00a5b0] tracking-[0.2em] uppercase text-sm mb-4">{p.emoji} {p.label}</p>
      <h1 className="text-5xl font-bold text-white mb-6">{p.title}</h1>
      <div className="w-16 h-0.5 bg-[#00a5b0] mb-16" />
    </div>
  );
  if (p.presentation) {
    items.push(
      <section key="presentation" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">Présentation</h2>
        {p.presentation.map((par, j) => <p key={j} className="text-[#94a3b8] leading-relaxed mb-4">{par}</p>)}
      </section>
    );
  }
  if (p.skills && p.skills.length > 0) {
    items.push(
      <section key="skills" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-8">{i === 0 ? "Mes compétences" : i === 1 ? "Mes outils" : "Mes compétences"}</h2>
        <div className="grid gap-6">
          {p.skills.map((s, j) => (
            <div key={j} className="border-l-2 border-[#00a5b0] pl-5">
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-[#94a3b8] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (p.features && p.features.length > 0) {
    const featureLabel = i === 2 ? "Fonctionnalités" : i === 0 ? "Ce que je réalise" : "Fonctionnalités";
    items.push(
      <section key="features" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">{featureLabel}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {p.features.map((f, j) => (
            <div key={j} className="text-[#94a3b8] flex items-center gap-2">
              <span className="text-[#00a5b0]">✦</span> {f}
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (p.approach) {
    items.push(
      <section key="approach" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">Objectif</h2>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
          <div className="grid grid-cols-2 gap-3">
            {p.approach.map((a, j) => (
              <div key={j} className="text-[#94a3b8] flex items-center gap-2">
                <span className="text-[#00a5b0]">✦</span> {a}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (p.philosophy) {
    items.push(
      <section key="philosophy" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">Ma philosophie</h2>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
          <p className="text-[#94a3b8] leading-relaxed italic">&ldquo;{p.philosophy}&rdquo;</p>
        </div>
      </section>
    );
  }
  if (p.projects) {
    items.push(
      <section key="projects" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-8">Projets</h2>
        <div className="grid gap-6">
          {p.projects.map((pr, j) => (
            <div key={j} className="border border-[#1e293b] rounded-lg p-6 bg-[#0f172a]">
              <h3 className="text-xl font-bold text-white mb-1">{pr.title}</h3>
              <p className="text-[#00a5b0] text-sm mb-2">{pr.tags}</p>
              <p className="text-[#94a3b8] mb-2">{pr.desc}</p>
              {pr.details && <p className="text-[#64748b] text-sm">{pr.details}</p>}
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (p.process) {
    items.push(
      <section key="process" className="mb-20">
        <h2 className="text-2xl font-bold text-[#00a5b0] mb-6">Ma méthode de travail</h2>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-8">
          <p className="text-[#94a3b8] mb-6">Chaque projet suit un processus rigoureux :</p>
          <div className="grid gap-4">
            {p.process.map((step, j) => (
              <div key={j} className="flex items-center gap-4 text-[#94a3b8]">
                <span className="text-[#00a5b0] font-bold text-sm w-6">{String(j + 1).padStart(2, "0")}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  return items;
}

export default HeroCube;
