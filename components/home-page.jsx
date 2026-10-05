/**
 * Page d'accueil, dans une langue.
 *
 * Pourquoi ce composant existe. Il y a deux pages d'accueil — `app/(fr)/` et
 * `app/(en)/` — et le cube est un composant client dont le contenu textuel ne
 * vit que dans ses overlays. Sans ce composant partagé, les deux routes
 * dupliqueraient le bloc `<noscript>` et le `<h1>`, qui portent justement le
 * contenu textuel que le cube ne rend pas. Ce sont les deux éléments qu'il ne
 * faut surtout pas voir diverger entre les langues.
 *
 * Le `<noscript>` est traduit et pointe vers la page `/projects` de sa langue.
 * Un lien vers la version française depuis la page anglaise n'est pas un détail
 * cosmétique : le visiteur qui n'a pas JavaScript n'a aucun autre moyen de lire
 * le portfolio dans la langue qu'il a demandée.
 */

import { HeroCube } from "./hero-cube";
import { FACE_MEDIA } from "../lib/cube-media";
import { metaText } from "../lib/site-metadata";
import { localeHref } from "../lib/site-routes";

/**
 * Repli sans JavaScript, et seul `h1` de la page.
 *
 * Les deux sont dans le même objet parce qu'ils disent la même chose — « qui je
 * suis, et comment lire le portfolio autrement » — et qu'il serait possible d'en
 * traduire un et pas l'autre. Le titre affiché par le cube est un `<text>` SVG :
 * illisible pour un lecteur d'écran, et non interprété comme un titre par les
 * moteurs. Sans ce `h1`, la page n'en a aucun.
 */
const PLAIN = {
  fr: {
    h1: "Philippe Barbosa — Concepteur Développeur Full Stack",
    body:
      "Ce portfolio est une expérience en 3D qui nécessite JavaScript. Le contenu est disponible en texte simple.",
    cta: "Lire le portfolio en texte",
  },
  en: {
    h1: "Philippe Barbosa — Full Stack Developer",
    body:
      "This portfolio is a 3D experience that requires JavaScript. The content is available as plain text.",
    cta: "Read the portfolio as text",
  },
};

export function HomePage({ lang }) {
  const plain = PLAIN[lang] ?? PLAIN.fr;

  return (
    <main>
      <h1 className="sr-only">{plain.h1}</h1>
      {/* Repli sans JavaScript. Le cube, ses onglets et tout le texte éditorial
          sont rendus par un composant client : sans JavaScript, cette page est
          vide. Ce bloc est donc une alternative réelle, offerte à ceux qui ne
          peuvent pas utiliser la page principale — pas un contenu masqué aux
          moteurs. Le lien qu'il contient est aussi le seul lien interne vers
          `/projects` présent dans le HTML servi : l'écran CONTACT ne rend son
          lien qu'une fois ouvert, donc jamais au moment du crawl.

          Un `<a>` et non `next/link` : dans un `<noscript>` le routage client
          n'existe pas, et `next/link` y produirait une ancre vide. D'où
          `localeHref`, qui ajoute le préfixe de sous-dossier que `next/link`
          ajoute de son côté. */}
      <noscript>
        <div className="max-w-3xl mx-auto px-6 py-16 text-[#94a3b8]">
          <p className="mb-6">{plain.body}</p>
          <a href={localeHref(lang, "/projects")} className="text-[#00a5b0] underline">
            {plain.cta}
          </a>
        </div>
      </noscript>
      <HeroCube
        lang={lang}
        title="Philippe Barbosa"
        subtitle={metaText(lang).jobTitle}
        images={FACE_MEDIA}
      />
    </main>
  );
}