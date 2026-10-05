import { FACE_LABELS, FACES, faceTransform, isVideoUrl } from "../../lib/cube-math";
import { faceSrcSet } from "../../lib/cube-media";
import { uiFor } from "../../lib/content/ui.js";

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

// Les six libellés affichés sur le cube, pour une langue donnée.
//
// Fonction, et non constante : cinq des six sont des noms de technologies,
// écrits pareil dans les deux langues, mais pas le dernier — « PROJETS » est
// français, « PROJECTS » anglais. Même découpage que `projectLinks` dans
// `project-tabs.jsx`, et pour la même raison.
//
// `FACE_LABELS` reste exportée telle quelle, car elle sert aussi à
// l'appariement des médias par nom de fichier dans `hero-cube.jsx`, où les
// assets sont nommés d'après la forme française (`public/projets.webp`). Cette
// fonction ne sert qu'à l'affichage.
export function faceLabels(lang) {
  return [...FACE_LABELS.slice(0, 5), uiFor(lang).tabs.projects];
}

// Une face du cube : média, puis son label en surimpression.
//
// Affichage seul. La face est positionnée par `faceTransform` (calcul pur, testé
// dans `lib/cube-math.js`) et son label est réécrit à chaque frame par la
// chorégraphie via `labelRef` — le parent garde le nœud, pas l'état.
export function CubeFace({
  lang,
  face,
  index,
  image,
  zoomed,
  mediaRetracted,
  labelRef,
}) {
  const opened = zoomed && !mediaRetracted;
  const labels = faceLabels(lang);

  return (
    <div
      className="absolute overflow-hidden box-border"
      style={{
        width: 300,
        height: 300,
        background: "#0a0f1c",
        boxShadow: opened ? "0 0 15px rgba(0,0,0,0.3)" : "none",
        transition: "box-shadow 0.3s ease",
        backfaceVisibility: "hidden",
        transform: faceTransform(face),
        WebkitTransform: faceTransform(face),
        isolation: "isolate",
        willChange: "transform",
      }}
    >
      {/* Couche éclairée : elle porte le fond ET le filtre d'éclairage. Le
      label reste frère au-dessus, hors de cette couche — sinon le `filter` de
      la face l'assombrirait avec l'image. */}
      <div
        className="face-lit"
        style={{
          position: "absolute",
          inset: 0,
          background: "#0a0f1c",
          overflow: "hidden",
        }}
      >
        {image && (
          <div
            className="face-media-wrapper"
            style={{
              transition: "transform 0.6s ease",
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            {isVideoUrl(image) ? (
              <video
                src={image}
                className="w-full h-full object-cover"
                // Même raison que le fond : pas d'`autoPlay` déclaratif. La
                // lecture est déclenchée par `handleFaceClick` au clic — qui
                // fige sous `prefers-reduced-motion` — et non par le montage du
                // nœud.
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={image}
                srcSet={faceSrcSet(image)}
                // `sizes` suit l'état de zoom : la face mesure 343 px au repos
                // (300 × 8/7 de projection perspective, cf.
                // CUBE_FACE_PROJECTION_SCALE) et occupe le viewport une fois
                // ouverte. Sans cette bascule, le navigateur figerait son choix
                // de variante sur la petite et le plein écran serait flou. La
                // variante d'origine referme le `srcset`, donc la qualité
                // d'aujourd'hui est garantie même si ce dimensionnement évolue.
                sizes={opened ? "100vw" : "343px"}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
                // `eager` volontairement conservé : les faces sont repliées en
                // `transform: scale(0)`, donc hors du viewport au sens
                // d'IntersectionObserver — un `lazy` les différerait, et
                // `revealFaceMedia` n'ouvrirait la face qu'au bout de son
                // timeout de 1400 ms, le visuel restant vide. Le coût initial
                // est mesuré : 31 Ko en DPR1, 57 Ko en DPR2 (contre ~248 Ko
                // avant) — le `srcset` ne télécharge que la variante utile au
                // repos, la grande étant réservée au zoom.
                loading="eager"
                // Décodage hors du thread principal : évite de bloquer le
                // premier rendu du cube.
                decoding="async"
              />
            )}
          </div>
        )}
      </div>
      <div
        ref={labelRef}
        // Le contenu est réécrit à chaque frame pendant le brouillage
        // (caractères aléatoires) : sans `aria-hidden`, le lecteur d'écran
        // épelle des suites comme « X Q 7 % » à chaque passage. Le label n'est
        // de toute façon pas interactif — la zone de clic porte déjà le nom de
        // la face via son `aria-label`, et l'onglet correspondant porte le nom
        // stable.
        aria-hidden="true"
        className="pointer-events-none select-none"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#33d1c8",
          // Compense le rendu grayscale de la face pour rejoindre l'épaisseur
          // du label du skip — voir `FACE_LABEL_FONT_SCALE`.
          fontSize: `${1.25 * FACE_LABEL_FONT_SCALE}rem`,
          fontFamily: "var(--font-share-tech-mono), monospace",
          letterSpacing: "0.3em",
          // Même halo que l'overlay du skip : sans lui, le turquoise se fond
          // dans le fond et le label paraît terne par rapport au label du skip.
          textShadow: "0 0 14px rgba(51,209,200,0.5)",
          opacity: 0,
          transition: "opacity 0.35s ease",
          zIndex: 5,
        }}
      >
        {labels[index]}
      </div>
    </div>
  );
}

// Le cube lui-même : les six faces, chacune posée par sa transform.
export function CubeFaces({ lang, images, zoomed, mediaRetracted, labelRefs }) {
  return (
    <>
      {FACES.map((face, i) => (
        <CubeFace
          key={face}
          lang={lang}
          face={face}
          index={i}
          image={images[i]}
          zoomed={zoomed[i]}
          mediaRetracted={mediaRetracted}
          labelRef={(el) => {
            labelRefs.current[i] = el;
          }}
        />
      ))}
    </>
  );
}