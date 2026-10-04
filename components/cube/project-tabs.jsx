"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";
import { reduceMotion } from "../../lib/reduced-motion";

// Les onglets sont pilotés par état, pas par route : l'URL `?project=N` est
// réécrite par `openProject`, et `url` n'était jamais lu. Le conserver
// suggérait un routage qui n'existe pas.
export const PROJECT_LINKS = [
  { name: "WEB" },
  { name: "REACT" },
  { name: "BACKEND" },
  { name: "DATABASE" },
  { name: "MOBILE" },
  { name: "PROJETS" },
];

const TAB_BASE =
  "text-center whitespace-nowrap tracking-[0.2em] uppercase rounded-full px-4 py-2 text-xs transition-colors duration-300 cursor-pointer border";
const TAB_INACTIVE =
  "bg-[#0a0f1c] border-[#00a5b0]/60 text-[#00a5b0] hover:bg-[#00a5b0]/10 hover:text-white";
const TAB_ACTIVE = "bg-[#00a5b0] border-[#00a5b0] text-[#0a0f1c]";
const CONTACT_BASE =
  "text-center whitespace-nowrap tracking-[0.2em] uppercase rounded-full px-4 py-2 text-xs transition-colors duration-300 cursor-pointer border-0";
// Fonds et couleurs sont choisis par variant, jamais empilés : deux utilitaires
// Tailwind de même propriété (`bg-white` / `bg-[#00a5b0]`) se départagent
// selon l'ordre du CSS généré, pas selon celui de la chaîne de classes.
const CONTACT_INACTIVE = "bg-white text-[#0a0f1c] hover:bg-white/80";
const CONTACT_ACTIVE = "bg-[#00a5b0] text-[#0a0f1c] hover:bg-[#00a5b0]/90";

// Barre d'onglets partagée par les overlays (page projet, page contact).
// Bureau uniquement : sur mobile le retour à la page principale se fait avec
// le bouton « ← RETOUR » en bas de page, la barre resterait trop encombrante.
// Seuils de la barre : masquée au moindre pixel de défilement, revenue
// seulement une fois revenu tout en haut. `HIDE_ABOVE` minuscule pour que le
// premier cran de molette la fasse partir ; `SHOW_BELOW` à 0 pour qu'elle
// réapparaisse au point de repère exact, loin du seuil où elle s'est cachée.
const HIDE_ABOVE = 1;
const SHOW_BELOW = 0;
// Le bouton « retour en haut » n'apparaît qu'une fois franchement descendu,
// pour ne pas doubler la barre d'onglets au sommet de la page.
const TOP_BUTTON_ABOVE = 400;

// « ← RETOUR » partagé par ses deux emplacements (haut sur desktop, bas de
// page sur mobile). Exporté pour que chaque overlay le rende à la fin de son
// contenu, seul endroit d'où il peutouncer dans le flux en mobile.
export function BackButton({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[#00a5b0] tracking-[0.2em] uppercase text-sm hover:opacity-70 transition-opacity bg-transparent border-0 cursor-pointer ${className}`}
    >
      &larr; RETOUR
    </button>
  );
}

export function ProjectTabs({
  activeIndex = null,
  contactActive = false,
  onSelect,
  onContact,
  onBack,
}) {
  const barRef = useRef(null);
  const [hidden, setHidden] = useState(false);
  const [showTopButton, setShowTopButton] = useState(false);
  const scrollerRef = useRef(null);

  // La barre est `sticky` dans le conteneur défilant de l'overlay : on remonte
  // la chaîne jusqu'à lui pour écouter le scroll, plutôt que la fenêtre qui
  // ne bouge pas ici.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let scroller = bar.parentElement;
    while (scroller) {
      const overflowY = getComputedStyle(scroller).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      scroller = scroller.parentElement;
    }
    if (!scroller) return;
    scrollerRef.current = scroller;

    const onScroll = () => {
      const y = scroller.scrollTop;
      setHidden((wasHidden) =>
        wasHidden ? y > SHOW_BELOW : y > HIDE_ABOVE,
      );
      setShowTopButton(y > TOP_BUTTON_ABOVE);
    };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  // Retour animé plutôt qu'un saut sec : sur les pages longues, un `scrollTop`
  // direct ferait basculer le contenu d'un coup.
  const scrollToTop = useCallback(() => {
    // `behavior: "smooth"` est une animation, donc soumis à la préférence
    // système : sous `reduce`, on saute directement au sommet. Le reste du
    // défilement de cette page est déjà piloté par la molette ou le tactile de
    // l'utilisateur, rien à neutraliser.
    scrollerRef.current?.scrollTo({
      top: 0,
      behavior: reduceMotion() ? "auto" : "smooth",
    });
  }, []);

  return (
    <>
      <div
        ref={barRef}
        className={`sticky top-0 z-20 hidden w-full sm:block bg-[#0a0f1c]/80 backdrop-blur-md transition-transform duration-300 ease-out ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        {/* `aria-label` : la page contient deux `nav` (barre d'onglets + barre
            du cube en fond, même masquée par `inert`), et un lecteur doit les
            distinguer. Le nom reprend le contexte — rubrique ou contact. */}
        <nav
          aria-label={contactActive ? "Rubriques — page contact" : "Rubriques du portfolio"}
          className="relative flex w-full flex-wrap items-center justify-center gap-3 px-4 pt-6 pb-4"
        >
          {PROJECT_LINKS.map((link, i) => {
            const active = activeIndex === i;
            return (
              <button
                key={link.name}
                type="button"
                onClick={() => onSelect?.(i)}
                aria-current={active ? "page" : undefined}
                className={`${TAB_BASE} ${active ? TAB_ACTIVE : TAB_INACTIVE}`}
              >
                {link.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onContact}
            aria-current={contactActive ? "page" : undefined}
            className={`${CONTACT_BASE} sm:ml-6 ${contactActive ? CONTACT_ACTIVE : CONTACT_INACTIVE}`}
          >
            CONTACT
          </button>
        </nav>
      </div>

      {/* « ← RETOUR » sort de la barre pour survivre à son escamotage. Ancré en
          haut à gauche sur desktop seulement ; en mobile la barre est masquée
          et l'overlay le rend en fin de contenu, hors de ce composant. */}
      {onBack && (
        <BackButton
          onClick={onBack}
          className="hidden sm:inline-block fixed top-6 left-4 z-30"
        />
      )}

      {showTopButton && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Retour en haut de page"
          className="fixed bottom-8 right-8 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#00a5b0]/60 bg-[#0a0f1c]/80 text-[#00a5b0] backdrop-blur-md hover:bg-[#00a5b0]/10 hover:text-white transition-colors duration-300 cursor-pointer"
        >
          <ChevronUp size={20} />
        </button>
      )}
    </>
  );
}