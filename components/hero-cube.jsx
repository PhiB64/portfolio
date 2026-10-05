"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import anime from "animejs";


import { renderProjectContent } from "./cube/project-content";
import { uiFor } from "../lib/content/ui.js";
import { ProjectTabs, BackButton } from "./cube/project-tabs";
import { ContactOverlay } from "./contact-overlay";
import { OrientationLock } from "./cube/orientation-lock";
import { ClickPointer } from "./cube/click-pointer";
import { CubeFaces, faceLabels } from "./cube/cube-face";
import { IntroMarker } from "./cube/intro-marker";
import { CubeNav } from "./cube/cube-nav";
import { FaceDraw } from "./cube/face-draw";
import {
  FACE_DROP,
  TAIL_DX,
  TAIL_LINE_STROKE,
  TAIL_SCREENS,
  TAIL_UNWIND_MS,
  coreP,
  splitExtent,
  tailP,
  tailSmoothingMs,
  tailStages,
  tailUnwindP,
  tailUnwindStages,
  TAIL_TEXT_REVEAL_MS,
  trackScreens,
} from "../lib/cube-tail";
import {
  FACE_LABELS,
  FACE_NORMALS,
  FACES,
  LIGHT_DIR,
  computeWireframe,
  faceFrontAmount,
  findClickedFace,
  getCubeRotation,
  isVideoUrl,
  nextCubeStepBound,
  rotateVecByXY,
} from "../lib/cube-math";
import { scrambleLabel, stopScramble } from "../lib/scramble";
import { electDecodingFace, readFaceExposure } from "../lib/face-labels";
import { FACE_MEDIA } from "../lib/cube-media";
import { reduceMotion as readReducedMotion } from "../lib/reduced-motion";
import { useDialogFocus } from "../lib/use-dialog-focus";
import {
  SQUARE_POINTS,
  MOUSE_POINTS,
  W,
  TOTAL,
  INTRO_END,
  CUBE_END,
  SHOW_START,
  SHOW_END,
  SPIN_START,
  SPIN_END,
  LINE_POS,
  NAMES_START,
  NAMES_END,
  CUBE_RANGE,
  ROT_END,
  interpolatePoints,
} from "../lib/cube-timeline";
import { buildSpinTour } from "../lib/cube-tour";
import {
  AUTOPLAY_CATCHUP_MS,
  SKIP_UNFOLD_MS,
  autoplayHeadP,
  finaleBudgets,
  runFinale,
  skipDurationMs,
  skipUnfoldP,
} from "../lib/cube-finale";
import { isMobileDevice, isRealMobileDevice } from "../lib/device";
import { computeCubeMetrics, needsOrientationLock } from "../lib/cube-viewport";
import { sonarGeometry } from "../lib/cube-sonar";

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

const WEB_SCROLL_SMOOTHING_MS = 80;
const WEB_REVERSE_SCROLL_SMOOTHING_MS = 120;
const MOBILE_SCROLL_SMOOTHING_MS = 60;
const MOBILE_REVERSE_SCROLL_SMOOTHING_MS = 100;
const MAX_FRAME_DT = 100;
const SNAP_THRESHOLD = 0.0005;
// Le lissage de la queue a deux valeurs — 110 ms à l'aller, 165 ms au rembobinage —
// et sa raison d'être est écrite là où il vit, avec les autres temps de la queue :
// voir `TAIL_SCROLL_SMOOTHING_MS` et `TAIL_REVERSE_SCROLL_SMOOTHING_MS` dans
// `lib/cube-tail.js`. Le parcours écrit, lui, garde les siennes ici, au-dessus :
// 80 / 120 sur desktop, 60 / 100 sur mobile.
// Durée du fondu qui ramène l'offset de rotation du drag à zéro quand le scroll
// reprend : assez court pour « dé-poser » le cube vite, assez long pour ne pas
// sauter d'un coup.
const DRAG_EASE_MS = 450;
// Durée du décodage d'un label de face : le brouillage se résout de gauche à
// droite sur ce temps.
// 1000 ms. La durée est celle de la TWEEN, pas le moment où le texte devient
// lisible : chaque lettre porte un seuil (cf. `scrambleLabel`) et l'étiquette
// n'est déchiffrée qu'au-delà de la moitié de `state.c`. Sur un libellé de
// trois lettres, la dernière se résout donc vers 625 ms, pas 1 s. C'est la
// cadence de résolution qu'on ralentit, pas le délai d'attente — le décodage
// démarre à l'exposition, sans latence.
// Le skip n'a plus de label décodeur : son 유일 label est celui de face, qui
// s'étire sur 1 s. Une conséquence à connaître : le pointeur attend la FIN de
// la tween (`onComplete`), il apparaît donc désormais à 1 s, bien après que le
// mot est lisible — voir le commentaire dans la boucle de labels.
const FACE_LABEL_DECODE_MS = 1000;
// La face qui détient le décodage ne le rend qu'à un rival franchement plus
// exposé, et ne l'obtient qu'une fois réellement présentée à l'écran. Les deux
// seuils — rétention et exposition minimale — vivent dans `lib/face-labels.js`,
// avec l'élection elle-même : c'est de la logique, elle est testée là-bas.
// Facteur de projection perspective : une face frontale (translateZ 150px, cube
// 300px) sous une perspective de 1200px est rendue 1200/(1200-150) = 8/7 plus
// grande que l'overlay 2D. C'est l'échelle qu'il faut au label du skip pour
// égaliser sa taille réelle avec celle des labels de face, mobile comme desktop.
const CUBE_FACE_PROJECTION_SCALE = 1200 / 1050;
// Nombre d'expositions avant qu'un label de face apparaisse et se mette à
// brouiller. Constante partagée car trois sites en dépendent (affichage du
// label, clic sur la face, levée du pin) et doivent rester alignés.
// 2 = le cube fait d'abord une révolution complète « vide », face après face, sans
// aucun label ; les labels encodés n'apparaissent qu'au second tour, quand chaque
// face revient. 1 les ferait surgir dès la première vue. Le seuil 2 est le même
// que celui de `allSeenTwiceRef`, qui marque la fin de l'intro : labels et fin
// d'intro tombent donc au même moment, par construction.
const FACE_LABEL_REVEAL_COUNT = 2;
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
// Retard de l'onde de fond après le clic sur une face, et durée de l'onde
// elle-même. Sur mobile les deux sont raccourcis : le fond est la seule chose
// qui change au clic, et 380 ms d'attente plus 700 ms de propagation laissaient
// l'écran vide bien trop longtemps après le toucher.
const BG_REVEAL_DELAY_MS = 380;
const MOBILE_BG_REVEAL_DELAY_MS = 120;
const BG_WAVE_MS = 700;
const MOBILE_BG_WAVE_MS = 420;

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

/**
 * Le cube et ses overlays.
 *
 * `lang` n'a pas de valeur par défaut, pour la même raison que dans
 * `renderProjectContent` : un repli silencieux afficherait un mélange de
 * français et d'anglais dans les overlays sans aucun signal. Les deux pages
 * d'accueil — `app/(fr)` et `app/(en)` — le passent explicitement.
 */
