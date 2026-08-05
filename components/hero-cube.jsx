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
  `${BASE}/web.mp4`,
  `${BASE}/react.jpg`,
  `${BASE}/backend.mp4`,
  `${BASE}/database.jpg`,
  `${BASE}/mobile.mp4`,
  `${BASE}/projets.png`,
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
  const [selectedProject, setSelectedProject] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const contactTabRef = useRef(null);
  const contactTabRevealedRef = useRef(false);
  const morphBodyRef = useRef(null);
  const morphWheelRef = useRef(null);
  const scrollIndicatorRef = useRef(null);
  const scrollHintRef = useRef(null);
  const zoomedFacesRef = useRef(zoomedFaces);
  const zoomedFaceRef = useRef(-1);
  const currentPRef = useRef(0);
  const overlayRef = useRef(null);
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
  // Set to true once every face has completed its 2nd exposure.
  const allSeenTwiceRef = useRef(false);

  zoomedFacesRef.current = zoomedFaces;
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
      } catch (e) {
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

  const handleCubeClick = useCallback((e) => {
    const rot = getCubeRotation(currentPRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = findClickedFace(
      e.clientX,
      e.clientY,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      rot.rx,
      rot.ry,
    );
    if (idx >= 0 && faceImages[idx] && facesVisibleRef.current) {
      const labelShown = faceVisibilityCountRef.current[idx] >= 2;
      const mediaShown = zoomedFacesRef.current[idx];
      if (labelShown || mediaShown) handleFaceClick(idx);
    }
  }, [handleFaceClick, faceImages]);

  const openProject = useCallback((i) => {
    setSelectedProject(i);
    if (typeof window !== "undefined") {
      try {
        const state = { ufoProject: i };
        const url = new URL(window.location.href);
        url.searchParams.set("project", String(i + 1));
        window.history.pushState(state, "", url.pathname + url.search);
      } catch (e) {}
    }
  }, []);

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

    const body = morphBodyRef.current;
    const wheel = morphWheelRef.current;
    const hint = scrollHintRef.current;
    const names = namesRef.current;
    const sub = subtitleRef.current;
    const cubeContainer = cubeContainerRef.current;
    const contentEl = contentRef.current;
    const bg = bgRef.current;
    if (!body || !wheel || !hint || !names || !sub || !cubeContainer || !contentEl || !bg) return;

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
    const WHEEL_POINTS =
      "135,150 136,144 139,139 144,136 150,135 156,136 161,139 164,144 165,150 165,155 165,160 165,165 165,170 164,176 161,181 156,184 150,185 144,184 139,181 136,176 135,170 135,165 135,160 135,155";
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
    let isPinning = false;
    let lastTickTime = 0;
    // Once the intro wheel/hint fade completes, this prevents them from reappearing.
    let introCompleted = false;

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
      const rect = el.getBoundingClientRect();
      const sb = el.offsetHeight - window.innerHeight;
      targetP = sb > 0 ? Math.min(1, Math.max(0, -rect.top / sb)) : 0;
      // Block scroll at the labeled-face pin position until the user clicks it.
      if (!allClickedRef.current && labelPinPRef.current !== null && !isPinning) {
        const pinP = labelPinPRef.current;
        if (targetP > pinP) {
          isPinning = true;
          window.scrollTo(0, pinP * sb);
          requestAnimationFrame(() => { isPinning = false; });
          targetP = pinP;
        }
      }
    };

    const tick = (now) => {
      const dt = lastTickTime > 0 ? Math.min(now - lastTickTime, 100) : 16.67;
      lastTickTime = now;
      const diff = targetP - currentP;
      if (Math.abs(diff) < 0.0005) {
        currentP = targetP;
        lastTickTime = 0;
        rafId = null;
      } else {
        // Frame-rate independent: same perceived speed at 30, 60, or 120 fps.
        currentP += diff * (1 - Math.pow(0.85, dt / 16.67));
        rafId = requestAnimationFrame(tick);
      }
      const unlocked = allClickedRef.current;
      // On the first frame after all faces are clicked, reset currentP to CUBE_END
      // so the exit animation plays forward from there instead of jumping ahead.
      if (unlocked && !wasUnlockedRef.current) {
        wasUnlockedRef.current = true;
        if (currentP > CUBE_END) {
          currentP = CUBE_END;
          if (!rafId) rafId = requestAnimationFrame(tick);
        }
      }
      const p = currentP;

      // Single timeline playhead. While faces are still locked the playhead
      // stops at the end of the idle phase; once every face has been clicked
      // the whole end sequence is driven by the scroll position, so it plays
      // forward and backward and can never be skipped.
      const tlP = unlocked ? p : Math.min(p, CUBE_END);
      // Clamp seek to INTRO_END once the intro has played: polygon gone, cube visible.
      const introEndMs = W.wheelFade + W.morph + W.fadeIn;
      const seekMs = tlP * TOTAL;
      tl.seek(introCompleted ? Math.max(introEndMs, seekMs) : seekMs);
      if (seekMs >= introEndMs) introCompleted = true;
      facesVisibleRef.current = tlP < SPIN_START;

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
      // been clicked the labels stay hidden.
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
      } else if (!introCompleted && tlP < INTRO_END) {
        // Only reset background during the initial intro, not when scrolling back later.
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
        for (let i = 0; i < 6; i++) {
          const cached = faceCache[i];
          if (!cached) continue;
          const { el: faceEl, media, wrapper } = cached;
          const n = FACE_NORMALS[i];
          const [rxn, ryn, rzn] = rotateVecByXY(n[0], n[1], n[2], rot.rx, rot.ry);
          const dot = Math.max(0, rxn * LIGHT_DIR[0] + ryn * LIGHT_DIR[1] + rzn * LIGHT_DIR[2]);
          const brightness = 0.35 + 1.3 * dot;
          if (spinning) {
            if (media) media.style.filter = "";
            if (wrapper) wrapper.style.transform = "scale(0)";
            faceEl.style.filter = `brightness(${brightness})`;
          } else if (zoomedFacesRef.current[i]) {
            if (media) media.style.filter = `brightness(${brightness})`;
            if (faceEl.style.filter) faceEl.style.filter = "";
            if (wrapper) wrapper.style.transform = "scale(1)";
          } else {
            if (media) media.style.filter = "";
            faceEl.style.filter = `brightness(${brightness})`;
            if (wrapper) wrapper.style.transform = "scale(0)";
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
        if (contactTabRef.current) {
          contactTabRef.current.style.opacity = "1";
          contactTabRef.current.style.transform = "translateY(0)";
          contactTabRef.current.style.pointerEvents = "auto";
        }
      }
    };

    tickRef.current = tick;

    const onScroll = () => {
      sync();
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    if (restoreP !== null) {
      window.scrollTo(0, restoreP * (el.offsetHeight - window.innerHeight));
    }
    sync();
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [faceImages]);

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
        <button
          onClick={() => window.location.reload()}
          className="absolute top-5 left-5 z-30 sm:left-8 bg-transparent border-0 p-0 cursor-pointer"
          aria-label="Accueil"
        >
          <img
            src={`${BASE}/icon.png`}
            alt=""
            className="h-20 w-20 rounded-2xl object-cover"
          />
        </button>

        <div className="relative z-10 w-full">
          <div ref={scrollIndicatorRef} className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <svg width={343} height={343} viewBox="0 0 300 300" style={{ overflow: "visible" }}>
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
                      Philippe Barbosa
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
                      Concepteur Développeur
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
                <br />
                <span style={{ fontSize: "3em", lineHeight: "1", display: "block" }}>↓</span>
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
          <nav className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex flex-nowrap items-center justify-center gap-2 sm:gap-3 px-4">
            {PROJECT_LINKS.map((link, i) => (
              <button
                key={link.name}
                onClick={() => openProject(i)}
                className="bg-[#0a0f1c] border border-[#00a5b0]/60 text-[#00a5b0] tracking-[0.2em] uppercase rounded-full px-4 py-2 text-xs sm:text-sm transition-all duration-500 hover:bg-[#00a5b0]/10 cursor-pointer"
                style={{
                  opacity: zoomedFaces[i] ? 1 : 0,
                  transform: zoomedFaces[i] ? "translateY(0)" : "translateY(-15px)",
                  transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`,
                  pointerEvents: zoomedFaces[i] ? "auto" : "none",
                }}
              >
                {link.name}
              </button>
            ))}
            <button
              ref={contactTabRef}
              onClick={() => {
                setShowContact(true);
                try { window.history.pushState({ ufoContact: true }, "", window.location.href); } catch (e) {}
              }}
              className="bg-white text-[#0a0f1c] tracking-[0.2em] uppercase rounded-full px-4 py-2 text-xs sm:text-sm hover:bg-white/80 transition-colors duration-300 cursor-pointer border-0 ml-4 sm:ml-6"
              style={{
                opacity: 0,
                transform: "translateY(-15px)",
                pointerEvents: "none",
                transition: "opacity 0.5s ease 0.6s, transform 0.5s ease 0.6s",
              }}
            >
              CONTACT
            </button>
          </nav>
          <div
            ref={contentRef}
            className="relative mx-auto w-full opacity-0"
          >
            <div className="min-h-screen flex items-center justify-center">
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
                          ref={(el) => { clickLabelRefs.current[i] = el; }}
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
                        >
                          {FACE_LABELS[i]}
                        </div>
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
                  ref={clickZoneRef}
                  onClick={handleCubeClick}
                  className="absolute cursor-pointer"
                  style={{ zIndex: 10, background: "transparent", top: -60, left: -60, right: -60, bottom: -60 }}
                />
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
            {renderProjectContent(selectedProject)}
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

export default HeroCube;
