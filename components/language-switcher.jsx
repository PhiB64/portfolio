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
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { uiFor, LANGUAGE_NAMES } from "../lib/content/ui.js";
import { otherLocale, localePath } from "../lib/site-routes.js";

export function LanguageSwitcher({ lang }) {
  const pathname = usePathname();
  const target = otherLocale(lang);
  if (!target) return null;

  const label = uiFor(lang).nav.switchLanguage;
  const name = LANGUAGE_NAMES[target] ?? target;
  const href = localePath(target, pathname || "/");

  return (
    <div className="fixed top-3 right-3 z-40 sm:top-5 sm:right-5">
      <Link
        href={href}
        lang={target}
        hrefLang={target}
        aria-label={label}
        title={label}
        className="inline-flex items-center gap-2 rounded-full border border-[#00a5b0]/60 bg-[#0a0f1c]/85 px-3 py-1.5 text-[11px] tracking-[0.15em] uppercase text-[#00a5b0] backdrop-blur-sm transition-colors duration-200 hover:bg-[#00a5b0]/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1c]"
      >
        <GlobeIcon />
        {name}
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