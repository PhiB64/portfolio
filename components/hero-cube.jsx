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
import { scrambleLabel, stopScramble } from "../lib/scramble";

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

const WEB_SCROLL_SMOOTHING_MS = 80;
const WEB_REVERSE_SCROLL_SMOOTHING_MS = 120;
const MOBILE_SCROLL_SMOOTHING_MS = 60;
const MOBILE_REVERSE_SCROLL_SMOOTHING_MS = 100;
const MAX_FRAME_DT = 100;
const SNAP_THRESHOLD = 0.0005;
// Exposition continue requise avant qu'un label de face passe du brouillage au
// texte lisible. Cumulée par `dt` (ms), donc à augmenter pour un délai plus long.
const LABEL_DECODE_DELAY_MS = 500;
// Nombre d'expositions avant qu'un label de face apparaisse et se mette à
// brouiller. Constante partagée car trois sites en dépendent (affichage du
// label, clic sur la face, levée du pin) et doivent rester alignés.
// 2 = le cube fait d'abord une révolution complète « vide », face après face, sans
// aucun label ; les labels encodés n'apparaissent qu'au second tour, quand chaque
// face revient. 1 les ferait surgir dès la première vue. Le seuil 2 est le même
// que celui de `allSeenTwiceRef`, qui marque la fin de l'intro : labels et fin
// d'intro tombent donc au même moment, par construction.
const FACE_LABEL_REVEAL_COUNT = 2;
// Chorégraphie du skip (balayage automatique des faces). Le label y rejoue le
// même cycle codé -> décodé que les labels de face, mais calé sur le temps du
// hold (1,5 s par face) et non sur le temps d'exposition : c'est la boucle rAF
// qui tient la cadence, donc pas d'accumulateur ici, contrairement aux faces.
// Les quatre constantes découpent un hold.
const SKIP_HOLD_MS = 1500;
// Fondu d'apparition : le cube doit avoir fini de se poser avant que le texte
// se montre, sinon il apparaît pendant la rotation.
const SKIP_LABEL_DELAY_MS = 100;
// Phase « codée » : le label reste en brouillage continu, jamais résolu, avant de
// partir en décodage. C'est l'état que le skip doit rendre lisible.
const SKIP_LABEL_CIPHER_MS = 450;
// Décodage : le brouillage se résout de gauche à droite sur cette durée.
const SKIP_LABEL_DECODE_MS = 550;
// Fondu de sortie avant la rotation suivante : sans lui le texte se rétrécit en
// perspective pendant le tour, ce qui se lit comme un redimensionnement.
const SKIP_LABEL_EXIT_MS = 200;
const MOBILE_USER_AGENT = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const MOBILE_CUBE_MAX_SCALE = 0.8;

const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent || "";
  const mobileUserAgent = MOBILE_USER_AGENT.test(userAgent) || window.navigator.userAgentData?.mobile === true;
  const touchDevice = window.navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches === true;
  const compactViewport = Math.max(window.innerWidth, window.innerHeight) <= 1100;
  return mobileUserAgent || ((touchDevice || coarsePointer) && compactViewport);
};

// Strict mobile check, reserved for the orientation lock: real mobile UA
// only. The looser `isMobileDevice()` (touch + compact viewport) also
// matches touch laptops and narrow desktop windows, which produced
// false-positive "rotate your device" locks on non-mobile screens.
const isRealMobileDevice = () => {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent || "";
  return MOBILE_USER_AGENT.test(userAgent) || window.navigator.userAgentData?.mobile === true;
};

const sonarGeometry = (root, pointEl) => {
  const rect = root.getBoundingClientRect();
  if (!pointEl) {
    const hw = rect.width / 2;
    const hh = rect.height / 2;
    const half = Math.sqrt(hw * hw + hh * hh) / rect.width;
    return { maxR: half * 100, scaleMax: half * 2 };
  }
  const c = pointEl.getBoundingClientRect();
  const cx = c.left + c.width / 2 - rect.left;
  const cy = c.top + c.height / 2 - rect.top;
  const d = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(rect.width - cx, cy),
    Math.hypot(cx, rect.height - cy),
    Math.hypot(rect.width - cx, rect.height - cy),
  );
  return {
    center: { x: Math.round(cx), y: Math.round(cy), dmax: Math.round(d) },
  };
};

