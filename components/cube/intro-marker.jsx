import { uiFor } from "../../lib/content/ui.js";

// La « souris » du début : carré de vue 300×300 mis à l'échelle du viewport, à
// l'intérieur duquel le logo se morphose et le titre se révèle.
//
// Affichage seul. Cinq nœuds sont exposés au parent, tous animés par la
// chorégraphie via `anime` (morphing du polygone, fil de roue, entrée/sortie du
// titre et du sous-titre) : ce composant ne garde aucun état.
//
// L'invite « SCROLLEZ / VERS / LE BAS » vient du dictionnaire, en lignes : le
// français tient sur trois lignes là où l'anglais (« SCROLL / DOWN ») en tient
// deux. `whitespace-nowrap` a donc été retiré — il était calibré sur deux
// lignes et aurait laissé déborder « SCROLLEZ ». La position verticale est
// calée sur le bas du texte (`top: calc(100% - 78px)`), donc elle encaisse le
// changement de hauteur sans ajusteur : les lignes montent vers le carré.
export function IntroMarker({
  lang,
  squareSize,
  title,
  subtitle,
  morphBodyRef,
  morphWheelRef,
  namesRef,
  subtitleRef,
  hintRef,
}) {
  return (
    <div className="relative">
      {/* Icône de la « souris » : décorative, doublée par le texte
      « SCROLL DOWN » adjacent. Sans `aria-hidden`, certains lecteurs annoncent
      un « graphique » sans nom au milieu de l'intro. */}
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
        ref={hintRef}
        // Même statut que le label du pointer : redondant avec l'`aria-label` de
        // la zone de clic, qui porte déjà la consigne en français. Masqué aux
        // lecteurs, mais traduit pour l'œil, qui voit l'invite dans la langue de
        // la page.
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2 text-sm text-[#00a5b0] tracking-[0.2em] leading-tight text-center uppercase"
        style={{ top: "calc(100% - 78px)" }}
      >
        {uiFor(lang).cube.scrollDown.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}