"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import anime from "animejs";
import { Undo2, MousePointer2 } from "lucide-react";

import { renderProjectContent } from "./cube/project-content";
import { ProjectTabs, BackButton, PROJECT_LINKS } from "./cube/project-tabs";
import { ContactOverlay } from "./contact-overlay";
import {
  CUBE_STEP_BOUNDS,
  FACE_LABELS,
  FACE_NORMALS,
  FACES,
  LIGHT_DIR,
  computeWireframe,
  faceFrontAmount,
  faceTransform,
  findClickedFace,
  getCubeRotation,
  isFaceVisible,
  isVideoUrl,
  nextCubeStepBound,
  rotateVecByXY,
} from "../lib/cube-math";
import { scrambleLabel, stopScramble } from "../lib/scramble";
import { FACE_MEDIA, faceSrcSet } from "../lib/cube-media";
import { reduceMotion as readReducedMotion } from "../lib/reduced-motion";
import { useDialogFocus } from "../lib/use-dialog-focus";

// Default media files from the public/ folder, mapped to FACE_LABELS order:
// [WEB, REACT, BACKEND, DATABASE, MOBILE, PROJETS].
// La liste vit dans `lib/cube-media.js` : elle était dupliquée ici et dans
// `app/page.js`, où seule celle de la page était réellement utilisée.
const DEFAULT_FACE_MEDIA = FACE_MEDIA;
// Préfixe de déploiement, encore nécessaire pour le logo (asset seul).
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Smoothstep easing reused by the end-sequence animations.
const smoothstep = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

// Interpolation coordonnée par coordonnée entre deux chaînes de points SVG de
// même longeur (24 sommets), utilisée pour faire glisser le carré de fin sur la
// silhouette de la « souris » pendant le retour.
const interpolatePoints = (from, to, t) => {
  const a = from.split(" ").map((p) => p.split(",").map(Number));
  const b = to.split(" ").map((p) => p.split(",").map(Number));
  return a
    .map((pt, i) => [
      (pt[0] + (b[i][0] - pt[0]) * t).toFixed(1),
      (pt[1] + (b[i][1] - pt[1]) * t).toFixed(1),
    ].join(","))
    .join(" ");
};

const WEB_SCROLL_SMOOTHING_MS = 80;
const WEB_REVERSE_SCROLL_SMOOTHING_MS = 120;
const MOBILE_SCROLL_SMOOTHING_MS = 60;
const MOBILE_REVERSE_SCROLL_SMOOTHING_MS = 100;
const MAX_FRAME_DT = 100;
const SNAP_THRESHOLD = 0.0005;
// Durée du fondu qui ramène l'offset de rotation du drag à zéro quand le scroll
// reprend : assez court pour « dé-poser » le cube vite, assez long pour ne pas
// sauter d'un coup.
const DRAG_EASE_MS = 450;
// Durée du décodage d'un label de face : le brouillage se résout de gauche à
// droite sur ce temps. Aligné sur SKIP_LABEL_DECODE_MS — à 1 s le label mettait
// presque deux fois plus longtemps à se résoudre que pendant le skip, pour le
// même rendu.
const FACE_LABEL_DECODE_MS = 500;
// Facteur de projection perspective : une face frontale (translateZ 150px, cube
// 300px) sous une perspective de 1200px est rendue 1200/(1200-150) = 8/7 plus
// grande que l'overlay 2D. C'est l'échelle qu'il faut au label du skip pour
// égaliser sa taille réelle avec celle des labels de face, mobile comme desktop.
const CUBE_FACE_PROJECTION_SCALE = 1200 / 1050;
// Épaisseur et taille de police des labels de face, ramenées à celle du label du
// skip. Palette, halo et échelle rendue sont désormais identiques : ce qui
// restait était le rendu. Le label du skip est une couche 2D, rasterisée à sa
// taille finale et en anticrénelage LCD (le navigateur réserve l'antialiasing à
// sous-pixels aux surfaces non transformées) ; le label de face vit dans le
// sous-arbre `preserve-3d`, où la transform est réécrite à chaque frame. Il est
// donc rasterisé à sa taille source puis agrandi par la perspective, en
// anticrénelage grayscale : traits plus fins, halo dilué — d'où l'air plus petit
// et plus terne, que les deux égalisations suivantes corrigent ensemble.
// 100 % du facteur de projection (1.14) restore l'épaisseur de trait mais rend le
// label franchement trop grand, car ce même facteur s'applique déjà au rendu. On
// prend donc une compensation partielle, calée à l'œil : c'est le seul endroit
// à toucher pour retoucher ce rendu.
const FACE_LABEL_FONT_SCALE = 1.07;
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
// Instant (dans un hold) où le décodage est terminé : apparition, phase codée,
// puis résolution. C'est exactement là que l'onglet de la face exposée se rend
// visible pendant le skip — jamais avant, pour qu'il accompagne le label lisible.
const SKIP_LABEL_READY_MS =
  SKIP_LABEL_DELAY_MS + SKIP_LABEL_CIPHER_MS + SKIP_LABEL_DECODE_MS;
// Icône de pointer : là où le texte d'accueil le demandait, le geste le montre.
// Elle se pose sur la face dont le label se met à décoder — l'instant où le mot
// devient lisible —, tape deux fois, puis s'efface. Un tir unique par
// introduction (`pointerPlayedRef`), remis à zéro avec elle.
// `POINTER_FACE` est un index, pas un libellé : le cube uncovering les faces
// dans l'ordre de `FACE_LABELS`, la face 0 est celle dont le label se résout en
// premier. L'icône et le déclenchement partagent cet index, faute de quoi le
// geste pourrait apparaître sur une face qui n'est pas celle qui se décode.
const POINTER_FACE = 0;
const POINTER_ENTER_MS = 420;
const POINTER_TAP_MS = 130;
const POINTER_RELEASE_MS = 300;
const POINTER_HOLD_MS = 700;
const POINTER_EXIT_MS = 400;
// Géométrie du pointer, rassemblée ici parce que les trois valeurs se répondent :
// la pointe de la flèche, le centre de l'anneau et le décalage du glyphe. Les
// dupliquer dans deux styles les désynchroniserait au premier ajustement.
const POINTER_GLYPH_SIZE = 26;
const POINTER_RING_SIZE = 72;
// `MousePointer2` est tracée dans une viewBox 24, pointe en haut à gauche. Sa
// pointe est le coin arrondi qui relie le début du tracé à la première oblique,
// à 4.14 sur chaque axe — pas 12, le milieu de la boîte. C'est ce point qui
// doit viser le centre de l'anneau : l'onde part du contact, pas du milieu du
// glyphe. D'où la conversion en px, pour que changer `POINTER_GLYPH_SIZE` ne
// déplace pas la pointe.
const POINTER_TIP = (4.14 * POINTER_GLYPH_SIZE) / 24;
const MOBILE_USER_AGENT = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const MOBILE_CUBE_MAX_SCALE = 0.8;
// Retard de l'onde de fond après le clic sur une face, et durée de l'onde
// elle-même. Sur mobile les deux sont raccourcis : le fond est la seule chose
// qui change au clic, et 380 ms d'attente plus 700 ms de propagation laissaient
// l'écran vide bien trop longtemps après le toucher.
const BG_REVEAL_DELAY_MS = 380;
const MOBILE_BG_REVEAL_DELAY_MS = 120;
const BG_WAVE_MS = 700;
const MOBILE_BG_WAVE_MS = 420;

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

