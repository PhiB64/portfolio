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
 * donc de la même source que l'overlay — `lib/portfolio-content.js` — et il est
 * produit par le même code. Si une compétence change, elle change sur les deux
 * emplacements, sans qu'il faille s'en souvenir.
 *
 * Elle est un composant serveur, sans `"use client"` : c'est ce qui fait que le
 * HTML est complet dans le fichier exporté. Un composant client produirait ici le
 * même document vide que la page d'accueil.
 *
 * Elle ne rend aucun balisage d'overlay : ni `role="dialog"`, ni
 * `aria-labelledby`, ni zone de défilement verrouillée, ni bouton d'appel à
 * l'action sans gestionnaire. C'est une page, et son contenu est du contenu.
 */

import Link from "next/link";
import {
  renderProjectContent,
  PROJECT_CONTENT,
  sectionSlug,
} from "../../components/cube/project-content";
import { SITE_ROOT, assetUrl } from "../../lib/site-url";

const PATH = "/projects";

const TITLE = "Compétences & projets — Philippe Barbosa";

const DESCRIPTION =
  "Développement web, front-end React et Next.js, back-end Node.js et Strapi, bases de données et cloud, développement mobile : le détail des compétences de Philippe Barbosa et de ses projets en production.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // Sans cette canonique propre, la page hériterait de celle du layout — soit
  // l'URL de l'accueil. Elle se déclarerait alors canonique d'une autre page, ce
  // que les moteurs lisent comme une instruction de désindexer l'URL réelle.
  // Le préfixe `/portfolio` vient de `SITE_ROOT`.
  alternates: { canonical: `${SITE_ROOT}${PATH}` },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_ROOT}${PATH}`,
    type: "website",
    locale: "fr_FR",
    siteName: "Portfolio Philippe Barbosa",
    images: [
      {
        url: assetUrl("/og-image.png"),
        width: 1200,
        height: 630,
        alt: "Philippe Barbosa — Concepteur Développeur Full Stack",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [assetUrl("/og-image.png")],
  },
};

/**
 * Sommaire des six rubriques.
 *
 * Sur une page longue de six sections denses, sans sommaire il faut faire défiler
 * pour savoir ce qu'il reste. Il sert aussi de résumé lisible : un moteur qui
 * n'exécute pas de JavaScript voit les six libellés dans le document.
 */
function Summary() {
  return (
    <nav aria-label="Sommaire des rubriques" className="mb-20">
      <h2 className="text-xs tracking-[0.2em] uppercase text-[#94a3b8] mb-4">
        Sommaire
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

export default function ProjectsPage() {
  return (
    // `html` et `body` sont verrouillés (`overflow: hidden` dans `globals.css`)
    // pour que la page d'accueil n'ait qu'un seul défilement, celui de la
    // section du cube. Cette page reprend donc le même montage : un conteneur
    // fixe qui défile lui-même. Réutiliser le verrou existant plutôt que le
    // desserrer — le cube en dépend.
    <div className="fixed inset-0 overflow-y-auto scroll-none">
      <div className="max-w-3xl mx-auto px-6 sm:px-8 py-16 sm:py-24">
        {/* `href="/"` et non le préfixe : `next/link` ajoute lui-même le
            `basePath`. Lui passer `/portfolio` produisait `/portfolio/portfolio`. */}
        <Link
          href="/"
          className="inline-block text-[#00a5b0] tracking-[0.2em] uppercase text-xs mb-12 hover:text-white transition-colors"
        >
          ← Retour au cube
        </Link>

        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
          Compétences &amp; projets
        </h1>
        <p className="text-[#94a3b8] mb-20 text-lg">
          Le contenu des six rubriques du cube, en texte complet et sans
          animation.
        </p>

        <Summary />

        {PROJECT_CONTENT.map((section, index) => {
          const slug = sectionSlug(section);
          return (
            // `scroll-mt` laisse de l'air sous l'ancre quand on saute à une
            // section, sinon le titre passe sous le bord de la fenêtre.
            <section key={slug} className="mb-28 scroll-mt-8">
              {renderProjectContent(index, { headingOffset: 1, titleId: slug })}
            </section>
          );
        })}

        <nav aria-label="Navigation de pied de page" className="border-t border-[#1e293b] pt-8">
          <Link
            href="/"
            className="inline-block text-[#00a5b0] tracking-[0.2em] uppercase text-xs hover:text-white transition-colors"
          >
            ← Retour au cube
          </Link>
        </nav>
      </div>
    </div>
  );
}
