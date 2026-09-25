"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import anime from "animejs";

import { renderProjectContent } from "./cube/project-content";
import { ContactOverlay } from "./contact-overlay";
import {
  FACE_LABELS,
  FACE_NORMALS,
  FACES,
  LIGHT_DIR,
  computeWireframe,
  faceTransform,
  findClickedFace,
  getCubeRotation,
  isFaceVisible,
  isVideoUrl,
  rotateVecByXY,
} from "../lib/cube-math";

const PROJECT_LINKS = [
  { name: "1.WEB", url: "/web" },
  { name: "2.REACT", url: "/react" },
  { name: "3.BACKEND", url: "/backend" },
  { name: "4.DATABASE", url: "/database" },
  { name: "5.MOBILE", url: "/mobile" },
  { name: "6.PROJETS", url: "/projets" },
];

// Default media files from the public/ folder, mapped to FACE_LABELS order:
// [WEB, REACT, BACKEND, DATABASE, MOBILE, PROJETS]
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const DEFAULT_FACE_MEDIA = [
  `${BASE}/web.webm`,
  `${BASE}/react.webp`,
  `${BASE}/backend.webm`,
  `${BASE}/database.webp`,
  `${BASE}/mobile.webm`,
  `${BASE}/projets.webp`,
];

// Smoothstep easing reused by the end-sequence animations.
const smoothstep = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

const SCROLL_SMOOTHING_MS = 90;
const MAX_FRAME_DT = 100;

