"use client";

import { useEffect, useRef } from "react";

import { FACE_BOX, FACE_PATHS, FACE_VIEWBOX } from "../../lib/face-paths.js";
import { reduceMotion } from "../../lib/reduced-motion.js";

// Le visage, tracé à la main.
//
// Why ce fichier existe. La fin de séquence s'achevait sur les noms levés : il
// restait la place d'un prolongement où la ligne de fin se réduit à un point, puis
// où ce point s'ouvre en visage. Ce visage est un tracé vectoriel de 240 traits —
// trop pour tenir dans le composant de chorégraphie, qui est déjà le fichier le
// plus sensible du projet pour le rendu.
//
// Ce module ne fait qu'une chose : il PLAY le tracé. Il écrit `strokeDashoffset`
// sur chaque `path` selon une progression qu'il ne décide PAS — il la reçoit.
//
// La progression vient du parent (`progressRef`), qui la déduit de la position de
// scroll dans la queue (voir `lib/cube-tail.js`). Le dessin se forme donc au
// geste : il avance quand le visiteur descend, s'arrête quand il s'arrête, et se
// défait trait par trait quand il remonte. Il n'y a ni minuterie, ni boucle, ni
// part d'animation : le seul temps qui compte est celui du visiteur.
//
// Why pas un temps réel. Une plume animée sur 7 s à l'entrée de la queue avance
// devant le geste et derrière lui : le visiteur descend vite, le visage se
// rattrapera ; il descend lentement, il attend. Sur une piste entièrement scrubée,
// ce décalage se voit — tout ce qui précède a obéi au scroll, et ce seul élément
// pas l'imite. Ça se lirait comme une animation à côté du geste, pas dedans.
//
// Aucune logique de scroll ici : la seule chose que ce module sait du visiteur,
// c'est où il en est. Il ne décide ni quand le tracé part, ni s'il repart.

// Le cadrage vient de `lib/face-paths.js`, pas d'ici : c'est le même nombre qui
// sert à ramener le départ de la plume dans le repère de la ligne (voir
// `lib/cube-tail.js`). Les écrire deux fois, ce serait laisser les deux
// raccords partir sans se voir.
const VIEWBOX = `0 0 ${FACE_VIEWBOX} ${FACE_VIEWBOX}`;

// Vitesse de plume constante.
//
// Ce qui décide du rythme, c'est la LONGUEUR, pas la position. Chaque `path`
// reçoit une part de la progression proportionnelle à sa longueur : un trait de
// dix points et un trait de cent points se tracent au même nombre de pixels par
// pixel de scroll. Sans ça, les petits traits finissent en éclair et les longs en
// brouillard, et le visage donne l'impression d'être écrit à des vitesses
// différentes selon l'endroit — ce qui est exactement le défaut qu'on cherche à
// éviter.
const strokeTiming = (paths) => {
  const lengths = paths.map((p) => {
    try {
      return p.getTotalLength();
    } catch {
      // `getTotalLength` lève si le tracé n'est pas rendu (JSDOM, display:none
      // au moment de la mesure). Un tracé non mesuré vaut 0 : il ne consomme
      // rien de la plume et n'a pas d'effondrement au `strokeDashoffset`.
      return 0;
    }
  });
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  // Instant de départ de chaque trait, en fraction du tracé global.
  let acc = 0;
  const starts = lengths.map((l) => {
    const s = acc / total;
    acc += l;
    return s;
  });
  return { lengths, starts, total };
};

