import { HeroCube } from "../components/hero-cube";
import { ChatWidget } from "../components/chat-widget";
import { FACE_MEDIA } from "../lib/cube-media";

// Préfixe de sous-dossier : `/portfolio` sur GitHub Pages, vide en local.
// `next.config.mjs` l'injecte via `env`. Ici un `<a>` et non `next/link` parce
// que le bloc est dans un `<noscript>` : `next/link` y produirait une ancre vide,
// puisque le routage client n'existe pas quand JavaScript est désactivé.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function Home() {
  return (
    <main>
      {/* Le titre affiché est un `<text>` SVG, illisible pour un lecteur d'écran
          et non interprété comme un titre par les moteurs de recherche : la page
          d'accueil n'avait donc aucun `h1`. Celui-ci est visuellement masqué et
          ne modifie aucune mise en page. */}
      <h1 className="sr-only">
        Philippe Barbosa — Concepteur Développeur Full Stack
      </h1>
      {/* Repli sans JavaScript. Le cube, ses onglets et tout le texte éditorial
          sont rendus par un composant client : sans JavaScript, cette page est
          vide. Ce bloc est donc une alternative réelle, offerte à ceux qui ne
          peuvent pas utiliser la page principale — pas un contenu masqué aux
          moteurs. Le lien qu'il contient est aussi le seul lien interne vers
          `/projects` présent dans le HTML servi : l'écran CONTACT ne rend son
          lien qu'une fois ouvert, donc jamais au moment du crawl. */}
      <noscript>
        <div className="max-w-3xl mx-auto px-6 py-16 text-[#94a3b8]">
          <p className="mb-6">
            Ce portfolio est une expérience en 3D qui nécessite JavaScript. Le
            contenu est disponible en texte simple.
          </p>
          <a href={`${BASE_PATH}/projects`} className="text-[#00a5b0] underline">
            Lire le portfolio en texte
          </a>
        </div>
      </noscript>
      <HeroCube
        title="Philippe Barbosa"
        subtitle="Concepteur Développeur"
        images={FACE_MEDIA}
      />
      {/* Chatbot : se rend par-dessus le cube, en `z-40`. Le composant ne rend
          rien si NEXT_PUBLIC_CHAT_ENDPOINT est absent (Worker non déployé). */}
      <ChatWidget />
    </main>
  );
}
