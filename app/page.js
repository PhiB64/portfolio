import { HeroCube } from "../components/hero-cube";
import { FACE_MEDIA } from "../lib/cube-media";

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
      <HeroCube
        title="Philippe Barbosa"
        subtitle="Concepteur Développeur"
        images={FACE_MEDIA}
      />
    </main>
  );
}