// `prefers-reduced-motion` : ne concerne QUE les animations autonomes —
// l'autoplay de fin, la chorégraphie du skip, les ondes sonar, la molette. Le
// scrub de scroll n'est volontairement pas touché : c'est un pilotage direct de
// l'utilisateur, pas une animation automatique, et le neutraliser figerait la
// page sur la carte d'intro (cf. le commentaire de l'effet d'animation).
//
// La fonction vivait ici en `return false` — la préférence système n'était donc
// lue nulle part en JS, et seul `.wheel-anim` y obéissait, en CSS. Elle est
// extraite dans `lib/reduced-motion.js` : c'est de la logique, pas de la 3D, et
// elle mérite ses tests.
const reduceMotion = readReducedMotion;

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
  // La face au premier plan n'est pas un état : c'est une valeur lue par la
  // boucle (`computeWireframe`) et écrite à deux endroits, jamais rendue en
  // JSX. Elle était déclarée en `useState` et recopiée dans la ref à chaque
  // rendu — donc deux rendus React par clic pour rien. Elle est écrite directement
  // dans `zoomedFaceRef` ; c'est aussi le seul endroit du composant qui ne passe
  // plus par un état.
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
  // Le bouton RETOUR n'apparaît qu'une fois l'animation terminée (fin atteinte).
  // C'est alors aussi le seuil au-delà duquel un scroll inverse déclenche le
  // même retour que ce bouton.
  const [showReturn, setShowReturn] = useState(false);
  const [touchLock, setTouchLock] = useState(false);
  const returnShownRef = useRef(false);
  // Fonction de reset complète, instanciée dans l'effet d'animation (elle a
  // besoin de la timeline et du playhead) et exposée au bouton RETOUR.
  const goToStartRef = useRef(null);
  const [skipRevealedFaces, setSkipRevealedFaces] = useState([false, false, false, false, false, false]);
  // Une fois la séquence finale jouée (au scroll ou via SKIP), le cube repasse
  // en mode « exploration post-skip » : le scroll inverse rejoue un cube nu
  // avec ses labels, fond vide — sans ré-exposer les médias zoomés ni re-révéler
  // le fond. `zoomedFaces` reste intact (les onglets projets restent affichés) ;
  // seul le rendu des visuels replisés change. Un nouveau clic sur une face
  // relève le repli.
  const [mediaRetracted, setMediaRetracted] = useState(false);
  const mediaRetractedRef = useRef(false);
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
  const scrollHintRef = useRef(null);
  const zoomedFacesRef = useRef(zoomedFaces);
  const zoomedFaceRef = useRef(-1);
  const currentPRef = useRef(0);
  const overlayScrollRef = useRef(null);
  // Nœuds des deux overlays plein écran, cibles du piège de focus et du
  // gestionnaire Échap.
  const projectDialogRef = useRef(null);
  const contactDialogRef = useRef(null);
  const orientationLockRef = useRef(null);
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
  const cubeContainerRef = useRef(null);
  const contentRef = useRef(null);
  const faceWasVisibleRef = useRef([false, false, false, false, false, false]);
  const faceVisibilityCountRef = useRef([0, 0, 0, 0, 0, 0]);
  const faceExposureElapsedRef = useRef([0, 0, 0, 0, 0, 0]);
  const clickLabelRefs = useRef([]);
  // Icône de pointer : le conteneur porte l'entrée et la sortie, le glyphe le
  // geste (il s'abaisse à chaque tape), l'anneau l'onde qui part du clic.
  const pointerRef = useRef(null);
  const pointerGlyphRef = useRef(null);
  const pointerRippleRef = useRef(null);
  const pointerLabelRef = useRef(null);
  const pointerTlRef = useRef(null);
  const pointerPlayedRef = useRef(false);
  const clickStackRef = useRef([]);
  const allClickedRef = useRef(false);
  // Fin de la fenêtre de « grâce » d'une seconde après le dernier clic :
  // tant qu'elle court, un éventuel scroll ne démarre pas encore le fondu de
  // fin (la tête de lecture reste retenue à CUBE_END).
  const exitArmUntilRef = useRef(0);
  // True après un clic pendant le reverse (médias repliés) : le fondu de fin
  // est neutralisé le temps que la face et le fond se révèlent en entier, sans
  // être éteints par la fenêtre de sortie. Remis à false au prochain scroll.
  const revealOverrideRef = useRef(false);
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
  // Couche de fond actuellement affichée : "image" (bgRef) ou "video"
  // (videoBgContainerRef). Les deux couches se superposent dans le DOM, celle
  // de la vidéo étant au-dessus : le fondu de sortie ne doit piloter que la
  // couche affichée, sinon la dernière image de vidéo figée — qui peut dater de
  // plusieurs clics — se superpose au visuel réellement affiché.
  const bgIsVideoRef = useRef(false);
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
  // Quand le scroll reprend après un drag, l'offset s'estompe vers zéro pour
  // redonner la main à la piste : `dragEaseResetRef` arme le fondu, qui se
  // déroule dans `tick` pendant le défilement.
  const dragEaseResetRef = useRef(false);
  const dragEaseStartRef = useRef(0);
  // Active pointer-drag session: { startX, startY, lastX, lastY, pointerType, moved }.
  const dragStateRef = useRef(null);
  // True while the end-sequence spin animation is playing (drag is locked then).
  const spinningRef = useRef(false);
  // True while the cube is on screen and can be grabbed (after the intro, before the spin).
  const cubeDraggableRef = useRef(false);
  // Whether the cube's hit area must swallow native touches (`touch-action: none`).
  // Locked while the cube is grabbable, and while the code drives `scrollTop` itself.
  const touchLockRef = useRef(false);
  // Suppresses the native click following a real drag (used by handleCubeClick).
  const suppressClickRef = useRef(false);
  // When a tap is resolved on pointerup (mobile browsers can swallow the
  // synthesized click), remember where and when it happened so the native
  // click that does fire right afterwards is ignored instead of re-opening
  // the same face a second time.
  const tapPointRef = useRef(null);

  zoomedFacesRef.current = zoomedFaces;
  skipRevealedFacesRef.current = skipRevealedFaces;
  mediaRetractedRef.current = mediaRetracted;

  const faceImages = useMemo(() => {
    const srcs = images && images.length ? images : DEFAULT_FACE_MEDIA;

    const tokensByLabel = FACE_LABELS.map((l) => l.toLowerCase());

    // Nom de fichier (avec extension) et nom sans extension : le premier sert
    // au appariement partiel, le second à la correspondance exacte.
    const splitName = (s) => {
      const file = s.split("/").pop().split("?")[0].toLowerCase();
      return { file, stem: file.replace(/\.[^.]+$/, "") };
    };

    const srcNames = srcs.map((s) => {
      const { file, stem } = splitName(s);
      return { src: s, name: file, stem };
    });

    const mapped = new Array(FACES.length).fill(null);

    for (let i = 0; i < tokensByLabel.length; i++) {
      const token = tokensByLabel[i];
      // Passe 1 : correspondance exacte du nom sans extension ("web" ->
      // web.webm). Sans elle, un asset dont le nom CONTIENT le token serait
      // capté par la face correspondante — "mywebsite.webp" pour la face WEB.
      for (let j = 0; j < srcNames.length; j++) {
        if (!srcNames[j] || srcNames[j].stem !== token) continue;
        mapped[i] = srcNames[j].src;
        srcNames[j] = null;
        break;
      }
      if (mapped[i]) continue;
      // Passe 2 : correspondance partielle dans le nom de fichier, pour les
      // libellés qui ne sont pas le nom exact de l'asset.
      for (let j = 0; j < srcNames.length; j++) {
        if (!srcNames[j] || !srcNames[j].name.includes(token)) continue;
        mapped[i] = srcNames[j].src;
        srcNames[j] = null;
        break;
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
      // Sous `prefers-reduced-motion`, l'onde est quasi instantanée : elle fait
      // toujours son office (le voile doit être plein avant le basculement du
      // visuel, sinon pop), mais elle ne parcourt plus 700 ms d'anneau.
      duration: duration ?? (reduceMotion() ? 60 : expand ? 700 : 480),
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
  // appel remplace le sonar en cours de la même face : le voile ET l'anneau du
  // sonar précédent doivent être retirés, faute de quoi chaque anneau
  // interrompu resterait figé dans la face et s'accumulerait en cercles
  // concentriques.
  const runFaceSonar = useCallback((wrapper, i, reveal, opts = {}) => {
    const { duration, onClose, erase } = opts;
    const prev = faceSonarRef.current[i];
    if (prev) {
      prev.anime?.pause();
      prev.layer.mask.remove();
      prev.layer.ring.remove();
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
    // couvrir : distance du point au coin le plus éloigné de l'écran. La durée
    // de l'onde est plus courte sur mobile : le trajet est plus court sur un
    // petit écran, et le fond est le seul élément qui change au clic — le
    // laisser se propager 700 ms laissait l'écran vide trop longtemps.
    // Sous `prefers-reduced-motion`, pas de durée explicite : le `??` de
    // `buildSonarLayer` applique alors la durée quasi instantanée (60 ms), qui
    // fait l'office du voile — plein avant le basculement du visuel, sinon
    // pop — sans les 700 ms d'anneau. C'est l'appelant qui choisit : une durée
    // explicite court-circuite la préférence, ce qui est voulu sur mobile
    // (contrainte de lisibilité mesurée) mais pas ici.
    const mobile = isMobileDevice();
    const opts = sonarGeometry(bgRoot, cubeContainerRef.current);
    const layer = buildSonarLayer(bgRoot, true, {
      ...opts,
      ...(reduceMotion() ? {} : { duration: mobile ? MOBILE_BG_WAVE_MS : BG_WAVE_MS }),
    });
    const fire = () => layer.anime.play();
    bgSonarRef.current = { mask: layer.mask, ring: layer.ring, anime: layer.anime };

    const isVideo = isVideoUrl(url);
    if (!isVideo) {
      if (videoContainer) videoContainer.style.opacity = "0";
      if (videoBg) videoBg.pause();
      bgIsVideoRef.current = false;
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
      // La branche image vient de poser `transition: "none"` sur la couche
      // image et ne la remet jamais : sans cette restauration, le fondu de
      // sortie de l'image de fond se ferait d'un coup et le seul fondu visible
      // resterait celui de la vidéo. On rétablit donc la transition avant de
      // baisser l'opacité, pour que les deux couches se croisent en douceur.
      bg.style.transition = "opacity 0.35s ease";
      bg.style.opacity = "0";
      let fired = false;
      let mediaTimeout = 0;
      const start = () => {
        if (fired) return;
        fired = true;
        window.clearTimeout(mediaTimeout);
        videoContainer.style.opacity = "1";
        // La vidéo ne devient la couche affichée qu'ici, une fois lisible :
        // jusque-là c'est l'image précédente qui reste visible en fondu.
        bgIsVideoRef.current = true;
        // Sous `prefers-reduced-motion`, la vidéo reste figée sur sa première
        // image : le contenu (le projet montré) est identique, seul le
        // mouvement disparaît. `changeBackground` ne fait que révéler le
        // visuel — la lecture suit le geste de l'utilisateur (le clic), donc
        // ce n'est pas elle qu'on coupe, mais la boucle qui tourne ensuite.
        if (reduceMotion()) videoBg.pause();
        else videoBg.play().catch(() => {});
        if (delay > 0) {
          bgSonarRef.current.timeout = window.setTimeout(fire, delay);
        } else {
          fire();
        }
      };
      // Vidéo déjà chargée (clic sur la même face, ou retour arrière) :
      // `loadeddata` ne se reproduira pas, attendre le filet de 1400 ms ferait
      // attendre le fond pour rien. `readyState >= 2` = première image disponible.
      if (videoBg.src === url && videoBg.readyState >= 2) {
        start();
      } else {
        if (videoBg.src !== url) {
          videoBg.src = url;
          videoBg.load();
        }
        videoBg.addEventListener("loadeddata", start, { once: true });
        mediaTimeout = window.setTimeout(start, 1400);
      }

    }
  }, [faceImages, buildSonarLayer]);

  const stopFaceScramble = (i) => {
    const tl = faceScrambleTlRef.current[i];
    // `undefined` = aucune animation active, rien à restaurer. `null` = état
    // « codé » statique sous `prefers-reduced-motion` (`scrambleLabel` en mode
    // `cipher` y rend une image fixe sans boucle) : le texte affiché est
    // brouillé, il faut quand même restaurer le libellé final.
    if (tl === undefined) return;
    stopScramble(tl);
    faceScrambleTlRef.current[i] = undefined;
    const el = clickLabelRefs.current[i];
    if (el) el.textContent = FACE_LABELS[i];
  };

  // Remet le label à l'état « codé » : brouillage continu, jamais résolu.
  // C'est l'animation visible entre deux expositions et pendant le délai
  // avant décodage. Sous `prefers-reduced-motion`, `scrambleLabel` en mode
  // `cipher` rend une image fixe et renvoie `null` (pas de boucle infinie) :
  // le label reste brouillé sans scintiller, puis le décodage borné
  // (`decodeFaceLabel`, ~0,5 s) suit son cours normal. `stopScramble`
  // (`if (tl) tl.kill()`), `stopFaceScramble` (restaure aussi sur `null`) et
  // le `?.eventCallback` du tick l'acceptent déjà.
  const encodeFaceLabel = (i) => {
    const el = clickLabelRefs.current[i];
    if (!el) return;
    stopScramble(faceScrambleTlRef.current[i]);
    faceScrambleTlRef.current[i] = undefined;
    faceScrambleTlRef.current[i] = scrambleLabel(el, FACE_LABELS[i], {
      cipher: true,
    });
  };

  // Décodage (~0,55 s) : le brouillage se résout de gauche à droite vers le
  // texte final. Ne se déclenche qu'après une exposition continue d'1 s.
  const decodeFaceLabel = (i) => {
    const el = clickLabelRefs.current[i];
    if (!el) return;
    stopScramble(faceScrambleTlRef.current[i]);
    faceScrambleTlRef.current[i] = undefined;
    faceScrambleTlRef.current[i] = scrambleLabel(el, FACE_LABELS[i], {
      duration: FACE_LABEL_DECODE_MS / 1000,
    });
  };

  // Retrait immédiat de l'icône, sans fondu : au démontage, au clic sur une face
  // (le cube a obéi, l'invitation n'a plus lieu d'être) et avant chaque relecture.
  // `anime.remove` orpheline les cibles, sinon une animation encore en cours
  // continuerait d'écrire dans un élément rendu invisible.
  const stopPointer = useCallback(() => {
    if (pointerTlRef.current) {
      pointerTlRef.current.pause();
      pointerTlRef.current = null;
    }
    for (const target of [pointerRef.current, pointerGlyphRef.current, pointerRippleRef.current]) {
      if (target) anime.remove(target);
    }
    if (pointerRef.current) pointerRef.current.style.opacity = "0";
    if (pointerLabelRef.current) pointerLabelRef.current.style.opacity = "0";
  }, []);

  // Le geste, pas le message : deux tapes sur le label qui vient de se résoudre,
  // chacune suivie de son onde, puis un bref maintien et une sortie. Les instants
  // sont absolus et dérivés des constantes, jamais comptés à la main : une seule
  // durée à changer et les trois paliers suivent.
  //
  // Sous `prefers-reduced-motion`, pas d'icône de pointer : le geste (deux
  // tapes + onde, ~2,3 s) est une animation imposée, et le texte adjacent dit
  // déjà la même chose — « cliquez sur une face pour l'ouvrir ». On marque
  // quand même le tir : sans cela l'enregistrement `onComplete` resterait armé
  // et rejouerait le geste au décodage suivant, comme après une interruption.
  const playPointer = useCallback(() => {
    pointerPlayedRef.current = true;
    if (reduceMotion()) return;
    const el = pointerRef.current;
    if (!el) return;
    stopPointer();
    const glyph = pointerGlyphRef.current;
    const ripple = pointerRippleRef.current;
    const label = pointerLabelRef.current;
    // Une tape et son onde sous forme de fabrique : deux fois le même geste doit
    // être deux jeux de paramètres distincts, anime n'accepte pas qu'on réanime
    // un objet de paramètres déjà consommé par une timeline.
    const tap = () => ({
      targets: glyph,
      translateY: [
        { value: 6, duration: POINTER_TAP_MS },
        { value: 0, duration: POINTER_RELEASE_MS },
      ],
      scale: [
        { value: 0.88, duration: POINTER_TAP_MS },
        { value: 1, duration: POINTER_RELEASE_MS },
      ],
      easing: "easeInQuad",
    });
    const wave = () => ({
      targets: ripple,
      // Onde resserrée autour du glyphe : `1.7` sur un anneau de 104px le
      // projetait hors de la face, et a fortiori hors de la face inclinée où le
      // pointer se pose.
      scale: [
        { value: 0.2, duration: POINTER_TAP_MS },
        { value: 1.2, duration: POINTER_TAP_MS + POINTER_RELEASE_MS },
      ],
      opacity: [
        { value: 0.85, duration: POINTER_TAP_MS },
        { value: 0, duration: POINTER_TAP_MS + POINTER_RELEASE_MS },
      ],
      easing: "easeOutQuad",
    });
    const tapSpan = POINTER_TAP_MS + POINTER_RELEASE_MS;
    const t1 = POINTER_ENTER_MS;
    const t2 = t1 + tapSpan;
    const t3 = t2 + tapSpan + POINTER_HOLD_MS;
    const tl = anime.timeline({
      complete: () => {
        pointerTlRef.current = null;
      },
    });
    pointerTlRef.current = tl;
    tl.add(
      {
        targets: el,
        opacity: [0, 1],
        translateY: [14, 0],
        scale: [0.9, 1],
        duration: POINTER_ENTER_MS,
        easing: "easeOutCubic",
      },
      0,
    )
      .add(
        {
          targets: label,
          opacity: [0, 1],
          duration: POINTER_ENTER_MS,
          easing: "easeOutCubic",
        },
        0,
      )
      .add(tap(), t1)
      .add(wave(), t1)
      .add(tap(), t2)
      .add(wave(), t2)
      .add(
        {
          targets: el,
          opacity: 0,
          translateY: -10,
          duration: POINTER_EXIT_MS,
          easing: "easeInQuad",
        },
        t3,
      )
      .add(
        {
          targets: label,
          opacity: 0,
          duration: POINTER_EXIT_MS,
          easing: "easeInQuad",
        },
        t3,
      );
  }, [stopPointer]);

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
    if (galleryLabel && galleryLabel.textContent !== "")
      galleryLabel.textContent = "";
  };

  useEffect(() => () => {
    faceScrambleTlRef.current.forEach((tl) => stopScramble(tl));
    stopScramble(galleryScrambleTlRef.current);
    stopPointer();
  }, [stopPointer]);

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

  // Replie définitivement les visuels une fois la fin atteinte (scroll jusqu'au
  // bout ou sweep de skip) : le reverse qui suit retrouve un cube nu comme
  // après un skip.
  const retractMedia = useCallback(() => {
    if (mediaRetractedRef.current) return;
    mediaRetractedRef.current = true;
    setMediaRetracted(true);
  }, []);

  // Un clic sur une face relève manuellement le repli : le cube renoue avec le
  // mode navigation classique (les médias se ré-exposent).
  const unretractMedia = useCallback(() => {
    if (!mediaRetractedRef.current) return;
    mediaRetractedRef.current = false;
    setMediaRetracted(false);
  }, []);

  const handleFaceClick = useCallback((i) => {
    // Clic pendant le reverse (médias repliés après la fin) : on relève le
    // repli et on affiche aussitôt la face + le fond, animations sonar
    // comprises, même si la position de scroll est encore dans la fenêtre de
    // sortie. `revealOverrideRef` neutralise le fondu jusqu'au prochain scroll.
    if (mediaRetractedRef.current) revealOverrideRef.current = true;
    unretractMedia();
    zoomedFaceRef.current = i;
    setZoomedFaces((prev) => {
      const n = [...prev];
      n[i] = true;
      return n;
    });
    const n = [...zoomedFacesRef.current];
    n[i] = true;
    if (n.every(Boolean)) {
      // Dernier clic : le fond s'affiche lui aussi avec son effet sonar, comme
      // à chaque clic précédent. Le simple fondu de fin, lui, ne se déclenchera
      // qu'à la poursuite du scroll, au moins une seconde après ce clic
      // (fenêtre de grâce gérée par `exitArmUntilRef`).
      allClickedRef.current = true;
      exitArmUntilRef.current = Date.now() + 1000;
      if (tickRef.current) tickRef.current();
    }
    changeBackground(i, isMobileDevice() ? MOBILE_BG_REVEAL_DELAY_MS : BG_REVEAL_DELAY_MS);
    revealFaceMedia(i);
    clickStackRef.current = [...clickStackRef.current.filter((idx) => idx !== i), i];
    if (clickLabelRefs.current[i]) {
      clickLabelRefs.current[i].style.opacity = "0";
      stopFaceScramble(i);
    }
    // L'icône a fait son office dès qu'une face s'ouvre : elle disparaît plutôt
    // que de flotter au-dessus de la vidéo agrandie.
    if (i === POINTER_FACE) stopPointer();
    const video = (cubeRef.current?.children[i] || document).querySelector("video");
    if (video) {
      video.currentTime = 0;
      // Même traitement que le fond : image figée sous `prefers-reduced-motion`,
      // lecture sinon. Le visiteur a cliqué, le visuel est là dans les deux cas.
      if (reduceMotion()) video.pause();
      else video.play().catch(() => {});
    }
  }, [changeBackground, revealFaceMedia, unretractMedia, stopPointer]);

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

  // Équivalent clavier du clic : sans lui, la zone du cube n'est atteignable
  // qu'au pointeur et le contenu du portfolio reste inaccessible au clavier.
  // Seule la face la plus frontale est ouverte — celle que l'utilisateur voit.
  // On ne capte PAS les flèches : la section est elle-même le conteneur de
  // défilement, et les flèches doivent continuer à faire défiler la piste, qui
  // pilote la rotation du cube. La navigation au clavier reste donc
  // « défiler pour tourner, Entrée pour ouvrir », cohérente avec le scrub.
  const handleCubeKeyDown = useCallback(
    (e) => {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      e.preventDefault();
      if (!facesVisibleRef.current) return;
      const baseRot = getCubeRotation(currentPRef.current);
      const rot = {
        rx: baseRot.rx + dragOffsetRef.current.rx,
        ry: baseRot.ry + dragOffsetRef.current.ry,
      };
      let best = -1;
      let bestAmount = 0;
      for (let i = 0; i < 6; i++) {
        if (!faceImages[i]) continue;
        const n = FACE_NORMALS[i];
        const amount = faceFrontAmount(n[0], n[1], n[2], rot.rx, rot.ry);
        if (amount > bestAmount) {
          bestAmount = amount;
          best = i;
        }
      }
      if (best < 0) return;
      // Même garde que le hit-test au pointeur : une face ne s'ouvre qu'une
      // fois son label révélé ou son média déjà exposé.
      const labelShown = faceVisibilityCountRef.current[best] >= FACE_LABEL_REVEAL_COUNT;
      const mediaShown = zoomedFacesRef.current[best];
      if (labelShown || mediaShown) handleFaceClick(best);
    },
    [faceImages, handleFaceClick],
  );

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

  // Changement d'onglet depuis un overlay : on remplace l'entrée d'historique
  // au lieu d'en empiler une par onglet (sinon chaque onglet deviendrait un pas
  // « retour »), et on remonte la page projet affichée.
  const openProjectFromOverlay = useCallback(
    (i) => {
      if (typeof window !== "undefined" && overlayScrollRef.current) {
        overlayScrollRef.current.scrollTop = 0;
      }
      setSelectedProject(i);
      if (typeof window !== "undefined") {
        try {
          const state = { ufoProject: i };
          const url = new URL(window.location.href);
          url.searchParams.set("project", String(i + 1));
          window.history.replaceState(state, "", url.pathname + url.search);
        } catch {}
      }
    },
    []
  );

  // Fermeture de l'overlay contact. Factorisée hors du JSX parce qu'elle a
  // maintenant trois points d'entrée : le bouton RETOUR, l'onglet CONTACT de la
  // barre, et la touche Échap branchée plus bas.
  const closeContactOverlay = useCallback(() => {
    setShowContact(false);
    if (
      typeof window !== "undefined" &&
      window.history?.state?.ufoContact
    ) {
      try {
        window.history.replaceState(null, "", window.location.href);
      } catch {}
    }
  }, []);

  // Fermeture de l'overlay projet, partagée par la flèche de la barre d'onglets,
  // le bouton « ← RETOUR » en bas de page et la touche Échap.
  const closeProjectOverlay = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.history &&
      window.history.state &&
      typeof window.history.state.ufoProject === "number"
    ) {
      window.history.back();
      return;
    }
    setSelectedProject(null);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("project");
        window.history.replaceState(null, "", url.pathname + url.search);
      } catch {}
    }
  }, []);

  // Les deux overlays ne peuvent pas être ouverts en même temps. Ils l'étaient :
  // l'onglet CONTACT de la barre du projet appelle `onContactClick`, qui ne
  // remet pas `selectedProject` à null. Visuellement ça ne se voyait pas — le
  // contact est opaque et au-dessus — mais deux `aria-modal` simultanés sont
  // invalides, et surtout deux pièges de focus se seraient disputé Échap, le
  // fermant d'un coup sur les deux. Le projet reste donc en mémoire et se
  // réaffiche au retour du contact, ce qui reproduit exactement ce que le
  // visiteur voit aujourd'hui.
  const projectOverlayOpen = selectedProject !== null && !showContact;

  // Piège de focus, focus initial et touche Échap sur les deux overlays.
  useDialogFocus(showContact, contactDialogRef, closeContactOverlay);
  useDialogFocus(projectOverlayOpen, projectDialogRef, closeProjectOverlay);

  // Verrou d'orientation : aucun contrôle à focaliser, donc on pose le focus sur
  // le dialogue lui-même pour que son titre et sa description soient annoncés.
  useEffect(() => {
    if (!isMobileLandscape) return;
    orientationLockRef.current?.focus?.({ preventScroll: true });
  }, [isMobileLandscape]);

  useEffect(() => {
    const portraitQuery = window.matchMedia?.("(orientation: portrait)");
    const updateOrientation = () => {
      const portrait = window.innerHeight >= window.innerWidth;
      setIsMobileLandscape(isRealMobileDevice() && !portrait);
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
    //
    // Il existait ici une reprise de pose via `restorePRef` : l'effet devait
    // pouvoir se réinstaller en cours de chorégraphie sans tout remettre à zéro.
    // La ref n'était écrite par personne, donc `restoreP` valait toujours `null`,
    // et les vingt-cinq lignes de restauration qu'elle conditionnait ne
    // s'exécutaient jamais. Le mécanisme a été retiré avec son code : ce qui
    // reste ici est le cas réel, c'est-à-dire un remontage à zéro.
    const el = sectionRef.current;
    const cube = cubeRef.current;
    if (!el || !cube) return;
    const mobileScroll = isMobileDevice();

    el.scrollTop = 0;

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

    // Étendue de la piste de scroll, en pixels : `scrollHeight - offsetHeight`,
    // soit la distance entre le haut et le bas du parcours.
    //
    // Elle était relue à chaque frame, à sept endroits. C'est une lecture de
    // layout, donc synchrone et bloquante, et elle intervenait après une
    // écriture de `el.scrollTop` — c'est-à-dire un aller-retour forcé du moteur
    // de rendu, deux fois par frame sur les chemins autoplay, reset et skip, et
    // une fois de plus par événement de scroll dans `sync`.
    //
    // Elle est lue du track — la piste de scroll, pas la section. La section est
    // le conteneur : sa boîte fait `100svh` quelle que soit la longueur du
    // contenu, donc l'observer ne déclencherait rien d'utile. Mesurer le track
    // (`10 * 100svh`) permet de recalculer à partir de la boîte qui produit
    // vraiment le `scrollHeight`.
    //
    // Le recalcul est observersur la boîte, pas déduit d'un `resize` : c'est la
    // seule façon d'être sûr de ne pas manquer une variation. La hauteur ne
    // devrait dépendre que du CSS, et `svh` est la taille *réduite* — donc la
    // barre d'adresse mobile ne la change pas — mais une fontechargée en
    // différé, un overlay rendu dans le flux ou une règle CSS future le
    // pourraient. Sur un cache périmé, l'autoplay écrirait `scrollTop` au
    // mauvais endroit : la piste s'arrêterait avant la fin, ou le cube
    //"sauterait" en fin de parcours. Observer la boîte rend ce cas impossible.
    let scrollExtent = 0;
    const measureScrollExtent = () => {
      scrollExtent = el.scrollHeight - el.offsetHeight;
    };
    measureScrollExtent();
    const track = el.firstElementChild;
    const extentObserver =
      typeof ResizeObserver !== "undefined" && track
        ? new ResizeObserver(measureScrollExtent)
        : null;
    // Repli pour un environnement sans `ResizeObserver` : les deux seules causes
    // attendues à la construction — rotation et redimensionnement de fenêtre.
    // `orientationchange` couvre aussi le cas où `resize` ne se déclenche pas.
    const onViewportChange = () => measureScrollExtent();
    if (extentObserver) {
      extentObserver.observe(track);
    } else {
      window.addEventListener("resize", onViewportChange);
      window.addEventListener("orientationchange", onViewportChange);
    }

    // Bascule du visuel vers le fond vide (couleur de base), sans aucun pop :
    // l'image est retirée pendant que la transparence repasse en douceur.
    const emptyBackground = () => {
      if (videoBgContainerRef.current) videoBgContainerRef.current.style.opacity = "0";
      if (videoBgRef.current) videoBgRef.current.pause();
      bgIsVideoRef.current = false;
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

    // Retour du fond : le visuel est effacé et le fond repasse sur la couleur
    // de base, sans aucun pop ni effet sonar — juste un fondu. L'onde radiale
    // est réservée à l'entrée de chaque visuel ; la sortie se contente d'un
    // simple fondu, comme le repli des faces.
    const resetBackground = () => {
      if (videoBgContainerRef.current) videoBgContainerRef.current.style.opacity = "0";
      if (videoBgRef.current) videoBgRef.current.pause();
      if (bgSonarRef.current) {
        bgSonarRef.current.anime?.pause();
        bgSonarRef.current.mask.remove();
        bgSonarRef.current.ring.remove();
        window.clearTimeout(bgSonarRef.current.timeout);
        bgSonarRef.current = null;
      }
      emptyBackground();
    };

    // ---- Single master timeline ----
    // Every stage of the animation lives in this one timeline. Its playhead is
    // driven by scroll progress (tl.seek), so the entire animation scrubs
    // forwards and backwards and is fully reversible.
    const SQUARE_POINTS =
      "0,0 50,0 100,0 150,0 200,0 250,0 300,0 300,50 300,100 300,150 300,200 300,250 300,300 250,300 200,300 150,300 100,300 50,300 0,300 0,250 0,200 0,150 0,100 0,50";
    // Pose initiale de la « souris » (silhouette arrondie + molette) portée par
    // le même polygone. Pendant le retour, la ligne de fin d'animation repart en
    // carré puis glisse vers cette silhouette au lieu d'un simple fondu.
    const MOUSE_POINTS =
      "135,150 136,144 139,139 144,136 150,135 156,136 161,139 164,144 165,150 165,155 165,160 165,165 165,170 164,176 161,181 156,184 150,185 144,184 139,181 136,176 135,170 135,165 135,160 135,155";

    const W = {
      wheelFade: 200,
      morph: 1600,
      fadeIn: 120,
      idle: 5000,
      showcase: 3200,
      facesOut: 900,
      cubeFade: 600,
      spin: 3000,
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
      W.showcase +
      W.facesOut +
      W.cubeFade +
      W.spin +
      W.squareIn +
      W.cubeOut +
      W.lineMorph +
      W.namesRise;
    const INTRO_END = (W.wheelFade + W.morph + W.fadeIn) / TOTAL;
    const CUBE_END = (W.wheelFade + W.morph + W.fadeIn + W.idle) / TOTAL;
    // Phase showcase : le cube fait un tour complet EN MONTRANT les six visuels,
    // avant leur fondu. Elle est pilotée par la tête de timeline, comme le spin
    // qui suit.
    const SHOW_START = CUBE_END;
    const SHOW_END = CUBE_END + W.showcase / TOTAL;
    // La fenêtre de fondu des visuels est désormais celle qui suit la
    // showcase, et non plus celle qui précède le spin.
    const SPIN_START = SHOW_END + (W.facesOut + W.cubeFade) / TOTAL;
    const SPIN_END = SPIN_START + W.spin / TOTAL;
    const LINE_POS = TOTAL - (W.lineMorph + W.namesRise);
    const NAMES_START = (LINE_POS + W.lineMorph) / TOTAL;
    const NAMES_END = NAMES_START + W.namesRise / TOTAL;
    // The cube only rotates on the part of the scroll that comes after the intro.
    const CUBE_RANGE = 1 - INTRO_END;
    // Dernière pose de rotation du cube : le spin l'emporte au-delà. Sert de
    // borne haute à la pose de base pendant la galerie du skip, pour qu'aucune
    // de ses six poses ne dépasse la fin du spin.
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
      .add({ duration: W.showcase })
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

    // L'effet repart toujours de zéro : pas de reprise de pose (voir le commentaire
    // en tête d'effet). Les refs survivent au remontage, pas ces deux variables.
    let targetP = 0;
    let currentP = 0;
    let rafId = null;
    let lastTickTime = 0;
    // Pose du cube au moment du déverrouillage (6e clic) : `lockedCubeP` est la
    // position de scroll gelée, celle de la face qui vient d'être cliquée. La
    // fin de la séquence part de là — le cube ne se replace jamais ailleurs, et
    // la showcase démarre sur le visuel que l'utilisateur vient de choisir.
    let lockedCubeP = 0;
    // Once every face has been clicked, the end sequence plays out at a steady
    // pace (autoplay) instead of snapping to the real scroll position.
    let autoplay = false;
    // Timer d'avancement partagé du sweep de skip et de ses galeries.
    let autoplayElapsed = 0;
    // Origine du scroll automatique de fin : la position du cube au moment où le
    // scroll démarre. La fin de la piste EST la fin de la séquence (`p = 1`), donc
    // ce scroll part de là où le cube se trouve réellement, sans téléportation.
    // La grâce d'une seconde (`exitArmUntilRef`) retarde seulement son départ.
    let autoplayStartP = null;
    // Dernière position de scroll écrite par l'autoplay, en pixels. Sert à
    // distinguer notre propre écriture d'un geste réel de l'utilisateur.
    let autoScrollPx = 0;
    // Tête de lecture de la timeline pendant le scroll automatique de fin, et son
    // point de départ. C'est un DEUXIÈME canal, distinct du scroll : la timeline
    // était verrouillée à `min(p, CUBE_END)` tant que les 6 faces n'étaient pas
    // cliquées, alors que le scroll, lui, peut être bien plus avancé. Au moment du
    // 6e clic, `unlocked` passe à vrai et la tête suitrait sinon le scroll d'un
    // seul bloc, en faisant sauter le spin, le carré et la ligne. Elle repart donc
    // d'où le verrou la tenait, et file vers 1 à la même vitesse que le scroll.
    let tlAutoplayP = null;
    let tlAutoplayStartP = null;
    // Position (timeline units) the skip morph glides up from. On the manual
    // skip that equals the start pose, so the cube holds still while its faces
    // fold in; on the automatic load it is wherever the page was, so the intro
    // sweep gently rides up to the cube during the fold instead of jumping.
    let skipFrom = 0;
    let skipLate = false;
    // Durées des séquences autonomes. Elles NE dépendent PAS de
    // `prefers-reduced-motion`, et c'est délibéré.
    //
    // Le mode réduit raccourcissait ces trois budgets (2600/3200/1800 ->
    // 400/500/300) sans toucher à l'angle parcouru : la showcase fait
    // toujours 360° et le spin toujours une révolution. Réduire la durée sans
    // réduire la distance n'annule pas le mouvement, ça l'ACCÉLÈRE — la
    // showcase passait de 138 à 900 deg/s, le spin de 112 à 720 deg/s. Sur
    // mobile, où « réduire les animations » est souvent actif par défaut,
    // c'était la rotation automatique qui devenait beaucoup trop rapide.
    //
    // La piste doit toujours atteindre le bout — c'est ce qui dévoile les
    // liens et CONTACT — et les fondus qui accompagnent ces segments restent
    // en place. Seule l'onde de masquage garde sa durée réduite, parce que ce
    // n'est qu'un fondu de voile et non un déplacement d'objet.
    //
    // Le sweep de la galerie suit la même règle : mêmes durées qu'en régime
    // normal. Le réduire sans réduire l'arc parcouru (six poses + six
    // rotations) l'accélérerait au lieu de l'adoucir, et le figer à zéro
    // stationnait sur chaque pose sans rotation entre les labels. Seul le
    // re-brouillage continu est neutralisé : l'état « codé » devient une
    // image fixe, puis le décodage borné suit son cours normal.
    // Budgets de la fin écrite, segment par segment, et non plus un total unique.
    // La tête de timeline traversait `[CUBE_END, 1]` à vitesse égale, si bien que
    // le spin n'en recevait que 27,6 % (48,8 % sur le chemin du skip) et la
    // révolution que les 60 % premiers de cette fenêtre — soit 1,4 s par tour à
    // SKIP_FINALE_MS = 15000, donc 353 ms par palier de 90°. Gonfler le total de
    // 3,4x ne déplaçait donc presque rien : c'est ce que.payait la demi-douzeaine
    // de commits « ralentit les rotations finales » qui se sont succédé sans effet
    // visible. Chaque segment porte maintenant son budget, et la révolution se lit
    // sur SPIN_MS quel que soit le coût de la showcase et de la queue.
    // Ces budgets ont été une fois de trop. La suppression du `smoothstep` a
    // supprimé les à-coups — c'est elle qui réglait la vitesse perçue, pas la
    // durée — et une fois le profil plat, 9 s de spin donnaient 5,4 s par
    // révolution : trop lent.
    //
    // Et ce plafond était encore 1,8x le desktop. Ce n'est pas la durée qui
    // rendait la fin lisible sur mobile, c'était l'easing par palier qui
    // l'accélarabait par moments : le profil à présent est plat — le spin varie
    // de 0,90x à 1,07x sur sa fenêtre, sans arrêt — donc l'allonger ne rendait
    // plus rien lisible, ça ne faisait que tourner lentement. Sur une
    // révolution de showcase, mobile était à 80 deg/s contre 138 sur desktop,
    // et le spin à 102 contre 175. On ramène le mobile à ~1,15x du desktop : un
    // peu plus lent, parce que l'écran est plus petit, mais dans le même ordre
    // de grandeur.
    //
    // Ces trois durées couvrent les deux cas signalés : la fin écrite après le 6e
    // clic (SHOW+SPIN+TAIL) et la rotation de fin de skip (SPIN+TAIL). Du 6e
    // clic au dernier nom, mobile passe de ~14,8 s à ~9,9 s.
    const SHOW_MS = mobileScroll ? 3000 : 2600;
    const SPIN_MS = mobileScroll ? 3700 : 3200;
    const TAIL_MS = mobileScroll ? 2000 : 1800;
    const FINALE_MS = SHOW_MS + SPIN_MS + TAIL_MS;
    // Budget du rattrapage entre le 6e clic et CUBE_END. La fin se cale sur la
    // PLAGE de timeline qu'elle joue réellement, pas sur le point de départ du
    // clic : sur mobile on peut enchaîner les six tapes près de INTRO_END, et
    // étirer toute la rampe `[tlAutoplayStartP, 1]` sur un total fixe
    // comprime alors d'autant la fin écrite. Le rattrapage reçoit donc son propre
    // budget, et `[CUBE_END, 1]` garde exactement le budget de la fin écrite.
    //
    // Ce rattrapage est du temps mort, et il peut donc être minuscule : sous
    // CUBE_END la timeline ne contient qu'un segment vide (`.add({ duration:
    // W.idle })`), la pose de base est gelée dans `lockedCubeP` et les labels
    // suivent `visRot`, lui aussi gelé. Rien ne bouge avant CUBE_END. On ne
    // garde que de quoi faire voyager la tête sans à-coup, et la showcase part
    // dès l'expiration de la grâce. Sans rattrapage (6e clic à ou après
    // CUBE_END, le cas desktop), le minutage est celui d'avant.
    const AUTOPLAY_CATCHUP_MS = 250;
    // Budget du rattrapage, en ms réelles, décidé à l'armement (0 si le 6e clic
    // est déjà à CUBE_END). `autoplayTotalMs` vaut alors ce rattrapage plus la
    // fin écrite : le scroll garde ainsi sa rampe d'origine, et seule la tête de
    // timeline reçoit les budgets par segment.
    let autoplayTotalMs = FINALE_MS;
    let autoplayCatchMs = 0;
    // Marche la fin écrite depuis `fromP`, en donnant à chaque segment son
    // budget. Un `fromP` déjà passé SPIN_START (6e clic tardif, ou skip pressé
    // pendant le spin) saute la showcase et part tout de suite sur SPIN_MS : la
    // révolution n'est plus comprimée par ce qui la précède.
    const runFinale = (fromP, elapsed) => {
      if (fromP < SPIN_START) {
        if (elapsed < SHOW_MS) return fromP + (SPIN_START - fromP) * (elapsed / SHOW_MS);
        elapsed -= SHOW_MS;
      }
      if (elapsed < SPIN_MS) return SPIN_START + (SPIN_END - SPIN_START) * (elapsed / SPIN_MS);
      elapsed -= SPIN_MS;
      return SPIN_END + (1 - SPIN_END) * Math.min(1, elapsed / TAIL_MS);
    };
    // Skipped intro: faces come back out and each one is exposed frontally for
    // a moment (roughly two seconds, label included), then the cube folds and
    // the finale plays at its own readable pace.
    //
    // Les durées du sweep NE dépendent PAS de `prefers-reduced-motion` :
    // réduire la durée sans réduire l'arc parcouru n'adoucit rien, ça
    // accélère (même angle en moins de temps), et les mettre à zéro fige le
    // cube sur chaque pose sans rotation entre les labels. Seul le
    // re-brouillage continu est neutralisé sous `reduce` (image fixe, cf.
    // `scramble.js`) — le décodage borné suit son cours, et la rotation garde
    // son rythme normal, comme la finale.
    const SKIP_MORPH_MS = 900;
    // Sur mobile, 400 ms de rotation entre deux faces donnaient un cube qui
    // bascule trop vite après l'apposition des onglets : la transition est
    // allongée pour rester lisible sur un écran tactile. 800 ms était
    // cependant encore 2x le desktop, pour la même raison que les budgets de
    // fin ci-dessus : la lisibilité venait de l'easing par palier, qui
    // n'existe plus. On revient à 500 ms.
    const SKIP_TURN_MS = isMobileDevice() ? 500 : 400;
    const SKIP_LEAD_MS = 400;
    const SKIP_GAP_MS = 1100;
    // Durée totale du finale de skip. Elle ne sert plus qu'àborner la séquence
    // entière : le minutage lui-même est porté par `runFinale`, qui donne au spin
    // son budget propre. SPIN_START + 1 est atteint en SPIN_MS + TAIL_MS.
    const SKIP_FINALE_MS = SPIN_MS + TAIL_MS;
    // Timestamp of the last scroll nudge back to the labelled-face pin.
    let lastPinFix = 0;
    // Effort de recul cumulé (px) depuis `reverseAnchor`, la position de
    // scroll à partir de laquelle on mesure. Franchir `REVERSE_TRIGGER_PX`
    // rejoue le même retour que le bouton. Une position de scroll qui avance
    // vers le bas remet le compteur à zéro et ré-ancrage.
    let reverseAnchor = 0;
    let reverseEffort = 0;
    // Point le plus bas (le plus reculé) atteint depuis le dernier ré-ancrage.
    // L'effort se mesure depuis ce point et non depuis la position courante :
    // sur mobile, un rebond d'inertie ou de élastique fait remonter la position
    // de quelques px en pleine descente, et un compteur remis à zéro sur le
    // moindre `real >= reverseAnchor` perdait alors tout le recul déjà acquis —
    // d'où un reset qui arrivait une fois sur deux selon la façon dont l'OS
    // découpait les deltas.
    let reverseDeepest = 0;
    // Distance de recul (en pixels de scroll, pas en pourcentage) qu'il faut
    // accumuler vers le haut pour valider le retour. Calibré pour être
    // nettement supérieur au bruit d'un trackpad et d'un tap de doigt, mais
    // franchi en un geste franc — un molettage continu ou un swipe.
    const REVERSE_TRIGGER_PX = 120;
    // Ré-ancrage : le recul n'est annulé que si l'utilisateur revient
    // vers le bas de plus que cette distance depuis son point le plus reculé.
    // Un simple rebond ne l'annule pas.
    const REVERSE_CANCEL_PX = 60;
    // Fondu de retour au début : un balayage programmé de CUBE_END vers 0,
    // pendant lequel la détection de recul est suspendue.
    let resetPlay = false;
    let resetFrom = 0;
    let resetElapsed = 0;
    const RESET_MS = 1800;
    // Duration de disparition des noms au début du retour : ils doivent quitter
    // l'écran (fondu + glissement vers le bas) avant que la ligne de fin
    // d'animation ne se transforme en « souris ».
    const RESET_NAMES_MS = 350;
    // Morphing du retour : une fois les textes partis, la ligne (carré aplati)
    // se redéploie d'abord en carré plein, puis ce carré glisse lentement sur la
    // silhouette de la « souris » pendant que la molette refait son apparition.
    const RESET_LINE_GROW_MS = 350;
    const RESET_MORPH_MS = 650;
    // Fin du morphing, calculée à partir des phases qui le précèdent. L'invite
    // « SCROLL DOWN » ne quitte le fondu de la piste qu'après ce point, pour
    // n'apparaître qu'une fois la « souris » entièrement reformée. La fenêtre
    // qui accompagne la fin du sweep de retour (RESET_REVEAL_MS) démarre donc
    // exactement ici et s'étend jusqu'au bout du retour.
    const RESET_MORPH_END_MS =
      RESET_NAMES_MS + RESET_LINE_GROW_MS + RESET_MORPH_MS;
    const RESET_REVEAL_MS = RESET_MS - RESET_MORPH_END_MS;
    // Poses (rotation units) the skip gallery lingers on, one per exposed face,
    // computed from where the cube is when the sweep starts. `galleryFace` holds the
    // matching face index: the palier boundaries are no longer evenly spaced (they
    // follow the rotation arc), so a face can no longer be recovered by multiplying
    // the position by 12 and taking the remainder.
    let galleryRot = [];
    let galleryFace = [];
    let galleryDur = 0;
    const gallerySetup = (start) => {
      galleryRot = [];
      galleryFace = [];
      galleryDur = 0;
      lastGalleryLabelTextRef.current = "";
      stopGalleryScramble();
      const startRot = Math.max(0, (start - INTRO_END) / CUBE_RANGE);
      if (startRot <= CUBE_STEP_BOUNDS[5] + 1e-9) {
        for (let k = 0; k < 6; k++) {
          if (CUBE_STEP_BOUNDS[k] >= startRot - 1e-9) {
            galleryRot.push(CUBE_STEP_BOUNDS[k]);
            galleryFace.push(k);
          }
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
        lit: faceEl.querySelector(".face-lit"),
        media: faceEl.querySelector("img,video"),
        wrapper: faceEl.querySelector(".face-media-wrapper"),
      };
    });

    const sync = () => {
      // While the skip sweep runs, always steer toward the end of the section.
      if (skipRef.current) {
        targetP = 1;
        return;
      }
      const sb = scrollExtent;
      // Reading the section's own scrollTop avoids the layout read of
      // getBoundingClientRect on every scroll frame — smoother on mobile.
      // `scrollExtent` is cached for the same reason, one step further: it used
      // to be `el.scrollHeight - el.offsetHeight`, read here on every scroll
      // event. See `measureScrollExtent`.
      const pos = el.scrollTop;
      const real = sb > 0 ? Math.min(1, Math.max(0, pos / sb)) : 0;
      // Le scroll automatique est IMPOSÉ : la position est pilotée par l'autoplay
      // et un geste de l'utilisateur ne doit pas pouvoir reprendre la main. On ne
      // compare donc plus la position lue à notre dernière écriture pour y voir un
      // geste, et on ne rend jamais la main : `targetP` suit la position que
      // l'autoplay vient d'écrire (`autoScrollPx`), jamais celle lue. La tête de
      // timeline reste par ailleurs pilotée par `tlAutoplayP` (voir plus bas),
      // donc la fin se joue au rythme écrit pour elle quel que soit le geste.
      if (autoplay) {
        if (sb > 0) {
          targetP = Math.min(1, Math.max(0, autoScrollPx / sb));
        }
        return;
      }
      // Pendant le sweep de reset, le scroll est piloté par le code : la
      // détection de recul est suspendue.
      if (resetPlay) {
        targetP = currentP;
        return;
      }
      // Scroll inverse : PENDANT l'animation (avant la fin), il est libre. Le
      // cube rembobine et l'état se déroule dans `tick` (médias repliés par
      // position, labels re-codés, fond repris). Une fois la fin atteinte
      // (noms levés, `returnShownRef` latché), reculer n'est plus un simple
      // rembobinage mais un vrai retour : on déclenche exactement le même
      // balayage programmé que le bouton RETOUR (voir `goToStartRef`), plutôt
      // que de figer la tête au point le plus loin atteint et de contrer le
      // geste de l'utilisateur.
      if (returnShownRef.current) {
        // Effort de recul mesuré depuis `reverseAnchor` — le point de départ du
        // geste — mais évalué au point le plus reculé atteint (`reverseDeepest`)
        // et non à la position courante. On l'accumule plutôt que de tester
        // `real` brutalement : les gestes réels (molette, trackpad, doigt)
        // produisent des rafales de petits deltas inverses — bruit et inertie —
        // qui ne doivent pas suffire à rejouer 1,8 s de retour. Il faut un recul
        // franc. En partant du point le plus reculé, un rebond de quelques px
        // (inertie, élastique) ne fait plus repartir le compteur de zéro.
        if (real < reverseDeepest) reverseDeepest = real;
        reverseEffort = (reverseAnchor - reverseDeepest) * sb;
        // Annulation : l'utilisateur revient franchement vers le bas, il n'a pas
        // confirmé le retour. On ré-ancre sur sa position et le point le plus
        // reculé repart avec elle. Un simple rebond reste sous cette distance et
        // conserve donc le recul déjà mesuré.
        if ((reverseDeepest - real) * sb >= REVERSE_CANCEL_PX) {
          reverseAnchor = real;
          reverseDeepest = real;
          reverseEffort = 0;
        }
        if (reverseEffort >= REVERSE_TRIGGER_PX) {
          // Recul franc : on rejoue le retour, exactement comme le bouton.
          goToStartRef.current?.();
          return;
        }
        // Tant que le recul n'est pas confirmé, la tête reste où elle est : on
        // ne laisse pas la position glisser vers l'arrière en attendant.
        targetP = currentP;
        return;
      }
      reverseEffort = 0;
      reverseAnchor = real;
      reverseDeepest = real;
      targetP = real;
      // Une reprise du scroll recentre la rotation laissée par un drag : la
      // piste redonne la main, l'offset s'éteint en fondu dans `tick` pendant
      // le défilement, faces et labels se réalignent.
      if (
        !dragEaseResetRef.current &&
        (dragOffsetRef.current.rx !== 0 || dragOffsetRef.current.ry !== 0)
      ) {
        dragEaseResetRef.current = true;
        dragEaseStartRef.current = performance.now();
      }
      // Tout scroll utilisateur annule l'override de révélation : le fondu de
      // fin peut reprendre la main dès que la position le redemande.
      revealOverrideRef.current = false;
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
            // Sous `prefers-reduced-motion`, le rattrapage de verrou part sans
            // glisse. C'est un repositionnement imposé par le code, pas un
            // geste de l'utilisateur : l'animation ici est inutile et c'est
            // précisément le type de mouvement que la préférence neutralise.
            el.scrollTo({
              top: pinP * sb,
              behavior: reduceMotion() ? "auto" : "smooth",
            });
          }
          targetP = pinP;
        }
      }
      // Après le dernier clic, la fin ne part qu'à la poursuite du scroll, et
      // au plus tôt une seconde plus tard (fenêtre de grâce). Aucun verrou ici :
      // la tête suit simplement le scroll, et c'est `tick` qui retarde son propre
      // départ. Empêcher ici le scroll de dépasser CUBE_END revient à disputer
      // la position à l'autoplay, qui la pilotait déjà.
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

      // L'autoplay EST un scroll automatique : il se contente d'avancer la
      // position de scroll de la section. `sync` la relit, `targetP` la suit, et
      // le lissage exponentiel de `currentP` fait le reste — exactement le même
      // chemin qu'un scroll utilisateur. La fin de la séquence EST le bas de la
      // piste (`p = 1`), donc la position d'arrivée est la même et le cube
      // repart de là où il se trouve réellement : aucune téléportation possible.
      //
      // La fenêtre de grâce d'une seconde après le dernier clic (`exitArmRef`)
      // retarde seulement le départ de ce scroll : le cube reste sur la pose qui
      // vient d'être cliquée, le temps que le label de cette face soit lisible.
      if (autoplay) {
        if (Date.now() < exitArmUntilRef.current) {
          // Grâce : on tient la tête et le scroll sur la pose cliquée. La tête de
          // timeline n'est pas touchée : elle reste où le verrou la tenait, donc
          // rien ne bouge à l'écran pendant cette seconde.
          autoplayElapsed = 0;
          targetP = currentP;
          const sbGrace = scrollExtent;
          if (sbGrace > 0) {
            autoScrollPx = currentP * sbGrace;
            el.scrollTop = autoScrollPx;
          }
        } else {
          const sbAuto = el.scrollHeight - el.offsetHeight;
          if (sbAuto <= 0) {
            autoplay = false;
            tlAutoplayP = null;
            tlAutoplayStartP = null;
          } else {
            // Progression linéaire de la position de scroll. La courbe perçue
            // est celle du lissage de `currentP` vers `targetP`, donc celle d'un
            // scroll utilisateur — pas une fonction de temps maison. Un
            // `scrollTo({behavior:"smooth"})` par frame s'empilerait et rendrait
            // la durée non déterministe, d'où l'écriture directe de `scrollTop`.
            //
            // La tête de timeline n'avance PAS avec le scroll : elle part du point
            // où le verrou la tenait (armement) et file vers 1 à la même vitesse.
            // Ainsi la fin se rejoue en entier — spin, carré, ligne, noms — au
            // rythme pour lequel elle a été écrite, au lieu d'en sauter la plus
            // grosse partie parce que le scroll était déjà loin au moment du clic.
            autoplayElapsed += dt;
            const k = Math.min(1, autoplayElapsed / autoplayTotalMs);
            const nextP = autoplayStartP + (1 - autoplayStartP) * k;
            autoScrollPx = nextP * sbAuto;
            el.scrollTop = autoScrollPx;
            // La tête ne traverse pas `[tlAutoplayStartP, 1]` à vitesse égale :
            // sous CUBE_END il n'y a qu'un rattrapage, bridé à son budget, et la
            // fin écrite garde ensuite ses budgets par segment. Sans ce partage,
            // un clic prématuré (six tapes enchaînées sur mobile) étirait la rampe
            // sur le même budget et compressait la fin écrite. Les deux branches
            // se raccordent en CUBE_END et finissent en 1 : la tête reste
            // continue, donc aucun saut.
            tlAutoplayP =
              autoplayElapsed < autoplayCatchMs
                ? tlAutoplayStartP +
                  (CUBE_END - tlAutoplayStartP) * (autoplayElapsed / autoplayCatchMs)
                : runFinale(CUBE_END, autoplayElapsed - autoplayCatchMs);
            // Fin de course : la tête de timeline est épinglée à 1, et on cesse de
            // piloter le scroll. `p` converge vers 1 par lissage et la rejoint,
            // donc les deux têtes se rejoignent sans discontinuité.
            if (k >= 1) {
              autoplay = false;
              autoplayStartP = null;
              tlAutoplayStartP = null;
              tlAutoplayP = 1;
              // La mesure de recul repart de l'arrivée réelle. Sans ce
              // ré-ancrage, `reverseAnchor` gardait la position d'avant le
              // finale (là où le cube était au 6e clic) et le tout premier
              // delta de recul tombait dans la branche d'annulation : il
              // fallait parfois deux gestes là où un suffisait.
              reverseAnchor = 1;
              reverseDeepest = 1;
              reverseEffort = 0;
            }
            // Une fois `p` rejoint la tête (ou si l'utilisateur a repris la
            // main), la timeline n'a plus de canal séparé à tenir : `sync` la
            // remet à null au premier geste, et ici dès que `p` l'a rattrapée.
            if (tlAutoplayP !== null && !autoplay && currentP >= tlAutoplayP) {
              tlAutoplayP = null;
            }
          }
        }
      }

      // Sweep de retour au début (bouton RETOUR) : balayage programmé de
      // CUBE_END vers 0, pendant lequel toute la logique d'intro/clic est gelée.
      if (resetPlay) {
        resetElapsed += dt;
        const k = Math.min(1, resetElapsed / RESET_MS);
        currentP = resetFrom * (1 - k);
        targetP = currentP;
        let sbReset = scrollExtent;
        if (sbReset > 0) el.scrollTop = currentP * sbReset;
        // Les noms « PHILIPPE BARBOSA / CONCEPTEUR DÉVELOPPEUR » disparaissent
        // dès le début du retour (fondu + glissement vers le bas), avant que la
        // ligne de fin d'animation ne se rematérialise en « souris ».
        const namesK = Math.min(1, resetElapsed / RESET_NAMES_MS);
        const namesE = namesK * namesK * (3 - 2 * namesK);
        names.style.opacity = String(1 - namesE);
        sub.style.opacity = String(1 - namesE);
        names.style.transform = `translateY(${70 * namesE}px)`;
        sub.style.transform = `translateY(${-70 * namesE}px)`;
        // Réapparition en douceur de la « souris » par morphing : une fois les
        // textes entièrement disparus (RESET_NAMES_MS), la ligne de fin
        // d'animation (carré aplati) se redéploie en carré, puis ses points
        // glissent jusqu'à la silhouette de la souris pendant que la molette
        // revient en son centre. L'invite « SCROLL DOWN » refait surface sur la
        // dernière portion du retour.
        const growK = Math.min(
          1,
          Math.max(0, (resetElapsed - RESET_NAMES_MS) / RESET_LINE_GROW_MS),
        );
        const growE = growK * growK * (3 - 2 * growK);
        body.style.transform = `scale(1, ${Math.max(0.0001, growE)})`;
        const morphK = Math.max(
          0,
          Math.min(
            1,
            (resetElapsed - (RESET_NAMES_MS + RESET_LINE_GROW_MS)) / RESET_MORPH_MS,
          ),
        );
        const morphE = smoothstep(morphK);
        body.setAttribute(
          "points",
          interpolatePoints(SQUARE_POINTS, MOUSE_POINTS, morphE),
        );
        wheel.style.opacity = String(morphE);
        const revealK = Math.max(
          0,
          Math.min(1, (resetElapsed - (RESET_MS - RESET_REVEAL_MS)) / RESET_REVEAL_MS),
        );
        const revealE = 1 - (1 - revealK) * (1 - revealK) * (1 - revealK);
        hint.style.opacity = String(revealE);
        if (resetElapsed >= RESET_MS) {
          resetPlay = false;
          resetFrom = 0;
          resetElapsed = 0;
          currentP = 0;
          targetP = 0;
          if (sbReset > 0) el.scrollTop = 0;
          // Les noms repartent masqués (translateY bas) mais visibles pour la
          // prochaine montée : la piste n'agit pas sur leur opacité.
          names.style.opacity = "1";
          sub.style.opacity = "1";
          mediaRetractedRef.current = false;
          setMediaRetracted(false);
          setShowReturn(false);
        }
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Le brouillage apparaît à la seconde visibilité : le label reste « codé »
      // pendant LABEL_DECODE_DELAY_MS d'exposition, puis se résout. À 0, le
      // décodage démarre dès la première frame. Dès que la face n'est plus
      // exposée, le compte repart de zéro.
      // Frozen during the auto sweep: there the labels are driven solely by the
      // gallery, otherwise they would light up mid-rotation.
      // This runs before the rotation for this frame is resolved, so it reads
      // `lastWireRotRef` — the orientation actually applied to the cube. It
      // trails by one frame while scrolling, and is exact once at rest. The ref
      // starts at Infinity to force the first wireframe build, hence the guard.
      const wireRot = lastWireRotRef.current;
      const visRot = Number.isFinite(wireRot.rx) ? wireRot : { rx: 0, ry: 0 };
      if (!skipActiveRef.current && !resetPlay) {
        // Rembobinage (scroll inverse) : la tête redescend, `diff` devient
        // négatif. Les comptes d'exposition se dé-font alors en miroir — une
        // face qui sort de vue rend un compte — pour que les labels se re-codent
        // et soient re-découverts au prochain passage avant.
        const rewinding = diff < 0;
        for (let i = 0; i < 6; i++) {
          const nowVisible = isFaceVisible(
            FACE_NORMALS[i][0],
            FACE_NORMALS[i][1],
            FACE_NORMALS[i][2],
            visRot.rx,
            visRot.ry,
          );
          if (nowVisible && !faceWasVisibleRef.current[i]) {
            if (!rewinding) {
              faceVisibilityCountRef.current[i]++;
            }
            // Lors d'un retour, une face qui redevient frontale ne « compte »
            // pas : seul le passage avant alimente le compte de révélation.
          } else if (!nowVisible && faceWasVisibleRef.current[i] && rewinding) {
            faceVisibilityCountRef.current[i] = Math.max(
              0,
              faceVisibilityCountRef.current[i] - 1,
            );
          }
          const revealed = faceVisibilityCountRef.current[i] >= FACE_LABEL_REVEAL_COUNT && (!zoomedFacesRef.current[i] || mediaRetractedRef.current);
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
                // Sous `prefers-reduced-motion`, c'est une image fixe (pas de
                // boucle infinie de re-brouillage), et le décodage borné suit
                // son cours normal — l'image reste lue en deux temps.
                encodeFaceLabel(i);
                faceScrambleStateRef.current[i] = "encoded";
              }
              faceExposureElapsedRef.current[i] += dt;
              // Décodage immédiat dès l'exposition. Il existait ici un délai
              // (`LABEL_DECODE_DELAY_MS`) qui retardait le passage au texte lisible,
              // avec une branche d'attente et un drapeau `pendingDecode` pour tenir
              // la boucle d'animation en vie le temps de ce délai. Le délai avait
              // été ramené à 0 : la branche d'attente était donc inatteignable et
              // le drapeau ne servait plus à rien. Le décodage n'a pas besoin
              // d'une frame de plus, donc les deux ont été retirés.
              if (faceScrambleStateRef.current[i] === "encoded") {
                  // `scrambleLabel` part d'un rendu entièrement aléatoire, donc
                  // le décodage démarre proprement même depuis l'état « none ».
                  decodeFaceLabel(i);
                  faceScrambleStateRef.current[i] = "decoded";
                  // Le pointer ne se montre qu'une fois par introduction, et sur
                  // la face dont le label se résout en premier. Il attend la FIN
                  // du décodage : c'est le mot entier, résolu, qu'il vient
                  // souligner — le déclencher au départ mettrait le geste sur
                  // un brouillage. `kill()` (voir `stopScramble`) ne déclenche
                  // pas `onComplete` : une interruption laisse donc la course
                  // entière sans icône, et le décodage suivant la rejouera.
                  if (i === POINTER_FACE && !pointerPlayedRef.current) {
                    faceScrambleTlRef.current[i]?.eventCallback(
                      "onComplete",
                      playPointer,
                    );
                  }
                }
            } else {
              faceExposureElapsedRef.current[i] = 0;
              // Face sortie de vue : le label redevient « codé » au prochain
              // passage, pour rejouer le cycle à la prochaine exposition.
              if (faceScrambleStateRef.current[i] === "decoded") {
                encodeFaceLabel(i);
                faceScrambleStateRef.current[i] = "encoded";
              }
            }
          } else if (faceScrambleStateRef.current[i] !== "none") {
            faceExposureElapsedRef.current[i] = 0;
            // Rembobinage : le compte est redescendu sous le seuil, le label
            // redevient invisible jusqu'à la prochaine exposition avant.
            const lblEl = clickLabelRefs.current[i];
            if (lblEl) lblEl.style.opacity = "0";
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
          // Le skip pilote sa propre chorégraphie : l'origine de la rampe de fin
          // n'a plus lieu d'être, on repart d'une base neutre. L'autoplay doit
          // Cesser avec elle : la laissant active, `autoplayStartP` valait null
          // et la frame suivante calculait `null + (1 - null) * k` = NaN, dont
          // le `el.scrollTop = NaN` gelait la section à une position arbitraire.
          autoplay = false;
          autoplayStartP = null;
          tlAutoplayP = null;
          tlAutoplayStartP = null;
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
          currentP = runFinale(skipFrom, autoplayElapsed);
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
          let labelReady = false;
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
              labelIdx = labelOn ? galleryFace[j] : -1;
              // Le label n'est « montrable » qu'une fois son décodage terminé :
              // l'onglet correspondant ne se révèle qu'à ce moment précis. En
              // pose directe (mobile ou `prefers-reduced-motion`), pas de
              // décodage : l'onglet se révèle avec le label, dès son apparition.
              labelReady =
                labelOn &&
                (reduceMotion() || isMobileDevice() || loc >= SKIP_LABEL_READY_MS);
            } else if (j < galleryRot.length - 1) {
              const tt = SKIP_TURN_MS > 0
                ? smoothstep(Math.min(1, (loc - SKIP_HOLD_MS) / SKIP_TURN_MS))
                : 1;
              galP = galleryRot[j] + (galleryRot[j + 1] - galleryRot[j]) * tt;
              labelIdx = -1;
            } else {
              galP = galleryRot[j];
            }
          }
          if (labelReady && !skipRevealedFacesRef.current[labelIdx]) {
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
              // état « codé ». Sur mobile ou sous `prefers-reduced-motion`,
              // pas de brouillage sur le skip : le texte est posé directement
              // via `textContent` (`stopGalleryScramble` coupe la boucle
              // éventuelle puis vide le label). La rotation, elle, garde son
              // rythme normal : réduire la durée sans réduire l'arc
              // l'accélérerait au lieu de l'adoucir.
              galleryExposureElapsedRef.current = 0;
              if (wantText === "") {
                stopGalleryScramble();
              } else if (reduceMotion() || isMobileDevice()) {
                stopGalleryScramble();
                galleryLabel.textContent = wantText;
              } else {
                encodeGalleryLabel(wantText);
              }
            }
          }
          // Tant que le label est « codé », on cumule son temps d'exposition et
          // on déclenche le décodage une fois le délai écoulé, comme pour les
          // labels de face. Le texte est donc lisible avant le fondu de sortie.
          // Sur mobile ou sous `prefers-reduced-motion`, pas de décodage sur
          // le skip : l'état reste « none » (texte posé directement
          // ci-dessus), ce bloc ne se déclenche pas. Si le réglage s'active en
          // cours de hold (état « encoded » déjà armé), on rabat sur le texte
          // direct plutôt que de décoder.
          if (labelIdx >= 0 && galleryScrambleStateRef.current === "encoded") {
            if (reduceMotion() || isMobileDevice()) {
              stopGalleryScramble();
              galleryLabel.textContent = FACE_LABELS[labelIdx];
            } else {
              galleryExposureElapsedRef.current += dt;
              if (galleryExposureElapsedRef.current >= SKIP_LABEL_CIPHER_MS) {
                decodeGalleryLabel(FACE_LABELS[labelIdx]);
              }
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
          const gapK = SKIP_GAP_MS > 0
            ? smoothstep((autoplayElapsed - SKIP_MORPH_MS - galleryDur) / SKIP_GAP_MS)
            : 1;
          const galEnd = galleryRot.length > 0
            ? INTRO_END + galleryRot[galleryRot.length - 1] * CUBE_RANGE
            : start;
          currentP = galEnd + (SPIN_START - galEnd) * gapK;
        } else {
          // Finale (spin, line, name) at its own steady pace on the blank cube.
          skipFacesHiddenRef.current = true;
          skipFoldRef.current = false;
          currentP = runFinale(SPIN_START, autoplayElapsed - SKIP_MORPH_MS - galleryDur - SKIP_GAP_MS);
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
          galleryFace = [];
          galleryDur = 0;
          // La mesure de recul repart de l'arrivée réelle. Pendant TOUT le sweep,
          // `sync` sort en tête (skip actif) et n'a donc jamais ré-ancré
          // `reverseAnchor` : laissée à sa valeur initiale, elle vaut 0 et
          // `reverseDeepest` ne peut que descendre sous 0. L'effort de recul
          // restait alors à 0 pour toujours et le scroll inverse de la fin ne se
          // déclenchait plus jamais — même après le bouton RETOUR.
          reverseAnchor = 1;
          reverseDeepest = 1;
          reverseEffort = 0;
        }
        rafId = requestAnimationFrame(tick);
      } else if (Math.abs(diff) < SNAP_THRESHOLD && !autoplay) {
        // The cube is at rest: park the loop.
        // `!autoplay` évite de garer pendant le scroll automatique : `targetP` y
        // relit la position avec un frame de retard, donc `diff` peut être nul
        // alors que la tête doit encore descendre.
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
      // Sur la première frame où les 6 faces sont cliquées, on arme l'autoplay en
      // relevant deux origines distinctes, car deux choses avancent différemment :
      //
      // - `autoplayStartP` : la position réelle du cube, origine du SCROLL. La fin
      //   part donc de la face qui vient d'être cliquée, jamais de CUBE_END, donc
      //   aucune téléportation du cube n'est possible.
      // - `tlAutoplayStartP` : la position de la TIMELINE, qui était encore
      //   verrouillée juste avant ce clic. La reprendre ici est ce qui évite le
      //   saut : sans cela, `unlocked` passant à vrai, la tête de timeline aurait
      //   suivi le scroll d'un coup jusqu'à `autoplayStartP`, et toute la fin
      //   (spin, carré, ligne, noms) aurait été jouée instantanément.
      //
      // Le cube ne bouge pas avant l'expiration de la grâce (`exitArmUntilRef`),
      // le temps que le label de la face cliquée soit lisible.
      //
      // Le verrou `wasUnlockedRef` ne doit être posé qu'ici, quand l'autoplay a
      // réellement démarré : le poser systématiquement brûlait le latch sans
      // lancer la fin dès que la position était sous CUBE_END, et l'autoplay ne
      // pouvait alors plus jamais démarrer avant le bouton RETOUR.
      if (unlocked && !wasUnlockedRef.current) {
        wasUnlockedRef.current = true;
        autoplay = true;
        autoplayElapsed = 0;
        autoplayStartP = currentP;
        // La pose de repos de la fin est GELÉE ici, sur la position de scroll de
        // l'instant — celle de la face qui vient d'être cliquée. Sans cela
        // `baseP` repartait de 0 au déverrouillage : le cube revenait d'un coup
        // à la face « front », remplaçant le visuel choisi par un autre.
        lockedCubeP = Math.max(0, (currentP - INTRO_END) / CUBE_RANGE);
        tlAutoplayStartP = Math.min(currentP, CUBE_END);
        // Répartition du budget : la fin écrite garde ses budgets par segment, et
        // le rattrapage entre le 6e clic et CUBE_END prend le reste. Sans
        // rattrapage — 6e clic à ou après CUBE_END — il n'y a rien à rattraper.
        const catchSpan = Math.max(0, CUBE_END - tlAutoplayStartP);
        autoplayCatchMs = catchSpan > 0 ? AUTOPLAY_CATCHUP_MS : 0;
        autoplayTotalMs = autoplayCatchMs + FINALE_MS;
        // La tête de timeline est verrouillée sur cette valeur pendant toute la
        // grâce, puis avance avec le scroll automatique (voir plus haut).
        tlAutoplayP = tlAutoplayStartP;
        // On aligne tout de suite la position de scroll réelle sur la tête, et on
        // note cette écriture : c'est elle que `sync` comparera à la position
        // lue pour distinguer notre scroll d'un geste réel.
        const sbArm = scrollExtent;
        if (sbArm > 0) {
          el.scrollTop = currentP * sbArm;
          autoScrollPx = el.scrollTop;
        }
        if (!rafId) rafId = requestAnimationFrame(tick);
      }
      const p = currentP;

      // Tête de lecture de la timeline. Tant que les faces ne sont pas toutes
      // cliquées, elle est verrouillée en fin de phase d'attente : la fin de la
      // séquence (noms, liens, CONTACT) ne doit pas apparaître avant que
      // l'utilisateur ait vu et cliqué les six faces.
      //
      // `tlAutoplayP` sert pendant le scroll automatique de fin. Le verrou
      // ci-dessus tient la timeline en CUBE_END alors que le scroll, lui, peut
      // déjà être bien plus loin (le pin des faces vit dans toute la plage de
      // rotation du cube). Relâcher le verrou brutalement faisait donc passer la
      // tête de CUBE_END à la position du clic d'un seul bloc : le spin, le
      // carré, la ligne et les noms étaient joués instantanément — « on passe
      // directement à la fin ». La tête reprend ici exactement au point d'où
      // elle était arrêtée (`tlAutoplayP` part de ce même point), et avance
      // jusqu'à 1 en même temps que le scroll, sans jamais sauter.
      //
      // En fin de course, `p` n'a pas encore rattrapé 1 quand l'autoplay s'arrête
      // (il suit la tête par lissage exponentiel) : on garde donc la valeur
      // finale tant qu'elle est en avant, pour ne pas faire reculer la timeline
      // de ce reliquat. Dès que `p` l'a rattrapée, les deux valent 1 et la
      // condition bascule sans discontinuité.
      const tlP = tlAutoplayP !== null && (autoplay || tlAutoplayP > p)
        ? tlAutoplayP
        : unlocked
          ? p
          : Math.min(p, CUBE_END);
      tl.seek(tlP * TOTAL);
      // L'animation est terminée dès que les noms sont levés : le bouton RETOUR
      // apparaît alors. Ce latch sert aussi de seuil — au-delà, reculer ne
      // rembobine plus mais déclenche le même retour (voir `sync`).
      if (!returnShownRef.current && unlocked && tlP >= NAMES_END && !resetPlay) {
        returnShownRef.current = true;
        setShowReturn(true);
      }
      facesVisibleRef.current = tlP < SPIN_START;
      // Le drag manuel est inactif pendant le sweep de reset et le skip : la
      // pose y est chorégraphiée, un offset du doigt y désyncroniserait les
      // labels des faces réellement frontales.
      const draggableNow = tlP > INTRO_END && tlP < SPIN_START && !resetPlay && !skipActiveRef.current;
      // La zone avale le scroll natif (`touch-action: none`) quand elle a besoin du
      // geste — la rotation — et pendant TOUS les balayages programmés (skip et
      // reset), où `tick` réécrit `scrollTop` à chaque frame : un pan natif
      // concurrent se battrait avec ces écritures et la chorégraphie saccaderait.
      // Partout ailleurs (avant l'intro, pendant l'autoplay, à la fin) la zone
      // laisse passer le pan, sinon le scroll inverse de la fin resterait mort
      // sur la surface que le cube occupe à l'écran.
      const touchLockNow = draggableNow || resetPlay || skipActiveRef.current;
      if (touchLockNow !== touchLockRef.current) {
        touchLockRef.current = touchLockNow;
        setTouchLock(touchLockNow);
      }
      cubeDraggableRef.current = draggableNow;

      // La fin est atteinte dès que les noms sont levés — que ce soit par
      // l'autoplay, le sweep de skip ou un scroll manuel jusqu'au bout. On
      // latche alors le repli des médias et du fond : le scroll inverse qui
      // suit retrouve un cube nu avec ses labels (identique au reverse post-skip).
      // Un simple clic sur une face relève ce repli.
      if (!mediaRetractedRef.current && tlP >= NAMES_START) retractMedia();

      // Show/hide the cube only while the square is gone. The cube's own
      // opacity is driven by the timeline (complementary to the square fade).
      if (contentEl) {
        contentEl.style.pointerEvents = tlP > INTRO_END - W.fadeIn / TOTAL ? "auto" : "none";
      }

      const cubeP = Math.max(0, (p - INTRO_END) / CUBE_RANGE);
      // Avant le déverrouillage, la pose suit le scroll. Après, la fin est
      // chorégraphiée : la pose de repos est celle de la face cliquée, gelée
      // dans `lockedCubeP`. Le clamp `Math.min(cubeP, ROT_END)` qui précédait
      // causait un snap visible — le pin de la face cliquée peut se trouver
      // au-delà de ROT_END (jusqu'à p = 1), et le cube reculait alors de 13 à
      // 43 % d'une rotation à la frame du 6e clic, remplaçant le visuel de la
      // face choisie par celui d'une autre.
      //
      // Le skip fait exception. Il n'a pas de face cliquée : `skipIntro` force
      // `allClickedRef` pour débloquer la fin, et sa galerie écrit `currentP`
      // pour exhiber les six poses, une par une. Geler la base y annulait
      // complètement la parade — le cube restait figé face au spectateur pendant
      // que les labels passaient d'une face à l'autre. Le skip retrouve donc le
      // clamp d'origine, borné à la rotation pour qu'aucune pose de galerie ne
      // dépasse la fin du spin.
      const baseP = unlocked
        ? skipRef.current
          ? Math.min(cubeP, ROT_END)
          : lockedCubeP
        : cubeP;
      let rot = getCubeRotation(baseP);
      // `spinning` ne passe à vrai qu'au spin à vide, celui qui replie les
      // visuels : la showcase tourne avec les images déployées et garde donc
      // `spinning` à faux. C'est ce qui évite que le branchement de rendu plus
      // bas (`spinning || skipFacesHiddenRef`) les replie à mi-tour.
      let spinning = false;
      // Phase showcase : un tour COMPLET et CONTINU du cube, les six visuels
      // restant déployés sur les faces pendant toute la rotation. Ce n'est pas
      // une présentation face par face : rien ne s'arrête, la vitesse est
      // constante, et les six images défilent devant le spectateur comme sur
      // le cube muet qui les portait déjà. Le tour part de `lockedCubeP` — la
      // pose gelée au 6e clic — donc il démarre sur le visuel choisi par
      // l'utilisateur, sans snap, et revient à cette même pose à la fin.
      if (unlocked && !skipRef.current && tlP > SHOW_START && tlP <= SHOW_END) {
        const k = Math.min(1, Math.max(0, (tlP - SHOW_START) / (SHOW_END - SHOW_START)));
        // Une révolution complète, répartie entre les deux axes comme le spin
        // qui suit, pour que chaque face passe bien devant le spectateur.
        // L'easing estuni : la vitesse reste constante sur tout le tour.
        const rev = k * 2;
        rot = {
          rx: rot.rx + rev * 180,
          ry: rot.ry + rev * 180,
        };
        // `spinning` reste faux : ici les visuels restent déployés, alors que
        // le spin les replie. C'est `showcasing` qui distingue les deux.
      }
      if (unlocked && tlP > SPIN_START) {
        if (spinFromRef.current === null) {
          // Le spin part de la pose acquise (fin de showcase ou `lockedCubeP`)
          // et non d'une valeur reventilée : la reprise est donc invisible.
          spinFromRef.current = rot;
        }
        const from = spinFromRef.current;
        const k = Math.min(1, (tlP - SPIN_START) / (SPIN_END - SPIN_START));
        // Vitesse CONSTANTE dans chaque palier, sans `smoothstep`. L'easing par
        // palier était la vraie cause du « toujours trop rapide » : il repart de
        // zéro à chaque frontière de segment, donc le cube accélère, décélère,
        // repart — quatre fois de suite. Le mouvement se lisait comme une suite
        // de à-coups quelle que soit la durée totale, ce qui explique que les
        // quatre commits « ralentit les rotations finales » n'aient rien changé
        // de visible : ils allongeaient un budget sans toucher à ce profil.
        // Ici la dérivée est plate : la seule sensation de vitesse est celle de
        // `SPIN_MS`.
        const seg = (start, end) => Math.min(1, Math.max(0, (k - start) / (end - start)));
        // Quatre paliers de 90° alternés Y-X-Y-X sur les 60% de la fenêtre, et
        // non quatre paliers de 180° sur 80% : le cube fait une révolution au
        // lieu de deux, et chaque palier est deux fois plus court.
        const SPIN_STEP = 90;
        const ryTurn = (seg(0, 0.15) + seg(0.3, 0.45)) * SPIN_STEP;
        const rxTurn = (seg(0.15, 0.3) + seg(0.45, 0.6)) * SPIN_STEP;
        const ryMid = from.ry + ryTurn;
        const rxMid = from.rx + rxTurn;
        // Le placement final ramène chaque axe sur le multiple de 360 le plus
        // proche. Son amplitude dépend du nombre de tours qui précèdent : à quatre
        // tours de 180°, l'écart accumulé atteignait ~450°, et il était serré
        // dans les 20% de fenêtre les plus courts — c'est de là que venait le
        // à-coup final. Deux choses le calment : une révolution au lieu de deux
        // laisse l'écart bien plus faible, et il dispose maintenant des 40%
        // restants. Les deux gardent la pose d'arrivée sur (0, 360).
        const ryMod = ((ryMid % 360) + 360) % 360;
        const rxMod = ((rxMid % 360) + 360) % 360;
        const ry = ryMid + ((360 - ryMod) % 360) * seg(0.6, 1);
        const rx = rxMid - rxMod * seg(0.6, 1);
        rot = { rx, ry };
        spinning = true;
      } else {
        spinFromRef.current = null;
      }
      // `showcasing` couvre le tour où le cube tourne AVEC les six visuels
      // déployés, `spinning` celui où il tourne à vide. Le rendu des faces en
      // dépend : le premier garde les images dépliées, le second les replie.
      //
      // Le sweep du skip est exclu : ses deux dernières poses de galerie tombent
      // à l'intérieur de la fenêtre de showcase (SHOW_START < galEnd < SHOW_END).
      // Sans cette garde, la showcase leur ajoutait sa torsion `rev * 180`, qui
      // dénaturait deux choses : les faces 4 et 5 n'étaient plus frontales sous
      // leur label — le texte flottait alors sur une image de côté — et la
      // torsion apparaissait d'un coup puis disparaissait d'un autre au passage de
      // SHOW_END, soit deux à-coups de 180° autour du spin de fin. Le skip écrit
      // toute la chorégraphie lui-même et n'a pas de segment showcase à jouer.
      const showcasing = unlocked && !skipRef.current && tlP > SHOW_START && tlP <= SHOW_END;
      spinningRef.current = spinning;

      // The direct drag adds a fixed offset over the scroll-driven orientation.
      // From the end-sequence spin onward the offset fades out so the cube
      // returns to its aligned ("square") rest pose before the names appear.
      let dragRx = dragOffsetRef.current.rx;
      let dragRy = dragOffsetRef.current.ry;
      // Pendant le skip, la pose est pilotée à la frame : un décalage de
      // rotation encore porté par le doigt décalerait chaque exposition frontale
      // et désynchroniserait le label (gallery ou faces) de la face réellement
      // face au spectateur. L'offset s'éteint donc progressivement sur le morph
      // d'entrée du skip et reste nul pendant toute la parade.
      if (skipActiveRef.current) {
        const k = Math.min(1, autoplayElapsed / SKIP_MORPH_MS);
        const ease = 1 - k * k * (3 - 2 * k);
        dragRx *= ease;
        dragRy *= ease;
      }
      // Reprise du scroll après un drag : l'offset de rotation s'estompe vers
      // zéro pendant le défilement pour réaligner faces et labels sur la piste.
      if (dragEaseResetRef.current) {
        const k = Math.min(
          1,
          Math.max(0, (performance.now() - dragEaseStartRef.current) / DRAG_EASE_MS),
        );
        const ease = 1 - k * k * (3 - 2 * k);
        dragRx *= ease;
        dragRy *= ease;
        if (k >= 1) {
          dragEaseResetRef.current = false;
          dragOffsetRef.current = { rx: 0, ry: 0 };
        }
      }
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
        // Pose le cube exactement sur une face nette. Les frontières de palier suivent
        // l'arc de rotation et ne sont donc plus à k/12 : l'armer sur un multiple
        // de 1/12 le laisserait entre deux paliers, à l'angle, là où il se lisait
        // jusqu'ici.
        const cubeP = Math.max(0, (currentP - INTRO_END) / CUBE_RANGE);
        const snapBaseP = nextCubeStepBound(cubeP);
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
      } else if (bgResetRef.current && tlP < CUBE_END && !mediaRetractedRef.current) {
        bgResetRef.current = false;
        const last = clickStackRef.current[clickStackRef.current.length - 1];
        if (typeof last === "number") changeBackground(last);
      }
      // Per-face lighting: rotate face normal by current cube rotation
      if (cubeRef.current) {
        // Le fondu des six visuels (et du fond) est celui qui SUIT la showcase,
        // pas celui qui la précède : les images restent entières pendant tout
        // le tour qui les montre, puis s'éteignent ensemble sur cette fenêtre.
        // Fenêtre entièrement réversible.
        const exitK = unlocked ? Math.min(1, Math.max(0, (tlP - SHOW_END) / (SPIN_START - SHOW_END))) : 0;
        // Après un clic en reverse, la révélation prime : le fondu de fin est
        // suspendu le temps que la face et le fond s'affichent en entier.
        const exitActive = exitK > 0 && !revealOverrideRef.current;
        for (let i = 0; i < 6; i++) {
          const cached = faceCache[i];
          if (!cached) continue;
          const { el: faceEl, lit, media, wrapper } = cached;
          const n = FACE_NORMALS[i];
          const [rxn, ryn, rzn] = rotateVecByXY(n[0], n[1], n[2], rot.rx, rot.ry);
          const dot = Math.max(0, rxn * LIGHT_DIR[0] + ryn * LIGHT_DIR[1] + rzn * LIGHT_DIR[2]);
          const brightness = 0.35 + 1.3 * dot;
          // During the sweep the media stay folded away, but the lighting keeps
          // tracking the cube rotation: the frontally exposed face always reads
          // fully lit, the others fall off naturally.
          if (skipFoldRef.current) {
            if (media) media.style.filter = "";
            if (lit) lit.style.filter = `brightness(${brightness})`;
            if (faceEl.style.filter) faceEl.style.filter = "";
            continue;
          }
          if (showcasing) {
            // Showcase : le cube tourne en gardant les six visuels déployés sur
            // ses faces — c'est le cube lui-même, déjà porteur des six images,
            // qui tourne, pas une présentation face par face. L'éclairage reste
            // celui de la normale de chaque face, donc la face frontale se lit
            // et les autres tombent naturellement dans l'ombre pendant le tour.
            if (media) media.style.filter = "";
            if (wrapper) {
              wrapper.style.transition = "none";
              wrapper.style.opacity = "1";
              wrapper.style.transform = "scale(1)";
              wrapper.style.maskImage = "";
              wrapper.style.webkitMaskImage = "";
            }
            if (lit) lit.style.filter = `brightness(${brightness})`;
            if (faceEl.style.filter) faceEl.style.filter = "";
          } else if (spinning || skipFacesHiddenRef.current) {
            if (media) media.style.filter = "";
            if (wrapper) {
              wrapper.style.transition = "none";
              wrapper.style.opacity = "1";
              wrapper.style.transform = "scale(0)";
              wrapper.style.maskImage = "";
              wrapper.style.webkitMaskImage = "";
            }
            if (lit) lit.style.filter = `brightness(${brightness})`;
            if (faceEl.style.filter) faceEl.style.filter = "";
          } else if (exitActive) {
            // Sortie : un fondu général — les six visuels, la vidéo et le fond
            // s'éteignent d'un même geste sur toute la fenêtre (EXIT_MS),
            // piloté par le scroll (totalement réversible). À l'aboutissement,
            // le spin laisse le fond vide (couleur de base). `bgResetRef` sert
            // de garde : au rewind sous CUBE_END, le fond se ré-vêle.
            const k = smoothstep(exitK);
            const fade = 1 - k;
            // Après la fin (repli médias/fond verrouillé), le reverse dans cette
            // fenêtre ne doit JAMAIS ré-exposer l'image ni la vidéo de fond : ils
            // restent fondus à 0 (couleur de base), même si l'utilisateur repasse
            // dans la zone de sortie.
            const bgFade = mediaRetractedRef.current ? 0 : fade;
            if (!bgResetRef.current) {
              bgResetRef.current = true;
              if (videoBgRef.current) videoBgRef.current.pause();
            }
            // Le fondu ne concerne QUE la couche réellement affichée ; l'autre
            // est épinglée à 0. Les piloter toutes les deux faisait réapparaître
            // la dernière image de vidéo figée (couches superposées, la vidéo
            // au-dessus) au lieu du visuel affiché — et la faisait remonter en
            // fondu au rewind alors qu'aucun clic ne la concernait.
            if (bg) {
              bg.style.transition = "none";
              bg.style.opacity = bgIsVideoRef.current ? "0" : String(bgFade);
            }
            if (videoBgContainerRef.current) {
              videoBgContainerRef.current.style.transition = "none";
              videoBgContainerRef.current.style.opacity = bgIsVideoRef.current
                ? String(bgFade)
                : "0";
            }
            if (wrapper) {
              wrapper.style.transition = "none";
              wrapper.style.opacity = String(fade);
              wrapper.style.maskImage = "";
              wrapper.style.webkitMaskImage = "";
            }
            if (media) media.style.filter = `brightness(${brightness})`;
            if (lit) lit.style.filter = "";
            if (faceEl.style.filter) faceEl.style.filter = "";
          } else if (zoomedFacesRef.current[i] && !mediaRetractedRef.current) {
            if (media) media.style.filter = `brightness(${brightness})`;
            if (lit) lit.style.filter = "";
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
            if (lit) lit.style.filter = `brightness(${brightness})`;
            if (faceEl.style.filter) faceEl.style.filter = "";
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

    // Retour au début de l'animation (bouton RETOUR, ou scroll inverse passé
    // le seuil) : arrête tout balayage en cours, remet l'état à neuf puis balaie
    // CUBE_END → 0, revisitant l'intro en sens inverse pour revenir proprement au
    // point de départ.
    goToStartRef.current = () => {
      if (resetPlay) return;
      autoplay = false;
      autoplayStartP = null;
      tlAutoplayP = null;
      tlAutoplayStartP = null;
      skipRef.current = false;
      skipActiveRef.current = false;
      skipLate = false;
      skipFoldRef.current = false;
      skipFacesHiddenRef.current = false;
      clickStackRef.current = [];
      allClickedRef.current = false;
      wasUnlockedRef.current = false;
      allSeenTwiceRef.current = false;
      revealOverrideRef.current = false;
      exitArmUntilRef.current = 0;
      returnShownRef.current = false;
      setShowReturn(false);
      faceVisibilityCountRef.current = [0, 0, 0, 0, 0, 0];
      faceExposureElapsedRef.current = [0, 0, 0, 0, 0, 0];
      faceWasVisibleRef.current = [false, false, false, false, false, false];
      faceScrambleStateRef.current = ["none", "none", "none", "none", "none", "none"];
      // L'introduction repart de zéro : le pointer est rejoué au prochain
      // décodage du premier label.
      stopPointer();
      pointerPlayedRef.current = false;
      labelPinPRef.current = null;
      contactTabRevealedRef.current = false;
      mediaRetractedRef.current = false;
      setMediaRetracted(false);
      zoomedFaceRef.current = -1;
      setZoomedFaces([false, false, false, false, false, false]);
      setContactDone(false);
      setSkipped(false);
      skipRevealedFacesRef.current = [false, false, false, false, false, false];
      setSkipRevealedFaces([false, false, false, false, false, false]);
      dragOffsetRef.current = { rx: 0, ry: 0 };
      dragEaseResetRef.current = false;
      dragEaseStartRef.current = 0;
      spinFromRef.current = null;
      bgResetRef.current = true;
      bgBaseRef.current = false;
      bgIsVideoRef.current = false;
      lastWireRotRef.current = { rx: Infinity, ry: Infinity };
      for (let i = 0; i < 6; i++) {
        if (clickLabelRefs.current[i]) clickLabelRefs.current[i].style.opacity = "0";
        stopFaceScramble(i);
      }
      if (galleryLabelRef.current) galleryLabelRef.current.style.opacity = "0";
      stopGalleryScramble();
      lastGalleryLabelTextRef.current = "";
      if (bgSonarRef.current) {
        bgSonarRef.current.anime?.pause();
        bgSonarRef.current.mask.remove();
        bgSonarRef.current.ring.remove();
        window.clearTimeout(bgSonarRef.current.timeout);
        bgSonarRef.current = null;
      }
      Object.entries(faceSonarRef.current).forEach(([, s]) => {
        s?.anime?.pause();
        s?.layer?.mask?.remove();
        s?.layer?.ring?.remove();
      });
      faceSonarRef.current = {};
      resetBackground();
      resetPlay = true;
      resetFrom = CUBE_END;
      resetElapsed = 0;
      reverseEffort = 0;
      reverseAnchor = CUBE_END;
      reverseDeepest = CUBE_END;
      currentP = CUBE_END;
      targetP = CUBE_END;
      const sbReset = scrollExtent;
      if (sbReset > 0) el.scrollTop = currentP * sbReset;
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      sync();
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    // Scroll manuel BLOQUÉ pendant le scroll automatique. Sans cela le navigateur
    // peut prendre la main entre deux frames (molette, trackpad) et se battre avec
    // les écritures de `scrollTop` de `tick` : la section tremble et la fin se
    // joue à contretemps. On neutralise donc la molette tant que `autoplay` est
    // actif ; le gestionnaire normal reprend la main dès que l'autoplay s'arrête.
    const blockManualScroll = (e) => {
      if (!autoplay) return;
      e.preventDefault();
    };

    // Le pan tactile, lui, n'est PAS neutralisé. preventDefault sur `touchmove`
    // ne neutralise pas le seul geste : sur iOS et Android, le navigateur décide
    // du scroll au `touchstart` et un seul `touchmove` empêché verrouille toute
    // la séquence tactile en mode « ne défile pas », pour toute sa durée. Comme
    // l'autoplay tient le doigt en l'air pendant ses ~9 s, le geste de scroll
    // qui suit la fin de l'animation était mangé : le visiteur pouvait swiper
    // autant que voulu, la section ne bougeait pas, et le retour par scroll
    // inverse ne se déclenchait jamais.
    //
    // Ce conflit n'a pas besoin d'être neutralisé côté navigateur : pendant
    // l'autoplay, `sync` ignore la position lue et `tick` réécrit `scrollTop` à
    // chaque frame, donc le geste ne peut que faire clignoter la position une
    // frame, le temps que la réécriture la reprenne. Le drag de rotation garde
    // son propre `preventDefault` plus bas, il n'en dépend pas.
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", blockManualScroll, { passive: false });
    sync();
    rafId = requestAnimationFrame(tick);

    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", blockManualScroll);
      // `disconnect()` et non `unobserve()` : l'observateur n'appartient qu'à cet
      // effet, il n'a rien à observer après.
      if (extentObserver) {
        extentObserver.disconnect();
      } else {
        window.removeEventListener("resize", onViewportChange);
        window.removeEventListener("orientationchange", onViewportChange);
      }
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [faceImages, changeBackground, runFaceSonar, buildSonarLayer, retractMedia, playPointer, stopPointer]);

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
      // Le cube interdit le pan natif (`touch-action: none` sur sa zone), donc
      // le doigt fait tourner le cube librement sur SES DEUX AXES dès le premier
      // léger mouvement : plus de verrou horizontal, et surtout plus de
      // pointercancel du navigateur qui coupait la rotation au milieu du geste.
      // Le seuil minuscule garde le tap (sans déplacement) pour le clic de face.
      if (!st.moved && Math.hypot(distX, distY) > 10) {
        st.moved = true;
        tapPointRef.current = null;
      }
      if (!st.moved) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      // Un doigt couvre une plus grande distance pour la même rotation qu'une
      // souris : gain plus fort sur les deux axes pour rester aussi direct.
      const sens =
        st.pointerType === "touch" ? { ry: 1.0, rx: 0.6 } : { ry: 0.5, rx: 0.3 };
      // Sens du pilotage inversé : ces deux signes commandent la correspondance
      // écran -> rotation, et rien d'autre. Les deux lignes serveant la souris
      // comme le doigt, l'inversion est.ipso facto la même sur le web et le
      // mobile — les garder opposés entre les deux aurait fait diverger les
      // plateformes. Les gains de `sens` restent positifs : ce sont des
      // sensibilités, pas des directions, et l'amortissement qui suit est
      // multiplicatif, donc indifferent au signe.
      dragOffsetRef.current.ry += dx * sens.ry;
      dragOffsetRef.current.rx += -dy * sens.rx;
      queueDragRender();
    };

    // Le preventDefault ci-dessus ne sert plus que de ceinture-bretelles :
    // `touch-action: none` suffit normalement à empêcher le navigateur de
    // prendre le geste pendant un drag déjà engagé sur la zone.
    const onTouchMove = (e) => {
      const st = dragStateRef.current;
      if (st && st.moved && st.pointerType === "touch") e.preventDefault();
    };

    // Même en filet : si un navigateur étouffait quand même le pointerup
    // synthétisé, la fin du geste est récupérée sur les événements touch natifs
    // pour ne jamais laisser un drag en cours bloquer le suivant.
    const onTouchEnd = (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      endDrag({ type: e.type, clientX: t.clientX, clientY: t.clientY });
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
    zone.addEventListener("touchmove", onTouchMove, { passive: false });
    zone.addEventListener("touchend", onTouchEnd);
    zone.addEventListener("touchcancel", onTouchEnd);

    return () => {
      if (suppressTimer) clearTimeout(suppressTimer);
      if (pendingRafId) cancelAnimationFrame(pendingRafId);
      zone.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      zone.removeEventListener("touchmove", onTouchMove);
      zone.removeEventListener("touchend", onTouchEnd);
      zone.removeEventListener("touchcancel", onTouchEnd);
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
        // Verrou d'orientation OU overlay ouvert : le contenu du cube devient
        // alors inerte. `aria-hidden` seul ne suffit pas — il sort l'arbre
        // d'accessibilité mais laisse les boutons focusables, et l'overlay le
        // recouvre visuellement. `inert` fait les deux. React 19 le gère comme
        // un attribut booléen natif.
        aria-hidden={isMobileLandscape}
        inert={isMobileLandscape || showContact || selectedProject !== null}
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
            // Pas d'`autoPlay` déclaratif : la lecture est déclenchée par
            // `changeBackground` au clic, qui fige la vidéo sur sa première
            // image sous `prefers-reduced-motion`. Un `autoPlay` rejouerait la
            // boucle avant même le premier clic — donc avant tout geste.
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
        <div className="absolute inset-0 bg-[#0a0f1c]/60" />
        <button
          onClick={() => window.location.reload()}
          className="absolute top-3 left-3 z-30 sm:top-5 sm:left-8 bg-transparent border-0 p-0 cursor-pointer"
          aria-label="Recharger la page"
        >
          <img
            src={`${BASE}/icon.webp`}
            alt=""
            className="h-12 w-12 sm:h-20 sm:w-20 rounded-2xl object-cover"
          />
        </button>

        <div className="relative z-10 w-full">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              {/* Icône de la « souris » : décorative, doublée par le texte
                  « SCROLL DOWN » adjacent. Sans `aria-hidden`, certains
                  lecteurs annoncent un « graphique » sans nom au milieu de
                  l'intro. */}
              <svg
                aria-hidden="true"
                focusable="false"
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
                // Même statut que le label du pointer : redondant avec
                // l'`aria-label` de la zone de clic, et en anglais dans une
                // page `lang="fr"`.
                aria-hidden="true"
                className="absolute left-1/2 -translate-x-1/2 text-sm text-[#00a5b0] tracking-[0.2em] leading-tight text-center whitespace-nowrap uppercase"
                style={{ top: "calc(100% - 78px)" }}
              >
                SCROLL
                <br />
                DOWN
              </div>
            </div>
          </div>
              <nav aria-label="Rubriques du portfolio" className="absolute top-20 sm:top-6 left-1/2 -translate-x-1/2 z-30 grid grid-cols-3 gap-2 px-2 max-w-[88vw] w-[88vw] sm:w-auto sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 sm:px-4">
                {PROJECT_LINKS.map((link, i) => {
                  const shown =
                    zoomedFaces[i] ||
                    (skipped && (skipRevealedFaces[i] || contactDone));
                  return (
                    <button
                      key={link.name}
                      onClick={() => openProject(i)}
                      onFocus={(e) => {
                        // `opacity: 0` n'empêche ni le focus ni l'activation au
                        // clavier : sans ce correctif, la tabulation menait à six
                        // boutons invisibles. On les révèle au focus (comme un
                        // lien d'évitement) ; le style inline est réécrit au
                        // prochain render, qui restaure l'opacité d'origine.
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.pointerEvents = "auto";
                      }}
                      // Masqué = hors tabulation et hors arbre d'accessibilité.
                      // Le `onFocus` ci-dessus reste le filet pour le cas où le
                      // focus arriverait quand même (navigateur qui ignore
                      // `tabIndex`, restauration de session…) : le bouton se
                      // révèle au lieu de rester un arrêt invisible.
                      tabIndex={shown ? 0 : -1}
                      aria-hidden={shown ? undefined : true}
                      className="w-full sm:w-auto text-center whitespace-nowrap bg-[#0a0f1c] border border-[#00a5b0]/60 text-[#00a5b0] tracking-[0.2em] uppercase rounded-full px-2.5 sm:px-4 py-2 text-[11px] sm:text-xs transition-all duration-500 hover:bg-[#00a5b0]/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1c] cursor-pointer"
                      style={{
                        opacity: shown ? 1 : 0,
                        transform: shown
                          ? "translateY(0)"
                          : "translateY(-15px)",
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
                  // Invisible mais encore focusable : `opacity: 0` ne sort pas un
                  // bouton de la tabulation, et `pointerEvents: none` n'en fait
                  // pas un obstacle au clavier. CONTACT était donc atteignable —
                  // et annoncé « bouton CONTACT » — bien avant que la
                  // chorégraphie ne le révèle. On le sort de la tabulation et de
                  // l'arbre d'accessibilité, pas du rendu : `visibility`
                  // conviendrait mais tuerait le fondu de 0,6 s.
                  tabIndex={contactDone ? 0 : -1}
                  aria-hidden={contactDone ? undefined : true}
                  className="hidden text-center sm:inline-block bg-white text-[#0a0f1c] tracking-[0.2em] uppercase rounded-full px-4 py-2 text-xs sm:ml-6 hover:bg-white/80 transition-colors duration-300 cursor-pointer border-0"
                  style={contactBtnStyle}
                >
                  CONTACT
                </button>
              </nav>
              <button
                onClick={
                  showReturn ? () => goToStartRef.current?.() : skipIntro
                }
                aria-label={
                  showReturn
                    ? "Revenir au début de l'animation"
                    : "Passer l'animation"
                }
                // Masqué mais encore focusable : `opacity: 0` ne sort pas un
                // bouton de la tabulation, et `pointerEvents: none` n'en fait pas
                // un obstacle au clavier. SKIP restait donc atteignable — et
                // annoncé « passer l'animation » — une fois la chorégraphie
                // terminée. Le bouton n'a pas de fondu — l'opacité passe de 1 à 0
                // d'un coup — mais la correction retenue est la même que pour
                // CONTACT, et pour la même raison : `visibility` conviendrait
                // ici, mais il tuerait le fondu de 0,6 s du bouton voisin.
                tabIndex={showReturn || (!contactDone && !skipped) ? 0 : -1}
                aria-hidden={showReturn || (!contactDone && !skipped) ? undefined : true}
                className="absolute bottom-[calc(env(safe-area-inset-bottom)+24px)] right-3 sm:bottom-[calc(env(safe-area-inset-bottom)+32px)] sm:right-8 z-30 bg-[#0a0f1c]/70 text-[#00a5b0] transition-all duration-500 cursor-pointer hover:text-white rounded-full flex items-center justify-center"
                style={{
                  opacity: showReturn || (!contactDone && !skipped) ? 1 : 0,
                  pointerEvents:
                    showReturn || (!contactDone && !skipped) ? "auto" : "none",
                }}
              >
                {showReturn ? (
                  <span className="h-10 w-10 sm:h-11 sm:w-11 flex items-center justify-center">
                    <Undo2
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      aria-hidden="true"
                    />
                  </span>
                ) : (
                  <span className="tracking-[0.2em] uppercase text-[11px] sm:text-xs px-4 py-2">
                    SKIP
                  </span>
                )}
              </button>
              <button
                onClick={onContactClick}
                tabIndex={contactDone ? 0 : -1}
                aria-hidden={contactDone ? undefined : true}
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
                  <div
                    ref={cubeContainerRef}
                    className="relative shrink-0"
                    style={{
                      width: 300,
                      height: 300,
                      transform: `scale(${cubeScale})`,
                      transformOrigin: "center",
                    }}
                  >
                    <div
                      style={{
                        perspective: 1200,
                        perspectiveOrigin: "50% 50%",
                      }}
                    >
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
                              boxShadow:
                                zoomedFaces[i] && !mediaRetracted
                                  ? "0 0 15px rgba(0,0,0,0.3)"
                                  : "none",
                              transition: "box-shadow 0.3s ease",
                              backfaceVisibility: "hidden",
                              transform: faceTransform(face),
                              WebkitTransform: faceTransform(face),
                              isolation: "isolate",
                              willChange: "transform",
                            }}
                          >
                            {/* Couche éclairée : elle porte le fond ET le filtre
                            d'éclairage. Le label reste frère au-dessus, hors de
                            cette couche — sinon le `filter` de la face
                            l'assombrirait avec l'image. */}
                            <div
                              className="face-lit"
                              style={{
                                position: "absolute",
                                inset: 0,
                                background: "#0a0f1c",
                                overflow: "hidden",
                              }}
                            >
                              {faceImages[i] && (
                                <div
                                  className="face-media-wrapper"
                                  style={{
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
                                      // Même raison que le fond : pas d'`autoPlay`
                                      // déclaratif. La lecture est déclenchée par
                                      // `handleFaceClick` au clic — qui fige sous
                                      // `prefers-reduced-motion` — et non par le
                                      // montage du nœud.
                                      muted
                                      loop
                                      playsInline
                                      preload="metadata"
                                    />
                                  ) : (
                                    <img
                                      src={faceImages[i]}
                                      srcSet={faceSrcSet(faceImages[i])}
                                      // `sizes` suit l'état de zoom : la face mesure 343 px
                                      // au repos (300 × 8/7 de projection perspective, cf.
                                      // CUBE_FACE_PROJECTION_SCALE) et occupe le viewport une
                                      // fois ouverte. Sans cette bascule, le navigateur
                                      // figerait son choix de variante sur la petite et le
                                      // plein écran serait flou. La variante d'origine
                                      // Referme le `srcset`, donc la qualité d'aujourd'hui est
                                      // garantie même si ce dimensionnement évolue.
                                      sizes={
                                        zoomedFaces[i] && !mediaRetracted
                                          ? "100vw"
                                          : "343px"
                                      }
                                      alt=""
                                      className="w-full h-full object-cover"
                                      draggable={false}
                                      // `eager` volontairement conservé : les faces
                                      // sont repliées en `transform: scale(0)`, donc
                                      // hors du viewport au sens d'IntersectionObserver
                                      // — un `lazy` les différerait, et `revealFaceMedia`
                                      // n'ouvrirait la face qu'au bout de son timeout de
                                      // 1400 ms, le visuel restant vide. Le coût initial
                                      // est mesuré : 31 Ko en DPR1, 57 Ko en DPR2 (contre
                                      // ~248 Ko avant) — le `srcset` ne télécharge que la
                                      // variante utile au repos, la grande étant réservée
                                      // au zoom.
                                      loading="eager"
                                      // Décodage hors du thread principal : évite de
                                      // bloquer le premier rendu du cube.
                                      decoding="async"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                            <div
                              ref={(el) => {
                                clickLabelRefs.current[i] = el;
                              }}
                              // Le contenu est réécrit à chaque frame pendant le
                              // brouillage (caractères aléatoires) : sans
                              // `aria-hidden`, le lecteur d'écran épelle des
                              // suites comme « X Q 7 % » à chaque passage. Le
                              // label n'est de toute façon pas interactif — la
                              // zone de clic porte déjà le nom de la face via
                              // son `aria-label`, et l'onglet correspondant
                              // porte le nom stable.
                              aria-hidden="true"
                              className="pointer-events-none select-none"
                              style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#33d1c8",
                                // Compense le rendu grayscale de la face pour rejoindre
                                // l'épaisseur du label du skip — voir
                                // `FACE_LABEL_FONT_SCALE`.
                                fontSize: `${1.25 * FACE_LABEL_FONT_SCALE}rem`,
                                fontFamily:
                                  "var(--font-share-tech-mono), monospace",
                                letterSpacing: "0.3em",
                                // Même halo que l'overlay du skip : sans lui, le
                                // turquoise se fond dans le fond et le label paraît
                                // terne par rapport au label du skip.
                                textShadow: "0 0 14px rgba(51,209,200,0.5)",
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
                    {/* Incitateur de clic, HORS du cube : posé sur une face, il
                    se superposait au média qu'il invitait à ouvrir. Il se place
                    maintenant sous le cube, centré, et pointe vers le haut. */}
                    <div
                      ref={pointerRef}
                      data-pointer=""
                      className="pointer-events-none select-none"
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "calc(100% + 72px)",
                        width: POINTER_RING_SIZE,
                        height: POINTER_RING_SIZE,
                        marginLeft: -POINTER_RING_SIZE / 2,
                        zIndex: 6,
                        opacity: 0,
                      }}
                    >
                      <div
                        ref={pointerRippleRef}
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: "50%",
                          border: "2px solid #33d1c8",
                          boxShadow:
                            "0 0 18px rgba(0,165,176,0.85), inset 0 0 18px rgba(0,165,176,0.55)",
                          transform: "scale(0.35)",
                          opacity: 0,
                        }}
                      />
                      <div
                        ref={pointerGlyphRef}
                        data-pointer-glyph=""
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          // Décalages par marges, jamais par transform : la
                          // transform appartient à `anime`, qui la réécrit
                          // entièrement à chaque frame. On recule la boîte de
                          // `POINTER_TIP` — la pointe elle-même — au lieu de
                          // l'avancer, si bien que le coin du curseur, et non
                          // son axe médian, tombe au centre de l'anneau.
                          marginLeft: -POINTER_TIP,
                          marginTop: -POINTER_TIP,
                          color: "#33d1c8",
                          filter: "drop-shadow(0 0 10px rgba(51,209,200,0.65))",
                          lineHeight: 0,
                        }}
                      >
                        <MousePointer2
                          size={POINTER_GLYPH_SIZE}
                          strokeWidth={2.4}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    <div
                      ref={pointerLabelRef}
                      // Texte redondant avec l'`aria-label` de la zone de clic
                      // (« appuyez sur Entrée pour ouvrir la face ») et jamais
                      // traduit (en anglais dans une page `lang="fr"`). Masqué
                      // aux lecteurs, qui reçoivent la consigne en français via
                      // la zone de clic.
                      aria-hidden="true"
                      className="pointer-events-none select-none absolute left-1/2 -translate-x-1/2 text-[#00a5b0] tracking-[0.2em] leading-tight text-center uppercase whitespace-nowrap"
                      style={{
                        top: "calc(100% + 158px)",
                        fontSize: "0.875rem",
                        fontFamily: "var(--font-share-tech-mono), monospace",
                        opacity: 0,
                        transition: "opacity 0.35s ease",
                      }}
                    >
                      CLICK TO EXPLORE
                    </div>
                    <div
                      ref={galleryLabelRef}
                      data-gallery-label=""
                      // Même raison que les labels de face : contenu réécrit à
                      // chaque frame pendant le brouillage du skip.
                      aria-hidden="true"
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
                        // Égalise la taille réelle du label du skip avec celle des
                        // labels de face : ceux-ci vivent dans le cube 3D, où la
                        // projection perspective (1200px, face à 150px) les grossit
                        // de 1200/1050 = 8/7 par rapport à cet overlay 2D. Le cube
                        // est déjà dans le conteneur mis à l'échelle
                        // (`scale(${cubeScale})`), il ne faut donc PAS re-multiplier
                        // par cubeScale ici. `transformOrigin: center` garde le
                        // texte centré.
                        transform: `scale(${CUBE_FACE_PROJECTION_SCALE})`,
                        transformOrigin: "center",
                        textShadow: "0 0 14px rgba(51,209,200,0.5)",
                        willChange: "opacity",
                      }}
                    />
                    {/* Fil de fer du cube : trajectoire dessinée par le JS à
                        chaque frame, sans équivalent textuel. Décoratif. */}
                    <svg
                      ref={wireRef}
                      aria-hidden="true"
                      focusable="false"
                      className="absolute inset-0 pointer-events-none"
                      width={300}
                      height={300}
                      viewBox="0 0 300 300"
                      style={{ zIndex: 5, overflow: "visible" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 20,
                        background: "#0a0f1c",
                        pointerEvents: "none",
                        opacity: 0,
                        transition: "opacity 0.12s linear",
                      }}
                    />
                    <div
                      ref={clickZoneRef}
                      onClick={handleCubeClick}
                      onKeyDown={handleCubeKeyDown}
                      role="button"
                      tabIndex={0}
                      aria-label="Cube de compétences. Faites défiler pour le faire tourner, puis appuyez sur Entrée pour ouvrir la face tournée vers vous."
                      className="absolute cursor-grab"
                      style={{
                        zIndex: 10,
                        background: "transparent",
                        top: -60,
                        left: -60,
                        right: -60,
                        bottom: -60,
                        userSelect: "none",
                        touchAction: touchLock ? "none" : "pan-y",
                        WebkitUserSelect: "none",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        </section>

      {/* Les deux overlays vivent ICI, en frères de la `<section>`, et non à
          l'intérieur. Deux raisons, une visible et une structurelle.

          Visible : la section porte `z-10` et `position: relative`, donc elle
          ouvre un contexte d'empilement. Ses enfants à `z-50` / `z-60` sont
          donc comparés au contexte, pas à la racine — la bulle de l'assistant
          (`z-40`, hors section) passait AU-DESSUS de l'overlay projet,
          exactement ce que le commentaire de `chat-widget.jsx` affirme
          éviter. Hors section, l'ordre réel est bien 10 < 40 < 50 < 60 < 100.

          Structurelle : `inert` ne peut pas neutraliser un sous-arbre qui
          contient le dialogue. Le `role` est sur ce div, donc la section doit
          pouvoir être inerte à côté. */}
      {showContact && (
        <div
          ref={contactDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-overlay-title"
          className="fixed inset-0 z-[60]"
        >
          <ContactOverlay
            onClose={closeContactOverlay}
            onSelectProject={(i) => {
              setShowContact(false);
              openProjectFromOverlay(i);
            }}
          />
        </div>
      )}

      {projectOverlayOpen && (
        <div
          ref={(node) => {
            overlayScrollRef.current = node;
            projectDialogRef.current = node;
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-overlay-title"
          className="fixed inset-0 z-50 overflow-y-auto scroll-none"
          style={{ backgroundColor: "#0a0f1c" }}
        >
          <ProjectTabs
            activeIndex={selectedProject}
            onSelect={openProjectFromOverlay}
            onContact={onContactClick}
            onBack={closeProjectOverlay}
          />
          <div className="mx-auto max-w-4xl px-6 py-24">
            {renderProjectContent(selectedProject, {
              onContact: onContactClick,
            })}

            {/* Retour en bas de page sur mobile, où la barre d'onglets est
                masquée et où rien d'autre n'assure le retour */}
            <div className="text-center mt-20 sm:hidden">
              <BackButton onClick={closeProjectOverlay} />
            </div>
          </div>
        </div>
      )}

      {isMobileLandscape && (
        <div
          // Le dialogue ne contient aucun contrôle : `tabIndex={-1}` le rend
          // focusable par script, et le focus est posé au montage. Sans cela un
          // lecteur d'écran ouvre la page sans jamais annoncer le verrou, et le
          // visiteur doit deviner pourquoi la page ne réagit pas.
          ref={orientationLockRef}
          tabIndex={-1}
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
          </div>
        </div>
      )}
    </>
  );
}

export default HeroCube;
