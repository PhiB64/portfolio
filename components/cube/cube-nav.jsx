import { Undo2 } from "lucide-react";

import { projectLinks } from "./project-tabs";
import { uiFor } from "../../lib/content/ui.js";

// Les onglets viennent de `project-tabs`, qui lit le dernier libellé dans le
// dictionnaire de langue : « PROJETS » en français, « PROJECTS » en anglais.
// `CubeNav` et `ProjectTabs` affichent donc la même liste, et ne peuvent pas
// diverger sur le nombre de rubriques.
export { projectLinks };

// Les trois boutons qui pilotent le visiteur une fois l'intro passée : les
// onglets de rubriques, SKIP/RETOUR, et CONTACT (deux exemplaires, desktop et
// mobile).
//
// Affichage seul — la condition de visibilité de chaque bouton est calculée ici,
// à partir de quatre drapeaux déjà tenus par le parent. Le point non trivial,
// et le même pour les deux boutons CONTACT : `opacity: 0` ne sort pas un bouton
// de la tabulation, et `pointerEvents: none` n'en fait pas un obstacle au
// clavier. Un bouton masqué resterait donc atteignable et annoncé avant que la
// chorégraphie ne le révèle. On le sort donc de la tabulation et de l'arbre
// d'accessibilité, pas du rendu : `visibility` conviendrait mais tuerait le fondu
// de 0,6 s.
export function CubeNav({
  lang,
  zoomedFaces,
  skipped,
  skipRevealedFaces,
  contactDone,
  onOpenProject,
  onContactClick,
  onSkip,
  onRestart,
  showReturn,
  contactBtnStyle,
}) {
  const t = uiFor(lang).nav;
  return (
    <>
      <nav
        aria-label={t.sections}
        className="absolute top-20 sm:top-6 left-1/2 -translate-x-1/2 z-30 grid grid-cols-3 gap-2 px-2 max-w-[88vw] w-[88vw] sm:w-auto sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 sm:px-4"
      >
        {projectLinks(lang).map((link, i) => {
          const shown =
            zoomedFaces[i] || (skipped && (skipRevealedFaces[i] || contactDone));
          return (
            <button
              key={link.name}
              onClick={() => onOpenProject(i)}
              onFocus={(e) => {
                // `opacity: 0` n'empêche ni le focus ni l'activation au clavier :
                // sans ce correctif, la tabulation menait à six boutons
                // invisibles. On les révèle au focus (comme un lien d'évitement) ;
                // le style inline est réécrit au prochain render, qui restaure
                // l'opacité d'origine.
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.pointerEvents = "auto";
              }}
              // Masqué = hors tabulation et hors arbre d'accessibilité. Le
              // `onFocus` ci-dessus reste le filet pour le cas où le focus
              // arriverait quand même (navigateur qui ignore `tabIndex`,
              // restauration de session…) : le bouton se révèle au lieu de rester
              // un arrêt invisible.
              tabIndex={shown ? 0 : -1}
              aria-hidden={shown ? undefined : true}
              className="w-full sm:w-auto text-center whitespace-nowrap bg-[#0a0f1c] border border-[#00a5b0]/60 text-[#00a5b0] tracking-[0.2em] uppercase rounded-full px-2.5 sm:px-4 py-2 text-[11px] sm:text-xs transition-all duration-500 hover:bg-[#00a5b0]/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1c] cursor-pointer"
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
          tabIndex={contactDone ? 0 : -1}
          aria-hidden={contactDone ? undefined : true}
          className="hidden text-center sm:inline-block bg-white text-[#0a0f1c] tracking-[0.2em] uppercase rounded-full px-4 py-2 text-xs sm:ml-6 hover:bg-white/80 transition-colors duration-300 cursor-pointer border-0"
          style={contactBtnStyle}
        >
          CONTACT
        </button>
      </nav>
      <button
        onClick={showReturn ? () => onRestart?.() : onSkip}
        aria-label={showReturn ? t.restart : t.skip}
        // Le bouton n'a pas de fondu — l'opacité passe de 1 à 0 d'un coup — mais
        // la correction retenue est la même que pour CONTACT, et pour la même
        // raison : `visibility` conviendrait ici, mais il tuerait le fondu de
        // 0,6 s du bouton voisin.
        tabIndex={showReturn || (!contactDone && !skipped) ? 0 : -1}
        aria-hidden={showReturn || (!contactDone && !skipped) ? undefined : true}
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+24px)] right-3 sm:bottom-[calc(env(safe-area-inset-bottom)+32px)] sm:right-8 z-30 bg-[#0a0f1c]/70 text-[#00a5b0] transition-all duration-500 cursor-pointer hover:text-white rounded-full flex items-center justify-center"
        style={{
          opacity: showReturn || (!contactDone && !skipped) ? 1 : 0,
          pointerEvents: showReturn || (!contactDone && !skipped) ? "auto" : "none",
        }}
      >
        {showReturn ? (
          <span className="h-10 w-10 sm:h-11 sm:w-11 flex items-center justify-center">
            <Undo2 className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
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
    </>
  );
}