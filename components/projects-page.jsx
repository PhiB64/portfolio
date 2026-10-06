/**
 * Version lisible et indexable des six rubriques du cube.
 *
 * Pourquoi cette page existe : le contenu des rubriques ne vit que dans des
 * boîtes de dialogue rendues par un composant client. Le HTML servi par le site
 * est donc un cube et six onglets, et la totalité du texte éditorial — titres,
 * compétences, projets, méthode — n'apparaît dans aucun document. Un moteur de
 * recherche indexait un titre, un nom et six mots-clés.
 *
 * Pourquoi elle ne duplique pas ce contenu : elle appelle `renderProjectContent`,
 * la fonction qui produit les overlays, au lieu de le réécrire. Le texte vient
 * donc de la même source que l'overlay — `getContent(lang)` — et il est produit
 * par le même code. Si une compétence change, elle change sur les deux
 * emplacements, dans les deux langues, sans qu'il faille s'en souvenir.
 *
 * Elle est un composant serveur, sans `"use client"` : c'est ce qui fait que le
 * HTML est complet dans le fichier exporté. Un composant client produirait ici le
 * même document vide que la page d'accueil.
 *
 * Elle ne rend aucun balisage d'overlay : ni `role="dialog"`, ni
 * `aria-labelledby`, ni zone de défilement verrouillée, ni bouton d'appel à
 * l'action sans gestionnaire. C'est une page, et son contenu est du contenu.
 *
 * Pourquoi un composant partagé plutôt que deux pages. `app/(en)/projects` et
 * `app/(fr)/fr/projects` ne font que choisir la langue et exporter les
 * métadonnées. Tout le reste — structure, sommaire, appels à `renderProjectContent`
 * — est identique, et une copie aurait dérivé.
 */

import Link from "next/link";

import { renderProjectContent, sectionSlug } from "./cube/project-content";
import { getContent, getUI } from "../lib/content/index.js";
import { localePath } from "../lib/site-routes.js";

/**
 * Sommaire des six rubriques.
 *
 * Sur une page longue de six sections denses, sans sommaire il faut faire défiler
 * pour savoir ce qu'il reste. Il sert aussi de résumé lisible : un moteur qui
 * n'exécute pas de JavaScript voit les six libellés dans le document.
 */
function Summary({ lang }) {
  const t = getUI(lang).projectsPage;
  const { PROJECT_CONTENT } = getContent(lang);
  return (
    <nav aria-label={t.summaryNav} className="mb-20">
      <h2 className="text-xs tracking-[0.2em] uppercase text-[#94a3b8] mb-4">
        {t.summaryTitle}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {PROJECT_CONTENT.map((section) => {
          const slug = sectionSlug(section);
          return (
            <li key={slug}>
              <a
                href={`#${slug}`}
                className="inline-block bg-[#0a0f1c] border border-[#00a5b0]/60 text-[#00a5b0] tracking-[0.2em] uppercase rounded-full px-4 py-2 text-xs transition-colors hover:bg-[#00a5b0]/10"
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ProjectsPage({ lang }) {
  const t = getUI(lang).projectsPage;
  const { PROJECT_CONTENT } = getContent(lang);
  const home = localePath(lang, "/");

  return (
    // `html` et `body` sont verrouillés (`overflow: hidden` dans `globals.css`)
    // pour que la page d'accueil n'ait qu'un seul défilement, celui de la
    // section du cube. Cette page reprend donc le même montage : un conteneur
    // fixe qui défile lui-même. Réutiliser le verrou existant plutôt que le
    // desserrer — le cube en dépend.
    <div className="fixed inset-0 overflow-y-auto scroll-none">
      <div className="max-w-3xl mx-auto px-6 sm:px-8 py-16 sm:py-24">
        {/* `next/link` ajoute lui-même le `basePath` : lui passer un chemin déjà
            préfixé produirait `/portfolio/portfolio`. */}
        <Link
          href={home}
          className="inline-block text-[#00a5b0] tracking-[0.2em] uppercase text-xs mb-12 hover:text-white transition-colors"
        >
          {t.backToCube}
        </Link>

        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">{t.h1}</h1>
        <p className="text-[#94a3b8] mb-20 text-lg">{t.intro}</p>

        <Summary lang={lang} />

        {PROJECT_CONTENT.map((section, index) => {
          const slug = sectionSlug(section);
          return (
            // `scroll-mt` laisse de l'air sous l'ancre quand on saute à une
            // section, sinon le titre passe sous le bord de la fenêtre.
            <section key={slug} className="mb-28 scroll-mt-8">
              {renderProjectContent(index, {
                lang,
                headingOffset: 1,
                titleId: slug,
              })}
            </section>
          );
        })}

        <nav aria-label={t.footerNav} className="border-t border-[#1e293b] pt-8">
          <Link
            href={home}
            className="inline-block text-[#00a5b0] tracking-[0.2em] uppercase text-xs hover:text-white transition-colors"
          >
            {t.backToCube}
          </Link>
        </nav>
      </div>
    </div>
  );
}