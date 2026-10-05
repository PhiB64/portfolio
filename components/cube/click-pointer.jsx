import { MousePointer2 } from "lucide-react";
import { uiFor } from "../../lib/content/ui.js";

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

// Incitateur de clic : anneau, glyphe et légende sous le cube. Ce sont des nœuds
// que la chorégraphie anime directement (`anime` écrit `transform` et `opacity`
// à chaque frame), donc ce composant ne garde aucun état : il expose des nœuds
// au parent et n'affiche rien de son propre chef.
//
// L'opacité de départ est à 0 sur les trois nœuds — la chorégraphie les allume.
export function ClickPointer({ lang, ringRef, rippleRef, glyphRef, labelRef }) {
  return (
    <>
      <div
        ref={ringRef}
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
          ref={rippleRef}
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
          ref={glyphRef}
          data-pointer-glyph=""
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            // Décalages par marges, jamais par transform : la transform
            // appartient à `anime`, qui la réécrit entièrement à chaque frame.
            // On recule la boîte de `POINTER_TIP` — la pointe elle-même — au
            // lieu de l'avancer, si bien que le coin du curseur, et non son axe
            // médian, tombe au centre de l'anneau.
            marginLeft: -POINTER_TIP,
            marginTop: -POINTER_TIP,
            color: "#33d1c8",
            filter: "drop-shadow(0 0 10px rgba(51,209,200,0.65))",
            lineHeight: 0,
          }}
        >
          <MousePointer2 size={POINTER_GLYPH_SIZE} strokeWidth={2.4} aria-hidden="true" />
        </div>
      </div>
      <div
        ref={labelRef}
        // Texte redondant avec l'`aria-label` de la zone de clic (« appuyez sur
        // Entrée pour ouvrir la face ») : masqué aux lecteurs, qui reçoivent la
        // consigne via cette zone. Traduit malgré tout — c'est l'un des deux
        // seuls textes visibles de ce composant, il était en anglais dans une
        // page `lang="fr"`.
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
        {uiFor(lang).cube.clickToExplore}
      </div>
    </>
  );
}