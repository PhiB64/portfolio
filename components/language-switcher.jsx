"use client";

/**
 * Sélecteur de langue.
 *
 * Why un composant client. Il doit connaître la page courante pour proposer son
 * équivalent dans l'autre langue — `/projects` doit devenir `/en/projects` et non
 * la racine. Cette information ne peut venir que du routage, donc de
 * `usePathname`. Le reste du site est rendu côté serveur ; ce composant est le
 * seul endroit où le client est nécessaire pour la langue.
 *
 * Pourquoi un lien et non un bouton. Changer de langue change de document : la
 * page anglaise est un fichier statique à part, pas un état de la page
 * courante. Un `<a>` s'affiche, se copie, s'ouvre dans un onglet et fonctionne
 * sans JavaScript ; un bouton ne ferait rien de tout cela. La navigation est
 * dialoguée par le serveur, ce qui est aussi ce qui permet à un moteur de
 * recherche de découvrir `/en` en suivant le lien.
 *
 * Pourquoi il ne reprend pas `?project=N`. Le paramètre désigne la face du cube
 * ouverte au chargement. Le reprendre demanderait `useSearchParams`, qui impose
 * une frontière `Suspense` sur une page entièrement statique, pour un benefit
 * qui disparaît au premier clic : la langue est choisie, la face se choisit
 * ensuite. Le lien pointe donc vers la racine de la langue cible, ce qui est
 * prévisible et toujours valide.
 *
 * `lang` et `hreflang` sur le lien : le premier indique aux lecteurs d'écran et
 * aux moteurs la langue du contenu cible, le second empêche un lecteur d'écran
 * de prononcer « English » avec une phonétique française.
 *
 * Ce que le bouton affiche, et ce qu'il fait. Le texte affiché est la langue de
 * *destination* — « FR » et « Français » pour aller vers le français, « EN » et
 * « English » pour aller vers l'anglais — et c'est bien la langue vers laquelle
 * le lien mène. Le libellé décrit donc l'action du clic, et le clic fait ce qu'il
 * annonce.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { uiFor, LANGUAGE_NAMES, LANGUAGE_CODES } from "../lib/content/ui.js";
import { otherLocale, localePath } from "../lib/site-routes.js";

export function LanguageSwitcher({ lang }) {
  const pathname = usePathname();
  const target = otherLocale(lang);
  if (!target) return null;

  // Le texte visible nomme la langue de *destination* : cliquer « Français »
  // porte le site en français. Le libellé dit donc ce que fait le clic, et non
  // où l'on se trouve.
  //
  // Le nom accessible reprend ce texte puis la phrase qui le confirme — exigence
  // de « Label in Name » (WCAG 2.5.3, niveau A), sans quoi un visiteur qui
  // commande le site à la voix ne peut pas dire « cliquer Français ». `title`
  // reprend la même chaîne pour que le survol et le lecteur d'écran ne se
  // contredisent pas.
  const name = LANGUAGE_NAMES[target] ?? target;
  const code = LANGUAGE_CODES[target] ?? target;
  const href = localePath(target, pathname || "/");
  const label = `${name} — ${uiFor(lang).nav.switchLanguage}`;

  // En bas à gauche, et non en haut à droite comme il était jusqu'ici.
  //
  // En haut à droite, le sélecteur chevauchait le bouton du chatbot : les deux
  // sont en `z-40`, donc c'est l'ordre du DOM qui décide lequel passe devant,
  // et la moitié du lien se retrouvait sous un bouton de 44 px — mesuré, pas
  // supposé. À 360 px de large, le lien allait de x=243 à x=348 et le bouton de
  // x=300 à x=344.
  //
  // En bas, la rangée est déjà prise : SKIP à droite, et CONTACT — centré, large
  // de 130 px — mord jusqu'à x=95 sur un écran de 320 px. Le lien se pose donc à
  // gauche de SKIP, sur sa ligne de base, avec le même offset et le même
  // `env(safe-area-inset-bottom)` qui dégage l'indicateur d'accueil iOS.
  //
  // Why le libellé est plus court en mobile. Avec « English » le lien allait
  // jusqu'à x=117, donc 22 px de chevauchement avec CONTACT en 320 px, et 2 px
  // en 360 ; réduit au code, il finit à x=73 et la rangée respire. Le code fait
  // toujours deux lettres, quelle que soit la langue affichée : la largeur est
  // donc la même sur les deux pages, ce qui n'était pas vrai du nom complet.
  // Celui-ci revient dès `sm`, où le bouton CONTACT n'existe plus — il est
  // `sm:hidden` dans `cube-nav.jsx`, remplacé par son exemplaire dans la barre.
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+24px)] left-3 z-40 sm:bottom-[calc(env(safe-area-inset-bottom)+32px)] sm:left-8">
      <Link
        href={href}
        lang={target}
        hrefLang={target}
        aria-label={label}
        title={label}
        className="inline-flex items-center gap-2 rounded-full border border-[#00a5b0]/60 bg-[#0a0f1c]/85 px-3 py-1.5 text-[11px] tracking-[0.15em] uppercase text-[#00a5b0] backdrop-blur-sm transition-colors duration-200 hover:bg-[#00a5b0]/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1c]"
      >
        <GlobeIcon />
        {/* Deux libellés plutôt qu'un seul replié : `aria-label` ci-dessus
            donne le nom complet au lecteur d'écran quelle que soit la largeur,
            et le texte visible n'est plus que le rappel visuel. `hidden` retire
            l'élément de l'arbre d'accessibilité au lieu de le laisser babiller. */}
        <span className="sm:hidden">{code}</span>
        <span className="hidden sm:inline">{name}</span>
      </Link>
    </div>
  );
}

/**
 * Petite icône de globe, écrite en SVG plutôt qu'importée de `lucide-react`.
 *
 * Le composant est monté dans le layout racine, donc présent sur toutes les
 * pages, y compris celles qui n'utilisent pas le cube. Y importer la boîte
 * entière d'icônes pour un seul glyphe alourdirait chaque page qui n'en a pas
 * d'autre ; l'icône est ici une pièce d'interface de deux traits.
 */
function GlobeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20a15.3 15.3 0 0 1 0-20z" />
    </svg>
  );
}