export function FaceDraw({ progressRef }) {
  const svgRef = useRef(null);
  const pathsRef = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const paths = pathsRef.current.filter(Boolean);

    // `strokeDasharray` à la longueur exacte du trait : c'est ce qui fait que le
    // trait invisible et le trait visible occupent la même place, donc qu'aucun
    // trait ne « pousse » ses voisins en se dessinant.
    const { lengths, starts, total } = strokeTiming(paths);
    paths.forEach((p, i) => {
      p.style.strokeDasharray = `${lengths[i]} ${lengths[i]}`;
      p.style.strokeDashoffset = `${lengths[i]}`;
    });

    const hide = () => {
      paths.forEach((p, i) => {
        p.style.strokeDashoffset = `${lengths[i]}`;
      });
    };

    const applyDraw = (k) => {
      paths.forEach((p, i) => {
        // Progression locale du trait : sa fenêtre dans le tracé global.
        const span = lengths[i] / total;
        const local = Math.max(0, Math.min(1, (k - starts[i]) / span));
        p.style.strokeDashoffset = `${lengths[i] * (1 - local)}`;
      });
    };

    // Sous `prefers-reduced-motion`, le visage est là ou pas là : jamais à
    // mi-tracé. Un tracé progressif est précisément le type de mouvement que la
    // préférence neutralise, même piloté par le geste. On garde donc la même
    // boucle, mais elle n'écrit que deux états : présent, ou absent.
//
// Le seuil est « a-t-on dépassé le point blanc », pas la progression. Le
    // tracé commence à ce point exact, donc c'est là que le visiteur décide s'il
    // continue de descendre — et c'est donc là que le visage doit apparaître en
    // entier, d'un coup. Un seuil de quantité le cacherait pendant les premiers
    // pour cent du segment, qui sont précisément les premiers traits.
    if (reduceMotion()) {
      let shown = null;
      const step = () => {
        const on = progressRef.current > 0;
        if (on !== shown) {
          shown = on;
          svg.style.opacity = on ? "1" : "0";
          // Les longueurs sont déjà mesurées plus haut : on les réutilise plutôt
          // que de les remesurer à chaque bascule.
          paths.forEach((p, i) => {
            p.style.strokeDashoffset = on ? "0" : `${lengths[i]}`;
          });
        }
        rafRef.current = requestAnimationFrame(step);
      };
      svg.style.opacity = "0";
      hide();
      rafRef.current = requestAnimationFrame(step);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    }

    // La boucle ne fait RIEN tant qu'elle n'a rien à jouer, et n'écrit que ce qui
    // a changé.
    //
    // On ne gare pas la boucle quand le tracé est fini, comme le fait le reste
    // de la chorégraphie avec son `rafId`. Ce serait une erreur : le composant
    // n'a aucun événement qui le réveille. La progression vient d'un `ref` que le
    // parent écrit à chaque frame, et une boucle garée ne repartirait jamais — le
    // visage resterait figé au bout pour tout le reste de la session dès la
    // première remontée de scroll.
    //
    // Une image par frame sans travail à faire ne coûte presque rien ; la boucle
    // garée coûterait une fonctionnalité.
    //
    // `-1` et non `0` : c'est la seule valeur qui ne peut pas être une
    // progression réelle, donc la première frame écrit toujours. Démarrer à 0
    // laisserait la position initiale intacte — c'est-à-dire les 240 traits déjà
    // posés — tant que le visiteur n'aurait pas bougé, et le visage apparaîtrait
    // d'un bloc au premier pixel de la queue.
    let last = -1;
    const step = () => {
      const k = Math.max(0, Math.min(1, progressRef.current));
      // Une frame sans geste ne réécrit rien. Indispensable : le scrub écrit 240
      // `strokeDashoffset` par frame, et la plupart des frames de la session se
      // passent visage immobile, y compris les 10 écrans du parcours écrit où il
      // n'a rien à faire.
      if (k !== last) {
        last = k;
        applyDraw(k);
        // Le visage n'existe qu'avec des traits : l'opacité ne sert qu'à le
        // retirer à `k = 0`, où l'effacement laisse déjà un dessin vide.
        svg.style.opacity = k > 0 ? "1" : "0";
      }
      rafRef.current = requestAnimationFrame(step);
    };

    svg.style.opacity = "0";
    hide();
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // La progression est scrubée : elle change à chaque frame sans qu'aucun
    // rendu soit nécessaire. `paths` est stable après le montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox={VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{
        opacity: 0,
        maxWidth: `${FACE_BOX * 100}%`,
        maxHeight: `${FACE_BOX * 100}%`,
        // La transition d'opacité fait l'apparition et la disparition du VISAGE.
        // Les traits, eux, sont pilotés par `strokeDashoffset` : transitioned,
        // ils ne suivraient pas le rythme de plume.
        transition: "opacity 420ms ease",
        overflow: "visible",
      }}
    >
      <g
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {FACE_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            ref={(el) => {
              pathsRef.current[i] = el;
            }}
          />
        ))}
      </g>
    </svg>
  );
}

export default FaceDraw;