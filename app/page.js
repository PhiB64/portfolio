import { HeroCube } from "../components/hero-cube";

// Stable reference: avoids re-running the animation useEffect on every re-render.
const HERO_IMAGES = [
  "/web.webm",
  "/react.webp",
  "/backend.webm",
  "/database.webp",
  "/mobile.webm",
  "/projets.webp",
];

export default function Home() {
  return (
    <main>
      <HeroCube
        title="Philippe Barbosa"
        subtitle="Concepteur Développeur"
        images={HERO_IMAGES}
      />
    </main>
  );
}