export function HeroCube({ title, subtitle, images = [] }) {
  const sectionRef = useRef(null);
  const cubeRef = useRef(null);
  const wireRef = useRef(null);
  const bgRef = useRef(null);
  const videoBgRef = useRef(null);
  const videoBgContainerRef = useRef(null);
  const [zoomedFace, setZoomedFace] = useState(-1);
  const [zoomedFaces, setZoomedFaces] = useState([false, false, false, false, false, false]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [contactDone, setContactDone] = useState(false);
  const [cubeScale, setCubeScale] = useState(1);
  // Taille affichée (px) de la carte d'intro (viewBox 300) ; suit cubeScale
  // pour que le crossfade carré→cube reste aligné sur tous les formats.
  const [squareSize, setSquareSize] = useState(343);
  const [skipped, setSkipped] = useState(false);
  const [skipRevealedFaces, setSkipRevealedFaces] = useState([false, false, false, false, false, false]);
  const vhRef = useRef(typeof window !== "undefined" ? window.innerHeight : 0);
  const skipRef = useRef(false);
  // Start position (timeline units) of the skipped sequence, captured on the
  // first skip frame so the gentle rotation begins exactly where we are.
  const skipStartRef = useRef(0);
  const skipActiveRef = useRef(false);
  const skipRevealedFacesRef = useRef(skipRevealedFaces);
  // Once skipped, the faces fold away so the cube is visibly empty during the
  // gentle rotation (only the cyan wireframe shows).
  const skipFacesHiddenRef = useRef(false);
  // While the folding morph runs, the per-frame face loop leaves the wrapper
  // transforms alone so a single CSS transition can play through.
  const skipFoldRef = useRef(false);
  const cubeScaleRef = useRef(1);
  const contactTabRevealedRef = useRef(false);
  const morphBodyRef = useRef(null);
  const morphWheelRef = useRef(null);
  const scrollIndicatorRef = useRef(null);
  const scrollHintRef = useRef(null);
  const zoomedFacesRef = useRef(zoomedFaces);
  const zoomedFaceRef = useRef(-1);
  const currentPRef = useRef(0);
  const overlayRef = useRef(null);
  const galleryLabelRef = useRef(null);
  const borderColorRef = useRef("#00a5b0");
  const strokeWidthRef = useRef(2);
  const cubeContainerRef = useRef(null);
  const contentRef = useRef(null);
  const restorePRef = useRef(null);
  const faceWasVisibleRef = useRef([false, false, false, false, false, false]);
  const faceVisibilityCountRef = useRef([0, 0, 0, 0, 0, 0]);
  const clickLabelRefs = useRef([]);
  const clickStackRef = useRef([]);
  const allClickedRef = useRef(false);
  const tickRef = useRef(null);
  const clickZoneRef = useRef(null);
  const namesRef = useRef(null);
  const subtitleRef = useRef(null);
  const facesVisibleRef = useRef(true);
  const spinFromRef = useRef(null);
  const bgResetRef = useRef(true);
  const wirePathRef = useRef(null);
  // Infinity triggers wireframe computation on the very first tick.
  const lastWireRotRef = useRef({ rx: Infinity, ry: Infinity });
  // Scroll position where the cube pauses for the user to click a labeled face.
  const labelPinPRef = useRef(null);
  // Prevents the unlock reset from running more than once.
  const wasUnlockedRef = useRef(false);
  // Order in which the six visuals take their leave (reverse click order).
  const exitOrderRef = useRef(null);
  // Set to true once every face has completed its 2nd exposure.
  const allSeenTwiceRef = useRef(false);
  // Rotation added by the user's direct drag, layered over the scroll-driven one.
  const dragOffsetRef = useRef({ rx: 0, ry: 0 });
  // Active pointer-drag session: { startX, startY, lastX, lastY, pointerType, moved }.
  const dragStateRef = useRef(null);
  // True while the end-sequence spin animation is playing (drag is locked then).
  const spinningRef = useRef(false);
  // True while the cube is on screen and can be grabbed (after the intro, before the spin).
  const cubeDraggableRef = useRef(false);
  // Suppresses the native click following a real drag (used by handleCubeClick).
  const suppressClickRef = useRef(false);
  // When a tap is resolved on pointerup (mobile browsers can swallow the
  // synthesized click), remember where and when it happened so the native
  // click that does fire right afterwards is ignored instead of re-opening
  // the same face a second time.
  const tapPointRef = useRef(null);

  zoomedFacesRef.current = zoomedFaces;
  skipRevealedFacesRef.current = skipRevealedFaces;
  zoomedFaceRef.current = zoomedFace;
  borderColorRef.current = "#00a5b0";
  strokeWidthRef.current = 2;

  const faceImages = useMemo(() => {
    const srcs = images && images.length ? images : DEFAULT_FACE_MEDIA;

    const tokensByLabel = FACE_LABELS.map((l) => l.toLowerCase());

    const normalize = (s) => {
      if (!s) return "";
      try {
        const p = s.split("/").pop().split("?")[0];
        return p.toLowerCase();
      } catch {
        return s.toLowerCase();
      }
    };

    const srcNames = srcs.map((s) => ({ src: s, name: normalize(s) }));

    const mapped = new Array(FACES.length).fill(null);

    for (let i = 0; i < tokensByLabel.length; i++) {
      const token = tokensByLabel[i];
      for (let j = 0; j < srcNames.length; j++) {
        if (!srcNames[j]) continue;
        if (srcNames[j].name.includes(token)) {
          mapped[i] = srcNames[j].src;
          srcNames[j] = null;
          break;
        }
      }
    }

    let k = 0;
    for (let i = 0; i < mapped.length; i++) {
      if (mapped[i]) continue;
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
    bgResetRef.current = false;
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = (e) => {
      const s = e.state;
      if (s && s.ufoContact) {
        setShowContact(true);
        return;
      }
      setShowContact(false);
      if (s && typeof s.ufoProject === "number") {
        setSelectedProject(s.ufoProject);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const p = params.get("project");
      if (p) {
        const idx = Number(p) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < FACES.length) {
          setSelectedProject(idx);
          return;
        }
      }
      setSelectedProject(null);
    };
    window.addEventListener("popstate", onPop);

    const params = new URLSearchParams(window.location.search);
    const p = params.get("project");
    if (p) {
      const idx = Number(p) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < FACES.length) {
        setSelectedProject(idx);
        window.history.replaceState({ ufoProject: idx }, "", window.location.href);
      }
    }

    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleFaceClick = useCallback((i) => {
    setZoomedFace(i);
    setZoomedFaces((prev) => {
      const n = [...prev];
      n[i] = true;
      return n;
    });
    const n = [...zoomedFacesRef.current];
    n[i] = true;
    if (n.every(Boolean)) {
      allClickedRef.current = true;
      if (tickRef.current) tickRef.current();
    }
    changeBackground(i);
    clickStackRef.current = [...clickStackRef.current.filter((idx) => idx !== i), i];
    if (clickLabelRefs.current[i]) {
      clickLabelRefs.current[i].style.opacity = "0";
    }
    const video = (cubeRef.current?.children[i] || document).querySelector("video");
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [changeBackground]);

  // Pure hit-test: given viewport coordinates and the click zone rect, open
  // the face lying under the pointer (or do nothing). Shared by the native
  // click handler and by the pointerup tap resolution below.
  const hitTestAndOpen = useCallback((x, y, rect) => {
    if (!rect) return;
    const baseRot = getCubeRotation(currentPRef.current);
    const rot = {
      rx: baseRot.rx + dragOffsetRef.current.rx,
      ry: baseRot.ry + dragOffsetRef.current.ry,
    };
    const idx = findClickedFace(
      x,
      y,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      rot.rx,
      rot.ry,
      cubeScaleRef.current,
    );
    if (idx >= 0 && faceImages[idx] && facesVisibleRef.current) {
      const labelShown = faceVisibilityCountRef.current[idx] >= 2;
      const mediaShown = zoomedFacesRef.current[idx];
      if (labelShown || mediaShown) handleFaceClick(idx);
    }
  }, [handleFaceClick, faceImages]);

  const handleCubeClick = useCallback((e) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // Native click synthesized after a tap we already resolved on pointerup:
    // ignore it (same spot, right after) so the face is not re-opened.
    const tap = tapPointRef.current;
    if (tap && Date.now() - tap.at < 400 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30) {
      tapPointRef.current = null;
      return;
    }
    hitTestAndOpen(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  }, [hitTestAndOpen]);

  const openProject = useCallback((i) => {
    setSelectedProject(i);
    if (typeof window !== "undefined") {
      try {
        const state = { ufoProject: i };
        const url = new URL(window.location.href);
        url.searchParams.set("project", String(i + 1));
        window.history.pushState(state, "", url.pathname + url.search);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const landscape = w > h;
      const baseSize = 300;
      const reserveH = landscape ? 96 : 168;
      const availW = Math.max(120, w - 24);
      const availH = Math.max(120, h - reserveH);
      const s = Math.max(0.35, Math.min(1, availW / baseSize, availH / baseSize));
      cubeScaleRef.current = s;
      setCubeScale(s);
      setSquareSize(Math.min(343 * s, w - 8));
      // Refresh the locked height only on a real resize (rotation, desktop
      // window) — the small jumps the URL bar causes on mobile are ignored so
      // the section and the scroll targets never move during a gesture.
      if (h > 0 && Math.abs(h - vhRef.current) > 130) vhRef.current = h;
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  useEffect(() => {
    if (history.scrollRestoration !== "manual") {
      history.scrollRestoration = "manual";
    }

    const restoreP = restorePRef.current;
    restorePRef.current = null;

    const el = sectionRef.current;
    const cube = cubeRef.current;
    if (!el || !cube) return;

    if (restoreP === null) {
      el.scrollTop = 0;
    }

    const body = morphBodyRef.current;
    const wheel = morphWheelRef.current;
    const hint = scrollHintRef.current;
    const names = namesRef.current;
    const sub = subtitleRef.current;
    const cubeContainer = cubeContainerRef.current;
    const contentEl = contentRef.current;
    const bg = bgRef.current;
    if (!body || !wheel || !hint || !names || !sub || !cubeContainer || !contentEl || !bg) return;

    // The section is its own scroll container (height 100svh, content 700svh)
    // so the document itself never scrolls and the mobile browser bar stays
    // put. Scroll progress is read straight from the section's scrollTop.

    const resetBackground = () => {
      if (videoBgContainerRef.current) videoBgContainerRef.current.style.opacity = "0";
      if (videoBgRef.current) videoBgRef.current.pause();
      bg.style.transition = "none";
      bg.style.backgroundImage = "none";
      bg.style.opacity = "0";
      void bg.offsetHeight;
      bg.style.transition = "opacity 0.35s ease";
      bg.style.opacity = "1";
    };

    // ---- Single master timeline ----
    // Every stage of the animation lives in this one timeline. Its playhead is
    // driven by scroll progress (tl.seek), so the entire animation scrubs
    // forwards and backwards and is fully reversible.
    const SQUARE_POINTS =
      "0,0 50,0 100,0 150,0 200,0 250,0 300,0 300,50 300,100 300,150 300,200 300,250 300,300 250,300 200,300 150,300 100,300 50,300 0,300 0,250 0,200 0,150 0,100 0,50";

    const W = {
      wheelFade: 200,
      morph: 1600,
      fadeIn: 120,
      idle: 5000,
      facesOut: 900,
      cubeFade: 600,
      spin: 3600,
      squareIn: 250,
      cubeOut: 500,
      lineMorph: 900,
      namesRise: 1500,
    };
    const TOTAL =
      W.wheelFade +
      W.morph +
      W.fadeIn +
      W.idle +
      W.facesOut +
      W.cubeFade +
      W.spin +
      W.squareIn +
      W.cubeOut +
      W.lineMorph +
      W.namesRise;
    const INTRO_END = (W.wheelFade + W.morph + W.fadeIn) / TOTAL;
    const CUBE_END = (W.wheelFade + W.morph + W.fadeIn + W.idle) / TOTAL;
    const SPIN_START = CUBE_END + (W.facesOut + W.cubeFade) / TOTAL;
    const SPIN_END = CUBE_END + (W.facesOut + W.cubeFade + W.spin) / TOTAL;
    const LINE_POS = TOTAL - (W.lineMorph + W.namesRise);
    const NAMES_START = (LINE_POS + W.lineMorph) / TOTAL;
    const NAMES_END = NAMES_START + W.namesRise / TOTAL;
    // The cube only rotates on the part of the scroll that comes after the intro.
    const CUBE_RANGE = 1 - INTRO_END;
    const ROT_END = (SPIN_END - INTRO_END) / CUBE_RANGE;

    const tl = anime.timeline({ autoplay: false });
    tl.add({
      targets: [wheel, hint],
      opacity: [1, 0],
      duration: W.wheelFade,
      easing: "easeInOutQuad",
    })
      .add({
        targets: body,
        points: { value: SQUARE_POINTS },
        duration: W.morph,
        easing: "easeInOutQuad",
      })
      // The cube fades in over the SAME window the square fades out (same easing).
      // The two curves are complementary, so the visible outline never changes
      // intensity — the square→cube transition is invisible at any scroll speed.
      .add({
        targets: body,
        opacity: [1, 0],
        duration: W.fadeIn,
        easing: "easeInOutQuad",
      })
      .add({
        targets: contentEl,
        opacity: [0, 1],
        duration: W.fadeIn,
        easing: "easeInOutQuad",
      }, W.wheelFade + W.morph)
      .add({ duration: W.idle })
      .add({ duration: W.facesOut })
      .add({ duration: W.cubeFade })
      .add({ duration: W.spin })
      .add({
        targets: body,
        opacity: [0, 1],
        duration: W.squareIn,
        easing: "easeInOutQuad",
      })
      .add({
        targets: cubeContainer,
        opacity: [1, 0],
        duration: W.cubeOut,
        easing: "easeInOutQuad",
      })
      .add({ duration: W.lineMorph }, LINE_POS);

    let targetP = restoreP !== null ? restoreP : 0;
    let currentP = restoreP !== null ? restoreP : 0;
    let rafId = null;
    let lastTickTime = 0;
    // Once every face has been clicked, the end sequence plays out at a steady
    // pace (autoplay) instead of snapping to the real scroll position.
    let autoplay = false;
    let autoplayElapsed = 0;
    // Position (timeline units) the skip morph glides up from. On the manual
    // skip that equals the start pose, so the cube holds still while its faces
    // fold in; on the automatic load it is wherever the page was, so the intro
    // sweep gently rides up to the cube during the fold instead of jumping.
    let skipFrom = 0;
    let skipLate = false;
    const AUTOPLAY_MS = 9000;
    // Skipped intro: faces come back out and each one is exposed frontally for
    // a moment (roughly one second, label included), then the cube folds and
    // the finale plays at its own readable pace.
    const SKIP_MORPH_MS = 900;
    const SKIP_HOLD_MS = 1000;
    const SKIP_TURN_MS = 400;
    const SKIP_LEAD_MS = 400;
    const SKIP_GAP_MS = 1100;
    const SKIP_FINALE_MS = 3000;
    // Label choreography within each hold: fade in only after the cube fully
    // settles (its composited render is stable by then), and fade out before
    // the next turn begins so the text never shrinks in perspective.
    const SKIP_LABEL_DELAY_MS = 100;
    const SKIP_LABEL_EXIT_MS = 360;
    // Timestamp of the last scroll nudge back to the labelled-face pin.
    let lastPinFix = 0;
    // Poses (rotation units) the skip gallery lingers on, one per exposed face,
    // computed from where the cube is when the sweep starts.
    let galleryRot = [];
    let galleryDur = 0;
    const gallerySetup = (start) => {
      galleryRot = [];
      galleryDur = 0;
      const startRot = Math.max(0, (start - INTRO_END) / CUBE_RANGE);
      if (startRot <= 5 / 12 + 1e-9) {
        for (let k = 0; k < 6; k++) {
          if (k / 12 >= startRot - 1e-9) galleryRot.push(k / 12);
        }
      }
      if (galleryRot.length === 0) return;
      const lead = startRot < galleryRot[0] - 1e-9 ? SKIP_LEAD_MS : 0;
      galleryDur = lead + galleryRot.length * (SKIP_HOLD_MS + SKIP_TURN_MS) - SKIP_TURN_MS;
    };

    // Cache face DOM children once to avoid querySelector calls in the animation loop.
    const faceCache = Array.from({ length: 6 }, (_, i) => {
      const faceEl = cubeRef.current?.children[i];
      if (!faceEl) return null;
      return {
        el: faceEl,
        media: faceEl.querySelector("img,video"),
        wrapper: faceEl.querySelector(".face-media-wrapper"),
      };
    });

    if (restoreP !== null) {
      const rot = getCubeRotation(Math.max(0, (restoreP - INTRO_END) / CUBE_RANGE));
      cube.style.transform = `translateZ(0) rotateX(${rot.rx}deg) rotateY(${rot.ry}deg)`;
      currentPRef.current = Math.max(0, (restoreP - INTRO_END) / CUBE_RANGE);
      const { path: pathData } = computeWireframe(rot.rx, rot.ry, zoomedFaceRef.current);
      lastWireRotRef.current = { rx: rot.rx, ry: rot.ry };
      if (wireRef.current) {
        if (!wirePathRef.current) {
          const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
          p.setAttribute("fill", "none");
          p.setAttribute("stroke", "#00a5b0");
          p.setAttribute("stroke-width", "2");
          p.setAttribute("vector-effect", "non-scaling-stroke");
          wireRef.current.appendChild(p);
          wirePathRef.current = p;
        }
        wirePathRef.current.setAttribute("d", pathData);
      }
    }

    const sync = () => {
      // While the skip sweep runs, always steer toward the end of the section.
      if (skipRef.current) {
        targetP = 1;
        return;
      }
      const sb = el.scrollHeight - el.offsetHeight;
      // Reading the section's own scrollTop avoids the layout read of
      // getBoundingClientRect on every scroll frame — smoother on mobile.
      const pos = el.scrollTop;
      const real = sb > 0 ? Math.min(1, Math.max(0, pos / sb)) : 0;
      // While autoplay is running the scroll is driven programmatically. Only a
      // real user scroll (position drifting away from the driven head) takes back.
      if (autoplay) {
        if (Math.abs(real - currentP) > 0.02) autoplay = false;
        else return;
      }
      targetP = real;
      // Soft lock at the labelled-face pin position until the user clicks it.
      // A forced scrollTo on every scroll event fights the finger gesture on
      // mobile and visibly freezes the page; nudging back at most every 100ms
      // with native smooth scrolling removes that block while still holding
      // the labelled faces on screen.
      if (!allClickedRef.current && labelPinPRef.current !== null) {
        const pinP = labelPinPRef.current;
        if (targetP > pinP) {
          const nowMs = Date.now();
          if (nowMs - lastPinFix > 100) {
            lastPinFix = nowMs;
            el.scrollTo({ top: pinP * sb, behavior: "smooth" });
          }
          targetP = pinP;
        }
      }
    };

    const tick = (now) => {
      const dt = lastTickTime > 0
        ? Math.min(Math.max(now - lastTickTime, 0), MAX_FRAME_DT)
        : 16.67;
      lastTickTime = now;
      const diff = targetP - currentP;
      if (skipRef.current) {
        // Capture the start position once, on the first skip frame.
        if (!skipActiveRef.current) {
          skipActiveRef.current = true;
          autoplayElapsed = 0;
          skipFrom = currentP;
          skipLate = currentP >= SPIN_START;
          skipStartRef.current = skipLate
            ? currentP
            : Math.min(SPIN_START, Math.max(INTRO_END, currentP));
          // During the whole sweep the cube stays blank: the media stay folded
          // away (scale 0), only the labels show up as each face turns frontally.
          for (let i = 0; i < 6; i++) {
            const cached = faceCache[i];
            if (!cached?.wrapper) continue;
            cached.wrapper.style.transition = "none";
            cached.wrapper.style.transform = "scale(0)";
            cached.wrapper.style.opacity = "1";
          }
          // Labels are handed over to the gallery: none at the very start, only
          // the frontally exposed face once the morph is over.
          for (let i = 0; i < 6; i++) {
            const label = clickLabelRefs.current[i];
            if (label) label.style.opacity = "0";
          }
          skipFoldRef.current = true;
          skipFacesHiddenRef.current = true;
          gallerySetup(skipStartRef.current);
        }
        autoplayElapsed += dt;
        const start = skipStartRef.current;
        if (skipLate) {
          skipFoldRef.current = false;
          skipFacesHiddenRef.current = true;
          currentP = skipFrom + (1 - skipFrom) * smoothstep(autoplayElapsed / SKIP_FINALE_MS);
        } else if (autoplayElapsed < SKIP_MORPH_MS) {
          // Morphing first: glide from the current position up to the cube pose
          // while the faces unfold, so the sweep is never a visual jump.
          if (galleryLabelRef.current) galleryLabelRef.current.style.opacity = "0";
          currentP = skipFrom + (start - skipFrom) * smoothstep(autoplayElapsed / SKIP_MORPH_MS);
        } else if (autoplayElapsed < SKIP_MORPH_MS + galleryDur) {
          // Gallery: settle on each face so it stares frontally one second,
          // only its label visible, with a short spin between two exposures.
          const galT = autoplayElapsed - SKIP_MORPH_MS;
          const startRot = (start - INTRO_END) / CUBE_RANGE;
          const lead = startRot < galleryRot[0] - 1e-9 ? SKIP_LEAD_MS : 0;
          const SEG = SKIP_HOLD_MS + SKIP_TURN_MS;
          let galP;
          let labelIdx = -1;
          if (galT < lead) {
            galP = startRot + (galleryRot[0] - startRot) * smoothstep(galT / lead);
          } else {
            const t = galT - lead;
            const j = Math.min(galleryRot.length - 1, Math.floor(t / SEG));
            const loc = t - j * SEG;
            if (loc < SKIP_HOLD_MS) {
              galP = galleryRot[j];
              // The label fades in only once the cube has fully settled, and
              // fades out again before the next turn so it never stays visible
              // while the cube rotates (which reads as the text shrinking).
              const labelOn = loc >= SKIP_LABEL_DELAY_MS && loc < SKIP_HOLD_MS - SKIP_LABEL_EXIT_MS;
              labelIdx = labelOn ? Math.round(galleryRot[j] * 12) % 6 : -1;
            } else if (j < galleryRot.length - 1) {
              const tt = smoothstep(Math.min(1, (loc - SKIP_HOLD_MS) / SKIP_TURN_MS));
              galP = galleryRot[j] + (galleryRot[j + 1] - galleryRot[j]) * tt;
              labelIdx = -1;
            } else {
              galP = galleryRot[j];
            }
          }
          if (labelIdx >= 0 && !skipRevealedFacesRef.current[labelIdx]) {
            const next = [...skipRevealedFacesRef.current];
            next[labelIdx] = true;
            skipRevealedFacesRef.current = next;
            setSkipRevealedFaces(next);
          }
          currentP = INTRO_END + galP * CUBE_RANGE;
          // During the sweep the labels never live inside the 3D faces: a GPU
          // re-raster of a face right after a turn would re-size the text. They
          // are instead drawn by a stable 2D overlay aligned on the cube center.
          const galleryLabel = galleryLabelRef.current;
          if (galleryLabel) {
            galleryLabel.textContent = labelIdx >= 0 ? FACE_LABELS[labelIdx] : "";
            galleryLabel.style.opacity = labelIdx >= 0 ? "1" : "0";
          }
          for (let i = 0; i < 6; i++) {
            const label = clickLabelRefs.current[i];
            if (label) label.style.opacity = "0";
          }
        } else if (autoplayElapsed < SKIP_MORPH_MS + galleryDur + SKIP_GAP_MS) {
          // Fold every face away again while the playhead eases up to the spin.
          // skipFoldRef stays true so the render loop lets the transition play.
          for (let i = 0; i < 6; i++) {
            const cached = faceCache[i];
            if (!cached?.wrapper) continue;
            if (cached.wrapper.style.transform !== "scale(0)") {
              cached.wrapper.style.transform = "scale(0)";
            }
          }
          for (let i = 0; i < 6; i++) {
            if (clickLabelRefs.current[i]) clickLabelRefs.current[i].style.opacity = "0";
          }
          if (galleryLabelRef.current) galleryLabelRef.current.style.opacity = "0";
          const gapK = smoothstep((autoplayElapsed - SKIP_MORPH_MS - galleryDur) / SKIP_GAP_MS);
          const galEnd = galleryRot.length > 0
            ? INTRO_END + galleryRot[galleryRot.length - 1] * CUBE_RANGE
            : start;
          currentP = galEnd + (SPIN_START - galEnd) * gapK;
        } else {
          // Finale (spin, line, name) at its own steady pace on the blank cube.
          skipFacesHiddenRef.current = true;
          skipFoldRef.current = false;
          currentP = SPIN_START + (1 - SPIN_START) * Math.min(1, (autoplayElapsed - SKIP_MORPH_MS - galleryDur - SKIP_GAP_MS) / SKIP_FINALE_MS);
        }
        const sbNow = el.scrollHeight - el.offsetHeight;
        if (sbNow > 0) el.scrollTop = currentP * sbNow;
        const skipDuration = skipLate
          ? SKIP_FINALE_MS
          : SKIP_MORPH_MS + galleryDur + SKIP_GAP_MS + SKIP_FINALE_MS;
        if (autoplayElapsed >= skipDuration) {
          currentP = 1;
          targetP = 1;
          autoplayElapsed = 0;
          skipRef.current = false;
          skipActiveRef.current = false;
          skipLate = false;
          skipFoldRef.current = false;
          skipFacesHiddenRef.current = false;
          galleryRot = [];
          galleryDur = 0;
        }
        rafId = requestAnimationFrame(tick);
      } else if (autoplay) {
        // Steady, frame-rate independent progression through the end sequence.
        autoplayElapsed += dt;
        currentP = CUBE_END + (autoplayElapsed / AUTOPLAY_MS) * (1 - CUBE_END);
        if (autoplayElapsed >= AUTOPLAY_MS) {
          autoplay = false;
          currentP = Math.min(1, currentP);
        }
        targetP = currentP;
        let sbNow = el.scrollHeight - el.offsetHeight;
        if (sbNow > 0) el.scrollTop = currentP * sbNow;
        rafId = requestAnimationFrame(tick);
      } else if (Math.abs(diff) < 0.0005) {
        currentP = targetP;
        lastTickTime = 0;
        rafId = null;
      } else {
        const follow = 1 - Math.exp(-dt / SCROLL_SMOOTHING_MS);
        currentP += diff * follow;
        rafId = requestAnimationFrame(tick);
      }
      const unlocked = allClickedRef.current;
      // On the first frame after all faces are clicked, reset currentP to CUBE_END
      // so the exit animation plays forward from there instead of jumping ahead.
      if (unlocked && !wasUnlockedRef.current) {
        wasUnlockedRef.current = true;
        exitOrderRef.current = [...clickStackRef.current].reverse();
        if (currentP > CUBE_END) {
          currentP = CUBE_END;
          targetP = CUBE_END;
          autoplay = true;
          autoplayElapsed = 0;
          if (!rafId) rafId = requestAnimationFrame(tick);
        }
      }
      const p = currentP;

      // Single timeline playhead. While faces are still locked the playhead
      // stops at the end of the idle phase; once every face has been clicked
      // the whole end sequence is driven by the scroll position, so it plays
      // forward and backward and can never be skipped.
      const tlP = unlocked ? p : Math.min(p, CUBE_END);
      tl.seek(tlP * TOTAL);
      facesVisibleRef.current = tlP < SPIN_START;
      cubeDraggableRef.current = tlP > INTRO_END && tlP < SPIN_START;

      // Show/hide the cube only while the square is gone. The cube's own
      // opacity is driven by the timeline (complementary to the square fade).
      if (contentEl) {
        contentEl.style.pointerEvents = tlP > INTRO_END - W.fadeIn / TOTAL ? "auto" : "none";
      }

      const cubeP = Math.max(0, (p - INTRO_END) / CUBE_RANGE);
      const baseP = unlocked ? Math.min(cubeP, ROT_END) : cubeP;
      let rot = getCubeRotation(baseP);
      let spinning = false;
      if (unlocked && tlP > SPIN_START) {
        if (spinFromRef.current === null) {
          spinFromRef.current = getCubeRotation(baseP);
        }
        const from = spinFromRef.current;
        const k = Math.min(1, (tlP - SPIN_START) / (SPIN_END - SPIN_START));
        const easeIO = (t) => t * t * (3 - 2 * t);
        const seg = (start, end) => easeIO(Math.min(1, Math.max(0, (k - start) / (end - start))));
        const ryTurn = seg(0, 0.2) * 180 + seg(0.4, 0.6) * 180;
        const rxTurn = seg(0.2, 0.4) * 180 + seg(0.6, 0.8) * 180;
        const ryMid = from.ry + ryTurn;
        const rxMid = from.rx + rxTurn;
        const ryMod = ((ryMid % 360) + 360) % 360;
        const rxMod = ((rxMid % 360) + 360) % 360;
        const ry = ryMid + ((360 - ryMod) % 360) * seg(0.8, 1);
        const rx = rxMid - rxMod * seg(0.8, 1);
        rot = { rx, ry };
        spinning = true;
      } else {
        spinFromRef.current = null;
      }
      spinningRef.current = spinning;
      // The direct drag adds a fixed offset over the scroll-driven orientation.
      // From the end-sequence spin onward the offset fades out so the cube
      // returns to its aligned ("square") rest pose before the names appear.
      let dragRx = dragOffsetRef.current.rx;
      let dragRy = dragOffsetRef.current.ry;
      if (tlP > SPIN_START) {
        const kSpin = Math.min(1, Math.max(0, (tlP - SPIN_START) / (SPIN_END - SPIN_START)));
        const fade = 1 - kSpin * kSpin * (3 - 2 * kSpin);
        dragRx *= fade;
        dragRy *= fade;
      }
      rot = {
        rx: rot.rx + dragRx,
        ry: rot.ry + dragRy,
      };
      cube.style.transform = `translateZ(0) rotateX(${rot.rx}deg) rotateY(${rot.ry}deg)`;
      currentPRef.current = baseP;
      // Only recompute wireframe geometry when rotation changes by a visible amount.
      if (
        Math.abs(rot.rx - lastWireRotRef.current.rx) > 0.05 ||
        Math.abs(rot.ry - lastWireRotRef.current.ry) > 0.05
      ) {
        lastWireRotRef.current = { rx: rot.rx, ry: rot.ry };
        const { path: pathData } = computeWireframe(rot.rx, rot.ry, zoomedFaceRef.current);
        if (wireRef.current) {
          if (!wirePathRef.current) {
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute("fill", "none");
            p.setAttribute("stroke", "#00a5b0");
            p.setAttribute("stroke-width", "2");
            p.setAttribute("vector-effect", "non-scaling-stroke");
            wireRef.current.appendChild(p);
            wirePathRef.current = p;
          }
          wirePathRef.current.setAttribute("d", pathData);
        }
      }
      // 2nd exposure => reveal the label (click affordance). Once every face has
      // been clicked the labels stay hidden. Frozen during the auto sweep: there
      // the labels are driven solely by the gallery, otherwise they would light
      // up mid-rotation (perspective-stretched) and then snap to frontal size.
      if (!skipActiveRef.current) {
      for (let i = 0; i < 6; i++) {
        const nowVisible = isFaceVisible(
          FACE_NORMALS[i][0],
          FACE_NORMALS[i][1],
          FACE_NORMALS[i][2],
          rot.rx,
          rot.ry,
        );
        if (nowVisible && !faceWasVisibleRef.current[i]) {
          faceVisibilityCountRef.current[i]++;
          if (faceVisibilityCountRef.current[i] === 2 && !zoomedFacesRef.current[i]) {
            if (clickLabelRefs.current[i]) {
              clickLabelRefs.current[i].style.opacity = "1";
            }
          }
        }
        faceWasVisibleRef.current[i] = nowVisible;
      }
      }
      // After ALL faces have been seen twice, snap to the next face-forward step boundary.
      if (!allSeenTwiceRef.current && faceVisibilityCountRef.current.every(c => c >= 2)) {
        allSeenTwiceRef.current = true;
        const cubeP = Math.max(0, (currentP - INTRO_END) / CUBE_RANGE);
        const snapBaseP = Math.min(1, Math.ceil(cubeP * 12) / 12);
        labelPinPRef.current = INTRO_END + snapBaseP * CUBE_RANGE;
      }
      // Release the pin once every labeled face has been clicked.
      if (labelPinPRef.current !== null && !FACE_NORMALS.some((_, i) =>
        faceVisibilityCountRef.current[i] >= 2 && !zoomedFacesRef.current[i]
      )) {
        labelPinPRef.current = null;
      }
      if (spinning) {
        if (!bgResetRef.current) {
          bgResetRef.current = true;
          resetBackground();
        }
      } else if (tlP < INTRO_END) {
        if (!bgResetRef.current) {
          bgResetRef.current = true;
          resetBackground();
        }
      } else if (bgResetRef.current) {
        bgResetRef.current = false;
        const last = clickStackRef.current[clickStackRef.current.length - 1];
        if (typeof last === "number") changeBackground(last);
      }
      // Per-face lighting: rotate face normal by current cube rotation
      if (cubeRef.current) {
        // Between CUBE_END and SPIN_START the six visuals take their leave one
        // by one (reverse click order): each folds away (squash, slight rise,
        // fade) instead of being cut off at the spin. Fully reversible.
        const exitK = unlocked ? Math.min(1, Math.max(0, (tlP - CUBE_END) / (SPIN_START - CUBE_END))) : 0;
        for (let i = 0; i < 6; i++) {
          const cached = faceCache[i];
          if (!cached) continue;
          const { el: faceEl, media, wrapper } = cached;
          const n = FACE_NORMALS[i];
          const [rxn, ryn, rzn] = rotateVecByXY(n[0], n[1], n[2], rot.rx, rot.ry);
          const dot = Math.max(0, rxn * LIGHT_DIR[0] + ryn * LIGHT_DIR[1] + rzn * LIGHT_DIR[2]);
          const brightness = 0.35 + 1.3 * dot;
          // During the sweep the media stay folded away, but the lighting keeps
          // tracking the cube rotation: the frontally exposed face always reads
          // fully lit, the others fall off naturally.
          if (skipFoldRef.current) {
            faceEl.style.filter = `brightness(${brightness})`;
            continue;
          }
          if (spinning || skipFacesHiddenRef.current) {
            if (media) media.style.filter = "";
            if (wrapper) {
              wrapper.style.transition = "none";
              wrapper.style.opacity = "1";
              wrapper.style.transform = "scale(0)";
            }
            faceEl.style.filter = `brightness(${brightness})`;
          } else if (exitK > 0) {
            const pos = exitOrderRef.current ? exitOrderRef.current.indexOf(i) : 5;
            const kRaw = Math.min(1, Math.max(0, (exitK - (pos / 6) * 0.7) / 0.3));
            const k = smoothstep(kRaw);
            const s = Math.max(0.15, 1 - 0.85 * smoothstep(Math.min(1, k * 2)));
            const y = -26 * smoothstep(Math.min(1, k * 1.6));
            const o = 1 - smoothstep(Math.min(1, Math.max(0, (k - 0.4) / 0.6)));
            if (media) media.style.filter = `brightness(${brightness})`;
            if (faceEl.style.filter) faceEl.style.filter = "";
            if (wrapper) {
              wrapper.style.transition = "none";
              wrapper.style.opacity = String(o);
              wrapper.style.transform = `translateY(${y}px) scale(${s})`;
            }
          } else if (zoomedFacesRef.current[i]) {
            if (media) media.style.filter = `brightness(${brightness})`;
            if (faceEl.style.filter) faceEl.style.filter = "";
            if (wrapper) {
              wrapper.style.transition = "transform 0.6s ease";
              wrapper.style.opacity = "1";
              wrapper.style.transform = "scale(1)";
            }
          } else {
            if (media) media.style.filter = "";
            faceEl.style.filter = `brightness(${brightness})`;
            if (wrapper) {
              wrapper.style.transition = "transform 0.6s ease";
              wrapper.style.opacity = "1";
              wrapper.style.transform = "scale(0)";
            }
          }
        }
      }
      const lineK = Math.min(1, Math.max(0, (tlP - LINE_POS / TOTAL) / (W.lineMorph / TOTAL)));
      const le = lineK * lineK * (3 - 2 * lineK);
      body.style.transform = `scale(1, ${Math.max(0.0001, 1 - le)})`;
      if (tlP > NAMES_START) {
        const k = Math.min(1, (tlP - NAMES_START) / (NAMES_END - NAMES_START));
        const e = k * k * (3 - 2 * k);
        names.style.transform = `translateY(${(1 - e) * 70}px)`;
        sub.style.transform = `translateY(${(e - 1) * 70}px)`;
      } else {
        names.style.transform = "translateY(70px)";
        sub.style.transform = "translateY(-70px)";
      }
      // Reveal the contact tab once names appear (one-shot, persists on scroll back).
      if (!contactTabRevealedRef.current && tlP >= NAMES_START && allClickedRef.current) {
        contactTabRevealedRef.current = true;
        setContactDone(true);
      }
    };

    tickRef.current = tick;

    const onScroll = () => {
      sync();
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    if (restoreP !== null) {
      el.scrollTop = restoreP * (el.scrollHeight - el.offsetHeight);
    }
    sync();
    rafId = requestAnimationFrame(tick);

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [faceImages, changeBackground]);

  // Direct cube rotation: pointer drag layers an offset over the scroll-driven
  // rotation. A real drag also suppresses the click that browsers fire afterward.
  useEffect(() => {
    const zone = clickZoneRef.current;
    if (!zone) return;

    let suppressTimer = null;
    let dragRafQueued = false;
    let pendingRafId = null;

    const queueDragRender = () => {
      if (dragRafQueued) return;
      dragRafQueued = true;
      pendingRafId = requestAnimationFrame(() => {
        dragRafQueued = false;
        pendingRafId = null;
        if (typeof tickRef.current === "function") tickRef.current();
      });
    };

    const onPointerDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (dragStateRef.current) return;
      if (!cubeDraggableRef.current) return;
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        pointerType: e.pointerType || "mouse",
        moved: false,
      };
      zone.style.cursor = "grabbing";
    };

    const onPointerMove = (e) => {
      const st = dragStateRef.current;
      if (!st) return;
      if (spinningRef.current || !cubeDraggableRef.current) return;
      const prevX = st.lastX;
      const prevY = st.lastY;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      const distX = e.clientX - st.startX;
      const distY = e.clientY - st.startY;
      // On touch a vertical sweep is the page scroll itself, not a cube drag:
      // leave it untouched (no rotation, no click suppression) so a tap that
      // drifts a finger vertically is never swallowed. Only a clearly
      // horizontal sweep rotates the cube.
      if (st.pointerType === "touch" && Math.abs(distY) > Math.abs(distX)) return;
      // Touch gets a larger threshold: a finger drifts while tapping, and a
      // tap that drifted beyond a small threshold used to be counted as a
      // drag, killing the click and forcing the user to try again.
      const threshold = st.pointerType === "touch" ? 18 : 8;
      if (!st.moved && Math.hypot(distX, distY) > threshold) {
        st.moved = true;
        tapPointRef.current = null;
      }
      if (!st.moved) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      dragOffsetRef.current.ry += -dx * 0.5;
      if (st.pointerType !== "touch") {
        dragOffsetRef.current.rx += dy * 0.3;
      }
      queueDragRender();
    };

    const endDrag = (e) => {
      const st = dragStateRef.current;
      if (!st) return;
      if (st.moved) {
        suppressClickRef.current = true;
        tapPointRef.current = null;
        if (suppressTimer) clearTimeout(suppressTimer);
        suppressTimer = setTimeout(() => {
          suppressClickRef.current = false;
        }, 400);
      } else if (e.type !== "pointercancel") {
        // Genuine tap (no real displacement): resolve the face hit right here
        // instead of trusting the synthesized click, which some mobile
        // browsers swallow after a slight drift. The native click that does
        // follow pointerup is dismissed by handleCubeClick via tapPointRef.
        const drift = Math.hypot(e.clientX - st.startX, e.clientY - st.startY);
        if (drift <= 12) {
          const rect = clickZoneRef.current?.getBoundingClientRect();
          if (
            rect &&
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            tapPointRef.current = { x: e.clientX, y: e.clientY, at: Date.now() };
            hitTestAndOpen(e.clientX, e.clientY, rect);
          }
        }
      }
      dragStateRef.current = null;
      zone.style.cursor = "grab";
    };

    zone.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      if (suppressTimer) clearTimeout(suppressTimer);
      if (pendingRafId) cancelAnimationFrame(pendingRafId);
      zone.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [hitTestAndOpen]);

  const skipIntro = useCallback(() => {
    if (skipRef.current) return;
    skipRef.current = true;
    // Unlock everything: the pin disappears and the timeline head can reach the
    // end of the sequence (names, links and CONTACT reveal) during the sweep.
    allClickedRef.current = true;
    wasUnlockedRef.current = true;
    exitOrderRef.current = [5, 4, 3, 2, 1, 0];
    labelPinPRef.current = null;
    skipActiveRef.current = false;
    const nextSkipFaces = [false, false, false, false, false, false];
    skipRevealedFacesRef.current = nextSkipFaces;
    setSkipRevealedFaces(nextSkipFaces);
    setSkipped(true);
    for (let i = 0; i < 6; i++) {
      if (clickLabelRefs.current[i]) clickLabelRefs.current[i].style.opacity = "0";
    }
    if (galleryLabelRef.current) galleryLabelRef.current.style.opacity = "0";
    if (typeof tickRef.current === "function") tickRef.current();
  }, []);

  const onContactClick = () => {
    setShowContact(true);
    try { window.history.pushState({ ufoContact: true }, "", window.location.href); } catch {}
  };
  const contactBtnStyle = {
    opacity: contactDone ? 1 : 0,
    transform: contactDone ? "translateY(0)" : "translateY(-15px)",
    pointerEvents: contactDone ? "auto" : "none",
    transition: "opacity 0.5s ease 0.6s, transform 0.5s ease 0.6s",
  };

  return (
    <section
      ref={sectionRef}
      className="relative z-10 h-[100svh] overflow-y-auto overflow-x-hidden scroll-none"
      style={{ clipPath: "inset(0)" }}
    >
      <div style={{ height: "700svh" }}>
        <div className="sticky top-0 min-h-[100svh] flex items-center overflow-hidden">
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
        <button
          onClick={() => window.location.reload()}
          className="absolute top-3 left-3 z-30 sm:top-5 sm:left-8 bg-transparent border-0 p-0 cursor-pointer"
          aria-label="Accueil"
        >
          <img
            src={`${BASE}/icon.webp`}
            alt=""
            className="h-12 w-12 sm:h-20 sm:w-20 rounded-2xl object-cover"
          />
        </button>

        <div className="relative z-10 w-full">
          <div ref={scrollIndicatorRef} className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <svg
                width={squareSize}
                height={squareSize}
                viewBox="0 0 300 300"
                style={{ overflow: "visible" }}
              >
                <polygon
                  ref={morphBodyRef}
                  points="135,150 136,144 139,139 144,136 150,135 156,136 161,139 164,144 165,150 165,155 165,160 165,165 165,170 164,176 161,181 156,184 150,185 144,184 139,181 136,176 135,170 135,165 135,160 135,155"
                  fill="#0a0f1c"
                  stroke="#00a5b0"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ transformOrigin: "150px 150px" }}
                />
                <g ref={morphWheelRef}>
                  <line
                    x1="150"
                    y1="146"
                    x2="150"
                    y2="152"
                    stroke="#00a5b0"
                    strokeWidth={4}
                    strokeLinecap="round"
                    className="wheel-anim"
                  />
                </g>
                <defs>
                  <clipPath id="line-clip">
                    <rect x="0" y="0" width="300" height="150" />
                  </clipPath>
                  <clipPath id="line-clip-below">
                    <rect x="0" y="150" width="300" height="150" />
                  </clipPath>
                </defs>
                <g clipPath="url(#line-clip)">
                  <g ref={namesRef} style={{ transform: "translateY(70px)" }}>
                    <text
                      x="150"
                      y="136"
                      textAnchor="middle"
                      textLength="300"
                      lengthAdjust="spacingAndGlyphs"
                      fill="#00a5b0"
                      stroke="none"
                      style={{
                        fontSize: 42,
                        fontWeight: 200,
                        fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
                        userSelect: "none",
                      }}
                    >
                      {title}
                    </text>
                  </g>
                </g>
                <g clipPath="url(#line-clip-below)">
                  <g ref={subtitleRef} style={{ transform: "translateY(-70px)" }}>
                    <text
                      x="150"
                      y="178"
                      textAnchor="middle"
                      textLength="300"
                      lengthAdjust="spacingAndGlyphs"
                      fill="#ffffff"
                      stroke="none"
                      style={{
                        fontSize: 30,
                        fontWeight: 200,
                        fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
                        userSelect: "none",
                      }}
                    >
                      {subtitle}
                    </text>
                  </g>
                </g>
              </svg>
              <div
                ref={scrollHintRef}
                className="absolute left-1/2 -translate-x-1/2 text-sm text-[#00a5b0] tracking-[0.2em] leading-tight text-center whitespace-nowrap uppercase"
                style={{ top: "calc(100% - 78px)" }}
              >
                SCROLL
                <br />
                DOWN
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
          <nav className="absolute top-20 sm:top-6 left-1/2 -translate-x-1/2 z-30 grid grid-cols-[auto_auto] gap-2 px-2 max-w-[88vw] sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 sm:px-4">
            {PROJECT_LINKS.map((link, i) => {
              const shown = zoomedFaces[i] || (skipped && (skipRevealedFaces[i] || contactDone));
              return (
                <button
                  key={link.name}
                  onClick={() => openProject(i)}
                  className="justify-self-center whitespace-nowrap bg-[#0a0f1c] border border-[#00a5b0]/60 text-[#00a5b0] tracking-[0.2em] uppercase rounded-full px-2.5 sm:px-4 py-2 text-[11px] sm:text-xs transition-all duration-500 hover:bg-[#00a5b0]/10 cursor-pointer"
                  style={{
                    opacity: shown ? 1 : 0,
                    transform: shown ? "translateY(0)" : "translateY(-15px)",
                    transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`,
                    pointerEvents: shown ? "auto" : "none",
                  }}
                >
                  {link.name}
                </button>
              );
            })}
            <button
              onClick={onContactClick}
              className="hidden text-center sm:inline-block bg-white text-[#0a0f1c] tracking-[0.2em] uppercase rounded-full px-4 py-2 text-xs sm:ml-6 hover:bg-white/80 transition-colors duration-300 cursor-pointer border-0"
              style={contactBtnStyle}
            >
              CONTACT
            </button>
          </nav>
          <button
            onClick={skipIntro}
            aria-label="Passer l'animation"
            className="absolute bottom-[calc(env(safe-area-inset-bottom)+24px)] right-3 sm:bottom-[calc(env(safe-area-inset-bottom)+32px)] sm:right-8 z-30 bg-[#0a0f1c]/70 text-[#00a5b0] tracking-[0.2em] uppercase rounded-full px-4 py-2 text-[11px] sm:text-xs cursor-pointer transition-opacity duration-500 hover:text-white"
            style={contactDone || skipped ? { opacity: 0, pointerEvents: "none" } : { opacity: 1 }}
          >
            SKIP
          </button>
          <button
            onClick={onContactClick}
            className="sm:hidden absolute bottom-[calc(env(safe-area-inset-bottom)+24px)] left-1/2 -translate-x-1/2 z-30 bg-white text-[#0a0f1c] tracking-[0.2em] uppercase rounded-full px-6 py-2.5 text-sm hover:bg-white/80 transition-colors duration-300 cursor-pointer border-0"
            style={contactBtnStyle}
          >
            CONTACT
          </button>
          <div
            ref={contentRef}
            className="relative mx-auto w-full opacity-0"
          >
            <div className="min-h-[100svh] flex items-center justify-center">
              <div ref={cubeContainerRef} className="relative shrink-0" style={{ width: 300, height: 300, transform: `scale(${cubeScale})`, transformOrigin: "center" }}>
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
                          boxShadow: zoomedFaces[i] ? "0 0 15px rgba(0,0,0,0.3)" : "none",
                          transition: "box-shadow 0.3s ease",
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
                                src={zoomedFaces[i] ? faceImages[i] : undefined}
                                className="w-full h-full object-cover"
                                autoPlay
                                muted
                                loop
                                playsInline
                                preload={zoomedFaces[i] ? "metadata" : "none"}
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
                          ref={(el) => { clickLabelRefs.current[i] = el; }}
                          className="pointer-events-none select-none"
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#33d1c8",
                            fontSize: "1.25rem",
                            letterSpacing: "0.3em",
                            opacity: 0,
                            transition: "opacity 0.35s ease",
                            zIndex: 5,
                          }}
                        >
                          {FACE_LABELS[i]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  ref={galleryLabelRef}
                  data-gallery-label=""
                  className="pointer-events-none select-none"
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#33d1c8",
                    fontSize: "1.43rem",
                    letterSpacing: "0.3em",
                    opacity: 0,
                    transition: "opacity 0.35s ease",
                    zIndex: 25,
                    textShadow: "0 0 14px rgba(51,209,200,0.5)",
                    willChange: "opacity",
                  }}
                />
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
                  ref={clickZoneRef}
                  onClick={handleCubeClick}
                  className="absolute cursor-grab"
                  style={{ zIndex: 10, background: "transparent", top: -60, left: -60, right: -60, bottom: -60, userSelect: "none", touchAction: "manipulation", WebkitUserSelect: "none" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {showContact && (
        <ContactOverlay
          onClose={() => {
            if (typeof window !== "undefined" && window.history?.state?.ufoContact) {
              window.history.back();
            } else {
              setShowContact(false);
            }
          }}
        />
      )}

      {selectedProject !== null && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: "#0a0f1c" }}>
          <div className="mx-auto max-w-4xl px-6 py-24">
            {renderProjectContent(selectedProject, { onContact: onContactClick })}
            <div className="text-center mt-20">
              <button
                onClick={() => {
                  if (typeof window !== "undefined" && window.history && window.history.state && typeof window.history.state.ufoProject === "number") {
                    window.history.back();
                  } else {
                    setSelectedProject(null);
                    if (typeof window !== "undefined") {
                      try {
                        const url = new URL(window.location.href);
                        url.searchParams.delete("project");
                        window.history.replaceState(null, "", url.pathname + url.search);
                      } catch {}
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

export default HeroCube;