export function HeroCube({ lang, title, subtitle, images = [] }) {
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
  const skipActiveRef = useRef(false);
  // Once skipped, the faces fold away so the cube is visibly empty during the
  // gentle rotation (only the cyan wireframe shows).
  const skipFacesHiddenRef = useRef(false);
  // While the folding morph runs, the per-frame face loop leaves the wrapper
  // transforms alone so a single CSS transition can play through.
  const skipFoldRef = useRef(false);
  // Pose exacte rendue à la frame précédente, drag compris. Sert de source à
  // `skipRotRef` au déclenchement du skip.
  const renderedRotRef = useRef({ rx: 0, ry: 0 });
  // Pose gelée au déclenchement du skip, et pendant toute sa durée. C'est elle
  // qui remplace la rotation lue dans le scroll.
  const skipRotRef = useRef(null);
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
  // Quatre états : "none" (label pas encore révélé) -> "encoded" (brouillage
  // continu) -> "decoding" (résolution en cours) -> "decoded" (texte entier).
  // "decoding" et "decoded" sont distincts parce que "decoded" sert de porte
  // d'entrée : une face n'est cliquable que lorsque son nom est déchiffré
  // (cf. `hitTestAndOpen`).
  const faceScrambleStateRef = useRef(["none", "none", "none", "none", "none", "none"]);
  const galleryScrambleTlRef = useRef(null);
  const cubeContainerRef = useRef(null);
  const contentRef = useRef(null);
  const faceWasVisibleRef = useRef([false, false, false, false, false, false]);
  const faceVisibilityCountRef = useRef([0, 0, 0, 0, 0, 0]);
  const faceExposureElapsedRef = useRef([0, 0, 0, 0, 0, 0]);
  // Visibilité des six faces pour la frame en cours. La boucle de labels a
  // besoin de la connaître avant de décider, et le cube en expose trois d'un
  // coup : la phase de lecture (« qui expose qui ») est donc séparée de la phase
  // d'écriture (« qui se met à jour »), qui sinon n'aurait pas encore les
  // données de ses propres faces. Un tableau de ref plutôt qu'une allocation par
  // frame, cette boucle tournant à 60 Hz.
  const faceVisibleRef = useRef([false, false, false, false, false, false]);
  // Face qui détient le décodage. Elle ne le rend qu'à un rival franchement plus
  // exposé, et ne l'obtient qu'une fois réellement présentée à l'écran — les
  // deux seuils sont dans `lib/face-labels.js`. `-1` = personne.
  const frontFaceRef = useRef(-1);
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
  // Progression du tracé du visage, en 0 → 1. C'est la queue qui la pose, jamais
  // le composant de tracé : il ne connaît que « où en est le visiteur ».
  //
  // Un ref et non un état : elle est écrite à chaque frame par `tick` et lue à
  // chaque frame par la RAF du visage, entre les deux sans rerender. Un état
  // React ferait 240 écritures de `strokeDashoffset` par frame en passant par le
  // rendu, pour un dessin que rien d'autre n'affiche.
  const faceProgressRef = useRef(0);
  const tickRef = useRef(null);
  const clickZoneRef = useRef(null);
  const namesRef = useRef(null);
  const subtitleRef = useRef(null);
  const facesVisibleRef = useRef(true);
  // Tournée du spin, tirée UNE fois à son entrée : les six transitions, chacune
  // avec son angle et sa part de fenêtre. `null` tant que le spin n'a pas commencé,
  // ce qui sert aussi de déclencheur au tirage.
  const spinTourRef = useRef(null);
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
  mediaRetractedRef.current = mediaRetracted;

  const faceImages = useMemo(() => {
    const srcs = images && images.length ? images : DEFAULT_FACE_MEDIA;

    // `FACE_LABELS`, et non `labels` : ces tokens servent à apparier des noms de
    // fichiers, pas à afficher. Les assets sont nommés d'après la forme
    // canonique — `public/projets.webp` — donc apparier sur « PROJECTS » ferait
    // perdre la face aux deux passes ci-dessous.
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

  // Libellés à afficher, résolus pour la langue de la page.
  //
  // Passés par une ref plutôt que par une closure : les trois helpers
  // ci-dessous (`stopFaceScramble`, `encodeFaceLabel`, `decodeFaceLabel`) sont
  // eux-mêmes encapsulés dans des `useCallback` / `useEffect`, dont les tableaux
  // de dépendances sont déjà longs et imbriqués. Y ajouter `labels` —
  // recalculé à chaque changement de langue — les aurait rendues instables, et
  // avec elles la chorégraphie. La ref se lit au moment de l'écriture du
  // `textContent`, donc elle voit toujours la langue courante sans jamais
  // invalider une animation en cours.
  //
  // Distinction avec `FACE_LABELS`, toujours utilisé plus bas pour l'appariement
  // des médias : celui-ci reste la forme canonique française, car les assets sont
  // nommés d'après elle (`public/projets.webp`). Seul ce tableau, qui part à
  // l'écran et dans le brouillage, suit la langue.
  const labelsRef = useRef(faceLabels(lang));
  labelsRef.current = faceLabels(lang);

  const stopFaceScramble = (i) => {
    const tl = faceScrambleTlRef.current[i];
    // `undefined` = aucune animation active, rien à restaurer : c'est l'état
    // dans lequel `encodeFaceLabel` laisse la ref juste avant de rappeler
    // `scrambleLabel`. Ce guard accepte aussi `null` parce que le mode `cipher`
    // en rendait une ici sous `prefers-reduced-motion` — il rend désormais une
    // timeline dans tous les cas, mais la tolérance reste inoffensive et évite
    // qu'un retour à `null` rende le texte figé au lieu du libellé final.
    if (tl === undefined) return;
    stopScramble(tl);
    faceScrambleTlRef.current[i] = undefined;
    const el = clickLabelRefs.current[i];
    if (el) el.textContent = labelsRef.current[i];
  };

  // Remet le label à l'état « codé » : brouillage continu, jamais résolu.
  // C'est l'animation visible sur toutes les faces tant qu'elles ne sont pas la
  // plus exposée, et sur celle-ci avant que le décodage ne prenne. La boucle
  // tourne jusqu'à ce que `decodeFaceLabel` la tue pour lancer la résolution :
  // un label encodé n'est donc jamais figé, y compris sous
  // `prefers-reduced-motion` (voir l'arbitrage dans `lib/scramble.js`).
  // `scrambleLabel` renvoie toujours une timeline en mode `cipher`, et
  // `stopScramble` / `stopFaceScramble` / le `?.eventCallback` du tick
  // l'acceptent déjà.
  const encodeFaceLabel = (i) => {
    const el = clickLabelRefs.current[i];
    if (!el) return;
    stopScramble(faceScrambleTlRef.current[i]);
    faceScrambleTlRef.current[i] = undefined;
    faceScrambleTlRef.current[i] = scrambleLabel(el, labelsRef.current[i], {
      cipher: true,
    });
  };

  // Décodage (~1 s) : le brouillage se résout de gauche à droite vers le texte
  // final. Démarre dès l'exposition, sans latence — il existait ici un délai
  // d'une seconde, supprimé quand il a été ramené à 0 ; la seconde qui figure
  // désormais dans la durée est celle de la TWEEN, pas une attente.
  // Renvoie la timeline créée, ou `null` si le label n'est pas monté. L'appelant
  // s'en sert pour n'accrocher son `onComplete` que sur un vrai décodage :
  // accroché à la timeline précédente (boucle `cipher`, `repeat: -1`, qui
  // n'achève jamais), le passage à l'état « decoded » ne se ferait plus.
  const decodeFaceLabel = (i) => {
    const el = clickLabelRefs.current[i];
    if (!el) return null;
    stopScramble(faceScrambleTlRef.current[i]);
    faceScrambleTlRef.current[i] = undefined;
    faceScrambleTlRef.current[i] = scrambleLabel(el, labelsRef.current[i], {
      duration: FACE_LABEL_DECODE_MS / 1000,
    });
    return faceScrambleTlRef.current[i];
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

  // Le skip n'écrit plus aucun label dans l'overlay : il se contente de le vider
  // au démarrage et à la fin du sweep. L'overlay reste câblé parce que la
  // finale s'y appuie pour poser les libellés.
  const stopGalleryScramble = () => {
    stopScramble(galleryScrambleTlRef.current);
    galleryScrambleTlRef.current = null;
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
      // Une face n'est cliquable que décodée : l'état « decoded » n'est atteint
      // qu'à la fin de la tween de décodage, quand le libellé est entièrement
      // résolu. « decoding » (décodage en cours) et « encoded » (brouillage)
      // sont donc refusés, de même que « none » (label pas encore révélé).
      // L'ancien test — deux expositions, `FACE_LABEL_REVEAL_COUNT` — ne
      // garantissait que l'APPARITION du label : la face était cliquable dès
      // la première image de brouillage.
      // La gate est plus faible qu'elle ne paraît : le décodage ne démarre
      // qu'une fois `labelRevealed(i)`, donc « decoded » implique le seuil
      // d'expositions, qu'on n'a plus besoin de vérifier.
      // Une face déjà ouverte reste cliquable même sans son label (il est
      // masqué au clic) : `mediaShown` couvre ce cas.
      const decoded = faceScrambleStateRef.current[idx] === "decoded";
      const mediaShown = zoomedFacesRef.current[idx];
      if (decoded || mediaShown) handleFaceClick(idx);
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
      // Même garde que le hit-test au pointeur : une face ne s'ouvre que
      // décodée, ou si son média est déjà exposé. Les deux chemins de clic
      // doivent partager la condition, sinon le tapourtourne la porte que le
      // hit-test oppose.
      const decoded = faceScrambleStateRef.current[best] === "decoded";
      const mediaShown = zoomedFacesRef.current[best];
      if (decoded || mediaShown) handleFaceClick(best);
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
      setIsMobileLandscape(
        needsOrientationLock(window.innerWidth, window.innerHeight, isRealMobileDevice())
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
      const { scale, squareSize } = computeCubeMetrics(
        window.innerWidth,
        window.innerHeight,
        isMobileDevice()
      );
      cubeScaleRef.current = scale;
      setCubeScale(scale);
      setSquareSize(squareSize);
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
    // La piste s'allonge d'une queue (voir `lib/cube-tail.js`) : au-delà du bout
    // de la chorégraphie, `scrollTop` porte la suite. On garde donc l'étendue
    // totale mesurée, et on en déduit la frontière.
    //
    // `svh` n'est pas relu du CSS : la section fait `100svh`, donc sa boîte
    // mesurée EST l'écran réduit. Le relire passerait par un
    // `getComputedStyle`, soit une lecture de style synchronisée à chaque
    // observation, pour aboutir au même nombre.
    let scrollExtent = 0;
    let coreExtent = 1;
    let tailPx = 0;
    const measureScrollExtent = () => {
      scrollExtent = el.scrollHeight - el.offsetHeight;
      const split = splitExtent(scrollExtent, el.offsetHeight);
      tailPx = split.tailPx;
      coreExtent = split.coreExtent;
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
    // Durée RÉELLE du repli de skip, recalculée à chaque déclenchement : le
    // morphing ne paie que le repli, au lieu de brûler un budget fixe à traverser
    // des segments de timeline vides. Voir le calcul dans le bloc de démarrage.
    //
    // Initialisée à 0, et NON à `SKIP_UNFOLD_MS` : la constante est déclarée plus
    // bas dans cet effet, donc la lire ici tomberait dans la zone morte
    // temporelle — un `let` n'existe qu'à partir de sa propre déclaration. 0 est
    // de toute façon la valeur juste avant le premier skip, et le bloc de
    // démarrage la remplace avant tout usage.
    let skipUnfoldMs = 0;
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
    // stationnait sur chaque pose sans rotation entre les labels. Le
    // re-brouillage continu, lui, n'est pas neutralisé : il tourne jusqu'au
    // décodage de chaque pose, comme en régime normal.
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
    const budgets = finaleBudgets(mobileScroll);
    const { FINALE_MS } = budgets;
    // Budget du rattrapage en ms réelles, décidé à l'armement (0 si le 6e clic
    // est déjà à CUBE_END). `autoplayTotalMs` vaut alors ce rattrapage plus la
    // fin écrite : le scroll garde ainsi sa rampe d'origine, et seule la tête de
    // timeline reçoit les budgets par segment.
    let autoplayTotalMs = FINALE_MS;
    let autoplayCatchMs = 0;
    // Skipped intro: the cube glides straight to the spin pose while its faces
    // stay folded, then the finale plays at its own readable pace and reveals
    // the names and links. The sweep shows no intermediate pose at all.
    //
    // Les deux durées du sweep — `SKIP_UNFOLD_MS` (le repli carré → cube) et
    // `SKIP_FINALE_MS` (la finale de skip) — vivent dans `lib/cube-finale.js`,
    // avec le raisonnement qui va avec : le repli est le SEUL moment où le skip
    // montre quoi que ce soit, donc sa durée décide quand la première rotation
    // arrive.
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
    // Dénouement programmé de la queue avant le balayage de retour (bouton
    // RETOUR). Distinct de la queue pilotée par le scroll : là, la position se
    // défait toute seule, ici elle doit être animée parce que le scroll est gelé
    // pendant le reset. Voir `goToStartRef`.
    let tailUnwind = false;
    let tailUnwindElapsed = 0;
    let tailUnwindFrom = 0;
    // La queue lissée : ce que `applyTail` reçoit réellement, distinct de la
    // position de scroll brute. Elle rejoint sa cible par lissage exponentiel,
    // comme `currentP` pour le parcours écrit — voir `TAIL_SCROLL_SMOOTHING_MS`
    // pour pourquoi la queue en a besoin plus que lui.
    //
    // Une variable d'animation, pas un état : lue et écrite à chaque frame par
    // `tick`, jamais rendue. Un état React ferait rerendre 240 traits par frame.
    let tailSmoothP = 0;
    // La cible du lissage, c'est-à-dire ce que vaut `tailP(el.scrollTop)` à cette
    // frame. Conservée parce que le garage de la boucle, plus bas, doit savoir si
    // la queue a fini de la rattraper pour pouvoir garer.
    let tailTargetP = 0;
    // La durée du balayage de retour, et ce qu'elle commande.
    //
    // Why 1 800, et pas 4 800. Le retour se lit en deux temps, et il faut les
    // distinguer. Le dénouement (`TAIL_UNWIND_MS`, dans `cube-tail.js`) rebrousse
    // la queue, et c'est LUI qui fait revenir le nom : pendant qu'il court,
    // `applyTail` remonte `out` vers 0 et `names.style.opacity` suit `1 - out`
    // (ligne 1681). Le balayage ne commence qu'ensuite — et là le nom repart,
    // pendant que la ligne se refait en souris.
    //
    // Ralentir le balayage ne ralentit donc pas l'apparition du nom : cela étire
    // la disparition, après. C'est pour ça qu'un balayage long se lisait comme un
    // cube qui traîne en bas pendant que l'écran était déjà revenu à l'état de
    // départ — et que l'ensemble est revenu à sa valeur d'origine, le geste
    // étant réparti sur le dénouement.
    const RESET_MS = 1800;
    // Battement entre les DEUX parties du geste : la fin du dénouement et le début
    // du balayage. Ce sont deux mouvements distincts — le cube se pose, puis la
    // ligne se refait en souris — et jusqu’ici ils s’enchaînaient à la frame même.
    // Le cube arrives, le scroll est rendu, et le balayage part : aucune respiration
    // entre les deux. Sur un aller, le scrub fait ce rôle tout seul ; ici le décompte
    // est programmé, et un décompte programmé n'a pas de scrub inhérent — il faut
    // lui donner le temps d'être lu.
    //
    // À 500 ms, ce n'est plus un souffle mais une pose délibérée. C'est un
    // choix, et il faut le nommer : le cube se pose, reste posé une demi-seconde, puis
    // le balayage part. On lit ce battement comme une intention — le geste se sépare
    // lui-même en deux temps — et non comme un délai technique.
    //
    // Why je ne le défends pas par un seuil de durée. Mon seuil de ~150 ms estimait
    // une rapidité acceptable ; 500 ms passe ce cadre par le haut, et c'est
    // exactement ce qu'on cherche. Un battement trop court se lit comme un déclic ;
    // un battement franc se lit comme un silence — et c'est le silence qu'on veut.
    //
    // Why 500 suffit pour que ce soit un silence et pas une panne. Un demi-tour de
    // remontée est exactement la durée d'un clic délibéré, donc l'inertie se
    // détache de l'intention. Sous 500 ms le cube semble attendre quelque chose ;
    // au-dessus, on recommence à attendre le geste.
    const RESET_LEAD_MS = 500;
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

    // Écrit la queue à une position donnée.
//
// `tp` est la progression dans la queue, `lineEased` l'aplatissement de la ligne
// de fin (1 = ligne à plat, 0 = carré). La queue écrase ces deux éléments : elle
// est leur suite, donc elle décide d'eux tant qu'elle court.
//
// Cette fonction ne lit AUCUNE position : elle reçoit la position. C'est ce qui
// permet au scroll et au dénouement programmé (voir `goToStartRef`) de jouer la
// même queue par deux chemins, sans dupliquer les écritures.
//
// `stages` permet au dénouement de passer ses propres segments — le nom y reçoit
// une fenêtre de durée fixe, plus longue que sa portion de piste (voir
// `tailUnwindStages`). Par défaut on lit `tp` comme à l'aller : le scrub est la
// règle, et le dénouement est l'exception qui sait pourquoi.
const applyTail = (tp, lineEased, stages = tailStages(tp)) => {
  if (tp <= 0) {
    // Hors queue : rien à écrire. On se contente de remettre le visage à zéro,
    // et seulement s'il l'était — sinon on réécrirait un effacement déjà fait à
    // chaque frame.
    if (faceProgressRef.current !== 0) faceProgressRef.current = 0;
    // La couleur, elle, doit être rendue : la ligne a pu virer au blanc dans la
    // queue, et la fin écrite attend un trait cyan. Sans ce retour, remonter
    // laisserait un trait blanc au-dessus d'une « souris » cyan, deux fois.
    if (body.style.stroke !== "") body.style.stroke = "";
    return;
  }
  const { out, close, face, whited } = stages;
  // Chemin inverse exact de `namesRise` : les textes refont le trajet qu'ils
  // viennent de faire, dans l'autre sens. Mêmes 70 px, même courbe — sinon le
  // retour ferait un saut.
  names.style.opacity = String(1 - out);
  sub.style.opacity = String(1 - out);
  names.style.transform = `translateY(${70 * out}px)`;
  sub.style.transform = `translateY(${-70 * out}px)`;
  // La ligne ne se réduit pas tant que le texte s'efface, et elle est DÉJÀ
  // blanche : le changement de couleur est un SAUT, en tête de queue, pendant que
  // le texte s'en va. C'est elle qui annonce le dessin à venir — si elle
  // attendait la fin du texte, elle n'aurait plus rien à annoncer pendant tout le
  // premier temps.
  //
  // Écrire `stroke` directement sur l'élément plutôt que dans le JSX : la couleur
  // est pilotée par la position, comme le reste de la queue, et le JSX n'a aucun
  // canal pour ça.
  body.style.stroke = whited ? TAIL_LINE_STROKE : "";
  // La réduction, ensuite. Trois choses à la fois, et chacune a sa raison d'être :
  //
  //   - `close` écrase la LARGEUR seule. La hauteur est déjà à plat par la fin
  //     écrite, et `non-scaling-stroke` garde l'épaisseur quelle que soit
  //     l'échelle : c'est lui qui garantit que la ligne ne s'affine pas en
  //     se réduisant. L'écraser en hauteur, elle, ne produirait qu'un trait déjà
  //     fin — et sans le pondérer, elle tournerait la ligne.
  //   - la translation est HORIZONTALE, et c'est volontaire. Une ligne à plat qui
  //     se met à monter pendant qu'elle se réduit se lit en diagonale, et une
  //     diagonale n'a plus de hauteur à laquelle se poser. Elle reste donc sur
  //     son niveau, qui est celui du centre de son carré — inchangé — et c'est le
  //     visage qui vient présenter son premier trait à cette hauteur
  //     (voir `FACE_DROP`).
  //   - `TAIL_DX` va du centre du carré à la colonne de la plume, donc la ligne
  //     réduite arrive exactement au-dessus du premier trait. Une constante, pas
  //     une progression : c'est la seule course qu'elle ait à faire.
  //
  // L'ordre compte : `translate` puis `scale`, pour que l'aplatissement se fasse
  // autour du centre déjà déplacé.
  body.style.transform = `translate(${TAIL_DX * close}px, 0) scale(${Math.max(0.0001, 1 - close)}, ${Math.max(0.0001, 1 - lineEased)})`;
  // La progression du tracé. C'est tout ce que le visage sait du visiteur :
  // il ne décide ni du départ, ni de la fin, il ne fait que le suivre.
  faceProgressRef.current = face;
};

const sync = () => {
      // While the skip sweep runs, always steer toward the end of the section.
      if (skipRef.current) {
        targetP = 1;
        return;
      }
      // Reading the section's own scrollTop avoids the layout read of
      // getBoundingClientRect on every scroll frame — smoother on mobile.
      // `scrollExtent` is cached for the same reason, one step further: it used
      // to be `el.scrollHeight - el.offsetHeight`, read here on every scroll
      // event. See `measureScrollExtent`.
      const pos = el.scrollTop;
      // `real` est la position sur le PARCOURS ÉCRIT, bornée à 1 : c'est
      // exactement la valeur d'avant, à un pixel près près du bout. Toute la
      // chorégraphie en dépend, donc elle ne voit pas la queue.
      const real = coreP(pos, coreExtent);
      // Le scroll automatique est IMPOSÉ : la position est pilotée par l'autoplay
      // et un geste de l'utilisateur ne doit pas pouvoir reprendre la main. On ne
      // compare donc plus la position lue à notre dernière écriture pour y voir un
      // geste, et on ne rend jamais la main : `targetP` suit la position que
      // l'autoplay vient d'écrire (`autoScrollPx`), jamais celle lue. La tête de
      // timeline reste par ailleurs pilotée par `tlAutoplayP` (voir plus bas),
      // donc la fin se joue au rythme écrit pour elle quel que soit le geste.
      // L'autoplay s'arrête au BOUT DU PARCOURS ÉCRIT, pas au bout de la piste : sa
      // destination est la fin de la chorégraphie. La queue se parcourt au
      // scroll, geste de l'utilisateur — elle ne fait pas partie de la fin
      // écrite, donc rien ne l'anime à la place du visiteur.
      if (autoplay) {
          targetP = coreP(autoScrollPx, coreExtent);
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
        // L'échelle des seuils en pixels est `coreExtent`, pas l'étendue totale :
        // `real` est mesuré sur le parcours écrit, donc multiplier par la piste
        // entière rendrait le seuil franchi trop tôt (il faudrait moins de recul).
        reverseEffort = (reverseAnchor - reverseDeepest) * coreExtent;
        // Annulation : l'utilisateur revient franchement vers le bas, il n'a pas
        // confirmé le retour. On ré-ancre sur sa position et le point le plus
        // reculé repart avec elle. Un simple rebond reste sous cette distance et
        // conserve donc le recul déjà mesuré.
        if ((reverseDeepest - real) * coreExtent >= REVERSE_CANCEL_PX) {
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
              // `pinP` est une position du parcours écrit : la Translate en
              // pixels se fait sur `coreExtent`, sinon le rattrapage s'arrête
              // avant la face visée.
              top: pinP * coreExtent,
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

    // Le label d'une face est-il autorisé à s'afficher ? Deux conditions, et
    // elles sont lues à deux endroits de la même frame — d'abord pour désigner
    // la face la plus exposée, ensuite pour tenir la machine à états. Passé ici
    // pour n'avoir qu'une définition : elles doivent rester d'accord, sinon la
    // face désignée pourrait être une face muette.
    // `mediaRetracted` fait exception : après la fin, le repli des visuels
    // redonne les labels même aux faces déjà ouvertes.
    const labelRevealed = (i) =>
      faceVisibilityCountRef.current[i] >= FACE_LABEL_REVEAL_COUNT &&
      (!zoomedFacesRef.current[i] || mediaRetractedRef.current);

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
          autoScrollPx = currentP * coreExtent;
          el.scrollTop = autoScrollPx;
        } else {
          // Même bornage que dans `sync` : l'autoplay vise le bout du parcours
          // écrit. On relit l'étendue mesurée plutôt que le cache pour que la
          // course soit juste même si la piste a été redimensionnée depuis la
          // dernière observation.
          const sbAuto = el.scrollHeight - el.offsetHeight - tailPx;
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
            // fin écrite garde ensuite ses budgets par segment. Voir
            // `autoplayHeadP` dans `lib/cube-finale.js`.
            tlAutoplayP = autoplayHeadP(
              autoplayElapsed,
              autoplayCatchMs,
              tlAutoplayStartP,
              budgets,
            );
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

      // Dénouement de la queue avant le balayage de retour. Le scroll est gelé
      // pendant le reset : la position ne décrit plus la queue, donc c'est ce
      // décompte qui la rejoue. Tant qu'il court, on ne touche à rien d'autre —
      // le balayage ne commence qu'une fois la queue revenue à sa frontière.
      if (tailUnwind) {
        tailUnwindElapsed += dt;
        const unwoundP = tailUnwindP(tailUnwindElapsed, TAIL_UNWIND_MS, tailUnwindFrom);
        // Le lissage se met à la suite du décompte, pas l'inverse. Pendant le
        // dénouement le scroll est gelé, donc la cible ne bouge pas et le lissage
        // n'aurait plus rien à rattraper — il resterait à mi-chemin pendant tout
        // le décompte, puis se caserait d'un coup quand la main revient au scroll.
        // En l'égalant à chaque frame, il arrive à zéro en même temps que le
        // décompte, et la reprise se fait sans couture.
        tailSmoothP = unwoundP;
        tailTargetP = unwoundP;
        applyTail(unwoundP, 1, tailUnwindStages(unwoundP, tailUnwindFrom, TAIL_UNWIND_MS, TAIL_TEXT_REVEAL_MS));
        if (tailUnwindElapsed >= TAIL_UNWIND_MS) {
          tailUnwind = false;
          tailUnwindElapsed = 0;
          tailUnwindFrom = 0;
          // À la frontière, on rend la main au scroll : la suite du retour est
          // pilotée par la position, comme avant.
          el.scrollTop = CUBE_END * coreExtent;
        }
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Sweep de retour au début (bouton RETOUR) : balayage programmé de
      // CUBE_END vers 0, pendant lequel toute la logique d'intro/clic est gelée.
      if (resetPlay) {
        resetElapsed += dt;
        // Battement avant la deuxième partie. `resetElapsed` continue de courir, mais
        // tout ce qui suit se lit sur `sweepElapsed`, qui reste à 0 pendant
        // `RESET_LEAD_MS`. Le cube se pose donc, immobile, le temps que la bascule
        // s'enregistre — et la seconde partie démarre exactement à son rythme
        // d'origine, sans qu'aucune de ses durées n'ait bougé.
        //
        // Pourquoi décaler plutôt qu'allonger `RESET_MS` : le geste avait une durée
        // qu'on venait d'arrêter. Si le battement entrait dans le budget, il
        // faudrait reprendre cette durée quelque part — sur l'invite ou sur le morph,
        // qui sont les deux seules choses que la deuxième partie contient. Mieux
        // vaut un temps mort franc entre les deux parties qu'une deuxième partie
        // qu'on a réaménagée.
        const sweepElapsed = Math.max(0, resetElapsed - RESET_LEAD_MS);
        const k = Math.min(1, sweepElapsed / RESET_MS);
        currentP = resetFrom * (1 - k);
        targetP = currentP;
        el.scrollTop = currentP * coreExtent;
        // Les noms « PHILIPPE BARBOSA / CONCEPTEUR DÉVELOPPEUR » disparaissent
        // dès le début du retour (fondu + glissement vers le bas), avant que la
        // ligne de fin d'animation ne se transforme en « souris ».
        const namesK = Math.min(1, sweepElapsed / RESET_NAMES_MS);
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
          Math.max(0, (sweepElapsed - RESET_NAMES_MS) / RESET_LINE_GROW_MS),
        );
        const growE = growK * growK * (3 - 2 * growK);
        body.style.transform = `scale(1, ${Math.max(0.0001, growE)})`;
        const morphK = Math.max(
          0,
          Math.min(
            1,
            (sweepElapsed - (RESET_NAMES_MS + RESET_LINE_GROW_MS)) / RESET_MORPH_MS,
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
          Math.min(1, (sweepElapsed - (RESET_MS - RESET_REVEAL_MS)) / RESET_REVEAL_MS),
        );
        const revealE = 1 - (1 - revealK) * (1 - revealK) * (1 - revealK);
        hint.style.opacity = String(revealE);
        if (sweepElapsed >= RESET_MS) {
          resetPlay = false;
          resetFrom = 0;
          resetElapsed = 0;
          currentP = 0;
          targetP = 0;
          el.scrollTop = 0;
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

      // Qui se décode : seule la face la plus exposée à l'utilisateur. Les
      // autres restent visibles, mais en brouillage continu — c'est le codage qui
      // se poursuit, pas le décodage.
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
        const nowVisible = faceVisibleRef.current;
        const exposure = readFaceExposure(visRot);
        for (let i = 0; i < 6; i++) nowVisible[i] = exposure.visible[i];

        // Phase de lecture. Le cube en expose trois d'un coup : dire laquelle est
        // la plus exposée demande de les avoir toutes mesurées, alors que la
        // machine à états se joue face par face. D'où les deux passes — on
        // désigne d'abord, on n'écrit qu'ensuite.
        //
        // Le compte d'expositions se met à jour dans la même passe, avant
        // l'élection : une face qui vient d'atteindre le seuil doit pouvoir
        // concourir dès cette frame, sans quoi son label attendrait la suivante.
        for (let i = 0; i < 6; i++) {
          const visible = exposure.visible[i];
          if (visible && !faceWasVisibleRef.current[i]) {
            if (!rewinding) {
              faceVisibilityCountRef.current[i]++;
            }
            // Lors d'un retour, une face qui redevient frontale ne « compte »
            // pas : seul le passage avant alimente le compte de révélation.
          } else if (!visible && faceWasVisibleRef.current[i] && rewinding) {
            faceVisibilityCountRef.current[i] = Math.max(
              0,
              faceVisibilityCountRef.current[i] - 1,
            );
          }
        }

        // Qui se décode : la plus exposée des faces éligibles, la détentrice
        // reconduite tant qu'aucun rival ne la dépasse franchement. Le seuil
        // d'exposition minimale est ce qui manquait pour que le PREMIER label
        // ait, lui aussi, sa phase codée — voir `lib/face-labels.js`.
        const { index: frontFace } = electDecodingFace(exposure, labelRevealed, frontFaceRef.current);
        frontFaceRef.current = frontFace;

        // Phase d'écriture.
        for (let i = 0; i < 6; i++) {
          if (labelRevealed(i)) {
            const el = clickLabelRefs.current[i];
            if (el) el.style.opacity = "1";
            if (nowVisible[i]) {
              faceExposureElapsedRef.current[i] += dt;
              if (i === frontFace) {
                // La plus exposée : le brouillage se résout de gauche à droite.
                // Le passage par « encoded » est sauté quand la face vient de
                // l'état « none » — `scrambleLabel` part d'un rendu entièrement
                // aléatoire, donc le décodage démarre proprement aussi sans
                // passer par le codage, et l'encodage que la même frame annule
                // ne ferait que reconstruire les spans du DOM pour les détruire
                // aussitôt. Sans effet de bord désormais : l'élection ne
                // désigne plus une face bieuuse, donc ce « none » n'est atteint que
                // sur une face réellement présentée — voir
                // `FACE_LABEL_DECODE_MIN_EXPOSURE`.
                if (
                  faceScrambleStateRef.current[i] !== "decoding" &&
                  faceScrambleStateRef.current[i] !== "decoded"
                ) {
                  const tl = decodeFaceLabel(i);
                  faceScrambleStateRef.current[i] = "decoding";
                  // Un seul `onComplete` pour les deux effets : `eventCallback`
                  // remplace le callback précédent, il ne s'y ajoute pas.
                  //
                  // Le passage à « decoded » est ce qui rend la face cliquable
                  // (`hitTestAndOpen`). Il attend la FIN de la tween, pas le
                  // moment où le texte devient lisible : une face à moitié
                  // déchiffrée reste donc fermée, ce qui est le but — on
                  // n'ouvre pas un projet dont le nom est encore du bruit.
                  //
                  // `kill()` (voir `stopScramble`) ne déclenche pas `onComplete`
                  // : une interruption laisse l'état « decoding », que les
                  // branches ci-dessous rebouclent, et le décodage suivant
                  // jouera son `onComplete`.
                  if (tl) {
                    tl.eventCallback("onComplete", () => {
                      faceScrambleStateRef.current[i] = "decoded";
                      // Le pointer ne se montre qu'une fois par introduction, et
                      // sur la face dont le label se résout en premier. Il attend
                      // lui aussi la fin du décodage : c'est le mot entier,
                      // résolu, qu'il vient souligner — le déclencher au départ
                      // mettrait le geste sur un brouillage.
                      if (i === POINTER_FACE && !pointerPlayedRef.current) {
                        playPointer();
                      }
                    });
                  }
                }
              } else if (
                faceScrambleStateRef.current[i] === "none" ||
                faceScrambleStateRef.current[i] === "decoding" ||
                faceScrambleStateRef.current[i] === "decoded"
              ) {
                // Visible mais moins exposée que la détentrice : le brouillage
                // continu s'installe et le texte redevient illisible. Une seule
                // fois par transition : `encodeFaceLabel` vide et recrée les
                // spans du DOM, l'appeler à chaque frame reconstruirait le label
                // en boucle. La boucle ainsi armée se poursuit d'elle-même
                // jusqu'à ce que cette face devienne la plus exposée : c'est
                // alors `decodeFaceLabel` qui la tue pour lancer la résolution.
                encodeFaceLabel(i);
                faceScrambleStateRef.current[i] = "encoded";
              }
            } else {
              faceExposureElapsedRef.current[i] = 0;
              // Face sortie de vue : le label redevient « codé » au prochain
              // passage, pour rejouer le cycle à la prochaine exposition.
              // « decoding » compris : un décodage interrompu par la sortie de
              // vue est un texte à moitié résolu, pas un libellé.
              if (
                faceScrambleStateRef.current[i] === "decoding" ||
                faceScrambleStateRef.current[i] === "decoded"
              ) {
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
          faceWasVisibleRef.current[i] = nowVisible[i];
        }
      }

      // LA QUEUE, lissée. Elle se joue ici, avant le garage, pour une raison
      // précise : le garage plus bas doit pouvoir poser la question « la queue a-t-
      // elle fini de rattraper ? » avant de décider de stopper la boucle. Sur un
      // parcours écrit arrivé et une queue encore à mi-chemin, il n'y a plus rien
      // pour l'avancer — la position de scroll est immobile, donc plus aucune frame
      // ne viendrait finir le lissage. La ligne resterait figée au milieu de sa
      // réduction, le visage au milieu de ses traits, sans aucun moyen de les
      // terminer à part un nouveau geste.
      if (skipRef.current) {
        // Le skip vise la fin du parcours écrit : il n'entre jamais dans la queue,
        // qui vaut donc zéro — c'est bien ce qu'elle vaut à l'écran. On l'y met
        // d'un coup, sans lissage : retarder un état déjà exact ne servirait à rien,
        // et le trait réapparaîtrait pendant toute la durée du skip.
        tailSmoothP = 0;
        tailTargetP = 0;
      } else {
        tailTargetP = tailP(el.scrollTop, coreExtent, tailPx);
        // Même formule que pour `currentP`, et pour la même raison : l'exponentielle
        // n'a qu'une vitesse, donc le décalage se résorbe au même rythme après un
        // saut de molette comme après un glissement de deux secondes. Une inertie
        // linéaire, elle, rattrape à vitesse constante puis s'arrête sec — et le
        // saut de molette suivant se lirait comme une reprise.
        //
        // La durée, elle, suit le sens du geste : 110 ms à l'aller, 165 ms au
        // rembobinage. Sans cette seconde valeur, le trait fin remontait plus vite que
        // le cube qui l'entoure, qui lui remontait déjà à 120 — l'ordre inversé, et ça
        // s'entend autant sur la réduction de la ligne que sur les 240 traits. Voir
        // `TAIL_REVERSE_SCROLL_SMOOTHING_MS`.
        tailSmoothP +=
          (tailTargetP - tailSmoothP) *
          (1 - Math.exp(-dt / tailSmoothingMs(tailTargetP, tailSmoothP)));
        // Arrivée : on pose exactement sur la cible. L'exponentielle s'en approche
        // sans jamais l'atteindre, et une queue qui reste à 0,0004 de sa cible
        // afficherait un trait de trois pixels plus court que la ligne — visible,
        // sur un segment dont tout l'intérêt est d'arriver pile.
        if (Math.abs(tailTargetP - tailSmoothP) < SNAP_THRESHOLD) {
          tailSmoothP = tailTargetP;
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
          // Le morphing ne paie que ce qu'il a à montrer : le repli du carré en
          // cube, et RIEN D'AUTRE.
          //
          // Le trajet complet va de `skipFrom` à SPIN_START, mais tout ce qui
          // suit l'intro (`idle`, `showcase`, `facesOut`, `cubeFade`) est vide :
          // aucune cible, aucune propriété animée. La tête traverse donc 9700 ms
          // de timeline qui ne dessinent rien — et le cube, lui, ne tourne pas,
          // puisque la pose est gelée pendant tout le skip. C'est ce que le
          // morphing paidait, et c'était 2,2 s d'immobilité entre le repli et la
          // première rotation.
          //
          // Ces segments étant inertes, on ne les PARCOURS pas : à la fin du
          // repli, la tête saute directement sur SPIN_START et le spin démarre.
          // Le saut est invisible par construction — il n'y a rien à anime entre
          // les deux points.
          //
          // Le repli est donc borné à `SKIP_UNFOLD_MS`, au prorata de ce qu'il en
          // reste. Un skip au premier pixel joue ~1,2 s de repli et enchaîne
          // aussitôt ; un skip déclenché après l'intro n'a plus rien à montrer et
          // part directement au spin.
          skipUnfoldMs = skipLate
            ? 0
            : (Math.max(0, INTRO_END - skipFrom) / INTRO_END) * SKIP_UNFOLD_MS;
          // Gel de la pose : on prend exactement ce qui est à l'écran, drag
          // compris. `renderedRotRef` n'est réécrit qu'en fin de frame, donc il
          // contient encore la pose de la frame précédente — celle qui est
          // effectivement affichée. Aucun à-coup au déclenchement.
          skipRotRef.current = {
            rx: renderedRotRef.current.rx,
            ry: renderedRotRef.current.ry,
          };
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
          // Le skip ne montre plus les faces une à une : aucun label n'est
          // confié à l'overlay, et les onglets restent révélés par la seule
          // finale. On neutralise donc tout ce qui pourrait trainer d'un skip
          // précédent avant de replier les faces.
          for (let i = 0; i < 6; i++) {
            const label = clickLabelRefs.current[i];
            if (label) label.style.opacity = "0";
            stopFaceScramble(i);
          }
          if (galleryLabelRef.current) galleryLabelRef.current.style.opacity = "0";
          stopGalleryScramble();
          skipFoldRef.current = true;
          skipFacesHiddenRef.current = true;
        }
        autoplayElapsed += dt;
        if (skipLate) {
          skipFoldRef.current = false;
          skipFacesHiddenRef.current = true;
          currentP = runFinale(skipFrom, autoplayElapsed, budgets);
        } else if (autoplayElapsed < skipUnfoldMs) {
          // Repli : le carré devient le cube, et c'est tout ce que le skip
          // montre. `skipUnfoldP` (dans `lib/cube-finale.js`) va de `skipFrom` à
          // INTRO_END en `skipUnfoldMs`, puis le finale la prend à SPIN_START —
          // le saut d'INTRO_END à SPIN_START traverse des segments vides, donc ne
          // dessine rien.
          // skipFoldRef reste vrai : les visuels restent repliés pendant tout le
          // repli, ils n'apparaissent pas même une frame.
          currentP = skipUnfoldP(autoplayElapsed, skipUnfoldMs, skipFrom);
        } else {
          // Finale (spin, line, name) at its own steady pace on the blank cube.
          // C'est ici que les textes et les onglets apparaissent. Le spin est
          // déjà amorcé sur sa toute première frame : `runFinale(SPIN_START, 0)`
          // rend SPIN_START, et la branche du spin s'ouvre à `tlP > SPIN_START`.
          skipFacesHiddenRef.current = true;
          skipFoldRef.current = false;
          currentP = runFinale(SPIN_START, autoplayElapsed - skipUnfoldMs, budgets);
        }
        // Le skip vise la fin de la chorégraphie, donc la fin du parcours écrit.
        el.scrollTop = currentP * coreExtent;
        const skipDuration = skipDurationMs(skipLate, skipUnfoldMs, budgets);
        if (autoplayElapsed >= skipDuration) {
          currentP = 1;
          targetP = 1;
          autoplayElapsed = 0;
          skipRef.current = false;
          skipActiveRef.current = false;
          skipLate = false;
          skipFoldRef.current = false;
          skipFacesHiddenRef.current = false;
          skipRotRef.current = null;
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
      } else if (
        Math.abs(diff) < SNAP_THRESHOLD &&
        Math.abs(tailTargetP - tailSmoothP) < SNAP_THRESHOLD &&
        !autoplay
      ) {
        // The cube is at rest: park the loop.
        // `!autoplay` évite de garer pendant le scroll automatique : `targetP` y
        // relit la position avec un frame de retard, donc `diff` peut être nul
        // alors que la tête doit encore descendre.
        //
        // Et la queue doit être arrivée, elle aussi. Elle a son propre lissage et
        // sa propre inertie : les deux convergent en même temps la plupart du temps,
        // mais pas toujours — un Molette qui s'arrête au moment où le parcours
        // écrit se posait laisse la queue encore en retard de quelques pixels. Garer
        // là-dessus figerait la ligne et le dessin en plein geste, sans rien pour
        // les finir.
        currentP = targetP;
        tailSmoothP = tailTargetP;
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
        el.scrollTop = currentP * coreExtent;
        autoScrollPx = el.scrollTop;
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
      // Pendant le skip, la base n'est plus lue dans le scroll : le cube garde
      // la pose gelée à son déclenchement, et le morphing ne joue plus que le
      // scale et le fondu des visuels. La position de scroll continue pourtant
      // d'avancer — la tête de timeline s'en sert encore — mais elle ne commande
      // plus l'orientation. Le spin reste le SEUL segment qui fait tourner le
      // cube, ce qui retire du même coup les quarts de tour parasites que le
      // glissement de scroll luirait.
      let rot =
        skipActiveRef.current && skipRotRef.current
          ? { rx: skipRotRef.current.rx, ry: skipRotRef.current.ry }
          : getCubeRotation(baseP);
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
        if (spinTourRef.current === null) {
          // Le spin part de la pose acquise (fin de showcase ou `lockedCubeP`)
          // et non d'une valeur reventilée : la reprise est donc invisible. La
          // tournée est tirée ICI, une fois pour tout le spin — voir
          // `buildSpinTour`.
          spinTourRef.current = buildSpinTour(rot);
        }
        const tour = spinTourRef.current;
        const k = Math.min(1, Math.max(0, (tlP - SPIN_START) / (SPIN_END - SPIN_START)));
        // On parcourt la tournée à vitesse angulaire constante : la distance
        // totale est convertie en distance parcourue, puis chaque transition est
        // traversée dans une part de fenêtre PROPORTIONNELLE à sa longueur.
        //
        // C'est ce qui supprime les à-coups. Un découpage en paliers de durée
        // égale donnait à chaque face la même part de temps quel que soit l'angle
        // à couvrir : un quart de tour simple et une traversée de coin en sortaient
        // tous deux en 1/6 de fenêtre, donc la vitesse changeait à chaque
        // frontière — six accélérations et six ralentissements. C'était la vraie
        // cause des quatre commits « ralentit les rotations finales » sans effet :
        // ils allongeaient un budget sans toucher à ce profil.
        let remaining = tour.total * k;
        let i = 0;
        while (i < tour.steps.length - 1 && remaining > tour.steps[i].len) {
          remaining -= tour.steps[i].len;
          i++;
        }
        const step = tour.steps[i];
        const t = step.len > 0 ? remaining / step.len : 1;
        rot = { rx: step.rx + step.drx * t, ry: step.ry + step.dry * t };
        spinning = true;
      } else {
        spinTourRef.current = null;
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
        if (skipRotRef.current) {
          // La pose gelée a été capturée APRÈS application du drag, qui est donc
          // déjà dedans : le rejouer ici le compterait deux fois. La pose reste
          // figée, et c'est bien ce qu'on veut.
          dragRx = 0;
          dragRy = 0;
        } else {
          const k = Math.min(1, autoplayElapsed / skipUnfoldMs);
          const ease = 1 - k * k * (3 - 2 * k);
          dragRx *= ease;
          dragRy *= ease;
        }
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
      // Pose réellement à l'écran, drag inclus : c'est celle que le skip gèle à
      // son déclenchement. Écrit ici, en fin de frame, pour que la frame suivante
      // y lise la pose précédente — celle qui est affichée.
      renderedRotRef.current.rx = rot.rx;
      renderedRotRef.current.ry = rot.ry;
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

      // LA QUEUE — ce qui se joue après les noms levés. Elle est écrite ICI,
      // après le bloc de la timeline, et jamais avant : elle l'emporte sur la fin
      // écrite puisqu'elle en est la suite. Appliquée avant, la timeline la
      // réécrirait à la frame suivante et les textes clignoteraient entre les
      // deux positions.
      // `le`, et non `1 - le` : c'est `le` qui vaut 1 quand la ligne est à plat,
      // et `applyTail` l'attend dans ce sens. L'inverser ici gonflait la hauteur
      // du carré à mesure que la queue avançait — la ligne redevenait un carré
      // qu'on écrasait en largeur, au lieu d'être un trait qui se réduit.
      //
      // `tailSmoothP`, et non la position brute : c'est elle qui a été lissée
      // plus haut, et c'est elle qui rend le geste aussi doux que le reste du
      // parcours. La position de scroll reste, elle, disponible par
      // `tailTargetP` — celle que le lissage rejoint.
      applyTail(tailSmoothP, le);
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
      skipRotRef.current = null;
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
      frontFaceRef.current = -1;
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
      setSkipRevealedFaces([false, false, false, false, false, false]);
      dragOffsetRef.current = { rx: 0, ry: 0 };
      dragEaseResetRef.current = false;
      dragEaseStartRef.current = 0;
      spinTourRef.current = null;
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
      // Dénouement de la queue AVANT le balayage de retour. Si le visiteur est
      // déjà dans la queue, le bouton RETOUR ne peut pas la sauter : le visage
      // doit disparaître, les textes revenir et la ligne se refaire — sinon le
      // balayage démarrerait sur une image qui n'existe pas, avec le visage
      // encore dessiné par-dessus la « souris ».
      //
      // On mesure la queue là où elle en est, pas à 1 : le geste a pu n'effacer
      // qu'une partie du chemin.
      //
      // `tailSmoothP`, et non `tailP(el.scrollTop)` : le décompte part de ce que
      // l'écran montre. Partir de la position brute ferait sauter la queue de tout
      // le retard accumulé — plusieurs traits du visage d'un coup, au moment
      // précis où l'on vient d'appuyer sur RETOUR.
      const tpNow = tailSmoothP;
      if (tpNow > 0) {
        tailUnwind = true;
        tailUnwindElapsed = 0;
        tailUnwindFrom = tpNow;
      }
      resetPlay = true;
      resetFrom = CUBE_END;
      resetElapsed = 0;
      reverseEffort = 0;
      reverseAnchor = CUBE_END;
      reverseDeepest = CUBE_END;
      currentP = CUBE_END;
      targetP = CUBE_END;
      el.scrollTop = currentP * coreExtent;
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
    setSkipRevealedFaces([false, false, false, false, false, false]);
    setSkipped(true);
    for (let i = 0; i < 6; i++) {
      if (clickLabelRefs.current[i]) clickLabelRefs.current[i].style.opacity = "0";
      stopFaceScramble(i);
    }
    if (galleryLabelRef.current) galleryLabelRef.current.style.opacity = "0";
    stopGalleryScramble();
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
      // On s'arrête à la FIN DU PARCOURS ÉCRIT, pas au bout de la piste : le
      // repli doit être complet et le RETOUR disponible. La queue reste un
      // parcours de scroll, que le visiteur fera ou défaira ensuite à son rythme.
      el.scrollTop = Math.max(
        0,
        el.scrollHeight - el.offsetHeight * (1 + TAIL_SCREENS),
      );
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
      {/* La piste porte le parcours écrit PLUS la queue (voir
          `lib/cube-tail.js`). La hauteur vient de `trackScreens()` et non d'un
          nombre en dur, pour que la géométrie reste la source de vérité. */}
      <div style={{ height: `calc(${trackScreens()} * var(--svh))` }}>
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
          aria-label={uiFor(lang).cube.reload}
        >
          <img
            src={`${BASE}/icon.webp`}
            alt=""
            className="h-12 w-12 sm:h-20 sm:w-20 rounded-2xl object-cover"
          />
        </button>

        <div className="relative z-10 w-full">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <IntroMarker
              lang={lang}
              squareSize={squareSize}
              title={title}
              subtitle={subtitle}
              morphBodyRef={morphBodyRef}
              morphWheelRef={morphWheelRef}
              namesRef={namesRef}
              subtitleRef={subtitleRef}
              hintRef={scrollHintRef}
            />
            {/* Le visage. Il est POSÉ SUR le marqueur d'intro, pas à côté :
                c'est le point blanc de la fin qui s'ouvre en traits, donc il doit
                reprendre exactement la boîte qu'occupait la ligne. En frère dans
                le flux, le `flex` l'alignerait à côté et le morphing se ferait en
                deux temps. D'où le centrage explicite en surimpression. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: squareSize,
                height: squareSize,
                // `FACE_DROP` descend le dessin pour que son premier trait
                // démarre exactement au niveau de la ligne réduite. C'est ici que
                // se joue le raccord : la ligne, à plat, ne bouge qu'en
                // horizontal — donc son niveau est celui du centre du carré, et
                // c'est au dessin qu'il revient de se placer.
                //
                // Ce `transform` est statique, donc en `style` inline et non dans
                // une classe : il n'est écrit par personne, et React le poserait
                // une fois pour toutes.
                transform: `translate(-50%, calc(-50% + ${FACE_DROP}%))`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FaceDraw progressRef={faceProgressRef} />
            </div>
          </div>
              <CubeNav
                lang={lang}
                zoomedFaces={zoomedFaces}
                skipped={skipped}
                skipRevealedFaces={skipRevealedFaces}
                contactDone={contactDone}
                onOpenProject={openProject}
                onContactClick={onContactClick}
                onSkip={skipIntro}
                onRestart={() => goToStartRef.current?.()}
                showReturn={showReturn}
                contactBtnStyle={contactBtnStyle}
              />
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
                        <CubeFaces
                          lang={lang}
                          images={faceImages}
                          zoomed={zoomedFaces}
                          mediaRetracted={mediaRetracted}
                          labelRefs={clickLabelRefs}
                        />
                      </div>
                    </div>
                    {/* Incitateur de clic, HORS du cube : posé sur une face, il
                    se superposait au média qu'il invitait à ouvrir. Il se place
                    maintenant sous le cube, centré, et pointe vers le haut. */}
                    <ClickPointer
                      lang={lang}
                      ringRef={pointerRef}
                      rippleRef={pointerRippleRef}
                      glyphRef={pointerGlyphRef}
                      labelRef={pointerLabelRef}
                    />
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
            lang={lang}
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
            lang={lang}
            activeIndex={selectedProject}
            onSelect={openProjectFromOverlay}
            onContact={onContactClick}
            onBack={closeProjectOverlay}
          />
          <div className="mx-auto max-w-4xl px-6 py-24">
            {renderProjectContent(selectedProject, {
              lang,
              onContact: onContactClick,
            })}

            {/* Retour en bas de page sur mobile, où la barre d'onglets est
                masquée et où rien d'autre n'assure le retour */}
            <div className="text-center mt-20 sm:hidden">
              <BackButton lang={lang} onClick={closeProjectOverlay} />
            </div>
          </div>
        </div>
      )}

      {isMobileLandscape && (
        <OrientationLock dialogRef={orientationLockRef} />
      )}
    </>
  );
}

export default HeroCube;