export function HeroCube({ title, subtitle, images = [] }) {
  const sectionRef = useRef(null);
  const cubeRef = useRef(null);
  const wireRef = useRef(null);
  const bgRef = useRef(null);
  const videoBgRef = useRef(null);
  const videoBgContainerRef = useRef(null);
  // Sonar en cours sur le fond plein écran (un seul à la fois) : { mask, ring,
  // anime }.
  const bgSonarRef = useRef(null);
  // Sonar en cours sur chaque face (un seul à la fois par face).
  const faceSonarRef = useRef({});
  const [zoomedFace, setZoomedFace] = useState(-1);
  const [zoomedFaces, setZoomedFaces] = useState([false, false, false, false, false, false]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [contactDone, setContactDone] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [cubeScale, setCubeScale] = useState(1);
  // Taille affichée (px) de la carte d'intro (viewBox 300) ; suit cubeScale
  // pour que le crossfade carré→cube reste aligné sur tous les formats.
  const [squareSize, setSquareSize] = useState(343);
  const [skipped, setSkipped] = useState(false);
  const [skipRevealedFaces, setSkipRevealedFaces] = useState([false, false, false, false, false, false]);
  const vhRef = useRef(typeof window !== "undefined" ? window.innerHeight : 0);
  // Set when the user dismisses the orientation lock manually. Blocks the
  // orientation effect from re-arming the lock until portrait comes back,
  // otherwise the `resize`/`orientationchange` listener would immediately
  // re-show the overlay they just closed.
  const lockDismissedRef = useRef(false);
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
  const faceScrambleTlRef = useRef([]);
  const faceScrambleStateRef = useRef(["none", "none", "none", "none", "none", "none"]);
  const galleryScrambleTlRef = useRef(null);
  // Même machine à trois états que les labels de face ("none" -> "encoded" ->
  // "decoded"), pour que le skip rejoue exactement le même cycle.
  const galleryScrambleStateRef = useRef("none");
  // Temps d'exposition cumulé du label du skip, remis à zéro à chaque
  // changement de face : c'est lui qui déclenche le passage en décodage.
  const galleryExposureElapsedRef = useRef(0);
  const lastGalleryLabelTextRef = useRef("");
  const borderColorRef = useRef("#00a5b0");
  const strokeWidthRef = useRef(2);
  const cubeContainerRef = useRef(null);
  const contentRef = useRef(null);
  const restorePRef = useRef(null);
  const faceWasVisibleRef = useRef([false, false, false, false, false, false]);
  const faceVisibilityCountRef = useRef([0, 0, 0, 0, 0, 0]);
  const faceExposureElapsedRef = useRef([0, 0, 0, 0, 0, 0]);
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
  // True tant que le fond est « vide » (couleur de base, sans visuel) ; remis
  // à false par toute révélation (changeBackground).
  const bgBaseRef = useRef(false);
  const wirePathRef = useRef(null);
  // Infinity triggers wireframe computation on the very first tick.
  const lastWireRotRef = useRef({ rx: Infinity, ry: Infinity });
  // Scroll position where the cube pauses for the user to click a labeled face.
  const labelPinPRef = useRef(null);
  // Prevents the unlock reset from running more than once.
  const wasUnlockedRef = useRef(false);
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

  // Fabrique partagée du « sonar » (voile plein + anneau cyan) : le même rendu
  // sert aux faces du cube et au fond plein écran. `opts.maxR` (rayon max du
  // masque, en % de la largeur) et `opts.scaleMax` (taille max de l'anneau)
  // sont calculés par l'appelant selon la géométrie de la zone couverte (par
  // défaut 70,7 % / 1,414 : coin d'un carré 300 × 300). Pour une origine hors
  // du centre, `opts.center = { x, y, dmax }` (px, relatifs au conteneur) —
  // utilisé quand le fond doit « propager » l'onde émise depuis le cube :
  // dmax = distance du point au coin le plus éloigné, l'anneau est un cercle
  // déjà dimensionné (scale 0.02 → 1). `opts.duration` force la durée,
  // `opts.onClose` est appelé à la toute fin (avant le retrait du voile),
  // moment où le masque est plein — utile pour basculer le visuel sans pop.
  // L'animation est créée en pause : l'appelant la joue quand le média est
  // prêt. Renvoie { mask, ring, anime }.
  const buildSonarLayer = useCallback((container, reveal, opts = {}) => {
    const { maxR = 70.7, scaleMax = 1.414, center, onClose, duration, erase } = opts;
    const mask = document.createElement("div");
    mask.style.cssText =
      "position:absolute;top:0;left:0;right:0;bottom:0;background:#0a0f1c;" +
      "z-index:8;pointer-events:none;";
    // `expand` : l'onde se déploie du centre vers l'extérieur (révélation des
    // images, ou effacement de sortie). `erase` : l'onde efface le visuel
    // derrière elle (masque inversé) tout en gardant le même geste central →
    // périphérie.
    const expand = Boolean(reveal || erase);
    // `origin` : point d'émission de l'onde (centre par défaut). `full` :
    // rayon du masque à « onde aboutie » — hors centre, le dégradé rayonne
    // jusqu'au coin le plus éloigné (100 % du rayon de rendu), le voile
    // finissant exactement à 100 %.
    const origin = center ? `${center.x}px ${center.y}px` : "center";
    const applyMask = (r) => {
      const stops = erase
        ? `#000 ${Math.max(r - 0.5, 0)}%, rgba(0,0,0,0.45) ${Math.max(r + 1.5, 0)}%, transparent ${Math.max(r + 4, 0)}%`
        : `transparent ${Math.max(r - 4, 0)}%, rgba(0,0,0,0.45) ${Math.max(r - 1.5, 0)}%, #000 ${r + 0.5}%`;
      const img = `radial-gradient(circle at ${origin}, ${stops})`;
      mask.style.maskImage = img;
      mask.style.webkitMaskImage = img;
    };
    applyMask(0);
    const endRadius = center ? 100 : maxR;
    let ring;
    let toScale;
    if (center) {
      const d = center.dmax;
      ring = document.createElement("div");
      ring.style.cssText =
        `position:absolute;left:${center.x - d}px;top:${center.y - d}px;` +
        `width:${2 * d}px;height:${2 * d}px;border-radius:50%;` +
        "border:2px solid #33d1c8;box-shadow:0 0 18px rgba(0,165,176,0.85)," +
        "inset 0 0 18px rgba(0,165,176,0.55);transform:scale(0.02);" +
        "transform-origin:50% 50%;opacity:0;z-index:9;pointer-events:none;";
      toScale = 1;
    } else {
      ring = document.createElement("div");
      ring.style.cssText =
        "position:absolute;left:0;top:0;width:100%;height:100%;border-radius:50%;" +
        "border:2px solid #33d1c8;box-shadow:0 0 18px rgba(0,165,176,0.85)," +
        "inset 0 0 18px rgba(0,165,176,0.55);transform:scale(0.02);" +
        "transform-origin:50% 50%;opacity:0;z-index:9;pointer-events:none;";
      toScale = scaleMax;
    }
    container.appendChild(mask);
    container.appendChild(ring);
    const anim = anime({
      targets: ring,
      scale: expand ? [0.02, toScale] : [toScale, 0.02],
      opacity: [0.9, 0],
      easing: "easeInOutCubic",
      duration: duration ?? (expand ? 700 : 480),
      autoplay: false,
      update: (a) => {
        const p = expand ? a.progress / 100 : 1 - a.progress / 100;
        applyMask(p * endRadius);
      },
      complete: () => {
        if (onClose) onClose();
        mask.remove();
        ring.remove();
      },
    });
    return { mask, ring, anime: anim };
  }, []);

  // Sonar sur une face : le média se révèle derrière une onde radiale émise
  // depuis le centre de la face (entrée) ; en sortie, une onde identique se
  // déploie du centre vers l'extérieur en effaçant le visuel derrière elle.
  // L'animation reste en pause tant que l'appelant ne la joue pas. Chaque
  // appel remplace le sonar en cours de la même face.
  const runFaceSonar = useCallback((wrapper, i, reveal, opts = {}) => {
    const { duration, onClose, erase } = opts;
    const prev = faceSonarRef.current[i];
    if (prev) {
      prev.anime?.pause();
      prev.layer.mask.remove();
    }
    faceSonarRef.current[i] = null;
    const layer = buildSonarLayer(wrapper, reveal, { duration, onClose, erase });
    faceSonarRef.current[i] = { layer, anime: layer.anime };
    return layer.anime;
  }, [buildSonarLayer]);

  // Révélation à l'ouverture d'une face : le média passe instantanément en
  // pleine taille (au lieu du zoom 0.6 s) et reste caché sous le voile jusqu'à
  // ce qu'il soit réellement prêt (image décodée / vidéo chargée) ; le sonar
  // émet alors son onde radiale. Repli de sécurité si le média n'arrive pas à
  // temps.
  const revealFaceMedia = useCallback((i) => {
    const faceEl = cubeRef.current?.children[i];
    const wrapper = faceEl?.querySelector(".face-media-wrapper");
    if (!faceEl || !wrapper) return;
    wrapper.style.transition = "none";
    wrapper.style.transform = "scale(1)";
    wrapper.style.opacity = "1";
    wrapper.style.maskImage = "";
    wrapper.style.webkitMaskImage = "";
    void wrapper.offsetWidth;
    const anim = runFaceSonar(wrapper, i, true);
    const media = wrapper.querySelector("img,video");
    const isReady = () =>
      media
        ? media.tagName === "VIDEO"
          ? media.readyState >= 2
          : media.complete && media.naturalWidth > 0
        : true;
    let timeout = 0;
    const fire = () => {
      window.clearTimeout(timeout);
      if (media) {
        media.onload = null;
        media.onloadeddata = null;
      }
      anim.play();
    };
    if (media) {
      media.onload = fire;
      media.onloadeddata = fire;
    }
    timeout = window.setTimeout(fire, 1400);
    if (isReady()) fire();
  }, [runFaceSonar]);

  // Fond : même « sonar » que sur les faces — le nouveau visuel se pose derrière
  // un voile déjà plein, puis une onde radiale le découvre. L'onde naît à
  // l'emplacement du cube (origine la plus à jour sur écran) et se propage sur
  // tout le fond : c'est le prolongement direct de celle de la face. `delay`
  // (ms) décale son émission pour la caler sur la face. Le retour (reset)
  // garde un simple fondu : on ne révèle rien, juste la couleur de base.
  const changeBackground = useCallback((index, delay = 0) => {
    const bg = bgRef.current;
    const videoBg = videoBgRef.current;
    const videoContainer = videoBgContainerRef.current;
    if (!bg) return;
    const url = faceImages[index];
    if (!url) return;
    bgResetRef.current = false;
    bgBaseRef.current = false;
    const bgRoot = bg.parentElement;
    if (bgSonarRef.current) {
      bgSonarRef.current.anime?.pause();
      bgSonarRef.current.mask.remove();
      bgSonarRef.current.ring.remove();
      window.clearTimeout(bgSonarRef.current.timeout);
      bgSonarRef.current = null;
    }
    // Origine de l'onde : centre du cube (propagation cube → fond). Rayon à
    // couvrir : distance du point au coin le plus éloigné de l'écran.
    const opts = sonarGeometry(bgRoot, cubeContainerRef.current);
    const layer = buildSonarLayer(bgRoot, true, opts);
    const fire = () => layer.anime.play();
    bgSonarRef.current = { mask: layer.mask, ring: layer.ring, anime: layer.anime };

    const isVideo = isVideoUrl(url);
    if (!isVideo) {
      if (videoContainer) videoContainer.style.opacity = "0";
      if (videoBg) videoBg.pause();
      bg.style.transition = "none";
      bg.style.backgroundImage = `url("${url}")`;
      bg.style.opacity = "1";
      void bg.offsetHeight;
      if (delay > 0) {
        bgSonarRef.current.timeout = window.setTimeout(fire, delay);
      } else {
        fire();
      }
    } else if (videoBg && videoContainer) {
      bg.style.opacity = "0";
      let fired = false;
      const start = () => {
        if (fired) return;
        fired = true;
        window.clearTimeout(mediaTimeout);
        videoContainer.style.opacity = "1";
        videoBg.play().catch(() => {});
        if (delay > 0) {
          bgSonarRef.current.timeout = window.setTimeout(fire, delay);
        } else {
          fire();
        }
      };
      if (videoBg.src !== url) {
        videoBg.src = url;
        videoBg.load();
      }
      videoBg.addEventListener("loadeddata", start, { once: true });
      const mediaTimeout = window.setTimeout(start, 1400);
    }
  }, [faceImages, buildSonarLayer]);

  const stopFaceScramble = (i) => {
    const tl = faceScrambleTlRef.current[i];
    if (!tl) return;
    stopScramble(tl);
    faceScrambleTlRef.current[i] = undefined;
    const el = clickLabelRefs.current[i];
    if (el) el.textContent = FACE_LABELS[i];
  };

  // Remet le label à l'état « codé » : brouillage continu, jamais résolu.
  // C'est l'animation visible entre deux expositions et pendant le délai
  // d'1 s avant décodage.
  const encodeFaceLabel = (i) => {
    const el = clickLabelRefs.current[i];
    if (!el) return;
    stopScramble(faceScrambleTlRef.current[i]);
    faceScrambleTlRef.current[i] = undefined;
    faceScrambleTlRef.current[i] = scrambleLabel(el, FACE_LABELS[i], {
      cipher: true,
    });
  };

  // Décodage (~1 s) : le brouillage se résout de gauche à droite vers le
  // texte final. Ne se déclenche qu'après une exposition continue d'1 s.
  const decodeFaceLabel = (i) => {
    const el = clickLabelRefs.current[i];
    if (!el) return;
    stopScramble(faceScrambleTlRef.current[i]);
    faceScrambleTlRef.current[i] = undefined;
    faceScrambleTlRef.current[i] = scrambleLabel(el, FACE_LABELS[i], {
      duration: 1,
    });
  };

  // Pendant le skip, le label de la gallery rejoue le cycle des labels de face :
  // d'abord l'état « codé » (brouillage continu qui ne se résout jamais), puis
  // le décodage. Même rendu, même police, seule la source du temps diffère.
  const encodeGalleryLabel = (text) => {
    const galleryLabel = galleryLabelRef.current;
    if (!galleryLabel) return;
    stopScramble(galleryScrambleTlRef.current);
    galleryScrambleTlRef.current = scrambleLabel(galleryLabel, text, {
      cipher: true,
    });
    galleryScrambleStateRef.current = "encoded";
  };

  const decodeGalleryLabel = (text) => {
    const galleryLabel = galleryLabelRef.current;
    if (!galleryLabel) return;
    stopScramble(galleryScrambleTlRef.current);
    galleryScrambleTlRef.current = scrambleLabel(galleryLabel, text, {
      duration: SKIP_LABEL_DECODE_MS / 1000,
    });
    galleryScrambleStateRef.current = "decoded";
  };

  const stopGalleryScramble = () => {
    stopScramble(galleryScrambleTlRef.current);
    galleryScrambleTlRef.current = null;
    galleryScrambleStateRef.current = "none";
    galleryExposureElapsedRef.current = 0;
    const galleryLabel = galleryLabelRef.current;
    if (galleryLabel && galleryLabel.textContent !== "") galleryLabel.textContent = "";
  };

  useEffect(() => () => {
    faceScrambleTlRef.current.forEach((tl) => stopScramble(tl));
    stopScramble(galleryScrambleTlRef.current);
  }, []);

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
    changeBackground(i, 380);
    revealFaceMedia(i);
    clickStackRef.current = [...clickStackRef.current.filter((idx) => idx !== i), i];
    if (clickLabelRefs.current[i]) {
      clickLabelRefs.current[i].style.opacity = "0";
      stopFaceScramble(i);
    }
    const video = (cubeRef.current?.children[i] || document).querySelector("video");
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [changeBackground, revealFaceMedia]);

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
      const labelShown = faceVisibilityCountRef.current[idx] >= FACE_LABEL_REVEAL_COUNT;
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
    const portraitQuery = window.matchMedia?.("(orientation: portrait)");
    const updateOrientation = () => {
      const portrait = window.innerHeight >= window.innerWidth;
      if (portrait) lockDismissedRef.current = false;
      setIsMobileLandscape(
        isRealMobileDevice() && !portrait && !lockDismissedRef.current,
      );
    };
    const screenOrientation = window.screen?.orientation;

    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);
    window.addEventListener("pageshow", updateOrientation);
    document.addEventListener("visibilitychange", updateOrientation);

    if (portraitQuery?.addEventListener) {
      portraitQuery.addEventListener("change", updateOrientation);
    } else {
      portraitQuery?.addListener?.(updateOrientation);
    }
    if (screenOrientation?.addEventListener) {
      screenOrientation.addEventListener("change", updateOrientation);
    } else {
      screenOrientation?.addListener?.(updateOrientation);
    }

    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
      window.removeEventListener("pageshow", updateOrientation);
      document.removeEventListener("visibilitychange", updateOrientation);
      if (portraitQuery?.removeEventListener) {
        portraitQuery.removeEventListener("change", updateOrientation);
      } else {
        portraitQuery?.removeListener?.(updateOrientation);
      }
      if (screenOrientation?.removeEventListener) {
        screenOrientation.removeEventListener("change", updateOrientation);
      } else {
        screenOrientation?.removeListener?.(updateOrientation);
      }
    };
  }, []);

  // Screen-orientation lock attempts trap the user: `lock("portrait")`
  // can hide/disable the UI on devices that honor it, and the transient
  // fullscreen permission state keeps the overlay stuck after rotating
  // back. The lock overlay already asks for portrait — no API call.
  useEffect(() => {
    try {
      window.screen?.orientation?.unlock?.();
    } catch {}
  }, [isMobileLandscape]);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const landscape = w > h;
      const mobile = isMobileDevice();
      const baseSize = 300;
      const reserveH = landscape ? 96 : 168;
      const maxScale = mobile ? MOBILE_CUBE_MAX_SCALE : 1;
      const availW = Math.max(120, w - 24);
      const availH = Math.max(120, h - reserveH);
      const s = Math.max(0.35, Math.min(maxScale, availW / baseSize, availH / baseSize));
      cubeScaleRef.current = s;
      setCubeScale(s);
      // Floor the card size: an <svg> with a negative width/height is invalid and
      // React logs "A negative value is not valid". `w - 8` is the only term that
      // can go negative on an extremely narrow viewport.
      setSquareSize(Math.max(1, Math.min(343 * s, w - 8)));
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

    // Max `prefers-reduced-motion` : ne pas court-circuiter l'effet. Le défilement
    // est un embarquement piloté par l'utilisateur (scrub), pas une animation
    // autonome : si on retourne ici, ni le listener de scroll ni `tickRef` ne
    // sont installés, la section reste figée sur la carte d'intro et le bouton
    // SKIP devient totalement inerte. On laisse donc toujours le système en
    // place ; seules les animations autonomes (skip, autoplay) sont doucement
    // plus graduées.
    const restoreP = restorePRef.current;
    restorePRef.current = null;

    const el = sectionRef.current;
    const cube = cubeRef.current;
    if (!el || !cube) return;
    const mobileScroll = isMobileDevice();

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

    // The section is its own scroll container (height 100svh, content 10svh)
    // so the document itself never scrolls and the mobile browser bar stays
    // put. Scroll progress is read straight from the section's scrollTop.

    // Bascule du visuel vers le fond vide (couleur de base), sans aucun pop :
    // l'image est retirée pendant que la transparence repasse en douceur.
    const emptyBackground = () => {
      if (videoBgContainerRef.current) videoBgContainerRef.current.style.opacity = "0";
      if (videoBgRef.current) videoBgRef.current.pause();
      if (bg) {
        bg.style.transition = "none";
        bg.style.backgroundImage = "none";
        bg.style.opacity = "0";
        void bg.offsetHeight;
        bg.style.transition = "opacity 0.35s ease";
        bg.style.opacity = "1";
      }
      bgBaseRef.current = true;
    };

    // Retour du fond : le visuel est effacé derrière une onde radiale puis
    // basculé sur la couleur de base une fois le voile plein, sans aucun pop.
    // `erase` réutilise le geste central → extérieur (comme à l'entrée) en
    // inversant le masque ; par défaut l'onde se referme vers le cube.
    const resetBackground = (erase = false) => {
      if (videoBgContainerRef.current) videoBgContainerRef.current.style.opacity = "0";
      if (videoBgRef.current) videoBgRef.current.pause();
      if (bgSonarRef.current) {
        bgSonarRef.current.anime?.pause();
        bgSonarRef.current.mask.remove();
        bgSonarRef.current.ring.remove();
        window.clearTimeout(bgSonarRef.current.timeout);
        bgSonarRef.current = null;
      }
      const bgRoot = bg.parentElement;
      const opts = sonarGeometry(bgRoot, cubeContainerRef.current);
      const layer = buildSonarLayer(bgRoot, false, {
        ...opts,
        duration: EXIT_MS,
        erase,
        onClose: emptyBackground,
      });
      bgSonarRef.current = { mask: layer.mask, ring: layer.ring, anime: layer.anime };
      layer.anime.play();
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
    // Fenêtre complète du repli des faces (première face → dernière). La
    // fermeture du fond est calée dessus : les visuels disparaissent pendant
    // que le fond se rétracte, les deux finissent ensemble.
    const EXIT_MS = (SPIN_START - CUBE_END) * TOTAL;
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
    // a moment (roughly two seconds, label included), then the cube folds and
    // the finale plays at its own readable pace.
    const SKIP_MORPH_MS = 900;
    const SKIP_TURN_MS = 400;
    const SKIP_LEAD_MS = 400;
    const SKIP_GAP_MS = 1100;
    const SKIP_FINALE_MS = 3000;
    // Timestamp of the last scroll nudge back to the labelled-face pin.
    let lastPinFix = 0;
    // Poses (rotation units) the skip gallery lingers on, one per exposed face,
    // computed from where the cube is when the sweep starts.
    let galleryRot = [];
    let galleryDur = 0;
    const gallerySetup = (start) => {
      galleryRot = [];
      galleryDur = 0;
      lastGalleryLabelTextRef.current = "";
      stopGalleryScramble();
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
      // Le drag, le clic sur une face et le relâchement du pointeur appellent
      // `tick` sans timestamp. `now` y vaut alors `undefined`, `dt` devient NaN,
      // donc `follow` aussi, et `currentP` passe à NaN : il ne se réinitialise
      // plus jamais et le scroll, le drag et le skip cessent tous de répondre.
      // On retombe donc sur le dernier frame connu.
      const t = typeof now === "number" && Number.isFinite(now) ? now : lastTickTime + 16.67;
      const dt = lastTickTime > 0
        ? Math.min(Math.max(t - lastTickTime, 0), MAX_FRAME_DT)
        : 16.67;
      lastTickTime = t;
      const diff = targetP - currentP;

      // Le brouillage apparaît à la seconde visibilité : le label reste « codé »
      // pendant LABEL_DECODE_DELAY_MS d'exposition, puis se résout. Dès que la
      // face n'est plus exposée, le compte repart de zéro.
      // Frozen during the auto sweep: there the labels are driven solely by the
      // gallery, otherwise they would light up mid-rotation.
      // This runs before the rotation for this frame is resolved, so it reads
      // `lastWireRotRef` — the orientation actually applied to the cube. It
      // trails by one frame while scrolling, and is exact once at rest. The ref
      // starts at Infinity to force the first wireframe build, hence the guard.
      const wireRot = lastWireRotRef.current;
      const visRot = Number.isFinite(wireRot.rx) ? wireRot : { rx: 0, ry: 0 };
      // Tant qu'une face attend son décodage, la boucle doit rester vivante :
      // sans elle, le cube à l'arrêt se parke et le délai n'aboutirait jamais.
      let pendingDecode = false;
      if (!skipActiveRef.current) {
        for (let i = 0; i < 6; i++) {
          const nowVisible = isFaceVisible(
            FACE_NORMALS[i][0],
            FACE_NORMALS[i][1],
            FACE_NORMALS[i][2],
            visRot.rx,
            visRot.ry,
          );
          if (nowVisible && !faceWasVisibleRef.current[i]) {
            faceVisibilityCountRef.current[i]++;
          }
          const revealed = faceVisibilityCountRef.current[i] >= FACE_LABEL_REVEAL_COUNT && !zoomedFacesRef.current[i];
          if (revealed) {
            const el = clickLabelRefs.current[i];
            if (el) el.style.opacity = "1";
            if (nowVisible) {
              if (
                faceScrambleStateRef.current[i] === "none" ||
                faceScrambleStateRef.current[i] === "decoded"
              ) {
                // Une seule fois par transition : `encodeFaceLabel` vide et
                // recrée les spans du DOM, l'appeler à chaque frame pendant le
                // compte à rebours reconstruirait le label en boucle.
                encodeFaceLabel(i);
                faceScrambleStateRef.current[i] = "encoded";
              }
              faceExposureElapsedRef.current[i] += dt;
              if (
                faceExposureElapsedRef.current[i] >= LABEL_DECODE_DELAY_MS &&
                faceScrambleStateRef.current[i] === "encoded"
              ) {
                // `scrambleLabel` part d'un rendu entièrement aléatoire, donc le
                // décodage démarre proprement même depuis l'état « none ».
                decodeFaceLabel(i);
                faceScrambleStateRef.current[i] = "decoded";
              } else if (faceScrambleStateRef.current[i] === "encoded") {
                pendingDecode = true;
              }
            } else {
              faceExposureElapsedRef.current[i] = 0;
              if (faceScrambleStateRef.current[i] === "decoded") {
                encodeFaceLabel(i);
                faceScrambleStateRef.current[i] = "encoded";
              }
            }
          } else if (faceScrambleStateRef.current[i] !== "none") {
            faceExposureElapsedRef.current[i] = 0;
            stopFaceScramble(i);
            faceScrambleStateRef.current[i] = "none";
          }
          faceWasVisibleRef.current[i] = nowVisible;
        }
      }

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
            cached.wrapper.style.maskImage = "";
            cached.wrapper.style.webkitMaskImage = "";
          }
          // Labels are handed over to the gallery: none at the very start, only
          // the frontally exposed face once the morph is over.
          for (let i = 0; i < 6; i++) {
            const label = clickLabelRefs.current[i];
            if (label) label.style.opacity = "0";
            stopFaceScramble(i);
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
          // Gallery: settle on each face so it stares frontally two seconds,
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
            const wantText = labelIdx >= 0 ? FACE_LABELS[labelIdx] : "";
            galleryLabel.style.opacity = labelIdx >= 0 ? "1" : "0";
            if (wantText !== lastGalleryLabelTextRef.current) {
              lastGalleryLabelTextRef.current = wantText;
              // Nouvelle face : le compteur repart de zéro et le label réentre en
              // état « codé ».
              galleryExposureElapsedRef.current = 0;
              if (wantText === "") {
                stopGalleryScramble();
              } else {
                encodeGalleryLabel(wantText);
              }
            }
          }
          // Tant que le label est « codé », on cumule son temps d'exposition et
          // on déclenche le décodage une fois le délai écoulé, comme pour les
          // labels de face. Le texte est donc lisible avant le fondu de sortie.
          if (labelIdx >= 0 && galleryScrambleStateRef.current === "encoded") {
            galleryExposureElapsedRef.current += dt;
            if (galleryExposureElapsedRef.current >= SKIP_LABEL_CIPHER_MS) {
              decodeGalleryLabel(FACE_LABELS[labelIdx]);
            }
          }
          for (let i = 0; i < 6; i++) {
            const label = clickLabelRefs.current[i];
            if (label) label.style.opacity = "0";
            stopFaceScramble(i);
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
            cached.wrapper.style.maskImage = "";
            cached.wrapper.style.webkitMaskImage = "";
          }
          for (let i = 0; i < 6; i++) {
            if (clickLabelRefs.current[i]) clickLabelRefs.current[i].style.opacity = "0";
            stopFaceScramble(i);
          }
          if (galleryLabelRef.current) galleryLabelRef.current.style.opacity = "0";
          lastGalleryLabelTextRef.current = "";
          stopGalleryScramble();
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
      } else if (Math.abs(diff) < SNAP_THRESHOLD && !pendingDecode) {
        // The cube is at rest: park the loop. `pendingDecode` holds it alive for
        // the remainder of a face's exposure delay so its label still resolves.
        // The wait is bounded by `LABEL_DECODE_DELAY_MS`, so the loop always
        // parks again once every pending label has resolved.
        currentP = targetP;
        lastTickTime = 0;
        rafId = null;
      } else {
        const smoothingMs = mobileScroll
          ? diff < 0
            ? MOBILE_REVERSE_SCROLL_SMOOTHING_MS
            : MOBILE_SCROLL_SMOOTHING_MS
          : diff < 0
            ? WEB_REVERSE_SCROLL_SMOOTHING_MS
            : WEB_SCROLL_SMOOTHING_MS;
        const follow = 1 - Math.exp(-dt / smoothingMs);
        currentP += diff * follow;
        rafId = requestAnimationFrame(tick);
      }
      const unlocked = allClickedRef.current;
      // On the first frame after all faces are clicked, reset currentP to CUBE_END
      // so the exit animation plays forward from there instead of jumping ahead.
      if (unlocked && !wasUnlockedRef.current) {
        wasUnlockedRef.current = true;
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
      // After ALL faces have been seen twice, snap to the next face-forward step boundary.
      if (!allSeenTwiceRef.current && faceVisibilityCountRef.current.every(c => c >= 2)) {
        allSeenTwiceRef.current = true;
        const cubeP = Math.max(0, (currentP - INTRO_END) / CUBE_RANGE);
        const snapBaseP = Math.min(1, Math.ceil(cubeP * 12) / 12);
        labelPinPRef.current = INTRO_END + snapBaseP * CUBE_RANGE;
      }
      // Release the pin once every labeled face has been clicked.
      if (labelPinPRef.current !== null && !FACE_NORMALS.some((_, i) =>
        faceVisibilityCountRef.current[i] >= FACE_LABEL_REVEAL_COUNT && !zoomedFacesRef.current[i]
      )) {
        labelPinPRef.current = null;
      }
      if (spinning) {
        if (!bgResetRef.current) {
          bgResetRef.current = true;
          resetBackground();
        } else if (!bgBaseRef.current) {
          // Le fond a déjà été fondu par la sortie : on le laisse vide
          // (couleur de base) une seule fois, sans nouvel effet sonar.
          emptyBackground();
        }
      } else if (tlP < INTRO_END) {
        if (!bgResetRef.current) {
          bgResetRef.current = true;
          resetBackground();
        }
      } else if (bgResetRef.current && tlP < CUBE_END) {
        bgResetRef.current = false;
        const last = clickStackRef.current[clickStackRef.current.length - 1];
        if (typeof last === "number") changeBackground(last);
      }
      // Per-face lighting: rotate face normal by current cube rotation
      if (cubeRef.current) {
        // Between CUBE_END and SPIN_START the six visuals plus the background
        // fade out together, over the same EXIT_MS window. Fully reversible.
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
              wrapper.style.maskImage = "";
              wrapper.style.webkitMaskImage = "";
            }
            faceEl.style.filter = `brightness(${brightness})`;
          } else if (exitK > 0) {
            // Sortie : un fondu général — les six visuels, la vidéo et le fond
            // s'éteignent d'un même geste sur toute la fenêtre (EXIT_MS),
            // piloté par le scroll (totalement réversible). À l'aboutissement,
            // le spin laisse le fond vide (couleur de base). `bgResetRef` sert
            // de garde : au rewind sous CUBE_END, le fond se ré-vêle.
            const k = smoothstep(exitK);
            const fade = 1 - k;
            if (!bgResetRef.current) {
              bgResetRef.current = true;
              if (videoBgRef.current) videoBgRef.current.pause();
            }
            if (bg) {
              bg.style.transition = "none";
              bg.style.opacity = String(fade);
            }
            if (videoBgContainerRef.current) {
              videoBgContainerRef.current.style.transition = "none";
              videoBgContainerRef.current.style.opacity = String(fade);
            }
            if (wrapper) {
              wrapper.style.transition = "none";
              wrapper.style.opacity = String(fade);
              wrapper.style.maskImage = "";
              wrapper.style.webkitMaskImage = "";
            }
            if (media) media.style.filter = `brightness(${brightness})`;
            if (faceEl.style.filter) faceEl.style.filter = "";
          } else if (zoomedFacesRef.current[i]) {
            if (media) media.style.filter = `brightness(${brightness})`;
            if (faceEl.style.filter) faceEl.style.filter = "";
            if (wrapper) {
              wrapper.style.transition = "transform 0.6s ease";
              wrapper.style.opacity = "1";
              wrapper.style.transform = "scale(1)";
              wrapper.style.maskImage = "";
              wrapper.style.webkitMaskImage = "";
            }
          } else {
            if (media) media.style.filter = "";
            faceEl.style.filter = `brightness(${brightness})`;
            if (wrapper) {
              wrapper.style.transition = "transform 0.6s ease";
              wrapper.style.opacity = "1";
              wrapper.style.transform = "scale(0)";
              wrapper.style.maskImage = "";
              wrapper.style.webkitMaskImage = "";
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
  }, [faceImages, changeBackground, runFaceSonar, buildSonarLayer]);

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
    labelPinPRef.current = null;
    skipActiveRef.current = false;
    const nextSkipFaces = [false, false, false, false, false, false];
    skipRevealedFacesRef.current = nextSkipFaces;
    setSkipRevealedFaces(nextSkipFaces);
    setSkipped(true);
    for (let i = 0; i < 6; i++) {
      if (clickLabelRefs.current[i]) clickLabelRefs.current[i].style.opacity = "0";
      stopFaceScramble(i);
    }
    if (galleryLabelRef.current) galleryLabelRef.current.style.opacity = "0";
    stopGalleryScramble();
    lastGalleryLabelTextRef.current = "";
    if (typeof tickRef.current === "function") {
      tickRef.current();
      return;
    }
    // La boucle d'animation n'est pas installée (effet jamais passé, JS bloqué
    // sur ce device…) : SKIP ne doit aucunement rester un bouton silencieusement
    // inerte. On force alors la fin du défilement en natif pour dévoiler les
    // liens de la fin et sortir de l'intro.
    const el = sectionRef.current;
    if (el && el.scrollHeight > el.offsetHeight) {
      el.scrollTop = el.scrollHeight;
    }
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
    <>
      <section
        ref={sectionRef}
        className="relative z-10 h-[calc(var(--svh))] overflow-y-auto overflow-x-hidden scroll-none"
        aria-hidden={isMobileLandscape}
        style={{
          clipPath: "inset(0)",
          pointerEvents: isMobileLandscape ? "none" : undefined,
        }}
      >
      <div style={{ height: "calc(10 * var(--svh))" }}>
        <div className="sticky top-0 min-h-[calc(var(--svh))] flex items-center">
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
            <div className="min-h-[calc(var(--svh))] flex items-center justify-center">
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
                          willChange: "transform",
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
                            fontFamily: "var(--font-share-tech-mono), monospace",
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
                    fontSize: "1.25rem",
                    fontFamily: "var(--font-share-tech-mono), monospace",
                    letterSpacing: "0.3em",
                    opacity: 0,
                    transition: "opacity 0.35s ease",
                    zIndex: 25,
                    // Même échelle que le cube : le label de face est dans la
                    // boîte mise à l'échelle (`scale(${cubeScale})` sur le
                    // conteneur 3D), l'overlay est à côté. Sans cette
                    // transformation les deux polices divergent dès que le cube
                    // est réduit. `transformOrigin: center` garde le texte centré
                    // dans la face.
                    transform: `scale(${cubeScale})`,
                    transformOrigin: "center",
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

      {isMobileLandscape && (
        <div
          className="fixed inset-0 z-[100] flex min-h-[calc(var(--svh))] items-center justify-center bg-[#0a0f1c] px-8 text-center"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="orientation-lock-title"
          aria-describedby="orientation-lock-description"
        >
          <div className="max-w-sm">
            <div className="relative mx-auto mb-8 h-20 w-12 rounded-[10px] border-2 border-[#00a5b0] shadow-[0_0_24px_rgba(0,165,176,0.25)]">
              <div className="absolute left-1/2 top-1 h-1 w-3 -translate-x-1/2 rounded-full bg-[#00a5b0]" />
              <div className="absolute inset-x-2 bottom-3 h-1 rounded-full bg-[#00a5b0]/50" />
            </div>
            <p className="mb-3 text-xs font-light tracking-[0.3em] text-[#00a5b0] uppercase">Orientation requise</p>
            <h1 id="orientation-lock-title" className="mb-4 text-3xl font-light text-white">Tournez votre appareil</h1>
            <p id="orientation-lock-description" className="text-sm leading-relaxed text-[#94a3b8]">
              Le portfolio est disponible en format portrait.
            </p>
            <button
              type="button"
              onClick={() => {
                lockDismissedRef.current = true;
                setIsMobileLandscape(false);
              }}
              className="mt-6 rounded-full border border-[#00a5b0]/60 px-6 py-2 text-xs font-light tracking-[0.25em] text-[#00a5b0] uppercase hover:bg-[#00a5b0]/10 transition-colors bg-transparent cursor-pointer"
            >
              Continuer quand même
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default HeroCube;
